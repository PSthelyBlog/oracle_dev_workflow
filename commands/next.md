---
description: Run the gate; on green, advance exactly one phase and launch the next phase's work
argument-hint: <slug>
---

Advance a feature one phase — the only command that writes a phase transition.

## Steps

1. **Gate first.** Run:
   ```
   node "${CLAUDE_PLUGIN_ROOT}/scripts/gate.mjs" $ARGUMENTS .
   ```
   - Exit 1 (RED): relay the punch list and STOP. The phase does not change. If the refusal says there is no state record, point to `/oracle-dev-workflow:feature <slug>` (adoption) and stop.
2. **Advance one step.** On GREEN, edit `docs/features/<slug>/workflow.md`:
   - Frontmatter `phase` moves exactly one step along the track sequence — feature: define → contract → design → build → verify → ship → operate → done; fix: contract → build → verify → ship → operate → done. Never skip.
   - Append to the gate log: `- [x] <today ISO> · <from> → <to> — <one-line gate summary>`.
3. **Board sync.** Update the feature's TASKS.md line to the new phase (`productivity:task-management`). If the new phase is `done` (advancing out of operate): move the entry to Done with the completion date — the board hides done features by default.
4. **Launch the new phase** per `${CLAUDE_PLUGIN_ROOT}/skills/workflow/references/plugin-map.md`:
   - contract → `intent-contract:contract-new`, then `intent-contract:contract-mutate`, then signature
   - design → `feature-dev:code-explorer` agent to map affected code, `engineering:architecture` for the ADR, `engineering:testing-strategy`
   - build → `feature-dev:feature-dev`, `test-oracle:oracle-init` (first time), `test-oracle:oracle-new` per module, `commit-commands:commit` micro-commits
   - verify → `test-oracle:oracle-review`, `test-oracle:oracle-audit`, `intent-contract:contract-audit`, `engineering:code-review`
   - ship → `/oracle-dev-workflow:ship <slug>`
   - operate → `engineering:standup`, `product-management:stakeholder-update`, `product-management:metrics-review`

## Rules

- Gate red → nothing moves. There is no override flag.
- One invocation, one phase, exactly — even if the next gate would also pass.
