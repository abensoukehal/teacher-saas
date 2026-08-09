---
kind: flow
id: flow-generate-exam
title: "Generating a draft exam"
plane: flow
realizes: [feat-exam-generation]
steps: [cmp-fe-controls, cmp-be-exams-endpoint, cmp-be-skill-exam-plan, cmp-be-claude-runner, cmp-be-skill-exercise-one, cmp-be-inflight, cmp-fe-exam-view]
crosses: [svc-teacher-fe, svc-teacher-be]
status: fresh
last_verified: 2026-08-09
tags: []
---

# Generating a draft exam

## Sequence
1. [[cmp-fe-controls]] — the teacher's choices become a request
2. [[cmp-be-exams-endpoint]] — receives it, checks the controls before spending anything
3. [[cmp-be-skill-exam-plan]] — decides the skeleton: how many exercises, and each one's
   topic, points and difficulty. Roughly half a minute
4. The exam is **stored and answered here**, every slot waiting, points already summing to 20
5. [[cmp-be-claude-runner]] — bounds how many exercises one exam may write at once
6. [[cmp-be-skill-exercise-one]] — writes each exercise independently; each is stored the
   moment it is finished, guarded by [[cmp-be-inflight]]
7. [[cmp-fe-exam-view]] — re-reads the exam and typesets each exercise as it appears

## Notes
The teacher reads the exam while it is still being written. The first exercise has been
observed at roughly 68–91 seconds, against a complete exam at around two minutes — but that
range is a median, not a promise: identical work has been measured varying by a factor of 2.7,
so a given exercise may land anywhere in that spread.

**This is not faster.** The exam is finished when its slowest exercise is finished, so the
total is unchanged and can be slightly worse. What changed is when reading can start, and
what one bad exercise costs.

An exercise that cannot be produced is retried once, then marked as failed; the rest of the
exam stands and that one can be asked for again. Roughly one generation in twelve returns
something unusable, which under a single-run exam meant losing the whole thing.
Cancelling abandons the result; work already running server-side continues.
