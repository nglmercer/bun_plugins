# Trigger System Developer Tools

This project includes a suite of tools to ensure rule validity and robustness.

## 1. CLI Validator

The CLI tool scans your `rules` directory (default `./rules`) for YAML files, validating their schema and checking for circular dependencies.

**Usage:**

```bash
bun run validate [directory]
```

**Example:**

```bash
bun run validate ./src/rules
```

**Checks Performed:**

- **Syntax**: Valid YAML structure.
- **Schema**: Valid fields, operators, and action types (via ArkType).
- **Semantics**:
  - Validates nested conditions.
  - Checks for Circular Dependencies (Rule A -> Rule B -> Rule A).

## 2. Language Server Protocol (LSP)

A standards-compliant LSP server is included for editor integration (e.g., VS Code).

**Server Entry Point:**
`src/lsp/server.ts`

**Features:**

- **Diagnostics**: Reports schema errors directly in the editor with red squiggles.
- **Suggestions**: Provides hints for fixing errors (e.g. "Did you mean 'field'?").
- **Incremental Sync**: Validates as you type.

### VS Code Integration

To use this LSP with VS Code, you can use a generic LSP client extension or configure a custom task. If developing an extension, point the `serverOptions` to:

```javascript
{
  run: { command: "bun", args: ["run", "/absolute/path/to/src/lsp/server.ts", "--stdio"] },
  debug: { command: "bun", args: ["run", "/absolute/path/to/src/lsp/server.ts", "--stdio"] }
}
```

## 3. Circular Dependency Detection

The system includes a static analyzer in `src/core/dependency-graph.ts`. It builds a directed graph of your rules based on:

- **Triggers**: What event a rule listens to (`on: "EVENT"`).
- **Emits**: What events a rule emits (via `EMIT_EVENT` action).

If a cycle is detected (A -> B -> A), the CLI validator will fail and report the cycle path.
