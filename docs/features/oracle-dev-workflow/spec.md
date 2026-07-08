---
feature: oracle-dev-workflow
type: spec
status: draft
date: 2026-07-08
---

# Spec: oracle-dev-workflow plugin v1

A meta-plugin for Claude Code that orchestrates seven installed plugins — intent-contract, test-oracle, productivity, product-management, engineering, commit-commands, feature-dev — into one gated development lifecycle. This spec is itself the plugin's first tracked feature (self-hosted).

## Problem statement

Seven capable plugins are installed, but nothing connects them: each session decides ad hoc what to run and in what order. Nothing enforces that intent is pinned down before code is written, that test oracles trace back to agreed clauses, or that mutation testing gates a ship. The cost is the classic AI-development failure mode: code verified only against tests the same AI wrote — internally consistent, unfaithful to what the user actually meant — plus silent scope drift and "where were we?" overhead on every resumed feature.

## Goals

1. **Machine-checked chain of trust.** Every shipped feature traces signed contract → oracles → code, with a mutation score ≥ threshold (default 80%) verified at a gate — not by memory.
2. **One entry point, visible state.** Work starts via `/feature` or `/fix`; `/board` shows any feature's phase and gate state cold, in under a minute.
3. **Ceremony proportional to work.** Fix track needs at most a clause delta + failing oracle; chores are explicitly exempt from the workflow.
4. **Route, don't reimplement.** 100% of phase work is delegated to the seven plugins by exact skill name; the meta-plugin owns only orchestration, state, and gates.
5. **Self-hosting.** The plugin's own repo passes its own `/gate` at every phase.

## Non-goals

- **Reimplementing plugin capability** — routing only; any duplicated logic drifts from the source plugin.
- **CI / remote enforcement** — v2; local gates come first (gate script stays headless-runnable to keep this door open).
- **Hooks and automation** — v2 (SessionStart board summary, PostToolUse oracle nudge); v1 is command-driven.
- **Multi-repo orchestration** — one repo, one `docs/features/` tree.
- **Non-JS/TS oracle stacks in the scripted gate** — the mutation check reads StrykerJS output; other stacks fall back to judgment checks recorded in the gate log.

## User stories

- As a solo developer, I want `/feature <idea>` to open a tracked lifecycle so that definition work starts in the define phase instead of in code.
- As a solo developer, I want `/next` to refuse to advance when the current gate is red so that I cannot accidentally skip verification.
- As a solo developer, I want `/board` to show every in-flight feature with its phase and last gate result so that I can resume any of them cold.
- As a solo developer, I want `/fix <bug>` to start from a failing oracle so that every bug becomes a permanent clause with a regression check.
- As a solo developer, I want `/ship` to run docs, checklist, and PR in one motion so that shipping is boring.
- Edge: when `/gate` fails, I want an exact punch list (which artifact, which section, which score) so that red gates are actionable.
- Edge: when state is corrupt or hand-edited badly, I want `/board` to fail loudly naming the file, not render a wrong table.

## Requirements

### Must-have (P0)

1. **Intake — feature track.** `/feature <idea>` creates `docs/features/<slug>/workflow.md` (frontmatter: slug, title, track, phase, created) plus a spec skeleton, and adds a TASKS.md line under Active.
   - [ ] Slug is kebab-case, derived from the idea, unique against existing feature dirs
   - [ ] `workflow.md` frontmatter round-trips through the state parser
   - [ ] TASKS.md gains exactly one new Active line
2. **Intake — fix track.** `/fix <bug>` creates the same state with `track: fix`, starting phase `contract` (clause delta on the existing contract), design phase auto-skipped.
   - [ ] `phase` starts at `contract`; `design` marked `skipped` in the gate log
3. **State model.** `workflow.md` frontmatter is the single source of truth for phase. Phase transitions (made by `/next`) append dated gate-result lines to its body; `/gate` itself never writes (C12). Judgment checks (reviews, sign-offs) are recorded there by the skills that ran them; mechanical checks are computed by scripts.
4. **Board.** `/board` lists every `docs/features/*/workflow.md` with slug, track, phase, last gate result. Unparseable state files fail loudly, naming the file — never a silently wrong table.
5. **Gate.** `/gate [slug]` runs the current phase's mechanical checks and prints a punch list on red; the underlying script exits 0 on green, 1 on red.
   - [ ] Define gate: spec.md exists with goals, non-goals, acceptance criteria
   - [ ] Contract gate: CONTRACT.md exists, `signed: true` with date, ambiguity ledger has no open blocking entries
   - [ ] Design gate: ADR present when `track: feature` and design not waived; always green on fix track
   - [ ] Build gate: test command green; every changed source module has a paired oracle file
   - [ ] Verify gate: Stryker `mutation.json` score ≥ threshold, contract-audit result recorded green, review recorded clean
   - [ ] Ship gate: deploy checklist recorded complete, PR merged
6. **Advance.** `/next [slug]` runs the gate first; only on green does it advance `phase` and invoke the next phase's mapped skill.
7. **Ship macro.** `/ship [slug]` refuses unless phase is `ship` and the verify gate is green, then routes: engineering documentation → deploy-checklist → commit-commands commit-push-pr → clean_gone.
8. **Gate mechanics in Node** (`scripts/*.mjs`, zero runtime deps): frontmatter parse/serialize, phase-gate predicates, Stryker score extraction and threshold comparison (default 80, overridable in `.claude/oracle-dev-workflow.local.md`). Every pure function carries oracles; the plugin's own suite reaches mutation score ≥ 80%.
9. **Routing table.** `skills/workflow/references/plugin-map.md` pins the exact skill name invoked at every step; commands and the skill never inline capability that exists in the seven plugins.
10. **Validation.** The plugin passes the plugin-dev validator cleanly.

### Nice-to-have (P1)

- `/board --json` for tooling; configurable features root; the self-hosted feature dir doubles as the worked example in docs.

### Future considerations (P2)

- Hooks (state format must stay trivially script-readable); CI reuse of `gate.mjs` (headless, exit codes); marketplace packaging.

## Success metrics

- **Leading:** 100% of features started via intake have a signed contract before any source commit (measured from gate logs); plugin's own mutation score ≥ 80% at v1; cold resume via `/board` under 1 minute.
- **Lagging (1 month):** zero shipped features whose oracle suite scores below threshold; rework loops from misunderstood intent noticeably down (monthly self-check).

## Open questions

1. **Gate strictness** — hard block, or `--force` waiver with a logged reason? (blocking; Philippe)
2. **Threshold boundary** — is 79.6% a pass at threshold 80? Defines the comparator: proposal is raw score, no rounding, strict `>=`. (blocking; Philippe)
3. **Unmanaged features** — `/next` on a feature dir with no contract (created outside intake): refuse, or adopt-and-backfill? (blocking; Philippe)
4. **Zero-dep scripts** — hand-rolled minimal frontmatter parser (a prime oracle target) vs a YAML dependency. Proposal: zero-dep. (non-blocking; engineering)

## Timeline considerations

No external deadline. Phasing is the workflow's own phases; v1 build starts when the contract is signed (gate 2). Sprint-planning and roadmap-update from the product-management plugin apply per target project rather than to this repo.
