# Journal — fe-3 · corrections appear one by one

**Stack:** fe · **Branch:** `feature/parallel-exercises` · **Sealed:** 2026-08-09
**Budget:** 8 cycles · **Used:** 3 · **Filed by:** QA (bugs A and B)

---

## Pre-flight — what `be` actually shipped

Read `be`'s be-6 rather than the message about it, because the two bugs turn on details
the summary cannot carry.

| | |
|---|---|
| `POST /subjects/:id/solutions/generate` | **202** `{subjectId, exerciseIds, skipped, correlationId}` |
| the filter | `correctable(ex)` — `statusOf === "ready"` **and** a non-blank statement, applied server-side on the stored document |
| the guard | `claim(solutionsKey(id))`, held by the **detached run**, released in `.finally()` |
| a failed correction | **nothing stored** — absent, not a blank row |

Three of those shaped the design:

**202, not 201.** `POST /api/exams` answers 201 because the skeleton *is* already
inserted; here nothing exists at response time. The body is a statement of intent, and
`exerciseIds` is the only thing that can serve as a stop condition.

**The claim is held by the run, not the request.** So a second tab stays refused for as
long as the first run's loops are alive — which is what makes it a real cross-tab guard
rather than a race with a millisecond window, and what told me the `fe` guard had to
outlive the request too.

**Nothing is stored for a correction that could not be produced.** This is the sharpest
constraint in the whole sub-issue: **presence is the only signal there is.** There is no
per-correction status to poll and none can be added, because a blank row is
indistinguishable from a real answer that says nothing. Everything below follows from it.

---

## Cycle 1 — one loop, two surfaces

**The instruction was to reuse `lib/poll.ts`, and the reason is right.** But
`pollSubject` was welded to `getSubject` + `hasPending`, so reuse meant extracting
rather than calling.

`pollUntil(read, isComplete, onUpdate, opts)` now holds the loop and all three brakes;
`pollSubject` and `pollSolutions` are two questions asked of it and contain no loop of
their own. That is asserted, not just intended — one clause reads both wrappers'
source and fails if either grows a `for` or `while`. `pollSubject`'s behaviour is
unchanged, which fe-1's clauses prove.

**The stop condition is "every id the 202 named is present".** The alternatives are all
wrong:

- *"the list stopped growing"* — true of every gap between two corrections.
- *a per-correction status* — does not exist and cannot (see above).

**The consequence is deliberate and worth stating plainly: a correction `be` could not
produce never arrives, so `pollSolutions` runs to `maxPolls`.** That is not a bug being
tolerated, it is the honest reading of a presence-only surface. The backstop stops
being purely a hang-guard and becomes a real exit path, so the UI is built around it:
while the batch is alive a missing correction is "on its way"; once it ends, the same
missing correction is "ask again" — which is the state `SolutionView` already had.

**The waiting state is derived from a RUN, not from a field.** `solutionsRun` holds
what the 202 said it would deliver; `awaitingIds` is that list. No new per-correction
state exists anywhere, which matches `be` having none.

## Cycle 2 — bug B, and the window the old guard did not cover

`generatingSolutions` (a ref) and `disabled={busy !== null}` both covered **the HTTP
request**. The 202 returns in a moment and the corrections take ~200 s, so the instant
the request resolved the button re-enabled while the fan-out was still going. That is
the entire bug: two tabs, two enabled buttons, two full runs.

`solutionsRun` is set when the 202 lands and cleared when the **poll** resolves, so the
disabled window is the batch, not the request. Both refs stay — they cover a burst
inside one gesture, which `disabled` repaints too late to stop, and which the promoted
net's `burst()` helper exists to exercise.

**A 409 from the other tab is not an error.** The teacher did nothing wrong and the
corrections *are* coming, so this tab joins the wait and shows the same sheet filling
in. `be` does not re-state the target list on a refusal, so the list is inferred from
the exam with the same `correctable` rule — being wrong about it costs a waiting state
that resolves at the backstop, never a second run.

**Never an empty correction box.** A blank answer with a blank scale reads as a
correction that says nothing, and a teacher would carry it into a class. The waiting
note is text; the answer and scale elements are simply absent until there is one. Four
clauses guard it, including the printed sheet.

## Cycle 3 — the promoted net, again

Seven clauses went red, all in `solution-sheets/solutions-app`, all because the
whole-exam button no longer spends an `/api/generate` run or saves from `fe`. Same
discipline as fe-2: each re-baselined on the job branch with a written reason.

| clause | what changed |
|---|---|
| "generate posts {skill:'solution-sheet'} then SAVES" | **Superseded.** `fe` neither runs nor saves the batch now; it asks. The join-key half still holds on the per-exercise path and is pinned in the untouched "stale — regenerating exactly one exercise" block. |
| "DOUBLE-CLICK issues exactly ONE /api/generate" | Same money clause, new call. A batch is ~200 s of quota per press. |
| "while it runs the control is disabled…" | **Strengthened** — now asserts the disabled window covers the *batch*, which is bug B itself. |
| "the result comes from the SAVE — the only source of `stale`" | Principle intact, source moved: it is the polled read. `fe` still never invents `stale`. |
| "store_unavailable is retryable, retry does NOT regenerate" | Driver moved to the per-exercise path — the only place `fe` still saves. |
| "claude_auth is NOT retryable" | Same: it pins `/api/generate`'s classification, reached from the regenerate control. |
| "a failed run leaves no half-correction" | Same rule on the new surface: a batch that cannot start draws no sheet at all. |

Also broadened the suite's `generateBtn` matcher — the label becomes «جارٍ تحضير
التصحيح…» while a batch runs.

**244 passed**, unchanged in count.

---

## Walked live on lane 6 — the thing QA measured absent

1. Pressed «توليد التصحيح النموذجي» → `202`.
2. **The sheet appeared immediately**, both exercises with «جارٍ تحضير تصحيح هذا
   التمرين…», the button disabled and relabelled «جارٍ تحضير التصحيح…».
3. **An intermediate poll returned exactly ONE correction** — `ex1` complete with its
   worked answer and eight scale lines, while `ex2` was still being written. Read off
   the wire, not inferred from the DOM. *That is the growth QA measured absent.*
4. Both landed: **103 and 143 KaTeX islands**, both scales rendered.
5. **The poll stopped** — 30 reads, unchanged over ~11 further intervals.
6. Button re-enabled and relabelled; zero waiting boxes.
7. Console clean apart from the pre-existing KaTeX-font 403s recorded in fe-2.

---

## What the oracle asserts

`features/parallel-exercises/tests/fe/solutions-progressive.characterization.test.tsx`,
23 clauses (69 for the job with fe-1/fe-2).

| group | what it pins |
|---|---|
| they arrive one by one | one present + two coming → the one renders with answer *and* scale, the others show an Arabic waiting state; the app shows the sheet filling in and the finished count only goes **up**; the call is relative, teacher-scoped, and spends no `/api/generate`; 202 names what will be corrected |
| the poll stops | stops the read the moment every expected correction is present; an already-complete sheet costs one read; **a correction that never arrives is bounded**; an abort stops it with no update after; in the app the read count stops moving; **the poller is shared with the exam, not copied** (neither wrapper contains a loop) |
| one run at a time | the button is disabled for the **batch**, not the request, and says so in Arabic; a burst in one `act()` issues exactly one batch; a 409 is not an error and this tab joins the same wait |
| never an empty box | no corrections yet → no answer boxes and no scales, but every exercise still gets a block; a waiting correction shows words; no regenerate control while it is coming; once the batch ends a missing one becomes "ask again" |
| hard constraints | Arabic on every new string and control; the waiting copy names no id, status word or error code; **no LaTeX in the answer, the scale parts, or the waiting state**; RTL holds; the printed sheet carries no control and no blank box |

---

## Decisions the contract did not cover

1. **Per-exercise regeneration stays on `/api/generate` + `POST …/solutions`.** The new
   surface corrects the whole exam and cannot express "just this one". Keeping it also
   keeps the frozen surface genuinely exercised rather than only asserted.

2. **A 409 makes this tab join the wait instead of reporting a failure**, inferring the
   target list from the exam. Not in the contract; `be` does not re-state it on refusal.

3. **The whole-exam `Progress` bar is gone.** It promised a finished sheet after a
   blocking wait that no longer happens — the corrections now appear on the sheet
   itself. The per-exercise path keeps its bar, because that one really does block.

4. **`maxPolls` is a real exit path for corrections, not only a hang-guard** (§ Cycle 1).
   Recorded because the number now has a second job, and anyone shrinking it would cut a
   live batch short.

5. **The `fe`-side "nothing is correctable" refusal is kept** even though `be` applies
   `correctable` itself. It is a decision made before any request, so there is no
   server-side filter to defer to — and it is the difference between an Arabic
   explanation and a 400.

---

## Not verified

**No correction has failed in a live run.** `be` stores nothing for one, so the
"missing after the batch ends" path is driven from fixtures. It is the same class of
gap as the `failed` exercise noted in fe-2 — the shape is explicit and small, but the
end state has not been produced by the real system.

**Two tabs were not driven simultaneously in a browser.** The 409 path is pinned by
oracle and `be`'s own guard is sealed; what was walked live is one tab.

---

## Files

**Changed** (`stacks/teacher-fe`, commit `b743088`):

- `src/lib/poll.ts` — `pollUntil` extracted; `pollSubject` re-expressed over it;
  `pollSolutions` added
- `src/lib/api.ts` — `startSolutions` + `StartedSolutions`
- `src/components/SolutionView.tsx` — `awaitingIds`, the waiting note, no control while
  a correction is coming
- `src/App.tsx` — `solutionsRun`, the correction poll effect, the batch path, the 409
  join, the relabelled/disabled control
- `src/App.css` — `.sol__pending`

**Added / updated** (job repo):

- `features/parallel-exercises/tests/fe/solutions-progressive.characterization.test.tsx`
- `features/parallel-exercises/tests/fe/exercise-failure.characterization.test.tsx` —
  two fe-2 clauses re-baselined onto the paths that still hold them
- `tests/fe/solution-sheets/solutions-app.characterization.test.tsx` — seven clauses
  re-baselined on the job branch, each with its reason
