/**
 * NavIC Navigation — Web Application Entry Point
 *
 * This is the main entry point for the web application.
 * The full UI will be built in Phase 1.
 */

import { Logger, LogLevel, DEFAULT_CONFIG } from '@navic/shared-models';

const logger = new Logger('App', {
  level: LogLevel.DEBUG,
  isSimulation: DEFAULT_CONFIG.simulation.enabled,
});

logger.info(`${DEFAULT_CONFIG.appName} v${DEFAULT_CONFIG.version} initialized`);
logger.info('Phase 0 — Architecture complete. Awaiting Phase 1 implementation.');

if (DEFAULT_CONFIG.simulation.enabled) {
  logger.warn('Running in SIMULATION MODE — no real GNSS/IMU data');
}
