/**
 * Simple Logger Example
 * 
 * This example demonstrates how to use custom loggers with the simplified system
 */

import { logger, ConsoleLogger, NoopLogger, SimpleLoggerAdapter } from "../src";

// Example 1: Using the default console logger
const demoDefaultLogger = () => {
  console.log("\n=== Default Console Logger ===");
  const log = logger.getDefaultLogger();
  
  log.info("This is an info message");
  log.warn("This is a warning message");
  log.error("This is an error message");
  log.debug?.("This is a debug message"); // Optional debug method
};

// Example 2: Using a custom logger (simulating Winston/Pino style)
const demoCustomLogger = () => {
  console.log("\n=== Custom Logger (Winston/Pino style) ===");
  
  // Create a custom logger that follows the Logger interface
  const customLogger: import("../src").Logger = {
    info: (msg: string, ...args: any[]) => {
      console.log(`[CUSTOM] ${new Date().toISOString()} INFO: ${msg}`, ...args);
    },
    warn: (msg: string, ...args: any[]) => {
      console.log(`[CUSTOM] ${new Date().toISOString()} WARN: ${msg}`, ...args);
    },
    error: (msg: string, ...args: any[]) => {
      console.log(`[CUSTOM] ${new Date().toISOString()} ERROR: ${msg}`, ...args);
    },
    debug: (msg: string, ...args: any[]) => {
      console.log(`[CUSTOM] ${new Date().toISOString()} DEBUG: ${msg}`, ...args);
    }
  };
  
  // Set it as the default logger
  logger.setDefaultLogger(customLogger);
  
  // Use it
  const log = logger.getDefaultLogger();
  log.info("Custom logger info message");
  log.warn("Custom logger warning message");
  log.error("Custom logger error message");
  log.debug?.("Custom logger debug message");
};

// Example 3: Plugin-specific loggers with context
const demoPluginLoggers = () => {
  console.log("\n=== Plugin-specific Loggers ===");
  
  // Reset to console logger
  logger.setDefaultLogger(new ConsoleLogger());
  
  // Create loggers for different plugins
  const dbLogger = logger.createLogger("database");
  const apiLogger = logger.createLogger("api");
  const authLogger = logger.createLogger("auth");
  
  dbLogger.info("Connected to database");
  dbLogger.debug?.("Query executed in 150ms");
  
  apiLogger.info("API server started on port 3000");
  apiLogger.warn("High response time detected");
  
  authLogger.info("User authentication successful");
  authLogger.error("Invalid credentials provided");
};

// Example 4: Using no-op logger to disable logging
const demoNoopLogger = () => {
  console.log("\n=== No-op Logger (disabled logging) ===");
  
  const noopLog = new NoopLogger();
  logger.setDefaultLogger(noopLog);
  
  const log = logger.getDefaultLogger();
  log.info("This won't be shown");
  log.error("Neither will this error");
  log.warn("This warning is also ignored");
  
  console.log("But regular console.log still works");
};

// Example 5: Wrapping existing loggers
const demoWrapLogger = () => {
  console.log("\n=== Wrapping Existing Loggers ===");
  
  // Simulate an existing logger from another library
  const existingLogger = {
    log: (level: string, message: string) => {
      console.log(`[EXTERNAL] ${level.toUpperCase()}: ${message}`);
    }
  };
  
  // Create a wrapper that implements our Logger interface
  const wrappedLogger: import("../src").Logger = {
    info: (msg: string) => existingLogger.log('info', msg),
    warn: (msg: string) => existingLogger.log('warn', msg),
    error: (msg: string) => existingLogger.log('error', msg),
    child: (context: string) => wrappedLogger // Simple child implementation
  };
  
  // Wrap it with our adapter for context support
  const adaptedLogger = logger.wrapLogger(wrappedLogger, "wrapped-context");
  
  adaptedLogger.info("Message from wrapped logger");
  adaptedLogger.warn("Warning from wrapped logger");
  adaptedLogger.error("Error from wrapped logger");
};

// Main demonstration
const runLoggerDemo = async () => {
  console.log("🚀 Simple Logger Demo\n");
  
  demoDefaultLogger();
  demoCustomLogger();
  demoPluginLoggers();
  demoNoopLogger();
  demoWrapLogger();
  
  console.log("\n✅ Logger demo completed!");
};

// Export for use
export { runLoggerDemo };

// Run if called directly
if (import.meta.main) {
  runLoggerDemo().catch(console.error);
}