
import { describe, it, expect, mock, spyOn, afterEach, beforeEach } from "bun:test";
import { PluginManager } from "../../src/PluginManager";
import type { IPlugin, PluginBuilder } from "../../src/types";
import { join } from "node:path";
import { rm, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";

describe("Edge Cases and Robustness", () => {
    let manager: PluginManager;
    const storageRoot = join(process.cwd(), "test-storage-edge");

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
    });

    describe("Dependency Versioning", () => {
        it("should reject plugin with incompatible dependency version", async () => {
            const depPlugin: IPlugin = {
                name: "core-lib",
                version: "1.0.0",
                onLoad: () => {},
                onUnload: () => {}
            };

            const dependentPlugin: IPlugin = {
                name: "app-plugin",
                version: "1.0.0",
                dependencies: { "core-lib": "^2.0.0" }, // Requires 2.x
                onLoad: () => {},
                onUnload: () => {}
            };

            await manager.register(depPlugin);

            let error;
            try {
                await manager.register(dependentPlugin);
            } catch (e: any) {
                error = e;
            }
            expect(error).toBeDefined();
            expect(error.message).toContain("requires dependency core-lib version ^2.0.0, but found 1.0.0");
        });
    });

    describe("Setup Phase Failures", () => {
        it("should not register plugin if setup hook fails", async () => {
            const failingPlugin: IPlugin = {
                name: "broken-setup",
                version: "1.0.0",
                setup: (build) => {
                    throw new Error("Setup exploded");
                },
                onLoad: () => {}, // Should not be called
                onUnload: () => {}
            };

            try {
                await manager.register(failingPlugin);
                expect(true).toBe(false); // Should fail
            } catch (e: unknown) {
                expect(e instanceof Error).toBe(true);
                expect((e as Error).message).toContain("Setup exploded");
            }

            expect(manager.getPlugin("broken-setup")).toBeUndefined();
        });
    });

    describe("Resource Cleanup on Failure", () => {
        it("should terminate workers if onLoad fails", async () => {
            // Mock Worker
            const terminateMock = mock(() => {});
            class MockWorker {
                terminate = terminateMock;
                postMessage() {}
                addEventListener() {}
                removeEventListener() {}
                dispatchEvent() { return true; }
            }

            // Inject factory
            const factory = () => new MockWorker() as any;
            
            // Re-instantiate manager with factory
            manager = new PluginManager(storageRoot, { workerFactory: factory });

            const leakingPlugin: IPlugin = {
                name: "leaky-plugin",
                version: "1.0.0",
                onLoad: async (ctx) => {
                    ctx.createWorker("script.js");
                    throw new Error("Load failed mid-way");
                },
                onUnload: () => {}
            };

            try {
                await manager.register(leakingPlugin);
            } catch (e) {
                // Expected
            }

            expect(terminateMock).toHaveBeenCalled();
            expect(manager.getPlugin("leaky-plugin")).toBeUndefined();
        });
    });

    describe("Circular Dependencies", () => {
        const tempPluginsDir = join(process.cwd(), "temp-circular-plugins");

        beforeEach(async () => {
            await mkdir(tempPluginsDir, { recursive: true });
        });

        afterEach(async () => {
            if (existsSync(tempPluginsDir)) {
                 await rm(tempPluginsDir, { recursive: true, force: true });
            }
        });

        it("should detect circular dependencies during directory load", async () => {
            // Create Plugin A
            const pluginA = `
                export const plugin = {
                    name: "plugin-a",
                    version: "1.0.0",
                    dependencies: { "plugin-b": "1.0.0" },
                    onLoad: () => {},
                    onUnload: () => {}
                };
            `;
            // Create Plugin B
            const pluginB = `
                export const plugin = {
                    name: "plugin-b",
                    version: "1.0.0",
                    dependencies: { "plugin-a": "1.0.0" },
                    onLoad: () => {},
                    onUnload: () => {}
                };
            `;

            await writeFile(join(tempPluginsDir, "a.ts"), pluginA);
            await writeFile(join(tempPluginsDir, "b.ts"), pluginB);

            const consoleSpy = spyOn(console, "error");
            
            await manager.loadPluginsFromDirectory(tempPluginsDir);

            // We expect the sorting/loading process to catch the cycle or fail
            // The implementation throws: "Circular dependency detected in plugins."
            // But `loadPluginsFromDirectory` catches errors and logs them.
            
            const errorCall = consoleSpy.mock.calls.find(call => 
                call[0].includes("Failed to resolve plugin dependencies")
            );
            
            expect(errorCall).toBeDefined();
            expect(errorCall![1].message).toContain("Circular dependency detected");
            
            consoleSpy.mockRestore();
        });
    });

    describe("Corrupt Global Config", () => {
        it("should survive corrupt plugins.json", async () => {
            await mkdir(storageRoot, { recursive: true });
            await writeFile(join(storageRoot, "plugins.json"), "{ invalid json ");

            const consoleSpy = spyOn(console, "warn");
            await manager.loadPluginsFromDirectory("./non-existent-dir"); 
            // We just want to see if it reads config and survives
            
            const warnCall = consoleSpy.mock.calls.find(call => 
                call[0].includes("Failed to load global plugin config")
            );
            
            expect(warnCall).toBeDefined();
            consoleSpy.mockRestore();
        });
    });
});
