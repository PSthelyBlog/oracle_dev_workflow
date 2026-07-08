# Plugin routing table

The pinned map of every workflow step to the underlying plugin skill (or agent) that performs it. Contract clause C13: no step inlines a capability listed here; changes to routing happen in this file, nowhere else.

## always-on

| Step | Delegated to |
|---|---|
| Task board conventions (TASKS.md) | `productivity:task-management` |
| Pull new assignments, triage stale tasks | `productivity:update` |
| Decode shorthand, codenames, people | `productivity:memory-management` |
| First-time workspace setup | `productivity:start` |

## define

| Step | Delegated to |
|---|---|
| Explore a fuzzy idea | `product-management:product-brainstorming` |
| Mine interviews/feedback/tickets | `product-management:synthesize-research` |
| Write the spec (goals, non-goals, acceptance criteria) | `product-management:write-spec` |
| Slot into sprint/roadmap | `product-management:sprint-planning`, `product-management:roadmap-update` |
| Competitive context when relevant | `product-management:competitive-brief` |

## contract

| Step | Delegated to |
|---|---|
| Draft CONTRACT.md from the spec | `intent-contract:contract-new` |
| Stress-test clauses against intent | `intent-contract:contract-mutate` |
| Concepts / chain-of-trust reference | `intent-contract:intent-contracts` |

## design

| Step | Delegated to |
|---|---|
| Map the affected code | `feature-dev:code-explorer` (agent) |
| Architecture decision record | `engineering:architecture` |
| Service/API/data design | `engineering:system-design` |
| Test approach | `engineering:testing-strategy` |

## build

| Step | Delegated to |
|---|---|
| Guided implementation | `feature-dev:feature-dev` |
| Blueprint for larger builds | `feature-dev:code-architect` (agent) |
| Scaffold the oracle suite (once per repo) | `test-oracle:oracle-init` |
| Oracle per module, traced to clauses | `test-oracle:oracle-new` |
| Silent-failure methodology | `test-oracle:make-failures-loud`, `test-oracle:property-based-testing` |
| Micro-commits | `commit-commands:commit` |

## verify

| Step | Delegated to |
|---|---|
| Oracle anti-pattern audit | `test-oracle:oracle-review` |
| Mutation run + blind-spot worklist | `test-oracle:oracle-audit` (agent: `test-oracle:mutation-analyst`) |
| Suite wiring / pairing health | `test-oracle:oracle-doctor` |
| Clause ↔ oracle traceability | `intent-contract:contract-audit` |
| Security/perf/correctness review | `engineering:code-review` (agent: `feature-dev:code-reviewer`) |

## ship

| Step | Delegated to |
|---|---|
| Docs/README/runbook refresh | `engineering:documentation` |
| Pre-deploy verification | `engineering:deploy-checklist` |
| Commit, push, open PR | `commit-commands:commit-push-pr` |
| Post-merge branch cleanup | `commit-commands:clean_gone` |

## operate

| Step | Delegated to |
|---|---|
| Daily standup from activity | `engineering:standup` |
| Stakeholder comms | `product-management:stakeholder-update` |
| Post-launch metrics (+1 week, +1 month) | `product-management:metrics-review` |
| Incidents: triage → postmortem | `engineering:incident-response`, `engineering:debug` |
| Postmortem actions → new clauses + oracles | `intent-contract:contract-new` (delta) + `test-oracle:oracle-new` |
| Debt sweep → roadmap | `engineering:tech-debt` → `product-management:roadmap-update` |
