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
  SimpleLoggerAdapter
} from "../src";

// Logger configuration definitions
interface LoggerConfig {
  type: 'console' | 'pino' | 'noop';
  context?: string;
  level?: string;
  format?: 'simple' | 'json' | 'colored';
}

// Declarative logger factory
const createLogger = (config: LoggerConfig) => {
  switch (config.type) {
    case 'console':
      const consoleLogger = new ConsoleLogger();
      if (config.context) {
        return new SimpleLoggerAdapter(consoleLogger, config.context);
      }
      return consoleLogger;
      
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
  'database-plugin': { type: 'console' as const, context: 'Database' },
  'api-plugin': { type: 'pino' as const },
  'cache-plugin': { type: 'noop' as const }, // Disable cache logging
  'auth-plugin': { type: 'console' as const, context: 'Auth' }
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

// Structured logging demonstration
const demonstrateStructuredLogging = () => {
  console.log("\n📊 Structured Logging:");
  
  const structuredLogger = createLogger({ type: 'console', context: 'Structured' });
  
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
  
  const perfLogger = createLogger({ type: 'console', context: 'Performance' });
  
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

// Main demonstration
const demonstrateDeclarativeLogging = async () => {
  console.log("🚀 Declarative Logger Demo\n");
  
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
  
  // Scenario 4: Structured logging
  demonstrateStructuredLogging();
  
  // Scenario 5: Performance logging
  demonstratePerformanceLogging();
  
  console.log("\n✅ Logger demo completed!");
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