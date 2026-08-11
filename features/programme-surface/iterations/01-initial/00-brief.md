# Brief — the programme surface

**Source:** the design handoff at `artefacts/design_handoff_prep_companion/` and its delta
analysis in `ANALYSIS.md`. **Read ANALYSIS.md §1 before anything else** — it is the reason
this slice cannot be a port.

This is **slice 2 of 7**. Slice 1 (`classes-progress`) shipped and is merged: a teacher has
classes, each class has a marked week, and `getProgrammeForStream` exists.

## The ask

The ministry's التدرج السنوي is loaded into Mongo and **nothing serves it**. `getProgramme`
exists in `src/store/programmes.ts`; no route is mounted. The product's whole pitch is
conformity to the official programme, and the programme is currently invisible.

Give it a read surface, and build the two screens that read it: the **week card** on home,
and the **tracker** («البرنامج»).

## The thing that makes this slice hard

**The handoff's `types/contracts.ts` is wrong about the programme, and this is the slice
that hits it.** It flattens the ministry's week into a single row. The corpus does not:

```
weeks[] → { week, unitId, hours, source, rows[] }
rows[]  → { competencies[], contents[], guidance[], hours, emphasis }
```

Maths stream: 27 weeks, **103 rows**. Only four weeks have one row; eight have four; two
have seven. **The tracker as drawn — one grid row per week, one content cell, one guidance
line — cannot render week 10.** Re-derive the screen against the corpus. The prototype is
the source of truth for *look and behaviour*; the corpus is the source of truth for
*shape*.

Three more corpus facts the design does not know:

- **`guidance` contains LaTeX** (`$n$`, `$+\infty$`) and runs to full paragraphs. Verbatim
  ministry text needs KaTeX too — not only exercise statements.
- **`emphasis` is `normal | added-2022 | red-unlegended`**, not the handoff's
  `normal | red | unknown`. It is required on every row, it is semantic (it marks content
  not covered in 2021-2022), and **the design renders it nowhere.** Decide deliberately.
- **Units repeat and are non-contiguous.** The maths document lists «معالجة» three times
  with distinct ids. A segmented bar must emit a segment per unit *occurrence* in week
  order, never one per unique unit name.

## What the handoff shows

- **Home week card** — prototype lines 163-188: the unit, the week's contents (each opens a
  course — that is slice 7, so they are inert here), the السير المنهجي block shown
  **verbatim with its source line**, and the two actions.
- **The tracker** — lines 214-266: the pinned segmented bar, the ministry's own columns, the
  current row's «تمّ ✓ / تخطٍّ ↷ / سلسلة الأسبوع», done rows' «تمارين دعم على هذا المحور»,
  and the footer's verbatim + ✎ rules.
- **The pacing bar** — lines 134-148: segments sized by each unit's official hours, filling
  **right→left**, fill = what the teacher marked, and a single accent marker for the
  expected week. The pacing sentence is neutral.
- **The reference calendar** — `data/school_year.json`: `expectedWeekNow: null` ⇒ **hide the
  marker entirely.** It is teacher-made and never authoritative.

## The rules this slice must not break

- **Ministry text is shown verbatim, with provenance.** Everything we author or derive is
  marked ✎. That distinction is the entire basis for the conformity claim.
- **The teacher's marked position is the truth; the calendar is a default.** The pacing
  comparison is informational and must never wear the ministry's authority.
- **Never grade the teacher.** No red/green, no score. Behind is the normal case.
- **`markedWeek: 0` shows no pacing at all** — not zero pacing. Slice 1 already pins this.
- **The bound is the class's own programme `totals.weeks`**, never the constant 27. Slice 1
  left a mutation survivor here: hardcoding 27 passes all 411 backend tests because every
  corpus document says 27. **Fix that pin in this slice's planning** — the technique is
  proven (seed a synthetic programme with a different `totals.weeks`).

## Out of scope

Generation scope and the exclusion list (slice 3), courses behind the content items
(slice 7, and gated), the visual redesign and Tailwind (slice 5).

## Known input from slice 1

`known-gaps.md` in the `classes-progress` job carries the open items. Two are this slice's
to inherit deliberately: `entry` (per-week status/note) is contractual but **no client
writes one yet** — the tracker is that client, so re-read the contract against the real
screen rather than assuming the tests defined it; and a newly created class is never
auto-selected, which the spec is silent on.
