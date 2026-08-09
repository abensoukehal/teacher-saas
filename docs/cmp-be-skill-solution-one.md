---
kind: component
id: cmp-be-skill-solution-one
title: "One-correction skill"
plane: implementation
part_of: mod-be-agent-workspace
realizes: [feat-solution-sheets]
depends_on: []
source: [teacher-be/agent/.claude/skills/solution-one/SKILL.md]
status: fresh
last_verified: 2026-08-09
tags: [skill]
---

# One-correction skill

Produces ONE worked correction and its grading scale, for a single exercise. The same split as exercise-one, applied to corrections.

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
