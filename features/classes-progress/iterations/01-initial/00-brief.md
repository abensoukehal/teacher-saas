# Brief — classes + progress

**Source:** the design handoff at `artefacts/design_handoff_prep_companion/`
(prototype, README, fixtures, contracts) and its delta analysis in
`artefacts/design_handoff_prep_companion/ANALYSIS.md`. Read ANALYSIS.md first.

This is **slice 1 of 7**. It is the foundation slice: every other screen in the handoff
reads a class's marked position, and none of it exists today.

## The ask

A teacher teaches several 3AS classes. Each class has its own stream and its own position
in the programme — one class fell behind, and that is the normal case. Today the product
has no notion of a class at all: a teacher is one opaque id, and progress is nowhere.

Give the product classes, and give each class a position.

## What the handoff shows

- **Nav** — a class switcher, always visible, each tab carrying the class name and a thin
  per-class progress rail. Switching class is a **total** context switch; nothing carries over.
- **Sign-up step 3** — «أقسامك هذه السنة». Name + stream per class, teacher-chosen names
  (`3ر1`, `3تج2`). Adding another class is a normal, unremarkable action. Plus the school
  name, labelled «سيظهر على الموضوع المطبوع».
- **Sign-up step 4** — «أين وصل كل قسم؟». Per-class starting position. **Skippable** per class
  («تخطَّ الآن — يُضبط لاحقًا»).
- **Home, week-0 class** — no invented pacing, no bar, no comparison. Just «أين وصل هذا القسم؟»
  with «حدّد أين وصلت» and «نبدأ من الأسبوع 1».
- **Tracker** — «تمّ ✓» and «تخطٍّ ↷» on the current week; «وصلنا هنا» on every row when the
  class has no position yet. A skipped week keeps the teacher's note.
- **Account** — «أقسامي», each class with its stream and its position, and add-a-class.

Contract shapes: `ClassRef` and `Progress` in `types/contracts.ts`, fixtures in
`data/teacher.json`. Note `Progress` carries `programmeVersion` — a ministry revision must
never silently re-point a class mid-year.

## The rules this slice must not break

- **Progress belongs to a class, not a teacher** (product-description §5b rule 4). A teacher
  with two 3AS classes has two positions in the same programme.
- **The teacher's marked position is the truth.** The calendar is at best a default, and this
  slice ships no calendar at all.
- **Never grade the teacher.** Behind is not a failure. No red/green anywhere.
- **`markedWeek: 0` means not started** — and a week-0 class shows *no* pacing, not zero pacing.
- **Nothing is deleted.** Whatever the shape of "remove a class" turns out to be, it is not
  a delete.

## Out of scope for this slice

The pacing bar's expected-week marker (needs the school-year calendar, slice 2), the tracker's
week rows themselves (needs the programme route, slice 2), and generation scope (slice 3).
This slice ships the class + position spine and the surfaces that only need it.

## Known-open, do not decide here

- Whether signing in claims an anonymous session (`ANALYSIS.md` §3.1). This slice does not
  touch it; it must not make the decision harder.
