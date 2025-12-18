# Plugin System Implementation Status

This document tracks the implementation status of features defined in `PLUGIN_SPEC.md` versus the current codebase.

## 1. Plugin Structure & Metadata

- [x] **Core Interface** (`name`, `version`, `description`, `author`) - _Implemented in types/validator_
- [x] **Configuration** (`configSchema`, `defaultConfig`) - _Implemented with Zod validation_
- [x] **Lifecycle Methods** (`onLoad`, `onUnload`) - _Implemented_

## 2. Dependencies

- [x] **Definition** (`dependencies` field) - _Implemented_
- [x] **Load Order Resolution (DAG)** - _Implemented in PluginManager_
- [x] **Missing Dependency Check** - _Implemented_

## 3. Permissions & Security

- [x] **Permissions Definition** (`permissions` field) - _Implemented in types and schema_
- [x] **Enforcement** - _Implemented via restricted `PluginContext` (network.fetch, env)_
- [x] **Path Traversal Protection** - _Implemented (plugin name validation)_
- [x] **Isolation** - _Implemented (Bun Workers with RPC)_

## 4. Storage System

- [x] **Isolated Storage** (JSON file per plugin) - _Implemented (`JsonPluginStorage`)_
- [x] **CRUD Operations** (`get`, `set`, `delete`, `clear`) - _Implemented_

## 5. Plugin Management

- [x] **Discovery** (Scanning folders) - _Implemented_
- [x] **Registration** - _Implemented_
- [x] **Activation/Deactivation** (`enable`/`disable`) - _Implemented_
- [x] **Persistence** (`plugins.json`) - _Implemented_

## 6. Hooks System (Interception)

- [x] **`setup(build)` method** - _Implemented (`IPlugin.setup`)_
- [x] **Hook Priority** (`pre` | `post` | default) - _Implemented_
- [x] **`PluginBuilder` Interface** - _Implemented_
- [x] **Hooks Logic** (`onResolve`, `onLoad`) - _Implemented (Hooks registry & execution methods)_

## 7. Error Handling

- [x] **Load Failure Recovery** - _Implemented_
- [x] **Timeouts** (e.g. 5s limit for `onLoad`) - _Implemented (5000ms default)_

## 8. IPC (Inter-Plugin Communication)

- [x] **Shared API** (`getSharedApi`) - _Implemented_
- [x] **Access Method** (`context.getPlugin()`) - _Implemented_

## 9. Observability

- [x] **Scoped Logging** (`context.log`) - _Implemented_
- [x] **Performance Metrics** (Init time tracking) - _Implemented_

## 10. Workers & Resources

- [x] **Capabilities**: Full access to Bun's `Worker` features.

## 11. Public API & Refactoring

- [x] **Centralized Exports** - _Implemented in `src/index.ts`_
- [x] **Cleanup** - _Removed redundant `index.ts` entry points_

## 12. Future / Planned (Roadmap)

- [x] **Runtime Isolation** - _Implemented (Plugins run in Worker threads, hooks/events proxied via RPC)_
- [x] **Hooks Pipeline** - _Implemented (onLoad uses waterfall pipeline, onResolve matches first)_
- [x] **Global Event Bus** - _Implemented (Bi-directional IPC between Main and Workers)_

---

## Recommended Next Tasks

### High Priority (Stability & Correctness)

1. **Connect Hooks to Runtime**:

   - The `PluginBuilder` interface exists, but `PluginManager.runOnResolve` / `runOnLoad` are not automatically connected to `Bun.plugin` or the application's build process.
   - _Action_: Create a bridge function `manager.toBunPlugin()` that returns a Bun-compatible plugin object invoking the internal hooks.

2. **Fix "Zombie Worker" & Isolation Risks**:

   - Current `onLoad` runs in the main thread. A synchronous infinite loop will freeze the host.
   - _Action_: Refactor `onLoad` to run inside a `Bun.Worker` if strict isolation is required, or strictly document that plugins serve as "trusted middleware" (Cooperative Multitasking).
   - _Refinement_: Ensure `manager.pluginResources` consistently tracks all resources even if `onLoad` crashes violently.

3. **Robust Config Validation**:
   - _Action_: Implement "Safe Mode" or simple migration check. If `configSchema` fails validation on boot (due to updates), disable the plugin or load with default config, logging a critical error, instead of crashing the `PluginManager`.

### Medium Priority (Features)

1. **Global Event Bus (Pub/Sub)**:

   - Implement `emit` / `on` in `PluginManager` and expose strictly namespaced versions in `PluginContext`.
   - Events: `plugin:loaded`, `plugin:unloaded`, `app:ready`.

2. **SemVer Dependency Resolution**:

   - Improve the current simple version check to use a full SAT solver or more robust `semver` logic if complex dependency trees arise (currently simple DAG + `semver.satisfies`).

3. **Hot Reloading**:
   - Implement a file watcher on the `plugins/` directory to automatically call `reloadPlugin(name)` on change.
