---
kind: feature
id: feat-solution-sheets
title: "The correction a teacher keeps"
plane: product
part_of: prod-exam-builder
realized_by: [cmp-be-skill-solution-sheet, mod-be-solution-store, cmp-fe-solution-view, flow-generate-correction]
demonstrated_by: [features/solution-sheets/iterations/01-initial/qa.md]
status: fresh
last_verified: 2026-08-08
tags: [arabic, rtl, katex]
---

# The correction a teacher keeps

## Product behavior (what the user gets)

A teacher who has finished an exam can ask for its **correction**: a worked answer for every
exercise, and the **grading scale** (السلّم) saying how the marks break down inside it. It
prints as its own sheet — the exam goes to the class, the correction stays with the teacher.

The answers are worked rather than stated, because a teacher marks the method and not just
the final number, and each part of the scale names what is being marked so they can grade
straight down the page.

This was the most mechanical part of the evening the product had not touched. Writing an
exam takes judgement; the answers to it do not — they are determined by exercises that
already exist.

## Staleness — the part that makes it trustworthy

Refining an exercise leaves its correction answering a version the teacher no longer has.
That correction is **shown as out of date**, on screen and on paper. It is not deleted, and
it is never quietly served as current: a teacher hands a correction to a class, so a stale
one is worse than having none.

Only the exercise that changed goes stale — the rest stay current — and regenerating costs
just that one exercise rather than the whole paper. Restoring an exercise brings its
correction back to current on its own.

## Honest limits

**Nothing here checks that the mathematics is right.** What is checked is shape: an answer
for every exercise and no invented ones, a scale that sums exactly to the exercise's points,
Arabic throughout, and maths that renders. The teacher is the reviewer, and the product does
not pretend otherwise.

A correction is a second generation, and costs slightly **more** than the exam it corrects.
That is recorded against the exam so it stays answerable, and deliberately not metered.
