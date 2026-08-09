# Journal — fe-1 · render the exam as it arrives

**Stack:** fe · **Branch:** `feature/parallel-exercises` · **Sealed:** 2026-08-09
**Budget:** 10 cycles · **Used:** 3

---

## Pre-flight

Read in order: SEED §3 (what survived — first exercise ~74 s, not a faster exam) and
§5 (exit criteria), the contract §1 and §4, the fe-1 six-slot sub-issue, and
`project/CLAUDE.md`'s fe section.

**Perimeter baseline, taken before touching anything.** `tools/ci fe` from the clone
root gates the MAIN checkout, which this job's branch does not touch — it would have
been a vacuous green. So the promoted net was run against the JOB checkout instead, by
pointing the harness at both trees by hand:

```
CHAR_ROOTDIR=<worktree>/stacks/teacher-fe  CHAR_TESTDIR=project/tests/fe \
  npx vitest run --config tools/tests/vitest.characterization.config.ts
→ 18 files, 242 passed
```

That baseline turned out to matter more than expected — see the freeze finding below.

---

## Cycle 1 — the shape, and what the promoted net already forbids

**Diagnose.** Two facts from the existing code decided the design before any of it was
written:

1. **`ExamView`'s HTML is pinned byte-for-byte.** `project/tests/fe/solution-sheets/`
   compares `ExamView`'s output against recorded baselines
   (`exam-print-baseline.html`, `exam-screen-baseline.html`). Any attribute added
   unconditionally to a `<section class="ex">` breaks a monolith exam's render — which
   is exactly the 6,086-exam regression the contract §1 is about, caught by markup
   rather than by logic.
2. **The promoted net binds the generate button to `/api/generate`.**
   `persistence-gaps/cost-join`, `accounts-hardening/kpis-thread` and
   `persistence-gaps/auth` all click «توليد الموضوع» and assert a POST to
   `/api/generate` with exactly `{skill, input}`. Repointing that button at
   `POST /api/exams` would turn the perimeter red, and fe-1's exit protocol requires it
   green. Recorded as a decision the contract did not cover — see the bottom of this
   journal.

**Act.**

- `src/lib/exam.ts` — `ExerciseStatus`, an optional `status` on `Exercise`, and four
  small readers: `statusOf`, `hasStatement`, `isRenderable`, `hasPending`.
  `statusOf` **whitelists** `"pending"` and `"failed"` and returns `"ready"` for
  everything else, including absent. Written that way on purpose rather than
  `ex.status ?? "ready"`: the failure direction is then fixed by construction — a
  value a future build sends and this one has never heard of can only make an exercise
  render, never make it vanish or start a poll.
- `src/lib/poll.ts` — new. `pollSubject` re-reads `GET /api/subjects/:id` while
  anything is pending. `wait` is injectable so an oracle can drive the loop without
  wall-clock time; faking timers globally would also fake React's and the fetch mock's,
  which turns "does it stop" into a test of the fake.
- `src/lib/api.ts` — `startExam` → `POST /api/exams`, appended in its own section. It
  reuses the existing `request` transport, not `post`: `post` enforces generation's
  contract (a 200 with `data: null` is a FAILED run), which is meaningless for a
  surface that has no `data` envelope.
- `src/components/ExamView.tsx` — `ExerciseBody` picks a `<Statement>` or an Arabic
  note. `data-status` and `aria-busy` are **omitted** for a ready exercise rather than
  set to a default, which is what keeps the recorded baselines byte-identical.
- `src/App.tsx` — one effect, keyed on a **boolean** `awaiting`, not on `exam`.
  Depending on the exam object would tear down and re-arm the loop on every fill,
  paying the 3 s interval again each round.

**Verify.** `tools/ci fe --slug parallel-exercises` → 19 passed, 6 failed.

## Cycle 2 — three real defects, one of them in the fixtures

**Diagnose.** The six failures were three causes:

1. **`.statement` is not exercise-only.** The assumptions notice renders `<Statement>`
   per assumption, so a monolith exam has 7 `.statement` nodes for 3 exercises. My
   counts were wrong, not the component. Scoped every query to
   `section.ex .statement`.
2. **KaTeX legitimately paints Latin letters.** `expectNoLatinWords` was tripping on
   `limx` — the rendered form of `\lim`, which is mathematical notation a teacher is
   *meant* to read, not an English UI string. Added `uiText()`, which strips the
   `.katex` islands, and pointed the Arabic-only assertion at it. `expectNoLatex` still
   reads `visibleText`, because leaked TeX is exactly what it is hunting.
3. **A genuine fixture bug, and the most useful failure of the run.** `partial()` built
   a `ready` ex1 from `FILLED["ex1"]` — which does not exist, because the recorded
   fan-out's ex1 is *the truncated one*. The spread of `undefined` produced an exercise
   with no id, no label and no statement. React said so ("Each child in a list should
   have a unique key"), and the app then rendered it as a placeholder, which is the
   correct behaviour for a bodiless exercise. The suite was lying, not the code.

**Act.** `partial()` now borrows the monolith recording's exercise of the same id when
the fan-out has no body for it — still real recorded model output, never invented text
— and the plan's `id`/`label`/`points` win over the borrowed body, because those are
the assignment (contract §5.2). A `ready` id with no recorded body anywhere now throws
rather than silently producing an empty exercise.

**Verify.** 25/25 green.

## Cycle 3 — the gates

- Oracle green **twice** in a row: 25/25, 25/25.
- Promoted net against the job checkout: **242 passed**, unchanged from baseline.
- `npx tsc -b` → clean. `oxlint` → clean. `npm run build` → builds (this repo has had
  a `tsc`-only-fails-at-build defect before, so the full build is run, not just the
  typecheck).

---

## Freeze audit — `/api/generate`

Mechanical, not by eye:

```
git diff --numstat main -- src/lib/api.ts     →  56  0  src/lib/api.ts   (0 deletions)
diff <(git show main:src/lib/api.ts | sed -n 1,232p) <(sed -n 1,232p src/lib/api.ts)
                                              →  IDENTICAL
   covers: post(), generateExam(), buildRefineRequest(), refineExercise()
diff <(git show main:… | sed -n 467,596p) <(sed -n 467,596p src/lib/api.ts)
                                              →  IDENTICAL
   covers: buildSolutionRequest(), generateSolutions(), saveSolutions(), listSolutions()
```

The only new occurrence of the string `/api/generate` anywhere in the file is inside a
comment in the new section, saying it is frozen. `App.onGenerate` is untouched, which
is why the promoted net's frozen-request clauses still pass.

---

## What the oracles assert

`features/parallel-exercises/tests/fe/progressive-render.characterization.test.tsx`,
25 clauses. Every payload is a **replay** — the recorded plan and fan-out of
2026-08-09 (`fixtures/rec-fanout.2026-08-09.json`) and a real pre-`status` exam
(`fixtures/rec-exam-subject.2026-08-07.json`). Nothing calls a live generation.

| group | what it pins |
|---|---|
| renders as it arrives | ex1 ready + ex2/ex3 pending → one real statement, two Arabic waiting states; the /20 and the exercise order are right from the **first** paint, before any statement exists; a fill keeps the assignment's id, label and points |
| never an empty statement | pending, failed, **and a `ready` exercise with a blank body** all draw a spoken-for gap, never an empty box; `isRenderable` needs both a ready status and a body; the recorded 906-char truncation costs one exercise while the other two stay usable; a bodiless exercise cannot be refined |
| absent means ready | a subject with no `status` anywhere renders every exercise in full and draws zero placeholders; `statusOf` maps absent, `"ready"` and an unknown value to ready; `hasPending(MONOLITH)` is false, so the back catalogue starts no poll |
| polling stops | stops the read after the last fill and does **not** read again; an already-complete subject costs exactly one read; an abort stops it with no update after; an unsettling fan-out is bounded by `maxPolls`; a retryable read failure is survived, a dead identity stops it immediately |
| the app end to end | opening a filling exam paints what exists, fills the rest over real 3 s intervals, and then **the read count stops moving** for three further intervals; opening a monolith exam issues exactly one read, ever |
| `POST /api/exams` | its own relative URL, `x-teacher-id`, controls unwrapped with no `{skill, input}` envelope; answers a skeleton summing to 20; the existing failure contract applies unchanged (branch on `type`) |
| hard constraints | no English in any new string or control label; the waiting/failure copy names no exercise id, status word or error code; no LaTeX visible in a statement, a waiting state or a failure; the placeholder uses no physical left/right; a pending section is `aria-busy` and a ready one carries **no** extra attribute |

**No oracle asserts total generation time**, in either direction (SEED §5.5, §10.2).

---

## Decisions the contract did not cover

1. **The generate button was NOT repointed at `POST /api/exams`, and nothing in the UI
   starts a progressive run yet.** This is the significant one.

   The promoted net binds «توليد الموضوع» to `/api/generate` with a frozen request
   shape, and fe-1's exit protocol requires that net green. Both cannot hold. Treating
   the frozen oracle as the authority, the button stays; `startExam` ships tested but
   is not yet called from `App`.

   Wiring it is one small change — `setExam(started.subject)` +
   `setSubjectId(started.subjectId)`, after which the poll effect takes over on its
   own, with no create call to make because the exam is already stored. **Somebody has
   to decide how a teacher reaches the progressive path**, and it is a product
   question, not a mechanical one: a second generate button in a two-teacher MVP is
   over-engineering, and replacing the existing one is a deliberate behaviour change
   that retires several promoted clauses. Flagged for fe-2 / PLANNING rather than
   decided here.

2. **The poll is driven by the exam on screen, not by "this tab started a run".**
   The contract says the fan-out continues server-side after the response is sent, and
   the skeleton is persisted at plan time — so the teacher who refreshes, opens the
   exam from the sidebar, or arrives on a second machine should walk into the same
   filling-in exam. Keying the poll on `hasPending(exam)` gets all three for free and
   leaves no in-memory job to lose.

3. **A `ready` exercise with an empty body renders as a gap, not as an exercise.**
   The contract only defines empty statements for `pending` and `failed`. Trusting
   `status` alone would mean trusting `be` never to emit a ready-and-empty exercise,
   and the cost of that trust being misplaced is precisely the blank box §4 forbids.
   `isRenderable` therefore requires both. Pinned by its own clause.

4. **Backstop sizing.** `MAX_POLLS = 200` at 3 s ≈ 10 minutes — several times the worst
   measured run (121.8 s for one exercise plus a ~26 s plan, SEED §10). It exists to
   bound a hang, never to cut a slow-but-live generation short. The oracle pins that it
   is finite and inside a sane band rather than pinning the literal.

5. **A retryable read failure is swallowed and the poll continues; a non-retryable one
   throws.** Not in the contract. A wifi blip must not strand a half-drawn sheet the
   store has already finished, and `maxPolls` still guarantees termination — so
   swallowing cannot become the infinite loop. A `teacher_required` is the opposite: a
   loop whose every iteration is refused.

---

## Not verified, and why

**`POST /api/exams` was never called against a live `be`.** The endpoint is being built
in parallel by the `be` agent and did not exist during this work; the lane was also
down for the whole session (`tools/obs status` → backend/frontend DOWN on slot 6). The
`startExam` clauses are therefore driven off the contract's stated shapes, not off a
recorded live response.

**What that leaves open:** whether `be` answers `{subjectId, subject, correlationId}`
with those exact key names, and whether the skeleton it inserts carries
`status: "pending"` on every exercise as §1 says. Both are cheap to confirm with one
curl once the lane is up, and if either differs the fix is in `StartedExam` and the two
`POST /api/exams` clauses — nothing else in this slice depends on it. The polling,
rendering and back-catalogue halves are all driven off `GET /api/subjects/:id`, which
already exists and is unchanged.

---

## Files

**Changed** (`stacks/teacher-fe`, commit `8b91451`, 56 insertions / 0 deletions in
`api.ts`):

- `src/lib/exam.ts` — status type + four readers
- `src/lib/poll.ts` — NEW
- `src/lib/api.ts` — `startExam`, additive
- `src/components/ExamView.tsx` — `ExerciseBody`, conditional attributes
- `src/App.tsx` — the poll effect
- `src/App.css` — `.ex__placeholder`

**Added** (job repo):

- `features/parallel-exercises/tests/fe/progressive-render.characterization.test.tsx`
- `features/parallel-exercises/tests/fe/fixtures.ts`
- `features/parallel-exercises/tests/fe/fixtures/rec-fanout.2026-08-09.json`
- `features/parallel-exercises/tests/fe/fixtures/rec-exam-subject.2026-08-07.json`

## review

**Verdict: approve.** (Cross-model REVIEW gate, 2026-08-09.)

**Blind vs actual:** predicted shape matched (status readers, injectable-wait poll,
additive api.ts, conditional attributes, boolean-keyed effect). The deliberate
non-wiring of `startExam` — the biggest judgement call in this journal — was resolved by
fe-2's amendment and is the right call in hindsight: the frozen oracle won, and the
repoint happened as a *declared* behaviour change instead of a silent one.

**Attack log.**
- Mutations: `statusOf` absent→pending → **8 red**; `isRenderable` trusting status alone
  → **2 red** (the blank-box clauses); unbounded poll (`maxPolls` ignored) → **17 red**
  (suite-wide timeouts — the stop property is heavily load-bearing). All killed.
- The freeze audit reproduced exactly: `git diff --numstat main -- src/lib/api.ts` →
  94 insertions, **0 deletions** (fe-1+fe-2 combined); `post`/`generateExam`/
  `buildRefineRequest`/`generateSolutions` byte-identical to main.
- The promoted net (242→244 clauses) verified green against the JOB checkout by this
  review, independently of the journals' runs — including the byte-pinned ExamView
  baselines, which is the 6,086-exam regression guard doing its job.
- Live composition (real browser, replay be): skeleton painted with the /20 correct
  before any statement; fills appeared on the sheet; the poll stopped (network log went
  quiet after settle). The "opens mid-generation from another entry point" property is
  what the boolean-keyed effect buys, and it is pinned.

Nothing broke. The one thing I expected to break — a monolith exam somewhere reading
`pending` through a missed default — has exactly one definition per stack (`statusOf`),
both allow-lists, both mutation-killed. That is why it could not break.
