
import { describe, it, expect, mock, spyOn, beforeAll, afterAll } from "bun:test";
import { PluginManager } from "../src/PluginManager";
import type{ IPlugin, PluginBuilder, PluginContext } from "../src/types";

describe("PluginManager Hooks & Timeouts", () => {
    
    it("should timeout if onLoad takes too long", async () => {
        const manager = new PluginManager("./test-storage-timeout");
        const plugin: IPlugin = {
            name: "slow-plugin",
            version: "1.0.0",
            onLoad: async () => {
                await new Promise(resolve => setTimeout(resolve, 6000));
            },
            onUnload: () => {}
        };

        // We expect register to reject
        try {
            await manager.register(plugin);
            expect(true).toBe(false); // Should not reach here
        } catch (e: any) {
            expect(e.message).toContain("timed out");
        }

        // Verify it wasn't registered
        expect(manager.getPlugin("slow-plugin")).toBeUndefined();
    }, 10000);

    it("should register and execute onResolve hooks", async () => {
        const manager = new PluginManager("./test-storage-hooks");
        const plugin: IPlugin = {
            name: "hook-plugin",
            version: "1.0.0",
            onLoad: () => {},
            onUnload: () => {},
            setup: (build: PluginBuilder) => {
                build.onResolve(/\.env$/, (args) => {
                    return { path: "/virtual/.env", namespace: "env-plugin" };
                });
            }
        };

        await manager.register(plugin);

        const result = await manager.runOnResolve({ path: "secret.env" });
        expect(result).not.toBeNull();
        expect(result?.path).toBe("/virtual/.env");
        expect(result?.namespace).toBe("env-plugin");

        const ignored = await manager.runOnResolve({ path: "index.ts" });
        expect(ignored).toBeNull();
    });

    it("should register and execute onLoad hooks", async () => {
        const manager = new PluginManager("./test-storage-hooks-load");
        const plugin: IPlugin = {
            name: "load-plugin",
            version: "1.0.0",
            onLoad: () => {},
            onUnload: () => {},
            setup: (build: PluginBuilder) => {
                build.onLoad(/\.txt$/, (args) => {
                    return { contents: "hello world" };
                });
            }
        };

        await manager.register(plugin);

        const result = await manager.runOnLoad({ path: "file.txt" });
        expect(result).not.toBeNull();
        expect(result?.contents).toBe("hello world");
    });

    it("should cleanup hooks on unregister", async () => {
        const manager = new PluginManager("./test-storage-hooks-cleanup");
        
        let calls = 0;
        
        const plugin: IPlugin = {
            name: "temp-plugin",
            version: "1.0.0",
            onLoad: () => {},
            onUnload: () => {},
            setup: (build) => {
                build.onResolve(/test/, () => {
                    calls++;
                    return { path: "hook-ran" };
                });
            }
        };

        await manager.register(plugin);
        await manager.runOnResolve({ path: "test" });
        expect(calls).toBe(1);

        await manager.unregister("temp-plugin");
        await manager.runOnResolve({ path: "test" });
        expect(calls).toBe(1); // Should not increment again
    });
});
