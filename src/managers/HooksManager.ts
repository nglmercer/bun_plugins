
import type { 
    OnResolveCallback, 
    OnLoadCallback, 
    OnResolveArgs, 
    OnLoadArgs, 
    HookRegistry,
    PluginBuilder
} from "../types";
import type { BunPlugin } from "bun";

export class HooksManager {
    private onResolveHooks: HookRegistry<OnResolveCallback>[] = [];
    private onLoadHooks: HookRegistry<OnLoadCallback>[] = [];

    registerOnResolve(filter: RegExp, callback: OnResolveCallback, pluginName: string, order?: 'pre' | 'post') {
        // Performance wrapper could be applied here or by caller.
        // For simplicity, we store as is.
        this.onResolveHooks.push({ filter, callback, pluginName, order });
    }

    registerOnLoad(filter: RegExp, callback: OnLoadCallback, pluginName: string, order?: 'pre' | 'post') {
        this.onLoadHooks.push({ filter, callback, pluginName, order });
    }

    getHookCount(type: 'onResolve' | 'onLoad'): number {
        return type === 'onResolve' ? this.onResolveHooks.length : this.onLoadHooks.length;
    }

    cleanup(pluginName: string) {
        this.onResolveHooks = this.onResolveHooks.filter(h => h.pluginName !== pluginName);
        this.onLoadHooks = this.onLoadHooks.filter(h => h.pluginName !== pluginName);
    }

    async runOnResolve(args: OnResolveArgs): Promise<{ path: string; namespace?: string } | null> {
        const sortedHooks = [...this.onResolveHooks].sort((a, b) => {
            const score = (o?: 'pre' | 'post') => o === 'pre' ? -1 : o === 'post' ? 1 : 0;
            return score(a.order) - score(b.order);
        });

        for (const hook of sortedHooks) {
            if (hook.filter.test(args.path)) {
                try {
                     const result = await hook.callback(args);
                     if (result) return result;
                } catch (e) {
                    console.error(`Error in onResolve hook from ${hook.pluginName}:`, e);
                }
            }
        }
        return null;
    }

    async runOnLoad(args: OnLoadArgs): Promise<{ contents?: string; loader?: string } | null> {
        const sortedHooks = [...this.onLoadHooks].sort((a, b) => {
            const score = (o?: 'pre' | 'post') => o === 'pre' ? -1 : o === 'post' ? 1 : 0;
            return score(a.order) - score(b.order);
        });

        let currentResult: { contents?: string, loader?: string } | null = null;
        let pipelineContents: string | undefined = undefined;

        for (const hook of sortedHooks) {
            if (hook.filter.test(args.path)) {
                const hookArgs: OnLoadArgs = { ...args, previousContents: pipelineContents };
                try {
                    const result = await hook.callback(hookArgs);
                    if (result) {
                        if (result.contents !== undefined) {
                            pipelineContents = result.contents;
                        }
                        currentResult = { 
                            ...(currentResult || {}), 
                            ...result,
                            contents: pipelineContents! 
                        };
                    }
                } catch (e) {
                    console.error(`Error in onLoad hook from ${hook.pluginName}:`, e);
                }
            }
        }
        return currentResult;
    }

    getBuilder(pluginName: string): PluginBuilder {
        return {
            onResolve: (filter, callback, options) => {
                const perfCallback: OnResolveCallback = async (args) => {
                    const start = performance.now();
                    const res = await callback(args);
                    const dur = performance.now() - start;
                    if (dur > 100) console.warn(`[Performance] ${pluginName} onResolve took ${dur.toFixed(2)}ms`);
                    return res;
                };
                this.registerOnResolve(filter, perfCallback, pluginName, options?.order);
            },
            onLoad: (filter, callback, options) => {
                const perfCallback: OnLoadCallback = async (args) => {
                    const start = performance.now();
                    const res = await callback(args);
                    const dur = performance.now() - start;
                    if (dur > 100) console.warn(`[Performance] ${pluginName} onLoad took ${dur.toFixed(2)}ms`);
                    return res;
                };
                this.registerOnLoad(filter, perfCallback, pluginName, options?.order);
            }
        };
    }

    toBunPlugin(): BunPlugin {
        return {
            name: "BunPluginManagerBridge",
            setup: (build) => {
                 // Use a catch-all filter to allow dynamic hook registration
                 build.onResolve({ filter: /.*/ }, async (args) => {
                     return this.runOnResolve(args);
                 });
  
                 build.onLoad({ filter: /.*/ }, async (args) => {
                     const res = await this.runOnLoad(args);
                     if (res && res.contents !== undefined) {
                          return {
                              contents: res.contents,
                              loader: res.loader as any
                          };
                     }
                     return undefined;
                 });
            }
        };
    }
}
