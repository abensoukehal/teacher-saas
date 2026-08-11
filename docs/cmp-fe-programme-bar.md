---
kind: component
id: cmp-fe-programme-bar
title: "The year at a glance"
plane: implementation
part_of: mod-fe-exam-builder
realizes: [feat-programme-surface]
depends_on: [cmp-fe-programme-lib]
repos: [teacher-fe@9cc9815]
source: [teacher-fe/src/components/ProgrammeBar.tsx]
status: fresh
last_verified: 2026-08-11
tags: [frontend, rtl, programme]
---

# The year at a glance

> One segment per unit **run**, sized by that run's own hours, filled by what the teacher
> marked. Pure and props-driven: `{programme, markedWeek}` and nothing else.

Fifteen segments on the maths document, where the design draws fourteen — `u12` is split and
a bar with one segment per unique unit is wrong by construction. Sciences draws 14, lettres
10. Every number comes from [[cmp-fe-programme-lib]]; this file does one division of its own.

## Three things it does not draw

| absence | why |
|---|---|
| **no expected-week marker** | there is no calendar in this product and the corpus carries no date, so the tick has no data source. In the prototype the "have we a reference?" test is the same expression as "has this class a position?", with `12` in the source |
| **no pacing sentence** | same reason — and **the bar renders no text node at all**, so there is nowhere for one to appear |
| **no accent, no red, no green** | a proportionally-filled coloured bar is the visual grammar of a score, and the product never grades the teacher. This file names no colour at all |

The absences are held executably, not stated: the track's children are exactly the segments,
the only absolutely-positioned nodes are fills, no node is the marker's 3 px, the rendered
subtree has zero text, and eleven phrases the prototype's pace line can produce are absent
from the DOM **and from every attribute value** at `markedWeek` 0, 1, 9 and 27.

The colour rule is measured as a colour, not as a name: the design tokens are parsed into
both themes and classified by HSV saturation, and the scan reads every declaration of every
rule in this slice's stylesheet region. A rule that is only green after dark is still green.

## Geometry

Inline style carries exactly what **is** the datum — each segment's width, each fill's width
— plus the positioning that makes those numbers mean anything. Height, borders, radius and
ink are stylesheet rules.

RTL is `direction: rtl` on the track with each fill pinned to its own segment's
`inset-inline-start`. The class bar's rail is a *single* block sized by width, which works
only because one block in an RTL parent starts at the right on its own; that does not
generalise to fifteen segments each filling from its own leading edge. Logical properties
throughout.

**Widths carry four decimals**, where the class bar's rail carries one. Not a second spelling
of the same ruling: a rail is one block whose rounding is invisible, while fifteen widths
still have to add up to one track — at one decimal they can miss it by 0.75%, a visible
sliver of unexplained bar. A width of zero is `null`, never `"0%"`, because a 0% fill is
still a fill.

## `markedWeek: 0` draws the track and no fill node

«No pacing» is not «no bar». The segments are the ministry's own year and showing its shape
is information, not a judgement; what must be absent at week 0 is the *comparison*. So there
is no fill element in any segment — not a zero-width one. **The hosts decide whether the bar
appears at all**: the tracker always draws it, the week screen draws it only from week 1.

## The tooltip

`title`, not a styled tip: it needs no CSS rule and it is the accessible name. It carries the
unit's **name** resolved through `units[]` (never the assigned `u12`, which is our
bookkeeping and means nothing to a teacher), the run's hours, and **✎** — the mark scoped to
the hours on purpose, because the name is theirs and the run boundary and its sum are ours. A
dangling `unitId` costs its name, not the bar.

Two debts sit on that one attribute: **a `title` on a `div` is announced by nothing**, so the
fifteen names are unreachable non-visually; and it is a **raw channel for a ministry string**,
where KaTeX cannot run. Zero unit names carry `$` today, so nothing leaks — but this
component's own rule is that the channel is chosen by who wrote the string, never by what
today's corpus contains. One future fix retires both.

## Realizes
- [[feat-programme-surface]] — the year, on both screens

## Depends on
- [[cmp-fe-programme-lib]] — runs, the track total, the fill

## Related
- [[cmp-fe-tracker]] · [[cmp-fe-week-card]] · [[cmp-fe-class-bar]]
