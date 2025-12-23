import { describe, it, expect } from "bun:test";
import { PluginManager } from "../../src/PluginManager";
import { ActionRegistryPlugin, MathActionsPlugin, TextActionsPlugin } from "../../examples/action-registry-example";

describe("Action Registry Pattern", () => {
  it("should allow plugins to register and execute actions through shared API", async () => {
    const manager = new PluginManager();
    
    // Register the main ActionRegistry plugin
    const registryPlugin = new ActionRegistryPlugin();
    await manager.register(registryPlugin);
    
    // Register action plugins
    const mathPlugin = new MathActionsPlugin();
    const textPlugin = new TextActionsPlugin();
    await manager.register(mathPlugin);
    await manager.register(textPlugin);
    
    // Get the registry from the plugin
    const registry = registryPlugin.getSharedApi() as any;
    
    // Verify actions are registered
    expect(registry.hasAction("sum")).toBe(true);
    expect(registry.hasAction("multiply")).toBe(true);
    expect(registry.hasAction("uppercase")).toBe(true);
    expect(registry.hasAction("reverse")).toBe(true);
    
    // Execute math actions
    expect(registry.executeAction("sum", 5, 3)).toBe(8);
    expect(registry.executeAction("multiply", 4, 7)).toBe(28);
    expect(registry.executeAction("power", 2, 3)).toBe(8);
    
    // Execute text actions
    expect(registry.executeAction("uppercase", "hello")).toBe("HELLO");
    expect(registry.executeAction("lowercase", "WORLD")).toBe("world");
    expect(registry.executeAction("reverse", "abc")).toBe("cba");
    expect(registry.executeAction("wordCount", "hello world test")).toBe(3);
  });

  it("should handle action execution errors properly", async () => {
    const manager = new PluginManager();
    const registryPlugin = new ActionRegistryPlugin();
    await manager.register(registryPlugin);
    
    const registry = registryPlugin.getSharedApi() as any;
    
    // Test non-existent action
    expect(() => {
      registry.executeAction("non-existent-action");
    }).toThrow("Acción no encontrada: non-existent-action");
  });

  it("should list all registered actions", async () => {
    const manager = new PluginManager();
    const registryPlugin = new ActionRegistryPlugin();
    await manager.register(registryPlugin);
    
    const mathPlugin = new MathActionsPlugin();
    await manager.register(mathPlugin);
    
    const registry = registryPlugin.getSharedApi() as any;
    const actions = registry.listActions();
    
    expect(actions).toContain("sum");
    expect(actions).toContain("multiply");
    expect(actions).toContain("power");
    expect(actions.length).toBe(3);
  });

  it("should allow plugins to access shared API through context", async () => {
    const manager = new PluginManager();
    
    // Track if plugins successfully accessed the registry
    let mathPluginAccessedRegistry = false;
    let textPluginAccessedRegistry = false;
    
    // Override the onLoad methods to track access
    const originalMathOnLoad = MathActionsPlugin.prototype.onLoad;
    const originalTextOnLoad = TextActionsPlugin.prototype.onLoad;
    
    MathActionsPlugin.prototype.onLoad = function(context: any) {
      const registry = context.getPlugin("action-registry");
      if (registry) {
        mathPluginAccessedRegistry = true;
      }
      // Call original method
      originalMathOnLoad.call(this, context);
    };
    
    TextActionsPlugin.prototype.onLoad = function(context: any) {
      const registry = context.getPlugin("action-registry");
      if (registry) {
        textPluginAccessedRegistry = true;
      }
      // Call original method
      originalTextOnLoad.call(this, context);
    };
    
    try {
      // Register plugins
      const registryPlugin = new ActionRegistryPlugin();
      await manager.register(registryPlugin);
      
      const mathPlugin = new MathActionsPlugin();
      const textPlugin = new TextActionsPlugin();
      await manager.register(mathPlugin);
      await manager.register(textPlugin);
      
      // Verify plugins accessed the registry
      expect(mathPluginAccessedRegistry).toBe(true);
      expect(textPluginAccessedRegistry).toBe(true);
      
    } finally {
      // Restore original methods
      MathActionsPlugin.prototype.onLoad = originalMathOnLoad;
      TextActionsPlugin.prototype.onLoad = originalTextOnLoad;
    }
  });

  it("should cleanup actions when plugins are unregistered", async () => {
    const manager = new PluginManager();
    const registryPlugin = new ActionRegistryPlugin();
    await manager.register(registryPlugin);
    
    const registry = registryPlugin.getSharedApi() as any;
    
    // Register some actions manually
    registry.registerAction("test-action", () => "test-result");
    
    // Verify action exists and works before unregister
    expect(registry.hasAction("test-action")).toBe(true);
    expect(registry.executeAction("test-action")).toBe("test-result");
    
    // Unregister the registry plugin (this should cleanup)
    await manager.unregister("action-registry");
    
    // Plugin should be removed from manager
    expect(manager.getPlugin("action-registry")).toBeUndefined();
  });

  it("should support async actions", async () => {
    const manager = new PluginManager();
    const registryPlugin = new ActionRegistryPlugin();
    await manager.register(registryPlugin);
    
    // Register an async action manually
    const registry = registryPlugin.getSharedApi() as any;
    registry.registerAction("asyncAction", async (ms: number) => {
      await new Promise(resolve => setTimeout(resolve, ms));
      return `Completed after ${ms}ms`;
    });
    
    // Execute async action
    const result = await registry.executeAction("asyncAction", 100);
    expect(result).toBe("Completed after 100ms");
  });
});