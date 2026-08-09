---
kind: component
id: cmp-be-inflight
title: "One writer at a time"
plane: implementation
part_of: mod-be-claude-wrapper
realizes: [feat-exam-generation, feat-solution-sheets]
depends_on: []
source: [teacher-be/src/inflight.ts]
status: fresh
last_verified: 2026-08-09
tags: []
---

# One writer at a time

A single registry of what is currently being written, shared by every generation surface:
one writer per exercise slot, per exam, and per correction batch.

A second writer is refused with `409 conflict` rather than allowed to run. The point is not
data safety — the store's compare-and-set already provides that — it is that each run is a
full agent loop of roughly two minutes, so letting two proceed spends that twice for a result
only one of them keeps.

## Why it also makes recovery possible

Because the registry lives in the process, a slot left `pending` by a restart has **no live
writer** — so asking for it again is simply allowed, and it repairs.

This is deliberately not a stored field and not a timer. "Does this slot have a live writer"
is process-local; any field that outlived a restart would claim a writer that no longer
exists, which is exactly the state it would be trying to describe.
