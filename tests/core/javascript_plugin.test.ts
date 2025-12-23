import { describe, it, expect, mock } from "bun:test";
import { PluginManager } from "../../src/PluginManager";
import { join } from "node:path";

describe("JavaScript Plugin Support", () => {
  it("should load and register a JavaScript plugin from file", async () => {
    const manager = new PluginManager();
    const pluginsDir = join(process.cwd(), "plugins");

    // Load plugins from directory (should include MyJSPlugin.js)
    await manager.loadPluginsFromDirectory(pluginsDir);

    const loadedPlugins = manager.listPlugins();
    
    // Verify that our JavaScript plugin was loaded
    expect(loadedPlugins).toContain("my-js-plugin");
    
    // Get the plugin instance
    const plugin = manager.getPlugin("my-js-plugin");
    expect(plugin).toBeDefined();
    expect(plugin?.name).toBe("my-js-plugin");
    expect(plugin?.version).toBe("1.0.0");
  });

  it("should handle JavaScript plugin lifecycle methods", async () => {
    const manager = new PluginManager();
    
    // Mock console.log to capture output
    const consoleSpy = mock(() => {});
    const originalLog = console.log;
    console.log = consoleSpy;

    try {
      // Load plugins which should include MyJSPlugin.js
      const pluginsDir = join(process.cwd(), "plugins");
      await manager.loadPluginsFromDirectory(pluginsDir);

      // Verify plugin was loaded
      expect(manager.listPlugins()).toContain("my-js-plugin");

      // Unregister plugin to trigger onUnload
      await manager.unregister("my-js-plugin");

      // Verify console.log was called during onLoad and onUnload
      const calls = consoleSpy.mock.calls as any[][];
      const logMessages = calls.map(call => call[0]);
      
      // Check that our Spanish messages were logged
      expect(logMessages.includes("Plugin JS cargado!")).toBe(true);
      expect(logMessages.includes("Plugin JS descargado")).toBe(true);
      
    } finally {
      // Restore original console.log
      console.log = originalLog;
    }
  });

  it("should provide context with logging capabilities to JavaScript plugin", async () => {
    const manager = new PluginManager();
    
    // Create a mock for context.log.info
    const logInfoMock = mock(() => {});
    let capturedContext: any = null;
    
    // Override the context creation to capture log calls
    const originalRegister = manager.register.bind(manager);
    manager.register = async function(plugin: any) {
      // Only intercept our JavaScript plugin
      if (plugin.name === "my-js-plugin") {
        const originalOnLoad = plugin.onLoad;
        plugin.onLoad = function(context: any) {
          capturedContext = context;
          if (context && context.log && context.log.info) {
            context.log.info = logInfoMock;
          }
          return originalOnLoad.call(this, context);
        };
      }
      return originalRegister(plugin);
    };

    try {
      // Load plugins
      const pluginsDir = join(process.cwd(), "plugins");
      await manager.loadPluginsFromDirectory(pluginsDir);

      // Verify the plugin was loaded
      expect(manager.listPlugins()).toContain("my-js-plugin");
      
      // Verify the Spanish log message was called specifically by our plugin
      expect(logInfoMock).toHaveBeenCalled();
      const calls = logInfoMock.mock.calls as any[][];
      
      // Find the call with our specific message
      const hasSpanishMessage = calls.some(call => call[0] === "Hola desde JavaScript");
      expect(hasSpanishMessage).toBe(true);
      
    } finally {
      // Restore original register method
      manager.register = originalRegister;
    }
  });

  it("should handle mixed TypeScript and JavaScript plugins", async () => {
    const manager = new PluginManager();
    const pluginsDir = join(process.cwd(), "plugins");

    // Load all plugins from directory
    await manager.loadPluginsFromDirectory(pluginsDir);

    const loadedPlugins = manager.listPlugins();
    
    // Should contain both TS and JS plugins
    expect(loadedPlugins).toContain("math-plugin"); // TypeScript plugin
    expect(loadedPlugins).toContain("my-js-plugin"); // JavaScript plugin
    
    // Verify both plugins have proper structure
    const mathPlugin = manager.getPlugin("math-plugin");
    const jsPlugin = manager.getPlugin("my-js-plugin");
    
    expect(mathPlugin).toBeDefined();
    expect(jsPlugin).toBeDefined();
    expect(mathPlugin?.version).toBeDefined();
    expect(jsPlugin?.version).toBeDefined();
  });
});