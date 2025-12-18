import { describe, it, expect, afterEach } from "bun:test";
import { PluginManager } from "../../src/PluginManager";
import { type IPlugin, type PluginContext } from "../../src/types";
import { z } from "zod";
import { rm } from "node:fs/promises";
import { join } from "node:path";

const TEST_STORAGE_DIR = "./test_storage_" + Date.now();

const ConfigPlugin: IPlugin = {
  name: "config-plugin",
  version: "1.0.0",
  configSchema: z.object({
    enabled: z.boolean(),
    retries: z.number().default(3),
  }),
  defaultConfig: {
    enabled: true
  },
  onLoad: async (ctx: PluginContext) => {
    // Basic storage usage
    const val = await ctx.storage.get("counter");
    if (val === undefined) {
        await ctx.storage.set("counter", 1);
    } else {
        await ctx.storage.set("counter", (val as number) + 1);
    }
  },
  onUnload: async () => {}
};

describe("Plugin Storage & Configuration", () => {
  afterEach(async () => {
    await rm(TEST_STORAGE_DIR, { recursive: true, force: true });
  });

  it("should validate and merge default config", async () => {
    const manager = new PluginManager(TEST_STORAGE_DIR);
    
    // Capture context
    let capturedConfig: any;
    // @ts-ignore
    const testPlugin: IPlugin = { ...ConfigPlugin, onLoad: (ctx: PluginContext) => { capturedConfig = ctx.config; } };

    await manager.register(testPlugin);
    
    expect(capturedConfig).toBeDefined();
    expect(capturedConfig.enabled).toBe(true);
    expect(capturedConfig.retries).toBe(3); // Default value from schema
  });

  it("should fail registration on invalid config", async () => {
     const manager = new PluginManager(TEST_STORAGE_DIR);
     const badPlugin = { 
         ...ConfigPlugin, 
         name: "bad-plugin",
         defaultConfig: { enabled: "not-a-boolean" } 
     };

     // @ts-ignore
     expect(manager.register(badPlugin)).rejects.toThrow(/Configuration validation failed/);
  });

  it("should persist storage across reloads", async () => {
    // First run
    const manager1 = new PluginManager(TEST_STORAGE_DIR);
    await manager1.register(ConfigPlugin);
    
    const storePath = join(TEST_STORAGE_DIR, "plugins", "config-plugin", "storage.json");
    const file = Bun.file(storePath);
    expect(await file.exists()).toBe(true);
    
    const data = await file.json();
    expect(data.counter).toBe(1);

    // Second run (simulate restart)
    const manager2 = new PluginManager(TEST_STORAGE_DIR);
    await manager2.register(ConfigPlugin);
    
    const data2 = await file.json();
    expect(data2.counter).toBe(2);
  });
  
  it("should persist disabled state", async () => {
      const manager = new PluginManager(TEST_STORAGE_DIR);
      await manager.disablePlugin("test-plugin");
      
      const file = Bun.file(join(TEST_STORAGE_DIR, "plugins.json"));
      expect(await file.exists()).toBe(true);
      const content = await file.json();
      expect(content.disabled).toContain("test-plugin");
      
      await manager.enablePlugin("test-plugin");
      const content2 = await file.json();
      expect(content2.disabled).not.toContain("test-plugin");
  });

  it("should support delete and clear operations", async () => {
      // We need access to the storage object. The context is only passed to onLoad.
      // We can capture it.
      let capturedStorage: any;
      const testPlugin: IPlugin = {
          name: "storage-op-plugin",
          version: "1.0.0",
          onLoad: (ctx: PluginContext) => { capturedStorage = ctx.storage; },
          onUnload: () => {}
      };
      
      const manager = new PluginManager(TEST_STORAGE_DIR);
      await manager.register(testPlugin);
      
      await capturedStorage.set("a", 1);
      await capturedStorage.set("b", 2);
      
      await capturedStorage.delete("a");
      expect(await capturedStorage.get("a")).toBeUndefined();
      expect(await capturedStorage.get("b")).toBe(2);
      
      await capturedStorage.clear();
      expect(await capturedStorage.get("b")).toBeUndefined();
      
      // Verify persistence of clear
      const storePath = join(TEST_STORAGE_DIR, "plugins", "storage-op-plugin", "storage.json");
      const file = Bun.file(storePath);
      const data = await file.json();
      expect(Object.keys(data).length).toBe(0);
  });
});
