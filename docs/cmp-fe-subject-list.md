---
kind: component
id: cmp-fe-subject-list
title: "Saved exams list"
plane: implementation
part_of: mod-fe-exam-builder
realizes: [feat-subject-library]
repos: [teacher-fe@132202c]
source: [teacher-fe/src/components/SubjectList.tsx, teacher-fe/src/lib/persist.ts]
status: fresh
last_verified: 2026-08-08
tags: [frontend, rtl, arabic]
---

# Saved exams list

> The sidebar list of everything the teacher has made, and the way back into any of it.

Renders the summaries from [[cmp-be-subjects-api]] newest first — title, topic,
exercise count, marks, date. Clicking one loads it in full and it becomes editable
again exactly as when it was made.

It has a real empty state ("no saved exams yet"), a loading state, and its own error
state with a retry — a list that fails to load must not look like a generation that
failed. All copy is Arabic; the styles use logical properties only, because a
physical `margin-left` mirrors the wrong way under `dir="rtl"`.

Summaries carry no statements, so no LaTeX can reach this surface at all.

## Local storage, now that the server owns the exams

`localStorage` holds three things and none of them is the exam of record: the
teacher id, which exam is currently open, and a cache used to paint the screen
before the server answers. Every access is guarded — including removal, which
throws in browsers where storage is disabled.

**The migration.** Any exam a teacher already had under the old single-key scheme is
saved to the backend once on first load, and the old key is removed **only after**
that save succeeds. A failed migration must not destroy the thing it is rescuing.

## Related
- [[cmp-be-subjects-api]] · [[mod-fe-exam-builder]] · [[feat-subject-library]]
