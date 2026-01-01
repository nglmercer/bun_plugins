/**
 * Declarative Logger Example
 * 
 * This example demonstrates a clean, declarative approach to configuring
 * and using different logging adapters.
 */

import {
  logger,
  ConsoleLogger,
  NoopLogger,
  SimpleLoggerAdapter,
  ColorfulConsoleLogger
} from "../src";

// Logger configuration definitions
interface LoggerConfig {
  type: 'console' | 'colorful' | 'pino' | 'noop';
  context?: string;
  level?: string;
  format?: 'simple' | 'json' | 'colored';
  useColors?: boolean;
  timestampFormat?: 'none' | 'iso' | 'time';
  showEmoji?: boolean;
  levelColors?: Record<string, string>;
  contextColor?: string;
}

// Declarative logger factory
const createLogger = (config: LoggerConfig) => {
  switch (config.type) {
    case 'console':
      const consoleLogger = new ConsoleLogger({
        useColors: config.useColors ?? false,
        timestampFormat: config.timestampFormat ?? 'none'
      });
      if (config.context) {
        return new SimpleLoggerAdapter(consoleLogger, config.context);
      }
      return consoleLogger;
      
    case 'colorful':
      const colorfulLogger = new ColorfulConsoleLogger({
        useColors: config.useColors ?? true,
        timestampFormat: config.timestampFormat ?? 'none',
        levelColors: config.levelColors,
        contextColor: config.contextColor,
        showEmoji: config.showEmoji ?? true
      });
      if (config.context) {
        return colorfulLogger.child(config.context);
      }
      return colorfulLogger;
      
    case 'pino':
      // Simulated Pino logger for demonstration
      const pinoLogger: import("../src").Logger = {
        info: (msg: string, ...args: any[]) => {
          console.log(`[PINO] INFO: ${msg}`, ...args);
        },
        warn: (msg: string, ...args: any[]) => {
          console.log(`[PINO] WARN: ${msg}`, ...args);
        },
        error: (msg: string, ...args: any[]) => {
          console.log(`[PINO] ERROR: ${msg}`, ...args);
        },
        child: (context: string) => pinoLogger
      };
      return config.context ?
        new SimpleLoggerAdapter(pinoLogger, config.context) :
        pinoLogger;
      
    case 'noop':
      return new NoopLogger();
      
    default:
      throw new Error(`Unknown logger type: ${config.type}`);
  }
};

// Logger scenarios
const loggerScenarios = [
  {
    name: "Basic Console Logger",
    config: { type: 'console' as const, context: 'MyApp' },
    demo: (log: any) => {
      log.info("Application started");
      log.warn("Low memory warning");
      log.error("Connection failed");
    }
  },
  {
    name: "Colorful Console Logger",
    config: {
      type: 'colorful' as const,
      context: 'ColorfulApp',
      timestampFormat: 'time' as const,
      showEmoji: true
    },
    demo: (log: any) => {
      log.info("System initialized with colors");
      log.warn("Performance degradation detected");
      log.error("Critical system failure");
      log.debug("Debug information available");
    }
  },
  {
    name: "Custom Color Theme Logger",
    config: {
      type: 'colorful' as const,
      levelColors: {
        info: '#00FF00',    // Bright green
        warn: '#FFA500',    // Orange
        error: '#FF1493',   // Deep pink
        debug: '#00CED1'    // Dark turquoise
      },
      contextColor: '#FFD700', // Gold
      showEmoji: true
    },
    demo: (log: any) => {
      log.info("Custom themed info message");
      log.warn("Custom themed warning");
      log.error("Custom themed error");
    }
  },
  {
    name: "Pino-style Logger",
    config: { type: 'pino' as const },
    demo: (log: any) => {
      log.info({ userId: 123 }, "User logged in");
      log.warn({ memory: '85%' }, "High memory usage");
      log.error({ error: 'ECONNREFUSED' }, "Database connection failed");
    }
  },
  {
    name: "No-op Logger (disabled)",
    config: { type: 'noop' as const },
    demo: (log: any) => {
      log.info("This won't be shown");
      log.error("Neither will this");
      console.log("But this console.log will still appear");
    }
  }
];

// Plugin-specific logger configuration
const pluginLoggerConfigs = {
  'database-plugin': {
    type: 'colorful' as const,
    context: 'Database',
    timestampFormat: 'time' as const,
    showEmoji: true,
    levelColors: {
      info: '#4ECDC4',
      warn: '#FFA07A',
      error: '#FF6B6B'
    }
  },
  'api-plugin': {
    type: 'colorful' as const,
    context: 'API',
    showEmoji: true
  },
  'cache-plugin': { type: 'noop' as const }, // Disable cache logging
  'auth-plugin': {
    type: 'colorful' as const,
    context: 'Auth',
    contextColor: '#FF69B4',
    showEmoji: true
  }
};

// Declarative plugin logger setup
const setupPluginLoggers = () => {
  Object.entries(pluginLoggerConfigs).forEach(([pluginName, config]) => {
    const log = createLogger(config);
    logger.setPluginLogger(pluginName, log);
    console.log(`✅ Configured logger for ${pluginName}`);
  });
};

// Hierarchical logger demonstration
const demonstrateHierarchicalLoggers = () => {
  console.log("\n🏗️ Hierarchical Loggers:");
  
  // Parent logger
  const parentLogger = createLogger({ type: 'console', context: 'Parent' });
  logger.setDefaultLogger(parentLogger);
  
  parentLogger.info("Message from parent logger");
  
  // Child logger (using factory method)
  const childLogger = logger.createLogger('Child');
  childLogger.info("Message from child logger");
  
  // Grandchild logger
  const grandchildLogger = childLogger.child?.('Grandchild') || childLogger;
  grandchildLogger.info("Message from grandchild logger");
};

// Color palette demonstration
const demonstrateColorPalette = () => {
  console.log("\n🎨 Bun.color Palette Demo:");
  
  const colors = [
    { name: 'CSS Colors', colors: ['red', 'green', 'blue', 'yellow', 'magenta', 'cyan'] },
    { name: 'Hex Colors', colors: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8'] },
    { name: 'RGB/HSL', colors: ['rgb(255, 99, 71)', 'hsl(120, 50%, 50%)'] }
  ];
  
  colors.forEach(category => {
    console.log(`\n${category.name}:`);
    category.colors.forEach(color => {
      const ansiColor = Bun.color(color, 'ansi');
      if (ansiColor) {
        console.log(`${ansiColor}This text is ${color}${Bun.color('reset', 'ansi')}`);
      }
    });
  });
};

// Structured logging demonstration
const demonstrateStructuredLogging = () => {
  console.log("\n📊 Structured Logging:");
  
  const structuredLogger = createLogger({
    type: 'colorful' as const,
    context: 'Structured',
    timestampFormat: 'iso' as const,
    showEmoji: true
  });
  
  // Log with metadata
  structuredLogger.info("User completed purchase", {
    event: 'user_action',
    userId: 456,
    action: 'purchase',
    amount: 99.99,
    timestamp: new Date().toISOString()
  });
  
  // Log with error context
  structuredLogger.error("Input validation failed", {
    error: 'ValidationError',
    field: 'email',
    value: 'invalid-email',
    userId: 789
  });
};

// Performance logging demonstration
const demonstratePerformanceLogging = () => {
  console.log("\n⚡ Performance Logging:");
  
  const perfLogger = createLogger({
    type: 'colorful' as const,
    context: 'Performance',
    timestampFormat: 'time' as const,
    showEmoji: true,
    levelColors: {
      info: '#00FF7F',  // Spring green
      warn: '#FFD700',  // Gold
      error: '#FF4500'  // Orange red
    }
  });
  
  // Simulate some operations with timing
  const operations = [
    { name: 'database_query', duration: 150 },
    { name: 'api_call', duration: 300 },
    { name: 'file_processing', duration: 75 }
  ];
  
  operations.forEach(op => {
    perfLogger.info(`Operation ${op.name} completed`, {
      operation: op.name,
      duration: op.duration,
      status: op.duration < 200 ? 'fast' : 'slow',
      timestamp: new Date().toISOString()
    });
  });
};

// Advanced color configuration demonstration
const demonstrateAdvancedColors = () => {
  console.log("\n🔬 Advanced Color Configuration:");
  
  // Create loggers with different color schemes
  const neonLogger = createLogger({
    type: 'colorful' as const,
    context: 'Neon',
    levelColors: {
      info: '#00FFFF',    // Cyan
      warn: '#FF00FF',    // Magenta
      error: '#FFFF00',   // Yellow
      debug: '#00FF00'    // Lime
    },
    contextColor: '#FF1493', // Deep pink
    showEmoji: true
  });
  
  const pastelLogger = createLogger({
    type: 'colorful' as const,
    context: 'Pastel',
    levelColors: {
      info: '#B19CD9',    // Light purple
      warn: '#FFB6C1',    // Light pink
      error: '#FFA07A',   // Light salmon
      debug: '#87CEEB'    // Sky blue
    },
    contextColor: '#DDA0DD', // Plum
    showEmoji: false
  });
  
  const darkThemeLogger = createLogger({
    type: 'colorful' as const,
    context: 'DarkTheme',
    levelColors: {
      info: '#00FF00',    // Green
      warn: '#FFA500',    // Orange
      error: '#FF0000',   // Red
      debug: '#808080'    // Gray
    },
    contextColor: '#FFFFFF', // White
    showEmoji: true
  });
  
  // Test each themed logger
  const loggers = [
    { name: 'Neon Theme', logger: neonLogger },
    { name: 'Pastel Theme', logger: pastelLogger },
    { name: 'Dark Theme', logger: darkThemeLogger }
  ];
  
  loggers.forEach(({ name, logger: log }) => {
    console.log(`\n${name}:`);
    log.info("Information message");
    log.warn("Warning message");
    log.error("Error message");
    log.debug?.("Debug message");
  });
};

// Main demonstration
const demonstrateDeclarativeLogging = async () => {
  console.log("🚀 Enhanced Declarative Logger Demo\n");
  
  // Scenario 1: Different logger types
  console.log("=== Logger Types ===");
  for (const scenario of loggerScenarios) {
    console.log(`\n${scenario.name}:`);
    const log = createLogger(scenario.config);
    scenario.demo(log);
  }
  
  // Scenario 2: Plugin-specific loggers
  console.log("\n=== Plugin-specific Loggers ===");
  setupPluginLoggers();
  
  // Test plugin loggers
  const plugins = ['database-plugin', 'api-plugin', 'cache-plugin', 'auth-plugin'];
  plugins.forEach(pluginName => {
    const log = logger.getLogger(pluginName);
    log.info(`Test message from ${pluginName}`);
  });
  
  // Scenario 3: Hierarchical loggers
  demonstrateHierarchicalLoggers();
  
  // Scenario 4: Color palette
  demonstrateColorPalette();
  
  // Scenario 5: Structured logging
  demonstrateStructuredLogging();
  
  // Scenario 6: Performance logging
  demonstratePerformanceLogging();
  
  // Scenario 7: Advanced colors
  demonstrateAdvancedColors();
  
  console.log("\n✅ Enhanced declarative logger demo completed!");
};

// Export for use
export {
  createLogger,
  loggerScenarios,
  pluginLoggerConfigs,
  demonstrateDeclarativeLogging
};

// Run if called directly
if (import.meta.main) {
  demonstrateDeclarativeLogging().catch(console.error);
}