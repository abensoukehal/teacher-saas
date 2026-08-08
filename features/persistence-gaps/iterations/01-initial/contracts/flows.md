# Flows — persistence-gaps

> Boundary crossings, in order. Derived from SEED kit §4 (the recorded E2E trace) plus the
> two contracts in this directory. This is the ordering skeleton the sub-issues' `depends_on`
> encode.

## Flow 1 — a teacher signs up (gap #1)

```
fe AuthPanel ──POST /api/auth/signup {email,password}──▶ be routes/auth.ts
                                                          │ issueTeacherId()  ← existing, unchanged
                                                          │ scrypt(password), scrypt(recoveryCode)
                                                          ▼
                                                        teachers.insertOne
                                                          │
     ◀── 201 {teacherId, recoveryCode} ─────────────────┘
fe: store teacherId in teacher.id.v1 · show recoveryCode ONCE, dir="ltr"
```

**The recovery code exists in exactly one response body, once.** It is never returned again
and only its hash is stored. `fe-1`'s oracle asserts it is absent from the DOM after remount.

## Flow 2 — a teacher signs in on a second browser (gap #1 closed)

```
fe ──POST /api/auth/signin {email,password}──▶ be
                                                │ findByEmail → timingSafeEqual
     ◀── 200 {teacherId} ──────────────────────┘        (same teacherId as sign-up)
fe ──GET /api/subjects  x-teacher-id: <that id>──▶ be ──▶ subjects.find({teacherId})
     ◀── 200 {subjects:[…]} ─────────────────────────────┘
```

**This is the gap closed, end to end.** The second `GET` is unchanged code — that is the
point of the "adopt, don't replace" design: the subject routes never learn that accounts
exist. `fe-1`'s load-bearing clause is exactly this sequence with `localStorage` cleared.

## Flow 3 — recovery (why no mail is needed)

```
fe ──POST /api/auth/recover {email,recoveryCode,password}──▶ be
                                                              │ verify recoveryHash
                                                              │ ATOMIC: set recoveryUsedAt,
                                                              │         new passwordHash,
                                                              │         new recoveryHash
     ◀── 200 {teacherId, recoveryCode: <FRESH>} ─────────────┘
```

Single-use, and it re-issues. A teacher is never left without a future recovery path.
The update must be **one atomic operation** — a partial apply would leave an account whose
password changed but whose old code still works.

## Flow 4 — refine an exercise, keeping the old one (gap #2)

```
fe RefinePanel ──PUT /api/subjects/:id/exercises/:exId {exercise}──▶ be routes/subjects.ts
                                                                     │ 1. read current
                                                                     │ 2. APPEND outgoing → exercise_revisions
                                                                     │ 3. $set positional   ← unchanged
     ◀── 200 {record} ───────────────────────────────────────────────┘
                                                                     └─▶ run-log: op:"replaceExercise"
```

Order matters: **append before `$set`**, or the superseded version is already gone. The
first replacement of an exercise therefore stores the *generated original* — the material
the exercise library (roadmap 6) is built from.

## Flow 5 — restore a previous version (no new endpoint)

```
fe ──GET  /api/subjects/:id/exercises/:exId/revisions──▶ be ──▶ exercise_revisions.find
     ◀── 200 {revisions:[…]} ──────────────────────────────────┘
fe ──PUT  /api/subjects/:id/exercises/:exId {exercise: <old one>}──▶  … Flow 4 again
```

Restore **reuses Flow 4**, which is why restoring is itself a supersession and the history
grows rather than rewinds. Both `be-3` and `fe-3` pin the "count grows to 3" clause.

## Flow 6 — cost becomes joinable (gap #3)

```
fe ──POST /api/generate──▶ be ──spawn claude──▶ …
     ◀── {data, costUsd, durationMs, correlationId:GEN} ──┘     ← ALREADY returned today
                                                                  fe currently discards it
     └─▶ run-log run line   {correlationId: GEN, costUsd}

fe ──POST /api/subjects {subject, controls, genCorrelationId: GEN}──▶ be
     ◀── 201 {…, genCorrelationId: GEN, correlationId: THIS_REQUEST} ─┘
```

**Three different correlation ids are in play** and confusing them is the whole reason this
gap existed:

| id | whose | where it lives |
|---|---|---|
| `GEN` | the `/api/generate` request | run-log run line · now also `subjects.genCorrelationId` |
| `THIS_REQUEST` | the `POST /api/subjects` request | response envelope · run-log link line |
| a third | the `PUT …/exercises` request | run-log link line |

Recorded proof (SEED kit §2): create carried `82e1faf5…`, replace carried `aa9a39f0…`.
`genCorrelationId` is the only one that makes cost answerable.

## Flow 7 — a failed save survives a reload (gap #4)

```
fe ──POST /api/subjects──▶ be   ✗ 503 store_unavailable (retryable)
fe: write teacher.pending.v1                        ← new; guarded like every other access
    ── tab closes ──
fe on mount: teacher.pending.v1 present → OFFER replay (never fire silently)
```

**Never automatic.** `create` is insert-only, so a double replay creates *two* exams — which
is why the offer is an affordance and `fe-4`'s exit protocol makes an unpreventable
double-write a stop-and-ask.

## Dependency graph (what the `depends_on` fields encode)

```
be-1 ──▶ be-2 ──┐
  └────▶ be-5   ├──▶ fe-1
be-3 ──────────────▶ fe-3
be-4 ──────────────▶ fe-2
fe-4 (independent)
```

`be-3` and `be-4` are independent of the auth track and of each other — they can run in
parallel with `be-1`/`be-2`. `fe-4` depends on nothing and can start immediately.
