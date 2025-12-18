# Architecture & Design

## Modular Design

The system is split into specialized managers:

- **`PluginManager`**: Orchestrates everything and provides the public API.
- **`DependencyManager`**: Resolves the Directed Acyclic Graph (DAG) for load order and validates SemVer.
- **`HooksManager`**: Manages `onResolve` and `onLoad` hooks, providing a waterfall pipeline for content modification.
- **`ResourceManager`**: Tracks all workers, timers, and listeners created by plugins to ensure 100% cleanup on unload.
- **`ContextFactory`**: Creates the restricted execution environment for each plugin.

## Security & Isolation

We support two levels of isolation:

1. **Cooperative Isolation (Default)**: Plugins run in the main thread but are restricted by the `PluginContext` proxy.
2. **Worker Isolation**: Plugins run in a dedicated `Bun.Worker`. Communication happens via RPC. This prevents a plugin from freezing the main thread.

## Hook Pipeline

The `onLoad` hooks follow a waterfall pattern:

1. All matching hooks are collected and sorted by priority (`pre` -> default -> `post`).
2. Each hook receives the `previousContents` from the previous hook in the pipeline.
3. The final result is returned to Bun/Esbuild.

## Lifecycle Flow

1. **Discovery**: Scan directories.
2. **Validation**: Validate structure and Zod schemas.
3. **Sort**: Topological sort based on `dependencies`.
4. **Register**:
   - Initialize storage.
   - Initialize resource tracking.
   - Run `setup(build)` to register hooks.
   - Run `onLoad(context)`.
5. **Start**: Run `onStarted()` for all plugins in the batch.
