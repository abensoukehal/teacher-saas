# Contract — `fe` ⇄ `be` · subjects

> **Status:** created by PLANNING for job `persistence`, iteration `01-initial`.
> **Posture: strictly additive.** Nothing in this contract modifies an existing
> surface. `POST /api/generate` keeps its exact request and response shape
> (SEED kit §3), so an unmodified `fe` still works against a new `be` and the two
> repos may merge in **any order** (`build.md` → `depends_on` stays empty).

## Vocabulary

- **`ExamSubject`** — the generation payload, unchanged. Defined by
  `teacher-fe/src/lib/exam.ts:26`, recorded live at
  `contracts/rec-exam-subject.2026-08-07.json`. `{title, meta, exercises[]}`,
  each exercise carrying a stable `id` (`ex1…exN`).
- **`teacherId`** — an opaque, server-issued, 32-char lowercase hex string. It is
  **not** an account and **not** authenticated. It is a bearer value: whoever holds
  it can read that teacher's subjects. Accepted deliberately for the two-teacher
  test (SEED → Risks); the accounts job replaces it.
- **subject record** — one stored exam subject, owned by exactly one `teacherId`.

## Identity

### `POST /api/teacher`
Issues a fresh id. Takes no body.

```
201 { "teacherId": "9f2c…" }        // 32 lowercase hex chars
```

`fe` calls this once, on first load when it has no id, and keeps the value in
`localStorage` under `teacher.id.v1`.

### Header on every subject route
```
x-teacher-id: <32-hex>
```
- missing / malformed → `401 { "error": { "message": …, "type": "teacher_required" } }`
- well-formed but unknown → treated as valid and owning zero subjects. **No
  enumeration, no error** — an unknown id is indistinguishable from a new one. This
  keeps the id from becoming a probe oracle.

## Subject surfaces

### `POST /api/subjects` — create
```jsonc
// request
{ "subject": <ExamSubject>, "controls": <Controls|null> }
```
```jsonc
// 201
{ "id": "665f…", "createdAt": "2026-08-07T…Z", "updatedAt": "…", "subject": <ExamSubject> }
```
- `subject.exercises` must be a non-empty array and every `id` unique →
  otherwise `400 invalid_request`.
- **Creating never overwrites.** Each call makes a new record. This is the whole
  point of the job (SEED → Problem).

### `GET /api/subjects` — list (summaries only)
```jsonc
// 200
{ "subjects": [
  { "id": "665f…", "title": "اختبار في مادة الرياضيات", "topic": "الدوال العددية والنهايات",
    "exerciseCount": 3, "totalPoints": 20,
    "createdAt": "…", "updatedAt": "…" }
] }
```
Newest first (`updatedAt` descending). **Statements are not included** — a
recorded subject is ~5 KB (SEED kit §2) and a list of them would grow without
bound for no display benefit.

### `GET /api/subjects/:id` — read one
```jsonc
// 200
{ "id": "665f…", "createdAt": "…", "updatedAt": "…", "subject": <ExamSubject> }
```
- not found, **or owned by another `teacherId`** → `404 subject_not_found`.
  Same response either way — ownership must not be probeable.

### `PUT /api/subjects/:id/exercises/:exerciseId` — write through a refinement
```jsonc
// request
{ "exercise": <Exercise> }
```
```jsonc
// 200
{ "id": "665f…", "updatedAt": "…", "subject": <ExamSubject> }   // the whole updated subject
```
- `exercise.id` must equal the `:exerciseId` path segment → else `400 invalid_request`.
- `:exerciseId` must already exist in the subject → else `409 exercise_not_found`.
  **Never appends.** This mirrors `teacher-fe/src/lib/exam.ts:38`, which *throws*
  on an unknown id rather than merging — the server must not be laxer than the
  client it replaces.
- Replacement is positional-stable: the exercise keeps its index in the array.

### No delete
Deliberately absent. *"Everything generated is worth keeping"* (SEED → Solution
direction, from `docs/product-brief.md`). Adding a delete is a scope change.

## Errors

Existing envelope, unchanged: `{ "error": { "message": string, "type": string } }`.

| status | `type` | meaning |
|---|---|---|
| 400 | `invalid_request` | malformed body, duplicate/absent exercise ids, id mismatch |
| 401 | `teacher_required` | `x-teacher-id` missing or malformed |
| 404 | `subject_not_found` | absent **or** owned by someone else |
| 409 | `exercise_not_found` | the exercise id is not in that subject |
| 503 | `store_unavailable` | the datastore is unreachable — **new class**, joins `claude_auth` / `claude_not_installed` / `claude_timeout` / `claude_exit` |

`503 store_unavailable` is retryable, unlike `503 claude_auth`. `be` must not
return a bare `500` when Mongo is down: that is the exact failure the existing
classification scheme exists to prevent (`project/CLAUDE.md` → be § "What must
not be undone").

## Storage shape (`be`-internal, recorded here so PLANNING is not guessing)

Database `teacher_saas` (name already reserved at `project/services.sh:48`),
collection `subjects`:

```jsonc
{
  "_id":       ObjectId,
  "teacherId": "9f2c…",
  "subject":   { "title": …, "meta": …, "exercises": [ … ] },  // ExamSubject VERBATIM
  "controls":  { … } | null,
  "createdAt": ISODate,
  "updatedAt": ISODate
}
```

`subject` nests the payload **verbatim** rather than spreading it: store shape =
wire shape, so there is no mapping layer to drift (SEED → Solution direction 1).

Index: `{ teacherId: 1, updatedAt: -1 }` — the only query the product makes.

## What this contract does NOT cover

Auth, sessions, billing, credits, quotas, search, delete, sharing, and the
exercise-library surface. All are out of scope for this job (SEED → Scope).
