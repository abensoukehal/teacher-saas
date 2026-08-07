---
kind: module
id: mod-be-agent-workspace
title: "Agent workspace"
plane: implementation
part_of: svc-teacher-be
source: [teacher-be/agent/]
status: fresh
last_verified: 2026-08-07
tags: [prompting, curriculum]
---

# Agent workspace

> The directory the CLI is pointed at. Everything in it is what the model sees.

Holds the shared context, the capabilities, and the programme reference. It is a
named subfolder rather than the repo root so the generator's context stays
separate from context meant for people working on the service.

## Components
- [[cmp-be-skill-exam-subject]] — produce a whole exam
- [[cmp-be-skill-refine-exercise]] — regenerate one exercise

## Gotchas
- **The shared context file is reloaded on every run**, so bulk reference lives in
  `curriculum/` and is opened only when a task needs it.
- **Arabic must never appear inside a maths span.** KaTeX has no glyph metrics for
  it, so such spans parse cleanly and then render as broken glyphs.
- The programme file records which topic areas are unconfirmed; generation
  declines those rather than guessing.
