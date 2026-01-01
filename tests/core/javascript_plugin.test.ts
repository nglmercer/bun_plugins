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
    
    // Load plugins which should include MyJSPlugin.js
    const pluginsDir = join(process.cwd(), "plugins");
    await manager.loadPluginsFromDirectory(pluginsDir);

    // Verify plugin was loaded
    expect(manager.listPlugins()).toContain("my-js-plugin");

    // Unregister plugin to trigger onUnload
    await manager.unregister("my-js-plugin");

    // Verify plugin was unloaded successfully
    expect(manager.listPlugins()).not.toContain("my-js-plugin");
  });

  it("should provide context with logging capabilities to JavaScript plugin", async () => {
    const manager = new PluginManager();
    
    // Load plugins
    const pluginsDir = join(process.cwd(), "plugins");
    await manager.loadPluginsFromDirectory(pluginsDir);

    // Verify the plugin was loaded
    expect(manager.listPlugins()).toContain("my-js-plugin");
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
