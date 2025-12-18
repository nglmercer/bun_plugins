
import type { PluginContext, IPlugin, AppEvents, EventCallback } from "../types";
import type { PluginManager } from "../PluginManager";
import type { ResourceManager } from "./ResourceManager";
import { type IPluginStorage } from "../types";

export function createPluginContext(
    manager: PluginManager,
    plugin: IPlugin,
    resources: ResourceManager,
    storage: IPluginStorage,
    config: any
): PluginContext {
    
    // We get the resource container directly.
    const pluginResources = resources.get(plugin.name);
    if (!pluginResources) throw new Error("Resources not initialized for plugin");

    const getPermission = (perm: 'network' | 'filesystem' | 'env') => {
        return plugin.permissions?.includes(perm);
    };

    const checkPermission = (perm: 'network' | 'filesystem' | 'env') => {
        if (!getPermission(perm)) {
            throw new Error(`AccessDenied: Plugin '${plugin.name}' requires '${perm}' permission.`);
        }
    };

    return {
        manager: manager,
        storage,
        config,
        // Legacy support
        emit: <K extends keyof AppEvents>(event: K, payload: AppEvents[K]) => manager.emit(event, payload),
        on: <K extends keyof AppEvents>(event: K, callback: EventCallback<AppEvents[K]>) => manager.on(event, callback),
        
        events: {
            emit: <K extends keyof AppEvents>(event: K, payload: AppEvents[K]) => manager.emit(event, payload),
            on: <K extends keyof AppEvents>(event: K, callback: EventCallback<AppEvents[K]>) => manager.on(event, callback)
        },

        getPlugin: (name: string) => {
            const p = manager.getPlugin(name);
            return p?.getSharedApi ? p.getSharedApi() : undefined;
        },
        log: {
            info: (msg, ...args) => console.log(`[${plugin.name}] info: ${msg}`, ...args),
            warn: (msg, ...args) => console.warn(`[${plugin.name}] warn: ${msg}`, ...args),
            error: (msg, ...args) => console.error(`[${plugin.name}] error: ${msg}`, ...args),
        },
        createWorker: (url, options) => {
            // Use the manager's worker factory to allow proper mocking in tests
            const workerFactory = manager.getWorkerFactory();
            const w = workerFactory(url, options);
            
            w.addEventListener?.("close", () => {
               // Cleanup from resources if closed manually? 
               // For now just removing from array is hard without id.
               // We just track it for shutdown.
            });
            w.addEventListener?.("error", (err: ErrorEvent) => {
                console.error(`[${plugin.name}] Worker error:`, err.message); 
            });

            resources.get(plugin.name)?.workers.push(w);
            return w;
        },
        setTimeout: (callback: (...args: any[]) => void, delay?: number, ...args: any[]) => {
             const id = setTimeout(callback, delay, ...args);
             resources.get(plugin.name)?.timers.push({ id, type: 'timeout' });
             return id;
        },
        setInterval: (callback: (...args: any[]) => void, delay?: number, ...args: any[]) => {
             const id = setInterval(callback, delay, ...args);
             resources.get(plugin.name)?.timers.push({ id, type: 'interval' });
             return id;
        },
        clearTimeout: (id: number | Timer) => {
             clearTimeout(id as any);
             // Removing from list logic omitted for speed, cleanup handles remainder
        },
        clearInterval: (id: number | Timer) => {
             clearInterval(id as any);
        },
        network: {
            fetch: (input, init) => {
                checkPermission('network');
                if (plugin.allowedDomains) {
                    const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
                    let url: URL | undefined;
                    try {
                        url = new URL(urlStr);
                    } catch (e) { }

                    if (url) {
                        const allowed = plugin.allowedDomains.some(d => url!.hostname === d || url!.hostname.endsWith('.' + d));
                        if (!allowed) {
                            throw new Error(`AccessDenied: Domain '${url!.hostname}' is not in allowedDomains for plugin '${plugin.name}'.`);
                        }
                    }
                }
                return fetch(input, init);
            }
        },
        file: (path: string) => {
            checkPermission('filesystem');
            return Bun.file(path);
        },
        get env() {
            checkPermission('env');
            return new Proxy(process.env, {
                get(target, prop) { return Reflect.get(target, prop); },
                set() { throw new Error("Plugins cannot modify environment variables."); }
            });
        }
    };
}
