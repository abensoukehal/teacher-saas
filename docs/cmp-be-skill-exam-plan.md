---
kind: component
id: cmp-be-skill-exam-plan
title: "Exam plan skill"
plane: implementation
part_of: mod-be-agent-workspace
realizes: [feat-exam-generation]
depends_on: []
source: [teacher-be/agent/.claude/skills/exam-plan/SKILL.md]
status: fresh
last_verified: 2026-08-09
tags: [skill]
---

# Exam plan skill

Produces the SKELETON only — assignments with id, label, points, difficulty and what each must avoid. It writes no exercise content, and that is the whole point: everything that must be decided ACROSS exercises is decided here, once, so each exercise can then be written independently.

## Why it is separate

A run's wall clock tracks how many tokens the model produces, and roughly nine tokens in ten
are the model working the mathematics rather than writing the exam. That reasoning is
independent per exercise, so it can run concurrently — but only if a skill exists that reasons
about one exercise alone. Asking the whole-exam skill for a single exercise costs nearly as
much as asking it for three, because it still reasons about the whole envelope.

Every correctness rule that applies to its own output still applies here: the mathematics must
be worked through before the question is written, numbers must stay clean, the content must
stay on-syllabus, and every word a teacher or student reads is Arabic with mathematics in a
form the renderer can typeset.
