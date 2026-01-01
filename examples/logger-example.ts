import { PluginManager, logger, ConsoleLoggerAdapter, PinoLoggerAdapter, NoopLoggerAdapter } from "../src";

// Example 1: Using the default console logger
console.log("=== Example 1: Default Console Logger ===");
const pluginManager1 = new PluginManager();

// Example 2: Using a custom console logger with different formatting
console.log("\n=== Example 2: Custom Console Logger ===");
const customConsoleLogger = new ConsoleLoggerAdapter();
customConsoleLogger.setContext("MyApp");
logger.setDefaultLogger(customConsoleLogger);

// Example 3: Using a Pino-style logger (simulated)
console.log("\n=== Example 3: Pino-style Logger ===");
const pinoLogger = {
  info: (obj: any, msg?: string, ...args: any[]) => {
    console.log(`[PINO] INFO: ${msg}`, obj, ...args);
  },
  warn: (obj: any, msg?: string, ...args: any[]) => {
    console.log(`[PINO] WARN: ${msg}`, obj, ...args);
  },
  error: (obj: any, msg?: string, ...args: any[]) => {
    console.log(`[PINO] ERROR: ${msg}`, obj, ...args);
  },
  child: (bindings: any) => pinoLogger
};

const pinoAdapter = new PinoLoggerAdapter(pinoLogger);
logger.setDefaultLogger(pinoAdapter);

// Example 4: Using a no-op logger (disable logging)
console.log("\n=== Example 4: No-op Logger (disabled) ===");
const noopLogger = new NoopLoggerAdapter();
logger.setDefaultLogger(noopLogger);

// Example 5: Plugin-specific loggers
console.log("\n=== Example 5: Plugin-specific Loggers ===");
const consoleLogger = new ConsoleLoggerAdapter();
logger.setPluginLogger("MyPlugin", consoleLogger);
logger.setPluginLogger("AnotherPlugin", new NoopLoggerAdapter());

// Test the loggers
const pluginLogger = logger.getLogger("MyPlugin");
pluginLogger.info("This is an info message from MyPlugin");
pluginLogger.warn("This is a warning from MyPlugin");
pluginLogger.error("This is an error from MyPlugin");

const anotherLogger = logger.getLogger("AnotherPlugin");
anotherLogger.info("This message won't be shown (no-op logger)");

// Example 6: Child loggers for nested contexts
console.log("\n=== Example 6: Child Loggers ===");
const parentLogger = logger.getLogger("Parent");
const childLogger = parentLogger.child("Child");

parentLogger.info("Message from parent");
childLogger.info("Message from child");

console.log("\n=== Logger system is ready to use! ===");