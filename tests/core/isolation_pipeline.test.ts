
import { describe, expect, test, afterAll, beforeAll } from "bun:test";
import { PluginManager } from "../../src/PluginManager";
import { join } from "path";
import { rm } from "node:fs/promises";

// Helper to create a temp isolated plugin file
const TEMP_PLUGIN_DIR = join(process.cwd(), "tests", "temp_iso_plugins");
const ISOLATED_PLUGIN_PATH = join(TEMP_PLUGIN_DIR, "iso-plugin.ts");

const pluginCode = `
import { IPlugin } from "../../src/types";

export default {
    name: "iso-plugin",
    version: "1.0.0",
    onLoad: async (context) => {
        // Test RPC: Storage
        await context.storage.set("foo", "bar");
        const val = await context.storage.get("foo");
        if (val !== "bar") throw new Error("Storage mismatch in worker");
        
        // Test RPC: Logging
        context.log.info("Hello from worker!");
        
        // Test RPC: Event Emit
        context.events.emit("worker:hello", { msg: "world" });
    },
    onUnload: () => {}
} as IPlugin;
`;

describe("Isolation & Pipeline Tests", () => {
    let manager: PluginManager;

    beforeAll(async () => {
        await Bun.write(ISOLATED_PLUGIN_PATH, pluginCode);
        manager = new PluginManager(join(process.cwd(), "storage_test_iso"));
    });

    afterAll(async () => {
        await rm(TEMP_PLUGIN_DIR, { recursive: true, force: true });
        await rm(join(process.cwd(), "storage_test_iso"), { recursive: true, force: true });
    });

    test("Hooks Pipeline (Cascading)", async () => {
        // Register two plugins manually that attach hooks
        const log: string[] = [];
        
        const p1 = {
            name: "p1", version: "1.0",
            onLoad: () => {},
            setup: (build: any) => {
                build.onLoad(/test/, (args: any) => {
                    return { contents: "Version 1" };
                }, { order: 'pre' });
            }
        };

        const p2 = {
            name: "p2", version: "1.0",
            onLoad: () => {},
            setup: (build: any) => {
                build.onLoad(/test/, (args: any) => {
                    // It should receive "Version 1" from p1
                    if (args.previousContents === "Version 1") {
                        return { contents: args.previousContents + " -> Version 2" };
                    }
                    return { contents: "Failed Chain" };
                }, { order: 'post' });
            }
        };

        await manager.register(p1 as any);
        await manager.register(p2 as any);

        const result = await manager.runOnLoad({ path: "test.ts" });
        expect(result?.contents).toBe("Version 1 -> Version 2");
    });

    test("Isolated Worker Plugin Registration", async () => {
        let eventReceived = false;
        manager.on("worker:hello", (payload) => {
            if (payload.msg === "world") eventReceived = true;
        });

        // Register the file as isolated
        await manager.registerIsolated(ISOLATED_PLUGIN_PATH, "iso-plugin");
        
        // Wait a bit for RPC to happen
        await new Promise(r => setTimeout(r, 100)); // allow event loop to process RPC

        const plugin = manager.getPlugin("iso-plugin");
        expect(plugin).toBeDefined();
        
        expect(eventReceived).toBeTrue();
        
        // Verify Storage persistence
        const storage = (manager as any).storageRoot; // checking internal storage file would be ideal, but trusting RPC logic for now
    });
});
