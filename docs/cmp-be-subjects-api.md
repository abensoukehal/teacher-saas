---
kind: component
id: cmp-be-subjects-api
title: "Subject endpoints and teacher identity"
plane: implementation
part_of: mod-be-subject-store
realizes: [feat-subject-library]
depends_on: [mod-be-subject-store]
repos: [teacher-be@2c56bef]
source: [teacher-be/src/routes/subjects.ts, teacher-be/src/teacher.ts]
status: fresh
last_verified: 2026-08-08
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

## Identity is not an account

Every subject route requires an `x-teacher-id` header carrying a 32-character hex
id the server issued. It is **not authenticated**: there is no login, no password
and no email anywhere in the product, and no record of the id is stored — a
well-formed but unknown id is accepted and simply owns nothing. Rejecting unknown
ids would turn the header into an enumeration oracle with nothing to check against.

**It is a bearer value.** Whoever holds a teacher's id can read that teacher's
exams. That is an accepted trade for exam drafts (not student records) at this
stage, and it is a deliberate placeholder: a real accounts layer can adopt these
ids without moving any data. It must not silently become the auth model.

## Failure classification

A datastore outage returns **`503 store_unavailable`**, which is *retryable* —
unlike `503 claude_auth`, which is the same status and needs a human to
re-authenticate the CLI. Callers must branch on `error.type`, never on the status
code, or a teacher gets told to re-login because the database blinked. Identity
issuance keeps working with the store down; it needs no database.

## Related
- [[mod-be-subject-store]] · [[cmp-be-generate-endpoint]] · [[svc-teacher-be]]
