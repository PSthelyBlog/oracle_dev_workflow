# State record format

One record per feature at `docs/features/<slug>/workflow.md`, committed to the repo. Parsed by `scripts/lib/state.mjs` — a deliberate **flat frontmatter subset** (ADR-001): `key: string-value` lines only, no nesting, no lists, no multiline values. Keys match `[A-Za-z][A-Za-z0-9-]*`; duplicate keys are a parse error; parse errors fail the board loudly naming the file.

## Template

```markdown
---
slug: lunar-export
title: Lunar Export
track: feature
phase: define
created: 2026-07-08
---

# Workflow state: lunar-export

Phase history and gate log. Frontmatter `phase` is the single source of truth.

## Gate log

- [x] 2026-07-08 · define → contract — spec has goals, non-goals, acceptance criteria
- [ ] contract → design — pending

## Notes
```

## Field rules

- `slug` — kebab-case canonical (`slugify` output); collisions are case-insensitive after normalization.
- `track` — `feature` or `fix`.
- `phase` — one of define, contract, design, build, verify, ship, operate, done; must belong to the track's sequence (fix has no define/design).
- `created` — absolute ISO date (YYYY-MM-DD). All dates in the record are absolute ISO; never "yesterday".

## Sibling artifacts

`spec.md` (define output) · `CONTRACT.md` (feature-dir contract; project root only as single-feature fallback) · `adr-*.md` (design output). The gate log's checked `- [x] <date> · <key>: <value>` lines are the judgment-check store (see gates.md).

## Per-repo settings

`.claude/oracle-dev-workflow.local.md` — flat frontmatter, currently: `mutation-threshold: <number>` (default 80 when absent).
