---
description: Ship-phase macro — docs refresh, deploy checklist, commit and PR, branch cleanup
argument-hint: <slug>
---

Run the ship phase end to end. Refuses unless the feature is in the ship phase with its verify chain green.

## Steps

1. **Refusal check.** Read `docs/features/<slug>/workflow.md`. If `phase` is not `ship`, refuse and stop: shipping has no fast-forward, whatever later checks would say. (Reaching the ship phase already implies the verify gate was green when `/oracle-dev-workflow:next` advanced it — do not run the ship gate here; its own checks are recorded by the steps below and verified by `/next` afterward. A red gate blocks shipping unconditionally — there are no waivers in v1.)
2. **Documentation.** Update the README/docs surfaces the feature touched → `engineering:documentation`.
3. **Deploy checklist.** Walk it → `engineering:deploy-checklist`; on completion append to the gate log: `- [x] <today ISO> · deploy-checklist: complete`.
4. **Commit, push, PR.** → `commit-commands:commit-push-pr`. If the repo has no remote, fall back to `commit-commands:commit` and say plainly that push/PR were skipped.
5. **After merge.** Record `- [x] <date> · merged: <ref>` in the gate log, clean up gone branches → `commit-commands:clean_gone`, then `/oracle-dev-workflow:next <slug>` into operate.
