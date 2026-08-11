---
kind: component
id: cmp-fe-signup-classes
title: "Sign-up steps 3 and 4"
plane: implementation
part_of: mod-fe-exam-builder
realizes: [feat-classes-progress]
depends_on: [cmp-be-classes-api, cmp-be-teacher-school, cmp-fe-class-position]
repos: [teacher-fe@eadc55e]
source: [teacher-fe/src/components/SignupClasses.tsx, teacher-fe/src/components/ClassEditor.tsx, teacher-fe/src/lib/classdraft.ts]
status: fresh
last_verified: 2026-08-11
tags: [frontend, rtl, arabic, onboarding]
---

# Sign-up steps 3 and 4

> «أقسامك هذه السنة» and «أين وصل كل قسم؟» — the two screens after the recovery code.

Step 3 is the class rows (a name and a stream each, «+ أضف قسمًا — الشعب الست كلها متاحة»)
plus the school field («سيظهر على الموضوع المطبوع»). Step 4 renders one position surface per
created class, each with its own «تخطَّ الآن — يُضبط لاحقًا». Four step bars, two already
filled; the footer is «ابدأ ←».

## Why the workspace renders it, not the auth panel

Both steps need the account to already exist, so the obvious home was the confirmation screen
inside the auth panel, between «متابعة» and the app. It cannot go there: the promoted
regression net pins «متابعة» as the moment the teacher id is stored **and** the builder is on
screen, and two more screens behind it break that. So «متابعة» passes one extra argument
(this was a sign-up, not a sign-in), the app stores the id and boots exactly as before, and
**this** is what the workspace shows while the teacher finishes. The sidebar is there the
whole time — which is also the honest version: they are inside the product, not still in a
form.

## What must not be undone

1. **Skipping a class writes nothing.** The progress document is created lazily by the first
   successful write, so a class nobody positioned simply has no document. Writing week 0 to
   "record the skip" is the obvious implementation and it is wrong: it creates a document whose
   existence means nothing and makes "not started" and "started at zero" the same stored fact.
   Verified in the database — three classes declared, one skipped, no document for it.
2. **A failed create does not cost the teacher their typing.** Rows the backend refused stay
   on screen with their text and their own Arabic reason; rows that succeeded are dropped,
   because create is insert-only — re-sending one is a second class, not a retry.
3. **Classes are created one at a time, in order.** The list is read createdAt ascending and
   that is the switcher's tab order; a concurrent fan-out would let the tabs come out in a
   different order than the teacher typed them.
4. **The position setter is [[cmp-fe-class-position]]**, not a second one. There is exactly
   one implementation of a compare-and-set whose 409 must never be auto-resubmitted.

## The stream list is a mirror, and that is the known hazard

There is no `GET /api/streams`. The six values live in `classdraft.ts`, hand-copied out of the
programme corpus and each verified accepted by a live create while an invented seventh was
refused. The corpus is the authority and the client cannot see it — proven a live drift hazard
with a synthetic seventh-stream document, where the backend accepted a class the picker could
not offer. Defensible only because the backend refuses an unknown value, so drift fails loudly.

Nothing is pre-selected in the stream picker; it opens on «اختر الشعبة». «رجوع» is absent on
step 3 — the screen upstream is the recovery code, shown once and gone, and a back button that
cannot go back is worse than none.

## Rough edges

- **The wizard state is not persisted.** A reload before «التالي» loses the school field's
  contents. It leaves no orphan class and no resume ghost.
- **The wizard pushes no history entries**, so the browser Back button exits the app mid-wizard.
- Step 4's lede stops short of the prototype's pointer to a «البرنامج» screen that does not
  exist yet. Two strings are ours: «أضف» and «اختر الشعبة».
- The UI guards double-submit (a busy flag, sequential creates, succeeded rows dropped), so
  the unbounded-create exposure on `POST /api/classes` is API-only.

## Realizes
- [[feat-classes-progress]] — declaring classes and positioning them at sign-up

## Depends on
- [[cmp-be-classes-api]] — one create per row, in order
- [[cmp-be-teacher-school]] — the school, sent only when it is non-empty
- [[cmp-fe-class-position]] — reused per class on step 4

## Related
- [[cmp-fe-auth-panel]] · [[cmp-fe-my-classes]]
