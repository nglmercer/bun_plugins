# Bun Plugins

A powerful, secure, and isolated plugin system for Bun applications.

## Features

- **Isolated Workers**: Plugins run in their own Bun Workers, providing security and crashing isolation.
- **Permission System**: Fine-grained control over network, file system, and environment access.
- **Hook System**: Intercept and modify resource loading with `onResolve` and `onLoad` hooks (compatible with Bun's plugin API).
- **Type Safe**: Written in TypeScript with full type definitions and Zod validation.
- **Communication RPC**: Seamless communication between the host and plugins using a proxy-based RPC.
- **Automatic Cleanup**: Resources (timers, workers, event listeners) are automatically cleaned up when a plugin is unloaded.

## Installation

```bash
bun add bun_plugins
```

## Quick Start

### 1. Define a Plugin

```typescript
// plugins/MyPlugin.ts
import type { IPlugin, PluginContext } from "bun_plugins";

export class MyPlugin implements IPlugin {
  name = "my-plugin";
  version = "1.0.0";

  async onLoad(context: PluginContext) {
    context.log.info("Plugin loaded!");

    context.on("hello", (name) => {
      console.log(`Hello, ${name}!`);
    });
  }
}
```

### 2. Use the Plugin Manager

```typescript
import { PluginManager } from "bun_plugins";
import { join } from "node:path";

const manager = new PluginManager();

// Register a plugin class instance
await manager.register(new MyPlugin());

// Or load an isolated plugin from a file
await manager.registerIsolated(
  join(process.cwd(), "plugins", "OtherPlugin.ts"),
  "OtherPlugin"
);

// Emit events to plugins
manager.emit("hello", "World");
```

## Security

Plugins run in a restricted environment. By default, they have no permissions. You can grant them in the plugin metadata:

```typescript
export class SecurePlugin implements IPlugin {
  name = "secure-plugin";
  permissions = ["network"];
  allowedDomains = ["api.example.com"];

  async onLoad(context: PluginContext) {
    const data = await context.network.fetch("https://api.example.com/data");
  }
}
```

## License

MIT
