---
kind: component
id: cmp-be-skill-refine-exercise
title: "Exercise refinement capability"
plane: implementation
part_of: mod-be-agent-workspace
realizes: [feat-exercise-refinement]
depends_on: []
source: [teacher-be/agent/.claude/skills/refine-exercise/SKILL.md]
status: fresh
last_verified: 2026-08-07
tags: [arabic]
---

# Exercise refinement capability

Regenerates a single exercise from a plain-Arabic instruction, given that exercise
and a summary of the others so a replacement does not duplicate a technique
already used. Returns the exercise with its id, points and label unchanged, which
is what lets the caller put it back without disturbing the rest of the paper.
