# Journal — fe-2 · reach the progressive path, and show a failed exercise honestly

**Stack:** fe · **Branch:** `feature/parallel-exercises` · **Sealed:** 2026-08-09
**Budget:** 8 cycles · **Used:** 5

---

## Pre-flight — three things checked against the live lane before writing code

fe-1 ended with two unverified assumptions and one deferred decision. The lane was up
this time (`be` :9600, `fe` :10600, slot 6), so all three were settled first.

**1. `POST /api/exams` — the real shape.** One real run, `exerciseCount: 2 / 60 min` to
keep it cheap:

```
HTTP 201 in 22.5 s
keys: ["correlationId", "subject", "subjectId"]
exercises: ex1 pending/"" (8 pts), ex2 pending/"" (12 pts)   Σ = 20
```

`StartedExam` was **right on every key name**, and every slot came back
`status: "pending"` exactly as contract §1 says. The one correction: **201, not 200**.
`request()` gates on `res.ok`, so nothing broke, but the oracle now asserts 201 because
that is what the service does. Recorded as
`tests/fe/fixtures/rec-live-exams.2026-08-09.json`.

**2. The feature, observed rather than assumed.** Polling `GET /api/subjects/:id` every
10 s:

```
06:38:01  ex1=pending(0)  ex2=pending(0)
06:38:51  ex1=pending(0)  ex2=ready(883)   ← a finished exercise, ~60 s before the other
06:39:11  ex1=ready(1144) ex2=ready(883)
```

That gap is what the job ships. It is now a fixture, not a projection.

**3. `POST …/regenerate` — DOES NOT EXIST.** Every call 404s, and the body is
byte-identical to a made-up path's:

```
POST …/exercises/exNOPE/regenerate  → 404 {"message":"not found","type":"not_found"}
POST …/subjects/totally/made/up     → 404 {"message":"not found","type":"not_found"}
```

`be`'s log confirmed it: `be-1` and `be-2` had landed, `be-3` and `be-4` had not.
`regenerateOne` existed as an exported engine function in `routes/exams.ts:415` with no
router mounting it.

> **Superseded during this sub-issue.** `be-3/be-4/be-5` landed before it sealed, so the
> route was re-probed and the retry is now verified against the live service — see
> "Cycle 5". The clauses ran off the contract only in between.

**A real defect fell out of that probe.** `type: "not_found"` was missing from `fe`'s
`KIND` map, so a 404 fell through to the default — `backend`, **retryable** — and the
app would have offered "try again" for the one class of failure a retry can never fix.
Exactly the error-handling shape the retry UI was about to expose. Fixed, with a clause.

---

## Cycle 1 — the amended scope

**Act.** `onGenerate` now calls `startExam`. Three things it deliberately does **not**
do, each written into the code as a comment because each is a plausible mistake:

- **It creates no subject.** `be` inserts the skeleton at plan time, so the exam is
  already stored when the call returns. A `createOnce` here would insert a *second*
  exam — `create` is insert-only and there is no delete route.
- **It does not wait for the exercises.** The blocking wait is now the plan alone, so
  `EXPECT_GENERATE_S = 125` became `EXPECT_PLAN_S = 25` and the label changed from
  «جارٍ توليد الموضوع…» to «جارٍ تحضير هيكل الموضوع…» — leaving the old bar would have
  paced against a wait this path no longer has, and the old copy promised a finished
  exam that is not what arrives.
- **It claims nothing about speed.**

`onRegenerate` + `regenerateExercise` landed alongside, and `ExamView` gained
`onRegenerate`/`regeneratingId`. The retry control renders **only** for a settled
failure — a pending slot gets none, because asking again while it is still being
written spends a second agent loop on the same exercise.

**One hazard this job introduced, fixed here.** An exam can now contain a blank
exercise, and `onGenerateSolutions` sent the exam verbatim to `solution-sheet`. That
asks the model to write a worked answer to nothing — a full ~145 s / $0.756 loop spent
on a guess, which `be` would then store as that exercise's *current* correction.
`onGenerateSolutions` now filters to exercises that have a statement. Identity for a
complete exam, so nothing else changed.

**Verify.** 41/41 on the job oracle.

## Cycle 2 — the promoted net, and what it costs to change behaviour on purpose

Run against the JOB checkout (the clone-root run gates `main` and is vacuous):
**37 failures across 6 files.** All intended, all traceable to one change.

Working through them was the bulk of this sub-issue, and it surfaced something the
amendment did not anticipate: **most of those clauses were not about `/api/generate` at
all.** They used "click generate → expect a create" as a *driver* for behaviour that
lives elsewhere — the save indicator, the queued save, the KPI pair. When generation
stopped creating, the driver stopped working and the subject matter went untested.

So each file needed its own answer, not a find-and-replace. What I settled on:

| file | what actually changed |
|---|---|
| `persistence/app-persistence` | **Driver changed, invariant kept.** "Two generations issue two creates" → "two generations start two exams and `be` answers with different subject ids", plus an explicit `creates()` is **0**. The defect it guards — a second exam destroying the first — is unchanged and now harder to reintroduce, because the insert moved to the side that owns the collection. |
| `persistence/save-state` | **Driver changed.** Its subject is the save indicator on `createOnce` → `persist`. First attempt used the legacy-draft adoption and half the clauses still failed — because `App.boot` calls `createSubject` **directly**, with no `persist()` around it, so that path shows no save state and never did. The real surviving driver is the queued-save replay («حفظ الآن»). |
| `persistence-gaps/pending-save` | **Narrowed, and the new truth added.** The queue's only writer was `onGenerate`. Under progressive generation the failure it protects against — `fe` holding the only copy of a finished exam — **cannot occur**, because `be` stores it before answering. The mechanism is not obsolete, it is now a *drain* for a queue written by an earlier build, which is a real browser state. Re-driven off a pre-seeded queue, plus a new clause: *a progressive generation queues NOTHING*. |
| `persistence-gaps/cost-join` · `accounts-hardening/kpis-thread` | **The invariant MOVED to `be`.** `be` sets `genCorrelationId`, `costUsd` and `durationMs` itself (`exams.ts` → `setKpis`; one correlation id per exam across all spawns). `fe` sends none of them and must not — it cannot measure a fan-out that finishes after the response, and inventing a number would answer the cost question *wrong*, which `project/CLAUDE.md` calls out as worse than not answering. The fe-side clauses moved to the replay path, which still sends the pair; a new clause in each pins that a progressive generation sends none. |
| `persistence-gaps/auth` | **One clause.** It lives in an auth suite to prove the gate did not break the core loop; only the call it rides on moved. |

Two clauses could not simply be re-driven:

- **"the generate REQUEST shape is untouched — /api/generate is frozen"** (in both
  cost-join and kpis-thread). Still true, but the button can no longer observe it.
  Re-pointed at `generateExam` directly, where the frozen request actually lives —
  and `solutions-api` / `solutions-app` still pin the surface being *used*.
- **"an intent arriving mid-flight is queued, then created — both exams exist"**
  (pending-save). This exercises `createOnce`'s drain branch, which needs **two
  independent things** able to start a create. Generation-plus-replay used to be
  exactly that; only the replay is left, and two clicks of it are the *same* intent,
  which `createOnce` collapses by design. The race is now **dormant, not broken**.
  Rather than delete the clause, it asserts the property that makes it unreachable —
  exactly one affordance can start a create — because that is what a future change
  would silently undo, and the drain branch would then need a driver again.

Every changed clause carries a `SUPERSEDED by parallel-exercises fe-2` or
`RE-BASELINED` block saying what moved and why. That follows the precedent already in
these files from `persistence-gaps fe-1` (WF-65).

**Net result: 244 passed** — the original 242 clauses, all still asserting something
real, plus the 2 new ones recording what replaced the old behaviour.

## Cycle 3 — live verification in a real browser

Not a substitute for the oracle; the thing the oracle cannot see. Lane 6, real `be`,
real generation, controls set to 2 exercises / 60 min:

1. Pressed «توليد الموضوع» → `POST /api/exams` → `201`.
2. Progress showed **«جارٍ تحضير هيكل الموضوع… 15 ثانية · عادةً حوالي 25 ثانية»**.
3. Skeleton painted, both slots pending, header already reading **20/20**.
4. Polling filled both exercises. Final DOM: 2 sections, both with a `.statement`,
   **23 and 24 KaTeX islands** rendered, no `data-status` attribute on either (they
   are `ready`, so they carry nothing — which is what keeps a monolith exam identical).
5. **The poll stopped.** 15 requests to `/api/subjects/:id`, then **zero** in the
   following 30 s. 15 × 3 s ≈ 45 s, which matches the time from plan-response to
   both-ready.
6. Console: no errors.

## Cycle 4 — the gates

- Job oracle green **twice**: 41/41, 41/41.
- Promoted net against the job checkout: **244 passed**.
- `tsc -b`, `oxlint`, `npm run build` — all clean.

---

## Freeze audit — `/api/generate`

```
git diff --numstat main -- src/lib/api.ts   →  94  0    (ZERO deletions across fe-1+fe-2)
hunks: @@ -81,6 +81,14 @@   (one row added to KIND)
       @@ -595,6 +603,92 @@ (the new section)

byte-compared against main, by function:
  IDENTICAL  post() — the /api/generate transport
  IDENTICAL  generateExam()
  IDENTICAL  buildRefineRequest() + refineExercise()
  IDENTICAL  buildSolutionRequest() + generateSolutions()
```

Zero deletions is the strongest form of this proof: nothing was removed or modified,
only inserted.

**One thing to declare rather than bury.** The `not_found` row was added to the shared
`KIND` table, which sits inside the line range fe-1 byte-compared. `KIND` is an
error-type lookup used by *both* transports; it is not part of any call's request or
response shape, and every `/api/generate` call site is byte-identical above. I am
calling that inside the freeze, because the freeze is on the calls, not on a line range
— but it is a judgement, so it is stated here rather than left to be discovered.

`App.onGenerate` no longer calls `/api/generate` — that is the amended scope, not a
freeze violation. The surface is still used, by the solution sheet, and still pinned.

---

## What the oracle asserts

`features/parallel-exercises/tests/fe/exercise-failure.characterization.test.tsx`, 16
clauses (41 total for the job with fe-1's suite).

| group | what it pins |
|---|---|
| the amended scope | the button posts `/api/exams` and **not** `/api/generate`; the first ready exercise paints without waiting for the rest; it creates **no** subject; and the LIVE recording is the shape the code reads (201, every slot pending, Σ 20, and every slot ready once the fan-out settles) |
| the frozen surface | a correction still posts `/api/generate` with exactly `{skill, input}` and never touches `/api/exams`; a correction is never asked for an exercise with no statement |
| a failed exercise | an Arabic explanation and a retry control; the others stay rendered, refinable and summing to 20; a **pending** exercise gets no retry; retry hits `/regenerate` for that id only, over a relative URL, and issues **no PUT** (a failed exercise is not a refine — contract §5.4); a 404 is **not** offered as retryable |
| print | the failed slot prints an honest note, never an empty box, and the retry control does not print; a complete exam prints byte-identically with the new prop attached |
| hard constraints | no English, no error code, no `exerciseId`, no LaTeX in the failure copy or the retry label; the new generate wait is Arabic; `statusOf` still reads absent as ready |

---

## Decisions the contract did not cover

1. **`EXPECT_PLAN_S = 25`, and new wait copy.** The contract says `POST /api/exams`
   responds after the plan; it does not say what the teacher sees meanwhile. Leaving
   125 s would have paced the bar against a wait that no longer exists, and «جارٍ توليد
   الموضوع…» would promise a finished exam. Measured 22.5 s live, 25.8 s recorded.

2. **Corrections are only generated for exercises that have a statement.** Not in the
   contract — the interaction between a partial exam and `solution-sheet` is not
   discussed anywhere. Sending a blank exercise would burn a full agent loop and store
   the result as that exercise's current correction.

3. **`not_found` mapped as non-retryable.** `be`'s catch-all 404 type was simply absent
   from `fe`'s map. Pre-existing, found by the retry probe.

4. **Generating a second exam while a first is still filling is allowed.** The button
   stays enabled. `be`'s create is insert-only and the first fan-out continues
   server-side and lands in the list, so nothing is lost — the teacher gets two exams,
   which is what they asked for. Blocking it for ~2 minutes seemed the worse failure.
   Recorded because it is a real behaviour nobody specified.

5. **A `failed` exercise still prints its note.** The clause only forbids an empty box.
   A note on the students' paper is odd copy, but it is the teacher's own warning that
   the sheet is incomplete, and it is strictly better than a blank. Worth a second look
   if a teacher ever prints one for real.

---

## Cycle 5 — the gap closed mid-flight

`be-3/be-4/be-5` landed while this sub-issue was being sealed, so the one thing flagged
as unverified was re-probed rather than left in the journal as a caveat.

**`POST …/exercises/:id/regenerate` now exists** — `routes/subjects.ts:396`, calling
`regenerateOne`. The 404 changed from the app catch-all (`not_found`) to a real
`subject_not_found` with a correlation id, which is how the route announced itself.

One real regeneration against the live lane:

```
POST …/subjects/6a7818d40c106c65630f3b90/exercises/ex1/regenerate   →  200
keys: id · subject · createdAt · updatedAt · genCorrelationId · costUsd · durationMs · correlationId
ex1: 872 → 747 chars, changed          ex2: 831 → 831, untouched
id/label/points preserved on both      Σ points still 20
```

That is a `SubjectRecord`, which is exactly what `regenerateExercise` was typed to
return and what `setExam(rec.subject)` consumes — **no change needed**. Recorded as
`LIVE_REGEN` with a clause pinning it, so the retry path is no longer contract-driven.

What `be` decided that `fe` did not know when this was written, all compatible:

- **A `ready` exercise CAN be regenerated**, with `"keep"` semantics — if the run fails,
  the exercise the teacher already had survives and the request errors rather than
  quietly returning an unchanged 200. `fe` is stricter and offers the control only for
  a settled failure, which is a subset, so nothing conflicts.
- **A second concurrent regeneration of the same exercise is refused with `409
  conflict`** before it spawns. `fe` maps `conflict` to retryable, and the Arabic
  message `be` sends («جارٍ تعديل هذا التمرين، أعد المحاولة») says to retry — correct.
- **An unknown `exerciseId` answers `subject_not_found`**, deliberately identical to a
  subject that is not yours, so existence is not probeable. Already mapped
  non-retryable in `fe`.

## Not verified, and why

**No `failed` exercise has ever been produced by the real system.** `be-3` marks one
now, but ~10% of runs fail (SEED §10.1) and none of the handful run in this session
did. Every failed-state fixture is therefore still synthesised per contract §1
(`statement: ""`, `status: "failed"`). The shape is small and the contract is explicit,
but the rendering has not met a real one — worth a look the first time it happens.

**The failure→retry loop has not been walked end to end in a browser.** Both halves are
verified separately: the progressive path was driven live through the real UI (below),
and the regenerate wire shape is now a live recording. What has not been observed is a
teacher seeing a genuinely failed slot and pressing the button on it, because producing
one on demand is not currently possible.

## Files

**Changed** (`stacks/teacher-fe`, commit `0ae135e`):

- `src/App.tsx` — `onGenerate` → `startExam`; `onRegenerate`; the `regenerate` busy
  state and its progress; the solution-sheet statement filter; plan-wait constants
- `src/components/ExamView.tsx` — `onRegenerate`/`regeneratingId`, the retry control
- `src/lib/api.ts` — `regenerateExercise`, the `not_found` mapping
- `src/App.css` — `.ex__retry`, `.ex__placeholder-text`, retry hidden in print

**Added / updated** (job repo):

- `features/parallel-exercises/tests/fe/exercise-failure.characterization.test.tsx`
- `features/parallel-exercises/tests/fe/fixtures/rec-live-exams.2026-08-09.json`
- `features/parallel-exercises/tests/fe/fixtures.ts` — `LIVE_START` / `LIVE_FINAL` /
  `LIVE_REGEN`
- `tests/fe/persistence/app-persistence` · `tests/fe/persistence/save-state` ·
  `tests/fe/persistence-gaps/pending-save` · `tests/fe/persistence-gaps/cost-join` ·
  `tests/fe/persistence-gaps/auth` · `tests/fe/accounts-hardening/kpis-thread`
  — the promoted net, re-baselined on the job branch with a written reason per clause

## review

**Verdict: approve-with-debt.** (Cross-model REVIEW gate, 2026-08-09.)

**The composition gap this journal flagged is now CLOSED — by review, with a real
failure.** "The failure→retry loop has not been walked end to end in a browser" was the
strongest open risk in the slice, so it was walked: replay-boot be in `trunc-ex1-first2`
(the fan-out's two ex1 attempts truncate for real — the recorded 906-char capture — then
a third succeeds), real Vite dev server, real browser. Observed: skeleton at 201 with
the /20 header correct; ex2/ex3 filled progressively with KaTeX; ex1 settled to the
Arabic failure copy with «إعادة توليد هذا التمرين»; the refine control on the failed
slot disabled; pressing retry issued exactly `POST …/exercises/ex1/regenerate` (no PUT,
no /api/generate) and the slot filled in place with rendered math; the poll stopped
(zero further reads). No English, no error code, no exercise id, no LaTeX anywhere in
the failure surface. **The assembly works.**

**Attack log, rest.**
- Mutations: retry control also offered for `pending` → **1 red**; solution filter
  removed (blank exercises sent to solution-sheet) → **1 red**. Killed.
- The 37-clause re-baseline was audited file by file. Every retired clause either kept
  its invariant on a new driver (app-persistence, save-state), moved it to the side that
  owns it with a replacement clause pinning the new truth (cost-join, kpis-thread), or
  narrowed to the surviving real state with the dormancy itself pinned (pending-save's
  one-affordance clause). **No real invariant was retired.** The promoted net was
  re-run against the job checkout by this review: **244/244**.
- The freeze audit reproduced byte-for-byte, including the declared `KIND` judgement —
  which this review endorses: the freeze is on the calls, and every call site is
  byte-identical.

**Debt — the contract's "pending-and-abandoned" retry is unreachable from the UI.**
Contract §2 blesses regenerating a pending-and-abandoned exercise; be-4 accepts it; fe
offers the retry control only for a settled `failed`. So the one real orphan case —
a be restart mid-fan-out, be-2's recorded gap — leaves a teacher staring at «جارٍ كتابة
هذا التمرين…» with no affordance, forever (the poll stops at MAX_POLLS; the copy keeps
promising). be-2's journal names be-4 as "the teacher-facing recovery" for exactly this,
and that recovery does not compose through this UI. Note the flip side before fixing it
naively: offering retry on any pending slot recreates the double-writer race found in
be-4's review — the right sequencing is be-4's suggested guard first (fan-out fills
registered in the in-flight set), then fe can offer retry on a pending slot the server
will 409 while it is genuinely in flight.

**Also still true (inherited, honest):** no organically-failed exercise has ever been
rendered — the browser walk above used the recorded truncation via replay, which is as
close as it gets without burning a run to chance.
