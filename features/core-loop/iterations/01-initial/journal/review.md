# REVIEW — iteration 01-initial

> ⚠ **Independence is compromised, and that is a finding in itself.** The protocol
> requires the reviewer to run cross-model from the implementer (Fable 5 vs the
> Opus implementer). Here the same agent did both, in one session, so the blind
> pass (①) could not be blind — the expected shape was already in my head.
> Compensated by prosecuting through **execution** (disposable probes on the live
> lane) rather than by reading, which is what caught the one real conviction. A
> genuinely independent pass is still owed before this is trusted as reviewed.

## Verdicts

| sub-issue | verdict | note |
|---|---|---|
| be-1 | **approve** | lifecycle + stderr capture; queued branch exercised under real contention rather than asserted from the code |
| be-2 | **approve** | n=4 across fresh runs — correct call, the defect was intermittent |
| be-3 | **approve** | telemetry cannot fail a generation; no teacher content; cid ties to the trace |
| fe-1 | **approve** | mirrored-layout defect found and fixed during implement |
| fe-2 | **approve** | pinned deep-equal to the recorded request |
| fe-3 | **approve** | found the meta.assumptions LaTeX leak |
| fe-4 | **reopen-implement → fixed → approve** | see conviction below |
| fe-5 | **approve-with-debt** | see debt |
| fe-6 | **approve-with-debt** | delivered outside its declared Delta — see debt |

## Conviction — fe-4, storage clear path

**Indictment.** `saveDraft(null)` called `localStorage.removeItem` unguarded while
every other access was wrapped. `App` clears the draft from a mount effect
whenever `exam` is null — the **first-load path for every new user**. With storage
unavailable (Safari private mode, storage disabled, over quota) the app threw
before rendering.

**How it was hunted.** Not by reading — by stubbing a throwing `localStorage` and
running the mount path. 22 tests were green at the time; all of them ran with
working storage, so none could see it.

**Disposition.** Reopened, fixed, and pinned as a regression test. Re-gated 23/23.

## Debt recorded (approve-with-debt)

1. **fe-6 deviated from its declared Delta.** The sub-issue named
   `src/routes/Print.tsx`; it was delivered as `@media print` rules on the
   existing view instead. The outcome is simpler and equivalent — no route, no
   duplicated state — but the Delta was not amended first, which is exactly the
   scope-drift the six-slot form exists to prevent. Accepted because it *reduces*
   surface, flagged so it is not read as precedent.
2. **fe-5: no undo.** A refine replaces an exercise irreversibly in the client.
   A teacher who preferred the previous version must regenerate (~48 s). Out of
   SEED scope, but it is the most likely first complaint from the teacher test.
3. **fe-5: cancel is client-side only.** The CLI run continues server-side. The
   copy never claims otherwise, but a cancelled run still consumes a slot in the
   concurrency gate — visible to a second request as queueing.
4. **`Progress` expected-seconds are hardcoded** (125 / 48) from SEED kit §2.
   They will drift as the skills change. `be-3`'s run log now carries the real
   numbers; a later job should read them rather than keep constants in the UI.

## Oracle grading (④)

Traced each oracle back to SEED. The strongest were the ones pinned to
**recordings** rather than to hand-written expectations — fe-2's deep-equality and
fe-3/fe-5's splice pins would all fail if the contract moved, which is the point.

Weakest: **fe-1's oracle could not be executable.** "Controls on the right" is a
visual property; it passed a build and a typecheck while being wrong, and only a
screenshot convicted it. Recorded as a limit of the form, not a defect.

Mutation spot-check: inverting `spliceExercise`'s id guard (accept any id) fails
`REJECTS a response whose id is not in the exam`. Removing the `\text{}` clause
from be-2's rule is *not* caught by any automated gate — the Arabic-in-math
detector runs only when a human runs it. **That is a real gap**: R1 can regress
silently. It belongs in `tools/ci` as a be-side check.
