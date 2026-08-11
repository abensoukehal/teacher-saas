---
kind: component
id: cmp-fe-tracker
title: "«البرنامج» — the whole year"
plane: implementation
part_of: mod-fe-exam-builder
realizes: [feat-programme-surface]
depends_on: [cmp-fe-programme-lib, cmp-fe-programme-bar, cmp-be-progress-api]
repos: [teacher-fe@9cc9815]
source: [teacher-fe/src/components/Tracker.tsx]
status: fresh
last_verified: 2026-08-11
tags: [frontend, rtl, arabic, programme, katex]
---

# «البرنامج» — the whole year

> One band per week, folded shut except where the teacher is, with the marks made where
> their eyes already are. Pure and props-driven: `{programme, progress, totalWeeks, onWrite}`.

## Why this is not the handoff's tracker

The design draws a five-column grid with **one row per week**: week · unit ·
content+guidance · hours · status. The corpus gives maths **103 rows across 27 weeks, seven
in week 20 alone** — and three of those five columns are week-scoped while two are
row-scoped.

So the row-scoped pair repeats *inside* a band, as a **nested sub-grid**: the middle cell
spans the content and hours tracks and re-declares them, so a week's per-row hours stack in
one column with the week's own total at the foot of it. Week 20 is seven rows of one hour
under a seven-hour total — «the rows sum to the week» is something the teacher can see rather
than something we assert.

`grid-row: span N` was ruled out and the reason is structural: it forces all twenty-seven
weeks into one grid, which dissolves the per-week band. The band is what carries the current
week, the collapse and the row-local 409.

## Collapse is not polish

**Uncollapsed the shipped tracker is 28,194 px — about 39 screens.** The plan said ~8,060 and
nine, which measured the design's *flat* layout; the shipped component carries the ministry's
three columns. Band ratio is 12.6× (week 15 open at 2,035 px against week 27 at 161 px).
Collapsed it is **3,544 px**, an 8× reduction.

- **Collapsed means ABSENT, not hidden.** A folded band's rows are not in the DOM at all.
  `display: none` still costs the layout of 103 rows of KaTeX, which is the whole page height
  the collapse exists to avoid.
- **The current week mounts open**, any band the teacher opens stays open, and the teacher can
  fold the current one away. Disclosure state stores what the teacher *said*, as a per-week
  override on the derived default — a plain set of open weeks would have to be rewritten every
  time the position moves, and whoever forgot would leave the new current week folded shut
  behind the teacher's own «تمّ ✓».
- **The marked week is scrolled to on mount, once.** Re-running it on every position change
  would scroll the page under the finger that pressed «تمّ ✓», and a 409 — which moves nothing
  — would still move the screen.

## The three writes

With position `W` and bound `T`:

| control | sends |
|---|---|
| «تمّ ✓» | `{rev, markedWeek: min(W+1, T), entry: {week: W, status: "done"}}` |
| «تخطٍّ ↷» | the same, `status: "skipped"` |
| «وصلنا هنا» (any non-current row; every row at W = 0) | `{rev, markedWeek: N}` — no entry, the slice-1 setter write reused |

Done and skipped differ in exactly one key. At `W === T` the position stays and the entry
still records; entries upsert by week, so a re-press replaces rather than duplicates. The
body is always built by [[cmp-fe-programme-lib]]'s shared builder, never inline.

**The 409 re-ask is row-local by construction**, not by discipline: there is one notice and it
is keyed by week, so it renders inside the band whose write lost. It **survives the fresh
props it asked for** — the losing surface shows the fresh state *and* re-asks, so a re-ask
cleared by the re-read would clear itself every time. Only a new tap clears it. While a write
is in flight only that row's controls disable.

## Status vocabulary

`< markedWeek` with no entry reads «منجز» · an entry `done` reads «منجز» · `skipped` reads
«مُتخطّى» · `=== markedWeek` reads «الأسبوع الحالي» · `> markedWeek` reads «قادم». Ink, never
hue.

**The current week outranks its own entry.** At `W === T`, pressing «تمّ ✓» leaves the band
reading «الأسبوع الحالي» with the entry recorded and invisible — the alternative reads «منجز»
beside a live «تمّ ✓», which is worse. The actions live on the current band, so the current
band has to say so.

## Two text channels, and the note is the reason

Ministry cells go through KaTeX. **The teacher's note renders as plain text and must never
go through it**: `Statement` pairs two `$` and silently corrupts — «من 5 $ إلى 9 $ دينار»
comes out with both `$` gone and the amounts fused. Zero corpus strings have an odd `$`
count, so ministry text is safe; a note is teacher-authored. One channel per author, pinned
negatively.

A note renders on a **folded** band too. The disclosure exists to compress the ministry's
hundred rows; hiding the one line the teacher wrote compresses the wrong thing.

## The footer says three registers

The design carries two rules — theirs, and ours-marked-✎. Two rules cannot state three, and
the teacher's own position, status and note are neither. The third line is the only string on
this screen that is neither the design's nor the ministry's:
«ما سجّلتموه أنتم — الموقع والملاحظات — بلا علامة: هو قراركم، لا قولنا ولا قول الوزارة».

Exactly one ✎ on the screen, in the header on hours-to-date. None on a tag, an action, a note
or a ministry row.

## What it does not draw

No pacing marker and no pacing sentence. No «سلسلة الأسبوع», no «تمارين دعم على هذا المحور».
No note input. No red and no green on any band, tag or marker — this file names no colour at
all. The header's week count is `totals.weeks`, the ministry's summary; the write clamps
against `totalWeeks`, the class's bound. One clause renders the real 27-week document at a
30-week bound and asserts the header says «27 أسبوعًا» while the same render's «تمّ ✓» sends
28.

## Known rough edges

- **`scrollIntoView({block: "center"})` lands a tall band's heading above the fold.** Week 22
  open is 1,878 px, so centred, its week number, status tag and both buttons are off-screen
  and the teacher arrives mid-paragraph. `"start"` is better at every band height. Suboptimal
  rather than broken — everything is one small scroll away.
- **After a backward re-position, entries ahead of the new mark keep their tags.** Marked at
  5, weeks 7 and 27 still read «منجز». Truthful — nothing is deleted — but the first teacher
  to re-position back will see "done" weeks in their future. A copy question.
- **Expansion state is keyed by week number**, and the host remounts on a class switch, so it
  does not leak between classes.
- **The band head is not clickable — only the week-number button is.** `Statement` returns a
  block element, which cannot live inside a `<button>`, so clicking the unit name does
  nothing.
- **There is no class name on this screen.** The header is «التدرج السنوي» alone; the class
  bar directly above marks the selected class.
- **`completedAt` rides in `entries` and is never rendered.**
- **One breakpoint, not a responsive design.** Below 820 px the band becomes one column,
  because at 414 px the fixed tracks squeezed the ministry's content track to **zero** and the
  hours labels overlapped. Nothing overflowed and nothing scrolled sideways — the ministry's
  words simply stopped being on screen, on the surface whose whole job is showing them. The
  sub-grid's meaning survives the switch: with one band track there is nothing left to
  inherit, so the rows take two tracks of their own and every row's hours still line up under
  the week total.

## Realizes
- [[feat-programme-surface]] — the year, and the writes

## Depends on
- [[cmp-fe-programme-lib]] — runs, the track total, the write builder
- [[cmp-fe-programme-bar]] — composed above the bands
- [[cmp-be-progress-api]] — the position, the entries, and the 409

## Related
- [[cmp-fe-week-card]] · [[cmp-fe-nav]] · [[flow-mark-a-week]] · [[mod-be-progress-store]]
