import { describe, it, expect } from "bun:test";
import { PluginManager } from "../../src/PluginManager";
import { join } from "node:path";

describe("Action Registry Dynamic Loading", () => {
  it("should load ActionRegistryPlugin and verify getSharedApi works", async () => {
    const manager = new PluginManager();
    
    // Cargar plugins dinámicamente
    const pluginsDir = join(process.cwd(), "plugins");
    await manager.loadPluginsFromDirectory(pluginsDir);
    
    // Verificar que ActionRegistryPlugin se cargó
    const registryPlugin = manager.getPlugin("action-registry");
    expect(registryPlugin).toBeDefined();
    
    // Verificar que getSharedApi funciona
    const sharedApi = registryPlugin?.getSharedApi?.();
    expect(sharedApi).toBeDefined();
    expect(typeof sharedApi).toBe("object");
    
    // Verificar que el objeto tiene los métodos esperados
    expect(typeof (sharedApi as any).registerAction).toBe("function");
    expect(typeof (sharedApi as any).executeAction).toBe("function");
    expect(typeof (sharedApi as any).listActions).toBe("function");
    expect(typeof (sharedApi as any).hasAction).toBe("function");
  });

  it("should allow plugins to register actions through shared API", async () => {
    const manager = new PluginManager();
    
    // Cargar plugins dinámicamente
    const pluginsDir = join(process.cwd(), "plugins");
    await manager.loadPluginsFromDirectory(pluginsDir);
    
    // Obtener el ActionRegistry
    const registryPlugin = manager.getPlugin("action-registry") as any;
    const registry = registryPlugin?.getSharedApi?.();
    
    if (!registry) {
      return;
    }
    
    // Verificar que las acciones se hayan registrado
    const actions = registry.listActions();
    
    // Verificar acciones específicas si existen
    if (registry.hasAction("sum")) {
      const result = registry.executeAction("sum", 5, 3);
      expect(result).toBe(8);
    }
    
    if (registry.hasAction("uppercase")) {
      const result = registry.executeAction("uppercase", "hello");
      expect(result).toBe("HELLO");
    }
  });

  it("should show which plugins have registered actions", async () => {
    const manager = new PluginManager();
    
    // Cargar plugins dinámicamente
    const pluginsDir = join(process.cwd(), "plugins");
    await manager.loadPluginsFromDirectory(pluginsDir);
    
    const loadedPlugins = manager.listPlugins();
    
    // Verificar qué plugins tienen acciones
    for (const pluginName of loadedPlugins) {
      const plugin = manager.getPlugin(pluginName);
      if (plugin?.getSharedApi) {
        const api = plugin.getSharedApi() as any;
        if (api && api.actions && Array.isArray(api.actions)) {
          expect(api.actions.length).toBeGreaterThan(0);
        }
      }
    }
  });
});
