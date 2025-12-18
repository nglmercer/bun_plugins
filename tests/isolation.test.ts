
import { describe, it, expect, afterAll } from "bun:test";
import { PluginManager } from "../src/PluginManager";
import { join } from "path";

describe("Plugin Isolation", () => {
    // Increase timeout for worker spawn
    const manager = new PluginManager();

    it("should load a plugin in a worker and handle events/hooks", async () => {
        const fixturePath = join(process.cwd(), "tests/fixtures/worker_plugin.ts");
        
        console.log("Registering isolated plugin...");
        // Register isolated
        await manager.registerIsolated(fixturePath, "worker-plugin");
        
        console.log("Waiting for events...");
        // Test Events (Ping -> Pong)
        const pongPromise = new Promise((resolve) => {
            manager.on("pong", (payload) => resolve(payload));
        });
        
        // Give worker a moment to ensure listener is registered via RPC (async)
        await new Promise(r => setTimeout(r, 500));
        
        manager.emit("ping", "hello worker");
        
        const pong = await pongPromise;
        expect(pong).toEqual({ echo: "hello worker" });
        
        // Test Hooks (onResolve)
        const result = await manager.runOnResolve({ path: "test.worker.js" });
        expect(result).toEqual({ path: "test.worker.js.resolved", namespace: "worker-test" });
        
        // Cleanup
        await manager.unregister("worker-plugin");
    }, 10000); // 10s timeout
});
