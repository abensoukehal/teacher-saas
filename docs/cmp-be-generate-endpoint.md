---
kind: component
id: cmp-be-generate-endpoint
title: "Generation endpoint"
plane: implementation
part_of: mod-be-claude-wrapper
realizes: [feat-exam-generation, feat-exercise-refinement]
depends_on: [cmp-be-claude-runner]
source: [teacher-be/src/app.ts]
status: fresh
last_verified: 2026-08-07
tags: [http]
---

# Generation endpoint

`POST /api/generate` — one route for both capabilities, selected by `skill`. Takes
the caller's input as an object or a string, validates the requested capability
against what the workspace actually publishes, and returns the parsed result
alongside the raw text. Also records one line per run (duration, cost, counts —
never prompts or generated content).
