---
kind: feature
id: feat-exercise-refinement
title: "Rework one exercise"
plane: product
part_of: prod-exam-builder
realized_by: [cmp-fe-refine, cmp-be-generate-endpoint, cmp-be-claude-runner, cmp-be-skill-refine-exercise, cmp-fe-exam-view, flow-refine-exercise]
demonstrated_by: [features/core-loop/iterations/01-initial/qa.md]
status: fresh
last_verified: 2026-08-07
tags: [arabic]
---

# Rework one exercise

## Product behavior (what the user gets)
The teacher picks one exercise and says what they want changed, in Arabic and in
their own words — "غيّر الأرقام", "صعّبه شوية", or anything else. Shortcuts cover
the three common cases: change the values, change the difficulty, swap it for a
different exercise on the same topic.

**Only that exercise changes.** The rest of the paper is untouched, and its mark
allocation is preserved so the total still adds up. A refinement takes about a
minute and can be cancelled; if it fails, the existing draft survives.

This is the interaction the product exists for — a teacher will repeat it several
times on one paper.

## Implementation parallel
| Node | Stack | Role |
|---|---|---|
| [[cmp-fe-refine]] | fe | takes the instruction, replaces the exercise by id |
| [[cmp-be-generate-endpoint]] | be | the route |
| [[cmp-be-claude-runner]] | be | runs it |
| [[cmp-be-skill-refine-exercise]] | be | rewrites the exercise, keeps its slot |
| [[cmp-fe-exam-view]] | fe | re-renders the paper |
| [[flow-refine-exercise]] | — | the hop-by-hop path |
