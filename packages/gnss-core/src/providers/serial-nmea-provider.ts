/**
 * USB Serial / NMEA 0183 Hardware Provider
 *
 * Decodes standard NMEA 0183 data streams from physical GNSS receivers,
 * external USB dongles (e.g. u-blox, Quectel, NavIC receivers), or Bluetooth GNSS devices.
 * Uses Web Serial API in modern browsers or manual stream feeding.
 *
 * All measurements emitted by this provider have `isSimulated: false`.
 */

import {
  type GNSSProvider,
  type GNSSMeasurement,
  type GNSSStatus,
  type GNSSMeasurementCallback,
  type GNSSStatusCallback,
  type SatelliteInfo,
  Constellation,
  FixType,
  Logger,
} from '@navic/shared-models';

export interface NMEAParsedState {
  latitude: number | null;
  longitude: number | null;
  altitude: number;
  speed: number;
  bearing: number;
  horizontalAccuracy: number;
  verticalAccuracy: number;
  fixType: FixType;
  satellites: SatelliteInfo[];
  timestamp: number;
}

export class SerialNMEAProvider implements GNSSProvider {
  readonly name = 'USB Serial / NMEA GNSS Hardware';
  readonly isSimulated = false;
  private readonly logger = new Logger('SerialNMEAProvider');

  private isRunning = false;
  private hasFix = false;
  private lastUpdateTimestamp: number | null = null;
  private lastMeasurement: GNSSMeasurement | null = null;

  private measurementCallbacks: Set<GNSSMeasurementCallback> = new Set();
  private statusCallbacks: Set<GNSSStatusCallback> = new Set();

  private currentState: NMEAParsedState = {
    latitude: null,
    longitude: null,
    altitude: 0,
    speed: 0,
    bearing: 0,
    horizontalAccuracy: 10.0,
    verticalAccuracy: 15.0,
    fixType: FixType.NoFix,
    satellites: [],
    timestamp: Date.now(),
  };

  private port: any = null;
  private reader: any = null;
  private buffer = '';

  /**
   * Check if Web Serial API is supported in the browser.
   */
  public static isSerialSupported(): boolean {
    return typeof navigator !== 'undefined' && 'serial' in navigator;
  }

  public start(): void {
    this.isRunning = true;
    this.updateStatus(this.hasFix, this.currentState.fixType);
  }

  public stop(): void {
    this.isRunning = false;
    if (this.reader) {
      try {
        this.reader.cancel();
      } catch (e) {}
      this.reader = null;
    }
    if (this.port) {
      try {
        this.port.close();
      } catch (e) {}
      this.port = null;
    }
    this.updateStatus(false, FixType.NoFix);
  }

  /**
   * Request user to pick a USB serial port and begin reading NMEA stream.
   */
  public async connectSerial(baudRate = 9600): Promise<boolean> {
    if (!SerialNMEAProvider.isSerialSupported()) {
      console.warn('[SerialNMEAProvider] Web Serial API not supported in this browser');
      return false;
    }

    try {
      const serial = (navigator as any).serial;
      this.port = await serial.requestPort();
      await this.port.open({ baudRate });
      this.start();
      this.readLoop();
      return true;
    } catch (err) {
      this.logger.error('Failed to connect to serial port:', err);
      return false;
    }
  }

  private async readLoop(): Promise<void> {
    const textDecoder = new TextDecoder();
    try {
      while (this.port?.readable && this.isRunning) {
        this.reader = this.port.readable.getReader();
        try {
          while (true) {
            const { value, done } = await this.reader.read();
            if (done) break;
            if (value) {
              this.feedChunk(textDecoder.decode(value, { stream: true }));
            }
          }
        } finally {
          this.reader.releaseLock();
          this.reader = null;
        }
      }
    } catch (err) {
      this.logger.error('Serial read error:', err);
    }
  }

  /**
   * Feed a chunk of characters into the NMEA stream buffer.
   */
  public feedChunk(chunk: string): void {
    this.buffer += chunk;
    const lines = this.buffer.split(/\r\n|\n/);
    this.buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('$')) {
        this.parseSentence(trimmed);
      }
    }
  }

  /**
   * Directly parse a single NMEA sentence string (e.g. from tests or mock streams).
   */
  public parseSentence(sentence: string): boolean {
    if (!sentence.startsWith('$')) return false;

    // Validate checksum if present
    const starIdx = sentence.indexOf('*');
    if (starIdx !== -1) {
      const content = sentence.substring(1, starIdx);
      const checksumStr = sentence.substring(starIdx + 1, starIdx + 3);
      const expectedChecksum = parseInt(checksumStr, 16);
      let calculated = 0;
      for (let i = 0; i < content.length; i++) {
        calculated ^= content.charCodeAt(i);
      }
      if (!isNaN(expectedChecksum) && calculated !== expectedChecksum) {
        return false; // Checksum mismatch
      }
    }

    const payload = starIdx !== -1 ? sentence.substring(1, starIdx) : sentence.substring(1);
    const tokens = payload.split(',');
    const talkerAndType = tokens[0];
    const sentenceType = talkerAndType.length >= 3 ? talkerAndType.slice(-3) : talkerAndType;

    let updated = false;

    if (sentenceType === 'GGA') {
      updated = this.parseGGA(tokens);
    } else if (sentenceType === 'RMC') {
      updated = this.parseRMC(tokens);
    } else if (sentenceType === 'GSA') {
      updated = this.parseGSA(tokens);
    }

    if (updated && this.currentState.latitude !== null && this.currentState.longitude !== null) {
      this.emitMeasurement();
    }

    return updated;
  }

  /**
   * Parse GGA: Global Positioning System Fix Data
   * $--GGA,hhmmss.ss,llll.ll,a,yyyyy.yy,a,x,xx,x.x,x.x,M,x.x,M,x.x,xxxx
   */
  private parseGGA(tokens: string[]): boolean {
    if (tokens.length < 10) return false;

    const latStr = tokens[2];
    const latHemi = tokens[3];
    const lonStr = tokens[4];
    const lonHemi = tokens[5];
    const quality = parseInt(tokens[6], 10);
    const numSats = parseInt(tokens[7], 10) || 0;
    const hdop = parseFloat(tokens[8]) || 1.0;
    const alt = parseFloat(tokens[9]) || 0.0;

    if (latStr && lonStr && quality > 0) {
      this.currentState.latitude = this.parseCoordinates(latStr, latHemi);
      this.currentState.longitude = this.parseCoordinates(lonStr, lonHemi);
      this.currentState.altitude = alt;
      this.currentState.horizontalAccuracy = Math.max(1.0, hdop * 3.0);
      this.currentState.verticalAccuracy = Math.max(2.0, hdop * 5.0);
      this.currentState.fixType = quality >= 2 ? FixType.Fix3D : FixType.Fix2D;
      this.hasFix = true;
      this.currentState.timestamp = Date.now();
      return true;
    } else if (quality === 0) {
      this.currentState.fixType = FixType.NoFix;
      this.hasFix = false;
      return true;
    }
    return false;
  }

  /**
   * Parse RMC: Recommended Minimum Specific GNSS Data
   * $--RMC,hhmmss.ss,A,llll.ll,a,yyyyy.yy,a,x.x,x.x,ddmmyy,,,a
   */
  private parseRMC(tokens: string[]): boolean {
    if (tokens.length < 9) return false;

    const status = tokens[2];
    const latStr = tokens[3];
    const latHemi = tokens[4];
    const lonStr = tokens[5];
    const lonHemi = tokens[6];
    const speedKnots = parseFloat(tokens[7]) || 0.0;
    const trackAngle = parseFloat(tokens[8]) || 0.0;

    if (status === 'A' && latStr && lonStr) {
      this.currentState.latitude = this.parseCoordinates(latStr, latHemi);
      this.currentState.longitude = this.parseCoordinates(lonStr, lonHemi);
      this.currentState.speed = speedKnots * 0.514444; // knots to m/s
      this.currentState.bearing = trackAngle;
      this.currentState.fixType = FixType.Fix3D;
      this.hasFix = true;
      this.currentState.timestamp = Date.now();
      return true;
    } else if (status === 'V') {
      this.currentState.fixType = FixType.NoFix;
      this.hasFix = false;
      return true;
    }
    return false;
  }

  /**
   * Parse GSA: GNSS DOP and Active Satellites
   */
  private parseGSA(tokens: string[]): boolean {
    if (tokens.length < 18) return false;
    const fixMode = parseInt(tokens[2], 10);
    if (fixMode === 1) {
      this.currentState.fixType = FixType.NoFix;
      this.hasFix = false;
    } else if (fixMode === 2) {
      this.currentState.fixType = FixType.Fix2D;
      this.hasFix = true;
    } else if (fixMode === 3) {
      this.currentState.fixType = FixType.Fix3D;
      this.hasFix = true;
    }
    return true;
  }

  /**
   * Converts NMEA latitude/longitude (DDMM.MMMM or DDDMM.MMMM) to decimal degrees.
   */
  public parseCoordinates(coordStr: string, hemi: string): number {
    const dotIdx = coordStr.indexOf('.');
    if (dotIdx < 2) return 0.0;

    const degreeDigits = dotIdx - 2;
    const degrees = parseFloat(coordStr.substring(0, degreeDigits));
    const minutes = parseFloat(coordStr.substring(degreeDigits));
    let decimal = degrees + minutes / 60.0;

    if (hemi === 'S' || hemi === 'W') {
      decimal = -decimal;
    }
    return decimal;
  }

  private emitMeasurement(): void {
    const s = this.currentState;
    if (s.latitude === null || s.longitude === null) return;

    this.lastUpdateTimestamp = s.timestamp;
    const measurement: GNSSMeasurement = {
      timestamp: s.timestamp,
      latitude: s.latitude,
      longitude: s.longitude,
      altitude: s.altitude,
      speed: s.speed,
      bearing: s.bearing,
      horizontalAccuracy: s.horizontalAccuracy,
      verticalAccuracy: s.verticalAccuracy,
      fixType: s.fixType,
      satellites: s.satellites,
      isSimulated: false,
    };

    this.lastMeasurement = measurement;
    this.updateStatus(this.hasFix, s.fixType);

    for (const cb of this.measurementCallbacks) {
      try {
        cb(measurement);
      } catch (err) {
        this.logger.error('Measurement callback error:', err);
      }
    }
  }

  public onMeasurement(callback: GNSSMeasurementCallback): void {
    this.measurementCallbacks.add(callback);
    if (this.lastMeasurement) {
      try {
        callback(this.lastMeasurement);
      } catch (e) {}
    }
  }

  public onStatusChange(callback: GNSSStatusCallback): void {
    this.statusCallbacks.add(callback);
    try {
      callback(this.getStatus());
    } catch (e) {}
  }

  public getStatus(): GNSSStatus {
    return {
      isActive: this.isRunning,
      hasfix: this.hasFix,
      fixType: this.currentState.fixType,
      isSimulated: false,
      lastUpdateTimestamp: this.lastUpdateTimestamp,
    };
  }

  private updateStatus(hasfix: boolean, fixType: FixType): void {
    this.hasFix = hasfix;
    const status = this.getStatus();
    for (const cb of this.statusCallbacks) {
      try {
        cb(status);
      } catch (e) {}
    }
  }
}
