---
kind: flow
id: flow-refine-exercise
title: "Reworking one exercise"
plane: flow
realizes: [feat-exercise-refinement]
steps: [cmp-fe-refine, cmp-be-generate-endpoint, cmp-be-claude-runner, cmp-be-skill-refine-exercise, cmp-fe-exam-view]
crosses: [svc-teacher-fe, svc-teacher-be]
status: fresh
last_verified: 2026-08-07
tags: []
---

# Reworking one exercise

## Sequence
1. [[cmp-fe-refine]] — the instruction, the exercise, and a summary of the others
2. [[cmp-be-generate-endpoint]] — receives it
3. [[cmp-be-claude-runner]] — runs it, about a minute
4. [[cmp-be-skill-refine-exercise]] — rewrites the exercise, keeps id/marks/label
5. [[cmp-fe-exam-view]] — the exercise is replaced by id and the paper re-renders

## Notes
The frontend assembles the whole request; the backend does not know what an exam
is. Nothing is stored server-side, so each refinement carries the current exercise
with it — which is also why refinements compose naturally.
