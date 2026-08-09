---
kind: component
id: cmp-be-corrections-endpoint
title: "Per-exercise corrections"
plane: implementation
part_of: mod-be-claude-wrapper
realizes: [feat-solution-sheets]
depends_on: [cmp-be-claude-runner, cmp-be-inflight, cmp-be-skill-solution-one, mod-be-solution-store]
source: [teacher-be/src/routes/corrections.ts]
status: fresh
last_verified: 2026-08-09
tags: [http]
---

# Per-exercise corrections

`POST /api/subjects/:id/solutions/generate` corrects each exercise separately and stores each
correction the moment it is finished, so corrections appear one by one rather than all at the
end.

It answers straight away, naming the exercises it will correct — nothing exists yet at that
moment, which is why it does not report something created.

## Nothing is stored for a correction that failed

A correction that could not be produced is **absent**, not blank. This collection holds the
*current* correction for an exercise, and an empty one is indistinguishable from a real answer
that says nothing.

The consequence is deliberate and worth knowing: presence is the only signal the reader has, so
a correction that never arrives is only distinguishable from a slow one by giving up after a
bound. That bound is a real exit path, not merely a safety valve.

## What it will not correct

An exercise with no statement — one still being written, or one that failed — is never sent
for correction. Writing a worked answer to nothing costs a full run of about two and a half
minutes and would then be stored as that exercise's current correction.

## Guarded

Two requests for the same exam do not both run; see [[cmp-be-inflight]]. The claim is held for
as long as the corrections are actually being written, not merely until the request is
answered.
