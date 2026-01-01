
import type { IPlugin } from "../types";
import * as semver from "semver";
import { logger } from "../logger";

export class DependencyManager {
    /**
     * Topologically sort plugins based on dependencies.
     * Throws if circular dependency detected.
     */
    resolveLoadOrder(plugins: IPlugin[]): IPlugin[] {
        const g = new Map<string, string[]>();
        const pluginMap = new Map<string, IPlugin>();

        // Initialize graph
        for (const p of plugins) {
            pluginMap.set(p.name, p);
            g.set(p.name, []);
        }

        // Build edges
        for (const p of plugins) {
            if (p.dependencies) {
                for (const depName of Object.keys(p.dependencies)) {
                    if (pluginMap.has(depName)) {
                        g.get(p.name)!.push(depName);
                    } else {
                        // We skip missing dependencies here as strict validation might happen elsewhere, 
                        // or we throw if strictness is required during sort.
                        // For this implementation, we throw if dependency is declared but not present in the set to sort.
                        // However, commonly we might only be sorting a subset. 
                        // Let's assume strictness for the provided set.
                        // Actually, looking at original code: it throws if not enabled or found.
                        
                        // We might want to allow sorting even if deps are external (already loaded).
                        // But here we received `plugins` as "plugins to load".
                        // Logic refactor: If dependent is not in list, maybe it is already loaded?
                        // The original code checked `this.plugins.has(depName)` (already loaded).
                        // We'll trust the caller to handle external checks or we need to pass `loadedPlugins` map.
                        // For pure topological sort of a batch, we just sort the batch.
                        // If A depends on B, and B is not in batch, we assume B is effectively "root" relative to this batch 
                        // (i.e., we don't add an edge to it within this graph).
                        logger.getLogger("DependencyManager").warn(`Plugin ${p.name} depends on missing plugin: ${depName}`);
                    }
                }
            }
        }

        // Output logic: Dependency -> Dependent
        // Using Kahn's algorithm or similar.
        
        const inDegree = new Map<string, number>();
        for (const name of Array.from(pluginMap.keys())) inDegree.set(name, 0);

        const adj = new Map<string, string[]>();
        for (const name of Array.from(pluginMap.keys())) adj.set(name, []);

        for (const [pName, deps] of Array.from(g.entries())) {
            for (const depName of deps) {
                // depName -> pName
                if (adj.has(depName)) {
                    adj.get(depName)!.push(pName);
                    inDegree.set(pName, (inDegree.get(pName) || 0) + 1);
                }
            }
        }

        const queue: string[] = [];
        for (const [name, deg] of Array.from(inDegree.entries())) {
            if (deg === 0) queue.push(name);
        }

        const sorted: IPlugin[] = [];
        while (queue.length > 0) {
            const u = queue.shift()!;
            sorted.push(pluginMap.get(u)!);

            for (const v of adj.get(u) || []) {
                inDegree.set(v, inDegree.get(v)! - 1);
                if (inDegree.get(v) === 0) {
                    queue.push(v);
                }
            }
        }

        if (sorted.length !== plugins.length) {
            throw new Error("Circular dependency detected in plugins.");
        }

        return sorted;
    }

    validateDependencies(plugin: IPlugin, loadedPlugins: Map<string, IPlugin>): void {
        if (plugin.dependencies) {
            for (const [depName, requiredVersion] of Object.entries(plugin.dependencies)) {
                const depPlugin = loadedPlugins.get(depName);
                if (!depPlugin) {
                    throw new Error(`Plugin ${plugin.name} requires missing dependency: ${depName} (${requiredVersion})`);
                }
                // Version check using semver
                if (!semver.satisfies(depPlugin.version, requiredVersion)) {
                    throw new Error(`Plugin ${plugin.name} requires dependency ${depName} version ${requiredVersion}, but found ${depPlugin.version}`);
                }
            }
        }
    }
}
