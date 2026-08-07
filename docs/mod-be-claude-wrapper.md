---
kind: module
id: mod-be-claude-wrapper
title: "Claude Code CLI wrapper"
plane: implementation
part_of: svc-teacher-be
source: [teacher-be/src/claude/]
status: fresh
last_verified: 2026-08-07
tags: [subprocess, observability]
---

# Claude Code CLI wrapper

> Runs the CLI headlessly and turns its output into an HTTP answer.

Spawns `claude -p --output-format json` with the agent workspace as its working
directory, caps concurrent runs and queues beyond the cap, bounds each run with a
timeout, and emits the run lifecycle so a two-minute request is observable while
it is in flight.

## Components
- [[cmp-be-claude-runner]] — spawn, queue, timeout, failure classification
- [[cmp-be-generate-endpoint]] — the single generation route

## Gotchas
- **Parse stdout before checking the exit code.** The CLI emits its result JSON
  even when it fails, with the real reason inside it. Checking the exit code first
  discards the only useful diagnostic and yields a bare "exited 1".
- **Authentication failure is not retryable.** It needs a human to sign in again,
  so it is classified apart from timeouts and transient failures.
- The whole parent environment is currently passed to the subprocess.
