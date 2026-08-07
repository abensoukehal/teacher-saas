# /open-pr — landed for review (2026-08-07)

| repo | PR | branch → base |
|---|---|---|
| be | https://github.com/abensoukehal/teacher-be/pull/1 | `feature/core-loop` → `main` |
| fe | https://github.com/abensoukehal/teacher-fe/pull/1 | `feature/core-loop` → `main` |

Cross-linked in both bodies.

## History was rewritten before pushing — and why

The step-3b scan caught the private layer all over the **commit messages**: SEED
references, oracle/pins vocabulary, sub-issue ids, `tools/ci` / `tools/obs`, and
test counts. Commit bodies appear on the PR's Commits tab and land in the base,
so this would have been public.

Worse than vocabulary: those messages **cited test suites that do not exist in
these repos**. The suites live in the project repo (WF-53), so a reviewer would
have gone looking and found nothing — a leak and a false claim at once.

Each repo's 5 commits were therefore squashed into one engineering-facing commit
describing product behaviour and code. Neither push needed `--force`: fe had never
been published, and be's remote branch was still at the base commit.

Verification is real and was reported **in chat**, not in the PRs.

## Checked before anything left the machine

- Feature code only in both diffs — no suites, no `docs/`, no `tools/`, no
  workflow files. (`agent/CLAUDE.md` ships deliberately: it is the generator's
  runtime context, i.e. product code, not harness context.)
- Leak scan clean on both PR bodies, both titles, and both commit messages.
- No assistant attribution anywhere. The one "Claude Code" mention is the name of
  the dependency this service invokes, which is the architecture.

## Standing caveat for the reviewer

REVIEW was not independent — the same agent implemented and reviewed. It is
recorded at the top of `journal/review.md`, along with the one conviction it did
produce (a crash-on-first-load with storage disabled).
