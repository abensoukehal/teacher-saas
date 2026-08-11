---
kind: component
id: cmp-fe-week-card
title: "«هذا الأسبوع» — the marked week"
plane: implementation
part_of: mod-fe-exam-builder
realizes: [feat-programme-surface]
depends_on: [cmp-fe-programme-lib, cmp-be-progress-api]
repos: [teacher-fe@9cc9815]
source: [teacher-fe/src/components/WeekCard.tsx]
status: fresh
last_verified: 2026-08-11
tags: [frontend, rtl, arabic, programme, katex]
---

# «هذا الأسبوع» — the marked week

> The class's current week as the ministry wrote it, attributed to its printed page. Pure
> and props-driven: `{programme, position, onAdvance, onGoTracker}`.

## Why this is not the handoff's card

The design draws a week as **one** contents list and **one** guidance paragraph. A week in
the corpus is `rows[]`, and real week 20 of the maths document has **seven** of them.
Rendered the design's way, three of those seven rows are silently blank and the densest field
in the corpus — competencies, 76 of 103 maths rows against contents' 63 — never appears.

So the ministry's three columns are the card's three columns, every row renders, and **an
empty column renders nothing at all**: a labelled void reads as «the ministry said nothing
here», when what happened is that the row's content lives in another column.

Guidance is joined with a newline, so `Statement` makes one paragraph per ministry sentence —
week 20's first row carries two and they stay two. Contents and competencies are *items* in
the ministry's table, so each gets its own line and its own `Statement`. Same rule from both
directions: never fuse two of their strings.

## Three registers, never mixed

1. **The ministry's** — verbatim through KaTeX. 36 of 103 maths rows carry LaTeX; guidance
   alone has 219 `$…$` spans and the worst case is 432 characters. Nothing is summarised,
   reordered or deduplicated.
2. **Ours** — marked **✎**. Exactly one figure on the card wears it: hours-to-date, the only
   thing here we compute. Its denominator is Σ `weeks[].hours`, never `totals.hours`.
3. **The teacher's own** — their marked week, their «أنهيت هذا الأسبوع ✓». No ✎: marking
   their decision as ours would be the product taking credit for it.

## Provenance and the emphasis tag

The provenance line is built from `source.authority` + `source.title` + that week's
`pdfPages` — **from the wire**. The design hardcodes it as a UI literal, and a conformity
claim whose attribution is a UI string is a claim nothing can check. The title carries
embedded newlines and goes into the DOM verbatim; whitespace collapsing is CSS's business.
Eight of twenty-seven maths weeks span two pages, so «الصفحات 18، 19» is real data.

An `added-2022` row gets **«✱»** and the legend is rendered **once**, at the foot of the
card: week 24 has four flagged rows and repeating a seventy-character ministry sentence four
times is not a tag. The caption quotes `emphasisLegend.text` verbatim — the ministry's own
words are the only legal caption for their own marking. Muted ink, never red: `--danger` is
reserved for true errors, and the product never grades.

The allow-list is `"added-2022"` only. `normal` renders nothing and any other value —
including `red-unlegended`, which occurs zero times in all five documents — renders as
normal. Keep the type, build no branch.

## What it does not do

- **No course affordance on a content item.** Contents are inert plain items. Courses are a
  later slice and the corpus has no stable id to address — position moves on a
  `transcriptionRev` bump — so a link would be a promise addressed to nothing.
- **No «سلسلة تمارين هذا الأسبوع» and no «قادم» panel.** Absent, not disabled.
- **No pacing of any kind.**
- **It builds no write body.** `onAdvance("done")` — the shared builder lives in
  [[cmp-fe-programme-lib]] and is called by the host, so one write shape has one home. The
  source contains no `advanceWrite`, no `entry`, no `Math.min` and no `markedWeek + 1`.
- **No inline style and no colour.** Nothing here is geometry, so every appearance rule is in
  `App.css`.

## States

| | |
|---|---|
| week 0 | the invitation «أين وصل هذا القسم؟» + «حدّد أين وصلت» → the tracker. No week content, no bar, no pacing |
| positioned | «هذا الأسبوع — الأسبوع N من M», both numbers from props |
| write in flight | the action disables for the beat |
| `409 conflict` | the Arabic re-ask, and it does **not** advance again without a new tap |
| retryable failure | Arabic message, action re-enabled |
| a mark with no week behind it | an honest line and no action. Unreachable while the corpus is sound; it offers no retry because nothing the teacher does fixes a gap in a transcription |

## Two readings recorded, both pinned

- **The position line reads `position.totalWeeks`, the write bound — not
  `programme.totals.weeks`.** The tracker's header does the opposite, and the two are
  consistent: the card states a *mark against the bound that mark lives under*, the tracker
  states the *document's summary*. If the two numbers ever part, a card saying «من 27» while
  «أنهيت هذا الأسبوع ✓» clamps at 30 is the product contradicting itself in one glance. One
  clause renders the real 27-week document at a 30-week bound and asserts «من 30».
- **`position.rev` is declared and never read.** A position is one value and splitting it
  invites a caller to pass a stale half — but the compare-and-set token belongs to the write.
  The tempting use, clearing the 409 notice when a fresh `rev` arrives, is wrong: the losing
  surface shows the fresh state *and* re-asks, so the re-ask must survive the re-read that
  produced it. Only a new tap clears it.

## Not ported from the design, deliberately

«نبدأ من الأسبوع 1» is a *write*, and this card's only write prop builds an entry for the
current week — which at 0 does not exist. «وصلنا هنا» in the tracker already sets a position
without annotating one. And the «قسم جديد — {name}» eyebrow is dropped: `markedWeek: 0` means
*unpositioned*, not *new*, and a class taught for a month whose teacher never recorded a week
would be greeted as brand new.

## Realizes
- [[feat-programme-surface]] — the ministry's words for this week

## Depends on
- [[cmp-fe-programme-lib]] — the track total and the types
- [[cmp-be-progress-api]] — the position, the bound, and the 409 the host relays

## Related
- [[cmp-fe-tracker]] · [[cmp-fe-programme-bar]] · [[cmp-fe-nav]] · [[cmp-fe-class-position]]
