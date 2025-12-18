import { describe, test, expect, afterEach, beforeEach } from "bun:test";
import { PluginManager } from "../../src/PluginManager";
import { join } from "node:path";
import { rm, mkdir } from "node:fs/promises";

const TEST_STORAGE_DIR = `./test_storage_lifecycle_${Date.now()}`;
const FIXTURES_DIR = join(process.cwd(), "tests", "fixtures", "valid");

describe("Plugin Lifecycle Extended", () => {
    
    // Cleanup before and after
    const cleanup = async () => {
        await rm(TEST_STORAGE_DIR, { recursive: true, force: true });
    };

    beforeEach(async () => {
        await cleanup();
        await mkdir(TEST_STORAGE_DIR, { recursive: true });
    });

    afterEach(async () => {
        await cleanup();
    });

    test("should disable and re-enable a plugin dynamically", async () => {
        const manager = new PluginManager(TEST_STORAGE_DIR);
        await manager.loadPluginsFromDirectory(FIXTURES_DIR);

        // Ensure initially loaded
        expect(manager.listPlugins()).toContain("simple-valid-plugin");

        // Disable
        await manager.disablePlugin("simple-valid-plugin");
        expect(manager.listPlugins()).not.toContain("simple-valid-plugin");

        // Verify persistence
        const pluginsFile = Bun.file(join(TEST_STORAGE_DIR, "plugins.json"));
        const config = await pluginsFile.json();
        expect(config.disabled).toContain("simple-valid-plugin");

        // Enable
        await manager.enablePlugin("simple-valid-plugin");
        expect(manager.listPlugins()).toContain("simple-valid-plugin");
        
        // Verify persistence removal
        const config2 = await pluginsFile.json();
        expect(config2.disabled).not.toContain("simple-valid-plugin");
    });

    test("should skip disabled plugins during load but allow enabling them later", async () => {
        // Pre-configure disabled state
        const pluginsJsonPath = join(TEST_STORAGE_DIR, "plugins.json");
        await Bun.write(pluginsJsonPath, JSON.stringify({ disabled: ["simple-valid-plugin"] }));

        const manager = new PluginManager(TEST_STORAGE_DIR);
        await manager.loadPluginsFromDirectory(FIXTURES_DIR);

        // Should NOT be loaded
        expect(manager.listPlugins()).not.toContain("simple-valid-plugin");
        // But should have loaded others
        expect(manager.listPlugins()).toContain("object-plugin");

        // Enable it
        await manager.enablePlugin("simple-valid-plugin");
        expect(manager.listPlugins()).toContain("simple-valid-plugin");
    });

    test("should handle enabling a plugin that was never discovered gracefully", async () => {
        const manager = new PluginManager(TEST_STORAGE_DIR);
        // No loading happened, so availablePlugins is empty
        
        await manager.enablePlugin("non-existent-plugin");
        expect(manager.listPlugins()).not.toContain("non-existent-plugin");
        
        // Logic says it should warn but not crash.
    });
});
