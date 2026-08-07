# Flows — job `persistence`, iteration `01-initial`

> Sequences across the `fe ⇄ be ⇄ mongo` boundary. Derived from SEED kit §4 (the
> recorded end-to-end trace). Generation itself is **frozen** and shown only as
> context — this job adds what happens *after* the payload comes back.

## F1 · First load — a teacher gets an identity

```
fe boot
 └─ localStorage["teacher.id.v1"]?
      ├─ present → use it
      └─ absent  → POST /api/teacher
                     └─ be: crypto.randomBytes(16).toString("hex")
                   ← 201 {teacherId}
                     └─ fe: localStorage["teacher.id.v1"] = teacherId
 └─ GET /api/subjects   (x-teacher-id)
      └─ mongo: subjects.find({teacherId}).sort({updatedAt:-1})
    ← 200 {subjects:[…summaries…]}
```

**One-shot adoption** (runs once, immediately after the id exists):
```
localStorage["teacher.draft.v1"] present?
 └─ yes → POST /api/subjects {subject: <that draft>}
            ← 201 {id,…}
          └─ localStorage.removeItem("teacher.draft.v1")
 └─ no  → nothing
```
This is why no teacher loses the draft they had before this job shipped. It runs
exactly once because the key is cleared on success — and **only** on success.

## F2 · Generate → persist (the fix for the single-slot defect)

```
teacher sets controls → "generate"
 └─ POST /api/generate {skill:"exam-subject", input:{…}}     ← FROZEN, unchanged
      └─ claude CLI, ~128 s, $0.65                            (SEED kit §2)
    ← 200 {text, data, sessionId, costUsd, durationMs, correlationId}
 └─ POST /api/subjects {subject: data, controls}              ← NEW
      └─ mongo: insertOne({teacherId, subject, controls, createdAt, updatedAt})
    ← 201 {id, createdAt, updatedAt, subject}
 └─ fe: currentSubjectId = id ; prepend summary to the list
```

**The behaviour change that is the whole job:** this is `insertOne`, never an
upsert on a fixed key. Generating a second exam leaves the first untouched. Compare
today's `fe`, where `useEffect(() => saveDraft(exam), [exam])` writes over
`teacher.draft.v1` (SEED → Problem).

## F3 · Refine one exercise → write through

```
teacher edits ex2 in plain Arabic
 └─ POST /api/generate {skill:"refine-exercise", input:{instruction, exercise, examContext}}
    ← 200 {data: <one Exercise, id/points/label preserved>}    ← FROZEN, unchanged
 └─ fe: spliceExercise(exam, updated)     (exam.ts:38 — THROWS on unknown id)
 └─ PUT /api/subjects/:id/exercises/ex2 {exercise: updated}     ← NEW
      └─ mongo: positional update of subject.exercises[$], set updatedAt
    ← 200 {id, updatedAt, subject}
```

Server-side, `ex2` must already exist or the call is `409 exercise_not_found`.
The server is deliberately **no laxer than the client** it takes over from:
`exam.ts:38` already throws rather than merging an unknown id.

## F4 · Reopen an earlier subject

```
teacher picks a row in the subject list
 └─ GET /api/subjects/:id      (x-teacher-id)
      └─ mongo: findOne({_id, teacherId})
    ← 200 {id, createdAt, updatedAt, subject}   |   404 subject_not_found
 └─ fe: setExam(subject) ; currentSubjectId = id
```
Refinement then resumes exactly as F3 — this is what makes an old exam a living
document rather than an archive entry.

## F5 · Store down (the new failure class)

```
any subject route, mongo unreachable
 └─ be: 503 {"error":{"message":…,"type":"store_unavailable"}}
 └─ fe: Arabic error, RETRY offered
```
Distinct from `503 claude_auth`, which is **not** retryable and needs a human to
run `claude` + `/login`. Both are 503; the `type` is what `fe` must branch on —
telling a teacher to retry a login failure, or to re-login for a dropped database,
are both wrong.

`GET /health` reports the store alongside the CLI so this is visible before a
teacher hits it:
```
{ "status":"ok", "claude":{ "ok":true, … }, "store":{ "ok":true, "db":"teacher_saas" } }
```

## Ordering / dependency note

Every new surface is **additive**, so `be` and `fe` can merge in either order:
an old `fe` never calls them, and a new `be` still serves `/api/generate`
unchanged. `build.md` → `depends_on` stays empty for both repos.
