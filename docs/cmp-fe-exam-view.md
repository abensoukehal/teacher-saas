---
kind: component
id: cmp-fe-exam-view
title: "Exam view"
plane: implementation
part_of: mod-fe-exam-builder
realizes: [feat-exam-generation, feat-exercise-refinement, feat-exam-print]
depends_on: []
source: [teacher-fe/src/components/ExamView.tsx, teacher-fe/src/lib/katex.tsx]
status: fresh
last_verified: 2026-08-07
tags: [katex, rtl, print]
---

# Exam view

Renders each exercise as its own card, keyed by id, with its maths typeset and
isolated LTR inside the Arabic RTL flow. Surfaces the generator's assumptions to
the teacher — including any topic it declined and substituted — and drops them,
along with the app chrome, in the print stylesheet, because they are guidance for
the teacher rather than part of the students' paper.
