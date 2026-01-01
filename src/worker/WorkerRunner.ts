
import { parentPort, workerData } from "worker_threads";
import { 
    type IPlugin, 
    type PluginContext,
    type IPluginManager,
    type PluginBuilder,
    WorkerMessageType, 
    PluginPermission, 
    RPCMethod,
    HookType
} from "../types";
import { errorParser } from "../utils/errorParser";
// This is the "Shell" that runs inside the Worker.
// It receives the plugin path, loads it, and executes onLoad.
// It creates a proxy Context that talks back to the main thread via postMessage.

if (!parentPort) throw new Error("WorkerRunner must be spawned as a Worker");

const { pluginPath, pluginName } = workerData;

// Map to store callbacks for hooks and events
const hookCallbacks = new Map<string, Function>();
const localEventListeners = new Map<string, Set<Function>>();
let currentConfig: Record<string, any> = {};

// Simple RPC Helper
function rpc(method: string, ...args: any[]): Promise<any> {
    return new Promise((resolve, reject) => {
        const id = Math.random().toString(36).substring(7);
        
        const handler = (msg: any) => {
            if (msg.id === id) {
                parentPort!.off('message', handler);
                if (msg.error) reject(new Error(msg.error));
                else resolve(msg.result);
            }
        };
        
        parentPort!.on('message', handler);
        parentPort!.postMessage({ type: WorkerMessageType.RPC_CALL, id, method, args });
    });
}

async function run() {
    let plugin: IPlugin | undefined = undefined;

    // Setup message handler for incoming requests from Main Thread
    parentPort!.on('message', async (msg: any) => {
        if (msg.type === WorkerMessageType.HOOK_CALL) {
            const { id, args, requestId } = msg;
            const callback = hookCallbacks.get(id);
            if (callback) {
                try {
                    const result = await callback(args);
                    parentPort!.postMessage({ type: WorkerMessageType.HOOK_RESULT, requestId, result });
                } catch (e) {
                    const error = errorParser(e, `Error in hook ${id}`);
                    parentPort!.postMessage({ type: WorkerMessageType.HOOK_ERROR, requestId, error: error.message });
                }
            } else {
                 parentPort!.postMessage({ type: WorkerMessageType.HOOK_ERROR, requestId, error: "Hook not found" });
            }
        } 
        else if (msg.type === WorkerMessageType.EVENT_EMIT) {
            const { event, payload } = msg;
            const listeners = localEventListeners.get(event);
            if (listeners) {
                for (const cb of listeners) {
                    try {
                        await cb(payload);
                    } catch (e) {
                        const error = errorParser(e, `Error in event listener for ${event}`);
                        console.error(`[Worker:${pluginName}] Error in event listener for ${event}:`, error.message);
                    }
                }
            }
        }
        else if (msg.type === WorkerMessageType.UNLOAD) {
            console.log(`[Worker:${pluginName}] Received UNLOAD signal.`);
            if (plugin && plugin.onUnload) {
                try {
                    await plugin.onUnload();
                } catch (e) {
                    console.error(`[Worker:${pluginName}] Error during onUnload:`, e);
                }
            }
            process.exit(0);
        }
    });

    try {
        console.log(`[Worker:${pluginName}] Loading plugin from ${pluginPath}...`);
        
        // Dynamic Import of the Plugin
        const module = await import(pluginPath);
        
        // Find the plugin object (default export or named export compliant with IPlugin)
        const findPlugin = (exp: any): any => {
            if (!exp) return null;
            // Case 1: Instance of IPlugin
            if (exp.name && typeof exp.onLoad === 'function') return exp;
            // Case 2: Class/Constructor of IPlugin
            if (typeof exp === 'function' && exp.prototype) {
                try {
                    const instance = new exp();
                    if (instance.name && typeof instance.onLoad === 'function') return instance;
                } catch (e) {
                    // Not a parameterless constructor or not a plugin
                }
            }
            return null;
        };

        plugin = findPlugin(module.default);
        if (!plugin) {
             // Search for first exported object that looks like a plugin or a plugin class
             for (const exp of Object.values(module)) {
                 const candidate = findPlugin(exp);
                 if (candidate) {
                     plugin = candidate;
                     break;
                 }
             }
        }

        if (!plugin) {
            throw new Error(`[Worker:${pluginName}] No valid plugin found in ${pluginPath}. Ensure you export an instance or class that implements IPlugin.`);
        }

        // Fetch actual config from host
        currentConfig = await rpc(RPCMethod.ConfigGet) || plugin.defaultConfig || {};

        // Send Manifest immediately after load for security context initialization in host
        parentPort!.postMessage({
            type: WorkerMessageType.MANIFEST,
            metadata: {
                name: plugin.name,
                version: plugin.version,
                description: plugin.description,
                author: plugin.author,
                permissions: plugin.permissions,
                allowedDomains: plugin.allowedDomains
            }
        });

        // Create Proxy Context
        const contextProxy: PluginContext = {
            manager: {} as IPluginManager, 
            get config() {
                // Return a proxy that can potentially be async or just fetch once and update?
                // For now, since config needs to be sync, we keep a local copy and update it.
                return currentConfig;
            },
            
            storage: {
                get: (key) => rpc(RPCMethod.StorageGet, key),
                set: (key, val) => rpc(RPCMethod.StorageSet, key, val),
                delete: (key) => rpc(RPCMethod.StorageDelete, key),
                clear: () => rpc(RPCMethod.StorageClear),
                reload: () => rpc(RPCMethod.StorageReload)
            },
            
            emit: (event, payload) => rpc(RPCMethod.EventsEmit, event, payload),
            
            on: (event, cb) => {
                 const evtName = event as string;
                 if (!localEventListeners.has(evtName)) {
                     localEventListeners.set(evtName, new Set());
                     // Register intention to listen with main thread
                     rpc(RPCMethod.EventsOn, evtName); 
                 }
                 localEventListeners.get(evtName)!.add(cb);
            },
            
            events: {
                emit: (event, payload) => rpc(RPCMethod.EventsEmit, event, payload),
                on: (event, cb) => contextProxy.on(event, cb)
            },
            
            getPlugin: (name: string) => rpc(RPCMethod.ManagerGetPlugin, name),
            
            log: {
                info: (msg, ...args) => rpc(RPCMethod.Log, 'info', msg, ...args),
                warn: (msg, ...args) => rpc(RPCMethod.Log, 'warn', msg, ...args),
                error: (msg, ...args) => rpc(RPCMethod.Log, 'error', msg, ...args),
            },
            
            createWorker: () => { throw new Error("Nested workers not supported in isolation yet") },
            
            // wrappers
            network: {
                fetch: async (input, init) => {
                     const res = await rpc(RPCMethod.NetworkFetch, input, init);
                     // Reconstruct a subset of Response
                     return {
                         status: res.status,
                         statusText: res.statusText,
                         ok: res.status >= 200 && res.status < 300,
                         headers: new Headers(res.headers),
                         text: async () => res.body,
                         json: async () => JSON.parse(res.body)
                     } as Response;
                }
            },
            file: (path) => {
                 throw new Error("File access restricted in worker mode");
            },
            env: new Proxy({}, {
                get: (_, prop) => {
                     // We should pass env in workerData or allow async fetch?
                     // Verify logic: environment variables are process-level, worker might share them?
                     // For now, allow reading process.env but access is gated by main thread logic (which we don't effectively block here easily without proxies).
                     return process.env[prop as string];
                }
            }),
            
            setTimeout: setTimeout,
            setInterval: setInterval,
            clearTimeout: clearTimeout,
            clearInterval: clearInterval
        };

        // Run setup (Hooks)
        if (plugin.setup) {
             const builderVal: PluginBuilder = {
                 config: currentConfig,
                 onStart: (callback: () => void | Promise<void>) => {
                     const hookId = Math.random().toString(36).substring(7);
                     hookCallbacks.set(hookId, callback);
                     rpc(RPCMethod.HooksRegister, HookType.ON_START, {
                         filter: /.*/.source,
                         pluginName,
                         id: hookId
                     });
                 },
                 onResolve: (filterOrConfig: RegExp | { filter: RegExp; namespace?: string }, callback: any, options?: any) => {
                     const filter = filterOrConfig instanceof RegExp ? filterOrConfig : filterOrConfig.filter;
                     const hookId = Math.random().toString(36).substring(7);
                     hookCallbacks.set(hookId, callback);
                     rpc(RPCMethod.HooksRegister, HookType.ON_RESOLVE, { 
                         filter: filter.source, 
                         pluginName, 
                         id: hookId,
                         options
                     });
                 },
                onLoad: (filterOrConfig: RegExp | { filter: RegExp; namespace?: string }, callback: any, options?: any) => {
                     const filter = filterOrConfig instanceof RegExp ? filterOrConfig : filterOrConfig.filter;
                     const hookId = Math.random().toString(36).substring(7);
                     hookCallbacks.set(hookId, callback);
                     rpc(RPCMethod.HooksRegister, HookType.ON_LOAD, {
                         filter: filter.source,
                         pluginName,
                         id: hookId,
                         options
                     });
                 }
             };
             await plugin.setup(builderVal);
        }

        // Run onLoad
        if (plugin.onLoad) {
            await plugin.onLoad(contextProxy);
            parentPort!.postMessage({ 
                type: WorkerMessageType.LOAD_SUCCESS, 
                metadata: {
                    name: plugin.name,
                    version: plugin.version,
                    description: plugin.description,
                    author: plugin.author,
                    permissions: plugin.permissions,
                    allowedDomains: plugin.allowedDomains
                }
            });
        }
        
        // Listen for START_UP signal to run onStarted
        parentPort!.on('message', async (msg: any) => {
            if (msg.type === WorkerMessageType.START_UP) {
                if (plugin && plugin.onStarted) {
                    try {
                        await plugin.onStarted();
                    } catch (e) {
                        console.error(`[Worker:${pluginName}] Error in onStarted:`, e);
                    }
                }
            }
        });

    } catch (e) {
        const error = errorParser(e, `[Worker:${pluginName}] Error:`);
        console.error(error.message);
        parentPort!.postMessage({ type: WorkerMessageType.LOAD_ERROR, error: error.message });
    }
}

run();
