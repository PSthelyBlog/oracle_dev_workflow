---
description: Start a bug fix on the short track — clause delta, failing oracle first, no design phase
argument-hint: <bug description>
---

Start a fix on the compressed track (contract → build → verify → ship → operate). The design phase is skipped at intake; the define phase collapses into the bug description.

## Steps

1. **Intake.** Run:
   ```
   node "${CLAUDE_PLUGIN_ROOT}/scripts/intake.mjs" $ARGUMENTS --track fix --today <today, YYYY-MM-DD>
   ```
   Relay a collision REFUSAL verbatim and stop.
2. **Contract phase = clause delta.** The fix adds or amends clauses on the owning feature's contract (feature directory contract first, project root as single-feature fallback):
   - Draft the clause(s) for the correct behavior → `intent-contract:contract-new` (delta mode: new clauses, ids never reused).
   - Stress-test them against the user's intent → `intent-contract:contract-mutate`.
   - The gate needs the contract signed with zero OPEN ledger items.
3. **Build phase starts with the failing oracle.** Before touching the fix:
   - Reproduce and isolate → `engineering:debug`.
   - Write the oracle that fails on the bug and is tagged to the new clause → `test-oracle:oracle-new` (methodology: `test-oracle:make-failures-loud`).
   - Then fix until the oracle passes; micro-commit via `commit-commands:commit`.
4. Continue through verify and ship exactly like the feature track: `/oracle-dev-workflow:gate`, `/oracle-dev-workflow:next`, `/oracle-dev-workflow:ship`.

## Rules

- No fix ships without its regression oracle — that is the point of the track.
- Chores and doc-only changes do not enter the workflow at all; commit them directly.
