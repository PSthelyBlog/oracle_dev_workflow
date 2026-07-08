---
description: Start or adopt a feature on the full track — state record, board entry, then the define phase
argument-hint: <feature idea or existing directory name>
---

Start a feature on the full lifecycle (define → contract → design → build → verify → ship → operate).

## Steps

1. **Intake.** Run:
   ```
   node "${CLAUDE_PLUGIN_ROOT}/scripts/intake.mjs" $ARGUMENTS --track feature --today <today, YYYY-MM-DD>
   ```
   - If it REFUSES on a slug collision, relay the message verbatim and stop — existing state is never overwritten.
   - If the directory existed without a state record, it was adopted and backfilled at define.
2. **Define phase.** Route the work (see `${CLAUDE_PLUGIN_ROOT}/skills/workflow/references/plugin-map.md`):
   - Fuzzy idea → invoke `product-management:product-brainstorming` first.
   - Existing user feedback / research to mine → `product-management:synthesize-research`.
   - Write the spec into the created skeleton → `product-management:write-spec` (goals, non-goals, acceptance criteria are the gate).
   - Slot it into the plan → `product-management:sprint-planning` when the user plans sprints.
3. **Board hygiene.** TASKS.md gained exactly one Active entry; keep it in sync per `productivity:task-management` conventions.
4. Tell the user: check the gate anytime with `/oracle-dev-workflow:gate <slug>`; advance with `/oracle-dev-workflow:next <slug>`.

## Rules

- This command never advances a phase — only `/oracle-dev-workflow:next` writes transitions.
- Do not draft the contract here; that is the contract phase, reached through the define gate.
