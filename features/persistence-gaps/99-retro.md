# 99 — Retro (feeds workflow evolution)

One iteration, `01-initial`: accounts with a recovery code, exercise revision history,
cost attribution, queued saves, and the orphaned test data purged. Twelve sub-issues —
nine planned, three filed by QA. Gap #6 (deploy) was split to its own job during
DISCOVERY, on evidence, not on preference.

## What worked

**Falsifying the brief before planning from it.** DISCOVERY's first duty caught two things
that would otherwise have shaped the whole job wrongly: cost attribution needed **no**
change to the frozen `/api/generate` (it already returned the envelope), and the cost join
was not merely unpopulated but *impossible* — `correlationId` is per-request, so a
subject's create line and its generation line carry different ids. The brief was wrong
about the first and understated the second.

**The stop-and-ask exit protocol.** `be-2`'s "reject an id that was never issued" read as
obvious in planning and turned out ambiguous at implementation: `POST /api/teacher` issued
ids without recording them, so the strict reading would have locked out 117 of 159 existing
teachers. One question instead of a data-loss incident. That clause earned the whole
six-slot format.

**Splitting a scope item on evidence.** #6 looked like "choose a host". The sweep showed
the blocker is carrying an *authenticated* Claude Code CLI across redeploys with no API key
anywhere. That is research, not build — and the finding is written up in its own issue so
the follow-on job starts from it.

**Cross-model prosecution.** Review found a hard-constraint violation that no unit test
could structurally see: native email validation surfacing a browser-locale English bubble
on the auth mainline of an Arabic-only product. QA then found a defect that only *became*
one because this job made multi-device a real claim.

## Friction / gaps hit

**The done-protocol tests what the author thought to test.** Four `be` slices passed oracle
×2, freeze audit, perimeter differential and mutation spot-checks — and shipped **two
data-loss bugs**. Both were concurrency defects invisible because every clause exercised the
behaviour sequentially. This is the single biggest finding of the job: *single-use* and
*nothing is lost* are concurrency properties and were never tested as such.

→ **Proposed workflow change:** `writing-sub-issues.md` slot 4 should require, for any
behaviour that can race or repeat, a clause at a width the real world can exceed. The first
fix here used `updatedAt` as a version token; it held at two concurrent writers and failed
~50% at ten, and only the deliberately-too-wide clause caught it.

**Assertions on global counts in a shared database are races.** Hit three times, including
inside a *safety guard*: the purge script asserted `after === total - matched`, which
assumes a single writer, and so cried "restore from the dump" over a correct purge. A false
alarm on an irreversible operation invites someone to restore over good data. All were
rewritten to assert on identity.

**`git add -A` during an in-flight gate committed a machine-absolute symlink.** `tools/ci`
creates `tests/fe/node_modules` for the duration of a run; committing it meant it would
dangle in any other clone, and being tracked stopped `tools/ci` cleaning it up.

**The private layer nearly shipped.** Commit messages written sub-issue by sub-issue carried
sub-issue ids and process vocabulary. Each was fine locally; the leak existed only at
publish time, and was caught by `/open-pr`'s mandated scan with the branches still unpushed.
→ The scan works. The habit that makes it necessary — naming sub-issues in stack-repo commit
messages — is worth dropping at the source.

**A gate reported PASS having verified nothing.** `tools/ci` summarised an all-skipped run as
green. Fixed as **WF-82** during the job: a hollow layer is now `gate FAIL` in job mode and
`gate INCOMPLETE` on a mainline, detected from the runners' own counters. `guard.js` gained
`describeIfLane`, and the lane URL and log path are derived from the checkout's own slot — a
suite pinned to a port skips forever elsewhere, which is indistinguishable from passing.

**A path that never runs cannot fail.** `npm run build` in `fe` had been broken before this
job; the dev server uses esbuild and never type-checks, so nothing surfaced it. Same class as
the hollow gate.

**`be-1` has no commit of its own** — its files landed inside `be-2`'s, so history does not
show the sub-issue that introduced `teachers.ts`.

## Carried out of this job

- **teacher-saas#4** — deploy and backups, with the CLI-auth evidence attached. Nothing this
  job shipped is backed up, and the store now holds **credentials**, not just exam drafts.
- The teacherId is still a bearer value; there is no rate limiting; sign-up's
  `409 email_taken` is an enumeration oracle. All accepted at two teachers, none at scale.
- No sign-out or "signed in as" indicator — QA graded this a **seed-gap** needing a product
  decision rather than an invented answer.
- Pre-existing English messages on the subject routes, pinned by the promoted net.
