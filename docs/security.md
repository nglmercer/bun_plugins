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

## Path Traversal Protection

Plugin names are sanitized to prevent directory traversal attacks (e.g., using `..` in a plugin name to access storage of other components).

## Resource Limits

The `PluginManager` enforces:

- **Load Timeouts**: Plugins have 5 seconds (default) to complete `onLoad`.
- **Automatic Cleanup**: Every worker, timer, and event listener created through the `context` is tracked and forcibly terminated when the plugin is unloaded.

## Environment Security

Access to `process.env` via `context.env` returns a Read-Only proxy. Plugins cannot modify the host application's environment variables.
