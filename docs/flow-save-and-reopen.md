---
kind: flow
id: flow-save-and-reopen
title: "Saving an exam and reopening it later"
plane: flow
realizes: [feat-subject-library]
steps: [cmp-fe-controls, cmp-be-generate-endpoint, cmp-be-subjects-api, mod-be-subject-store, cmp-fe-subject-list]
crosses: [svc-teacher-fe, svc-teacher-be]
status: fresh
last_verified: 2026-08-08
tags: []
---

# Saving an exam and reopening it later

## Sequence

1. **First load** — the frontend asks for a teacher id if it has none and keeps it.
   Any exam left over from the old browser-only scheme is uploaded once here.
2. [[cmp-fe-controls]] — the teacher sets what they want and generates
3. [[cmp-be-generate-endpoint]] — produces the exam, unchanged by this feature
4. [[cmp-be-subjects-api]] — the exam is stored as a **new** subject
5. [[mod-be-subject-store]] — inserted; earlier exams are untouched
6. [[cmp-fe-subject-list]] — it appears at the top of the list
7. **Later** — the teacher picks any earlier exam and it opens in full, refinable
   again. Reworking an exercise writes that exercise back to its stored exam.

## Notes

Generation itself is untouched by this flow — the exam is produced first and stored
afterwards, as a separate call. That is why the backend's generation surface did not
have to change, and why frontend and backend could ship in either order.

The list is ordered by when an exam was last *touched*, not created, so reworking an
old paper brings it back to the top.
