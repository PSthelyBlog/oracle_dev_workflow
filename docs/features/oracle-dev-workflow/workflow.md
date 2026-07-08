---
slug: oracle-dev-workflow
title: oracle-dev-workflow plugin v1
track: feature
phase: ship
created: 2026-07-08
---

# Workflow state: oracle-dev-workflow

Phase history and gate log. Frontmatter `phase` is the single source of truth.
Mechanical checks are computed by `scripts/gate.mjs` (once built); judgment checks are recorded here by the skill that ran them.

## Gate log

- [x] 2026-07-08 · define → contract — spec.md present with goals, non-goals, acceptance criteria (checked manually; script pending self-build)
- [x] 2026-07-08 · contract → design — CONTRACT.md signed by Philippe (21 clauses, 8 mutation-confirmed, ledger A1–A8 all resolved; 1 intent bug caught: gate-write contradiction, spec corrected)
- [x] 2026-07-08 · design → build — adr-001 accepted (zero-dep Node engine, frontmatter state, per-feature contracts)
- [x] 2026-07-08 · build → verify — 45 oracles green; changed modules (state.mjs, gate.mjs) paired; gate.mjs non-vacuous pairing fix applied
- [x] 2026-07-08 · contract-audit: green (chain closed — 21/21 clauses oracled, 0 orphan tags, consistency 82.4% ≥ 80 raw)
- [x] 2026-07-08 · review: clean — code review surfaced 4 gate-defeating bugs, all fixed and re-verified (judgment checks now last-wins; ship no longer self-gates; changed-modules survive micro-commits; intake skeleton can no longer green the define gate); plugin structure validation PASS
- [x] 2026-07-08 · verify → ship — gate green: mutation 81.97 ≥ 80 raw, traceability chain closed, review clean after 4 fixes
- [x] 2026-07-08 · deploy-checklist: complete (57/57 oracles green; mutation 81.97 ≥ 80; plugin-validator PASS; README states the seven required plugins; no secrets; dev artifacts gitignored; docs/WORKFLOW.md current)
- [ ] ship → operate — checklist complete, merged

## Notes

- 2026-07-08 · Bootstrapping: phases run manually via the seven plugins until the plugin can host itself (from build phase onward, its own commands take over).
