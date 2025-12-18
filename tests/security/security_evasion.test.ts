
import { describe, it, expect, mock, spyOn } from "bun:test";
import { PluginManager } from "../../src/PluginManager";
import type { IPlugin, PluginContext } from "../../src/types";

describe("Security Evasion Tests", () => {
    
    // Limits of the current system: We rely on API gating, not true sandboxing.
    // These tests demonstrate that "Bad" plugins CAN bypass our checks currently,
    // which confirms the "Isolation - Not Implemented" status in TASKS.md.

    it("demonstrates that a bad plugin can bypass env protection via global process", async () => {
        const manager = new PluginManager("./test-storage-bad-plugin");
        process.env.SECRET = "classified";

        let leakedSecret = "";

        const badPlugin: IPlugin = {
            name: "bad-env-plugin",
            version: "1.0.0",
            // No permissions requested!
            onLoad: () => {
                // EVASION: Accessing global process directly instead of ctx.env
                leakedSecret = process.env.SECRET || "";
            },
            onUnload: () => {}
        };

        // This usually succeeds because we don't have VM/Context isolation yet
        await manager.register(badPlugin);
        
        // If true isolation existed, this should be empty or undefined
        expect(leakedSecret).toBe("classified");
        
        delete process.env.SECRET;
    });

    it("demonstrates that a bad plugin can bypass network protection via global fetch", async () => {
        const manager = new PluginManager("./test-storage-bad-net");
        let globalFetchCalled = false;

        const originalFetch = globalThis.fetch;
        globalThis.fetch = ((url: any) => { globalFetchCalled = true; return Promise.resolve(new Response("ok")) }) as any;

        const badPlugin: IPlugin = {
            name: "bad-net-plugin",
            version: "1.0.0",
            // No permissions requested!
            onLoad: async () => {
                // EVASION: Accessing global fetch directly instead of ctx.network.fetch
                await fetch("https://evil.com");
            },
            onUnload: () => {}
        };

        await manager.register(badPlugin);

        // If true isolation existed, this should be false
        expect(globalFetchCalled).toBe(true);
        
        globalThis.fetch = originalFetch;
    });

    it("should still block 'API-compliant' access if permissions missing", async () => {
        // This confirms our API gating still works for "good citizens" or accidental misuse
        const manager = new PluginManager("./test-storage-compliant-fail");
        const plugin: IPlugin = {
            name: "compliant-but-unauthorized",
            version: "1.0.0",
            onLoad: async (ctx) => {
                await ctx.network.fetch("https://google.com");
            },
            onUnload: () => {}
        };

        try {
            await manager.register(plugin);
            expect(true).toBe(false);
        } catch (e: any) {
            expect(e.message).toContain("requires 'network' permission");
        }
    });
});
