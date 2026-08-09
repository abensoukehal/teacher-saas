# Contract — fe ↔ be · progressive exam generation

> Locked at PLANNING. Both stacks implement against this; neither may change it alone.
> Derived from `SEED.md` §5 (exit criteria), §9.1 (frozen surfaces), §10 (failure rate).

## 0 · The two decisions the SEED left to PLANNING

**Transport: POLLING, not SSE.** The exam is persisted progressively, and `fe` re-reads it.

Why not SSE: it needs reconnect handling, and the dev path runs through a Vite proxy where
buffering behaviour is one more thing to verify. Polling needs none of that, survives a
refresh for free (the state is in the store, not in a connection), and reuses
`GET /api/subjects/:id` — a surface `fe` already calls. The SEED's own constraint applies:
don't over-engineer. **A generation takes ~110 s; a 3 s poll is 1/36th of that** — the
latency polling adds is irrelevant at this timescale, which is exactly why the simpler
mechanism wins here and would not in a chat UI.

**Persistence: INSERT THE SKELETON AT PLAN TIME, then fill each exercise in place.**

`exam-plan` returns every `id`, `label` and `points` before any exercise exists (SEED §1).
So the whole document can be inserted once — honouring insert-only `create` — with N
placeholder exercises, and each fan-out result then fills its slot via the existing
`replaceExercise` compare-and-set. No new persistence mechanism, no upsert, no second
insert path.

## 1 · Exercise status — the only shape change

Each entry in `subject.exercises[]` gains **one** field:

```
status: "pending" | "ready" | "failed"
```

- **`pending`** — a placeholder from the plan. `statement` is `""`. `id`, `label`,
  `points`, `difficulty` are already final and MUST NOT change when it fills.
- **`ready`** — generated and valid. Indistinguishable from a monolith exercise.
- **`failed`** — generation returned malformed or unusable output after retries. `statement`
  stays `""`. The exam is still an exam; this one exercise is not.

**A subject with no `status` on its exercises is a monolith-era exam and reads as
`ready`.** 6,086 stored exams predate this field; absent MUST NOT read as `pending`, or
every existing exam becomes a half-finished one. (This is the same class of bug as
`roleOf` absent→admin, which survived a green gate in `accounts-hardening`.)

## 2 · Surfaces

### `POST /api/exams` — NEW. Starts a progressive generation.

`/api/generate` is **FROZEN** (SEED §9.1) and is not extended. This is a separate surface.

Request — the same controls `exam-subject` takes today:
```json
{ "stream": "...", "level": "3AS", "topic": "...", "difficulty": "...",
  "exerciseCount": 3, "durationMinutes": 120, "format": "composition", "note": "..." }
```

Responds **after the plan completes** (~26 s), NOT after the exercises:
```json
{ "subjectId": "…", "subject": { … exercises all status:"pending" … },
  "correlationId": "…" }
```
Requires `x-teacher-id`; `401 teacher_required` without it. The fan-out continues
server-side after the response is sent.

### `GET /api/subjects/:id` — UNCHANGED shape, new content

Already exists, already ownership-scoped. Returns the subject with whatever exercises have
filled so far. **No new endpoint, no new auth path.** `fe` polls this.

### `POST /api/subjects/:id/exercises/:exerciseId/regenerate` — NEW. Retry one exercise.

For a `failed` (or `pending`-and-abandoned) exercise. Regenerates from the stored assignment
and fills the same slot. Returns the updated subject. `404` if the id is not in the exam,
scoped by owner exactly as every other subject route.

## 3 · Errors

Existing classification applies unchanged — callers branch on `error.type`, never the code.
No new error types. A malformed generation is **not** an error response: the exam succeeds
with that exercise marked `failed`, because the other exercises are real and useful.

`503 claude_auth` on the PLAN is a real failure of `POST /api/exams` — nothing can start.
The same error on one fan-out exercise marks that exercise `failed`.

## 4 · What `fe` must do

- Poll `GET /api/subjects/:id` while any exercise is `pending`. Stop when none are.
- Render `ready` exercises immediately; never wait for the whole exam.
- `pending` renders as a waiting state **in Arabic, RTL** — never English, never a raw id.
- `failed` renders with a retry affordance calling `/regenerate`.
- **Never render an empty `statement` as an exercise.** A blank exercise looks like a
  product bug to a teacher, which is worse than an honest "still writing this one".

## 5 · Invariants neither stack may break

1. **Points sum to 20 from the moment the skeleton is inserted** — the plan guarantees it
   before any exercise exists, and filling an exercise never changes `points`.
2. **`id`, `label`, `points` are the assignment.** A fill that changes one is a defect, not
   a variation. `exercise-one` echoes them back and `be` MUST verify rather than trust.
3. **Ids stay `ex1…exN` in order.** The whole core loop joins on them.
4. **Filling a placeholder is NOT a revision.** `exercise_revisions` records *superseded
   teacher-visible work*; a placeholder is not that. Recording it would put an empty
   statement in history and make "restore" able to restore a blank.
5. **`replaceExercise`'s CAS on `rev` still applies** — the fan-out writes N exercises
   concurrently into ONE document, which is precisely the race that CAS exists for. This is
   the first code path that races it deliberately.
6. **No claim that generation is faster** — not in a response field, a log line, or UI copy.
