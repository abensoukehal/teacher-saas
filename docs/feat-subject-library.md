---
kind: feature
id: feat-subject-library
title: "Keep every exam"
plane: product
part_of: prod-exam-builder
realized_by: [cmp-fe-subject-list, cmp-be-subjects-api, flow-save-and-reopen]
demonstrated_by: [features/persistence/iterations/01-initial/qa.md]
status: fresh
last_verified: 2026-08-08
tags: [arabic]
---

# Keep every exam

## Product behavior (what the user gets)

Every exam a teacher generates is kept. Making a new one does not disturb the old
ones, and the list in the sidebar is the way back into any of them: open it, and it
is editable again exactly as it was — the same exercises, still refinable one by one.

Before this, the product held **one** exam at a time. Generating a second silently
destroyed the first, with no warning and no way back. Since an exam takes about two
minutes to generate and is then reworked by hand, that was the most expensive thing
the product could lose, and a teacher making their second exam of the trimester hit
it every time.

The teacher never signs in. Identity is handled invisibly, so nothing about this
asks them to make an account or remember anything.

When a save does not go through, the interface says so and offers to try again —
but only when trying again can actually help. A teacher must never be shown a
reassuring "saved" for work that was not.

## What it does not do yet

Exams are tied to the browser they were made in — there is no sign-in, so a
different device shows a different (empty) list. There is no search, no folders, and
nothing can be deleted.

## Implementation parallel
| Node | Stack | Role |
|---|---|---|
| [[cmp-fe-subject-list]] | fe | the list, its states, and the local migration |
| [[cmp-be-subjects-api]] | be | the endpoints and the invisible identity |
| [[mod-be-subject-store]] | be | where exams are kept, and the insert-only rule |
| [[flow-save-and-reopen]] | — | the sequence end to end |
