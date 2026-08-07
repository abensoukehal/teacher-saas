---
kind: component
id: cmp-fe-controls
title: "Exam controls"
plane: implementation
part_of: mod-fe-exam-builder
realizes: [feat-exam-generation]
depends_on: []
source: [teacher-fe/src/components/Controls.tsx, teacher-fe/src/lib/taxonomy.ts]
status: fresh
last_verified: 2026-08-07
tags: [rtl]
---

# Exam controls

Topic, difficulty, exercise count, duration, and an optional free-text note with
suggestion chips that append to what the teacher typed rather than replacing it.
Assembles the generation request; the exam format is derived from the duration
rather than being a separate control. The topic list must match the vocabulary the
generator recognises, so it lives in one place.
