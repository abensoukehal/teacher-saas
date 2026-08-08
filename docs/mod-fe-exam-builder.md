---
kind: module
id: mod-fe-exam-builder
title: "Exam builder UI"
plane: implementation
part_of: svc-teacher-fe
source: [teacher-fe/src/]
status: fresh
last_verified: 2026-08-08
tags: [rtl, katex]
---

# Exam builder UI

> The whole teacher-facing surface: controls, the rendered exam, refinement, print.

## Components
- [[cmp-fe-controls]] — what the teacher asks for
- [[cmp-fe-exam-view]] — the rendered paper
- [[cmp-fe-refine]] — changing one exercise

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
