
import { describe, it, expect, mock, spyOn } from "bun:test";
import { PluginManager } from "../../src/PluginManager";
import type { IPlugin, PluginContext } from "../../src/types";

describe("Plugin Security & Permissions", () => {

    it("should allow fetch if 'network' permission is present", async () => {
        const manager = new PluginManager("./test-storage-security-net-ok");
        
        let fetchCalled = false;
        // Mock global fetch
        const originalFetch = globalThis.fetch;
        globalThis.fetch = ((url: any) => { fetchCalled = true; return Promise.resolve(new Response("ok")) }) as any;

        const plugin: IPlugin = {
            name: "net-plugin",
            version: "1.0.0",
            permissions: ["network"],
            onLoad: async (ctx: PluginContext) => {
                await ctx.network.fetch("https://example.com");
            },
            onUnload: () => {}
        };

        await manager.register(plugin);
        expect(fetchCalled).toBe(true);

        globalThis.fetch = originalFetch;
    });

    it("should block fetch if 'network' permission is missing", async () => {
        const manager = new PluginManager("./test-storage-security-net-fail");
        
        const plugin: IPlugin = {
            name: "no-net-plugin",
            version: "1.0.0",
            // No permissions
            onLoad: async (ctx: PluginContext) => {
                await ctx.network.fetch("https://example.com");
            },
            onUnload: () => {}
        };

        try {
            await manager.register(plugin);
            expect(true).toBe(false); // fail if registered
        } catch (e: any) {
             expect(e.message).toContain("requires 'network' permission");
        }
    });

    it("should allow env access if 'env' permission is present", async () => {
        const manager = new PluginManager("./test-storage-security-env-ok");
        process.env.TEST_VAR = "secret";

        const plugin: IPlugin = {
            name: "env-plugin",
            version: "1.0.0",
            permissions: ["env"],
            onLoad: (ctx: PluginContext) => {
                 expect(ctx.env.TEST_VAR).toBe("secret");
            },
            onUnload: () => {}
        };

        await manager.register(plugin);
        delete process.env.TEST_VAR;
    });

    it("should block env access if 'env' permission is missing", async () => {
        const manager = new PluginManager("./test-storage-security-env-fail");

        const plugin: IPlugin = {
            name: "no-env-plugin",
            version: "1.0.0",
            onLoad: (ctx: PluginContext) => {
                 const secret = ctx.env.TEST_VAR;
            },
            onUnload: () => {}
        };

        try {
            await manager.register(plugin);
            expect(true).toBe(false);
        } catch (e: any) {
             expect(e.message).toContain("requires 'env' permission");
        }
    });

    it("should prevent modifying env variables even with permission", async () => {
        const manager = new PluginManager("./test-storage-security-env-mod");
        
        const plugin: IPlugin = {
            name: "env-mod-plugin",
            version: "1.0.0",
            permissions: ["env"],
            onLoad: (ctx: PluginContext) => {
                // @ts-ignore
                ctx.env.NEW_VAR = "hacker";
            },
            onUnload: () => {}
        };

        try {
            await manager.register(plugin);
            expect(true).toBe(false);
        } catch (e: any) {
             expect(e.message).toContain("cannot modify environment variables");
        }
    });
});
