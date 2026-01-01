
import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { PluginManager } from "../../src/PluginManager";
import { join } from "node:path";
import { write } from "bun";
import { mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";

const TEMP_PLUGINS_DIR = join(process.cwd(), "temp_test_plugins");

describe("Plugin Styles & Variations", () => {
  beforeAll(async () => {
    // Setup temp dir
    if (existsSync(TEMP_PLUGINS_DIR)) {
      await rm(TEMP_PLUGINS_DIR, { recursive: true, force: true });
    }
    await mkdir(TEMP_PLUGINS_DIR, { recursive: true });

    // 1. Class Plugin (Default Export)
    await write(join(TEMP_PLUGINS_DIR, "class-plugin.ts"), `
        import { IPlugin, PluginContext } from "../src/types";
        export default class ClassPlugin implements IPlugin {
            name = "class-plugin";
            version = "1.0.0";
            onLoad(ctx: PluginContext) {
                ctx.log.info("Class Plugin Initialized");
            }
            onUnload() {}
        }
    `);

    // 2. Object Plugin (Default Export)
    await write(join(TEMP_PLUGINS_DIR, "object-plugin.ts"), `
        export default {
            name: "object-plugin",
            version: "1.0.0",
            onLoad: () => {},
            onUnload: () => {}
        };
    `);

    // 3. Factory Function Plugin (Default Export)
    // The validator treats functions as constructors (new fn()), 
    // which works for factories returning objects too.
    await write(join(TEMP_PLUGINS_DIR, "factory-plugin.ts"), `
        export default function createPlugin() {
            return {
                name: "factory-plugin",
                version: "1.0.0",
                onLoad: () => {},
                onUnload: () => {}
            };
        }
    `);

    // 4. Plugin with onStart Hook (New Feature)
    await write(join(TEMP_PLUGINS_DIR, "onstart-plugin.ts"), `
        export default {
            name: "onstart-plugin",
            version: "1.0.0",
            onLoad: () => {},
            setup: (build) => {
                build.onStart(() => {
                    console.log("[TestLog] onStart executed for onstart-plugin");
                });
            },
            onUnload: () => {}
        };
    `);

    // 5. Extended Plugin Class (using base Plugin class)
    await write(join(TEMP_PLUGINS_DIR, "extended-plugin.ts"), `
        import { Plugin } from "../src/Plugin";
        export default class ExtendedPlugin extends Plugin {
            name = "extended-plugin";
            version = "1.0.0";
            // onLoad is optional in base class, but we can override
            onLoad() { console.log('Extended loaded'); }
        }
    `);

    // 6. definePlugin Helper
    await write(join(TEMP_PLUGINS_DIR, "helper-plugin.ts"), `
        import { definePlugin } from "../src/Plugin";
        export default definePlugin({
            name: "helper-plugin",
            version: "1.0.0",
            onLoad: () => {}
        });
    `);
  });

  afterAll(async () => {
    if (existsSync(TEMP_PLUGINS_DIR)) {
      await rm(TEMP_PLUGINS_DIR, { recursive: true, force: true });
    }
  });

  test("should load Class Plugin", async () => {
    const manager = new PluginManager();
    await manager.loadPluginsFromDirectory(TEMP_PLUGINS_DIR);
    expect(manager.listPlugins()).toContain("class-plugin");
    expect(manager.getPlugin("class-plugin")).toBeDefined();
  });

  test("should load Object Plugin", async () => {
    const manager = new PluginManager();
    await manager.loadPluginsFromDirectory(TEMP_PLUGINS_DIR);
    expect(manager.listPlugins()).toContain("object-plugin");
  });

  test("should load Factory Function Plugin", async () => {
    const manager = new PluginManager();
    await manager.loadPluginsFromDirectory(TEMP_PLUGINS_DIR);
    expect(manager.listPlugins()).toContain("factory-plugin");
  });

  // Since console.log is hard to spy on across module boundaries in parallel tests,
  // we rely on the fact that it loads without error for now, 
  // or we could inspect explicit side effects if we had a shared store (like file writing).
  // Ideally, we'd mock console.log, but process isolation can be tricky.
  test("should register setup() hooks correctly", async () => {
    const manager = new PluginManager();
    await manager.loadPluginsFromDirectory(TEMP_PLUGINS_DIR);
    const plugin = manager.getPlugin("onstart-plugin");
    expect(plugin).toBeDefined();
    
    // Check internal metrics if hook was registered
    const metrics = manager.getMetrics();
    expect(metrics.hooks.onStart).toBe(1);
    expect(manager.listPlugins()).toContain("onstart-plugin");
  });

  test("should load Extended Plugin (extends Plugin)", async () => {
    const manager = new PluginManager();
    await manager.loadPluginsFromDirectory(TEMP_PLUGINS_DIR);
    expect(manager.listPlugins()).toContain("extended-plugin");
  });

  test("should load Helper Plugin (definePlugin)", async () => {
    const manager = new PluginManager();
    await manager.loadPluginsFromDirectory(TEMP_PLUGINS_DIR);
    expect(manager.listPlugins()).toContain("helper-plugin");
  });
});
