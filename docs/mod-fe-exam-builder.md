---
kind: module
id: mod-fe-exam-builder
title: "Exam builder UI"
plane: implementation
part_of: svc-teacher-fe
repos: [teacher-fe@eadc55e]
source: [teacher-fe/src/]
status: fresh
last_verified: 2026-08-11
tags: [rtl, katex]
---

# Exam builder UI

> The whole teacher-facing surface: controls, the rendered exam, refinement, print.

## Components
- [[cmp-fe-controls]] — what the teacher asks for
- [[cmp-fe-exam-view]] — the rendered paper
- [[cmp-fe-refine]] — changing one exercise
- [[cmp-fe-subject-list]] — the saved exams, scoped to the selected class
- [[cmp-fe-auth-panel]] — the gate, and the account panel
- [[cmp-fe-solution-view]] — the correction
- [[cmp-fe-admin-console]] — the operator's console
- [[cmp-fe-class-bar]] — the class switcher
- [[cmp-fe-class-position]] — where the selected class has reached
- [[cmp-fe-signup-classes]] — sign-up steps 3 and 4
- [[cmp-fe-my-classes]] — «أقسامي» in the account panel

## Gotchas
- **Maths spans are isolated LTR inside RTL prose.** Without that isolation the
  bidirectional algorithm reorders rendered equations.
- **The LaTeX carrying the maths is never displayed** — including inside the
  generator's notes, which contain it too.
- **Every browser-storage access is guarded, including clearing.** The app clears
  on mount when there is no draft, so an unguarded call throws on first load where
  storage is unavailable.
- Layout uses logical CSS properties only; a physical left/right rule mirrors the
  app and still builds cleanly.
- **The backend's `error.message` is rendered to the teacher**, so it must be Arabic at
  the source. `teacherMessage()` in `lib/api.ts` is the seam: a deny-list of the two
  families whose words are not ours (`StoreError`, `ClaudeError`), failing closed on any
  error type this client does not recognise. Two surfaces still render a raw message —
  the workspace alert's `error.detail`, and the refine panel, where a promoted regression
  test pins a sentence the backend never sends. The admin console forwards English on
  purpose; it is operator-facing.
- **Three error types the backend emits have no entry in the `KIND` table** —
  `rate_limited` (429), `payload_too_large` (413) and `claude_bad_output` (502) — so all
  three fall to the default, *retryable backend failure*. For a too-large body that is
  actively wrong advice: it never succeeds on retry. There is also a dead `email_taken`
  key, for a status the backend no longer emits.
- **Every teacher now fires one extra `GET /api/classes` on boot**, including the ones
  with no classes. The DOM is unchanged for them; the request set is not.
