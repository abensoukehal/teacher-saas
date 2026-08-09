# be-2 — POST /api/exams: plan, insert the skeleton, fan out, fill in place

**status:** done · **tag:** happy-path · **cycles used:** 5 of 12

## What changed

`stacks/teacher-be`, one commit `4a348a4`:

| file | change |
|---|---|
| `src/routes/exams.ts` | NEW — the whole surface: controls validation, the plan run, plan verification, the skeleton insert, the detached fan-out, per-slot fill, KPI write-back |
| `src/store/subjects.ts` | `ExerciseStatus` + `Exercise.status?`, `statusOf()`, the revision gate in `replaceExercise`, `setKpis()` |
| `src/app.ts` | one import, one mount, one line in the `/api` index — **nothing else** |

### The flow

`POST /api/exams` → `runClaude(exam-plan)` → verify the plan → `create()` the whole
document with N `pending` placeholders → **respond `201 {subjectId, subject,
correlationId}`** → detached fan-out of `exercise-one` × N → each result verified and
written into its slot via `replaceExercise` → `setKpis()` when the last one settles.

`fe` polls `GET /api/subjects/:id`, which is unchanged and already ownership-scoped.

### `statusOf` — the one place the default lives

```ts
export function statusOf(exercise: { status?: unknown }): ExerciseStatus {
  const s = exercise.status;
  return s === "pending" || s === "failed" ? s : "ready";
}
```

An **allow-list**, not `?? "ready"`. Only the two literals meaning "not finished" ever read
that way; absent, junk, wrong case, a number, `null` all degrade to `ready` — the direction
that cannot hurt. 6,086 stored exams predate the field, and the wrong default would turn
the entire archive into half-written exams *and* silently stop `exercise_revisions` for all
of it. This is the `roleOf` absent→admin class that survived a green gate in
`accounts-hardening`.

### The revision gate

`replaceExercise` archives only when `statusOf(outgoing) === "ready"`. Decided from the
outgoing exercise's own status rather than from a caller flag, so there is no second code
path that can forget — and so behaviour is byte-identical for every pre-existing exam.
Contract §5.4: a placeholder's statement is `""`, and archiving one would let a later
"restore" put a blank exercise on a printed sheet.

## What the oracle asserts

`features/parallel-exercises/tests/be/progressive-generate.characterization.test.js` —
36 clauses (55 with be-1's suite).

**The skeleton.** N exercises, all `pending` with `statement: ""`; ids `ex1…exN` in order;
points `[5,7,8]` summing to 20 *before a single exercise exists*; a correlation id and a
valid subject id on the response.

**Ownership and auth.** Owner reads the skeleton back; a second valid teacher and a
nonexistent id produce byte-identical 404 bodies (existence is not probeable); no
`x-teacher-id` → `401 teacher_required`; a well-formed but never-issued id → the same 401.

**Bounds.** `exerciseCount` of 99, 0, 2.5 and `"3"`, and a negative duration → `400
invalid_request`.

**The race — the clause this sub-issue exists for.** Three exercises finish together and
write into one document; all three land `ready` with non-empty statements, and `rev` is
exactly 3 — one increment per fill, which is what proves nothing was clobbered or applied
twice. Then the same at width 6, which also crosses the global gate (3 run, 3 queue).

**Filling is not a revision.** `exercise_revisions` is empty for a fanned-out exam, checked
both directly in Mongo and through
`GET /subjects/:id/exercises/:exerciseId/revisions`.

**Verify, don't trust.** A dedicated replay mode makes `exercise-one` return 8 points where
the plan said 7 — a run the CLI reports as a *success*, with no exit code, no `is_error`
and no exception. The slot is refused and stays `pending`, ex1 and ex3 still land, and the
exam still sums to 20. Untrusted, that exam would total 21 and the teacher would find out
while printing.

**Absent status.** A legacy subject planted directly in Mongo (no `status`, no `rev`) never
reads `pending`; replacing one of its exercises **does** archive a revision; the same for
`"READY"`, `"Pending"`, `1`, `null`, `"queued"`; and — the contrast that proves the branch
is real — an explicit `pending` or `failed` placeholder archives nothing.

**The freeze.** `/api/generate` returns exactly
`{correlationId, costUsd, data, durationMs, sessionId, text}`, still needs no teacher
header, and its `data.exercises` carry no invented `status`.

### Mutation spot-checks (all three caught)

| mutation | result |
|---|---|
| `statusOf` defaults to `pending` | **6 clauses red** |
| drop the revision gate (always archive) | **3 clauses red** |
| single-attempt CAS, no outer retry | **red — 2 of 3 fills permanently lost** |

The third is the important one: it measures that the contention is *real*, not theoretical.
Without the retry budget the fan-out silently loses two thirds of a teacher's exam.

## Decisions the contract did not cover

1. **`status` is NOT synthesised on read for exercises that lack it.** Normalising in
   `toRecord` would have been tidier, but two clauses in the promoted regression net assert
   `body.subject` round-trips byte-identically (`persistence/subjects-api:125`,
   `accounts-hardening/kpi-fields:250`), and silently reddening the mainline gate is a
   worse trade than one defaulting rule. `statusOf()` is the single definition inside `be`;
   contract §1 already binds `fe` to the same default, and `fe`'s natural spelling
   (`status === "pending" ? waiting : render`) fails safe by construction.

2. **No stored copy of the plan.** be-4's regenerate needs an assignment, so the skeleton
   puts the assignment's topic into the exercise's existing `topics` field, and `avoid` can
   be derived from the sibling exercises' topics at regenerate time. That keeps the
   `subjects` document shape frozen apart from `status`, and a derived `avoid` is fresher
   than a stored plan would be.

3. **One correlation id for the whole exam.** SEED §9.3 flagged that a fan-out has N+1
   correlation ids while `genCorrelationId` is a single value. Every spawn is given the
   request's id, so the run-log join still works and now sums to the exam's real usage
   rather than the plan's alone.

4. **`setKpis` after the fan-out settles.** `create` cannot know the totals — the plan is
   roughly a quarter of the exam. Storing the plan's alone would under-report every
   progressive exam in `/api/admin/kpis` by ~4x; leaving them null would drop the whole new
   path out of those averages. Existing fields, one `$set`, no shape change.
   ⚠ `costUsd` is a usage signal, not money.

5. **`MAX_EXERCISES = 6`.** A fan-out is N concurrent agent loops at ~0.75–1 GB each against
   a flat global gate. An unbounded `exerciseCount` is a resource-exhaustion vector, not a
   big exam. This is *not* be-5's per-exam budget — only the bound that keeps be-2 from
   being the hole.

6. **A bad plan is `502 claude_bad_output`.** Contract §3 forbids new error types, so plan
   verification (ids `ex1…exN`, positive points, a label, the sum) raises the runner's
   existing `bad_output` code, which `app.ts` already maps to 502.

7. **`201`, not `200`.** A document is created. Consistent with `POST /api/subjects`.

## Known gaps, deliberately left

- **A restart mid-fan-out orphans `pending` slots.** The fan-out lives in process memory;
  nothing resumes it. be-4's `regenerate` is the teacher-facing recovery, and be-3 owns the
  automatic half. Recorded, not silently inherited.
- **No real generation was run end to end.** Every clause replays SEED §9.2's recordings.
  A live run costs ~4 agent loops and real quota; the pieces were already measured, and
  the exit protocol asks for a recording diff, not a live call.

## Exit protocol

- oracle green ×2 — 55/55, twice
- `/api/generate` handler diffed against `HEAD` and **byte-identical** (45 lines, no diff)
- freeze audit: `src/app.ts` changes are an import, one index entry and one mount; the
  `subjects` document shape gains only `exercises[].status`; the `{teacherId, updatedAt}`
  index untouched
- mutation spot-check on the absent-status default — 6 clauses red under the flip
- journal sealed
