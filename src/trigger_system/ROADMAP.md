# Trigger System Roadmap & Implementation Status

## 1. System Overview

The Trigger System is a generic, rule-based execution engine designed to handle event-driven automated workflows. It allows defining "Triggers" that listen for events, check conditions ("Rules"), and execute "Actions".

**Key Technologies:**

- **Runtime:** Bun
- **Validation:** ArkType (Optimized, recursive schema validation)
- **Configuration:** YAML / JSON
- **Parsing:** Custom Expression Engine

## 2. Implementation Status

### Core Components

| Component             | Status    | Description                                                                  |
| --------------------- | --------- | ---------------------------------------------------------------------------- |
| **Validator**         | 🟢 Stable | `src/domain/validator.ts`. Uses ArkType. Handles recursive conditions.       |
| **Type Definitions**  | 🟢 Stable | `src/types.ts`. Fully typed `TriggerRule`, `Action`, `Condition`.            |
| **Expression Engine** | 🟢 Stable | `src/core/expression-engine.ts`. Supports Math, Regex, Dates, interpolation. |
| **Rule Engine**       | 🟢 Stable | `src/core/rule-engine.ts`. Orchestrates matching. Supports Action Registry.  |
| **File Loader**       | 🟢 Stable | `src/io/loader.ts`. Supports `watchRules` for hot-reloading.                 |
| **Context Adapter**   | 🟢 Stable | `src/core/context-adapter.ts`. standardizes event payloads.                  |

### Features

| Feature                    | Status  | Notes                                                        |
| -------------------------- | ------- | ------------------------------------------------------------ |
| **Recursive Groups**       | ✅ Done | AND/OR groups can be nested infinitely.                      |
| **Action Modes**           | ✅ Done | SEQUENCE, ALL, EITHER (Random).                              |
| **Validation Suggestions** | ✅ Done | "Did you mean..?" hints for YAML errors.                     |
| **Dynamic Values**         | ✅ Done | Compare field against variables (e.g. `"${globals.limit}"`). |
| **Date/Regex Ops**         | ✅ Done | `SINCE`, `BEFORE`, `MATCHES` operators supported.            |
| **Extensible Actions**     | ✅ Done | `ActionRegistry` allows custom action handlers.              |

## 3. Immediate Priorities ("Make it Better")

### A. Agnostic Design Refinement

- [x] **Context Adapters**: Create standard adapters to normalize external events into `TriggerContext`.
- [x] **Action Registry**: A dynamic way to register action handlers.

### B. Robustness & Validation

- [x] Migrate to ArkType (Completed).
- [x] **Strict Typing**: Ensure `params` in Actions match the specific Action Type's schema.
- [ ] **Circular Dependency Detection**: Prevent rule loops.

### C. Developer Experience

- [ ] **CLI Tool**: `bun run validate-rules` to check YAML files during CI/CD.
- [ ] **Visualizer**: A simple web view to generate diagrams of complex rule chains.

## 4. Architecture Standards

- **Immutability**: Context data should be immutable during a rule execution pass.
- **Async First**: All actions should be treated as async to support I/O operations.
- **Fail-Safe**: One failing action should not crash the engine.

## 5. Future Roadmap

1. **Plugin System**: Allow third-party NPM packages to add Actions/Conditions.
2. **Dashboard**: Specific UI for managing active rules and viewing logs.
3. **Database Integration**: Optional persistence for stateful triggers.
