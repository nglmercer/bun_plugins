import { Logger } from "../types";

/**
 * Simple logger adapter that wraps any logger implementation
 */
export class SimpleLoggerAdapter implements Logger {
  private logger: Logger;
  private context?: string;

  constructor(logger: Logger, context?: string) {
    this.logger = logger;
    this.context = context;
  }

  info(msg: string, ...args: any[]): void {
    const formattedMsg = this.formatMessage(msg);
    this.logger.info(formattedMsg, ...args);
  }

  warn(msg: string, ...args: any[]): void {
    const formattedMsg = this.formatMessage(msg);
    this.logger.warn(formattedMsg, ...args);
  }

  error(msg: string, ...args: any[]): void {
    const formattedMsg = this.formatMessage(msg);
    this.logger.error(formattedMsg, ...args);
  }

  debug(msg: string, ...args: any[]): void {
    if (this.logger.debug) {
      const formattedMsg = this.formatMessage(msg);
      this.logger.debug(formattedMsg, ...args);
    }
  }

  child(context: string): Logger {
    const newContext = this.context ? `${this.context}.${context}` : context;
    return new SimpleLoggerAdapter(this.logger, newContext);
  }

  private formatMessage(msg: string): string {
    return this.context ? `[${this.context}] ${msg}` : msg;
  }
}

/**
 * Console logger implementation
 */
export class ConsoleLogger implements Logger {
  info(msg: string, ...args: any[]): void {
    console.log(`[INFO] ${msg}`, ...args);
  }

  warn(msg: string, ...args: any[]): void {
    console.warn(`[WARN] ${msg}`, ...args);
  }

  error(msg: string, ...args: any[]): void {
    console.error(`[ERROR] ${msg}`, ...args);
  }

  debug(msg: string, ...args: any[]): void {
    console.debug(`[DEBUG] ${msg}`, ...args);
  }

  child(context: string): Logger {
    return new ConsoleLogger();
  }
}

/**
 * No-op logger implementation
 */
export class NoopLogger implements Logger {
  info(_msg: string, ..._args: any[]): void {
    // No operation
  }

  warn(_msg: string, ..._args: any[]): void {
    // No operation
  }

  error(_msg: string, ..._args: any[]): void {
    // No operation
  }

  debug(_msg: string, ..._args: any[]): void {
    // No operation
  }

  child(_context: string): Logger {
    return new NoopLogger();
  }
}
