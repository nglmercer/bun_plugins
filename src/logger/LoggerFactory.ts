import { LoggerAdapter } from "./LoggerAdapter";
import { ConsoleLoggerAdapter, PinoLoggerAdapter, NoopLoggerAdapter } from "./LoggerAdapter";
import { PinoLogger } from "./LoggerAdapter";

/**
 * Logger factory for creating and managing logger instances
 */
export class LoggerFactory {
  private static instance: LoggerFactory;
  private defaultLogger: LoggerAdapter;
  private loggers: Map<string, LoggerAdapter> = new Map();

  private constructor() {
    this.defaultLogger = new ConsoleLoggerAdapter();
  }

  /**
   * Get the singleton instance of the logger factory
   */
  static getInstance(): LoggerFactory {
    if (!LoggerFactory.instance) {
      LoggerFactory.instance = new LoggerFactory();
    }
    return LoggerFactory.instance;
  }

  /**
   * Set the default logger adapter
   */
  setDefaultLogger(logger: LoggerAdapter): void {
    this.defaultLogger = logger;
  }

  /**
   * Get the default logger adapter
   */
  getDefaultLogger(): LoggerAdapter {
    return this.defaultLogger;
  }

  /**
   * Create a logger for a specific plugin
   */
  createLogger(pluginName: string): LoggerAdapter {
    const logger = this.defaultLogger.child(pluginName);
    this.loggers.set(pluginName, logger);
    return logger;
  }

  /**
   * Get a logger for a specific plugin
   */
  getLogger(pluginName: string): LoggerAdapter {
    if (!this.loggers.has(pluginName)) {
      return this.createLogger(pluginName);
    }
    return this.loggers.get(pluginName)!;
  }

  /**
   * Remove a logger for a specific plugin
   */
  removeLogger(pluginName: string): void {
    this.loggers.delete(pluginName);
  }

  /**
   * Create a console logger adapter
   */
  createConsoleLogger(): ConsoleLoggerAdapter {
    return new ConsoleLoggerAdapter();
  }

  /**
   * Create a pino logger adapter
   */
  createPinoLogger(pinoLogger: PinoLogger): PinoLoggerAdapter {
    return new PinoLoggerAdapter(pinoLogger);
  }

  /**
   * Create a no-op logger adapter
   */
  createNoopLogger(): NoopLoggerAdapter {
    return new NoopLoggerAdapter();
  }

  /**
   * Set a custom logger for a specific plugin
   */
  setPluginLogger(pluginName: string, logger: LoggerAdapter): void {
    this.loggers.set(pluginName, logger);
  }

  /**
   * Clear all plugin-specific loggers
   */
  clearPluginLoggers(): void {
    this.loggers.clear();
  }
}

/**
 * Global logger instance for convenience
 */
export const logger = LoggerFactory.getInstance();