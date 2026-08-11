---
kind: component
id: cmp-fe-subject-list
title: "Saved exams list"
plane: implementation
part_of: mod-fe-exam-builder
realizes: [feat-subject-library]
repos: [teacher-fe@eadc55e]
source: [teacher-fe/src/components/SubjectList.tsx, teacher-fe/src/lib/persist.ts]
status: fresh
last_verified: 2026-08-11
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

## It is scoped to the selected class

With a class selected the list is re-read as that class's exams **plus every exam made
before classes existed** — legacy belongs to all of them, not to none. With no class
selected the request carries no filter at all and the list is whole. A teacher whose stored
selection has gone stale gets the unfiltered list rather than an empty sidebar.

An error the list surfaces is never the backend's own words: they pass through
`teacherMessage()` first. A datastore outage used to put «datastore unavailable» in Latin
script into this sidebar on the first screen a teacher sees.

## Local storage, now that the server owns the exams

`localStorage` holds the teacher id, which exam is currently open, which class is selected,
and a cache used to paint the screen before the server answers — none of them the exam of
record. Every access is guarded, including removal, which throws in browsers where storage is
disabled.

**The migration.** Any exam a teacher already had under the old single-key scheme is
saved to the backend once on first load, and the old key is removed **only after**
that save succeeds. A failed migration must not destroy the thing it is rescuing.

## Related
- [[cmp-be-subjects-api]] · [[mod-fe-exam-builder]] · [[feat-subject-library]]
- [[cmp-fe-class-bar]] · [[flow-class-position-and-switch]] — what re-scopes it
