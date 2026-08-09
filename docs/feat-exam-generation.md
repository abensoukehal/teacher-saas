---
kind: feature
id: feat-exam-generation
title: "Generate a draft exam"
plane: product
part_of: prod-exam-builder
realized_by: [cmp-fe-controls, cmp-be-generate-endpoint, cmp-be-exams-endpoint, cmp-be-claude-runner, cmp-be-inflight, cmp-be-skill-exam-subject, cmp-be-skill-exam-plan, cmp-be-skill-exercise-one, cmp-fe-exam-view, flow-generate-exam]
demonstrated_by: [features/core-loop/iterations/01-initial/qa.md]
status: fresh
last_verified: 2026-08-09
tags: [arabic, mathematics]
---

# Generate a draft exam

## Product behavior (what the user gets)
The teacher picks a topic from the programme, a difficulty, how many exercises and
how long the exam should be, and may add a sentence in their own words. They get a
complete paper in Arabic — titled, with the duration and total marks, and each
exercise carrying its own mark allocation and typeset maths.

Two behaviours a teacher will notice:

- **It takes about two minutes.** The wait shows elapsed time and can be cancelled.
- **It tells them when it changed their request.** Asking for a topic that is not
  confirmed in the programme does not produce off-syllabus questions; the exam
  explains that the topic was substituted and which ones were used instead.

Marks always add up to the stated total.

## Implementation parallel
| Node | Stack | Role |
|---|---|---|
| [[cmp-fe-controls]] | fe | turns the teacher's choices into a request |
| [[cmp-be-generate-endpoint]] | be | the route that serves it |
| [[cmp-be-claude-runner]] | be | runs the generation, bounds and classifies it |
| [[cmp-be-skill-exam-subject]] | be | produces the exam and honours the programme |
| [[cmp-fe-exam-view]] | fe | renders it, assumptions included |
| [[flow-generate-exam]] | — | the hop-by-hop path |
