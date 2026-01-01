import { Logger } from "../types";

/**
 * Simple logger adapter that wraps any logger implementation
 */
export class SimpleLoggerAdapter implements Logger {
  constructor(private logger: Logger, private context?: string) {}

  info(msg: string, ...args: any[]): void {
    this.logger.info(this.formatMessage(msg), ...args);
  }

  warn(msg: string, ...args: any[]): void {
    this.logger.warn(this.formatMessage(msg), ...args);
  }

  error(msg: string, ...args: any[]): void {
    this.logger.error(this.formatMessage(msg), ...args);
  }

  debug(msg: string, ...args: any[]): void {
    if (this.logger.debug) {
      this.logger.debug(this.formatMessage(msg), ...args);
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
 * Base console logger with color support
 */
abstract class BaseConsoleLogger implements Logger {
  protected useColors: boolean;
  protected timestampFormat: 'none' | 'iso' | 'time';

  constructor(options: { useColors?: boolean; timestampFormat?: 'none' | 'iso' | 'time' } = {}) {
    this.useColors = options.useColors ?? true;
    this.timestampFormat = options.timestampFormat ?? 'none';
  }

  protected formatTimestamp(): string {
    switch (this.timestampFormat) {
      case 'iso': return new Date().toISOString();
      case 'time': return new Date().toLocaleTimeString();
      default: return '';
    }
  }

  protected colorize(text: string, color: string): string {
    if (!this.useColors) return text;
    
    // ANSI color codes map
    const colorCodes: Record<string, string> = {
      'black': '\x1b[30m',
      'red': '\x1b[31m',
      'green': '\x1b[32m',
      'yellow': '\x1b[33m',
      'blue': '\x1b[34m',
      'magenta': '\x1b[35m',
      'cyan': '\x1b[36m',
      'white': '\x1b[37m',
      'gray': '\x1b[90m',
      'bright-red': '\x1b[91m',
      'bright-green': '\x1b[92m',
      'bright-yellow': '\x1b[93m',
      'bright-blue': '\x1b[94m',
      'bright-magenta': '\x1b[95m',
      'bright-cyan': '\x1b[96m',
      'bright-white': '\x1b[97m'
    };
    
    // Try to match common color names or hex colors
    let colorCode = colorCodes[color.toLowerCase()];
    
    // If not found, try Bun.color as fallback
    if (!colorCode) {
      try {
        const bunColor = Bun.color(color, 'ansi');
        if (bunColor && typeof bunColor === 'string') {
          colorCode = bunColor;
        }
      } catch {}
    }
    
    // If still no color, return plain text
    if (!colorCode) return text;
    
    const reset = '\x1b[0m';
    return `${colorCode}${text}${reset}`;
  }

  protected logToConsole(method: 'log' | 'warn' | 'error' | 'debug', msg: string, ...args: any[]): void {
    if (args.length > 0) {
      console[method](msg, ...args);
    } else {
      console[method](msg);
    }
  }

  abstract info(msg: string, ...args: any[]): void;
  abstract warn(msg: string, ...args: any[]): void;
  abstract error(msg: string, ...args: any[]): void;
  abstract debug(msg: string, ...args: any[]): void;
}

/**
 * Simple console logger
 */
export class ConsoleLogger extends BaseConsoleLogger {
  info(msg: string, ...args: any[]): void {
    const timestamp = this.formatTimestamp();
    const timestampStr = timestamp ? `[${timestamp}] ` : '';
    const levelStr = this.colorize('[INFO]', 'cyan');
    this.logToConsole('log', `${timestampStr}${levelStr} ${msg}`, ...args);
  }

  warn(msg: string, ...args: any[]): void {
    const timestamp = this.formatTimestamp();
    const timestampStr = timestamp ? `[${timestamp}] ` : '';
    const levelStr = this.colorize('[WARN]', 'yellow');
    this.logToConsole('warn', `${timestampStr}${levelStr} ${msg}`, ...args);
  }

  error(msg: string, ...args: any[]): void {
    const timestamp = this.formatTimestamp();
    const timestampStr = timestamp ? `[${timestamp}] ` : '';
    const levelStr = this.colorize('[ERROR]', 'red');
    this.logToConsole('error', `${timestampStr}${levelStr} ${msg}`, ...args);
  }

  debug(msg: string, ...args: any[]): void {
    const timestamp = this.formatTimestamp();
    const timestampStr = timestamp ? `[${timestamp}] ` : '';
    const levelStr = this.colorize('[DEBUG]', 'gray');
    this.logToConsole('debug', `${timestampStr}${levelStr} ${msg}`, ...args);
  }

  child(): Logger {
    return new ConsoleLogger({ useColors: this.useColors, timestampFormat: this.timestampFormat });
  }
}

/**
 * Advanced colorful console logger with emojis
 */
export class ColorfulConsoleLogger extends BaseConsoleLogger {
  private contextColor: string = 'magenta';
  private showEmoji: boolean = true;
  private levelColors: Record<string, string> = {
    info: 'cyan',
    warn: 'yellow',
    error: 'red',
    debug: 'gray'
  };

  constructor(options: {
    useColors?: boolean;
    timestampFormat?: 'none' | 'iso' | 'time';
    contextColor?: string;
    showEmoji?: boolean;
    levelColors?: Record<string, string>;
  } = {}) {
    super(options);
    if (options.contextColor) this.contextColor = options.contextColor;
    if (options.showEmoji !== undefined) this.showEmoji = options.showEmoji;
    if (options.levelColors) this.levelColors = { ...this.levelColors, ...options.levelColors };
  }

  private getEmoji(level: string): string {
    if (!this.showEmoji) return '';
    const emojis: Record<string, string> = { info: 'ℹ️', warn: '⚠️', error: '❌', debug: '🐛' };
    return emojis[level] || '';
  }

  private formatMessage(level: string, msg: string, context?: string): string {
    const timestamp = this.formatTimestamp();
    const timestampStr = timestamp ? `[${timestamp}] ` : '';
    const emoji = this.getEmoji(level);
    const levelColor = this.levelColors[level] || '#FFFFFF';
    const levelStr = this.colorize(`[${level.toUpperCase()}]`, levelColor);
    const emojiStr = emoji ? `${emoji} ` : '';
    const contextStr = context ? `${this.colorize(`[${context}]`, this.contextColor)} ` : '';
    return `${timestampStr}${emojiStr}${levelStr} ${contextStr}${msg}`;
  }

  info(msg: string, ...args: any[]): void {
    this.logToConsole('log', this.formatMessage('info', msg), ...args);
  }

  warn(msg: string, ...args: any[]): void {
    this.logToConsole('warn', this.formatMessage('warn', msg), ...args);
  }

  error(msg: string, ...args: any[]): void {
    this.logToConsole('error', this.formatMessage('error', msg), ...args);
  }

  debug(msg: string, ...args: any[]): void {
    this.logToConsole('debug', this.formatMessage('debug', msg), ...args);
  }

  child(context: string): Logger {
    return new ChildLogger(this, context);
  }
}

/**
 * Child logger with context
 */
class ChildLogger implements Logger {
  constructor(private parent: ColorfulConsoleLogger, private context: string) {}

  info(msg: string, ...args: any[]): void {
    const formattedMsg = (this.parent as any).formatMessage('info', msg, this.context);
    if (args.length > 0) {
      console.log(formattedMsg, ...args);
    } else {
      console.log(formattedMsg);
    }
  }

  warn(msg: string, ...args: any[]): void {
    const formattedMsg = (this.parent as any).formatMessage('warn', msg, this.context);
    if (args.length > 0) {
      console.warn(formattedMsg, ...args);
    } else {
      console.warn(formattedMsg);
    }
  }

  error(msg: string, ...args: any[]): void {
    const formattedMsg = (this.parent as any).formatMessage('error', msg, this.context);
    if (args.length > 0) {
      console.error(formattedMsg, ...args);
    } else {
      console.error(formattedMsg);
    }
  }

  debug(msg: string, ...args: any[]): void {
    const formattedMsg = (this.parent as any).formatMessage('debug', msg, this.context);
    if (args.length > 0) {
      console.debug(formattedMsg, ...args);
    } else {
      console.debug(formattedMsg);
    }
  }

  child(context: string): Logger {
    return new ChildLogger(this.parent, `${this.context}.${context}`);
  }
}

/**
 * No-op logger implementation
 */
export class NoopLogger implements Logger {
  info(_msg: string, ..._args: any[]): void {}
  warn(_msg: string, ..._args: any[]): void {}
  error(_msg: string, ..._args: any[]): void {}
  debug(_msg: string, ..._args: any[]): void {}
  child(): Logger { return new NoopLogger(); }
}
