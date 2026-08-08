# Contract — `fe` ↔ `be` · exercise revisions + cost attribution

> **Status:** locked by `/planning`, 2026-08-08. Derived from SEED → Solution direction
> #2 and #3. **Posture: strictly additive** — every existing request and response keeps its
> current shape; new fields are added, none moved or renamed.

Covers gap #2 (revisions are overwritten) and gap #3 (cost is unjoinable). They share one
contract because they touch the same two surfaces and the same document.

---

# Part A — exercise revision history (gap #2)

## The constraint that picks the design

From SEED → Solution direction #2, both binding:

- **The current sheet must stay one cheap read.** A teacher opening an exam must not pay
  for its history. → history does **not** live inside the subject document.
- **Exercise ids (`ex1…exN`) must not move.** They are the join key the whole core loop
  turns on. → `replaceExercise` keeps its positional `$set`; nothing about the current
  exercise array changes.

## Storage — the `exercise_revisions` collection

Separate collection. Append-only. Never read on the subject-open path.

```
exercise_revisions
  _id         ObjectId
  subjectId   ObjectId       ← the subject this belongs to
  teacherId   string · 32hex ← denormalised so ownership is scoped IN THE QUERY (see below)
  exerciseId  string         ← "ex1" … "exN"
  exercise    object          ← the SUPERSEDED version, verbatim
  supersededAt Date
  correlationId string | null ← the request that replaced it

index: { subjectId: 1, exerciseId: 1, supersededAt: -1 }
```

**`teacherId` is denormalised on purpose.** Every read filters `{subjectId, teacherId}` in
one query, so another teacher's revisions are indistinguishable from none — the same
not-probeable-ownership rule `getOwned` already follows (`store/subjects.ts:130-133`).
Reading the subject first to check ownership, then the revisions, would be two round trips
and one more place to get it wrong.

**What is written, and when.** `PUT /api/subjects/:id/exercises/:exerciseId` appends the
**outgoing** version before the `$set` lands. The very first replacement of an exercise
therefore stores the *generated original* — which is exactly the material the exercise
library (roadmap 6) is built from.

**Ordering guarantee:** `supersededAt` descending is newest-superseded-first. Index above
serves it directly.

## Surfaces

### `GET /api/subjects/:id/exercises/:exerciseId/revisions` — new

```jsonc
// 200
{
  "revisions": [
    { "revisionId": "…", "exercise": { "id": "ex1", … }, "supersededAt": "2026-08-08T…" }
  ],
  "correlationId": "…"
}
```

- `200 {revisions: []}` when there are none — **never a 404**. "No history yet" is a state
  the UI renders, matching how `GET /api/subjects` treats an empty list
  (`routes/subjects.ts:97-99`).
- `404 subject_not_found` when the subject is absent **or owned by someone else** — the
  identical body either way, as today.
- Unknown `exerciseId` on a subject that exists → `200 {revisions: []}`, not 409. Reading a
  history that does not exist is not an error; only *writing* to an unknown exercise is
  (`409 exercise_not_found`, unchanged).

### `PUT /api/subjects/:id/exercises/:exerciseId` — modified, additively

Request and response shapes are **unchanged**. The only change is the side effect: the
superseded version is appended to `exercise_revisions` first.

**Restoring a previous version is not a new surface.** `fe` restores by calling the existing
`PUT` with the old exercise body — which itself appends the now-superseded current version.
History is therefore linear and never destructive, and no undo-specific endpoint exists.

---

# Part B — cost attribution (gap #3)

## What discovery established

Two findings that together define the fix (SEED journal H4, H5):

1. **`/api/generate` already returns `costUsd`.** `app.ts:145` is
   `res.json({ ...result, correlationId })`, and `result` carries `costUsd` and `durationMs`
   (recorded: `0.645421`, `127676`). **The frozen API needs no change.** What discards it is
   `generateExam`'s internal signature in `fe` (`api.ts:93`, `return payload.data as T`).
2. **`correlationId` is per-request.** A subject's create line and its generation line carry
   *different* ids, so no join exists today even in principle. Recorded proof: link lines
   `82e1faf5…` (create) and `aa9a39f0…` (replace), with the generation's a third id.

## The field

`subjects` gains **one optional field**:

```
subjects
  …
  genCorrelationId  string | null   ← the correlationId of the /api/generate run
                                      that produced this subject. null when unknown.
```

`null` for every one of the ~90 existing documents, and for any subject created without it.
**Nullable is not a compromise, it is the contract** — a subject adopted from the legacy
localStorage draft (`fe App.tsx:95`) genuinely has no generation to point at.

## Surfaces

### `POST /api/subjects` — modified, additively

```jsonc
// request — genCorrelationId is OPTIONAL
{ "subject": {…}, "controls": {…} | null, "genCorrelationId": "43e41235-…" | null }
```

- Omitted or `null` → stored as `null`. **A request without it stays valid**, which is what
  keeps this additive and lets `be` merge before `fe`.
- Response gains `genCorrelationId` alongside the existing fields.

> **Do not confuse the two.** The response already carries a `correlationId` — that is *this
> HTTP request's* id, added by the route (`routes/subjects.ts:89`). `genCorrelationId` is the
> *generation's*. Different values, different meanings; the recorded proof above is exactly
> this confusion made visible.

### `GET /api/subjects/:id` and `GET /api/subjects` — modified, additively

Both return `genCorrelationId` on each record/summary. Existing fields unchanged.

## How cost is actually answered

`genCorrelationId` is the join key into `run-log.jsonl`, whose run lines already carry
`costUsd` and `durationMs`:

```bash
# cost of subject <id>
GEN=$(curl -s -H "x-teacher-id: $TID" localhost:9300/api/subjects/$ID | python3 -c 'import json,sys;print(json.load(sys.stdin)["genCorrelationId"])')
grep "$GEN" run-log.jsonl | python3 -c 'import json,sys;print(sum(json.loads(l).get("costUsd",0) for l in sys.stdin))'
```

**`costUsd` is deliberately NOT denormalised onto the subject.** Two sources of cost truth
drift; the run log is the one that already exists and already carries the number. If direct
queryability is later wanted, denormalising is a one-line addition on top of this — the
join key is the part that is hard to add retroactively, and this is what adds it.

## The invariant that must not be broken

**`run-log.jsonl` carries no teacher content — no titles, no statements, no Arabic.** It
predates this work and is why the file is safe to keep. This contract adds only an id to the
*subject*; it adds nothing to the log.
