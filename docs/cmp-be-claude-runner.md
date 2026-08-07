---
kind: component
id: cmp-be-claude-runner
title: "CLI runner"
plane: implementation
part_of: mod-be-claude-wrapper
realizes: [feat-exam-generation, feat-exercise-refinement]
depends_on: []
source: [teacher-be/src/claude/runner.ts]
status: fresh
last_verified: 2026-08-07
tags: [subprocess]
---

# CLI runner

Spawns the CLI, gates concurrency (default 3, queueing beyond it), bounds a run by
timeout, parses the result, and classifies failure so callers can tell a sign-in
problem from a timeout from a bad run. Emits queued/spawn/exit with the request's
correlation id and captures CLI stderr even on success.
