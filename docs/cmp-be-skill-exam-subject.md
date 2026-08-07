---
kind: component
id: cmp-be-skill-exam-subject
title: "Exam generation capability"
plane: implementation
part_of: mod-be-agent-workspace
realizes: [feat-exam-generation]
depends_on: []
source: [teacher-be/agent/.claude/skills/exam-subject/SKILL.md]
status: fresh
last_verified: 2026-08-07
tags: [arabic, curriculum]
---

# Exam generation capability

Produces a whole exam as structured data: stable positional exercise ids, points
summing to the stated total, Arabic throughout, maths as KaTeX-compatible LaTeX.
Reads the programme file for the requested stream and, when a topic is not
confirmed there, declines it, substitutes confirmed topics, and says so in the
exam's assumptions rather than producing off-syllabus material.
