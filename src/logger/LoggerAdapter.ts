     import { Logger } from "../types";

// Color utilities for console logging
const colors = {
  info: (text: string) => `\x1b[36m${text}\x1b[0m`, // Cyan
  warn: (text: string) => `\x1b[33m${text}\x1b[0m`, // Yellow
  error: (text: string) => `\x1b[31m${text}\x1b[0m`, // Red
  context: (text: string) => `\x1b[90m${text}\x1b[0m`, // Gray
  level: (text: string) => `\x1b[1m${text}\x1b[0m`, // Bold
};

// Enhanced color support using Bun.color if available
if (typeof Bun !== 'undefined' && Bun.color) {
  try {
    // Test if Bun.color is working correctly
    const testColor = Bun.color("cyan", "ansi");
    const resetColor = Bun.color("reset", "ansi");
    
    // Only use Bun.color if it returns valid ANSI codes (not the string "null")
    if (testColor && testColor !== "null" && resetColor && resetColor !== "null" && 
        testColor.includes('\x1b') && resetColor.includes('\x1b')) {
      
      // Helper to safely apply Bun colors
      const safeColor = (colorName: string) => {
        const colorCode = Bun.color(colorName, "ansi");
        const resetCode = Bun.color("reset", "ansi");
        
        // Validate that both color and reset are valid
        if (colorCode && colorCode !== "null" && resetCode && resetCode !== "null" &&
            colorCode.includes('\x1b') && resetCode.includes('\x1b')) {
          return (text: string) => colorCode + text + resetCode;
        }
        
        // Fallback to original ANSI codes if Bun.color fails
        return colors[colorName === 'bold' ? 'level' : 
                    colorName === 'gray' ? 'context' : 
                    colorName === 'cyan' ? 'info' : 
                    colorName === 'yellow' ? 'warn' : 
                    colorName === 'red' ? 'error' : 'info'];
      };
      
      colors.info = safeColor("cyan");
      colors.warn = safeColor("yellow");
      colors.error = safeColor("red");
      colors.context = safeColor("gray");
      colors.level = safeColor("bold");
    } else {
      // Bun.color is not working properly, use ANSI codes
      if (process.env.DEBUG_LOGGER) console.log('Debug - Bun.color not working, using ANSI codes');
    }
  } catch {
    // Fallback to ANSI codes if Bun.color fails
  }
}

// Fallback for environments without color support
if (typeof Bun === 'undefined' || !Bun.color) {
  const originalColors = { ...colors };
  colors.info = (text: string) => text || '';
  colors.warn = (text: string) => text || '';
  colors.error = (text: string) => text || '';
  colors.context = (text: string) => text || '';
  colors.level = (text: string) => text || '';
}

/**
 * Logger adapter interface that extends the basic Logger interface
 * with additional functionality for adapter pattern
 */
export interface LoggerAdapter extends Logger {
  /**
   * Set the plugin name for contextual logging
   */
  setContext(context: string): void;
  
  /**
   * Get the current context
   */
  getContext(): string;
  
  /**
   * Create a child logger with additional context
   */
  child(context: string): LoggerAdapter;
}

/**
 * Abstract base class for logger adapters
 */
export abstract class BaseLoggerAdapter implements LoggerAdapter {
  protected context: string = "";
  
  abstract info(msg: string, ...args: any[]): void;
  abstract warn(msg: string, ...args: any[]): void;
  abstract error(msg: string, ...args: any[]): void;
  
  setContext(context: string): void {
    this.context = context;
  }
  
  getContext(): string {
    return this.context;
  }
  
  child(context: string): LoggerAdapter {
    const childLogger = this.createChild(context);
    childLogger.setContext(context);
    return childLogger;
  }
  
  protected abstract createChild(context: string): LoggerAdapter;
  
  protected formatMessage(level: string, msg: string): string {
    if (this.context) {
      return `[${this.context}] ${level}: ${msg}`;
    }
    return `${level}: ${msg}`;
  }
}

/**
 * Console logger adapter - default implementation with colors
 */
export class ConsoleLoggerAdapter extends BaseLoggerAdapter {
  info(msg: string, ...args: any[]): void {
    const filteredArgs = args.filter(arg => arg !== null && arg !== undefined);
    console.log(this.formatColoredMessage("INFO", msg), ...filteredArgs);
  }
  
  warn(msg: string, ...args: any[]): void {
    const filteredArgs = args.filter(arg => arg !== null && arg !== undefined);
    console.warn(this.formatColoredMessage("WARN", msg), ...filteredArgs);
  }
  
  error(msg: string, ...args: any[]): void {
    const filteredArgs = args.filter(arg => arg !== null && arg !== undefined);
    console.error(this.formatColoredMessage("ERROR", msg), ...filteredArgs);
  }
  
  protected createChild(context: string): LoggerAdapter {
    const child = new ConsoleLoggerAdapter();
    child.setContext(context);
    return child;
  }
  
  private formatColoredMessage(level: string, msg: string): string {
    try {
      let formattedLevel: string;
      let context: string;
      let coloredMsg: string;
      
      try {
        formattedLevel = colors.level(`[${level}]`);
        // Filter out null/undefined results from color functions
        if (!formattedLevel || formattedLevel === 'null' || formattedLevel === 'undefined') {
          formattedLevel = `[${level}]`;
        }
      } catch {
        formattedLevel = `[${level}]`;
      }
      
      try {
        context = this.context ? colors.context(`[${this.context}]`) : '';
        // Filter out null/undefined results from color functions
        if (context === 'null' || context === 'undefined') {
          context = this.context ? `[${this.context}]` : '';
        }
      } catch {
        context = this.context ? `[${this.context}]` : '';
      }
      
      try {
        coloredMsg = level === 'INFO' ? colors.info(msg) :
                     level === 'WARN' ? colors.warn(msg) :
                     level === 'ERROR' ? colors.error(msg) : msg;
        // Filter out null/undefined results from color functions
        if (!coloredMsg || coloredMsg === 'null' || coloredMsg === 'undefined') {
          coloredMsg = msg;
        }
      } catch {
        coloredMsg = msg;
      }
      
      if (this.context) {
        return `${context} ${formattedLevel} ${coloredMsg}`;
      }
      return `${formattedLevel} ${coloredMsg}`;
    } catch (error) {
      // Fallback to simple formatting if color functions fail
      if (this.context) {
        return `[${this.context}] [${level}]: ${msg}`;
      }
      return `[${level}]: ${msg}`;
    }
  }
}

/**
 * Pino-style logger adapter interface
 */
export interface PinoLogger {
  info: (obj: any, msg?: string, ...args: any[]) => void;
  warn: (obj: any, msg?: string, ...args: any[]) => void;
  error: (obj: any, msg?: string, ...args: any[]) => void;
  child: (bindings: any) => PinoLogger;
}

/**
 * Pino logger adapter
 */
export class PinoLoggerAdapter extends BaseLoggerAdapter {
  private logger: PinoLogger;
  
  constructor(logger: PinoLogger) {
    super();
    this.logger = logger;
  }
  
  info(msg: string, ...args: any[]): void {
    if (this.context) {
      this.logger.info({ context: this.context }, msg, ...args);
    } else {
      this.logger.info({}, msg, ...args);
    }
  }
  
  warn(msg: string, ...args: any[]): void {
    if (this.context) {
      this.logger.warn({ context: this.context }, msg, ...args);
    } else {
      this.logger.warn({}, msg, ...args);
    }
  }
  
  error(msg: string, ...args: any[]): void {
    if (this.context) {
      this.logger.error({ context: this.context }, msg, ...args);
    } else {
      this.logger.error({}, msg, ...args);
    }
  }
  
  protected createChild(context: string): LoggerAdapter {
    const childLogger = this.logger.child({ context });
    const adapter = new PinoLoggerAdapter(childLogger);
    adapter.setContext(context);
    return adapter;
  }
}

/**
 * No-op logger adapter for disabling logs
 */
export class NoopLoggerAdapter extends BaseLoggerAdapter {
  info(_msg: string, ..._args: any[]): void {
    // No-op
  }
  
  warn(_msg: string, ..._args: any[]): void {
    // No-op
  }
  
  error(_msg: string, ..._args: any[]): void {
    // No-op
  }
  
  protected createChild(_context: string): LoggerAdapter {
    return new NoopLoggerAdapter();
  }
}
