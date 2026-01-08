
import { 
    type OnResolveCallback, 
    type OnLoadCallback, 
    type OnResolveArgs, 
    type OnLoadArgs, 
    type HookRegistry,
    type PluginBuilder,
    HookOrder,
    HookType
} from "../types";
import type { BunPlugin, Loader } from "bun";
import { logger } from "../logger";

export class HooksManager {
    private onResolveHooks: HookRegistry<OnResolveCallback>[] = [];
    private onLoadHooks: HookRegistry<OnLoadCallback>[] = [];
    private onStartHooks: { callback: () => void | Promise<void>, pluginName: string }[] = [];

    registerOnResolve(filter: RegExp, callback: OnResolveCallback, pluginName: string, order?: HookOrder) {
        // Performance wrapper could be applied here or by caller.
        // For simplicity, we store as is.
        this.onResolveHooks.push({ filter, callback, pluginName, order });
    }

    registerOnLoad(filter: RegExp, callback: OnLoadCallback, pluginName: string, order?: HookOrder) {
        this.onLoadHooks.push({ filter, callback, pluginName, order });
    }

    registerOnStart(callback: () => void | Promise<void>, pluginName: string) {
        this.onStartHooks.push({ callback, pluginName });
    }

    getHookCount(type: HookType): number {
        if (type === HookType.ON_RESOLVE) return this.onResolveHooks.length;
        if (type === HookType.ON_LOAD) return this.onLoadHooks.length;
        if (type === HookType.ON_START) return this.onStartHooks.length;
        return 0;
    }

    cleanup(pluginName: string) {
        this.onResolveHooks = this.onResolveHooks.filter(h => h.pluginName !== pluginName);
        this.onLoadHooks = this.onLoadHooks.filter(h => h.pluginName !== pluginName);
        this.onStartHooks = this.onStartHooks.filter(h => h.pluginName !== pluginName);
    }

    async runOnStart() {
        for (const hook of this.onStartHooks) {
            try {
                await hook.callback();
            } catch (e) {
                logger.getLogger("HooksManager").error(`Error in onStart hook from ${hook.pluginName}:`, e);
            }
        }
    }

    async runOnResolve(args: OnResolveArgs): Promise<{ path: string; namespace?: string } | null> {
        const sortedHooks = [...this.onResolveHooks].sort((a, b) => {
            const score = (o?: HookOrder) => o === HookOrder.PRE ? -1 : o === HookOrder.POST ? 1 : 0;
            return score(a.order) - score(b.order);
        });

        for (const hook of sortedHooks) {
            if (hook.filter.test(args.path)) {
                try {
                     const result = await hook.callback(args);
                     if (result) return result;
                } catch (e) {
                    logger.getLogger("HooksManager").error(`Error in onResolve hook from ${hook.pluginName}:`, e);
                }
            }
        }
        return null;
    }

    async runOnLoad(args: OnLoadArgs): Promise<{ contents?: string; loader?: string } | null> {
        const sortedHooks = [...this.onLoadHooks].sort((a, b) => {
            const score = (o?: HookOrder) => o === HookOrder.PRE ? -1 : o === HookOrder.POST ? 1 : 0;
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
                    logger.getLogger("HooksManager").error(`Error in onLoad hook from ${hook.pluginName}:`, e);
                }
            }
        }
        return currentResult;
    }

    getBuilder(pluginName: string, config: Record<string, any>): PluginBuilder {
        return {
            config,
            onStart: (callback: () => void | Promise<void>) => {
                this.registerOnStart(callback, pluginName);
            },
            onResolve: (filterOrConfig: RegExp | { filter: RegExp; namespace?: string }, callback: OnResolveCallback, options?: { order?: HookOrder }) => {
                const filter = filterOrConfig instanceof RegExp ? filterOrConfig : filterOrConfig.filter;
                const perfCallback: OnResolveCallback = async (args) => {
                    const start = performance.now();
                    const res = await callback(args);
                    const dur = performance.now() - start;
                    if (dur > 100) logger.getLogger("HooksManager").warn(`[Performance] ${pluginName} onResolve took ${dur.toFixed(2)}ms`);
                    return res;
                };
                this.registerOnResolve(filter, perfCallback, pluginName, options?.order);
            },
            onLoad: (filterOrConfig: RegExp | { filter: RegExp; namespace?: string }, callback: OnLoadCallback, options?: { order?: HookOrder }) => {
                const filter = filterOrConfig instanceof RegExp ? filterOrConfig : filterOrConfig.filter;
                const perfCallback: OnLoadCallback = async (args) => {
                    const start = performance.now();
                    const res = await callback(args);
                    const dur = performance.now() - start;
                    if (dur > 100) logger.getLogger("HooksManager").warn(`[Performance] ${pluginName} onLoad took ${dur.toFixed(2)}ms`);
                    return res;
                };
                this.registerOnLoad(filter, perfCallback, pluginName, options?.order);
            }
        } as PluginBuilder;
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
                              loader: res.loader as Loader
                          };
                     }
                     return undefined;
                 });
            }
        };
    }
}
