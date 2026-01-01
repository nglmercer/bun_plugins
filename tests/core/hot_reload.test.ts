import { describe, test, expect, mock, beforeEach, afterEach } from "bun:test";
import { PluginManager } from "../../src/PluginManager";
import { join } from "node:path";
import { rm, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";

const TEST_DIR = join(process.cwd(), "test_hot_reload");
const STORAGE_DIR = join(TEST_DIR, "storage");
const PLUGINS_DIR = join(TEST_DIR, "plugins");

describe("Hot Reload and onReload Hook", () => {
    
    beforeEach(async () => {
        if (existsSync(TEST_DIR)) {
            await rm(TEST_DIR, { recursive: true, force: true });
        }
        await mkdir(STORAGE_DIR, { recursive: true });
        await mkdir(PLUGINS_DIR, { recursive: true });
    });

    afterEach(async () => {
        await rm(TEST_DIR, { recursive: true, force: true });
    });

    test("should execute onReload and onLoad during plugin update", async () => {
        const manager = new PluginManager(STORAGE_DIR);
        
        const pluginPath = join(PLUGINS_DIR, "reload-test.ts");
        
        // Version 1
        await writeFile(pluginPath, `
            export const plugin = {
                name: "reload-test",
                version: "1.0.0",
                onLoad: () => { (globalThis as any).loadCount = ((globalThis as any).loadCount || 0) + 1; },
                onReload: () => { (globalThis as any).reloadCount = ((globalThis as any).reloadCount || 0) + 1; },
                onUnload: () => {}
            }
        `);

        (globalThis as any).loadCount = 0;
        (globalThis as any).reloadCount = 0;

        await manager.loadPluginsFromDirectory(PLUGINS_DIR);
        expect(manager.listPlugins()).toContain("reload-test");
        expect((globalThis as any).loadCount).toBe(1);
        expect((globalThis as any).reloadCount).toBe(0);

        // Version 2 (Update version to simulate change)
        await writeFile(pluginPath, `
            export const plugin = {
                name: "reload-test",
                version: "1.1.0",
                onLoad: () => { (globalThis as any).loadCount = ((globalThis as any).loadCount || 0) + 1; },
                onReload: () => { (globalThis as any).reloadCount = ((globalThis as any).reloadCount || 0) + 1; },
                onUnload: () => {}
            }
        `);

        // Trigger manual reload (what hotReload would do)
        await manager.loadPluginsFromDirectory(PLUGINS_DIR);
        
        expect(manager.getPlugin("reload-test")?.version).toBe("1.1.0");
        expect((globalThis as any).loadCount).toBe(2);
        expect((globalThis as any).reloadCount).toBe(1);
    });

    test("should emit plugin:updated event", async () => {
        const manager = new PluginManager(STORAGE_DIR);
        const pluginPath = join(PLUGINS_DIR, "event-test.ts");
        
        await writeFile(pluginPath, `
            export const plugin = {
                name: "event-test",
                version: "1.0.0",
                onLoad: () => {},
                onUnload: () => {}
            }
        `);

        await manager.loadPluginsFromDirectory(PLUGINS_DIR);

        const updatedPromise = new Promise<{name: string, version: string}>(resolve => {
            manager.on("plugin:updated", (data) => resolve(data));
        });

        // Update version
        await writeFile(pluginPath, `
            export const plugin = {
                name: "event-test",
                version: "2.0.0",
                onLoad: () => {},
                onUnload: () => {}
            }
        `);

        await manager.loadPluginsFromDirectory(PLUGINS_DIR);
        
        const data = await updatedPromise;
        expect(data.name).toBe("event-test");
        expect(data.version).toBe("2.0.0");
    });
});
