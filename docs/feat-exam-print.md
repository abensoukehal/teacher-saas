---
kind: feature
id: feat-exam-print
title: "Print the paper"
plane: product
part_of: prod-exam-builder
realized_by: [cmp-fe-exam-view]
demonstrated_by: [features/core-loop/iterations/01-initial/qa.md]
status: fresh
last_verified: 2026-08-07
tags: [print]
---

# Print the paper

## Product behavior (what the user gets)
The teacher prints the exam straight from the browser, to paper or to PDF. What
comes out is the paper the students receive: the title, the stream, the duration
and the total marks, then the exercises with their marks and typeset maths.

The controls, the buttons and the generator's notes are not printed — those are
for the teacher, not the class. Exercises are kept off page breaks. A4.

## Implementation parallel
| Node | Stack | Role |
|---|---|---|
| [[cmp-fe-exam-view]] | fe | the same view, under a print stylesheet |
