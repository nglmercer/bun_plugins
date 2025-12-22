# all context



<!-- FILE: API_REFERENCE.md -->

# Archivo: API_REFERENCE.md

# 📖 API Reference

Complete technical documentation for all classes, interfaces, and types in the Agnostic Trigger System.

## Core Classes

### RuleEngine

The main engine that processes events and executes rules.

```typescript
import { RuleEngine, RuleEngineConfig } from "trigger_system";

class RuleEngine {
  constructor(config: RuleEngineConfig);

  // Event Processing
  processEvent(
    eventType: string,
    data?: Record<string, unknown>,
    globals?: Record<string, unknown>
  ): Promise<TriggerResult[]>;
  evaluateContext(context: TriggerContext): Promise<TriggerResult[]>;

  // Rule Management
  updateRules(newRules: TriggerRule[]): void;
  getRules(): TriggerRule[];
}
```

#### RuleEngineConfig

```typescript
interface RuleEngineConfig {
  rules: TriggerRule[];
  globalSettings: GlobalSettings;
}

interface GlobalSettings {
  debugMode?: boolean;
  evaluateAll?: boolean; // If true, continue checking rules after a match
  strictActions?: boolean; // If true, throw error on unknown actions
}
```

### TriggerLoader (Node.js/Bun Only)

A static utility class for loading rules from the file system.

```typescript
import { TriggerLoader } from "trigger_system/node";

class TriggerLoader {
  // Load all .yaml files from a directory (recursive)
  static loadRulesFromDir(dirPath: string): Promise<TriggerRule[]>;

  // Load logic from a single file
  static loadRule(filePath: string): Promise<TriggerRule[]>;

  // Watch a directory for changes and reload rules
  static watchRules(
    dirPath: string,
    onUpdate: (rules: TriggerRule[]) => void
  ): FSWatcher;
}
```

## Types and Interfaces

### TriggerRule

The primary data structure representing a business logic rule.

```typescript
interface TriggerRule extends RuleMetadata {
  on: string; // Event name to listen for
  if?: RuleCondition | RuleCondition[]; // Condition(s) to evaluate
  do: Action | Action[] | ActionGroup; // Action(s) to execute
}

interface RuleMetadata {
  id: string;
  name?: string;
  description?: string;
  priority?: number; // Higher number = Higher priority
  enabled?: boolean;
  cooldown?: number; // Milliseconds
  tags?: string[];
}
```

### Condition

Conditions are used to evaluate whether a rule should fire.

```typescript
type RuleCondition = Condition | ConditionGroup;

interface Condition {
  field: string; // Dot-notation path (e.g., "data.user.id")
  operator: ComparisonOperator;
  value: ConditionValue; // Value to compare against
}

interface ConditionGroup {
  operator: "AND" | "OR";
  conditions: (Condition | ConditionGroup)[];
}

type ComparisonOperator =
  | "EQ"
  | "=="
  | "NEQ"
  | "!="
  | "GT"
  | ">"
  | "GTE"
  | ">="
  | "LT"
  | "<"
  | "LTE"
  | "<="
  | "IN"
  | "NOT_IN"
  | "CONTAINS"
  | "MATCHES"
  | "SINCE"
  | "AFTER"
  | "BEFORE"
  | "UNTIL"
  | "RANGE";
```

### Action

Actions define what happens when a rule matches.

```typescript
interface Action {
  type: string; // Action identifier (e.g., "send_email")
  params?: ActionParams; // Key-value parameters
  delay?: number; // Execution delay in ms
  probability?: number; // 0.0 to 1.0
}

interface ActionGroup {
  mode: "ALL" | "EITHER" | "SEQUENCE";
  actions: Action[];
}
```

### TriggerContext

The context object passed through the engine during evaluation.

```typescript
interface TriggerContext {
  event: string;
  timestamp: number;
  data: Record<string, unknown>;
  globals?: Record<string, unknown>;
  state?: Record<string, unknown>;
  id?: string;
}
```

### TriggerResult

The outcome of a rule processing cycle.

```typescript
interface TriggerResult {
  ruleId: string;
  success: boolean;
  executedActions: ExecutedAction[];
  error?: Error;
}

interface ExecutedAction {
  type: string;
  result?: unknown;
  error?: unknown;
  timestamp: number;
  skipped?: string;
}
```

## SDK Classes

Helper classes for building and exporting rules programmatically.

### RuleBuilder

A fluent builder for creating strict TypeScript rules.

```typescript
import { RuleBuilder } from "trigger_system/sdk";

class RuleBuilder {
  constructor();

  // Metadata
  withId(id: string): this;
  withName(name: string): this;
  withDescription(desc: string): this;
  withPriority(p: number): this;
  withCooldown(ms: number): this;
  withTags(tags: string[]): this;

  // Trigger
  on(event: string): this;

  // Conditions
  if(field: string, op: ComparisonOperator, value: any): this;

  // Complex Conditions (Groups)
  ifComplex(sub: (b: ConditionBuilder) => ConditionBuilder): this;

  // Actions
  do(
    type: string,
    params?: ActionParams,
    options?: { delay?: number; probability?: number }
  ): this;

  // Complex Actions (Groups/Sequences)
  doComplex(sub: (b: ActionBuilder) => ActionBuilder): this;

  // Finalize
  build(): TriggerRule;
}
```

### RuleExporter

Utilities for converting rules to standard formats.

```typescript
import { RuleExporter } from "trigger_system/sdk";

class RuleExporter {
  static toYaml(rule: TriggerRule | TriggerRule[]): string;

  // Node.js only
  static saveToFile(
    rules: TriggerRule | TriggerRule[],
    path: string
  ): Promise<void>;
}
```

## Observability

The system uses a global event emitter for tracking execution flow.

```typescript
import { triggerEmitter, EngineEvent } from 'trigger_system';

// Events
triggerEmitter.on(EngineEvent.RULE_MATCH, ({ rule, context }) => { ... });
triggerEmitter.on(EngineEvent.ACTION_SUCCESS, ({ action, result }) => { ... });
triggerEmitter.on(EngineEvent.ACTION_ERROR, ({ action, error }) => { ... });

// Event Types enum
enum EngineEvent {
  ENGINE_START = 'engine:start',
  ENGINE_DONE = 'engine:done',
  RULE_MATCH = 'rule:match',
  ACTION_SUCCESS = 'action:success',
  ACTION_ERROR = 'action:error',
  // ...
}
```

## Error Handling

### Validation Errors

Occur when loading rules that don't match the schema. These are typically logged to stderr by the `TriggerLoader`.

### Execution Errors

Occur during `processEvent`. They do not stop the engine unless uncaught. They are reported in `TriggerResult.error` and via `triggerEmitter`.


<!-- END FILE: API_REFERENCE.md -->

---

<!-- FILE: ARCHITECTURE.md -->

# Archivo: ARCHITECTURE.md

# 🧩 Architecture

This document describes the internal architecture of the Agnostic Trigger System, including system design, core components, and data flow.

## System Overview

The Agnostic Trigger System is built with a modular architecture that separates concerns into distinct layers:

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│  │   Express   │  │  WebSocket  │  │    CLI      │       │
│  │    App      │  │   Server    │  │   Tools     │       │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘       │
│         │                 │                 │               │
└─────────┼─────────────────┼─────────────────┼───────────────┘
          │                 │                 │
┌─────────┼─────────────────┼─────────────────┼───────────────┐
│         ▼                 ▼                 ▼               │
│                 SDK Layer (Public API)                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│  │ RuleBuilder │  │RuleExporter │  │ RuleEngine  │       │
│  │             │  │             │  │             │       │
│  └─────────────┘  └─────────────┘  └──────┬──────┘       │
│                                             │               │
└─────────────────────────────────────────────┼───────────────┘
                                              │
┌─────────────────────────────────────────────┼───────────────┐
│                         ▼                   │               │
│                 Core Engine Layer             │               │
│  ┌─────────────┐  ┌─────────────┐  ┌──────┴──────┐       │
│  │TriggerLoader│  │Expression   │  │Action       │       │
│  │(Static)     │  │Engine       │  │Registry     │       │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘       │
│         │                 │                 │               │
│  ┌──────┴──────┐  ┌──────┴──────┐  ┌──────┴──────┐       │
│  │StateManager │  │Dependency   │  │trigger      │       │
│  │             │  │Analyzer     │  │Emitter      │       │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘       │
│         │                 │                 │               │
└─────────┼─────────────────┼─────────────────┼───────────────┘
          │                 │                 │
┌─────────┼─────────────────┼─────────────────┼───────────────┐
│         ▼                 ▼                 ▼               │
│                Infrastructure Layer                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│  │Persistence  │  │Node/Browser │  │ArkType      │       │
│  │Adapters     │  │IO           │  │Validator    │       │
│  └─────────────┘  └─────────────┘  └─────────────┘       │
└─────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. RuleEngine

The central orchestrator that coordinates all other components.

**Responsibilities:**

- Context evaluation
- Rule matching logic
- Coordination of action execution logic

**Key Methods:**

- `processEvent(event, data)` - Main entry point
- `evaluateContext(context)` - Core evaluation loop
- `updateRules(rules)` - Hot swap rules

### 2. TriggerLoader (Node.js)

A static utility class responsible for loading and validating rules from the file system.

**Features:**

- YAML/JSON parsing
- Directory walking
- File watching (`watchRules`)
- Integration with `TriggerValidator`

### 3. ExpressionEngine

Static utility that evaluates conditions and interpolated strings.

**Capabilities:**

- Nested field access (`data.user.id`)
- Variable interpolation (`${data.value}`)
- Condition Operator logic (`EQ`, `GT`, `MATCHES`...)

### 4. ActionRegistry

Singleton registry that maps action types strings (e.g., "send_email") to handler functions.

**Features:**

- Global registration
- Handler lookup
- Default handlers

### 5. StateManager

Singleton that holds the current state of the application for stateful rules.

**Capabilities:**

- In-memory state storage
- Persistence layer integration (load/save)
- Global state access

### 6. DependencyAnalyzer

Static analysis tool to detect cycles and dependencies between rules (based on state keys read/written).

### 7. triggerEmitter

Global Event Emitter for observability. Emits events like `rule:match`, `action:success`, `engine:start`.

## Data Flow

### Event Processing Flow

```
Event Fired (processEvent)
    │
    ▼
┌─────────────────┐
│  Context Setup  │
│  - User Data    │
│  - Globals      │
│  - Current State│
└────────┬────────┘
         │
    ▼
┌─────────────────┐
│ Rule Matching   │
│  - Filter (on)  │
│  - Cooldown     │
└────────┬────────┘
         │
    ▼
┌─────────────────┐
│ Condition       │
│ Evaluation      │
│  - Expression   │
│    Engine       │
└────────┬────────┘
         │
    ▼
┌─────────────────┐
│ Action          │
│ Execution       │
│  - Registry     │
│  - Handlers     │
└────────┬────────┘
         │
    ▼
┌─────────────────┐
│ Events Emitted  │
│  - rule:match   │
│  - action:done  │
└─────────────────┘
```

## State Management

State is managed via the `StateManager` singleton and accessed in rules.

1. **Initialization**: State loaded from persistence provider.
2. **Access**: Rules read state via `state.*` paths.
3. **Modification**: Rules allow `state_set`, `state_increment` actions (or custom logic).
4. **Persistence**: `FilePersistence` or `BrowserPersistence` saves state changes.

## Performance Considerations

1. **Rule Indexing**: Rules are sorted by priority.
2. **Lazy Evaluation**: `OR` conditions short-circuit.
3. **Regex Compilation**: `ExpressionEngine` creates RegEx objects on the fly (consider caching for high volume).

## Security Considerations

### Input Validation

- `TriggerValidator` uses `ArkType` to strictly validate rule schemas at load time.
- Runtime data is treated as untrusted and accessed safely via `ExpressionEngine`.

### Access Control

- Action Handlers are the boundary. Ensure your action handlers validate inputs/permissions before performing sensitive operations (DB writes, API calls).


<!-- END FILE: ARCHITECTURE.md -->

---

<!-- FILE: developer_tools.md -->

# Archivo: developer_tools.md

# 🛠️ Developer Tools

This guide covers the various tools available to help you build, debug, and maintain your trigger rules.

## CLI Validator

The CLI validator (`src/cli/validate.ts`) checks your rule files for semantic errors and circular dependencies.

### Basic Usage

The `validate` script is pre-configured in `package.json`:

```bash
# Default: Validates rules in ./rules directory
bun run validate

# Custom Directory
bun run src/cli/validate.ts ./my_rules_dir
```

### Validation Output

The validator relies on `TriggerLoader` to parse and validate rules. If `arktype` validation fails, errors are printed to `stderr`.

```bash
$ bun run validate

🔍 Validating Rules in: /abs/path/to/rules
==================================================

[TriggerLoader] ⚠️ Validation Problem in rules/bad.yaml (item #1)
  - [do] actions is required
  - [on] must be a string

📊 Summary:
   - Loaded Rules: 5
   - ⚠️ No valid rules found (or all failed validation).

🔄 Checking for Circular Dependencies...
   - ✅ No cycles found.
```

### Circular Dependency Detection

The validator uses `DependencyAnalyzer` to check if rules form an infinite loop (e.g., A triggers B, B triggers A). This is run automatically during validation.

If a cycle is found:

```bash
❌ Error: Circular Dependencies Detected!
   [Cycle #1] rule-a -> rule-b -> rule-a
```

## VS Code LSP Integration

The Language Server Protocol provides IDE support for trigger rule files.

### Installation

Install the VS Code extension from the marketplace or build it locally:

```bash
cd vscode-extension
npm install
npm run package
code --install-extension trigger-system-*.vsix
```

### Features

#### Syntax Highlighting & Auto-completion

- Event name suggestions
- Operator completion (`EQ`, `GT`, `MATCHES`...)
- Action hints

#### Hover Information

- Field type information
- Rule metadata

### Configuration

Add to your VS Code settings:

```json
{
  "triggerSystem.enableDiagnostics": true,
  "triggerSystem.validation.strict": false
}
```

## Debugging Rules

### Rule Execution Tracing

To debug rules at runtime, you can attach listeners to the `triggerEmitter`.

```typescript
import { RuleEngine, triggerEmitter, EngineEvent } from "trigger_system";

const engine = new RuleEngine({
  rules: [],
  globalSettings: { debugMode: true },
});

// Trace rule execution
triggerEmitter.on(EngineEvent.RULE_MATCH, ({ rule, context }) => {
  console.log(`🎯 Rule matched: ${rule.id} for event: ${context.event}`);
});

triggerEmitter.on(EngineEvent.ACTION_SUCCESS, ({ action, result }) => {
  console.log(`✅ Action executed: ${action.type}`, result);
});

triggerEmitter.on(EngineEvent.ACTION_ERROR, ({ action, error }) => {
  console.error(`❌ Action failed: ${action.type}`, error);
});
```

### Performance Metrics

The engine can collect metrics if you implement a collection system listening to events.

```typescript
// Example custom metrics collector
let processedCount = 0;
let matchCount = 0;

triggerEmitter.on(EngineEvent.ENGINE_DONE, () => {
  processedCount++;
});

triggerEmitter.on(EngineEvent.RULE_MATCH, () => {
  matchCount++;
});

setInterval(() => {
  console.log(`Events: ${processedCount}, Matches: ${matchCount}`);
}, 60000);
```

## Hot Reload

You can implement hot reloading using `TriggerLoader.watchRules`.

```typescript
import { TriggerLoader } from "trigger_system/node";

// Watch returns a FSWatcher
TriggerLoader.watchRules("./rules", (newRules) => {
  console.log("Rules updated!", newRules.length);
  engine.updateRules(newRules);
});
```


<!-- END FILE: developer_tools.md -->

---

<!-- FILE: EXAMPLES_GUIDE.md -->

# Archivo: EXAMPLES_GUIDE.md

# 💡 Step-by-Step Examples

This guide provides progressive tutorials to help you learn the Agnostic Trigger System through practical examples.

## 1.0 Basic Rule

Let's start with the simplest possible rule.

### The Rule

Create `rules/welcome.yaml`:

```yaml
- id: "welcome-new-user"
  on: "USER_REGISTERED"
  do:
    type: "log_message"
    params:
      message: "New user registered: ${data.userId}"
```

### Testing the Rule

```typescript
import { RuleEngine } from "trigger_system";
import { TriggerLoader } from "trigger_system/node";

const rules = await TriggerLoader.loadRulesFromDir("./rules");
const engine = new RuleEngine({ rules, globalSettings: {} });

// Fire the event
await engine.processEvent("USER_REGISTERED", {
  userId: "user123",
  email: "user@example.com",
});

// Output: "New user registered: user123"
```

### What We Learned

- Rules listen for specific events (`on: "USER_REGISTERED"`)
- Actions are executed when events fire (`do: "log_message"`)
- Data is accessible via `${data.fieldName}` syntax

## 1.1 Multiple Conditions

Now let's add conditions to make our rules more selective.

### Simple Condition

```yaml
- id: "welcome-premium-user"
  on: "USER_REGISTERED"
  if:
    field: "data.plan"
    operator: "EQ"
    value: "premium"
  do:
    type: "log_message"
    params:
      message: "Premium user registered: ${data.userId}"
```

### Multiple Conditions

```yaml
- id: "high-value-transaction"
  on: "TRANSACTION_PROCESSED"
  if:
    operator: "AND"
    conditions:
      - field: "data.amount"
        operator: "GT"
        value: 1000
      - field: "data.currency"
        operator: "EQ"
        value: "USD"
      - field: "data.status"
        operator: "EQ"
        value: "completed"
  do:
    type: "send_alert"
    params:
      message: "High value transaction: $${data.amount}"
      priority: "high"
```

### OR Conditions

```yaml
- id: "important-user-activity"
  on: "USER_ACTIVITY"
  if:
    operator: "OR"
    conditions:
      - field: "data.userType"
        operator: "EQ"
        value: "premium"
      - field: "data.vipStatus"
        operator: "EQ"
        value: true
      - field: "data.accountAge"
        operator: "LT"
        value: 7 # New users (less than 7 days)
  do:
    type: "track_activity"
    params:
      userId: "${data.userId}"
      priority: "high"
```

### Complex Logic

```yaml
- id: "fraud-detection"
  on: "TRANSACTION_INITIATED"
  if:
    operator: "AND"
    conditions:
      - operator: "OR"
        conditions:
          - field: "data.amount"
            operator: "GT"
            value: 5000
          - field: "data.foreignTransaction"
            operator: "EQ"
            value: true
      - field: "data.userAccountAge"
        operator: "LT"
        value: 30
  do:
    type: "flag_for_review"
    params:
      transactionId: "${data.transactionId}"
      reason: "potential_fraud"
```

## 1.2 Advanced Operators

Explore the full range of comparison operators.

### String Operations

```yaml
- id: "email-validation"
  on: "USER_REGISTERED"
  if:
    field: "data.email"
    operator: "MATCHES"
    value: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"
  do:
    type: "mark_email_valid"
    params:
      userId: "${data.userId}"
```

### Array Operations

```yaml
- id: "admin-privileges"
  on: "PERMISSION_CHECK"
  if:
    field: "data.userRole"
    operator: "IN"
    value: ["admin", "moderator", "superuser"]
  do:
    type: "grant_admin_access"
    params:
      userId: "${data.userId}"
```

### Existence Checks

Existence checks are handled via nullable checks or custom functions, or implicitly if a field is missing it might return null/undefined which EQ null can check, but explicit `NOT_EXISTS` is better handled by your custom expression logic or by checking against null if supported.

_Note: NOT_EXISTS / EXISTS operators are not in the core set but can be emulated or added via plugins._

## 1.3 Stateful Counters

Learn to use state to track information across multiple events.

### Simple Counter

```yaml
- id: "login-attempt-counter"
  on: "LOGIN_ATTEMPT"
  do:
    - type: "state_increment"
      params:
        key: "login_attempts.${data.userId}"
    - type: "log_message"
      params:
        message: "Login attempt ${state.login_attempts.${data.userId}} for user ${data.userId}"
```

## 1.4 Action Groups

Execute multiple actions in sequence.

### Basic Multi-Action

```yaml
- id: "user-onboarding"
  on: "USER_REGISTERED"
  do:
    - type: "log_event"
      params:
        event: "user_registration"
        userId: "${data.userId}"
    - type: "create_user_profile"
      params:
        userId: "${data.userId}"
        email: "${data.email}"
```

## 2.0 SDK Usage

Create rules programmatically using the TypeScript SDK.

### Basic Rule Builder

```typescript
import { RuleBuilder } from "trigger_system/sdk";

// Create a simple rule
const welcomeRule = new RuleBuilder()
  .withId("sdk-welcome-rule")
  .on("USER_REGISTERED")
  .if("data.plan", "EQ", "premium")
  .do("send_email", {
    template: "welcome_premium",
    subject: "Welcome to Premium!",
  })
  .build();

console.log(welcomeRule);
```

### Complex Rule with SDK

```typescript
const complexRule = new RuleBuilder()
  .withId("sdk-fraud-detection")
  .on("TRANSACTION_INITIATED")
  .if("data.amount", "GT", 1000)
  .if("data.userAccountAge", "LT", 30)
  .if("data.foreignTransaction", "EQ", true)
  .do("flag_for_review", {
    reason: "potential_fraud",
    priority: "high",
  })
  .do("send_alert", {
    channels: ["email", "slack"],
    severity: "warning",
  })
  .withTags(["fraud", "security"])
  .build();
```

### Dynamic Rule Generation

```typescript
function createThresholdRule(
  eventType: string,
  field: string,
  threshold: number,
  actionType: string
) {
  return new RuleBuilder()
    .withId(`${eventType}-${field}-threshold`)
    .on(eventType)
    .if(field, "GT", threshold)
    .do(actionType, {
      threshold,
      field,
      eventType,
    })
    .build();
}

// Generate multiple rules
const rules = [
  createThresholdRule("CPU_USAGE", "data.cpu", 80, "alert_high_cpu"),
  createThresholdRule("MEMORY_USAGE", "data.memory", 90, "alert_high_memory"),
];
```

### Export to YAML

```typescript
import { RuleExporter } from "trigger_system/sdk";

// Export single rule
const yaml = RuleExporter.toYaml(welcomeRule);
console.log(yaml);

// Save to file (Node.js)
await RuleExporter.saveToFile(
  [welcomeRule, complexRule],
  "./rules/generated.yaml"
);
```

## Best Practices from Examples

### 1. Start Simple

Begin with basic rules and gradually add complexity.

### 2. Use Descriptive Names

`id: "high-value-transaction-alert"` vs `id: "rule1"`.

### 3. Handle Errors Gracefully

Ensure your custom action handlers interpret errors correctly or use `.catch()` in your async action logic.


<!-- END FILE: EXAMPLES_GUIDE.md -->

---

<!-- FILE: GETTING_STARTED.md -->

# Archivo: GETTING_STARTED.md

# 🚀 Getting Started

This guide will help you install and start using the Agnostic Trigger System in your TypeScript/Bun application.

## Installation

```bash
npm install trigger_system
# or
bun add trigger_system
```

## Basic Concepts

The Agnostic Trigger System is an event-driven rule engine that allows you to define business logic in YAML files. Here are the core concepts:

- **Triggers**: Events that fire when certain conditions are met
- **Rules**: YAML definitions that specify when triggers should fire and what actions to take
- **Actions**: Operations performed when a rule matches
- **State**: Persistent data that can be modified and accessed across rule executions

## Your First Rule

Create a file `rules/welcome.yaml`:

```yaml
id: "welcome-message"
on: "USER_REGISTERED"
if:
  field: "data.plan"
  operator: "EQ"
  value: "premium"
do:
  type: "send_email"
  params:
    template: "welcome_premium"
    subject: "Welcome to Premium!"
```

## Running the Engine

### Basic Setup (Node.js/Bun)

```typescript
import { RuleEngine } from "trigger_system";
import { TriggerLoader } from "trigger_system/node";

// 1. Load rules from your directory
const rules = await TriggerLoader.loadRulesFromDir("./rules");

// 2. Initialize the engine
const engine = new RuleEngine({
  rules: rules,
  globalSettings: { debugMode: true },
});

// 3. Process an event
const results = await engine.processEvent("USER_REGISTERED", {
  userId: "123",
  plan: "premium",
  email: "user@example.com",
});

console.log("Results:", results);
```

### With TypeScript Types

```typescript
import { RuleEngine } from "trigger_system";
import { TriggerLoader } from "trigger_system/node";

interface UserRegisteredData {
  userId: string;
  plan: "free" | "premium" | "enterprise";
  email: string;
}

const engine = new RuleEngine({
  rules: await TriggerLoader.loadRulesFromDir("./rules"),
  globalSettings: {},
});

// Type-safe event data
const userData: UserRegisteredData = {
  userId: "123",
  plan: "premium",
  email: "user@example.com",
};

await engine.processEvent("USER_REGISTERED", userData);
```

## Rule Structure

Every rule follows this structure:

```yaml
id: "unique-rule-id" # Required: Unique identifier
on: "EVENT_NAME" # Required: Event to listen for
if: # Optional: Conditions to check
  field: "data.field.path" # Field to evaluate
  operator: "EQ" # Comparison operator
  value: "expected_value" # Value to compare against
do: # Required: Action to perform
  type: "action_type" # Action identifier
  params: # Action parameters
    key: "value"
```

## Available Operators

| Operator   | Description           | Example                         |
| ---------- | --------------------- | ------------------------------- |
| `EQ`       | Equal                 | `value: "premium"`              |
| `NEQ`      | Not equal             | `value: "premium"`              |
| `GT`       | Greater than          | `value: 100`                    |
| `GTE`      | Greater than or equal | `value: 100`                    |
| `LT`       | Less than             | `value: 100`                    |
| `LTE`      | Less than or equal    | `value: 100`                    |
| `MATCHES`  | Regex match           | `value: "^[A-Z].*"`             |
| `IN`       | In array              | `value: ["admin", "moderator"]` |
| `NOT_IN`   | Not in array          | `value: ["guest", "banned"]`    |
| `CONTAINS` | String/Array contains | `value: "foo"`                  |

## Next Steps

- Learn about [SDK Usage](./SDK_GUIDE.md) for programmatic rule creation
- Explore [Stateful Triggers](./STATEFUL_TRIGGERS.md) for advanced logic
- Check out [Examples](./EXAMPLES_GUIDE.md) for common use cases
- Read the [API Reference](./API_REFERENCE.md) for technical details


<!-- END FILE: GETTING_STARTED.md -->

---

<!-- FILE: OBSERVABILITY.md -->

# Archivo: OBSERVABILITY.md

# 🔭 Observability

This guide covers monitoring, logging, metrics, and debugging tools for the Agnostic Trigger System.

## triggerEmitter - Event Monitoring

The `triggerEmitter` is the central event bus for monitoring all system activities.

### Basic Event Monitoring

```typescript
import { triggerEmitter } from 'trigger_system';

// Monitor rule execution
triggerEmitter.on('rule:matched', (rule, event) => {
  console.log(`✅ Rule matched: ${rule.id} for event ${event.type}`);
});

triggerEmitter.on('rule:executed', (rule, action) => {
  console.log(`🎯 Action executed: ${action.type} for rule ${rule.id}`);
});

triggerEmitter.on('rule:failed', (rule, error) => {
  console.error(`❌ Rule failed: ${rule.id}`, {
    error: error.message,
    stack: error.stack,
    rule: rule.id
  });
});
```

### Engine Lifecycle Events

```typescript
// Monitor engine lifecycle
triggerEmitter.on('engine:started', () => {
  console.log('🚀 Rule engine started');
});

triggerEmitter.on('engine:stopped', () => {
  console.log('🛑 Rule engine stopped');
});

triggerEmitter.on('engine:rule_added', (rule) => {
  console.log(`📋 Rule added: ${rule.id}`);
});

triggerEmitter.on('engine:rule_removed', (ruleId) => {
  console.log(`🗑️ Rule removed: ${ruleId}`);
});
```

### State Change Monitoring

```typescript
// Monitor state changes
triggerEmitter.on('state:changed', (key, oldValue, newValue) => {
  console.log(`📝 State changed: ${key}`, {
    oldValue,
    newValue,
    changed: oldValue !== newValue
  });
});

triggerEmitter.on('state:cleared', (key) => {
  console.log(`🧹 State cleared: ${key}`);
});

triggerEmitter.on('state:expired', (key) => {
  console.log(`⏰ State expired: ${key}`);
});
```

## Structured Logging

### Winston Integration

```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Connect trigger system to Winston
triggerEmitter.on('rule:matched', (rule, event) => {
  logger.info('Rule matched', {
    ruleId: rule.id,
    eventType: event.type,
    timestamp: event.timestamp,
    metadata: rule.metadata
  });
});

triggerEmitter.on('rule:failed', (rule, error) => {
  logger.error('Rule execution failed', {
    ruleId: rule.id,
    error: error.message,
    stack: error.stack,
    severity: 'high'
  });
});
```

### Pino Integration

```typescript
import pino from 'pino';

const logger = pino({
  level: 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true
    }
  }
});

// Structured logging with Pino
triggerEmitter.on('engine:event_processed', (event, processingTime) => {
  logger.info({
    event: 'event_processed',
    eventType: event.type,
    processingTime,
    timestamp: Date.now()
  });
});
```

## Metrics Collection

### Built-in Metrics

```typescript
import { MetricsCollector } from 'trigger_system';

const metrics = new MetricsCollector();

// Get current metrics
const currentMetrics = metrics.getMetrics();
console.log('Current metrics:', {
  totalRules: currentMetrics.totalRules,
  totalEvents: currentMetrics.totalEvents,
  matchedEvents: currentMetrics.matchedEvents,
  failedEvents: currentMetrics.failedEvents,
  averageProcessingTime: currentMetrics.averageProcessingTime
});

// Export metrics
const metricsJson = metrics.export();
console.log('Metrics JSON:', metricsJson);
```

### Custom Metrics

```typescript
class CustomMetrics {
  private counters = new Map<string, number>();
  private timers = new Map<string, number[]>();
  
  increment(metric: string, value = 1) {
    this.counters.set(metric, (this.counters.get(metric) || 0) + value);
  }
  
  time(metric: string, duration: number) {
    if (!this.timers.has(metric)) {
      this.timers.set(metric, []);
    }
    this.timers.get(metric)!.push(duration);
  }
  
  getAverageTime(metric: string): number {
    const times = this.timers.get(metric) || [];
    return times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;
  }
  
  getMetrics() {
    const metrics: Record<string, any> = {};
    
    for (const [key, value] of this.counters) {
      metrics[key] = value;
    }
    
    for (const [key, times] of this.timers) {
      metrics[`${key}_avg`] = this.getAverageTime(key);
      metrics[`${key}_count`] = times.length;
    }
    
    return metrics;
  }
}

const customMetrics = new CustomMetrics();

// Track custom events
triggerEmitter.on('rule:executed', (rule, action) => {
  customMetrics.increment(`action_${action.type}`);
  customMetrics.increment(`rule_${rule.id}`);
});

triggerEmitter.on('engine:event_processed', (event, duration) => {
  customMetrics.time('event_processing', duration);
});
```

## Health Checks and Monitoring

### Engine Health Check

```typescript
class HealthChecker {
  constructor(private engine: RuleEngine) {}
  
  async checkHealth(): Promise<HealthStatus> {
    const checks = {
      engine: this.checkEngine(),
      rules: await this.checkRules(),
      state: await this.checkState(),
      actions: this.checkActions()
    };
    
    const overall = Object.values(checks).every(check => check.status === 'healthy')
      ? 'healthy'
      : 'unhealthy';
    
    return {
      status: overall,
      timestamp: Date.now(),
      checks
    };
  }
  
  private checkEngine() {
    try {
      const rules = this.engine.getAllRules();
      return {
        status: 'healthy',
        details: {
          ruleCount: rules.length,
          uptime: process.uptime()
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }
  
  private async checkRules() {
    try {
      const validator = new RuleValidator();
      const rules = this.engine.getAllRules();
      const errors = validator.validateAll(rules);
      
      return {
        status: errors.length === 0 ? 'healthy' : 'warning',
        details: {
          totalRules: rules.length,
          validationErrors: errors.length,
          errors: errors.slice(0, 5) // First 5 errors
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }
  
  private async checkState() {
    try {
      const keys = await this.engine.persistence.keys();
      const stateSize = keys.length;
      
      return {
        status: stateSize < 10000 ? 'healthy' : 'warning',
        details: {
          stateKeys: stateSize,
          warningThreshold: 10000
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }
  
  private checkActions() {
    const failedActions = customMetrics.getMetrics().failed_actions || 0;
    
    return {
      status: failedActions < 10 ? 'healthy' : 'warning',
      details: {
        failedActions,
        warningThreshold: 10
      }
    };
  }
}

// Usage
const healthChecker = new HealthChecker(engine);
const health = await healthChecker.checkHealth();
console.log('Health status:', health);
```

### Express.js Health Endpoint

```typescript
import express from 'express';

const app = express();

app.get('/health', async (req, res) => {
  const health = await healthChecker.checkHealth();
  
  res.status(health.status === 'healthy' ? 200 : 503).json(health);
});

app.get('/metrics', async (req, res) => {
  const metrics = {
    engine: metrics.getMetrics(),
    custom: customMetrics.getMetrics(),
    timestamp: Date.now()
  };
  
  res.json(metrics);
});

app.listen(3000, () => {
  console.log('Health check server running on port 3000');
});
```

## Performance Monitoring

### Processing Time Tracking

```typescript
// Track event processing time
triggerEmitter.on('engine:event_received', (event) => {
  const startTime = Date.now();
  
  triggerEmitter.once(`engine:event_processed:${event.type}`, () => {
    const duration = Date.now() - startTime;
    
    customMetrics.time('event_processing', duration);
    
    if (duration > 1000) { // Alert on slow processing
      logger.warn('Slow event processing', {
        eventType: event.type,
        duration,
        threshold: 1000
      });
    }
  });
});
```

### Memory Usage Monitoring

```typescript
// Monitor memory usage
setInterval(() => {
  const usage = process.memoryUsage();
  
  customMetrics.increment('memory_rss', usage.rss);
  customMetrics.increment('memory_heap_used', usage.heapUsed);
  customMetrics.increment('memory_heap_total', usage.heapTotal);
  
  // Alert on high memory usage
  if (usage.heapUsed > 500 * 1024 * 1024) { // 500MB
    logger.warn('High memory usage', {
      heapUsed: usage.heapUsed,
      heapTotal: usage.heapTotal,
      rss: usage.rss
    });
  }
}, 60000); // Every minute
```

### Rule Performance Profiling

```typescript
const rulePerformance = new Map<string, number[]>();

triggerEmitter.on('rule:matched', (rule) => {
  const startTime = Date.now();
  
  triggerEmitter.once(`rule:executed:${rule.id}`, () => {
    const duration = Date.now() - startTime;
    
    if (!rulePerformance.has(rule.id)) {
      rulePerformance.set(rule.id, []);
    }
    
    rulePerformance.get(rule.id)!.push(duration);
    
    // Log slow rules
    if (duration > 500) {
      logger.warn('Slow rule execution', {
        ruleId: rule.id,
        duration,
        threshold: 500
      });
    }
  });
});

// Get rule performance report
function getRulePerformanceReport() {
  const report: Record<string, any> = {};
  
  for (const [ruleId, times] of rulePerformance) {
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const max = Math.max(...times);
    const min = Math.min(...times);
    
    report[ruleId] = {
      average: avg,
      maximum: max,
      minimum: min,
      executions: times.length
    };
  }
  
  return report;
}
```

## Error Tracking and Alerting

### Error Classification

```typescript
enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

interface TrackedError {
  ruleId?: string;
  actionType?: string;
  error: Error;
  severity: ErrorSeverity;
  context?: any;
  timestamp: number;
}

class ErrorTracker {
  private errors: TrackedError[] = [];
  
  trackError(error: TrackedError) {
    this.errors.push(error);
    
    // Alert based on severity
    if (error.severity === ErrorSeverity.CRITICAL) {
      this.sendCriticalAlert(error);
    }
    
    // Log error
    logger.error('Tracked error', error);
  }
  
  private sendCriticalAlert(error: TrackedError) {
    // Send to alerting system (PagerDuty, Slack, etc.)
    console.error('🚨 CRITICAL ERROR:', {
      ruleId: error.ruleId,
      error: error.error.message,
      context: error.context
    });
  }
  
  getErrorReport(timeWindow = 3600000): TrackedError[] { // 1 hour default
    const cutoff = Date.now() - timeWindow;
    return this.errors.filter(e => e.timestamp > cutoff);
  }
}

const errorTracker = new ErrorTracker();

// Track rule execution errors
triggerEmitter.on('rule:failed', (rule, error) => {
  errorTracker.trackError({
    ruleId: rule.id,
    error,
    severity: ErrorSeverity.HIGH,
    timestamp: Date.now()
  });
});
```

### Slack Integration

```typescript
import { WebClient } from '@slack/web-api';

const slack = new WebClient(process.env.SLACK_TOKEN);

async function sendSlackAlert(message: string, channel = '#alerts') {
  try {
    await slack.chat.postMessage({
      channel,
      text: message,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: message
          }
        }
      ]
    });
  } catch (error) {
    logger.error('Failed to send Slack alert', error);
  }
}

// Send alerts for critical events
triggerEmitter.on('rule:failed', (rule, error) => {
  const message = `🚨 Rule Failed: ${rule.id}\nError: ${error.message}\nTime: ${new Date().toISOString()}`;
  sendSlackAlert(message, '#critical-alerts');
});
```

## Distributed Tracing

### OpenTelemetry Integration

```typescript
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

const provider = new NodeTracerProvider();
provider.register();

registerInstrumentations({
  instrumentations: [
    getNodeAutoInstrumentations()
  ]
});

// Add tracing to rule execution
triggerEmitter.on('rule:matched', (rule, event) => {
  const span = tracer.startSpan('rule_execution');
  span.setAttributes({
    'rule.id': rule.id,
    'event.type': event.type,
    'rule.metadata': JSON.stringify(rule.metadata || {})
  });
  
  triggerEmitter.once(`rule:executed:${rule.id}`, () => {
    span.setAttribute('rule.status', 'success');
    span.end();
  });
  
  triggerEmitter.once(`rule:failed:${rule.id}`, (error) => {
    span.setAttribute('rule.status', 'failed');
    span.setAttribute('rule.error', error.message);
    span.end();
  });
});
```

## Dashboard and Visualization

### Grafana Integration

```typescript
// Export metrics in Prometheus format
app.get('/metrics/prometheus', (req, res) => {
  const metrics = customMetrics.getMetrics();
  let prometheusFormat = '';
  
  for (const [key, value] of Object.entries(metrics)) {
    prometheusFormat += `# HELP ${key} Custom metric\n`;
    prometheusFormat += `# TYPE ${key} gauge\n`;
    prometheusFormat += `${key} ${value}\n`;
  }
  
  res.set('Content-Type', 'text/plain');
  res.send(prometheusFormat);
});
```

### Custom Dashboard Data

```typescript
app.get('/dashboard', async (req, res) => {
  const engineMetrics = metrics.getMetrics();
  const customMetrics = customMetrics.getMetrics();
  const health = await healthChecker.checkHealth();
  const rulePerformance = getRulePerformanceReport();
  
  const dashboardData = {
    overview: {
      totalRules: engineMetrics.totalRules,
      totalEvents: engineMetrics.totalEvents,
      successRate: ((engineMetrics.matchedEvents - engineMetrics.failedEvents) / engineMetrics.totalEvents) * 100,
      averageProcessingTime: engineMetrics.averageProcessingTime
    },
    health: health,
    topRules: Object.entries(rulePerformance)
      .sort(([,a], [,b]) => b.executions - a.executions)
      .slice(0, 10),
    recentErrors: errorTracker.getErrorReport(3600000).slice(0, 5),
    customMetrics: customMetrics
  };
  
  res.json(dashboardData);
});
```

## Log Aggregation

### ELK Stack Integration

```typescript
// Configure Winston for Elasticsearch
import { ElasticsearchTransport } from 'winston-elasticsearch';

const esTransport = new ElasticsearchTransport({
  level: 'info',
  clientOpts: {
    node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200'
  },
  index: 'trigger-system-logs'
});

logger.add(esTransport);

// Add contextual information to logs
triggerEmitter.on('rule:matched', (rule, event) => {
  logger.info('Rule matched', {
    ruleId: rule.id,
    eventType: event.type,
    '@timestamp': new Date().toISOString(),
    environment: process.env.NODE_ENV,
    service: 'trigger-system'
  });
});
```

## Alerting Rules

### Automated Alerting

```yaml
# rules/alerting.yaml
- id: "high-error-rate-alert"
  on: "METRICS_COLLECTED"
  if:
    field: "data.failedEvents"
    operator: "GT"
    value: 10
  do:
    type: "send_alert"
    params:
      severity: "warning"
      message: "High error rate detected: ${data.failedEvents} failed events"
      channels: ["slack", "email"]

- id: "slow-processing-alert"
  on: "METRICS_COLLECTED"
  if:
    field: "data.averageProcessingTime"
    operator: "GT"
    value: 1000
  do:
    type: "send_alert"
    params:
      severity: "warning"
      message: "Slow processing detected: ${data.averageProcessingTime}ms average"
      channels: ["slack"]

- id: "memory-usage-alert"
  on: "MEMORY_USAGE_HIGH"
  if:
    field: "data.heapUsed"
    operator: "GT"
    value: 500000000  # 500MB
  do:
    type: "send_alert"
    params:
      severity: "critical"
      message: "High memory usage: ${data.heapUsed} bytes"
      channels: ["slack", "pagerduty"]
```

## Best Practices

### 1. Structured Logging

Always use structured logging with consistent field names:

```typescript
// ✅ Good
logger.info('Rule executed', {
  ruleId: rule.id,
  eventType: event.type,
  duration: processingTime,
  success: true
});

// ❌ Bad
console.log(`Rule ${rule.id} executed for event ${event.type} in ${processingTime}ms`);
```

### 2. Appropriate Log Levels

Use appropriate log levels for different situations:

```typescript
logger.debug('Rule condition evaluated', { result, condition });
logger.info('Rule matched and executed', { ruleId, eventType });
logger.warn('Rule execution slow', { ruleId, duration, threshold });
logger.error('Rule execution failed', { ruleId, error: error.message });
```

### 3. Contextual Information

Include relevant context in all log entries:

```typescript
logger.info('User action processed', {
  userId: event.data.userId,
  action: event.type,
  ruleId: rule.id,
  timestamp: event.timestamp,
  sessionId: event.data.sessionId,
  ip: event.data.ipAddress
});
```

### 4. Metric Cardinality

Be careful with metric cardinality to avoid overwhelming your monitoring system:

```typescript
// ✅ Good - bounded cardinality
customMetrics.increment(`rule_${ruleId}_executed`);

// ❌ Bad - unbounded cardinality
customMetrics.increment(`rule_${ruleId}_executed_at_${Date.now()}`);
```

### 5. Alert Fatigue Prevention

Implement alert throttling and escalation:

```typescript
class AlertThrottler {
  private alerts = new Map<string, number>();
  
  shouldAlert(key: string, cooldown = 300000): boolean { // 5 minutes
    const lastAlert = this.alerts.get(key) || 0;
    const now = Date.now();
    
    if (now - lastAlert > cooldown) {
      this.alerts.set(key, now);
      return true;
    }
    
    return false;
  }
}

const alertThrottler = new AlertThrottler();

triggerEmitter.on('rule:failed', (rule, error) => {
  const alertKey = `rule_failed_${rule.id}`;
  
  if (alertThrottler.shouldAlert(alertKey)) {
    sendSlackAlert(`Rule ${rule.id} failed: ${error.message}`);
  }
});
```

For more information about debugging and development tools, see the [Developer Tools Guide](./developer_tools.md).

<!-- END FILE: OBSERVABILITY.md -->

---

<!-- FILE: SDK_GUIDE.md -->

# Archivo: SDK_GUIDE.md

# 📦 SDK Guide

This guide covers programmatic rule creation and management using the TypeScript SDK.

## RuleBuilder - Fluent API

The `RuleBuilder` provides a fluent interface for creating rules programmatically with strict type checking.

### Basic Usage

```typescript
import { RuleBuilder } from "trigger_system/sdk";

const rule = new RuleBuilder()
  .withId("high-value-transaction")
  .on("PAYMENT_RECEIVED")
  .if("data.amount", "GT", 1000)
  .do("send_alert", {
    message: "High value transaction detected: ${data.amount}",
    priority: "high",
  })
  .build();

// The rule is now ready to use
console.log(rule);
```

### Advanced Conditions

```typescript
const complexRule = new RuleBuilder()
  .withId("premium-user-behavior")
  .on("USER_ACTIVITY")
  .if("data.userType", "EQ", "premium")
  .if("data.activityCount", "GT", 10)
  .if("data.lastActivity", "MATCHES", "^2024-.*")
  .do("award_badge", {
    badge: "power_user",
    notification: true,
  })
  .build();
```

### Multiple Actions

```typescript
const multiActionRule = new RuleBuilder()
  .withId("new-user-onboarding")
  .on("USER_REGISTERED")
  .if("data.isFirstTime", "EQ", true)
  .do("send_email", {
    template: "welcome",
    delay: 300000, // 5 minutes
  })
  .do("create_task", {
    type: "follow_up",
    due: "3 days",
  })
  .do("log_event", {
    category: "user_lifecycle",
    action: "registration",
  })
  .build();
```

### Using State

```typescript
const statefulRule = new RuleBuilder()
  .withId("user-streak-tracker")
  .on("DAILY_LOGIN")
  .if("state.consecutive_days", "LT", 7)
  .do("state_increment", {
    field: "consecutive_days",
  })
  .do("check_achievement", {
    milestone: 7,
  })
  .build();
```

## RuleExporter - YAML Generation

Convert programmatically created rules to YAML format.

### Basic Export

```typescript
import { RuleBuilder, RuleExporter } from "trigger_system/sdk";

const rule = new RuleBuilder()
  .withId("example-rule")
  .on("TEST_EVENT")
  .if("data.value", "GT", 50)
  .do("log_message", { message: "Value exceeded threshold" })
  .build();

const yaml = RuleExporter.toYaml(rule);
console.log(yaml);
```

### Export Multiple Rules

```typescript
const rules = [
  new RuleBuilder().withId("rule1").on("EVENT1").do("action1").build(),
  new RuleBuilder().withId("rule2").on("EVENT2").do("action2").build(),
  new RuleBuilder().withId("rule3").on("EVENT3").do("action3").build(),
];

const yaml = RuleExporter.toYaml(rules);
console.log(yaml);
```

### Export to File (Node.js)

```typescript
import { RuleExporter } from "trigger_system/sdk";

// This implicitly uses fs/promises
await RuleExporter.saveToFile(rules, "./rules/generated.yaml");
```

## Server vs Client SDK

The package provided different entry points for optimized bundle sizes.

### Server/Node.js Usage

```typescript
import { RuleEngine } from "trigger_system";
import { TriggerLoader } from "trigger_system/node";

// helper function to init engine
async function initEngine() {
  const rules = await TriggerLoader.loadRulesFromDir("./rules");

  const engine = new RuleEngine({
    rules,
    globalSettings: { debugMode: true },
  });

  return engine;
}
```

### Client/Browser Usage

```typescript
import { RuleEngine } from "trigger_system";
// Client doesn't have TriggerLoader (File System access)

const engine = new RuleEngine({
  rules: [
    /* imported JSON or object rules */
  ],
  globalSettings: { evaluateAll: false },
});

// Or update dynamically
engine.updateRules(fetchedRules);
```

## Advanced SDK Features

### Dynamic Rule Creation

```typescript
class RuleFactory {
  static createThresholdRule(
    event: string,
    field: string,
    threshold: number,
    action: string
  ) {
    return new RuleBuilder()
      .withId(`${event}-${field}-threshold`)
      .on(event)
      .if(field, "GT", threshold)
      .do(action, { threshold, field })
      .build();
  }
}

// Usage
const rules = [
  RuleFactory.createThresholdRule(
    "CPU_USAGE",
    "data.cpu",
    80,
    "alert_high_cpu"
  ),
  RuleFactory.createThresholdRule(
    "MEMORY_USAGE",
    "data.memory",
    90,
    "alert_high_memory"
  ),
];
```

### Validation and Testing

```typescript
import { TriggerValidator } from "trigger_system/domain";
import { RuleBuilder } from "trigger_system/sdk";

const rule = new RuleBuilder().withId("test").build();

// Validate a single rule
const result = TriggerValidator.validate(rule);

if (!result.valid) {
  console.error("Rule validation failed:", result.issues);
} else {
  console.log("Valid rule:", result.rule);
}
```

## Integration Examples

### With Express.js

```typescript
import express from "express";
import { RuleEngine } from "trigger_system";
import { TriggerLoader } from "trigger_system/node";

const app = express();
// Load rules once
const rules = await TriggerLoader.loadRulesFromDir("./rules");
const engine = new RuleEngine({ rules, globalSettings: {} });

app.use(express.json());

// Endpoint to fire events
app.post("/api/events", async (req, res) => {
  const { event, data } = req.body;

  // Fire!
  const results = await engine.processEvent(event, data);

  res.json({ status: "processed", results });
});
```


<!-- END FILE: SDK_GUIDE.md -->

---

<!-- FILE: STATEFUL_TRIGGERS.md -->

# Archivo: STATEFUL_TRIGGERS.md

# ⚡ Stateful Triggers

This guide covers advanced rule logic using stateful triggers, including counters, sequences, and complex state management.

## Understanding State

State allows rules to remember information across multiple executions, enabling complex behaviors like counting, tracking sequences, and maintaining user sessions.

### State Basics

```yaml
# Simple counter example
id: "login-counter"
on: "USER_LOGIN"
if:
  field: "state.login_count"
  operator: "LT"
  value: 5
do:
  - type: "state_increment"
    params:
      key: "login_count"
  - type: "log"
    params:
      message: "Login ${state.login_count} of 5"
```

## State Operations

### STATE_SET - Set State Value

```yaml
id: "set-user-preference"
on: "PREFERENCE_UPDATED"
do:
  type: "state_set"
  params:
    key: "user_preferences.${data.userId}.${data.preference}"
    value: "${data.value}"
```

### STATE_INCREMENT - Increment Counter

```yaml
id: "page-view-counter"
on: "PAGE_VIEWED"
do:
  type: "state_increment"
  params:
    key: "page_views.${data.pageId}"
    amount: 1 # Optional, defaults to 1
```

### STATE_TOGGLE - Toggle Boolean

_Note: STATE_TOGGLE needs to be implemented as a custom action or logic if not built-in, or use state_set with negation expression._

```yaml
id: "feature-toggle"
on: "FEATURE_FLAG_REQUESTED"
do:
  type: "state_set"
  params:
    key: "features.${data.featureName}"
    value: "${!state.features[data.featureName]}"
```

### STATE_CLEAR - Remove State

_Note: Use state_set with null/undefined to clear or delete._

```yaml
id: "session-cleanup"
on: "USER_LOGOUT"
do:
  type: "state_set"
  params:
    key: "session.${data.userId}"
    value: null
```

## Advanced Patterns

### Repetition Goals

Track when something happens a specific number of times:

```yaml
id: "daily-task-completion"
on: "TASK_COMPLETED"
if:
  field: "state.daily_tasks.${data.userId}"
  operator: "LT"
  value: 3
do:
  - type: "state_increment"
    params:
      key: "daily_tasks.${data.userId}"
  - type: "check_daily_goal"
    params:
      userId: "${data.userId}"
      current: "${state.daily_tasks.${data.userId}}"
      target: 3
```

### Combo Sequences

Track sequences of events:

```yaml
# First step in sequence
id: "combo-step-1"
on: "ACTION_A"
do:
  type: "state_set"
  params:
    key: "combo.${data.userId}.sequence"
    value: "step1"

# Second step in sequence
id: "combo-step-2"
on: "ACTION_B"
if:
  field: "state.combo.${data.userId}.sequence"
  operator: "EQ"
  value: "step1"
do:
  type: "state_set"
  params:
    key: "combo.${data.userId}.sequence"
    value: "step2"
```

### Time-based State

Track state with time windows:

```yaml
id: "hourly-rate-limit"
on: "API_REQUEST"
if:
  operator: "AND"
  conditions:
    - field: "state.api_calls.${data.userId}"
      operator: "LT"
      value: 100
    - field: "state.api_window.${data.userId}"
      operator: "MATCHES"
      value: "^${utils.currentHour()}"
do:
  - type: "state_increment"
    params:
      key: "api_calls.${data.userId}"
  - type: "state_set"
    params:
      key: "api_window.${data.userId}"
      value: "${utils.currentHour()}"

# Reset hourly counter
id: "hourly-reset"
on: "HOURLY_TICK"
do:
  type: "state_set"
  params:
    key: "api_calls"
    value: {}
```

## State Namespacing

### User-specific State

```yaml
id: "user-progress-tracker"
on: "LEVEL_COMPLETED"
do:
  - type: "state_increment"
    params:
      key: "user.${data.userId}.level"
  - type: "state_set"
    params:
      key: "user.${data.userId}.last_level"
      value: "${data.levelId}"
```

## State Persistence

### Automatic Persistence

State is managed by `StateManager`.

```typescript
import { StateManager } from "trigger_system/core";
import { FilePersistence } from "trigger_system/node";

const manager = StateManager.getInstance();
manager.setPersistence(new FilePersistence("./state"));

await manager.load();
```

## State Best Practices

### 1. Use Descriptive Keys

```yaml
# Good
key: "user.${data.userId}.daily_login_count"

# Avoid
key: "ulc.${data.uid}"
```

### 2. Clean Up Old State

Periodically clear data that is no longer needed to prevent state bloat.

### 3. Handle Race Conditions

While `state_increment` is atomic within the engine's event loop for a single firing, be careful with complex read-modify-write patterns if events originate rapidly.

### 4. Monitor State Size

Keep keys short and values concise.


<!-- END FILE: STATEFUL_TRIGGERS.md -->

---

<!-- FILE: yaml-best-practices.md -->

# Archivo: yaml-best-practices.md

# 📝 YAML Best Practices

This guide covers recommended formats and patterns for writing trigger rule files in YAML.

## List Format (Recommended)

The list format is the most readable and maintainable way to organize your rules.

### Basic Structure

```yaml
# rules/app-rules.yaml
- id: "user-login"
  on: "USER_LOGIN"
  if:
    field: "data.success"
    operator: "EQ"
    value: true
  do:
    type: "log_message"
    params:
      message: "User ${data.userId} logged in successfully"

- id: "failed-login-alert"
  on: "USER_LOGIN"
  if:
    field: "data.success"
    operator: "EQ"
    value: false
  do:
    type: "send_alert"
    params:
      severity: "warning"
      message: "Failed login attempt for ${data.userId}"
```

### Advantages of List Format

- **Readable**: Each rule is clearly separated
- **Maintainable**: Easy to add, remove, or reorder rules
- **Validatable**: Each rule can be validated independently
- **Merge-friendly**: Git conflicts are easier to resolve
- **Scalable**: Works well with hundreds of rules

### Complex Rules in List Format

```yaml
- id: "high-value-transaction"
  on: "TRANSACTION_PROCESSED"
  if:
    and:
      - field: "data.amount"
        operator: "GT"
        value: 1000
      - field: "data.currency"
        operator: "EQ"
        value: "USD"
      - field: "data.status"
        operator: "EQ"
        value: "completed"
  do:
    - type: "log_message"
      params:
        level: "info"
        message: "High value transaction: $${data.amount}"
    - type: "send_alert"
      params:
        channels: ["email", "slack"]
        priority: "high"
        template: "high_value_transaction"
    - type: "state_increment"
      params:
        field: "metrics.high_value_transactions"
```

## Multi-Document Format (Legacy)

While still supported, the multi-document format is less recommended.

### Structure

```yaml
# rules/legacy-rules.yaml
id: "user-login"
on: "USER_LOGIN"
if:
  field: "data.success"
  operator: "EQ"
  value: true
do:
  type: "log_message"
  params:
    message: "User logged in"
---
id: "failed-login-alert"
on: "USER_LOGIN"
if:
  field: "data.success"
  operator: "EQ"
  value: false
do:
  type: "send_alert"
  params:
    message: "Login failed"
```

### Disadvantages

- Harder to read with many rules
- More complex validation
- Git merge conflicts are common
- Limited tooling support
- Error reporting is less precise

## YAML Formatting Guidelines

### Indentation

Use **2 spaces** for indentation (never tabs):

```yaml
# ✅ Good
- id: "example"
  on: "EVENT"
  if:
    field: "data.value"
    operator: "GT"
    value: 10

# ❌ Bad - mixed indentation
- id: "example"
    on: "EVENT"
      if:
        field: "data.value"
          operator: "GT"
            value: 10
```

### Quoting

Use quotes consistently:

```yaml
# ✅ Good - consistent single quotes
- id: 'user-login'
  on: 'USER_LOGIN'
  if:
    field: 'data.userType'
    operator: 'EQ'
    value: 'premium'

# ✅ Good - consistent double quotes
- id: "user-login"
  on: "USER_LOGIN"
  if:
    field: "data.userType"
    operator: "EQ"
    value: "premium"

# ❌ Bad - mixed quotes
- id: 'user-login'
  on: "USER_LOGIN"
  if:
    field: 'data.userType'
    operator: "EQ"
    value: 'premium'
```

### String Interpolation

Use `${}` syntax for variable interpolation:

```yaml
# ✅ Good
do:
  type: "send_email"
  params:
    subject: "Welcome ${data.userName}!"
    message: "Your account ${data.accountId} is ready"

# ❌ Bad - incorrect syntax
do:
  type: "send_email"
  params:
    subject: "Welcome {data.userName}!"
    message: "Your account $data.accountId is ready"
```

## Rule Organization

### Group by Domain

Organize rules by business domain or functionality:

```text
rules/
├── user-management/
│   ├── authentication.yaml
│   ├── registration.yaml
│   └── profile-updates.yaml
├── billing/
│   ├── payments.yaml
│   ├── subscriptions.yaml
│   └── invoicing.yaml
├── notifications/
│   ├── email.yaml
│   ├── sms.yaml
│   └── push-notifications.yaml
└── system/
    ├── monitoring.yaml
    ├── maintenance.yaml
    └── error-handling.yaml
```

### Group by Event Type

Alternatively, organize by the events they handle:

```text
rules/
├── user-events/
│   ├── login.yaml
│   ├── logout.yaml
│   └── registration.yaml
├── transaction-events/
│   ├── payment.yaml
│   ├── refund.yaml
│   └── dispute.yaml
└── system-events/
    ├── startup.yaml
    ├── shutdown.yaml
    └── error.yaml
```

### File Naming Conventions

Use descriptive, kebab-case filenames:

```yaml
# ✅ Good
user-authentication.yaml
high-value-transactions.yaml
system-monitoring.yaml

# ❌ Bad
rules1.yaml
myRules.yaml
user authentication.yaml
```

## Metadata Best Practices

### Always Include Metadata

```yaml
- id: "user-registration-complete"
  metadata:
    description: "Handle user registration completion"
    author: "dev-team"
    version: "1.0.0"
    tags: ["user-management", "registration", "onboarding"]
    priority: 1
    enabled: true
    createdAt: "2024-01-15T10:00:00Z"
    updatedAt: "2024-01-20T14:30:00Z"
  on: "USER_REGISTERED"
  if:
    field: "data.success"
    operator: "EQ"
    value: true
  do:
    type: "send_welcome_email"
    params:
      template: "welcome_new_user"
```

### Version Management

Use semantic versioning for rules:

```yaml
metadata:
  version: "1.0.0"  # Major.Minor.Patch
  changelog: |
    1.0.0 - Initial version
    1.1.0 - Added SMS notification
    1.2.0 - Fixed email template
```

## Condition Best Practices

### Use Descriptive Field Paths

```yaml
# ✅ Good
if:
  field: "data.user.profile.accountType"
  operator: "EQ"
  value: "premium"

# ❌ Bad
if:
  field: "type"
  operator: "EQ"
  value: "premium"
```

### Complex Conditions

Use explicit logical operators:

```yaml
# ✅ Good - explicit and clear
if:
  and:
    - field: "data.amount"
      operator: "GT"
      value: 100
    - field: "data.currency"
      operator: "EQ"
      value: "USD"
  or:
    - field: "data.userType"
      operator: "EQ"
      value: "premium"
    - field: "data.vipStatus"
      operator: "EQ"
      value: true

# ❌ Bad - unclear logic
if:
  field: "data.amount"
  operator: "GT"
  value: 100
# How does this combine with other conditions?
```

### State-based Conditions

Clearly indicate state dependencies:

```yaml
# ✅ Good
if:
  field: "state.user.${data.userId}.loginCount"
  operator: "GTE"
  value: 5

# ✅ Good - with fallback
if:
  field: "state.user.${data.userId}.loginCount"
  operator: "EXISTS"
do:
  - type: "state_set"
    params:
      field: "user.${data.userId}.loginCount"
      value: 0
```

## Action Best Practices

### Use Meaningful Action Names

```yaml
# ✅ Good
do:
  type: "send_welcome_email"
  params:
    template: "new_user_welcome"
    delay: "5 minutes"

# ❌ Bad
do:
  type: "email"
  params:
    type: "welcome"
```

### Multiple Actions

Order actions logically:

```yaml
# ✅ Good - logical order
do:
  - type: "log_event"           # Log first
    params:
      event: "user_registered"
  - type: "update_database"     # Update data
    params:
      table: "users"
  - type: "send_email"          # Send notifications
    params:
      template: "welcome"
  - type: "track_analytics"     # Track metrics
    params:
      event: "registration_complete"

# ❌ Bad - random order
do:
  - type: "send_email"
  - type: "track_analytics"
  - type: "log_event"
  - type: "update_database"
```

### Action Parameters

Use descriptive parameter names:

```yaml
# ✅ Good
do:
  type: "send_notification"
  params:
    channels: ["email", "sms"]
    priority: "high"
    template: "urgent_alert"
    recipient: "${data.userEmail}"
    context:
      userName: "${data.userName}"
      alertType: "${data.alertType}"

# ❌ Bad
do:
  type: "notify"
  params:
    to: "${data.userEmail}"
    msg: "urgent_alert"
    high: true
```

## Comments and Documentation

### Inline Comments

Use YAML comments sparingly:

```yaml
- id: "complex-business-rule"
  # This rule handles the edge case where premium users
  # get special treatment during high-traffic periods
  on: "PURCHASE_ATTEMPT"
  if:
    and:
      # Check if user is premium (has special privileges)
      - field: "data.userType"
        operator: "EQ"
        value: "premium"
      # Only apply during peak hours (6 PM - 10 PM)
      - field: "utils.currentHour()"
        operator: "IN"
        value: [18, 19, 20, 21, 22]
  do:
    type: "process_premium_purchase"
    params:
      priority: "high"
      queue: "premium_users"
```

### Rule Documentation

Document complex business logic:

```yaml
- id: "fraud-detection-advanced"
  metadata:
    description: |
      Advanced fraud detection using multiple heuristics:
      1. Velocity checks (too many transactions too quickly)
      2. Geographic impossibility (locations too far apart)
      3. Amount anomalies (unusual spending patterns)
      4. Device fingerprinting (new/suspicious devices)
      
      This rule should be reviewed by the fraud team monthly.
    business_logic: |
      Score = velocity_score + geo_score + amount_score + device_score
      If score > 80: Block transaction
      If score > 60: Require additional verification
      If score > 40: Flag for review
    contact: "fraud-team@company.com"
    review_schedule: "monthly"
  on: "TRANSACTION_INITIATED"
  # ... rule implementation
```

## Import and Reusability

### Use Imports for Shared Config

```yaml
# rules/config/actions.yaml
actions:
  standard_logging: &standard_logging
    type: "log_message"
    params:
      level: "info"
      format: "json"
  
  error_notification: &error_notification
    type: "send_alert"
    params:
      channels: ["email", "slack"]
      priority: "high"

# rules/user-events.yaml
imports:
  - "./config/actions.yaml"
  
- id: "user-login"
  on: "USER_LOGIN"
  do:
    - <<: *standard_logging
      params:
        <<: *standard_logging.params
        message: "User ${data.userId} logged in"
    - type: "update_last_login"
      params:
        userId: "${data.userId}"
```

### Shared Conditions

```yaml
# rules/config/conditions.yaml
conditions:
  is_premium_user: &is_premium_user
    field: "data.userType"
    operator: "EQ"
    value: "premium"
  
  is_high_value: &is_high_value
    field: "data.amount"
    operator: "GT"
    value: 1000

# rules/billing.yaml
imports:
  - "./config/conditions.yaml"
  
- id: "premium-high-value"
  on: "PURCHASE_COMPLETE"
  if:
    and:
      - <<: *is_premium_user
      - <<: *is_high_value
  do:
    type: "award_bonus_points"
    params:
      multiplier: 2
```

## Migration Guide

### From Legacy Format

Convert multi-document format to list format:

```bash
# Install yq (YAML processor)
# https://github.com/mikefarah/yq

# Convert legacy format to list format
yq eval '. as $item ireduce ([]; . + $item)' legacy-rules.yaml > new-rules.yaml
```

### Validation After Migration

```bash
# Validate converted rules
bun run validate new-rules.yaml

# Compare behavior (run tests)
bun test -- rules/legacy.test.ts
bun test -- rules/new.test.ts
```

### Gradual Migration

1. Keep legacy files in `rules/legacy/`
2. Create new files in `rules/list-format/`
3. Test both formats work identically
4. Gradually migrate rules one by one
5. Remove legacy files once migration is complete

## Common Pitfalls

### ❌ Don't: Mixed Formatting

```yaml
- id: "rule1"
  on: "EVENT1"
  if:
      field: "data.value"  # Inconsistent indentation
    operator: "GT"
      value: 10
```

### ✅ Do: Consistent Formatting

```yaml
- id: "rule1"
  on: "EVENT1"
  if:
    field: "data.value"
    operator: "GT"
    value: 10
```

### ❌ Don't: Deep Nesting Without Structure

```yaml
- id: "complex-rule"
  if:
    and:
      - or:
          - and:
              - field: "data.a"
                operator: "EQ"
                value: 1
              - field: "data.b"
                operator: "EQ"
                value: 2
          - and:
              - field: "data.c"
                operator: "EQ"
                value: 3
              - field: "data.d"
                operator: "EQ"
                value: 4
```

### ✅ Do: Break Complex Rules

```yaml
- id: "condition-a-and-b"
  on: "EVENT"
  if:
    and:
      - field: "data.a"
        operator: "EQ"
        value: 1
      - field: "data.b"
        operator: "EQ"
        value: 2
  do:
    type: "fire_event"
    params:
      event: "CONDITION_A_B_MET"

- id: "condition-c-and-d"
  on: "EVENT"
  if:
    and:
      - field: "data.c"
        operator: "EQ"
        value: 3
      - field: "data.d"
        operator: "EQ"
        value: 4
  do:
    type: "fire_event"
    params:
      event: "CONDITION_C_D_MET"

- id: "final-complex-rule"
  on: "CONDITION_A_B_MET"
  if:
    field: "state.also_needs_c_d"
    operator: "EQ"
    value: true
  do:
    type: "final_action"
```

### ❌ Don't: Hardcode Values

```yaml
- id: "timezone-rule"
  if:
    field: "data.timezone"
    operator: "EQ"
    value: "America/New_York"  # Hardcoded
```

### ✅ Do: Use Configuration

```yaml
# config.yaml
default_timezone: "America/New_York"

# rules.yaml
imports:
  - "./config.yaml"
  
- id: "timezone-rule"
  if:
    field: "data.timezone"
    operator: "EQ"
    value: "${config.default_timezone}"
```

For more examples and patterns, see the [Examples Guide](./EXAMPLES_GUIDE.md).

<!-- END FILE: yaml-best-practices.md -->

---