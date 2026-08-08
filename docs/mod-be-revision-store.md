---
kind: module
id: mod-be-revision-store
title: "Exercise revision store"
plane: implementation
part_of: svc-teacher-be
repos: [teacher-be@f6cf955]
source: [teacher-be/src/store/revisions.ts]
status: fresh
last_verified: 2026-08-08
tags: [backend, mongodb, persistence]
---

# Exercise revision store

`exercise_revisions` — every superseded version of an exercise, append-only. Nothing here
ever updates or deletes.

## Why it is not inside the subject

Two constraints forced a separate collection, and either alone would have:

- **The subject-open path must stay one cheap read.** Embedding history would put every
  discarded variant on the hottest read and grow the document without bound — and refining
  is the product's most repeated action.
- **Exercise ids must not move.** `ex1…exN` are the join key the core loop turns on, so
  `replaceExercise` keeps its positional `$set` untouched.

`teacherId` is denormalised onto each revision so every read filters
`{subjectId, teacherId}` in one query — ownership scoped *inside* the query, the same rule
`getOwned` follows, rather than fetched and then checked.

## Ordering, and why it is the way it is

The pre-image is archived **after** the compare-and-set on the subject wins, using the value
already in hand. Archiving before the write looks safer and is not: under concurrency two
writers would archive the same pre-image and one version would vanish from both the sheet
and the history. Only the winner writes a revision, so each superseded version is stored
exactly once.
