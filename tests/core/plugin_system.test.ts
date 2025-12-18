import { describe, it, expect, mock, spyOn,test } from "bun:test";
import { PluginManager } from "../../src/PluginManager";
import type { IPlugin, PluginContext } from "../../src/types";
import { join } from "node:path";

// Mock Plugin
class MockPlugin implements IPlugin {
  name: string;
  version = "0.0.1";
  onLoad = mock((ctx: PluginContext) => {});
  onUnload = mock(() => {});

  constructor(name: string) {
    this.name = name;
  }
}

describe("Plugin System", () => {
  test("should register a plugin", async () => {
    const manager = new PluginManager();
    const plugin = new MockPlugin("test-plugin");

    await manager.register(plugin);

    expect(manager.listPlugins()).toContain("test-plugin");
    expect(plugin.onLoad).toHaveBeenCalled();
  });

  test("should not register duplicate plugins", async () => {
    const manager = new PluginManager();
    const plugin = new MockPlugin("test-plugin");

    await manager.register(plugin);
    // Expecting promise to reject
    expect(manager.register(plugin)).rejects.toThrow();
  });

  test("should unregister a plugin", async () => {
    const manager = new PluginManager();
    const plugin = new MockPlugin("test-plugin");

    await manager.register(plugin);
    await manager.unregister("test-plugin");

    expect(manager.listPlugins()).not.toContain("test-plugin");
    expect(plugin.onUnload).toHaveBeenCalled();
  });

  test("should handle events communication", async () => {
    const manager = new PluginManager();
    const resultMock = mock((_payload: any) => {});

    manager.on("log", resultMock);

    // Emit event
    manager.emit("log", { level: "info", message: "test message" });
    
    // Allow event loop to process if async (though emit is sync usually)
    await new Promise(r => setTimeout(r, 10));

    expect(resultMock).toHaveBeenCalled();
    // Verify payload
    const calls = resultMock.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    expect(calls[0]![0]).toEqual({ level: "info", message: "test message" });
  });

  test("should load plugins from directory", async () => {
    const manager = new PluginManager();
    const pluginsDir = join(process.cwd(), "src", "plugins");

    await manager.loadPluginsFromDirectory(pluginsDir);

    const loadedPlugins = manager.listPlugins();
    expect(loadedPlugins).toContain("math-plugin");
    expect(loadedPlugins).toContain("logger-plugin");
    expect(loadedPlugins).toContain("command-plugin");
    // input-simulator might not be deterministic in loading order but should be there
    expect(loadedPlugins).toContain("input-simulator");
  });
});
