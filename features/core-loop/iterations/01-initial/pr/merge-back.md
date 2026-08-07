# /merge-back — not applicable (2026-08-07)

**Outcome: no-op, by design. Nothing was pushed, nothing deployed.**

```
$ tools/job-wt merge-back core-loop --dry-run
  stacks/teacher-be — unknown base; … (skipped)
  stacks/teacher-fe — unknown base; … (skipped)
```

Both stack repos are **single-branch**: `repos.sh` carries an empty integration
field (`"be|stacks/teacher-be||main"`), so there is no staging/dev deploy branch
to merge into and no staging environment to refresh. That is the greenfield
convention recorded in the profile, not a misconfiguration.

**Deliberately NOT forced with `--base main`.** `tools/job-wt merge-back` refuses
prod branches, and merge-back bypasses PR review by design — that is acceptable
for iterating on a staging environment and never for landing. Landing goes
through `/open-pr` → review → merge into base.

Sealed as complete because the step is **inapplicable**, not because a deploy
happened. When a staging branch is added to either repo, fill its integration
field in `repos.sh` and this step becomes real.
