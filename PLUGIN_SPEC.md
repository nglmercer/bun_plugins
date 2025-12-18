# Bun Plugins System Specification

## Overview

This document outlines the architecture, data structures, and lifecycle of the Bun Plugin System.

## 1. Plugin Structure

Each plugin MUST adhere to the `IPlugin` interface.

### Metadata

- **`name`** (Required): Unique identifier for the plugin (e.g., `my-plugin`).
- **`version`** (Required): Semantic version string (e.g., `1.0.0`).
- **`description`** (Optional): Brief description of functionality.
- **`author`** (Optional): Author name or contact.

### Configuration

- **`configSchema`** (Optional): A Zod schema defining the configuration structure.
- **`defaultConfig`** (Optional): Default configuration values.

### Lifecycle Methods

- **`onLoad(context: PluginContext)`**: Called when the plugin is activated.
- **`onUnload()`**: Called when the plugin is deactivated or the app shuts down.

### Dependencies

To ensure proper functionality and load order:

- **`dependencies`**: A record of required plugin names and their semantic versions.
- **Load Order**: The `PluginManager` resolves the Directed Acyclic Graph (DAG) of dependencies to determine the execution order of `onLoad`.

### Permissions & Security

Plugins must explicitly request capabilities to ensure security and isolation:

- **`permissions`**: A list of required permissions (e.g., `network`, `filesystem`, `env`).
- **Isolation**: Plugins should run in a manner that protects the host process (e.g., preventing `process.exit()`).

## 2. Validation

Plugins are validated at runtime using Zod schemas.

- Invalid plugins are rejected with detailed error messages.
- Plugins providing `configSchema` will have their configuration validated automatically.

## 3. Storage System

Each plugin is provided with an isolated storage mechanism.

- **Namespace**: `storage/plugins/<plugin_name>/`
- **Capabilities**:
  - `get<T>(key: string, defaultValue?: T): Promise<T | undefined>`
  - `set<T>(key: string, value: T): Promise<void>`
  - `delete(key: string): Promise<void>`
  - `clear(): Promise<void>` (Scoped to the plugin)

## 4. Plugin Management

The `PluginManager` handles:

- **Discovery**: Scanning directories for plugins.
- **Registration**: Validating and registering plugins.
- **Dependency Resolution**: Calculating the topological sort order for loading.
- **Activation/Deactivation**:
  - Plugins can be persistently enabled/disabled via a global `plugins.json` manifest.
  - `enable(pluginName)`: Loads the plugin (and ensures dependencies are loaded).
  - `disable(pluginName)`: Unloads the plugin.

## 5. Hooks System (Interception)

To support active modification of system behavior (similar to Bun/esbuild), plugins can register hooks:

- **`setup(build: PluginBuilder)`**: Method to register load filters or other build-time hooks.
- **Hooks**:
  - `onResolve`: Change how a module is located.
  - `onLoad`: Change the content of a loaded module.
  - Network/FS interception hooks.

## 6. Error Handling & "Panic Recovery"

- **Isolation Zones**: If `onLoad` fails, the plugin is marked as `FAILED` but the application continues.
- **Timeouts**: Strict time limit (e.g., 5 seconds) for `onLoad`.

## 7. Inter-Plugin Communication (IPC)

Plugins can expose functionality to others:

- **`getSharedApi()`**: Returns an object exposing functions or data.
- **`context.getPlugin(name)`**: Allows a plugin to retrieve the shared API of another plugin.

## 8. Observability

- **Logging**: Dedicated `logger` in `PluginContext` (`context.log.info`) for namespaced logging.
- **Metrics**: Performance tracking for initialization and hook execution times.

## 9. Implementation Details

### Updated `IPlugin` Interface

```typescript
import { z } from "zod";

interface IPlugin {
  name: string;
  version: string;
  description?: string;
  author?: string;

  // Configuration
  configSchema?: z.ZodSchema;
  defaultConfig?: Record<string, any>;

  // 1. Dependencies
  dependencies?: Record<string, string>; // { "auth-plugin": "^1.2.0" }

  // 2. Permissions (Security)
  permissions?: ("network" | "filesystem" | "env")[];

  // 3. Priority (Optional - managed via dependencies usually)
  priority?: number;

  // Lifecycle
  onLoad(context: PluginContext): void | Promise<void>;
  onUnload(): void | Promise<void>;

  // 4. System Configuration Hook (Bun/esbuild style)
  setup?: (build: PluginBuilder) => void | Promise<void>;

  // 5. Shared API (IPC)
  getSharedApi?: () => unknown;
}
```

### Plugin Context

```typescript
interface PluginContext extends GenericContext {
  manager: PluginManager;
  storage: PluginStorage; // Scoped storage
  config: any; // Validated config

  // Event System
  emit(event: string, payload: any): void;
  on(event: string, callback: (payload: any) => void): void;

  // 5. Access to other plugins
  getPlugin(name: string): unknown | undefined;

  // Observability
  log: {
    info(msg: string, ...args: any[]): void;
    warn(msg: string, ...args: any[]): void;
    error(msg: string, ...args: any[]): void;
  };
}

// Placeholder for Builder interface
interface PluginBuilder {
  onResolve(filter: RegExp, callback: (args: any) => any): void;
  onLoad(filter: RegExp, callback: (args: any) => any): void;
}
```

## 10. Workers

Plugins may use Bun's `Worker` API to run CPU-intensive tasks in a separate thread.

- **Management**: To ensure proper resource cleanup, plugins SHOULD create workers via `context.createWorker(scriptUrl, options)`.
- **Lifecycle**: Workers created via the context will be automatically terminated when the plugin is unloaded.
- **Capabilities**: Full access to Bun's `Worker` features (postMessage, smol mode, etc.).

## 11. Public API

The package exports the following core components via `src/index.ts` to facilitate documentation generation and library usage:

- **`PluginManager`**: Main class for managing the plugin lifecycle.
- **`IPlugin`, `PluginContext`, `PluginBuilder`**: interfaces for defining plugins.
- **`JsonPluginStorage`**: Default storage implementation.
- **`pluginValidator`**: Utilities for validating plugin schemas.
