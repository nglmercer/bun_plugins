
import { parentPort, workerData } from "worker_threads";
import { type IPlugin, type PluginContext } from "../types";

// This is the "Shell" that runs inside the Worker.
// It receives the plugin path, loads it, and executes onLoad.
// It creates a proxy Context that talks back to the main thread via postMessage.

if (!parentPort) throw new Error("WorkerRunner must be spawned as a Worker");

const { pluginPath, pluginName } = workerData;

// Map to store callbacks for hooks and events
const hookCallbacks = new Map<string, Function>();
const localEventListeners = new Map<string, Set<Function>>();

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
        parentPort!.postMessage({ type: 'RPC_CALL', id, method, args });
    });
}

async function run() {
    // Setup message handler for incoming requests from Main Thread
    parentPort!.on('message', async (msg: any) => {
        if (msg.type === 'HOOK_CALL') {
            const { id, args, requestId } = msg;
            const callback = hookCallbacks.get(id);
            if (callback) {
                try {
                    const result = await callback(args);
                    parentPort!.postMessage({ type: 'HOOK_RESULT', requestId, result });
                } catch (e: any) {
                    parentPort!.postMessage({ type: 'HOOK_ERROR', requestId, error: e.message });
                }
            } else {
                 parentPort!.postMessage({ type: 'HOOK_ERROR', requestId, error: "Hook not found" });
            }
        } 
        else if (msg.type === 'EVENT_EMIT') {
            const { event, payload } = msg;
            const listeners = localEventListeners.get(event);
            if (listeners) {
                for (const cb of listeners) {
                    try {
                        await cb(payload);
                    } catch (e) {
                        console.error(`[Worker:${pluginName}] Error in event listener for ${event}:`, e);
                    }
                }
            }
        }
    });

    try {
        console.log(`[Worker:${pluginName}] Loading plugin from ${pluginPath}...`);
        
        // Dynamic Import of the Plugin
        const module = await import(pluginPath);
        // Find the plugin object (default export or named export compliant with IPlugin)
        let plugin: IPlugin | undefined = undefined;
        
        if (module.default && module.default.name) plugin = module.default;
        else {
             // Search for first exported object that looks like a plugin
             const candidate = Object.values(module).find((exp: any) => exp && exp.name && exp.onLoad);
             if (candidate) plugin = candidate as IPlugin;
        }

        if (!plugin) {
            throw new Error(`[Worker:${pluginName}] No valid plugin found in ${pluginPath}`);
        }

        // Create Proxy Context
        const contextProxy: PluginContext = {
            manager: {} as any, // Manager is not accessible remotely directly
            config: plugin.defaultConfig || {}, // Initial config (todo: fetch actual valid config)
            
            storage: {
                get: (key) => rpc('storage:get', key),
                set: (key, val) => rpc('storage:set', key, val),
                delete: (key) => rpc('storage:delete', key),
                clear: () => rpc('storage:clear')
            },
            
            emit: (event, payload) => rpc('events:emit', event, payload),
            
            on: (event, cb) => {
                 const evtName = event as string;
                 if (!localEventListeners.has(evtName)) {
                     localEventListeners.set(evtName, new Set());
                     // Register intention to listen with main thread
                     rpc('events:on', evtName); 
                 }
                 localEventListeners.get(evtName)!.add(cb);
            },
            
            events: {
                emit: (event, payload) => rpc('events:emit', event, payload),
                on: (event, cb) => contextProxy.on(event, cb)
            },
            
            getPlugin: () => undefined, // Hard to access other plugins synchronously
            
            log: {
                info: (msg, ...args) => rpc('log', 'info', msg, ...args),
                warn: (msg, ...args) => rpc('log', 'warn', msg, ...args),
                error: (msg, ...args) => rpc('log', 'error', msg, ...args),
            },
            
            createWorker: () => { throw new Error("Nested workers not supported in isolation yet") },
            
            // wrappers
            network: {
                fetch: async (input, init) => {
                     // Permission check via RPC
                     await rpc('perm:check', 'network');
                     return fetch(input, init);
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
             const builderVal = {
                 onResolve: (filter: RegExp, callback: Function, options?: any) => {
                     const hookId = Math.random().toString(36).substring(7);
                     hookCallbacks.set(hookId, callback);
                     // We need to pass the filter source string
                     rpc('hooks:register', 'onResolve', { 
                         filter: filter.source, 
                         pluginName, 
                         id: hookId,
                         options
                     });
                 },
                 onLoad: (filter: RegExp, callback: Function, options?: any) => {
                     const hookId = Math.random().toString(36).substring(7);
                     hookCallbacks.set(hookId, callback);
                     rpc('hooks:register', 'onLoad', {
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
            parentPort!.postMessage({ type: 'LOAD_SUCCESS' });
        }
        
        // Run onStarted
        if (plugin.onStarted) {
            await plugin.onStarted();
        }

    } catch (e: any) {
        console.error(`[Worker:${pluginName}] Error:`, e);
        parentPort!.postMessage({ type: 'LOAD_ERROR', error: e.message || String(e) });
    }
}

run();
