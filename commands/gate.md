---
description: Check the current phase's exit gate without advancing (read-only, writes nothing)
argument-hint: <slug>
---

Run the current phase's gate for a feature and report, without changing anything.

## Steps

1. Run:
   ```
   node "${CLAUDE_PLUGIN_ROOT}/scripts/gate.mjs" $ARGUMENTS .
   ```
2. Relay the verdict and, on RED, the punch list exactly (artifact, check, observed value).
3. For each red **judgment** check, name the skill that produces and records it (see `${CLAUDE_PLUGIN_ROOT}/skills/workflow/references/gates.md`):
   - traceability audit → `intent-contract:contract-audit`
   - mutation score → `test-oracle:oracle-audit`
   - code review → `engineering:code-review`
   - deploy checklist → `engineering:deploy-checklist`
4. Offer `/oracle-dev-workflow:next <slug>` when the gate is green.

## Rules

- Checking a gate writes nothing — not to the state record, not to TASKS.md. Run it as often as you like; only `/oracle-dev-workflow:next` records transitions.
