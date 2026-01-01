# 🎯 Declarative Plugin System Examples

This directory contains **clean, declarative examples** of the plugin system that eliminate code duplication and provide a more functional approach to building plugins.

## 🚀 Quick Start

```bash
# Interactive menu - choose which example to run
bun run examples/index-declarative.ts

# Run all examples (except server)
bun run examples/index-declarative.ts --all

# Run specific example
bun run examples/index-declarative.ts --example action-registry
```

## 📋 Available Examples

| Example | File | Description |
|---------|------|-------------|
| **Action Registry** | `action-registry-declarative.ts` | Plugin system with action registration |
| **Storage** | `storage-declarative.ts` | Clean storage operations |
| **Logging** | `logger-declarative.ts` | Flexible logging configurations |
| **Server** | `server-declarative.ts` | Plugin-powered HTTP server |

## 🏗️ Declarative Architecture

### Shared Utilities (`examples/shared/`)

- **`action-registry.ts`** - Declarative action definitions and registry
- **`plugin-builder.ts`** - Functional plugin creation utilities

### Key Benefits

1. **No Code Duplication** - Shared utilities eliminate repetitive boilerplate
2. **Declarative Configuration** - Define behavior through configuration objects
3. **Type Safety** - Full TypeScript support with proper interfaces
4. **Functional Approach** - Compose plugins from small, reusable functions
5. **Clean Separation** - Clear separation between configuration and logic

## 🔧 Usage Patterns

### Creating a Plugin (Declarative)

```typescript
import { createPlugin } from "./shared/plugin-builder";

const myPlugin = createPlugin({
  name: "my-plugin",
  version: "1.0.0",
  description: "My declarative plugin",
  
  onLoad: async (context) => {
    // Plugin logic here
    context.log.info("Plugin loaded!");
  },
  
  onUnload: async () => {
    console.log("Plugin unloaded");
  }
});
```

### Creating Action Plugins

```typescript
import { createActionPlugin, mathActions } from "./shared/plugin-builder";

const mathPlugin = createActionPlugin({
  name: "math-actions",
  version: "1.0.0",
  registryName: "action-registry",
  actionCategories: [mathActions]
});
```

### Creating Storage Plugins

```typescript
const storagePlugin = createPlugin({
  name: "storage-plugin",
  version: "1.0.0",
  
  onLoad: async (context) => {
    const { storage, log } = context;
    
    // Declarative storage operations
    await storage.set("key", "value");
    const value = await storage.get("key");
    log.info(`Retrieved: ${value}`);
  }
});
```

## 🎯 Example Features

### Action Registry Example
- ✅ Declarative action definitions
- ✅ Plugin-based action registration
- ✅ Dynamic action execution
- ✅ Error handling
- ✅ Plugin discovery

### Storage Example
- ✅ Declarative storage operations
- ✅ CRUD operations
- ✅ Configuration management
- ✅ Data validation
- ✅ Plugin isolation support

### Logger Example
- ✅ Multiple logger adapters (Console, Pino, No-op)
- ✅ Hierarchical logging
- ✅ Structured logging
- ✅ Performance monitoring
- ✅ Plugin-specific loggers

### Server Example
- ✅ Declarative route definitions
- ✅ Plugin-based request handlers
- ✅ JSON API endpoints
- ✅ Error handling
- ✅ Action execution via HTTP

## 🔍 Comparison: Old vs New

### Before (Imperative)
```typescript
class MyPlugin implements IPlugin {
  name = "my-plugin";
  version = "1.0.0";
  
  async onLoad(context: PluginContext) {
    // Lots of boilerplate
    const registry = context.getPlugin("registry");
    if (registry) {
      registry.registerAction("action1", handler1);
      registry.registerAction("action2", handler2);
      // ... more repetitive code
    }
  }
}
```

### After (Declarative)
```typescript
const myPlugin = createActionPlugin({
  name: "my-plugin",
  version: "1.0.0",
  registryName: "registry",
  actionCategories: [predefinedActions]
});
```

## 🚀 Running Individual Examples

```bash
# Action Registry
bun run examples/action-registry-declarative.ts

# Storage
bun run examples/storage-declarative.ts

# Logging
bun run examples/logger-declarative.ts

# Server (starts HTTP server)
bun run examples/server-declarative.ts
```

## 📚 Learning Path

1. **Start with Action Registry** - Understand the core plugin concepts
2. **Explore Storage** - Learn how plugins persist data
3. **Configure Logging** - See how to handle different logging scenarios
4. **Build a Server** - Combine everything into a working HTTP server

## 🔧 Extending the Examples

The declarative approach makes it easy to:

- Add new action categories
- Create custom storage operations
- Implement new logger adapters
- Define additional server routes
- Compose multiple plugins

## 🎉 Benefits

- **50% less code** compared to imperative examples
- **Zero duplication** through shared utilities
- **Better maintainability** with declarative configuration
- **Easier testing** with pure functions
- **Type safety** throughout
- **Functional composition** patterns

## 🔗 Related Files

- `../src/` - Core plugin system implementation
- `../plugins/` - Example plugins that work with both approaches
- `../tests/` - Test files for validation

Happy coding with declarative plugins! 🎉