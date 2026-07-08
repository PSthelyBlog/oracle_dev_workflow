# Phases

Track sequences — feature: define → contract → design → build → verify → ship → operate → done; fix: contract → build → verify → ship → operate → done (design skipped at intake, define collapsed into the bug description). Chores and doc-only changes never enter the workflow.

## define (feature track only)
- **Purpose:** turn an idea into a spec someone could disagree with.
- **Entry:** intake ran (`scripts/intake.mjs`); state record + spec skeleton exist.
- **Work:** brainstorm if fuzzy → synthesize research if feedback exists → write the spec → slot into the sprint/roadmap.
- **Exit gate:** spec has goals, non-goals, acceptance criteria.

## contract
- **Purpose:** pin intent as falsifiable clauses before any code; the ambiguity ledger is the primary output.
- **Entry:** spec (feature) or bug description (fix).
- **Work:** draft clauses + ledger → resolve OPEN items with the user → mutate MUST clauses → user signs. Fix track: clause delta on the owning feature's contract.
- **Exit gate:** contract signed, zero OPEN ledger items.

## design (feature track, skipped on fix)
- **Purpose:** decide the consequential things once, in an ADR.
- **Work:** explore affected code → ADR for consequential choices → test strategy.
- **Exit gate:** at least one ADR in the feature directory.

## build
- **Purpose:** implement with oracles growing alongside, each tagged `// @clause C<id>`.
- **Work:** implement; scaffold the oracle suite once per repo; write a paired oracle per changed module; micro-commit.
- **Exit gate:** test suite green; every module changed for this feature has a paired oracle (untouched repo debt does not block).

## verify
- **Purpose:** prove the chain of trust end to end.
- **Work:** oracle anti-pattern review → mutation run → traceability audit → code review. Record judgment outcomes in the gate log.
- **Exit gate:** mutation report present with score ≥ threshold (raw, no rounding; default 80); `contract-audit: green` recorded; `review: <verdict>` recorded.

## ship
- **Purpose:** boring, checklisted release.
- **Work:** docs refresh → deploy checklist → commit/push/PR → merge → branch cleanup.
- **Exit gate:** `deploy-checklist: complete` and `merged: <ref>` recorded.

## operate
- **Purpose:** close the loop — comms, metrics, incidents, learnings.
- **Work:** standup/stakeholder updates from state; metrics review at +1 week; incidents become postmortems whose action items become new clauses with oracles; debt findings feed the roadmap.
- **Exit gate:** `learnings: <note>` recorded. Advancing out of operate marks the feature done (board hides it; TASKS.md entry moves to Done).
