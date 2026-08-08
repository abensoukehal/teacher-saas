---
kind: component
id: cmp-fe-solution-view
title: "The correction pane and its printed sheet"
plane: implementation
part_of: mod-fe-exam-builder
realizes: [feat-solution-sheets]
depends_on: [mod-be-solution-store]
repos: [teacher-fe@a18dd96]
source: [teacher-fe/src/components/SolutionView.tsx, teacher-fe/src/lib/api.ts]
status: fresh
last_verified: 2026-08-08
tags: [frontend, arabic, rtl, katex]
---

# The correction pane and its printed sheet

Per-exercise answer and grading scale, rendered through KaTeX exactly as the exam sheet is —
a correction is the densest maths in the product and the likeliest place to leak raw LaTeX.

## Two details that are not cosmetic

- **The statement stamp.** `generateSolutions` records, per answer, the exercise statement it
  was generated against, taken from the exam that was *sent*. That is what lets the backend
  tell a current correction from one answering an older exercise.
- **Print scoping.** The two sheets are separated by a marker set on the page at print time,
  read by a rule inside `@media print`. Both halves are pinned, because either alone is a
  leak — and the leak is a class receiving the answer key. The exam's own printed output is
  compared byte-for-byte against a recorded baseline.

Generation is guarded so a double-click cannot start two runs: it takes minutes and costs
real money.
