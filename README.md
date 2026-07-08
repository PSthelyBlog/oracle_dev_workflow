# oracle-dev-workflow

A Claude Code meta-plugin that turns seven plugins — intent-contract, test-oracle, productivity, product-management, engineering, commit-commands, feature-dev — into one gated development lifecycle. It owns orchestration, per-feature state, and gates; every unit of real work is delegated to the underlying plugins by exact skill name.

**The spine is the chain of trust:** user intent → contract → oracles → code, with each link independently verified (`contract-mutate` · `contract-audit` · `oracle-audit`/StrykerJS). Nothing ships until the whole chain is green — no waivers, no rounding, no fast-forward.

## Lifecycle

```
define ──► contract ──► design ──► build ──► verify ──► ship ──► operate ──► done
   PM         intent      eng +     feat-dev   oracle +    commit +   eng + PM
              contract    feat-dev  + oracle   contract    eng                 ↺ learnings
   gates: spec▸criteria  signed▸0-open  ADR   paired oracles  chain green  checklist▸merged
```

Two tracks: **feature** (all phases) and **fix** (contract-delta → failing oracle first; define collapsed, design skipped). Chores never enter the workflow.

## Commands

| Command | Does |
|---|---|
| `/oracle-dev-workflow:feature <idea>` | Intake on the full track (also adopts unmanaged dirs) |
| `/oracle-dev-workflow:fix <bug>` | Intake on the short track |
| `/oracle-dev-workflow:board` | Every feature: track, phase, last gate (`--all`, `--json`) |
| `/oracle-dev-workflow:gate <slug>` | Check the current gate — read-only, writes nothing |
| `/oracle-dev-workflow:next <slug>` | Gate, then advance exactly one phase — the only writer |
| `/oracle-dev-workflow:ship <slug>` | Docs → checklist → commit/PR → cleanup |

## State

One committed record per feature: `docs/features/<slug>/workflow.md` (flat frontmatter: slug, title, track, phase, created) plus `spec.md`, `CONTRACT.md`, `adr-*.md` beside it. Gate log lines record transitions and judgment checks. Per-repo settings: `.claude/oracle-dev-workflow.local.md` (`mutation-threshold`, default 80).

## Self-hosted

This repo is its own first feature (`docs/features/oracle-dev-workflow/`) — spec, signed 21-clause contract, ADR, and an oracle suite whose tests tag the clauses they verify (`// @clause C6`). See [CONTRACT.md](CONTRACT.md) and [docs/WORKFLOW.md](docs/WORKFLOW.md).

Engine: zero-runtime-dependency Node ≥ 18 (`scripts/lib/`), tested with Vitest + fast-check, verified by StrykerJS mutation testing (`npm test`, `npm run mutation`).

## Install

Add this directory as a local plugin (or via your marketplace), then start work with `/oracle-dev-workflow:feature "your idea"`.

**Requires the seven routed plugins to be installed** — intent-contract, test-oracle, productivity, product-management, engineering, commit-commands, feature-dev. The meta-plugin loads without them, but every phase's work is delegated to their skills by name. Optional integrations they use (Linear, Slack, Amplitude, Datadog, …) need their own MCP auth; the workflow itself is file-based and works without them.
