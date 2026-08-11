---
kind: component
id: cmp-fe-nav
title: "The nav row, and the three screens behind it"
plane: implementation
part_of: mod-fe-exam-builder
realizes: [feat-programme-surface]
depends_on: [cmp-be-programme-api, cmp-be-progress-api, cmp-fe-week-card, cmp-fe-tracker]
repos: [teacher-fe@9cc9815]
source: [teacher-fe/src/components/Nav.tsx, teacher-fe/src/App.tsx, teacher-fe/src/App.css]
status: fresh
last_verified: 2026-08-11
tags: [frontend, rtl, arabic, navigation]
---

# The nav row, and the three screens behind it

> The app finally has somewhere to go. One `view`, one nav row inside the shell, and every
> fetch the two new screens need.

## The mechanism: a view derived from the hash

Not a router — that is a new dependency in a three-dependency repo whose 313 promoted clauses
render `App` directly with no provider. And not the `#/admin` pattern: that returns **before**
the shell, so it has no class bar, and the tracker needs one.

So: `viewOf(hash)` is the whole state. The **existing** `hashchange` listener, already there
for `#/admin`, drives it. That is one state and one listener for three screens, and it is
what makes browser Back and Forward move the *screen* instead of only the URL — implemented
by deletion rather than by a second mechanism. A class-less teacher's view is forced to `home`
at the same line, so a shared `#/programme` link cannot change what they see.

`#/admin` keeps its early return, untouched.

## The row

Four items: «الرئيسية» (the builder, still the landing view) · «هذا الأسبوع» · «البرنامج» ·
«الحساب» (the overlay the sidebar button already opens — a second door to one room, not a
move; it never carries `aria-current`, because it is not somewhere the app *is*).

- **The row renders only when the teacher has classes**, on the same gate the class bar uses.
  A teacher with none gets `className="app"`, children `[sidebar, workspace]` and no
  programme request — even deep-linked to `#/programme`.
- **The two per-class items appear only with a class selected.** Neither screen has a
  meaningful unselected state, and auto-selecting would silently move a returning teacher
  into a classroom they never walked into — and break a frozen slice-1 clause.
- **«إعداد موضوع» and «مكتبتي» are absent, not greyed.** A disabled item is a promise with a
  date on it.

The shell gains a **second grid modifier**, `.app--nav`, rather than an edit to slice 1's
`.app--classes` — the nav needs a third `auto` track and an existing rule was frozen. Both
modifiers are added by one condition and the appended rule wins on source order.

## What the host owns that the components do not

The three components are pure. Everything below is here.

- **One programme read per class per session**, cached by `classId`. The «asked» flag is a
  ref, and a **failed** read clears it: asked and arrived are different facts, and a class
  whose read failed has to be askable again or a later visit shows a waiting line for a
  request nobody is making.
- **The 409 re-read is one function and every write goes through it.** `rev` is added in
  exactly one place; the shared builder makes the advance pair; «وصلنا هنا» passes a bare
  position through. On a conflict it re-reads **once** and rethrows, because the row owns the
  re-ask — swallowing the rejection would make a tap produce nothing visible. A failing
  re-read is caught and dropped: the conflict the teacher needs to see must not be replaced
  by a second failure.
- **Both screens are keyed by class id.** For the card it stops a pending write and a notice
  following the teacher into another classroom. For the tracker it is load-bearing: the scroll
  is a mount effect, so without a key the component survives a switch and never lands on the
  new class's week.
- **A class switch keeps the current view**, and slice 1's total-context clears still fire.
- **The bar is a host decision.** The tracker always draws it; the week screen draws it only
  from week 1, so an unpositioned class gets the question and not an empty year beside it.
- **Every new CSS rule this slice ships** is an append below one marker — nav, both screens'
  states, the bar, the card, and the tracker's nested sub-grid. No existing rule was touched.

## What the live page changed that jsdom could not have

- **The list marker sat on its own line.** `Statement` returns a block, so a `::before` on the
  item was pushed above it. The item is a flex row now.
- **The tracker header was sticky and should not be.** It covered a quarter of a 900-px
  workspace and hid the very band the mount scroll had just landed on. Dropped — worth
  revisiting when the *bar* can be pinned without the provenance line and hours-to-date
  coming with it.
- **The row-local 409 notice was a 128-px column of seven lines.** The status track is sized
  for a tag and two short buttons, so a `:has()` rule widens that track for the one band that
  has something to say. It is the first `:has()` in this stylesheet.

## Known rough edges

- **A programme read that fails has one error slot, not one per class.** Only the selected
  class has a screen. Wrong the day two classes render at once.
- **Neither screen renders the builder's banners.** A generation that fails while the teacher
  is reading the tracker reports nothing until they return to «الرئيسية». The alternative —
  the exam surface's alert on a programme screen — is the borrowed-error state slice 1 ruled
  against.
- **A hash deep link with classes but no selection** shows the «اختر قسمًا» chooser, and in
  that state no nav item carries `aria-current` — the view is the tracker but the item is
  hidden. Harmless, arguably honest.
- **`history.scrollRestoration` is deliberately not touched.** A hard reload does not beat
  the mount scroll, and the reason is structural rather than lucky: the scroller is
  `.workspace`, and while the programme read is in flight the tracker is a waiting line with
  no height to restore into. Taking over `scrollRestoration` is global and would cost a
  teacher their place in a long exam sheet on the builder. The day the tracker renders before
  its data, the browser's restore starts winning — two pins exist to make that visible.

## Realizes
- [[feat-programme-surface]] — the way in, and every fetch behind it

## Depends on
- [[cmp-be-programme-api]] — the programme, once per class
- [[cmp-be-progress-api]] — the position, and the 409 it re-reads after
- [[cmp-fe-week-card]] · [[cmp-fe-tracker]] — mounted in the view regions

## Related
- [[cmp-fe-class-bar]] · [[cmp-fe-programme-bar]] · [[svc-teacher-fe]]
