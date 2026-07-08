# Gates

A gate is red when any one of its checks fails — never partial success. `scripts/gate.mjs <slug>` computes the mechanical checks and reads the recorded judgment checks; it is read-only and exits 0 (green) / 1 (red) with a punch list naming artifact, check, and observed value.

## Judgment-recording format

Skills record judgment outcomes as checked gate-log lines in `docs/features/<slug>/workflow.md`:

```
- [x] <YYYY-MM-DD> · <key>: <value>
```

Keys the gates read: `contract-audit` (recorded by intent-contract:contract-audit), `review` (engineering:code-review), `deploy-checklist` (engineering:deploy-checklist), `merged` (ship command), `learnings` (operate phase). Unchecked (`- [ ]`) lines do not count.

## Check enumerations

| Gate | Checks |
|---|---|
| define | spec exists · goals section · non-goals section · acceptance criteria |
| contract | contract exists (feature dir, root fallback) · status signed · zero OPEN ledger items |
| design | fix track: green via intake-time skip · feature track: adr-*.md present |
| build | `npm test` green · every changed module has a paired oracle (changed-for-this-feature scope only) |
| verify | mutation report present & readable · raw score ≥ threshold (default 80, `.claude/oracle-dev-workflow.local.md` override) · `contract-audit: green` recorded · `review` recorded |
| ship | `deploy-checklist: complete` recorded · `merged` recorded |
| operate | `learnings` recorded |

## Hard rules

- Missing mutation report = red, never "not applicable".
- Red gate blocks shipping unconditionally; there is no waiver, force flag, or override in v1.
- Only `/oracle-dev-workflow:next` writes transitions; checking writes nothing.
