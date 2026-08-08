# Retro — persistence-gaps · 01-initial

Nine planned sub-issues plus three QA bug loops. Everything the SEED scoped shipped;
gap #6 was split to its own job during DISCOVERY. What follows is what the iteration
actually taught, drawn from the journals, the review attack logs and `qa.md`.

## The finding that matters most

**Four `be` slices passed the full done-protocol — oracle twice, freeze audit, perimeter
differential, mutation spot-checks — and still shipped two data-loss bugs.**

- `consumeRecovery` was not atomic. It filtered on `{recoveryUsedAt: null}` while setting
  that same field to `null`, so the guard guarded nothing: four concurrent recoveries all
  succeeded and three teachers got a code that was already dead. The journal *claimed*
  atomicity; four lines of Python disproved it.
- `replaceExercise` lost versions. Two simultaneous refines both returned 200 and one
  version vanished from the sheet and from history.

Both were invisible for one reason: **every oracle clause exercised the behaviour
sequentially.** Single-use and "nothing is lost" are concurrency properties and were never
tested as such. The done-protocol tests what the author thought to test; only an
adversarial pass tests what they didn't.

**Change adopted:** where a behaviour can race or repeat — double-submit, double-click,
replay on mount — write the concurrency clause from the start, and write it *wider than the
realistic case*. That last part earned its keep immediately: the first fix used `updatedAt`
as the compare-and-set token, which held at two concurrent writers and failed ~50% at ten,
because a millisecond timestamp is not a version token. The ten-way clause is what caught it.

## The same lesson, three more times: assertions on global counts are races

Three separate tests asserted on collection-wide counts in a database that parallel jest
workers write to. All three were flaky, and one of them was a *safety guard* in the purge
script: `after === total - matched` assumes the script is the only writer, so it failed on a
purge that was entirely correct and printed "restore from the dump". **A false alarm on an
irreversible operation is its own kind of damage** — it invites someone to restore over good
data. All were rewritten to assert on **identity**: these specific documents still exist.

## Contract ambiguity only surfaces at implementation

`be-2`'s "reject an id that was never issued" read as obvious in planning. At implementation
it was ambiguous — `POST /api/teacher` issued ids without recording them — and the strict
reading would have locked out 117 of 159 existing teachers, broken the promoted net and
broken `fe`. That was a genuine stop-and-ask, and the resulting "anonymous teachers"
amendment is now the load-bearing half of the accounts design.

**Worth repeating:** the sub-issue's exit protocol listing "contract change needed" as a stop
is what made this cheap. It cost one question instead of a data-loss incident.

## What only a different kind of eye could see

- **Review found a hard-constraint violation that jsdom structurally cannot see.** Native
  `type="email"` validation blocked a malformed address with the *browser's* locale bubble —
  English text on the auth mainline of an Arabic-only product. No unit test could ever have
  caught it; it took someone running the real UI.
- **QA found that a reload never reconciled with the server**, so an exam refined on another
  device rendered as current forever — a defect that only exists *because* multi-device
  became a real claim in this job.
- **Narrowing a pin lost coverage.** `be-3`'s exact-key assertion was replaced with a
  name-regex when `be-4` added a field; the regex let `costUsd` through, which `be-4`'s own
  Boundaries call a stop condition. The one-token edit (add the field to the list) was the
  right move. **Prefer widening an exact assertion over loosening it into a pattern.**

## Engine findings fixed during the iteration (WF-82)

`tools/ci` reported `gate PASS` on a run where all 44 tests skipped — the same
false-confidence class WF-68 outlaws for "no tests resolved". Now a hollow layer is
`gate FAIL` in job mode and `gate INCOMPLETE` on a mainline, detected from the runners' own
counters rather than their prose. `guard.js` gained `describeIfLane` (a live-service skip,
distinct from `describeIfPresent`'s absent-feature skip), and `tools/ci` derives the lane
URL and log path from the checkout's own slot — a suite that hardcodes a port skips forever
on every other lane, which is indistinguishable from passing.

## Process mistakes worth not repeating

- **`git add -A` during an in-flight fe gate committed a transient symlink** with an absolute
  machine path (`tests/fe/node_modules`), which would dangle in any other clone — and once
  tracked, `tools/ci` stopped cleaning it up. Now gitignored.
- **`be-1` has no commit of its own**; its files landed inside `be-2`'s commit, so the
  history does not show the sub-issue that introduced `teachers.ts`.
- Two suites reached out of their own directory for a fixture and failed to load. Recordings
  belong **beside** the test — the same fault `94106ed` fixed in the promoted net.

## Carried debt, stated rather than hidden

- `createOnce` silently drops a second *distinct* in-flight intent (narrow; untestable from
  outside without paying for a generation).
- No sign-out or "signed in as" indicator — QA calls this a **seed-gap**, needing a product
  decision rather than an invented answer.
- Pre-existing English messages on the subject routes, pinned by the promoted net.
- `npm run build` in `fe` was **already broken on `main`** (`erasableSyntaxOnly` vs
  `GenerateError`'s parameter properties); this job added a fifth instance of the identical
  pattern rather than touching a class the promoted net pins.
- The teacherId remains a bearer value, there is no rate limiting, and sign-up's
  `409 email_taken` is an enumeration oracle. All acceptable at two teachers; none should
  survive real scale — and the store now holds credentials, not just exam drafts.

## Closed after the ledger above

- **F3** (a second distinct in-flight save dropped) — fixed with a queue-and-drain and
  pinned; mutation-verified.
- **`npm run build` in `fe`** — was failing before this job and now passes. The cause was
  `erasableSyntaxOnly` rejecting `GenerateError`'s constructor parameter properties; the
  fields are now declared and assigned, same public shape. Worth noting *why* it went
  unnoticed for so long: the dev server uses esbuild and never type-checks, so nothing
  surfaced it until someone asked for a production build. A gate that never runs the
  production path is the same class of blind spot as WF-82's hollow gate.
