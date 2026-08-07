---
kind: service
id: svc-teacher-be
title: "teacher-be"
plane: implementation
repos: [teacher-be@db7332c]
source: [teacher-be/]
status: fresh
last_verified: 2026-08-07
tags: [backend, express, typescript]
---

# teacher-be

> The application tier, and the only thing in the product that talks to a model.

## Role in the platform
Serves the HTTP surface the frontend calls and owns generation. There is no LLM
provider SDK and no API key: generation runs the Claude Code CLI as a subprocess
against a workspace that ships inside this repo.

## Modules
- [[mod-be-claude-wrapper]] — spawns and supervises the CLI, classifies failures
- [[mod-be-agent-workspace]] — the context and capabilities the CLI runs with
- [[mod-be-subject-store]] — where a teacher's exams are kept
