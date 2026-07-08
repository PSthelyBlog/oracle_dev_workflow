# The oracle-dev-workflow handbook

Why this exists: AI-generated code is usually verified against AI-generated tests — internally consistent, but nothing checks it against what you actually *meant*. This workflow makes that check mechanical. It links four artifacts into a chain of trust and refuses to ship until every link is verified:

```
 intent ──► CONTRACT.md ──► oracles ──► code
    ▲            ▲             ▲
    └ contract-  └ contract-   └ oracle-audit
      mutate       audit         (StrykerJS mutation)
```

- `intent-contract:contract-mutate` perturbs clauses and checks *you* notice — the contract encodes what you meant.
- `intent-contract:contract-audit` checks every MUST clause has a tagged oracle (`// @clause C<id>`) and every tag resolves — the tests encode the contract.
- `test-oracle:oracle-audit` mutates the code and checks the oracles bite (raw score ≥ threshold, default 80, no rounding) — the code satisfies the tests, falsifiably.

## The eight phases

| # | Phase | Powered by | Exit gate |
|---|---|---|---|
| 0 | orient (always on) | productivity | — |
| 1 | define | product-management | spec: goals, non-goals, acceptance criteria |
| 2 | contract | intent-contract | signed, zero OPEN ledger items |
| 3 | design | engineering + feature-dev | ADR present (skipped on fix track) |
| 4 | build | feature-dev + test-oracle + commit-commands | tests green, changed modules paired |
| 5 | verify | test-oracle + intent-contract + engineering | mutation ≥ threshold, audit green, review recorded |
| 6 | ship | commit-commands + engineering | checklist complete, merged |
| 7 | operate | engineering + product-management | learnings recorded → done |

Full detail: [phases](../skills/workflow/references/phases.md) · [gates](../skills/workflow/references/gates.md) · [routing table](../skills/workflow/references/plugin-map.md) · [state format](../skills/workflow/references/state-format.md).

## Rules that never bend

1. Only `/next` writes phase transitions. `/gate` and `/board` are pure reads.
2. One advance = one phase. No skips, no fast-forward to ship.
3. A red gate blocks unconditionally — no waivers, no `--force`, no rounding at the threshold.
4. Route, don't reimplement: every step delegates to one of the seven plugins per the routing table.
5. Absolute ISO dates everywhere in state.
6. Contracts live with their feature; project root is the single-feature fallback.

## The feedback loop

Operate closes the loop: a postmortem's action items become new contract clauses (`contract-new` delta) with regression oracles (`oracle-new`); tech-debt findings feed `roadmap-update`; learnings land in memory. The workflow's output is its own next input.

## Worked example

This repository. `docs/features/oracle-dev-workflow/` holds the real spec, the signed 21-clause contract (8 clauses mutation-confirmed, 8 ledger items resolved, 1 intent bug caught before code), ADR-001, and the gate log of every transition — produced by running the workflow on itself.
