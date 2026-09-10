/**
 * Noise Model
 *
 * Gaussian noise generator for GNSS position simulation.
 * Uses Box-Muller transform to produce normally distributed random values.
 */

/**
 * Generate a Gaussian (normally distributed) random number.
 * Uses the Box-Muller transform.
 *
 * @param mean - Mean of the distribution
 * @param sigma - Standard deviation
 * @returns A random sample from N(mean, sigma²)
 */
export function gaussianRandom(mean: number = 0, sigma: number = 1): number {
  let u1 = Math.random();
  let u2 = Math.random();

  // Avoid log(0)
  while (u1 === 0) u1 = Math.random();

  const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return mean + z * sigma;
}

/**
 * Add Gaussian noise to a position (latitude/longitude).
 * Converts meter-scale noise to degree offsets.
 *
 * @param lat - Base latitude in degrees
 * @param lon - Base longitude in degrees
 * @param sigmaMeter - Position noise in meters (1σ)
 * @returns Noisy [latitude, longitude]
 */
export function addPositionNoise(
  lat: number,
  lon: number,
  sigmaMeter: number,
): [number, number] {
  // 1 degree latitude ≈ 111,320 meters
  // 1 degree longitude ≈ 111,320 * cos(lat) meters
  const metersToDegLat = 1 / 111320;
  const metersToDegLon = 1 / (111320 * Math.cos((lat * Math.PI) / 180));

  const noiseLat = gaussianRandom(0, sigmaMeter) * metersToDegLat;
  const noiseLon = gaussianRandom(0, sigmaMeter) * metersToDegLon;

  return [lat + noiseLat, lon + noiseLon];
}

/**
 * Add noise to altitude.
 * Vertical noise is typically ~2× horizontal noise.
 */
export function addAltitudeNoise(
  altitude: number,
  sigmaMeter: number,
): number {
  return altitude + gaussianRandom(0, sigmaMeter * 2);
}

/**
 * Add noise to speed.
 */
export function addSpeedNoise(speed: number, sigmaMps: number): number {
  return Math.max(0, speed + gaussianRandom(0, sigmaMps));
}

/**
 * Add noise to bearing.
 */
export function addBearingNoise(bearing: number, sigmaDeg: number): number {
  const noisy = bearing + gaussianRandom(0, sigmaDeg);
  return ((noisy % 360) + 360) % 360;
}

/**
 * Simulate occasional multipath jump (random large position error).
 * Returns the jump magnitude in meters, or 0 if no jump.
 *
 * @param probability - Probability of jump per call (e.g., 0.02 = 2%)
 * @param maxJumpMeters - Maximum jump distance
 */
export function multipathJump(
  probability: number = 0.02,
  maxJumpMeters: number = 15,
): number {
  if (Math.random() < probability) {
    return gaussianRandom(0, maxJumpMeters / 2);
  }
  return 0;
}

/**
 * Compute horizontal accuracy estimate from noise sigma and satellite geometry.
 * This is a simplified model: accuracy ≈ sigma × HDOP
 *
 * @param sigmaMeter - Base noise sigma in meters
 * @param satellitesUsed - Number of satellites used in fix
 * @returns Estimated horizontal accuracy in meters
 */
export function estimateAccuracy(
  sigmaMeter: number,
  satellitesUsed: number,
): number {
  // Simplified HDOP model: decreases with more satellites
  // Typical HDOP ranges: 1.0 (excellent) to 5.0 (poor)
  const hdop = Math.max(1.0, 6.0 - satellitesUsed * 0.4);
  const accuracy = sigmaMeter * hdop + Math.abs(gaussianRandom(0, 0.5));
  return Math.round(accuracy * 10) / 10; // Round to 1 decimal
}
