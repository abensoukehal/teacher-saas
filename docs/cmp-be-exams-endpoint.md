---
kind: component
id: cmp-be-exams-endpoint
title: "Progressive exam endpoint"
plane: implementation
part_of: mod-be-claude-wrapper
realizes: [feat-exam-generation]
depends_on: [cmp-be-claude-runner, cmp-be-inflight, cmp-be-skill-exam-plan, cmp-be-skill-exercise-one, mod-be-subject-store]
source: [teacher-be/src/routes/exams.ts]
status: fresh
last_verified: 2026-08-09
tags: [http]
---

# Progressive exam endpoint

`POST /api/exams` builds an exam in parts instead of one blocking run.

## What it does

1. Runs [[cmp-be-skill-exam-plan]] once — the skeleton only: how many exercises, and each
   one's topic, points and difficulty.
2. **Inserts the whole exam immediately**, every exercise `status: "pending"` with an empty
   statement, and answers the caller. The points already sum to 20 at this moment.
3. Fills each slot concurrently through [[cmp-be-skill-exercise-one]], writing each one into
   the stored exam as it finishes.

The caller re-reads the exam through [[cmp-be-subjects-api]] to see it grow.

## Why the skeleton is inserted first

`create` is insert-only by design, so an exam cannot be built up by repeated inserts. Because
the plan fixes every id and points value before any exercise exists, the whole document can be
written once and each slot then filled in place through the store's existing compare-and-set.
No second persistence path was added.

## What it is not

**It is not faster.** An exam is finished when its slowest exercise is, so total time is
unchanged and can be slightly worse than the single-run path. What it buys is that the first
exercise is readable long before the exam is complete, and that one unusable exercise costs
one exercise rather than all of them.

## Failure

Unusable output is retried once, then that exercise is marked `failed` and the rest of the
exam stands — a partial exam is not an error response. Failures a retry cannot fix (an expired
CLI login, a missing binary, a timeout) are not retried.
