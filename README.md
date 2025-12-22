# 🔌 Bun Plugins

A powerful, secure, and isolated plugin system designed specifically for **Bun** applications. Build extensible applications with fine-grained control over security, resource management, and inter-plugin communication.

[![NPM Version](https://img.shields.io/npm/v/bun_plugins.svg)](https://www.npmjs.com/package/bun_plugins)
[![License](https://img.shields.io/github/license/nglmercer/bun_plugins.svg)](LICENSE)
[![Bun](https://img.shields.io/badge/Bun-%23000000.svg?style=flat&logo=bun&logoColor=white)](https://bun.sh)

## 🌟 Key Features

- 🛡️ **Isolation**: Run plugins in dedicated Bun Workers for crash protection and security boundaries.
- 🔐 **Permission System**: Fine-grained control over Network (with whitelist), Filesystem, and Environment access.
- 🔄 **Communication RPC**: Seamless, proxy-based async communication between host and plugins.
- 🧹 **Automatic Resource Cleanup**: Automatically stops workers, clears timers, and removes event listeners when a plugin unloads.
- ✅ **Type Safe**: Fully written in TypeScript with Zod validation for plugin configurations.
- 🏗️ **Plugin Hooks**: Intercept resource loading with `onResolve` and `onLoad` hooks, fully compatible with Bun's native plugin API.
- 🔋 **Persistence**: Built-in JSON-based KV storage for each plugin.
- 🔥 **Hot Reloading**: Watch plugin directories and automatically reload changed plugins.
- 📦 **Dependency Management**: Cross-plugin dependencies with semver version checking.

---

## 🚀 Quick Start

### 1. Installation

```bash
bun add bun_plugins
```

### 2. Create your first Plugin

```typescript
import { type IPlugin, type PluginContext } from "bun_plugins";

export class MyPlugin implements IPlugin {
  name = "hello-world";
  version = "1.0.0";

  async onLoad(context: PluginContext) {
    context.log.info("Hello World Plugin Loaded!");

    // Listen to global app events
    context.on("app:ready", () => {
      context.log.info("The application is ready!");
    });

    // Expose functionality via events
    context.emit("plugin:hello", { message: "Hello from plugin!" });
  }
}
```

### 3. Initialize the Manager

```typescript
import { PluginManager } from "bun_plugins";
import { MyPlugin } from "./plugins/MyPlugin";

const manager = new PluginManager();

// Register a class instance
await manager.register(new MyPlugin());

// Emit an event to all plugins
manager.emit("app:ready", {});
```

---

## 🛠️ Core Concepts

### 🧩 The Plugin Interface (`IPlugin`)

All plugins must implement the `IPlugin` interface.

| Property         | Type                 | Description                                                     |
| :--------------- | :------------------- | :-------------------------------------------------------------- |
| `name`           | `string`             | Unique identifier for the plugin.                               |
| `version`        | `string`             | Semver compatible version.                                      |
| `permissions`    | `PluginPermission[]` | List of requested permissions (`network`, `filesystem`, `env`). |
| `allowedDomains` | `string[]`           | Whitelist for network access.                                   |
| `configSchema`   | `ZodSchema`          | Zod schema for configuration validation.                        |
| `onLoad`         | `(ctx) => void`      | Primary entry point for plugin logic.                           |
| `onUnload`       | `() => void`         | Cleanup logic when plugin is removed.                           |

### 🧪 Plugin Context (`PluginContext`)

The `context` provided to `onLoad` is the primary way plugins interact with the host.

- 📝 **`context.log`**: Scoped logging (`info`, `warn`, `error`).
- 📡 **`context.events`**: typed event bus (`emit`, `on`).
- 📦 **`context.storage`**: Persistent JSON storage (`get`, `set`, `delete`).
- 🌐 **`context.network`**: Safe `fetch` implementation (requires 'network' permission).
- 📂 **`context.file`**: Access Bun's `File` API (requires 'filesystem' permission).
- 🔐 **`context.env`**: Read-only access to environment variables (requires 'env' permission).
- ⏲️ **`context.setTimeout/Interval`**: Automatically cleaned up on unload.

---

## 🔒 Security & Permissions

Plugins are restricted by default. To access sensitive APIs, you must explicitly declare permissions:

```typescript
export class NetworkPlugin implements IPlugin {
  name = "weather-fetcher";
  version = "1.0.0";

  // Request network access
  permissions = [PluginPermission.Network];
  // Whitelist specific domains
  allowedDomains = ["api.weather.com"];

  async onLoad(context: PluginContext) {
    // This works
    const data = await context.network.fetch(
      "https://api.weather.com/v1/forecast"
    );

    // This throws AccessDeniedError (not in whitelist)
    await context.network.fetch("https://malicious.com");
  }
}
```

---

## 🧊 Isolated Worker Plugins

For maximum security and stability, you can load plugins into dedicated workers. These plugins run in a separate process and communicate via RPC.

```typescript
// Load a plugin from a file into a worker
await manager.registerIsolated(
  "./plugins/ExternalPlugin.ts",
  "isolated-plugin"
);
```

---

## 🔌 Native Bun Integration

`bun_plugins` can act as a bridge to Bun's native plugin system, allowing your library plugins to handle your application's module resolution.

```typescript
// In your entry point
const manager = new PluginManager();
await manager.loadPluginsFromDirectory();

// Register as a native Bun plugin
Bun.plugin(manager.toBunPlugin());
```

---

## 🤝 Inter-Plugin Communication

Plugins can share APIs with each other safely:

```typescript
// Plugin A: Exposes an API
export class ProviderPlugin implements IPlugin {
  name = "db-provider";
  getSharedApi() {
    return {
      query: (q: string) => `Result for ${q}`,
    };
  }
}

// Plugin B: Consumes the API
export class ConsumerPlugin implements IPlugin {
  name = "app-logic";
  async onLoad(context: PluginContext) {
    const db = context.getPlugin("db-provider");
    const result = db.query("SELECT *");
  }
}
```

---

## 📜 License

MIT © [memelser](https://github.com/nglmercer)
