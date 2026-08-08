---
kind: component
id: cmp-fe-refine
title: "Refinement panel"
plane: implementation
part_of: mod-fe-exam-builder
realizes: [feat-exercise-refinement, feat-exercise-history]
depends_on: [cmp-fe-exam-view]
source: [teacher-fe/src/components/RefinePanel.tsx, teacher-fe/src/lib/api.ts, teacher-fe/src/lib/exam.ts]
status: fresh
last_verified: 2026-08-08
tags: [arabic]
---

# Refinement panel

Takes the teacher's instruction in their own words, with shortcuts for the common
three (change the values, change the difficulty, swap it). Sends the exercise plus
a summary of the others, then replaces that exercise **matched by id, never by
position**; a response carrying an unexpected id is rejected rather than merged.
Scrolls itself into view — opened from an exercise further down the page it would
otherwise mount off-screen.
