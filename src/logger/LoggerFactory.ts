import { Logger } from "../types";
import { SimpleLoggerAdapter, ConsoleLogger, NoopLogger, ColorfulConsoleLogger } from "./LoggerAdapter";

/**
 * Simple logger factory for creating and managing logger instances
 */
export class LoggerFactory {
  private static instance: LoggerFactory;
  private defaultLogger: Logger;
  private pluginLoggers: Map<string, Logger> = new Map();

  private constructor() {
    this.defaultLogger = new ColorfulConsoleLogger();
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
   * Set the default logger (can be any custom logger)
   */
  setDefaultLogger(logger: Logger): void {
    this.defaultLogger = logger;
  }

  /**
   * Get the default logger
   */
  getDefaultLogger(): Logger {
    return this.defaultLogger;
  }

  /**
   * Create a logger for a specific plugin with context
   */
  createLogger(pluginName: string): Logger {
    const logger = this.defaultLogger.child ? 
      this.defaultLogger.child(pluginName) : 
      new SimpleLoggerAdapter(this.defaultLogger, pluginName);
    
    this.pluginLoggers.set(pluginName, logger);
    return logger;
  }

  /**
   * Get a logger for a specific plugin
   */
  getLogger(pluginName: string): Logger {
    if (!this.pluginLoggers.has(pluginName)) {
      return this.createLogger(pluginName);
    }
    return this.pluginLoggers.get(pluginName)!;
  }

  /**
   * Set a custom logger for a specific plugin
   */
  setPluginLogger(pluginName: string, logger: Logger): void {
    this.pluginLoggers.set(pluginName, logger);
  }

  /**
   * Remove a plugin logger
   */
  removeLogger(pluginName: string): void {
    this.pluginLoggers.delete(pluginName);
  }

  /**
   * Clear all plugin loggers
   */
  clearPluginLoggers(): void {
    this.pluginLoggers.clear();
  }

  /**
   * Create a console logger
   */
  createConsoleLogger(options?: {
    useColors?: boolean;
    timestampFormat?: 'none' | 'iso' | 'time';
  }): ConsoleLogger {
    return new ConsoleLogger(options);
  }

  /**
   * Create a colorful console logger with enhanced formatting
   */
  createColorfulConsoleLogger(options?: {
    useColors?: boolean;
    timestampFormat?: 'none' | 'iso' | 'time';
    levelColors?: Record<string, string>;
    contextColor?: string;
    showEmoji?: boolean;
  }): ColorfulConsoleLogger {
    return new ColorfulConsoleLogger(options);
  }

  /**
   * Create a no-op logger
   */
  createNoopLogger(): NoopLogger {
    return new NoopLogger();
  }

  /**
   * Wrap any custom logger with our adapter
   */
  wrapLogger(logger: Logger, context?: string): SimpleLoggerAdapter {
    return new SimpleLoggerAdapter(logger, context);
  }
}

/**
 * Global logger instance for convenience
 */
export const logger = LoggerFactory.getInstance();