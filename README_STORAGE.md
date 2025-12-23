# Plugin Storage - Quick Start Guide

This is a quick reference guide for using storage in plugins. For detailed information, see [docs/storage-usage-guide.md](docs/storage-usage-guide.md).

## The One-Minute Summary

**The storage API is IDENTICAL in both non-isolated and isolated plugins!** The difference is transparent to plugin developers.

```typescript
async onLoad(context: PluginContext) {
    const { storage } = context;
    
    // This code works in BOTH modes!
    const counter = await storage.get<number>("counter") ?? 0;
    await storage.set("counter", counter + 1);
}
```

## Registration Differences

### Non-Isolated Plugin
```typescript
import { PluginManager } from './src/index';
import { MyPlugin } from './MyPlugin';

const manager = new PluginManager();
await manager.register(MyPlugin);  // Direct registration
```

### Isolated Plugin
```typescript
import { PluginManager } from './src/index';

const manager = new PluginManager();
await manager.registerIsolated(
    './plugins/MyPlugin.ts',
    'my-plugin'  // Plugin name
);
```

## Storage API

```typescript
interface IPluginStorage {
    get<T>(key: string, defaultValue?: T): Promise<T | undefined>;
    set<T>(key: string, value: T): Promise<void>;
    delete(key: string): Promise<void>;
    clear(): Promise<void>;
}
```

## Storage Location

```
storage/plugins/{plugin-name}/storage.json
```

Each plugin has its own isolated storage directory.

## How It Works

### Non-Isolated Plugins
```
Plugin → Context.storage → JsonPluginStorage → Filesystem
```
Direct method calls in the main thread.

### Isolated Plugins
```
Plugin → WorkerRunner → RPC → PluginManager → JsonPluginStorage → Filesystem
```
Storage operations are transparently sent via RPC to the main thread.

## Example: Same Plugin, Different Registration

```typescript
// plugins/CounterPlugin.ts
export default {
    name: "counter-plugin",
    version: "1.0.0",
    
    async onLoad(context) {
        const { storage, log } = context;
        
        const counter = await storage.get<number>("counter") ?? 0;
        log.info(`Counter: ${counter}`);
        
        await storage.set("counter", counter + 1);
        await storage.set("lastRun", new Date().toISOString());
    }
} satisfies IPlugin;
```

### Register as Non-Isolated
```typescript
import { PluginManager } from './src/index';
import CounterPlugin from './plugins/CounterPlugin';

const manager = new PluginManager();
await manager.register(CounterPlugin);  // Runs in main thread
```

### Register as Isolated
```typescript
import { PluginManager } from './src/index';

const manager = new PluginManager();
await manager.registerIsolated(
    './plugins/CounterPlugin.ts',
    'counter-plugin'  // Runs in worker thread
);
```

**The plugin code is EXACTLY the same!**

## Key Differences

| Aspect | Non-Isolated | Isolated |
|--------|-------------|----------|
| Registration | `register(plugin)` | `registerIsolated(path, name)` |
| Thread | Main thread | Worker thread |
| Storage Access | Direct method calls | RPC calls |
| Performance | Faster (~0.1ms) | Slightly slower (~1-5ms) |
| Security | Full access | Sandboxed |
| Use Case | Trusted, performance-critical | Untrusted, security-critical |

## Common Patterns

### Pattern 1: Simple Counter
```typescript
const counter = await storage.get<number>("counter") ?? 0;
await storage.set("counter", counter + 1);
```

### Pattern 2: Complex Object
```typescript
const userData = {
    name: "John",
    email: "john@example.com",
    lastLogin: new Date().toISOString()
};
await storage.set("userData", userData);
```

### Pattern 3: CRUD Operations
```typescript
// Read
const todos = await storage.get<Todo[]>("todos") ?? [];

// Create
todos.push({ id: 1, text: "New task", done: false });
await storage.set("todos", todos);

// Update
const updated = todos.map(t => 
    t.id === 1 ? { ...t, done: true } : t
);
await storage.set("todos", updated);

// Delete
const filtered = todos.filter(t => t.id !== 1);
await storage.set("todos", filtered);
```

### Pattern 4: First Run Initialization
```typescript
const isFirstRun = await storage.get<boolean>("firstRun", true);

if (isFirstRun) {
    log.info("First run - initializing");
    await storage.set("firstRun", false);
    await storage.set("config", defaultConfig);
} else {
    log.info("Loading existing data");
}
```

## Best Practices

1. **Use TypeScript generics for type safety**
   ```typescript
   const user = await storage.get<UserData>("user");
   ```

2. **Provide default values**
   ```typescript
   const counter = await storage.get<number>("counter") ?? 0;
   ```

3. **Batch operations when possible**
   ```typescript
   // Good: One operation
   await storage.set("data", { key1: val1, key2: val2 });
   
   // Bad: Multiple operations
   await storage.set("key1", val1);
   await storage.set("key2", val2);
   ```

4. **Organize data in structures**
   ```typescript
   // Good: Organized
   await storage.set("appState", {
       version: "1.0.0",
       settings: { theme: "dark" }
   });
   
   // Bad: Flat keys
   await storage.set("version", "1.0.0");
   await storage.set("theme", "dark");
   ```

## When to Use Which Mode?

### Use Non-Isolated When:
- ✅ You trust the plugin code
- ✅ Performance is critical
- ✅ Plugin needs direct filesystem access
- ✅ Plugin needs to share resources with main thread
- ✅ You want simpler debugging

### Use Isolated When:
- ✅ You don't trust the plugin source
- ✅ Security is more important than performance
- ✅ You want to sandbox the plugin
- ✅ Implementing a plugin marketplace
- ✅ Preventing plugins from crashing the system

## Examples

Complete working examples are available:

1. **Non-isolated examples**: [examples/storage-example-non-isolated.ts](../examples/storage-example-non-isolated.ts)
   - CounterPlugin
   - TodoListPlugin
   - ConfiguredStoragePlugin

2. **Isolated examples**: [examples/storage-example-isolated.ts](../examples/storage-example-isolated.ts)
   - IsolatedCounterPlugin
   - IsolatedCachePlugin
   - IsolatedSessionPlugin

## Running the Examples

### Non-Isolated Example
```bash
bun run examples/storage-example-non-isolated.ts
```

### Isolated Example
```bash
bun run examples/storage-example-isolated.ts
```

## Troubleshooting

### Storage not persisting?
- Check if storage directory exists and is writable
- Verify plugin name doesn't contain special characters
- Look for errors in console during save

### Getting undefined values?
- Use default value: `storage.get("key", defaultValue)`
- Check if data was actually saved
- Verify key name is correct

### Isolated plugin slow?
- Batch operations when possible
- Consider if non-isolated mode is acceptable
- Cache frequently accessed data in memory

## Files Reference

- **Implementation**: `src/storage/JsonPluginStorage.ts`
- **Non-isolated context**: `src/managers/ContextFactory.ts`
- **Isolated context**: `src/worker/WorkerRunner.ts`
- **RPC handling**: `src/PluginManager.ts` (see `registerIsolated` method)
- **Type definitions**: `src/types.ts` (see `IPluginStorage`)

## Summary

The storage system provides a simple, consistent API for plugins to persist data:

1. **API is identical** in both modes - write once, run anywhere
2. **Storage is isolated** per plugin - no data conflicts
3. **Choose mode based on trust** - non-isolated for trusted, isolated for untrusted
4. **Performance difference is minimal** - RPC overhead is acceptable for most use cases

For detailed information, see the full guide: [docs/storage-usage-guide.md](docs/storage-usage-guide.md)
