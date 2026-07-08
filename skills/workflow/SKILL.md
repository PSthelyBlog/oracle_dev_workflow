---
name: workflow
description: This skill should be used when the user mentions starting or resuming a feature or fix, asks "where were we", "what's next", "which phase are we in", "run the gate", "show the board", "ship it", names a tracked feature slug, or asks how the development workflow / chain of trust works. Routes work to the oracle-dev-workflow lifecycle (define → contract → design → build → verify → ship → operate) and its commands.
---

# oracle-dev-workflow orchestrator

This plugin owns orchestration, per-feature state, and gates — nothing else. Every unit of actual work is delegated to one of the seven underlying plugins by exact skill name (see `references/plugin-map.md`); the plugin never inlines a capability they already provide, even when their skill is an awkward fit (awkwardness is feedback for that plugin).

## The chain of trust

user intent → CONTRACT.md → oracles → code, each link verified: `intent-contract:contract-mutate` checks the contract against intent, `intent-contract:contract-audit` checks oracles against clauses, `test-oracle:oracle-audit` (StrykerJS mutation) checks code against oracles. The verify gate is where the whole chain must be green.

## Orientation protocol

When the user references tracked work or asks where things stand:

1. Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/board.mjs" .` — the board names every feature, its track, phase, and last gate.
2. Read `docs/features/<slug>/workflow.md` for the feature in question; frontmatter `phase` is the single source of truth.
3. Route:
   - new work → `/oracle-dev-workflow:feature` (full track) or `/oracle-dev-workflow:fix` (bug, short track); chores bypass the workflow entirely
   - "what's blocking / can we move" → `/oracle-dev-workflow:gate <slug>`
   - "advance / continue" → `/oracle-dev-workflow:next <slug>`
   - "ship it" → `/oracle-dev-workflow:ship <slug>`
   - in-phase work → the phase's skills per `references/plugin-map.md`

## Rules that never bend

- Only `/oracle-dev-workflow:next` writes phase transitions; `/oracle-dev-workflow:gate` and the board are read-only.
- One advance, one phase — no skipping, no fast-forward to ship.
- A red gate blocks unconditionally; v1 has no waiver or force path.
- Every date written to state is an absolute ISO date (YYYY-MM-DD).
- Contracts live in the feature's directory; project root is the single-feature fallback.

## References

- `references/phases.md` — each phase's purpose, entry artifacts, delegated work, exit gate
- `references/gates.md` — per-phase check enumerations and the judgment-recording format
- `references/plugin-map.md` — the pinned routing table (the C13 source of truth)
- `references/state-format.md` — the flat frontmatter subset and state record template
