---
kind: service
id: svc-teacher-fe
title: "teacher-fe"
plane: implementation
repos: [teacher-fe@2e1dc9f]
source: [teacher-fe/]
status: fresh
last_verified: 2026-08-07
tags: [frontend, react, vite, rtl]
---

# teacher-fe

> The teacher-facing interface. Arabic and RTL are the only mode.

## Role in the platform
Renders the exam builder and calls `teacher-be` through a same-origin `/api`
proxy. It never reaches a model directly. Exams are stored by the backend; local
storage now holds only the teacher id, which exam is open, and a paint cache.

## Modules
- [[mod-fe-exam-builder]] — controls, request assembly, long-run UX, exam state
- [[cmp-fe-subject-list]] — saved exams, reopening, and the local migration
