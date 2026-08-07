---
kind: flow
id: flow-generate-exam
title: "Generating a draft exam"
plane: flow
realizes: [feat-exam-generation]
steps: [cmp-fe-controls, cmp-be-generate-endpoint, cmp-be-claude-runner, cmp-be-skill-exam-subject, cmp-fe-exam-view]
crosses: [svc-teacher-fe, svc-teacher-be]
status: fresh
last_verified: 2026-08-07
tags: []
---

# Generating a draft exam

## Sequence
1. [[cmp-fe-controls]] — the teacher's choices become a request
2. [[cmp-be-generate-endpoint]] — receives it, checks the capability exists
3. [[cmp-be-claude-runner]] — queues if busy, runs the CLI, bounds it
4. [[cmp-be-skill-exam-subject]] — reads the programme if needed, writes the exam
5. [[cmp-fe-exam-view]] — typesets and displays it, assumptions included

## Notes
There is no streaming: the backend answers once, after roughly two minutes, so
the wait is shown as elapsed time rather than as progress the server reports.
Cancelling abandons the result; work already running server-side continues.
