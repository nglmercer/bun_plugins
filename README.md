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
  getApi() {
    return {
      query: (q: string) => `Result for ${q}`,
    };
  }
}

// Plugin B: Consumes the API
export class ConsumerPlugin implements IPlugin {
  name = "app-logic";
  async onLoad(context: PluginContext) {
    const db = await context.getPlugin("db-provider");
    const result = db.query("SELECT *");
  }
}
```

---

## 🎯 Type Safety & Autocompletion

The plugin system provides **full type safety and autocompletion** for inter-plugin communication using declaration merging.

### 📚 Complete Guide

For detailed documentation on the type system, see [`docs/types-guide.md`](docs/types-guide.md).

### 🚀 Quick Start

#### Step 1: Create a types file

Create a `.d.ts` file in your project (e.g., `plugins/types.d.ts`):

```typescript
import type { BasePluginApi } from "bun_plugins/src/types/plugin-registry-base";

// Define the API interface for your plugin
export interface MathPluginApi extends BasePluginApi {
  add(a: number, b: number): number;
  multiply(a: number, b: number): number;
}

// Extend the PluginFactory with your plugin
declare module "bun_plugins" {
  export interface PluginFactory {
    "math-plugin": {
      name: "math-plugin";
      version: "1.0.0";
      class: any;
      api: MathPluginApi;
    };
  }
}
```

#### Step 2: Register the API in your plugin

```typescript
import { Plugin, PluginContext } from "bun_plugins";

export class MathPlugin extends Plugin {
  name = "math-plugin";
  version = "1.0.0";

  override onLoad(context: PluginContext) {
    // Register the API for other plugins to use
    context.registerApi({
      add: this.add.bind(this),
      multiply: this.multiply.bind(this)
    });
  }

  add(a: number, b: number): number {
    return a + b;
  }
  
  multiply(a: number, b: number): number {
    return a * b;
  }
}
```

#### Step 3: Use with full autocompletion

```typescript
import { definePlugin } from "bun_plugins";

export default definePlugin({
  name: "my-app",
  version: "1.0.0",

  async onLoad(context) {
    // ✅ Full autocompletion and type safety!
    const mathPlugin = await context.getPlugin('math-plugin');
    
    if (mathPlugin) {
      const result = mathPlugin.add(1, 2); // ✅ Autocompletion works
      context.log.info(`Result: ${result}`);
      
      // TypeScript will show errors for non-existent methods
      // mathPlugin.nonExistentMethod(); // ❌ Error!
    }
  }
});
```

### ✨ Benefits

- 🎯 **Full Autocompletion**: Your IDE shows all available methods
- 🔒 **Type Safety**: TypeScript catches errors at compile time
- 📖 **Self-Documenting**: Interfaces serve as API documentation
- 🔄 **Refactor-Friendly**: Safe method renaming and refactoring
- 🌐 **Works with External Plugins**: Extend types for npm packages too

### 📖 Examples

- [`plugins/types.d.ts`](plugins/types.d.ts) - Complete example for this project
- [`plugins/TypedExamplePlugin.ts`](plugins/TypedExamplePlugin.ts) - Plugin using typed access
- [`examples/types-extension-example.d.ts`](examples/types-extension-example.d.ts) - Standalone example

### 🔧 TypeScript Configuration

Ensure your `tsconfig.json` includes the types file:

```json
{
  "include": [
    "src/**/*",
    "plugins/**/*",
    "**/*.d.ts"
  ]
}
```

### 💡 Tips

1. **Match names exactly**: The plugin name in `PluginFactory` must match `plugin.name`
2. **Register APIs**: Always use `context.registerApi()` to expose your plugin's API
3. **Extend BasePluginApi**: Your API interfaces should extend `BasePluginApi` for consistency
4. **External plugins**: You can extend types for third-party plugins the same way

---

##  License

MIT © [memelser](https://github.com/nglmercer)
