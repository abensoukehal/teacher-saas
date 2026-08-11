---
kind: component
id: cmp-be-subjects-api
title: "Subject endpoints and teacher identity"
plane: implementation
part_of: mod-be-subject-store
realizes: [feat-subject-library, feat-exercise-history]
depends_on: [mod-be-subject-store, mod-be-class-store]
repos: [teacher-be@7b13f12]
source: [teacher-be/src/routes/subjects.ts, teacher-be/src/teacher.ts]
status: fresh
last_verified: 2026-08-11
tags: [backend, api]
---

# Subject endpoints and teacher identity

> The HTTP surface over [[mod-be-subject-store]], and the identity it is scoped by.

## Surface

| Route | Does |
|---|---|
| `POST /api/teacher` | issues an opaque id |
| `POST /api/subjects` | stores a generated exam — always a new one |
| `GET /api/subjects` | this teacher's exams, newest first, **summaries only** |
| `GET /api/subjects/:id` | one exam in full |
| `PUT /api/subjects/:id/exercises/:exerciseId` | replaces one exercise |

The list returns summaries — title, topic, exercise count, marks, dates — and never
statements, so drawing a list does not ship every exam's text. There is no delete
route.

## A subject may be tagged with a class

`POST /api/subjects` takes an optional `classId`, and both projections now carry
`classId: string | null` on every subject — present always, so the frontend never branches
on two shapes.

| Input | Answer |
|---|---|
| `classId` absent or `null` | stored as legacy, exactly like every subject that predates classes |
| a class id that is the caller's | stored, and surfaced on both projections |
| foreign, invented, malformed, uppercase, or `""` | `404 class_not_found` — the same body, byte for byte, that the progress routes give |
| a non-string (`42`, `{}`) | `400 invalid_request` «قيمة غير صالحة» — a wrong type is a caller bug, and it is named as one |

The class is resolved **before** the insert. A subject stored against a class that turns out
not to be the caller's would be a document nothing can undo — there is no delete route.

`GET /api/subjects?classId=…` narrows the list to that class **plus every legacy subject**.
Three deliberate readings of a missing or odd parameter:

- **`?classId=` (empty) is no filter at all**, not a filter for nothing. It is what a client
  sends when it serialises an unset selection, and when a filter is ambiguous the reading
  that cannot lose a subject wins.
- **A foreign or invented id is `200`, not an error** — the `{teacherId}` scope already bounds
  every result, so the answer is the caller's legacy-only list and nothing about another
  teacher's classes is readable from it.
- **A repeated parameter is `400`.** It arrives as an array, which compares equal to no stored
  class id, so it would answer "you have only legacy subjects" while looking like a successful
  filter. This is the only new way this route can fail.

**Generation does not set it.** An exam produced through `/api/exams` is stored with no
`classId`, so it appears under every class.

## Identity is not an account, but it is now checked

Every subject route requires an `x-teacher-id` header carrying a 32-character hex id, and
`requireTeacher` **rejects an id the server never recorded** — "issued" means minted *and*
written down, which covers anonymous ids from `POST /api/teacher` and a one-time backfill of
the ids that predated the registry. There is still no session and no expiry; the header is
the whole credential.

**It is a bearer value.** Whoever holds a teacher's id can read that teacher's exams — and,
now, their classes and their positions. That is an accepted trade for exam drafts (not
student records) at this stage. It must not silently become the auth model.

## Failure classification

A datastore outage returns **`503 store_unavailable`**, which is *retryable* —
unlike `503 claude_auth`, which is the same status and needs a human to
re-authenticate the CLI. Callers must branch on `error.type`, never on the status
code, or a teacher gets told to re-login because the database blinked. Identity
issuance keeps working with the store down; it needs no database.

## Depends on
- [[mod-be-subject-store]] — the collection, and `classOf`'s legacy allow-list
- [[mod-be-class-store]] — `getOwned`, which decides whether a `classId` resolves

## Related
- [[cmp-be-generate-endpoint]] · [[cmp-be-progress-api]] · [[svc-teacher-be]]
