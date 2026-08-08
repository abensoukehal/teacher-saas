---
kind: module
id: mod-be-solution-store
title: "Correction store"
plane: implementation
part_of: svc-teacher-be
repos: [teacher-be@40c5abc]
source: [teacher-be/src/store/solutions.ts]
status: fresh
last_verified: 2026-08-08
tags: [backend, mongodb]
---

# Correction store

`solutions` — one **current** correction per exercise, upserted. A history of corrections is
deliberately out of scope; regenerating a stale one is the whole point.

Separate from the subject for the same reason history is: opening an exam must stay one cheap
read, and a correction is a different sheet.

## Staleness is derived, and the statement is supplied

`answersHash` is the hash of the statement the answer was written for — and the **caller
supplies that statement**. The service cannot infer it: generating takes ~145 s, so a refine
landing inside that window (or from a second device) would otherwise have the service hash
the *new* statement against an *old* answer, and serve it as current. That shipped once and
was caught in review.

Two further consequences of deriving rather than storing a flag:

- **restoring an exercise heals its correction** — a stored flag would still say stale;
- a statement matching nothing yields a **permanent** stale, which is the safe direction.

Per-exercise, and not the subject's `rev`: `rev` advances for the whole document, so one
refine would mark every correction in the exam stale.
