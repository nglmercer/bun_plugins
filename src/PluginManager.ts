
import { EventEmitter } from "node:events";
import { readdir, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { watch } from "node:fs";
import type { 
    IPlugin, 
    PluginContext, 
    AppEvents,
    BunWorkerOptions as WorkerOptions,
    OnResolveArgs, 
    OnLoadArgs,
} from "./types";
import { validatePlugin } from "./utils/pluginValidator";
import { JsonPluginStorage } from "./storage/JsonPluginStorage";
import semver from "semver";
import { ResourceManager } from "./managers/ResourceManager";
import { DependencyManager } from "./managers/DependencyManager";
import { HooksManager } from "./managers/HooksManager";
import { createPluginContext } from "./managers/ContextFactory";
import { errorParser } from "./utils/errorParser";

export class PluginManager extends EventEmitter {
  private plugins: Map<string, IPlugin> = new Map();
  private availablePlugins: Map<string, IPlugin> = new Map();
  
  // Modules
  private resources: ResourceManager;
  private dependencyManager: DependencyManager;
  public hooksManager: HooksManager; // Public mainly for testing/bridge access if needed

  private storageRoot: string;
  private hostVersion = "1.0.0"; 
  private pluginLoadTimeout: number;
  private workerFactory: (url: string | URL, options?: WorkerOptions) => Worker;

  constructor(storageRoot: string = "./storage", options?: { pluginLoadTimeout?: number, workerFactory?: (url: string | URL, options?: WorkerOptions) => Worker }) {
    super();
    this.storageRoot = storageRoot;
    this.pluginLoadTimeout = options?.pluginLoadTimeout ?? 5000;
    this.workerFactory = options?.workerFactory ?? ((url, opts) => new Worker(url, opts));

    // Initialize Sub-Managers
    this.resources = new ResourceManager();
    this.dependencyManager = new DependencyManager();
    this.hooksManager = new HooksManager();
  }

  getWorkerFactory() {
      return this.workerFactory;
  }

  async register(plugin: IPlugin): Promise<void> {
    if (this.plugins.has(plugin.name)) {
      throw new Error(`Plugin ${plugin.name} is already registered.`);
    }

    // 0. Dependency & Engine Check
    this.dependencyManager.validateDependencies(plugin, this.plugins);

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
        } catch (e) {
            const error = errorParser(e, `Error in plugin ${plugin.name}`);
            console.warn(`[SafeMode] Using default config, validation failed. Error: ${error.message}`);
        }
    }

    // 3. Initialize Resources
    this.resources.init(plugin.name);

    // Sanitize plugin name
    if (plugin.name.includes("..") || plugin.name.includes("/") || plugin.name.includes("\\")) {
        throw new Error(`Invalid plugin name: ${plugin.name}. Name cannot contain path traversal characters.`);
    }

    // 4. Context Creation
    const context = createPluginContext(this, plugin, this.resources, storage, config);

    // 5. Setup Hooks with Performance Monitoring (Delegated to HooksManager via Builder)
    if (plugin.setup) {
        try {
            await plugin.setup(this.hooksManager.getBuilder(plugin.name));
        } catch (e) {
             console.error(`Error during setup for ${plugin.name}:`, e);
             throw errorParser(e, `Error during setup for ${plugin.name}`);
        }
    }

    // 6. Lifecycle onLoad
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
      // Cleanup resources directly since plugin is not in this.plugins yet
      this.resources.cleanup(plugin.name, this);
      this.hooksManager.cleanup(plugin.name);
      throw errorParser(error, `Failed to load plugin ${plugin.name}`);
    }
  }

  async registerIsolated(pluginPath: string, pluginName: string): Promise<void> {
       return new Promise((resolve, reject) => {
           const workerScript = join(import.meta.dir, "worker", "WorkerRunner.ts");
           console.log("Worker Path:", workerScript);
           const worker = this.workerFactory(workerScript, {
               workerData: { pluginPath, pluginName }
           } as WorkerOptions & { workerData: any });

           const storage = new JsonPluginStorage(this.storageRoot, pluginName);
           const pendingHooks = new Map<string, { resolve: Function, reject: Function }>();

           // Initialize resources
           const res = this.resources.init(pluginName);
           res.workers.push(worker);
           
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
                            res.eventListeners.push({ event: eventName, listener });
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
                                    
                                    setTimeout(() => {
                                        if (pendingHooks.has(requestId)) {
                                            pendingHooks.delete(requestId);
                                            reject(new Error("Hook execution timed out"));
                                        }
                                    }, 5000);
                                });
                            };

                            if (type === 'onResolve') {
                                this.hooksManager.registerOnResolve(filterRegExp, proxyCallback, pluginName, options?.order);
                            } else if (type === 'onLoad') {
                                this.hooksManager.registerOnLoad(filterRegExp, proxyCallback, pluginName, options?.order);
                            }
                            result = true;
                       }
                       else if (method === 'manager:getPlugin') {
                           const targetName = args[0];
                           const p = this.getPlugin(targetName);
                           result = p?.getSharedApi ? p.getSharedApi() : undefined;
                       }
                       else if (method === 'log') {
                           const level = args[0] as 'info' | 'warn' | 'error';
                           console[level](`[${pluginName}]`, ...args.slice(1));
                           result = true;
                       }
                       else if (method === 'perm:check') {
                           result = true; 
                       }
                       
                       worker.postMessage({ id, result });
                   } catch (e) {
                        const error = errorParser(e, `Error in plugin ${pluginName}`);
                        worker.postMessage({ id, error: error.message });
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
                   const { metadata } = msg;
                   const proxyPlugin: IPlugin = {
                       name: metadata.name,
                       version: metadata.version || "0.0.0",
                       description: metadata.description,
                       author: metadata.author,
                       onLoad: () => {}, 
                       onStarted: () => {
                           worker.postMessage({ type: 'START_UP' });
                       },
                       onUnload: () => worker.terminate(),
                   };
                   this.plugins.set(metadata.name, proxyPlugin);
                   console.log(`Isolated Plugin ${metadata.name} loaded in worker.`);
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
        this.resources.cleanup(pluginName, this);
        this.hooksManager.cleanup(pluginName);
        console.log(`Plugin ${pluginName} unloaded.`);
    }
  }

  getPlugin(name: string): IPlugin | undefined {
    return this.plugins.get(name);
  }

  listPlugins(): string[] {
    return Array.from(this.plugins.keys());
  }

  override emit<K extends keyof AppEvents>(eventName: K, payload: AppEvents[K]): boolean;
  override emit(eventName: string | symbol, ...args: any[]): boolean;
  override emit(eventName: string | symbol, ...args: any[]): boolean {
    return super.emit(eventName, ...args);
  }

  override on<K extends keyof AppEvents>(eventName: K, listener: (payload: AppEvents[K]) => void): this;
  override on(eventName: string | symbol, listener: (...args: any[]) => void): this;
  override on(eventName: string | symbol, listener: (...args: any[]) => void): this {
    return super.on(eventName, listener);
  }

  async loadPluginsFromDirectory(directoryPath: string): Promise<void> {
    try {
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

      const pluginsToLoad: IPlugin[] = [];
      for (const plugin of this.availablePlugins.values()) {
          if (!disabledPlugins.includes(plugin.name)) {
              pluginsToLoad.push(plugin);
          } else {
              console.log(`Plugin ${plugin.name} is disabled.`);
          }
      }

      try {
          const sortedPlugins = this.dependencyManager.resolveLoadOrder(pluginsToLoad);
          
          const loadedPlugins: IPlugin[] = [];
          for (const plugin of sortedPlugins) {
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
              }
          }

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

  async disablePlugin(name: string): Promise<void> {
    await this.unregister(name);
    await this.updatePluginState(name, true);
    console.log(`Plugin ${name} disabled.`);
  }

  async enablePlugin(name: string): Promise<void> {
    await this.updatePluginState(name, false);
    
    if (!this.plugins.has(name)) {
        const plugin = this.availablePlugins.get(name);
        if (plugin) {
            if (plugin.dependencies) {
                for (const dep of Object.keys(plugin.dependencies)) {
                    if (!this.plugins.has(dep)) {
                        console.warn(`Cannot enable ${name}: Dependency ${dep} is not loaded.`);
                        return;
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

  async runOnResolve(args: OnResolveArgs) {
      return this.hooksManager.runOnResolve(args);
  }

  async runOnLoad(args: OnLoadArgs) {
      return this.hooksManager.runOnLoad(args);
  }

  toBunPlugin() {
      return this.hooksManager.toBunPlugin();
  }

  enableHotReload(pluginDir: string) {
      console.log(`[HotReload] Watching ${pluginDir} for changes...`);
      watch(pluginDir, { recursive: true }, async (event, filename) => {
          if (!filename || (!filename.endsWith(".ts") && !filename.endsWith(".js"))) return;
          console.log(`[HotReload] Change detected in ${filename}. Re-scanning plugins...`);
          
          // Small debounce or delay to allow file to be written
          await new Promise(r => setTimeout(r, 100));
          
          // Re-load the directory to pick up new definitions
          await this.loadPluginsFromDirectory(pluginDir);
          
          // Note: loadPluginsFromDirectory currently re-registers plugins if they are not in this.plugins.
          // If the plugin was already loaded, we might want to force reload.
          // For now, loadPluginsFromDirectory will log if it skips.
          // Better: reload individual plugin if we can map filename -> plugin.
      });
  }

  getPluginStatus(): Record<string, any> {
      const status: Record<string, any> = {};
      for (const [name, plugin] of this.plugins) {
          const resources = this.resources.get(name);
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
