# Security & Permissions

## Permission-Based Access

Plugins must explicitly declare their required permissions in the `permissions` field.

| Permission   | Description                               |
| ------------ | ----------------------------------------- |
| `network`    | Allows using `context.network.fetch`.     |
| `filesystem` | Allows using `context.file(path)`.        |
| `env`        | Allows read-only access to `process.env`. |

### Domain Whitelisting

When using the `network` permission, plugins can further restrict access using `allowedDomains`:

```typescript
export const SecurePlugin: IPlugin = {
  name: "secure-plugin",
  permissions: ["network"],
  allowedDomains: ["api.example.com"],
  // ...
};
```

## Isolation Strategies

The system supports two levels of isolation:

1. **Native (Cooperative)**: Plugins run in the main thread. API access is restricted by the `PluginContext` wrappers, but global objects (e.g., `Bun`, `process`) are still accessible if not carefully managed.
2. **Worker (Process)**: Plugins run in separate `Bun.Worker` threads.
   - Communication is strictly via asynchronous RPC messages.
   - Filesystem access is blocked for isolated plugins.
   - Network access is proxied through the host with strict permission enforcement.
   - Crashes in a single plugin do not take down the main process.

## Path Traversal & Sanitization

- **Plugin Name Validation**: Plugin names cannot contain `..`, `/`, or `\` to prevent escaping the storage namespace.
- **Worker Script Resilience**: The system detects and validates the path to the internal `WorkerRunner` to ensure secure initialization of isolated processes.

## Resource Limits

The `PluginManager` enforces:

- **Load Timeouts**: Plugins have 5 seconds (default) to complete `onLoad`. This now applies to both Native and Isolated modes.
- **Early Manifest Check**: Isolated plugins must send their metadata (Manifest) before any RPC call (like fetch) is processed, ensuring permissions are verified from the start.
- **Automatic Cleanup**: Every worker, timer, and event listener created through the `context` is tracked and forcibly terminated when the plugin is unloaded or fails to load.

## Environment Security

Access to `process.env` via `context.env` returns a Read-Only proxy. Plugins cannot modify the host application's environment variables.
