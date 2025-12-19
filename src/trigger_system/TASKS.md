# Tasks

## Active

- [ ] **CLI Tool**: `bun run validate-rules`.

## Completed

- [x] **Analyze Library & Roadmap**: Created roadmap and task list.
- [x] **Refactor Dependency Injection**: Implemented `ActionRegistry` in `src/core/action-registry.ts`.
- [x] **Implement 'File Loader'**: Added `watchRules` to `TriggerLoader` in `src/io/loader.ts`.
- [x] **Enhance Expression/Rule Engine**:
  - Added support for dynamic values (e.g. `value: "${globals.limit}"`).
  - Added Date operators (`SINCE`, `BEFORE`, `AFTER`, `UNTIL`).
  - Added Regex support (`MATCHES`).
- [x] **Context Adapters**: Implemented `ContextAdapter` in `src/core/context-adapter.ts`.

## Backlog

- [ ] **Visualizer**: Web view for rules.
