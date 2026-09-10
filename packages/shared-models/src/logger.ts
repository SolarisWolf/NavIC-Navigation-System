/**
 * @navic/shared-models — Logger
 *
 * A lightweight, zero-dependency logging system with module tagging,
 * timestamps, and simulation mode indicators.
 *
 * Usage:
 *   const logger = new Logger('GNSS');
 *   logger.info('Position fix acquired');
 *   // Output: [2024-01-01T12:00:00.000Z] [INFO] [GNSS] Position fix acquired
 *
 *   const simLogger = new Logger('GNSS', { isSimulation: true });
 *   simLogger.info('Position fix acquired');
 *   // Output: [2024-01-01T12:00:00.000Z] [INFO] [SIM] [GNSS] Position fix acquired
 */

import { LogLevel } from './config.types.js';

/**
 * Logger configuration options.
 */
export interface LoggerOptions {
  /** Minimum log level to output */
  level?: LogLevel;

  /** Whether to prefix messages with [SIM] */
  isSimulation?: boolean;

  /** Custom output function (defaults to console) */
  output?: LogOutput;
}

/**
 * Output interface for the logger. Allows redirecting log output
 * for testing or custom log aggregation.
 */
export interface LogOutput {
  debug(message: string): void;
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

/** Default console-based output */
const CONSOLE_OUTPUT: LogOutput = {
  debug: (msg) => console.debug(msg),
  info: (msg) => console.info(msg),
  warn: (msg) => console.warn(msg),
  error: (msg) => console.error(msg),
};

/** String labels for each log level */
const LEVEL_LABELS: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: 'DEBUG',
  [LogLevel.INFO]: 'INFO',
  [LogLevel.WARN]: 'WARN',
  [LogLevel.ERROR]: 'ERROR',
  [LogLevel.SILENT]: 'SILENT',
};

/**
 * Module-tagged logger with simulation awareness.
 */
export class Logger {
  private readonly module: string;
  private level: LogLevel;
  private isSimulation: boolean;
  private output: LogOutput;

  constructor(module: string, options: LoggerOptions = {}) {
    this.module = module;
    this.level = options.level ?? LogLevel.INFO;
    this.isSimulation = options.isSimulation ?? false;
    this.output = options.output ?? CONSOLE_OUTPUT;
  }

  /**
   * Update the log level at runtime.
   */
  setLevel(level: LogLevel): void {
    this.level = level;
  }

  /**
   * Update simulation mode at runtime.
   */
  setSimulation(isSimulation: boolean): void {
    this.isSimulation = isSimulation;
  }

  /**
   * Create a child logger with the same settings but a different module tag.
   */
  child(module: string): Logger {
    return new Logger(module, {
      level: this.level,
      isSimulation: this.isSimulation,
      output: this.output,
    });
  }

  debug(message: string, ...args: unknown[]): void {
    this.log(LogLevel.DEBUG, message, args);
  }

  info(message: string, ...args: unknown[]): void {
    this.log(LogLevel.INFO, message, args);
  }

  warn(message: string, ...args: unknown[]): void {
    this.log(LogLevel.WARN, message, args);
  }

  error(message: string, ...args: unknown[]): void {
    this.log(LogLevel.ERROR, message, args);
  }

  private log(level: LogLevel, message: string, args: unknown[]): void {
    if (level < this.level) return;

    const timestamp = new Date().toISOString();
    const levelLabel = LEVEL_LABELS[level];
    const simTag = this.isSimulation ? ' [SIM]' : '';
    const argsStr = args.length > 0 ? ' ' + args.map(a => JSON.stringify(a)).join(' ') : '';
    const formatted = `[${timestamp}] [${levelLabel}]${simTag} [${this.module}] ${message}${argsStr}`;

    switch (level) {
      case LogLevel.DEBUG:
        this.output.debug(formatted);
        break;
      case LogLevel.INFO:
        this.output.info(formatted);
        break;
      case LogLevel.WARN:
        this.output.warn(formatted);
        break;
      case LogLevel.ERROR:
        this.output.error(formatted);
        break;
    }
  }
}
