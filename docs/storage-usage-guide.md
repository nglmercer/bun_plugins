# Storage Usage Guide for Plugins

This guide explains how to use persistent storage in both non-isolated and isolated plugins, highlighting the similarities and differences between the two approaches.

## Overview

The plugin system provides a built-in storage mechanism that allows plugins to persist data across restarts. The storage is implemented using JSON files stored in the filesystem.

### Storage Location

By default, storage files are located at:
```
storage/plugins/{plugin-name}/storage.json
```

Each plugin gets its own isolated storage directory, ensuring no data conflicts between plugins.

## Storage API

Both non-isolated and isolated plugins use the **exact same** storage API:

```typescript
interface IPluginStorage {
    // Get a value by key, with optional default
    get<T>(key: string, defaultValue?: T): Promise<T | undefined>;
    
    // Set a value for a key
    set<T>(key: string, value: T): Promise<void>;
    
    // Delete a specific key
    delete(key: string): Promise<void>;
    
    // Clear all storage data for this plugin
    clear(): Promise<void>;
}
```

## Non-Isolated Plugins

### How They Work

Non-isolated plugins run directly in the main thread. They have direct access to the storage instance.

### Registration

```typescript
import { PluginManager } from './src/index';
import { MyPlugin } from './MyPlugin';

const manager = new PluginManager();
await manager.register(MyPlugin);
```

### Storage Usage Example

```typescript
export const CounterPlugin: IPlugin = {
    name: "counter-plugin",
    version: "1.0.0",
    
    async onLoad(context: PluginContext) {
        const { storage, log } = context;
        
        // Direct access to storage
        const counter = await storage.get<number>("counter") ?? 0;
        log.info(`Counter: ${counter}`);
        
        await storage.set("counter", counter + 1);
        
        // Store complex objects
        const userData = {
            name: "John",
            lastLogin: new Date().toISOString()
        };
        await storage.set("userData", userData);
        
        // Delete a key
        await storage.delete("tempData");
        
        // Clear all data (use with caution!)
        // await storage.clear();
    }
};
```

### How Storage Works Under the Hood

In non-isolated plugins, the `storage` object in the context is a direct reference to the `JsonPluginStorage` instance:

```typescript
// From ContextFactory.ts
const context = {
    storage,  // Direct instance of JsonPluginStorage
    // ... other context properties
};
```

Storage operations call methods directly on the `JsonPluginStorage` class, which reads/writes to the JSON file.

## Isolated Plugins

### How They Work

Isolated plugins run in a separate worker thread. They cannot directly access the filesystem or main thread storage. Instead, storage operations are performed via RPC (Remote Procedure Calls).

### Registration

```typescript
import { PluginManager } from './src/index';

const manager = new PluginManager();
await manager.registerIsolated(
    './plugins/MyIsolatedPlugin.ts',
    'my-isolated-plugin'
);
```

### Storage Usage Example

```typescript
export const IsolatedCounterPlugin: IPlugin = {
    name: "isolated-counter-plugin",
    version: "1.0.0",
    
    async onLoad(context: PluginContext) {
        const { storage, log } = context;
        
        // The API is IDENTICAL to non-isolated!
        const counter = await storage.get<number>("counter") ?? 0;
        log.info(`[Isolated] Counter: ${counter}`);
        
        await storage.set("counter", counter + 1);
        
        // Store complex objects
        const userData = {
            name: "John",
            lastLogin: new Date().toISOString()
        };
        await storage.set("userData", userData);
        
        // Delete a key
        await storage.delete("tempData");
    }
};
```

### How Storage Works Under the Hood

In isolated plugins, the storage object is a **proxy** that translates storage operations into RPC calls:

```typescript
// From WorkerRunner.ts - the storage proxy
const contextProxy = {
    storage: {
        get: (key) => rpc(RPCMethod.StorageGet, key),
        set: (key, val) => rpc(RPCMethod.StorageSet, key, val),
        delete: (key) => rpc(RPCMethod.StorageDelete, key),
        clear: () => rpc(RPCMethod.StorageClear)
    },
    // ... other context properties
};
```

The RPC flow:
1. Plugin calls `storage.get("counter")`
2. WorkerRunner sends RPC message to main thread
3. PluginManager handles the RPC and calls `storage.get()` on the actual storage instance
4. Result is sent back to worker
5. Plugin receives the result

### RPC Handler in PluginManager

```typescript
// From PluginManager.ts - registerIsolated method
const rpcHandler = async (msg: Record<string, any>) => {
    if (msg.type === WorkerMessageType.RPC_CALL) {
        const { id, method, args } = msg;
        try {
            let result;
            if (method === RPCMethod.StorageGet) 
                result = await storage.get(args[0], args[1]);
            else if (method === RPCMethod.StorageSet) 
                result = await storage.set(args[0], args[1]);
            else if (method === RPCMethod.StorageDelete) 
                result = await storage.delete(args[0]);
            else if (method === RPCMethod.StorageClear) 
                result = await storage.clear();
            
            worker.postMessage({ id, result });
        } catch (e) {
            worker.postMessage({ id, error: e.message });
        }
    }
};
```

## Key Differences

| Aspect | Non-Isolated | Isolated |
|--------|-------------|----------|
| **Thread** | Main thread | Worker thread |
| **Storage Access** | Direct method calls | RPC calls |
| **API** | `IPluginStorage` methods | Same API (proxy) |
| **Performance** | Faster (no serialization) | Slightly slower (RPC overhead) |
| **Security** | Can access main thread | Isolated from main thread |
| **File System** | Direct access (with permissions) | Restricted access |
| **Storage API** | Identical | Identical |
| **Use Case** | Trusted plugins, performance-critical | Untrusted plugins, sandboxing |

## Best Practices

### 1. Use Type Safety

```typescript
interface UserData {
    id: number;
    name: string;
    email: string;
}

// Good: Type-safe access
const user = await storage.get<UserData>("user");
if (user) {
    console.log(user.name); // TypeScript knows it's a string
}

// Avoid: Type assertion when not needed
const user = await storage.get("user") as UserData;
```

### 2. Handle Missing Values

```typescript
// Good: Use nullish coalescing
const counter = await storage.get<number>("counter") ?? 0;

// Good: Use default parameter
const counter = await storage.get("counter", 0);

// Avoid: Assume value exists
const counter = await storage.get<number>("counter")!;
```

### 3. Use Structured Data

```typescript
// Good: Organized structure
await storage.set("appState", {
    version: "1.0.0",
    lastRun: new Date().toISOString(),
    settings: {
        theme: "dark",
        language: "en"
    }
});

// Avoid: Flat structure with many keys
await storage.set("appState_version", "1.0.0");
await storage.set("appState_lastRun", new Date().toISOString());
await storage.set("appState_settings_theme", "dark");
```

### 4. Clean Up Old Data

```typescript
// Good: Periodic cleanup
const sessions = await storage.get<Session[]>("sessions") ?? [];
const now = Date.now();
const activeSessions = sessions.filter(s => 
    now - new Date(s.createdAt).getTime() < SESSION_TIMEOUT
);

if (activeSessions.length !== sessions.length) {
    await storage.set("sessions", activeSessions);
}
```

### 5. Initialize Data on First Run

```typescript
async onLoad(context: PluginContext) {
    const { storage, log } = context;
    
    const isFirstRun = await storage.get<boolean>("firstRun", true);
    
    if (isFirstRun) {
        log.info("First run - initializing storage");
        await storage.set("firstRun", false);
        await storage.set("config", defaultConfig);
        await storage.set("data", []);
    } else {
        log.info("Loading existing data");
    }
}
```

## When to Use Each Mode

### Use Non-Isolated When:
- You trust the plugin code
- Performance is critical
- The plugin needs to share resources with the main thread
- The plugin needs to access the filesystem directly
- You want simpler debugging (no worker context)

### Use Isolated When:
- You don't trust the plugin source (e.g., third-party plugins)
- You want to sandbox the plugin
- You want to prevent one bad plugin from crashing the system
- You're implementing a plugin marketplace
- Security is more important than performance

## Common Patterns

### Pattern 1: Simple Counter

```typescript
// Works in both modes!
async onLoad(context: PluginContext) {
    const { storage } = context;
    const counter = await storage.get<number>("counter") ?? 0;
    await storage.set("counter", counter + 1);
}
```

### Pattern 2: CRUD Operations

```typescript
// Works in both modes!
async onLoad(context: PluginContext) {
    const { storage } = context;
    
    // Create
    const todos = await storage.get<Todo[]>("todos") ?? [];
    todos.push({ id: 1, text: "New task", done: false });
    await storage.set("todos", todos);
    
    // Read
    const allTodos = await storage.get<Todo[]>("todos") ?? [];
    
    // Update
    const updated = todos.map(t => 
        t.id === 1 ? { ...t, done: true } : t
    );
    await storage.set("todos", updated);
    
    // Delete
    const filtered = todos.filter(t => t.id !== 1);
    await storage.set("todos", filtered);
}
```

### Pattern 3: Configuration Persistence

```typescript
// Works in both modes!
async onLoad(context: PluginContext) {
    const { storage, config } = context;
    
    // Save initial config
    await storage.set("config", config);
    
    // Later, update config
    const currentConfig = await storage.get<any>("config");
    const newConfig = { ...currentConfig, maxItems: 200 };
    await storage.set("config", newConfig);
}
```

### Pattern 4: Analytics Tracking

```typescript
// Works in both modes!
async onLoad(context: PluginContext) {
    const { storage, log } = context;
    
    const stats = await storage.get<Analytics>("stats") ?? {
        loads: 0,
        lastLoad: null,
        errors: 0
    };
    
    stats.loads++;
    stats.lastLoad = new Date().toISOString();
    
    await storage.set("stats", stats);
    log.info(`Plugin loaded ${stats.loads} times`);
}
```

## Performance Considerations

### Non-Isolated Performance
- Direct method calls: ~0.1ms per operation
- File I/O is the bottleneck, not the API
- Good for high-frequency storage operations

### Isolated Performance
- RPC overhead: ~1-5ms per operation
- Serialization/deserialization adds latency
- Still acceptable for most use cases
- Better for occasional storage operations

### Optimization Tips

```typescript
// Bad: Multiple individual operations
await storage.set("key1", value1);
await storage.set("key2", value2);
await storage.set("key3", value3);

// Good: Batch operations
await storage.set("data", { key1: value1, key2: value2, key3: value3 });
```

## Security Considerations

### Storage Isolation

- Each plugin has its own storage directory
- Plugins cannot access other plugins' storage
- File paths are sanitized to prevent traversal attacks

### Permission System

Storage itself doesn't require special permissions, but:
- Filesystem permission affects whether plugins can access other files
- Network permission affects if plugins can store remote data
- Environment permission affects if plugins can access environment variables

### Data Validation

Always validate data from storage:

```typescript
interface Config {
    maxItems: number;
    timeout: number;
}

const config = await storage.get<Config>("config");
if (config && typeof config.maxItems === 'number') {
    // Valid data
} else {
    // Use default
}
```

## Troubleshooting

### Storage Not Persisting

**Problem**: Data is lost after restart

**Solution**: Check that:
- Storage directory exists and is writable
- Plugin name doesn't contain special characters
- No errors in the console during save

### Storage Read Returns Undefined

**Problem**: `storage.get()` returns undefined

**Solution**: 
- Use default value: `storage.get("key", defaultValue)`
- Check if data was actually saved
- Verify the key name is correct

### Isolated Plugin Storage Slow

**Problem**: Storage operations are slow in isolated mode

**Solution**:
- Batch operations when possible
- Consider if non-isolated mode is acceptable
- Cache frequently accessed data in memory

## Examples

See the example files for complete working examples:
- `examples/storage-example-non-isolated.ts` - Non-isolated plugin examples
- `examples/storage-example-isolated.ts` - Isolated plugin examples

## Summary

The key takeaway is that **the storage API is identical** in both modes. The difference is purely in how the API is implemented:

- **Non-isolated**: Direct method calls
- **Isolated**: RPC calls (transparent to the plugin)

You can write the same plugin code and run it in either mode by simply changing how it's registered!
