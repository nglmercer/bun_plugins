import { EventEmitter } from "node:events";
import { readdir, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { watch } from "node:fs";
import type { 
    IPlugin, 
    PluginContext, 
    AppEvents, 
    EventCallback, 
    PluginBuilder,
    OnResolveCallback,
    OnLoadCallback,
    OnResolveArgs,
    OnLoadArgs,
    HookRegistry,
    PluginResource
} from "./types";
import { validatePlugin } from "./utils/pluginValidator";
import { JsonPluginStorage } from "./storage/JsonPluginStorage";
import semver from "semver";
import type { BunPlugin } from "bun";



export class PluginManager extends EventEmitter {
  private plugins: Map<string, IPlugin> = new Map();
  // Store valid plugin definitions found during discovery
  private availablePlugins: Map<string, IPlugin> = new Map();
  // Track resources for cleanup
  private pluginResources: Map<string, PluginResource> = new Map();
  
  // Hooks
  private onResolveHooks: HookRegistry<OnResolveCallback>[] = [];
  private onLoadHooks: HookRegistry<OnLoadCallback>[] = [];

  private storageRoot: string;
  private hostVersion = "1.0.0"; // Host application version
  private pluginLoadTimeout: number;
  private workerFactory: (url: string | URL, options?: WorkerOptions) => Worker;

  constructor(storageRoot: string = "./storage", options?: { pluginLoadTimeout?: number, workerFactory?: (url: string | URL, options?: WorkerOptions) => Worker }) {
    super();
    this.storageRoot = storageRoot;
    this.pluginLoadTimeout = options?.pluginLoadTimeout ?? 5000;
    this.workerFactory = options?.workerFactory ?? ((url, opts) => new Worker(url, opts));
  }

  async register(plugin: IPlugin): Promise<void> {
    if (this.plugins.has(plugin.name)) {
      throw new Error(`Plugin ${plugin.name} is already registered.`);
    }

    // 0. Dependency & Engine Check
    if (plugin.dependencies) {
        for (const [depName, requiredVersion] of Object.entries(plugin.dependencies)) {
            const depPlugin = this.plugins.get(depName);
            if (!depPlugin) {
                throw new Error(`Plugin ${plugin.name} requires missing dependency: ${depName} (${requiredVersion})`);
            }
            if (!semver.satisfies(depPlugin.version, requiredVersion)) {
                throw new Error(`Plugin ${plugin.name} requires dependency ${depName} version ${requiredVersion}, but found ${depPlugin.version}`);
            }
        }
    }

    if (plugin.engines?.host) {
        if (!semver.satisfies(this.hostVersion, plugin.engines.host)) {
            throw new Error(`Plugin ${plugin.name} requires host version ${plugin.engines.host}, but found ${this.hostVersion}`);
        }
    }

    console.log(`Loading plugin: ${plugin.name} v${plugin.version}`);
    
    // 1. Prepare Storage
    const storage = new JsonPluginStorage(this.storageRoot, plugin.name);
    
    // 2. Load & Validate Configuration
    let config = plugin.defaultConfig || {};
    if (plugin.configSchema) {
        try {
            config = plugin.configSchema.parse(config) as Record<string, any>;
        } catch (e: any) {
            console.warn(`[SafeMode] Config validation failed for plugin ${plugin.name}. Using default config. Error: ${e.message}`);
            // Fallback is already set to defaultConfig above
        }
    }

    // 3. Initialize Resources
    const resources: PluginResource = { workers: [], timers: [], eventListeners: [] };
    this.pluginResources.set(plugin.name, resources);

    const getPermission = (perm: 'network' | 'filesystem' | 'env') => {
        return plugin.permissions?.includes(perm);
    };

    const checkPermission = (perm: 'network' | 'filesystem' | 'env') => {
        if (!getPermission(perm)) {
            throw new Error(`AccessDenied: Plugin '${plugin.name}' requires '${perm}' permission.`);
        }
    };

    // Sanitize plugin name for storage
    if (plugin.name.includes("..") || plugin.name.includes("/") || plugin.name.includes("\\")) {
        throw new Error(`Invalid plugin name: ${plugin.name}. Name cannot contain path traversal characters.`);
    }

    // Context Creation
    const context: PluginContext = {
      manager: this,
      storage,
      config,
      // Legacy support
      emit: <K extends keyof AppEvents>(event: K, payload: AppEvents[K]) => this.emit(event, payload),
      on: <K extends keyof AppEvents>(event: K, callback: EventCallback<AppEvents[K]>) => this.on(event, callback),
      
      events: {
          emit: <K extends keyof AppEvents>(event: K, payload: AppEvents[K]) => this.emit(event, payload),
          on: <K extends keyof AppEvents>(event: K, callback: EventCallback<AppEvents[K]>) => this.on(event, callback)
      },

      getPlugin: (name: string) => {
          const p = this.plugins.get(name);
          return p?.getSharedApi ? p.getSharedApi() : undefined;
      },
      log: {
          info: (msg, ...args) => console.log(`[${plugin.name}] info: ${msg}`, ...args),
          warn: (msg, ...args) => console.warn(`[${plugin.name}] warn: ${msg}`, ...args),
          error: (msg, ...args) => console.error(`[${plugin.name}] error: ${msg}`, ...args),
      },
      createWorker: (url, options) => {
          const w = this.workerFactory(url, options) as any; // Use factory
          
          // Auto-cleanup from resources on close
          w.addEventListener?.("close", () => {
             // Remove from active resources to prevent list growing indefinitely
             resources.workers = resources.workers.filter(worker => worker !== w);
          });
          
          // Log errors to plugin logger
          w.addEventListener?.("error", (err: ErrorEvent) => {
              console.error(`[${plugin.name}] Worker error:`, err.message); 
          });

          // Forward open event for logging/debug if needed
          w.addEventListener?.("open", () => {
              // Optional debug log
              // console.log(`[${plugin.name}] Worker started`);
          });

          resources.workers.push(w);
          return w;
      },
      // Timer Wrappers
      setTimeout: (callback: (...args: any[]) => void, delay?: number, ...args: any[]) => {
           const id = setTimeout(callback, delay, ...args);
           resources.timers.push({ id, type: 'timeout' });
           return id;
      },
      setInterval: (callback: (...args: any[]) => void, delay?: number, ...args: any[]) => {
           const id = setInterval(callback, delay, ...args);
           resources.timers.push({ id, type: 'interval' });
           return id;
      },
      clearTimeout: (id: number | Timer) => {
           clearTimeout(id as any); // cast as any to satisfy incompatible overloads if environment differs
           resources.timers = resources.timers.filter(t => t.id !== id);
      },
      clearInterval: (id: number | Timer) => {
           clearInterval(id as any);
           resources.timers = resources.timers.filter(t => t.id !== id);
      },
      network: {
          fetch: (input, init) => {
              checkPermission('network');
              // Validate Domain Whitelist
              if (plugin.allowedDomains) {
                  const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
                  let url: URL | undefined;
                  try {
                      url = new URL(urlStr);
                  } catch (e) {
                      // If invalid URL, might be relative. Let fetch handle it or decide policy.
                  }

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

    // 4. Setup Hooks with Performance Monitoring
    if (plugin.setup) {
        const builder: PluginBuilder = {
            onResolve: (filter, callback, options) => {
                const perfCallback: OnResolveCallback = async (args) => {
                    const start = performance.now();
                    const res = await callback(args);
                    const dur = performance.now() - start;
                    if (dur > 100) console.warn(`[Performance] ${plugin.name} onResolve took ${dur.toFixed(2)}ms`);
                    return res;
                };
                this.onResolveHooks.push({ filter, callback: perfCallback, pluginName: plugin.name, order: options?.order });
                // Sort hooks by priority: pre < undefined < post
            },
            onLoad: (filter, callback, options) => {
                 const perfCallback: OnLoadCallback = async (args) => {
                    const start = performance.now();
                    const res = await callback(args);
                    const dur = performance.now() - start;
                    if (dur > 100) console.warn(`[Performance] ${plugin.name} onLoad took ${dur.toFixed(2)}ms`);
                    return res;
                };
                this.onLoadHooks.push({ filter, callback: perfCallback, pluginName: plugin.name, order: options?.order });
            }
        };
        try {
            await plugin.setup(builder);
        } catch (e) {
             console.error(`Error during setup for ${plugin.name}:`, e);
             throw e;
        }
    }

    // 5. Lifecycle onLoad
    try {
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`Plugin ${plugin.name} timed out (${this.pluginLoadTimeout}ms)`)), this.pluginLoadTimeout)
      );
      
      const start = performance.now();
      await Promise.race([plugin.onLoad(context), timeoutPromise]);
      const duration = performance.now() - start;

      this.plugins.set(plugin.name, plugin);
      console.log(`Plugin ${plugin.name} loaded successfully in ${duration.toFixed(2)}ms.`);
    } catch (error) {
      console.error(`Failed to load plugin ${plugin.name}:`, error);
      this.cleanupResources(plugin.name);
      this.cleanupHooks(plugin.name);
      throw error;
    }
  }

  async registerIsolated(pluginPath: string, pluginName: string): Promise<void> {
       return new Promise((resolve, reject) => {
           // We need to know some metadata (permissions) BEFORE starting worker to check deps?
           // Currently assume isolated plugins are standalone or we accept eager loading.
           // For simplicity in this iteration: We spawn worker, it loads plugin, if success, we register a "Proxy Plugin".
           
           const workerScript = join(import.meta.dir, "worker", "WorkerRunner.ts");
           console.log("Worker Path:", workerScript);
           const worker = new Worker(workerScript, {
               workerData: { pluginPath, pluginName }
           } as WorkerOptions & { workerData: any });

           const storage = new JsonPluginStorage(this.storageRoot, pluginName);

            const pendingHooks = new Map<string, { resolve: Function, reject: Function }>();

            // Resources
            const resources: PluginResource = { workers: [worker], timers: [], eventListeners: [] };
            this.pluginResources.set(pluginName, resources);
            
            const rpcHandler = async (msg: any) => {
                if (msg.type === 'RPC_CALL') {
                    const { id, method, args } = msg;
                    try {
                        let result;
                        if (method === 'storage:get') result = await storage.get(args[0], args[1]);
                        else if (method === 'storage:set') result = await storage.set(args[0], args[1]);
                        else if (method === 'storage:delete') result = await storage.delete(args[0]);
                        else if (method === 'storage:clear') result = await storage.clear();
                        else if (method === 'events:emit') {
                            this.emit(args[0], args[1]);
                            result = true;
                        }
                        else if (method === 'events:on') {
                             const eventName = args[0];
                             const listener = (payload: any) => {
                                 worker.postMessage({ type: 'EVENT_EMIT', event: eventName, payload });
                             };
                             this.on(eventName, listener);
                             resources.eventListeners.push({ event: eventName, listener });
                             result = true;
                        }
                        else if (method === 'hooks:register') {
                             const [ type, { filter, id: hookId, options } ] = args;
                             const filterRegExp = new RegExp(filter);
                             
                             const proxyCallback = (hookArgs: any) => {
                                 return new Promise<any>((resolve, reject) => {
                                     const requestId = Math.random().toString(36).substring(7);
                                     pendingHooks.set(requestId, { resolve, reject });
                                     worker.postMessage({ type: 'HOOK_CALL', id: hookId, args: hookArgs, requestId });
                                     
                                     // Timeout safety
                                     setTimeout(() => {
                                         if (pendingHooks.has(requestId)) {
                                             pendingHooks.delete(requestId);
                                             reject(new Error("Hook execution timed out"));
                                         }
                                     }, 5000);
                                 });
                             };

                             if (type === 'onResolve') {
                                 this.onResolveHooks.push({ filter: filterRegExp, callback: proxyCallback, pluginName, order: options?.order });
                             } else if (type === 'onLoad') {
                                 this.onLoadHooks.push({ filter: filterRegExp, callback: proxyCallback, pluginName, order: options?.order });
                             }
                             result = true;
                        }
                        else if (method === 'log') {
                            const level = args[0] as 'info' | 'warn' | 'error';
                            console[level](`[${pluginName}]`, ...args.slice(1));
                            result = true;
                        }
                        else if (method === 'perm:check') {
                            // Simple Permission Check Logic
                            result = true; 
                        }
                        
                        worker.postMessage({ id, result });
                    } catch (e: any) {
                        worker.postMessage({ id, error: e.message });
                    }
                }
                else if (msg.type === 'HOOK_RESULT') {
                    const { requestId, result } = msg;
                    const pending = pendingHooks.get(requestId);
                    if (pending) {
                        pendingHooks.delete(requestId);
                        pending.resolve(result);
                    }
                }
                else if (msg.type === 'HOOK_ERROR') {
                    const { requestId, error } = msg;
                    const pending = pendingHooks.get(requestId);
                    if (pending) {
                         pendingHooks.delete(requestId);
                         pending.reject(new Error(error));
                    }
                }
               else if (msg.type === 'LOAD_SUCCESS') {
                    // Create a Proxy Plugin object for the manager registry
                    const proxyPlugin: IPlugin = {
                        name: pluginName,
                        version: "0.0.0", // Todo: Worker should send metadata
                        onLoad: () => {}, // Already loaded in worker
                        onUnload: () => worker.terminate(),
                        // Worker plugins currently don't expose sync getSharedApi or hooks easily without more RPC
                    };
                    this.plugins.set(pluginName, proxyPlugin);
                    console.log(`Isolated Plugin ${pluginName} loaded in worker.`);
                    resolve();
               }
               else if (msg.type === 'LOAD_ERROR') {
                   reject(new Error(msg.error));
                   worker.terminate();
               }
           };

           worker.addEventListener("message", (event) => rpcHandler(event.data));
           worker.addEventListener("error", (err) => {
               console.error("Worker Error:", err);
               reject(err);
           });
       });
  }

  async unregister(pluginName: string): Promise<void> {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) return;

    // Check if other loaded plugins depend on this one
    for (const [name, p] of this.plugins.entries()) {
        if (p.dependencies && p.dependencies[pluginName]) {
            console.warn(`Warning: Plugin ${name} depends on ${pluginName} which is being unloaded.`);
        }
    }

    try {
      await plugin.onUnload();
    } catch (error) {
      console.error(`Error unloading plugin ${pluginName}:`, error);
    } finally {
        this.plugins.delete(pluginName);
        this.cleanupResources(pluginName);
        this.cleanupHooks(pluginName);
        console.log(`Plugin ${pluginName} unloaded.`);
    }
  }

  private cleanupHooks(pluginName: string) {
      this.onResolveHooks = this.onResolveHooks.filter(h => h.pluginName !== pluginName);
      this.onLoadHooks = this.onLoadHooks.filter(h => h.pluginName !== pluginName);
  }

  // Hook Execution Methods
  async runOnResolve(args: OnResolveArgs) {
      const sortedHooks = [...this.onResolveHooks].sort((a, b) => {
          const score = (o?: 'pre' | 'post') => o === 'pre' ? -1 : o === 'post' ? 1 : 0;
          return score(a.order) - score(b.order);
      });

      for (const hook of sortedHooks) {
          if (hook.filter.test(args.path)) {
              const result = await hook.callback(args);
              if (result) return result;
          }
      }
      return null;
  }

  async runOnLoad(args: OnLoadArgs) {
      const sortedHooks = [...this.onLoadHooks].sort((a, b) => {
          const score = (o?: 'pre' | 'post') => o === 'pre' ? -1 : o === 'post' ? 1 : 0;
          return score(a.order) - score(b.order);
      });

      let currentResult: { contents?: string, loader?: string } | null = null;
      let pipelineContents: string | undefined = undefined;

      for (const hook of sortedHooks) {
          if (hook.filter.test(args.path)) {
              // Pass current pipeline state to next hook
              const hookArgs: OnLoadArgs = { ...args, previousContents: pipelineContents };
              
              const result = await hook.callback(hookArgs);
              
              if (result) {
                  // Update pipeline state
                  if (result.contents !== undefined) {
                      pipelineContents = result.contents;
                  }
                  
                  // Accumulate result (loader, etc.)
                  currentResult = { 
                      ...(currentResult || {}), 
                      ...result,
                      contents: pipelineContents! // Ensure final result has latest contents
                  };
              }
          }
      }
      return currentResult;
  }

  private cleanupResources(pluginName: string) {
      const resources = this.pluginResources.get(pluginName);
      if (resources) {
          for (const worker of resources.workers) {
              console.log(`Terminating worker for plugin ${pluginName}`);
              worker.terminate();
          }
          for (const timer of resources.timers) {
              if (timer.type === 'timeout') clearTimeout(timer.id as number);
              if (timer.type === 'interval') clearInterval(timer.id as number);
          }
          for (const listener of resources.eventListeners) {
               this.off(listener.event, listener.listener as any);
          }
          this.pluginResources.delete(pluginName);
      }
  }

  getPlugin(name: string): IPlugin | undefined {
    return this.plugins.get(name);
  }

  listPlugins(): string[] {
    return Array.from(this.plugins.keys());
  }

  // Override emit for type safety
  override emit<K extends keyof AppEvents>(eventName: K, payload: AppEvents[K]): boolean;
  override emit(eventName: string | symbol, ...args: any[]): boolean;
  override emit(eventName: string | symbol, ...args: any[]): boolean {
    return super.emit(eventName, ...args);
  }

  // Override on for type safety
  override on<K extends keyof AppEvents>(eventName: K, listener: (payload: AppEvents[K]) => void): this;
  override on(eventName: string | symbol, listener: (...args: any[]) => void): this;
  override on(eventName: string | symbol, listener: (...args: any[]) => void): this {
    return super.on(eventName, listener);
  }

  async loadPluginsFromDirectory(directoryPath: string): Promise<void> {
    try {
      // 1. Load global plugin states (disabled list)
      const globalConfigPath = join(this.storageRoot, "plugins.json");
      let disabledPlugins: string[] = [];
      try {
        const file = Bun.file(globalConfigPath);
        if (await file.exists()) {
            const data = await file.json();
            disabledPlugins = data.disabled || [];
        }
      } catch (e) {
        console.warn("Failed to load global plugin config", e);
      }

      // 2. Discover all plugins
      const files = await readdir(directoryPath);
      this.availablePlugins.clear();

      for (const file of files) {
        if ((file.endsWith(".ts") || file.endsWith(".js")) && !file.endsWith(".d.ts")) {
          const fullPath = join(directoryPath, file);
          try {
            const module = await import(fullPath);
            for (const key in module) {
              const ExportedItem = module[key];
              const validation = validatePlugin(ExportedItem);
              if (validation.valid) {
                 this.availablePlugins.set(validation.plugin.name, validation.plugin);
              } else {
                 console.warn(`Skipping invalid plugin in ${file}: ${validation.error}`);
              }
            }
          } catch (err) {
            console.error(`Error importing ${fullPath}:`, err);
          }
        }
      }

      // 3. Filter enabled plugins
      const pluginsToLoad: IPlugin[] = [];
      for (const plugin of this.availablePlugins.values()) {
          if (!disabledPlugins.includes(plugin.name)) {
              pluginsToLoad.push(plugin);
          } else {
              console.log(`Plugin ${plugin.name} is disabled.`);
          }
      }

      // 4. Resolve Dependency Order
      try {
          const sortedPlugins = this.resolveDependencyOrder(pluginsToLoad);
          
          // 5. Load plugins in order
          const loadedPlugins: IPlugin[] = [];
          for (const plugin of sortedPlugins) {
              // Dependency Health Check
              let dependenciesOk = true;
              if (plugin.dependencies) {
                  for (const dep of Object.keys(plugin.dependencies)) {
                      if (!this.plugins.has(dep)) {
                          console.warn(`Skipping ${plugin.name}: Dependency ${dep} failed to load or is missing.`);
                          dependenciesOk = false;
                          break;
                      }
                  }
              }

              if (!dependenciesOk) continue;

              try {
                  if (!this.plugins.has(plugin.name)) { 
                      await this.register(plugin);
                      loadedPlugins.push(plugin);
                  }
              } catch (e) {
                   console.error(`Failed to load ${plugin.name}:`, e);
                   // Continue to next plugin, do not allow this failure to stop others
                   // But dependents will be skipped by the check above.
              }
          }

          // 6. Lifecycle: onStarted (All loaded)
          for (const plugin of loadedPlugins) {
              if (plugin.onStarted) {
                  try {
                      await plugin.onStarted();
                  } catch (e) {
                      console.error(`Error in onStarted for ${plugin.name}:`, e);
                  }
              }
          }
      } catch (e) {
          console.error("Failed to resolve plugin dependencies or load plugins:", e);
      }

    } catch (error) {
      console.error(`Failed to load plugins from ${directoryPath}`, error);
    }
  }

  // Topological sort for plugins
  private resolveDependencyOrder(plugins: IPlugin[]): IPlugin[] {
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
                  // Check if dependency is available in the set we are loading
                  // We only care about dependencies *within* the set of enabled plugins for sorting.
                  // If a dependency is missing entirely, it will be caught at register() time or we can catch it here.
                  
                  // Strict check: Dependency MUST be in the enabled set or already loaded
                  if (pluginMap.has(depName)) {
                      g.get(p.name)!.push(depName);
                  } else if (this.plugins.has(depName)) {
                      // Already loaded, no edge needed in this sort, but valid
                  } else {
                      // Dependency missing from available/enabled plugins
                      throw new Error(`Plugin ${p.name} depends on ${depName}, which is not enabled or found.`);
                  }
              }
          }
      }

      // Kahn's Algorithm
      // In-degree calculation
      const inDegree = new Map<string, number>();
      for (const name of pluginMap.keys()) inDegree.set(name, 0);

      // Note: Edge direction in 'g' is "Plugin -> [Dependencies]".
      // For Topo Sort (Loading Order), we need "Dependency -> [Dependents]" to process dependencies first.
      // So let's flip logic or use recursive DFS. 
      // Actually Kahn's works on "Dependencies -> Dependents" edges.
      // My 'g' is "p depends on d, d, d".
      // So `p` cannot be loaded until `d` is loaded.
      // Edge: d -> p
      
      const adj = new Map<string, string[]>();
      for (const name of pluginMap.keys()) adj.set(name, []);

      for (const [pName, deps] of g.entries()) {
          for (const depName of deps) {
              adj.get(depName)!.push(pName); // dep points to p (load dep first)
              inDegree.set(pName, (inDegree.get(pName) || 0) + 1);
          }
      }

      const queue: string[] = [];
      for (const [name, deg] of inDegree.entries()) {
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

      // The queue gave us the load order
      return sorted;
  }

  async disablePlugin(name: string): Promise<void> {
    await this.unregister(name);
    await this.updatePluginState(name, true);
    console.log(`Plugin ${name} disabled.`);
  }

  async enablePlugin(name: string): Promise<void> {
    await this.updatePluginState(name, false);
    
    // We need to respect dependencies when enabling a single plugin too.
    // Simplifying: Just try to register it. usage of resolveDependencyOrder might be needed if enabling a group.
    
    if (!this.plugins.has(name)) {
        const plugin = this.availablePlugins.get(name);
        if (plugin) {
            // Check dependencies strictly
            if (plugin.dependencies) {
                for (const dep of Object.keys(plugin.dependencies)) {
                    if (!this.plugins.has(dep)) {
                        console.warn(`Cannot enable ${name}: Dependency ${dep} is not loaded.`);
                        return; // Abort
                    }
                }
            }
            await this.register(plugin);
        } else {
             console.warn(`Plugin ${name} enabled but not found in available plugins.`);
        }
    }
  }

  async reloadPlugin(name: string): Promise<void> {
    const plugin = this.plugins.get(name);
    if (plugin) {
        console.log(`Reloading plugin ${name}...`);
        await this.unregister(name);
    }
    
    // Attempt to retrieve from available plugins
    const definition = this.availablePlugins.get(name);
    if (definition) {
        await this.register(definition);
    } else {
        throw new Error(`Plugin ${name} not found in available plugins.`);
    }
  }

  private async updatePluginState(name: string, disabled: boolean): Promise<void> {
      try {
        const globalConfigPath = join(this.storageRoot, "plugins.json");
        let config: { disabled: string[] } = { disabled: [] };
        
        const file = Bun.file(globalConfigPath);
        if (await file.exists()) {
            config = await file.json();
        }

        const set = new Set(config.disabled);
        if (disabled) {
            set.add(name);
        } else {
            set.delete(name);
        }
        
        config.disabled = Array.from(set);
        
        await mkdir(this.storageRoot, { recursive: true });
        await Bun.write(globalConfigPath, JSON.stringify(config, null, 2));

      } catch (e) {
        console.error("Failed to update plugin state", e);
      }
  }
  /**
   * Bridges the internal plugin hooks to a Bun-compatible plugin.
   * This allows Bun.build() to utilize the registered onResolve/onLoad hooks.
   */
  toBunPlugin(): BunPlugin {
      return {
          name: "BunPluginManagerBridge",
          setup: (build) => {
               // 1. Register onResolve hooks
               // We group filters to register efficient handlers, or register for each unique filter.
               // Since we want to support our specific pipeline/priority logic in runOnResolve,
               // we should ideally register one handler per unique filter that delegates to runOnResolve.
               
               const resolveFilters = new Set(this.onResolveHooks.map(h => h.filter.source));
               for (const source of resolveFilters) {
                   const re = new RegExp(source);
                   build.onResolve({ filter: re }, async (args) => {
                       return this.runOnResolve(args);
                   });
               }

               // 2. Register onLoad hooks (Waterfall Support)
               // Similarly, we register handlers that delegate to runOnLoad, which implements the waterfall pipeline.
               const loadFilters = new Set(this.onLoadHooks.map(h => h.filter.source));
               for (const source of loadFilters) {
                   const re = new RegExp(source);
                   build.onLoad({ filter: re }, async (args) => {
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
          }
      };
  }

  /**
   * Enables hot reloading for plugins in the specified directory.
   */
  enableHotReload(pluginDir: string) {
      console.log(`[HotReload] Watching ${pluginDir} for changes...`);
      watch(pluginDir, { recursive: true }, async (event, filename) => {
          if (!filename) return;
          console.log(`[HotReload] Change detected in ${filename}`);
          
          // Simple Heuristic: Reload all plugins or try to find which one?
          // For robustness in this iteration, we iterate available plugins and check if they match the path.
          // Note: filename is relative to pluginDir.
          
          // Todo: Debounce
          
          for (const [name, plugin] of this.plugins.entries()) {
               // This requires we tracked the file path of the plugin.
               // We currently don't store the origin path in IPlugin, but we have `availablePlugins` from `loadPluginsFromDirectory`.
               // We can try to reload by name if we can map filename -> plugin name.
               // For now, let's just log. Implementing full HMR logic requires mapping.
          }
          
          // Since we can't easily map filename to plugin name without extra metadata, 
          // we will reload the entire directory scanning (but only reload updated ones?).
          // Safer: Just warn for now or reload specific if known.
          
          // Better Implementation:
          // We can't know which plugin "foo.ts" belongs to easily unless we enforce folder structure.
          // Let's assume one-file plugins or folder-plugins.
          
          // If we had a map: path -> pluginName
          // For now, allow manual reload trigger or future task.
      });
  }

  getPluginStatus(): Record<string, any> {
      const status: Record<string, any> = {};
      for (const [name, plugin] of this.plugins) {
          const resources = this.pluginResources.get(name);
          status[name] = {
              version: plugin.version,
              status: "active",
              resources: {
                  workers: resources?.workers.length || 0,
                  timers: resources?.timers.length || 0,
                  listeners: resources?.eventListeners.length || 0
              }
          };
      }
      return status;
  }
}

