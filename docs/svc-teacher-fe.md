---
kind: service
id: svc-teacher-fe
title: "teacher-fe"
plane: implementation
repos: [teacher-fe@eadc55e]
source: [teacher-fe/]
status: fresh
last_verified: 2026-08-11
tags: [frontend, react, vite, rtl]
---

# teacher-fe

> The teacher-facing interface. Arabic and RTL are the only mode.

## Role in the platform
Renders the exam builder and calls `teacher-be` through a same-origin `/api`
proxy. It never reaches a model directly. Exams are stored by the backend; local
storage holds only the teacher id, which exam is open, which class is selected, a
paint cache, the controls, a displaced identity and an unsaved-exam queue.

## Which class is selected is app state, not a route

There is still no router and no `nav` element. The whole app is a handful of top-level
early returns — the auth gate, the admin console, the sign-up class steps, then the
workspace — and the selected class is state plus one storage key. Switching class is a
full context change rather than a navigation, so nothing about it is in the URL and the
browser's Back button does not walk it.

## Modules
- [[mod-fe-exam-builder]] — every teacher-facing surface: controls, the paper, refinement,
  the saved-exams list, the account panel, and the class layer
