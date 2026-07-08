---
description: Show every tracked feature with its track, phase, and last gate outcome
argument-hint: "[--all] [--json]"
---

Render the feature board (read-only).

## Steps

1. Run:
   ```
   node "${CLAUDE_PLUGIN_ROOT}/scripts/board.mjs" . $ARGUMENTS
   ```
   (`--all` includes done features; `--json` for machine-readable output.)
2. Relay the table. For each in-flight feature, add one line of context from its state record if useful (what the current phase is waiting on).
3. If the output is `BOARD FAILED`, present the named record and the reason, then offer exactly two remedies: fix the record's frontmatter, or adopt the directory via `/oracle-dev-workflow:feature <slug>`. Never reconstruct a partial board by hand — the all-or-nothing behavior is contractual.
4. Cross-check TASKS.md: if board and task list disagree on a feature's phase, reconcile TASKS.md (conventions: `productivity:task-management`).
