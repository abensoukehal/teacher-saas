---
kind: feature
id: feat-exercise-history
title: "Going back to an earlier version of an exercise"
plane: product
part_of: prod-exam-builder
realized_by: [cmp-fe-refine, cmp-be-subjects-api, mod-be-revision-store, flow-refine-exercise]
demonstrated_by: [features/persistence-gaps/iterations/01-initial/qa.md]
status: fresh
last_verified: 2026-08-08
tags: [arabic, rtl, katex]
---

# Going back to an earlier version of an exercise

## Product behavior (what the user gets)

Refining an exercise no longer throws the old one away. Every version a teacher moves
past is kept, newest first, and any of them can be put back on the sheet with one
action. The previous versions render like the exam does — through KaTeX, with the
maths set properly and never a line of LaTeX showing.

Restoring is not an undo that rewinds. It puts the chosen version back as the current
one and files the version it displaced alongside the rest, so the history only ever
grows. There is no sequence of actions that loses a version.

This matters more than it sounds. Refining until an exercise is right *is* the product,
and it is repeated several times per paper — so before this, the single most-used action
was also the only destructive one. Each discarded version is a complete, on-syllabus
exercise that cost real money to generate; they are also the raw material for the
personal exercise library on the roadmap.

## Behaviour under a double-tap

Two refinements of the same exercise arriving at once cannot lose one. The second is
either applied after the first or told plainly that the exercise is being edited — never
silently dropped. An exam with a single exercise behaves the same as one with many.
