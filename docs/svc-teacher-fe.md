---
kind: service
id: svc-teacher-fe
title: "teacher-fe"
plane: implementation
repos: [teacher-fe@9cc9815]
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

## There is a nav row now, and still no router

The app has three screens — the builder, «هذا الأسبوع» and «البرنامج» — reached from a `nav`
row inside the shell. The mechanism is one `view` **derived from `location.hash`**, driven by
the `hashchange` listener that already existed for `#/admin`. No router: it would be a new
dependency in a three-dependency repo whose whole promoted net renders `App` directly with no
provider. `#/admin` keeps its own early return, before the shell, because the console
deliberately has no class bar.

So Back and Forward now move the screen, not only the URL, and `#/week` / `#/programme`
survive a refresh. See [[cmp-fe-nav]].

## Which class is selected is app state, not a route

The selected class is state plus one storage key. Switching class is a full context change
rather than a navigation, so nothing about it is in the URL and the browser's Back button
does not walk it — and a switch **keeps the current view**.

## Modules
- [[mod-fe-exam-builder]] — every teacher-facing surface: controls, the paper, refinement,
  the saved-exams list, the account panel, and the class layer
