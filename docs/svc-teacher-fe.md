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
proxy. It never reaches a model directly and holds the working draft locally —
there is no datastore in the product yet.

## Modules
- [[mod-fe-exam-builder]] — controls, request assembly, long-run UX, draft state
