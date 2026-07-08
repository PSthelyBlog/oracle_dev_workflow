# Intent Contract — oracle-dev-workflow plugin v1

status: signed
version: 1
signed-by: Philippe
signed-on: 2026-07-08

Feature source: docs/features/oracle-dev-workflow/spec.md

## Clauses

C1. (MUST) Starting a feature via intake begins it in the define phase, with a dated state record and exactly one new Active entry on the task board.
C2. (MUST) Intake with a name that collides with an existing feature after kebab-case normalization ("Lunar Export" vs "lunar-export") is refused with a message naming the existing feature; existing state is never overwritten.
C3. (MUST) Starting a fix via intake begins it in the contract phase, with the design phase pre-marked skipped at intake time.
C4. (MUST) Advancing a feature runs the current phase's gate first; on red the phase is unchanged and every failed check is printed as an actionable item naming the artifact, the check, and the observed value.
C5. (MUST) One advance moves at most one phase; advancing never skips a phase (the fix track's design skip is set at intake, not by advancing).
C6. (MUST) The verify gate compares the mutation report's overall score to the configured threshold using the raw reported value with no rounding: threshold 80 with score 79.6 is red. (from: A2) (mutation: confirmed 2026-07-08)
C7. (MUST) The verify gate is red when the mutation report is absent or unreadable — a missing report is a failure, never a vacuous pass. (mutation: confirmed 2026-07-08)
C8. (MUST) The verify gate requires the clause-to-oracle traceability audit green: every MUST clause maps to at least one tagged oracle and every tag resolves to an existing clause.
C9. (MUST) The contract gate is red until the contract is signed and its ambiguity ledger contains zero OPEN items.
C10. (MUST) Shipping is refused while the feature's phase is earlier than ship, even if every later check would currently pass — there is no fast-forward.
C11. (MUST) The board lists every tracked feature with slug, track, phase, and last gate outcome; a corrupt or unparseable state record makes the board fail loudly naming that record, never render a partial or wrong table.
C12. (MUST) Gate checks are read-only: running a gate twice with unchanged inputs changes no state and reports the same result; only advancing writes gate results to the log. (mutation: confirmed 2026-07-08)
C13. (MUST) Every workflow step names the underlying plugin skill it delegates to, as pinned in the routing table; no step inlines a capability that one of the seven plugins already provides, even when that skill is an awkward fit. (mutation: confirmed 2026-07-08)
C14. (SHOULD) All dates written to state records and gate logs are absolute ISO dates (2026-07-08), never relative expressions.
C15. (SHOULD) Completing the operate phase marks the feature done: its phase becomes done, its task-board entry moves to Done with a completion date, and the board hides done features by default.
C16. (MAY) Punch-list wording, board layout, and board ordering may vary between versions provided the facts (artifact, check, observed value) are present.
C17. (MUST) A red gate blocks shipping unconditionally; no override or waiver mechanism exists in v1. (from: A1) (mutation: confirmed 2026-07-08)
C18. (MUST) Advancing a feature directory that has no state record is refused, naming what is missing and the intake command that adopts it; intake on an existing directory adopts it and backfills state at the define phase. (from: A3) (mutation: confirmed 2026-07-08)
C19. (MUST) The traceability audit reads a feature's contract from that feature's own directory when present, falling back to the project root only for single-feature repos; concurrent features therefore carry independent contracts. (from: A4) (mutation: confirmed 2026-07-08)
C20. (MUST) A phase gate is red when any one of its enumerated checks fails — gates never pass on partial success; the per-phase enumeration lives in the gates reference.
C21. (MUST) The build gate's paired-oracle check covers exactly the source modules changed for the feature, not the whole repository. (mutation: confirmed 2026-07-08)

## Ambiguity ledger

A1. [RESOLVED → C17] Red gate at ship time — hard block or recorded waiver? — hard block always, waivers revisited in v2 at the earliest, Philippe, 2026-07-08
A2. [RESOLVED → C6] Mutation score 79.6 at threshold 80 — red or green? — red, raw value with no rounding, Philippe, 2026-07-08
A3. [RESOLVED → C18] Advancing a hand-created feature directory with no state record? — refuse until intake adopts it, Philippe, 2026-07-08
A4. [RESOLVED → C19] Contract location with multiple features in flight? — one contract per feature directory, root fallback for single-feature repos, Philippe, 2026-07-08
A5. [RESOLVED → C21] Build-gate oracle scope — changed modules or whole repo? — changed modules only; repo-wide gaps go to the tech-debt backlog. Claude recommendation on Philippe's delegation, ratified at signing, 2026-07-08
A6. [RESOLVED → C7] Missing mutation report at verify — red or not-applicable? — red; absence of measurement is itself a failure. Claude recommendation on Philippe's delegation, ratified at signing, 2026-07-08
A7. [RESOLVED → C12] Does checking a gate write to the gate log? — no; only phase transitions are logged, and the spec's contrary wording was corrected. Claude recommendation on Philippe's delegation, ratified at signing, 2026-07-08
A8. [RESOLVED → C13] Inline a capability when the underlying skill is awkward? — never; always route, awkwardness is upstream feedback. Claude recommendation on Philippe's delegation, ratified at signing, 2026-07-08

## Non-goals

- CI/remote gate enforcement (v2; the gate script stays headless-capable).
- Hooks and background automation (v2).
- Multi-repo orchestration.
- Scripted mutation gates for non-JS/TS stacks (fall back to judgment checks recorded in the gate log).
- Reimplementing any capability of the seven orchestrated plugins.
- Stability of board presentation between versions (see C16).
- Gate waivers of any kind in v1 (see C17).
