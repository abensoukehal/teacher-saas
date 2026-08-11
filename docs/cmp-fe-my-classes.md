---
kind: component
id: cmp-fe-my-classes
title: "«أقسامي» in the account panel"
plane: implementation
part_of: mod-fe-exam-builder
realizes: [feat-classes-progress]
depends_on: [cmp-be-classes-api, cmp-be-progress-api]
repos: [teacher-fe@eadc55e]
source: [teacher-fe/src/components/MyClasses.tsx, teacher-fe/src/components/ClassEditor.tsx]
status: fresh
last_verified: 2026-08-11
tags: [frontend, rtl, arabic, classes]
---

# «أقسامي» in the account panel

> Each class with its position, and the only way an existing account creates one.

Sign-up steps 3 and 4 declare classes for a brand-new account. **Every other teacher reaches
classes here** — including every one of the many thousands who predate this — so this is not
optional decoration: without it the class layer would be unreachable for everyone who already
had an account.

Each row reads «<name> — <stream> · الأسبوع N من M», or «لم يبدأ بعد». The ceiling is that
class's own programme, not the constant 27. Below the list, the same class rows as sign-up
step 3.

## It reads positions and never sets them

The setter lives on the class's own surface in the workspace, where the teacher can see which
class they are standing in. Duplicating it inside an account panel would give one
compare-and-set two homes and two chances to get the 409 wrong.

## Other behaviour

- **A class list that cannot be read renders nothing** — not an error. A backend predating
  this slice answers 404, and a teacher opening their account on an older one must not be shown
  a failure about a feature they are not using. Same reasoning as the class bar.
- **Creating a class hands the session back to the app and closes the panel**, because a class
  the teacher cannot then select is a class that was not really created for them.
- **No school field.** The backend stores the school and returns it nowhere, and a blank input
  would silently clear a stored value. The design's account screen has one.

## Realizes
- [[feat-classes-progress]] — the class layer for an account that already exists

## Depends on
- [[cmp-be-classes-api]] — list and create
- [[cmp-be-progress-api]] — each class's position and its ceiling

## Related
- [[cmp-fe-auth-panel]] · [[cmp-fe-signup-classes]] · [[cmp-be-teacher-school]]
