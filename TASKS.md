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
- [x] **Enforcement** - _Implemented for Native mode (network, env, domains gated). Isolated mode lacks domain filtering._
- [x] **Path Traversal Protection** - _Implemented (plugin name validation)_
- [x] **Isolation** - _Implemented (Bun Workers with RPC and graceful cleanup)_

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
- [x] **Global Event Bus** - _Implemented (Namespaced `events` in `PluginContext`)_

---

## Recommended Next Tasks

### High Priority (Stability & Distribution)

1. [x] **Worker Path Resilience**:

   - _Action_: Optimized path detection for .ts/.js environments.

2. [x] **Domain-based Network Filtering in Isolated Mode**:

   - _Action_: Added domain validation to the `network:fetch` case in `PluginManager.ts`.

3. [x] **Isolated Resource Leak Protection**:

   - _Action_: Implemented global loading timeouts and strict cleanup on failure.

4. [x] **Lifecycle Unification**:
   - _Action_: Ensure `onStarted` is called for both batch and individual registrations.

### Medium Priority (Developer Experience)

1. **Plugin CLI/Generator**:

   - Create a simple CLI or template to bootstrap new plugins with the correct structure and types.

2. [x] **Documentation Polish**:
   - [x] Sync `PLUGIN_SPEC.md` with implementation details.
   - [x] Generated API documentation in `/docs/`.
