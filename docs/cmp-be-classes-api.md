---
kind: component
id: cmp-be-classes-api
title: "Class endpoints"
plane: implementation
part_of: mod-be-class-store
realizes: [feat-classes-progress]
depends_on: [mod-be-class-store, mod-be-progress-store, cmp-be-mutation-log]
repos: [teacher-be@7b13f12]
source: [teacher-be/src/routes/classes.ts]
status: fresh
last_verified: 2026-08-11
tags: [backend, api, classes]
---

# Class endpoints

> Create and list. There is no update, no delete and no archive.

## Surface

| Route | Answers |
|---|---|
| `POST /api/classes` | `201 {class: {id, name, stream, createdAt}, correlationId}` |
| `GET /api/classes` | `200 {classes: [...], correlationId}` — createdAt ascending, owner-scoped |

`requireTeacher` sits on the **prefix**, never inside a handler — a per-handler branch is
how a route eventually ships without one. An empty list is `200 {classes: []}`, never a
404: "no classes yet" is the state every teacher who predates this is in, and the UI
renders it.

## What it refuses

| Body | Answer |
|---|---|
| name absent, not a string, or blank after trimming | `400 invalid_request` «اسم القسم مطلوب» |
| name longer than 80 characters (measured **after** trimming) | `400` «اسم القسم طويل جدًا» |
| stream absent, empty, or resolving to no current programme | `400` «الشعبة غير معروفة» |
| malformed JSON | `400` «الطلب غير صالح», with a correlationId |
| an oversized body | `413 payload_too_large` |
| no or unknown `x-teacher-id` | `401 teacher_required` |

Duplicate names are accepted — two classes in the same stream with the same name are still
two classes.

## The stream is validated against the corpus, never against a union in this file

Six streams live in five programme documents, and the corpus is what generation will
actually read. A list copied into TypeScript would pass review and be wrong the first time
the corpus is reloaded. A stream that resolves to nothing must be refused **here**: storing
it would make `GET /api/progress/:classId` unanswerable later, which is a 500 nobody can act
on. The frontend's stream picker is a hand-copied mirror of the same corpus and can drift
from it — proven live with a synthetic seventh stream, where `be` accepted a class the UI
could not offer. `GET /api/streams` does not exist and is the real fix.

## Known holes

- **A name of invisible characters survives.** `trim()` strips whitespace, so a name that is
  only `U+200F` or `U+200B` is accepted and renders as a permanently blank tab. With no
  delete route it is permanent. Reproduced live, on both stacks.
- **No rate limit.** The limiter guards the secret-guessing surfaces; this route is behind
  `requireTeacher` and reveals nothing, but nothing bounds how many classes one call sequence
  can create.

## Realizes
- [[feat-classes-progress]] — the classes a teacher declares

## Depends on
- [[mod-be-class-store]] — the collection and its ownership scoping
- [[mod-be-progress-store]] — `getProgrammeForStream`, which is what makes a stream valid
- [[cmp-be-mutation-log]] — one `class.created` line per accepted write, never per attempt

## Related
- [[cmp-be-progress-api]] · [[svc-teacher-be]]
