
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { PluginManager } from "../../src/PluginManager";
import type { IPlugin } from "../../src/types";
import { join } from "node:path";
import { rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";

describe("Bun Worker Integration", () => {
    let manager: PluginManager;
    const storageRoot = join(process.cwd(), "test-storage-workers");
    const workerScriptParams = join(process.cwd(), "worker-params.ts");

    beforeEach(() => {
        manager = new PluginManager(storageRoot);
    });

    afterEach(async () => {
        const plugins = manager.listPlugins();
        for (const p of plugins) {
            await manager.unregister(p).catch(() => {});
        }
        if (existsSync(storageRoot)) {
            await rm(storageRoot, { recursive: true, force: true });
        }
        if (existsSync(workerScriptParams)) {
            await rm(workerScriptParams);
        }
    });

    it("should create a worker with smol mode and handle messages", async () => {
        // Create a simple worker script
        const workerScriptPath = join(process.cwd(), "test-worker.ts");
        await writeFile(workerScriptPath, `
            declare var self: Worker;
            self.onmessage = (event) => {
                self.postMessage("Received: " + event.data);
            };
        `);

        // Defer cleanup
        // We can't easily rm the worker file immediately if it's being loaded, usually.
        // But for test sake we will try cleanup in afterEach implicitly or explicit finally.

        const plugin: IPlugin = {
            name: "worker-plugin",
            version: "1.0.0",
            onLoad: async (ctx) => {
                const worker = ctx.createWorker(workerScriptPath, { smol: true });
                
                // Verify ref/unref exists
                expect(typeof worker.ref).toBe("function");
                expect(typeof worker.unref).toBe("function");

                await new Promise<void>((resolve) => {
                    worker.onmessage = (event) => {
                        expect(event.data).toBe("Received: hello");
                        resolve();
                    };
                    worker.postMessage("hello");
                });
                
                worker.terminate();
            },
            onUnload: () => {}
        };

        try {
            await manager.register(plugin);
        } finally {
             if (existsSync(workerScriptPath)) await rm(workerScriptPath);
        }
    });

    it("should auto-cleanup worker resources on close", async () => {
        const workerScriptPath = join(process.cwd(), "auto-close-worker.ts");
        await writeFile(workerScriptPath, `
            declare var self: Worker;
            self.postMessage("ready");
            // Exit immediately
            setTimeout(() => process.exit(0), 10);
        `);

        let capturedWorker: any;

        const plugin: IPlugin = {
            name: "cleanup-plugin",
            version: "1.0.0",
            onLoad: (ctx) => {
                const w = ctx.createWorker(workerScriptPath);
                capturedWorker = w;
                return new Promise<void>((resolve) => {
                    w.onmessage = () => resolve();
                });
            },
            onUnload: () => {}
        };

        await manager.register(plugin);
        
        // Wait for worker to exit
        await new Promise(r => setTimeout(r, 2000));

        // We can't easily inspect the private resources map from here without a public method or hacking.
        // However, we can trust the implementation if we tested the logic manually. 
        // Or we can query `manager['resources']` if we strip private (TS only).
        
        // @ts-ignore
        const resourceManager = manager.resources;
        const resources = resourceManager.get("cleanup-plugin");
        expect(resources).toBeDefined();
        // Should be empty or filtered
        expect(resources?.workers).not.toContain(capturedWorker);
        
        await rm(workerScriptPath);
    });
});
