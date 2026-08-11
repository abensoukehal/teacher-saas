---
kind: component
id: cmp-fe-class-bar
title: "The class switcher"
plane: implementation
part_of: mod-fe-exam-builder
realizes: [feat-classes-progress]
depends_on: [cmp-be-classes-api, cmp-be-progress-api]
repos: [teacher-fe@eadc55e]
source: [teacher-fe/src/components/ClassBar.tsx, teacher-fe/src/lib/classes.ts, teacher-fe/src/lib/persist.ts]
status: fresh
last_verified: 2026-08-11
tags: [frontend, rtl, arabic, classes]
---

# The class switcher

> A row of tabs above the app's two columns, one per class, each with a thin rail showing
> where that class has reached.

## It is a grid row that only sometimes exists

The bar is added as a **modifier** on the shell (`.app--classes` overriding
`grid-template-rows`), and `App` does not mount it at all with an empty class list. So a
teacher with no classes gets `className="app"` and a DOM byte-identical to the pre-slice
app — checked against a literal `outerHTML` recording of `main` rendered through the same
runner, and again live in the browser. There is no empty bar and no reserved row.

## What a tab says

- **A class with a marked week**: «3ع2 · أسبوع 8», plus a 72px rail filled `markedWeek /
  totalWeeks`. Under RTL the fill grows leftward from the right edge on its own — the track
  is a plain block in the document's own direction with no physical side pinned.
- **A class at week 0**: its name, and nothing else. No rail node in the DOM at all. «أسبوع 0»
  would be the product asserting a position nobody set, and the question belongs on the
  class's own surface.

`railPercent` returns one decimal and **never a trailing `.0`** — 8/27 is `29.6%`, and CSSOM
stores `width: 50.0%` back as `50%`, so emitting one would make the value differ from the
value the DOM reports for the element it sized. It returns `null` for week 0: a 0% fill is
still a fill.

## Two things it deliberately does not do

- **It does not re-sort.** The backend answers createdAt ascending and that is the tab order;
  a second opinion here could disagree with it.
- **It does not colour the position.** No red, no green, no "behind" — the product never
  grades the teacher. The selected tab was originally filled with the accent (a green,
  proportionally-filled bar); it is now `--ink-soft`, and selection is carried by contrast.
  Pinned at both ends: no grading classname or inline colour in the DOM, **and** no accent,
  danger, warn or literal colour in any stylesheet block whose selector draws a position.

## Silence is the error state

A class list that could not be read renders **nothing** — no bar, no banner, no alert. Two
reasons, and the first is binding: a backend predating this slice answers 404 to every class
call, so an error surface would boot every teacher on an older backend into a banner about a
feature they cannot use. The second is that class-layer failures used to be routed to the
exam surface's alert, where a 404 from an unmocked `/api/classes` displaced a real conflict
message. The single exception is `teacher_required`, which goes to the gate.

The honest cost: **in the bar, a failed progress read and a genuine week-0 class look the
same.** The load-bearing half is that a class whose position could not be read gets no
setter, so nobody is asked to re-answer at `rev` 0.

## Storage

One key, `teacher.class.v1` — the selected class id. Written on every switch, restored on
remount, **cleared by `dropRejectedIdentity`** along with the other identity-scoped keys, and
absent entirely for a teacher who has never picked a class. Nothing is auto-selected: a
returning teacher on a wiped browser gets their classes back with no tab selected.

`@media print` hides the bar. Inspected, not exercised — it cannot be driven headlessly.

## Realizes
- [[feat-classes-progress]] — the switcher and its rails

## Depends on
- [[cmp-be-classes-api]] — the list, in its order
- [[cmp-be-progress-api]] — each class's marked week and its programme's `totalWeeks`

## Related
- [[cmp-fe-class-position]] · [[cmp-fe-subject-list]] · [[flow-class-position-and-switch]]
