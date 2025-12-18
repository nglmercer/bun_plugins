# API Reference

## `PluginManager`

The main class to handle plugin lifecycle and coordination.

### Constructor

`new PluginManager(storageRoot?: string, options?: PluginManagerOptions)`

### Methods

- `register(plugin: IPlugin): Promise<void>`: Manually register a plugin.
- `unregister(name: string): Promise<void>`: Unload a plugin.
- `loadPluginsFromDirectory(path: string): Promise<void>`: Scans and loads all valid plugins in a folder.
- `enablePlugin(name: string) / disablePlugin(name: string)`: Persistent activation/deactivation.
- `toBunPlugin()`: Returns a bridge for `Bun.plugin()`.
- `getPluginStatus()`: Returns metrics and status for all loaded plugins.

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
  getSharedApi?(): unknown;

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
- `getPlugin(name)`: Access the shared API of another plugin.
