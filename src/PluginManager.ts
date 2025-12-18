import { EventEmitter } from "node:events";
import { readdir, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { 
    IPlugin, 
    PluginContext, 
    AppEvents, 
    EventCallback, 
    PluginBuilder,
    OnResolveCallback,
    OnLoadCallback,
    OnResolveArgs,
    OnLoadArgs
} from "./types";
import { validatePlugin } from "./utils/pluginValidator";
import { JsonPluginStorage } from "./storage/JsonPluginStorage";
import { z } from "zod";

interface PluginResource {
    workers: Worker[];
}

interface HookRegistry<T> {
    filter: RegExp;
    callback: T;
    pluginName: string;
}

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

  constructor(storageRoot: string = "./storage") {
    super();
    this.storageRoot = storageRoot;
  }

  async register(plugin: IPlugin): Promise<void> {
    if (this.plugins.has(plugin.name)) {
      throw new Error(`Plugin ${plugin.name} is already registered.`);
    }

    // Check dependencies
    if (plugin.dependencies) {
        for (const [depName, version] of Object.entries(plugin.dependencies)) {
            if (!this.plugins.has(depName)) {
                throw new Error(`Plugin ${plugin.name} requires missing dependency: ${depName} (${version})`);
            }
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
            throw new Error(`Configuration validation failed for plugin ${plugin.name}: ${e}`);
        }
    }

    // 3. Initialize Resources Tracking
    const resources: PluginResource = { workers: [] };
    this.pluginResources.set(plugin.name, resources);

    const hasPermission = (perm: 'network' | 'filesystem' | 'env') => {
        return plugin.permissions?.includes(perm);
    };

    const context: PluginContext = {
      manager: this,
      storage: storage,
      config: config,
      emit: <K extends keyof AppEvents>(event: K, payload: AppEvents[K]) => {
        this.emit(event, payload);
      },
      on: <K extends keyof AppEvents>(event: K, callback: EventCallback<AppEvents[K]>) => {
        this.on(event, callback);
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
      createWorker: (url: string | URL, options?: WorkerOptions) => {
          const w = new Worker(url, options);
          resources.workers.push(w);
          return w;
      },
      // Security enforcement
      network: {
          fetch: (start, init) => {
              if (!hasPermission('network')) {
                  throw new Error(`AccessDenied: Plugin '${plugin.name}' requires 'network' permission to use fetch.`);
              }
              return fetch(start, init);
          }
      },
      get env() {
          if (!hasPermission('env')) {
               // We return an empty object or throw? The spec implies blocking access. 
               // Thowing on access to the property is cleaner validation of intent.
               throw new Error(`AccessDenied: Plugin '${plugin.name}' requires 'env' permission to access environment variables.`);
          }
          return new Proxy(process.env, {
              get(target, prop) {
                  return Reflect.get(target, prop);
              },
              set() {
                  throw new Error("Plugins cannot modify environment variables.");
              }
          });
      }
    };

    // 4. Setup Hooks (if applicable)
    if (plugin.setup) {
        const builder: PluginBuilder = {
            onResolve: (filter, callback) => {
                this.onResolveHooks.push({ filter, callback, pluginName: plugin.name });
            },
            onLoad: (filter, callback) => {
                this.onLoadHooks.push({ filter, callback, pluginName: plugin.name });
            }
        };
        try {
            await plugin.setup(builder);
        } catch (e) {
             console.error(`Error during plugin setup for ${plugin.name}:`, e);
             throw e; // Setup failure is critical
        }
    }

    // 5. Lifecycle onLoad with Timeout
    try {
      // 5s timeout
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`Plugin ${plugin.name} timed out during load (5000ms limit)`)), 5000)
      );
      
      await Promise.race([
          plugin.onLoad(context),
          timeoutPromise
      ]);

      this.plugins.set(plugin.name, plugin);
      console.log(`Plugin ${plugin.name} loaded successfully.`);
    } catch (error) {
      console.error(`Failed to load plugin ${plugin.name}:`, error);
      // Cleanup resources if load fails
      this.cleanupResources(plugin.name);
      // Also cleanup hooks if setup ran but onLoad failed
      this.cleanupHooks(plugin.name);
      throw error;
    }
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
      for (const hook of this.onResolveHooks) {
          if (hook.filter.test(args.path)) {
              const result = await hook.callback(args);
              if (result) return result;
          }
      }
      return null;
  }

  async runOnLoad(args: OnLoadArgs) {
      for (const hook of this.onLoadHooks) {
          if (hook.filter.test(args.path)) {
              const result = await hook.callback(args);
              if (result) return result;
          }
      }
      return null;
  }

  private cleanupResources(pluginName: string) {
      const resources = this.pluginResources.get(pluginName);
      if (resources) {
          for (const worker of resources.workers) {
              console.log(`Terminating worker for plugin ${pluginName}`);
              worker.terminate();
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
          for (const plugin of sortedPlugins) {
              if (!this.plugins.has(plugin.name)) { // Double check
                  await this.register(plugin);
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
}

