# Contract — `fe` ↔ `be` · solution sheets

> **Status:** locked by `/planning`, 2026-08-08. Derived from SEED → Solution direction.
> **Posture: strictly additive.** `/api/generate` is untouched, every existing subject route
> keeps its shape, and a `be` deployed before `fe` keeps working.

## The architectural decision this contract encodes

**`be` does not generate a solution. It stores one.**

That mirrors how exams already work: `fe` calls `POST /api/generate` and then posts the
result to `POST /api/subjects`. `be` never spawns the CLI on behalf of the subject routes.
Solutions follow the identical path:

```
fe → POST /api/generate {skill:"solution-sheet", input:{subject}}   ← the ONLY spawn point
   → POST /api/subjects/:id/solutions {solutions, genCorrelationId}  ← pure storage
```

Three things fall out of it, and all three are why the shape was chosen:

1. **`/api/generate` stays the single spawn point** and stays frozen. No new code path can
   invoke the CLI, so the concurrency cap and failure classification keep their meaning.
2. **The storage routes are testable for free.** A generation is ~$0.65 and ~128 s; if `be`
   generated, every test of the storage layer would either pay that or mock the spawn. As
   pure storage, they are driven with a recorded payload.
3. It matches what a reviewer already understands from `POST /api/subjects`.

## Storage — the `solutions` collection

Separate collection, for the same reason `exercise_revisions` is: the subject-open path
must stay one cheap read, and a correction is not part of the exam sheet.

```
solutions
  _id              ObjectId
  subjectId        ObjectId
  teacherId        string · 32 hex   ← denormalised: ownership scoped IN the query
  exerciseId       string            ← "ex1" … "exN"
  answer           string            ← Arabic markdown, maths in $…$ — a WORKED answer
  scale            [ { part: string, points: number } ]   ← السلّم
  answersHash      string            ← sha256 of the exercise STATEMENT this answers
  genCorrelationId string | null     ← the /api/generate run that produced it
  createdAt · updatedAt  Date

index: { subjectId: 1, exerciseId: 1 } unique   ← one current solution per exercise
```

**`answersHash` is the whole staleness mechanism.** It is a hash of the exercise
`statement` as it was when the solution was generated. On read, `be` recomputes the hash of
the exercise as it is *now* and reports `stale: true` when they differ. Nothing is deleted
and nothing is silently served.

Why a content hash and not the subject's `rev`: `rev` advances when **any** exercise is
replaced, so it would mark every solution in the exam stale after a single refine. The hash
is per-exercise and marks exactly the one that changed.

## Surfaces

### `POST /api/subjects/:id/solutions` — new

```jsonc
// request — the whole exam's solutions, from ONE generate run
{
  "solutions": [
    { "exerciseId": "ex1", "answer": "…", "scale": [ { "part": "…", "points": 2 } ] }
  ],
  "genCorrelationId": "43e41235-…" | null
}

// 201
{ "solutions": [ { "exerciseId": "ex1", "answer": "…", "scale": [...], "stale": false } ],
  "correlationId": "…" }
```

- **Upsert per `(subjectId, exerciseId)`.** Unlike subjects, a solution *replaces* its
  predecessor: there is exactly one current correction per exercise, and regenerating a
  stale one is the whole point. (History of corrections is explicitly out of scope.)
- **An `exerciseId` not present in the exam is rejected** — `400 invalid_request`. A skill
  that invents an id would otherwise silently store an answer to nothing.
- **The grading scale must sum to that exercise's `points`** — `400 invalid_request` when it
  does not. This is the one *checkable* property a correction has, and the SEED makes it the
  standard the skill's output is judged on. Rejecting here is what stops a mis-scaled
  correction reaching a class.
- Partial submission is allowed: solutions for a subset of exercises is valid.

### `GET /api/subjects/:id/solutions` — new

```jsonc
// 200
{ "solutions": [ { "exerciseId": "ex1", "answer": "…", "scale": [...], "stale": true } ],
  "correlationId": "…" }
```

- `200 {solutions: []}` when there are none — **never a 404**, matching how the revisions
  route and `GET /api/subjects` treat emptiness.
- `stale` is computed per solution on every read by rehashing the current exercise. It is
  never stored as a flag, because a stored flag drifts from the thing it describes.
- `404 subject_not_found` for a subject that is absent **or owned by someone else** —
  identical body either way.

### What does NOT change

`/api/generate`, `POST /api/subjects`, `GET /api/subjects`, `GET /api/subjects/:id`,
`PUT /api/subjects/:id/exercises/:exerciseId` and the revisions route all keep their exact
request and response shapes. Refining an exercise does **not** touch the `solutions`
collection — staleness is derived on read, so there is nothing to update and nothing that
can be missed.

## Error contract

Existing envelope, Arabic messages, stable `type`:

| Status | `type` | When |
|---|---|---|
| 400 | `invalid_request` | malformed body · unknown `exerciseId` · scale does not sum to the exercise's points |
| 401 | `teacher_required` | unchanged |
| 404 | `subject_not_found` | absent or another teacher's — identical body |
| 503 | `store_unavailable` | datastore down (retryable) |

`claude_auth` and `store_unavailable` are both 503 and mean opposite things — branch on
`error.type`.

## The skill — `solution-sheet`

Lives at `teacher-be/agent/.claude/skills/solution-sheet/SKILL.md`. **Not** at the repo
root: `config.ts:39` points the CLI at `<repo>/agent`, and `skills.ts:19` reads
`config.claude.cwd + /.claude/skills`. Adding the directory is the whole registration —
`GET /api/skills` is a directory listing, so it self-advertises with no code change.

**Input:** the stored exam (`{title, meta, exercises[]}`).
**Output:** JSON only, `{"solutions":[{"exerciseId","answer","scale"}]}` — one entry per
exercise in the input, no invented ids, scale summing to each exercise's `points`.

Non-negotiables inherited from the existing skills: Arabic everywhere, maths in `$…$`, no
French or English, on-syllabus method (`curriculum/` read only when needed — every
invocation is charged ~$0.20 of context before any work).
