---
kind: component
id: cmp-be-skill-exercise-one
title: "One-exercise skill"
plane: implementation
part_of: mod-be-agent-workspace
realizes: [feat-exam-generation]
depends_on: []
source: [teacher-be/agent/.claude/skills/exercise-one/SKILL.md]
status: fresh
last_verified: 2026-08-09
tags: [skill]
---

# One-exercise skill

Produces ONE exercise from an assignment that already fixes its topic, points and difficulty. It reasons only about its own mathematics — the exam-level reasoning was already paid by the plan.

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
