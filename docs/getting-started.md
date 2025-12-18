# Getting Started with Bun Plugin System

## Installation

```bash
bun add @nglmercer/bun_plugins
```

## Basic Usage

### 1. Initialize the Plugin Manager

```typescript
import { PluginManager } from "@nglmercer/bun_plugins";

const manager = new PluginManager("./storage");
await manager.loadPluginsFromDirectory("./plugins");
```

### 2. Create a Plugin

Create a file named `my-plugin.ts` in your plugins directory:

```typescript
import { IPlugin, PluginContext } from "@nglmercer/bun_plugins";

export const MyPlugin: IPlugin = {
  name: "my-plugin",
  version: "1.0.0",

  onLoad: async (context: PluginContext) => {
    context.log.info("Hello from MyPlugin!");

    context.events.on("app:ready", () => {
      context.log.info("Application is ready!");
    });
  },

  onUnload: async () => {
    console.log("Goodbye!");
  },
};
```

### 3. Using Hooks (Bun/esbuild integration)

```typescript
export const InternalBridge: IPlugin = {
  name: "bridge",
  version: "1.0.0",
  setup: (build) => {
    build.onResolve({ filter: /^virtual:/ }, (args) => {
      return { path: args.path, namespace: "virtual" };
    });

    build.onLoad({ filter: /.*/, namespace: "virtual" }, (args) => {
      return { contents: "export const val = 42;", loader: "js" };
    });
  },
  onLoad: () => {},
  onUnload: () => {},
};
```

## Running with Bun Plugin Bridge

If you want your plugins to intercept Bun's internal resolution/loading:

```typescript
import { PluginManager } from "@nglmercer/bun_plugins";

const manager = new PluginManager();
await manager.loadPluginsFromDirectory("./plugins");

// Bridge to Bun
Bun.plugin(manager.toBunPlugin());
```
