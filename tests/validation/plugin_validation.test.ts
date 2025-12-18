import { describe, expect, test, spyOn } from "bun:test";
import { PluginManager } from "../../src/PluginManager";
import { join } from "node:path";

describe("Plugin Validation & Loading", () => {
    
  test("should load valid class-based plugin directly", async () => {
     const manager = new PluginManager();
     const validPath = join(process.cwd(), "tests", "fixtures", "valid");
     
     await manager.loadPluginsFromDirectory(validPath);
     
     const plugins = manager.listPlugins();
     expect(plugins).toContain("simple-valid-plugin");
  });

  test("should load valid object-based plugin directly", async () => {
     const manager = new PluginManager();
     const validPath = join(process.cwd(), "tests", "fixtures", "valid");

     await manager.loadPluginsFromDirectory(validPath);

     const plugins = manager.listPlugins();
     expect(plugins).toContain("object-plugin");
     
     // Verify shimmed onUnload exists and runs without error
     const plugin = manager.getPlugin("object-plugin");
     expect(plugin).toBeDefined();
     expect(typeof plugin?.onUnload).toBe("function");
     expect(() => plugin?.onUnload()).not.toThrow();
  });
  test("should not load invalid plugins", async () => {
    const manager = new PluginManager();
    const invalidPath = join(process.cwd(), "tests", "fixtures", "invalid");

    await manager.loadPluginsFromDirectory(invalidPath);

    const plugins = manager.listPlugins();
    // detailed checks
    // NoNamePlugin has no name, so it fails validation
    // NoOnLoadPlugin has no onLoad, so it fails validation
    expect(plugins.length).toBe(0);
  });
});
