---
kind: service
id: svc-teacher-be
title: "teacher-be"
plane: implementation
repos: [teacher-be@7b13f12]
source: [teacher-be/]
status: fresh
last_verified: 2026-08-11
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
- [[mod-be-teacher-store]] — accounts, and the school
- [[mod-be-revision-store]] — every superseded exercise
- [[mod-be-solution-store]] — one current correction per exercise
- [[mod-be-class-store]] — the classes a teacher teaches
- [[mod-be-progress-store]] — where each class has reached in the programme
- [[mod-be-admin]] — the operator's read surfaces

## Two service-wide rules this slice tightened

- **Every message a teacher can reach is Arabic.** The catch-all 404 now answers
  `{"error":{"message":"الصفحة غير موجودة","type":"not_found"},"correlationId":"…"}` — it
  used to be English **and** to carry no correlation id in the body, which is what the
  frontend reads. Six more literals were translated on paths a teacher reaches
  (`subject not found`, two refine-route messages, `/api/generate`'s two 400s, and the
  internal-error fallback). No `error.type` and no status code moved: callers branch on the
  type, and the type is the stable half.
  Still English and still reachable: the five `POST /api/subjects` body-validation messages,
  the `exercise "…" is not in this subject` conflict, and everything forwarded through
  `err.message` from the Mongo driver or the Claude CLI — that last family needs mapping by
  `error.type`, not a string edit. `/api/generate`'s two 400s are also the last errors in the
  service with no `correlationId` in the body, which is where the frontend looks.
- **A bearer id is logged as an 8-character prefix under one key, `teacherIdPrefix`.** It had
  two names across the service. The generic request logger is the remaining leak: it writes
  URL path segments, and the admin routes put a whole 32-hex id in one.
