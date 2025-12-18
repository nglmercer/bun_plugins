
import { describe, it, expect, mock, spyOn, beforeAll, afterAll } from "bun:test";
import { PluginManager } from "../src/PluginManager";
import type { IPlugin, PluginContext } from "../src/types";

// Mock Worker
class MockWorker {
    url: string | URL;
    options?: WorkerOptions;
    terminated = false;

    constructor(url: string | URL, options?: WorkerOptions) {
        this.url = url;
        this.options = options;
    }

    terminate() {
        this.terminated = true;
    }
}

// Override global Worker
const originalWorker = globalThis.Worker;
globalThis.Worker = MockWorker as any;

describe("PluginManager Dependencies & Workers", () => {
    
    it("should resolve dependencies correctly (A -> B)", async () => {
        const manager = new PluginManager("./test-storage-deps");
        // Mock access to internal availablePlugins for manual injection since we aren't loading from fs
        const availablePlugins = (manager as any).availablePlugins as Map<string, IPlugin>;
        
        const events: string[] = [];

        const pluginA: IPlugin = {
            name: "plugin-a",
            version: "1.0.0",
            dependencies: { "plugin-b": "1.0.0" },
            onLoad: () => { events.push("load-a"); },
            onUnload: () => {}
        };

        const pluginB: IPlugin = {
            name: "plugin-b",
            version: "1.0.0",
            onLoad: () => { events.push("load-b"); },
            onUnload: () => {}
        };

        availablePlugins.set(pluginA.name, pluginA);
        availablePlugins.set(pluginB.name, pluginB);

        // Inject resolveDependencyOrder usage logic manually or mock loadPluginsFromDirectory
        // Since loadPluginsFromDirectory reads from Disk, let's test the dependency helper logic directly 
        // OR better: use the manager to load strictly.
        
        // Let's test resolveDependencyOrder privately
        const resolve = (manager as any).resolveDependencyOrder.bind(manager);
        
        const sorted = resolve([pluginA, pluginB]);
        
        expect(sorted.map((p: any) => p.name)).toEqual(["plugin-b", "plugin-a"]);
    });

    it("should detect circular dependencies", () => {
        const manager = new PluginManager();
        const resolve = (manager as any).resolveDependencyOrder.bind(manager);

        const p1: IPlugin = { name: "p1", version: "1", dependencies: { "p2": "1" }, onLoad: () => {}, onUnload: () => {} };
        const p2: IPlugin = { name: "p2", version: "1", dependencies: { "p1": "1" }, onLoad: () => {}, onUnload: () => {} };

        expect(() => resolve([p1, p2])).toThrow("Circular dependency");
    });

    it("should track and terminate workers on unload", async () => {
        const manager = new PluginManager("./test-storage-workers");
        const pluginName = "worker-plugin";
        let capturedWorker: MockWorker | undefined;

        const plugin: IPlugin = {
            name: pluginName,
            version: "1.0.0",
            onLoad: (ctx: PluginContext) => {
                const w = ctx.createWorker("./worker.ts");
                capturedWorker = w as unknown as MockWorker;
            },
            onUnload: () => {}
        };

        await manager.register(plugin);
        
        expect(capturedWorker).toBeDefined();
        expect(capturedWorker?.terminated).toBe(false);

        await manager.unregister(pluginName);

        expect(capturedWorker?.terminated).toBe(true);
    });
});

// Restore Worker
afterAll(() => {
    globalThis.Worker = originalWorker;
});
   