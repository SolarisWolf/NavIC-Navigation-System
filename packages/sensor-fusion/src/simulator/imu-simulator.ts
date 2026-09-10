import { 
  IMUProvider, 
  IMUStatus, 
  AccelerometerCallback, 
  GyroscopeCallback, 
  MagnetometerCallback,
  AccelerometerReading,
  GyroscopeReading,
  MagnetometerReading,
  Vector3,
  Logger
} from '@navic/shared-models';

export class IMUSimulator implements IMUProvider {
  public readonly name = 'IMU Simulator';
  public readonly isSimulated = true;
  
  private logger = new Logger('IMUSimulator');
  private active = false;
  private sampleRateHz = 50;
  private timer: ReturnType<typeof setInterval> | null = null;
  
  private accelCallbacks: AccelerometerCallback[] = [];
  private gyroCallbacks: GyroscopeCallback[] = [];
  private magCallbacks: MagnetometerCallback[] = [];

  // Vehicle state provided by external sync (e.g. from GNSS/Route Simulator)
  private currentSpeedMs = 0;
  private currentBearingDeg = 0;
  private lastSpeedMs = 0;
  private lastBearingDeg = 0;
  private lastUpdateTime = Date.now();

  constructor() {}

  /**
   * Update the internal vehicle state so the IMU can generate realistic physics.
   */
  public updateVehicleState(speedMs: number, bearingDeg: number): void {
    this.currentSpeedMs = speedMs;
    
    // Handle bearing wrap-around for yaw calculation
    if (this.currentBearingDeg > 270 && bearingDeg < 90) {
      this.lastBearingDeg -= 360;
    } else if (this.currentBearingDeg < 90 && bearingDeg > 270) {
      this.lastBearingDeg += 360;
    }
    
    this.currentBearingDeg = bearingDeg;
  }

  public start(frequencyHz = 50): void {
    if (this.active) return;
    this.sampleRateHz = frequencyHz;
    this.active = true;
    this.lastUpdateTime = Date.now();
    this.lastSpeedMs = this.currentSpeedMs;
    this.lastBearingDeg = this.currentBearingDeg;

    const intervalMs = 1000 / this.sampleRateHz;
    this.timer = setInterval(() => this.tick(), intervalMs);
    this.logger.info(`Started at ${this.sampleRateHz}Hz`);
  }

  public stop(): void {
    if (!this.active) return;
    this.active = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.logger.info('Stopped');
  }

  public onAccelerometer(cb: AccelerometerCallback): void {
    this.accelCallbacks.push(cb);
  }

  public onGyroscope(cb: GyroscopeCallback): void {
    this.gyroCallbacks.push(cb);
  }

  public onMagnetometer(cb: MagnetometerCallback): void {
    this.magCallbacks.push(cb);
  }

  public getStatus(): IMUStatus {
    return {
      isActive: this.active,
      hasAccelerometer: true,
      hasGyroscope: true,
      hasMagnetometer: true,
      sampleRateHz: this.sampleRateHz,
      isSimulated: true
    };
  }

  private tick(): void {
    const now = Date.now();
    const dt = (now - this.lastUpdateTime) / 1000.0; // seconds
    if (dt <= 0) return;

    // 1. Calculate derivatives
    const accelY = (this.currentSpeedMs - this.lastSpeedMs) / dt; // Forward acceleration
    const yawRateDeg = (this.currentBearingDeg - this.lastBearingDeg) / dt;
    const yawRateRad = yawRateDeg * (Math.PI / 180.0);

    // Update last state
    this.lastSpeedMs = this.currentSpeedMs;
    this.lastBearingDeg = this.currentBearingDeg;
    this.lastUpdateTime = now;

    // 2. Generate Accelerometer Data
    // Z is gravity (9.81), Y is forward/backward, X is lateral (simulate 0 for now)
    // Add noise
    const accNoiseX = (Math.random() - 0.5) * 0.1;
    const accNoiseY = (Math.random() - 0.5) * 0.2;
    const accNoiseZ = (Math.random() - 0.5) * 0.1;

    const accReading: AccelerometerReading = {
      timestamp: now,
      acceleration: {
        x: accNoiseX,
        y: accelY + accNoiseY,
        z: 9.81 + accNoiseZ
      },
      isSimulated: true
    };

    // 3. Generate Gyroscope Data
    const gyroNoiseX = (Math.random() - 0.5) * 0.01;
    const gyroNoiseY = (Math.random() - 0.5) * 0.01;
    const gyroNoiseZ = (Math.random() - 0.5) * 0.02;

    const gyroReading: GyroscopeReading = {
      timestamp: now,
      angularVelocity: {
        x: gyroNoiseX,
        y: gyroNoiseY,
        z: yawRateRad + gyroNoiseZ
      },
      isSimulated: true
    };

    // 4. Generate Magnetometer Data (Microteslas)
    // Earth's magnetic field is ~25 to 65 µT.
    // We'll simulate a 45µT horizontal field pointing towards Magnetic North.
    // Rotation matrix around Z axis to project North onto vehicle coordinates:
    const headingRad = this.currentBearingDeg * (Math.PI / 180.0);
    const magStrength = 45.0;
    const magX = magStrength * Math.sin(-headingRad);
    const magY = magStrength * Math.cos(-headingRad);
    const magZ = 20.0; // Downward vertical component

    const magNoise = () => (Math.random() - 0.5) * 1.0;

    const magReading: MagnetometerReading = {
      timestamp: now,
      magneticField: {
        x: magX + magNoise(),
        y: magY + magNoise(),
        z: magZ + magNoise()
      },
      isSimulated: true
    };

    // 5. Broadcast
    for (const cb of this.accelCallbacks) cb(accReading);
    for (const cb of this.gyroCallbacks) cb(gyroReading);
    for (const cb of this.magCallbacks) cb(magReading);
  }
}
