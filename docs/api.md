# API Reference

## `PluginManager`

The main class to handle plugin lifecycle and coordination.

### Constructor

`new PluginManager(storageRoot?: string, options?: PluginManagerOptions)`

### API Registration Methods

- `registerApi(pluginName: string, api: any): void`: Registers a plugin's API manually for other plugins to access.
- `getPluginApi(pluginName: string): any | undefined`: Retrieves the registered API of a plugin.

#### API Registration Pattern

Plugins can now register their APIs in two ways:

1. **Manual Registration**: Use `context.registerApi(api)` in the `onLoad` method
   ```typescript
   async onLoad(context: PluginContext) {
     context.registerApi({
       myMethod: () => { /* ... */ },
       myProperty: 'value'
     });
   }
   ```

2. **Automatic Registration**: Provide a `sharedApi` property in the plugin definition (for declarative plugins)
   ```typescript
   const createPlugin = (def: PluginDefinition): IPlugin => ({
     name: def.name,
     version: def.version,
     sharedApi: {
       myMethod: () => { /* ... */ },
       myProperty: 'value'
     }
   });
   ```

#### Accessing Plugin APIs

Other plugins can access a plugin's API using `context.getPlugin(name)` or `manager.getPluginApi(name)`:

```typescript
// In a plugin's onLoad method
const registry = await context.getPlugin('action-registry');
if (registry) {
  registry.executeAction('sum', 5, 3);
}

// Or directly from the manager
const registry = manager.getPluginApi('action-registry');
if (registry) {
  registry.executeAction('sum', 5, 3);
}
```

#### Benefits of the New System

- **No Dependency on Optional Methods**: Plugins don't need to implement `getApi()` anymore
- **Explicit Registration**: APIs are registered explicitly, making the code clearer and more maintainable
- **Better Type Safety**: The API registration is explicit and type-safe
- **Flexibility**: Plugins can choose when and how to register their APIs
- **Backward Compatibility**: The old `getApi()` method is still supported for existing plugins

### Methods

- `register(plugin: IPlugin): Promise<void>`: Manually register a plugin. Triggers `onLoad` and then `onStarted`.
- `registerIsolated(path: string, name: string): Promise<void>`: Loads a plugin in a separate `Bun.Worker` for process-level isolation.
- `unregister(name: string): Promise<void>`: Unload a plugin and cleanup all associated resources.
- `loadPluginsFromDirectory(path: string): Promise<void>`: Scans and loads plugins in batch, respecting dependency order.
- `enablePlugin(name: string) / disablePlugin(name: string)`: Persistent activation/deactivation via `plugins.json`.
- `toBunPlugin()`: Bridge to use the plugin system hooks directly inside a Bun build pipeline.
- `getMetrics()`: Returns a summary of active plugins, resource usage, and hook statistics.
- `getPluginStatus()`: Detailed status report including specific resource counts for each plugin.

## `IPlugin` Interface

```typescript
interface IPlugin {
  name: string;
  version: string;
  description?: string;
  author?: string;

  // Configuration
  configSchema?: z.ZodSchema;
  defaultConfig?: Record<string, any>;

  // Dependencies
  dependencies?: Record<string, string>; // { "name": "version_range" }

  // Security
  permissions?: ("network" | "filesystem" | "env")[];
  allowedDomains?: string[];

  // Lifecycle
  onLoad(context: PluginContext): Promise<void> | void;
  onStarted?(): Promise<void> | void;
  onUnload(): Promise<void> | void;

  // IPC
  registerApi(pluginName: string, api: any): void;
  getPluginApi(pluginName: string): any | undefined;

  // Bun/Esbuild Hooks
  setup?(build: PluginBuilder): void | Promise<void>;
}
```

## `PluginContext`

Provided to `onLoad`.

- `storage`: Isolated JSON storage (`get`, `set`, `delete`, `clear`).
- `config`: Current validated configuration.
- `events`: Namespaced event bus (`on`, `emit`).
- `log`: Namespaced logger (`info`, `warn`, `error`).
- `network.fetch`: Scoped fetch with permission check.
- `file(path)`: Scoped Bun file access.
- `env`: Read-only access to environment variables.
- `createWorker(url, options)`: Create auto-managed workers.
- `setTimeout / setInterval / clearTimeout / clearInterval`: Auto-managed timers.
- `getPlugin(name)`: Access the shared API of another plugin (returns Promise).
