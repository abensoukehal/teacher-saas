---
kind: feature
id: feat-programme-surface
title: "The official programme, on screen"
plane: product
part_of: prod-exam-builder
realized_by: [cmp-be-programme-api, cmp-fe-programme-lib, cmp-fe-programme-bar, cmp-fe-week-card, cmp-fe-tracker, cmp-fe-nav, flow-mark-a-week]
demonstrated_by: [features/programme-surface/iterations/01-initial/qa.md]
status: fresh
last_verified: 2026-08-11
tags: [arabic, rtl, programme, katex]
---

# The official programme, on screen

## Product behavior (what the user gets)

The ministry's التدرج السنوي for the selected class's stream, shown as the ministry wrote
it. Two screens, reached from a new nav row: «هذا الأسبوع» — the marked week — and
«البرنامج» — the whole year, week by week.

The week card carries the unit, every row of the ministry's table for that week, and the
السير المنهجي guidance verbatim with the printed page it came from. The tracker carries all
27 bands with a segmented bar of the year above them, and the actions where the teacher is
already looking: «تمّ ✓», «تخطٍّ ↷», «وصلنا هنا». One tap moves the band, the bar, the
hours-to-date line and the class-bar rail together.

Slice 1 gave a class a marked week. This gives that week a **meaning** — which unit it sits
in, what the ministry says about it, and where it falls in the year.

**Why this earns the conformity claim.** Until now the corpus was loaded and nothing served
it: the product asserted it stays on-programme and the teacher had to take its word.
Nothing on these screens is paraphrased or summarised. The provenance line
(«وزارة التربية الوطنية — المفتشية العامة للتربية الوطنية», the document title, the page
number) comes from the wire, not from a UI literal — an attribution written into markup is a
claim nothing can check.

## Implementation parallel

| Node | Stack | Role |
|---|---|---|
| [[cmp-be-programme-api]] | be | `GET /api/classes/:classId/programme` — the whole projected document, and its own 304 |
| [[cmp-fe-programme-lib]] | fe | the types, the run derivation, the write builder — everything numeric |
| [[cmp-fe-programme-bar]] | fe | the year as fifteen segments |
| [[cmp-fe-week-card]] | fe | «هذا الأسبوع» |
| [[cmp-fe-tracker]] | fe | «البرنامج» — the whole year, folded shut except where the teacher is |
| [[cmp-fe-nav]] | fe | the nav row, the view state, the hash, and every fetch behind both screens |
| [[flow-mark-a-week]] | — | end-to-end: open the tracker → mark a week → four surfaces follow |

The corpus itself and its wire projection are [[mod-be-programme-corpus]]. The writes reuse
[[cmp-be-progress-api]] unchanged — `be` gained one read route and nothing else.

## Three absences that are the deliverable, not gaps

- **No pacing marker and no pacing sentence.** The design draws an accent tick at
  «متوقَّع — الأسبوع 12» and a line reading «متأخرون بأسبوعين». There is no calendar
  anywhere in this product and **the corpus carries no date of any kind**, so that position
  has no data source: in the prototype the "do we have a reference?" test is literally the
  same expression as "does this class have a position?", with `12` written into the source.
  Shipping it would dress an invented reference as the ministry's.
- **No course link on a content item.** Contents render as inert plain strings. Courses are a
  later slice, and the corpus has no stable id to address — a content item's position moves
  the moment a transcription is corrected.
- **«إعداد موضوع» and «مكتبتي» are absent from the nav, not greyed.** A disabled item is a
  promise with a date on it.

## States & edges

- **A teacher with no classes** sees the app byte-for-byte as before: no nav row, no
  programme request, nothing. Verified live with a real class-less teacher deep-linked to
  `#/programme`.
- **Classes but none selected.** The two per-class items are not offered, and a deep link to
  either screen shows «اختر قسمًا من الشريط أعلاه» pointing at the bar. Never an error,
  never an auto-selection.
- **Week 0.** The week card is replaced by the question «أين وصل هذا القسم؟» and a way to
  the tracker. The tracker draws the segmented year with **no fill node in any segment** and
  offers «وصلنا هنا» on every row. The track is information — it is the ministry's own year;
  what is absent at week 0 is the *comparison*.
- **Two tabs writing one class.** The loser gets a 409 and the re-ask happens **at the row**
  that lost. Fresh state renders across every band, the bar and the rail; nothing is
  resubmitted. The tracker turns one write per session into many, so this is normal
  operation rather than an edge.
- **Datastore down.** Both screens say so in Arabic with a retry, local to the screen.
- **A backend without the route** (an older `be` behind this `fe`) degrades to «الصفحة غير
  موجودة» with a retry on both screens; the builder, the class bar and progress writes keep
  working.

## Honest limits

- **Ministry text reaches three `title` attributes raw**, bypassing KaTeX — the bar's unit
  name, and both emphasis markers' legend caption. Safe **only because today's data is
  safe**: no unit name and no legend contains `$`. The rule these components state is that
  the channel is chosen by who wrote the string, never by what this corpus happens to
  contain, so this contradicts it. A future transcription with maths in a unit name would
  show LaTeX source to a teacher.
- **A `title` on a `div` is announced by nothing.** The fifteen unit names are a hover
  affordance and are not reachable non-visually.
- **`fe`'s types are narrower than `be`'s wire.** `emphasisLegend` and `weeks[].unitId` are
  nullable on the backend and non-null in the frontend's types. All five corpus documents
  carry a legend and every week has a unit, so it is unreachable today — but a legend-less
  document would **crash** rather than degrade.
- **The tracker's mount scroll centres the band.** On a tall week (1,878 px open) that puts
  the week number, the status tag and both buttons above the fold, so the teacher lands
  mid-paragraph. Everything is present and one small scroll away.
- **No note input.** `entry.note` is rendered and never authored.
- **Nothing here tags a generated exam with a class.** Two per-class screens now sit beside
  a library that still shows every exam under every tab, which makes that gap sharper than
  when [[feat-classes-progress]] recorded it.

## Related
- [[feat-classes-progress]] — the classes and positions this is built on; the writes are its
  endpoints unchanged
- [[feat-exam-generation]] — does not yet read the programme, or know which class it is for
