
import { describe, it, expect, mock, spyOn, afterEach, beforeEach } from "bun:test";
import { PluginManager } from "../../src/PluginManager";
import type { IPlugin, PluginBuilder, PluginContext } from "../../src/types";
import { HookOrder } from "../../src/types";
import { join } from "node:path";
import { rm, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";

describe("System Enhancements", () => {
    let manager: PluginManager;
    const storageRoot = join(process.cwd(), "test-storage-enhancements");

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

    describe("Security: Path Traversal Prevention", () => {
        it("should reject plugins with path traversal characters in their name", async () => {
            const maliciousPlugin: IPlugin = {
                name: "../../etc/passwd",
                version: "1.0.0",
                onLoad: () => {},
                onUnload: () => {}
            };

            let error;
            try {
                await manager.register(maliciousPlugin);
            } catch (e: any) {
                error = e;
            }
            expect(error).toBeDefined();
            expect(error.message).toContain("Name cannot contain path traversal characters");
        });
    });

    describe("Resource Management: Timer Cleanup", () => {
        it("should automatically clear intervals on plugin unload", async () => {
            let counter = 0;
            const plugin: IPlugin = {
                name: "timer-plugin",
                version: "1.0.0",
                onLoad: (ctx) => {
                    // Use context.setInterval
                    ctx.setInterval(() => {
                        counter++;
                    }, 10);
                },
                onUnload: () => {}
            };

            await manager.register(plugin);
            
            // Let it run for a bit
            await new Promise(r => setTimeout(r, 50));
            expect(counter).toBeGreaterThan(0);
            const counterAtUnload = counter;

            // Unload
            await manager.unregister("timer-plugin");
            
            // Wait more
            await new Promise(r => setTimeout(r, 50));
            
            // Counter should have stopped increasing
            // Allow for maybe +1 due to race condition, but it should stop
            expect(counter).toBeLessThan(counterAtUnload + 2);
        });
    });

    describe("Hook System: Priority", () => {
        it("should respect hook order (pre < normal < post)", async () => {
            const log: string[] = [];
            
            const pluginPre: IPlugin = {
                name: "pre-plugin",
                version: "1.0.0",
                onLoad: () => {},
                onUnload: () => {},
                setup: (build) => {
                    build.onResolve(/test/, () => {
                        log.push("pre");
                        return null; // Continue
                    }, { order: HookOrder.PRE });
                }
            };

            const pluginNormal: IPlugin = {
                name: "normal-plugin",
                version: "1.0.0",
                onLoad: () => {},
                onUnload: () => {},
                setup: (build) => {
                    build.onResolve(/test/, () => {
                        log.push("normal");
                        return null; 
                    });
                }
            };

            const pluginPost: IPlugin = {
                name: "post-plugin",
                version: "1.0.0",
                onLoad: () => {},
                onUnload: () => {},
                setup: (build) => {
                    build.onResolve(/test/, () => {
                        log.push("post");
                        return null; 
                    }, { order: HookOrder.POST });
                }
            };

            // Register in random order
            await manager.register(pluginNormal);
            await manager.register(pluginPost);
            await manager.register(pluginPre);

            await manager.runOnResolve({ path: "test" });

            expect(log).toEqual(["pre", "normal", "post"]);
        });
        
        it("should stop execution if a high priority hook returns a result", async () => {
             const pluginPre: IPlugin = {
                name: "pre-plugin-blocking",
                version: "1.0.0",
                onLoad: () => {},
                onUnload: () => {},
                setup: (build) => {
                    build.onResolve(/test/, () => {
                        return { path: "blocked-by-pre" };
                    }, { order: HookOrder.PRE });
                }
            };
            
            const pluginNormal: IPlugin = {
                name: "normal-plugin",
                version: "1.0.0",
                onLoad: () => {},
                onUnload: () => {},
                setup: (build) => {
                    build.onResolve(/test/, () => {
                        throw new Error("Should not run");
                    });
                }
            };

            await manager.register(pluginNormal);
            await manager.register(pluginPre);

            const result = await manager.runOnResolve({ path: "test" });
            expect(result?.path).toBe("blocked-by-pre");
        });
    });
});
