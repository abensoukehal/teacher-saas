---
kind: component
id: cmp-fe-programme-lib
title: "The programme, as fe holds it"
plane: implementation
part_of: mod-fe-exam-builder
realizes: [feat-programme-surface]
depends_on: [cmp-be-programme-api]
repos: [teacher-fe@9cc9815]
source: [teacher-fe/src/lib/programme.ts, teacher-fe/src/lib/api.ts]
status: fresh
last_verified: 2026-08-11
tags: [frontend, programme]
---

# The programme, as fe holds it

> Types mirroring the wire whitelist, plus every number the two screens draw. No JSX in
> sight, and that is the point.

## Why the arithmetic lives here

Two of the three derivations have a plausible wrong version that a component would hide, and
both wrong versions look right on most of the corpus:

- **A segment is a unit RUN, not a unit.** `deriveRuns` walks `weeks[]` in order and starts a
  new run whenever `unitId` changes. The maths document has **14 units and 15 runs** — `u12`
  holds week 20, `u11` interrupts at 21, `u12` resumes at 22–23. Grouping by unique id draws
  one `u12` segment spanning weeks 20–23, which claims a unit is a quarter taught when it has
  had one week, and swallows another unit's week doing it.
- **The denominator is Σ `weeks[].hours`.** `trackTotal`, never `totals.hours`. They agree in
  every corpus document today, which is exactly what would let the wrong one survive until
  the first document where they part.

`runFill(run, markedWeek)` sums the run's own weeks up to the mark. `markedWeek: 0` answers 0
everywhere — not started is not zero progress.

A `UnitRun` **carries its weeks**, not a first/last pair. A range would force every caller to
re-find them in `weeks[]`, and `u12` makes "the weeks between first and last" wrong.

## The write builder

`advanceWrite(markedWeek, totalWeeks, status)` — one builder, two hosts. Marking a week is
**two facts**, forced rather than chosen: `markedWeek` is required on every
`PUT /api/progress/:classId` and an entry-only write is a `400`, so annotating week W always
re-states the position. «تمّ ✓» and «تخطٍّ ↷» differ in exactly one key, `entry.status`; both
advance to `min(W + 1, totalWeeks)`.

`markedWeek < 1` **throws**. Entries are 1-based while `markedWeek` is 0-based — 0 means not
started and there is no week 0 to annotate. A caller at 0 wants «وصلنا هنا», the plain setter
write with no entry.

`ProgressEntryWrite` is narrow on purpose: it carries `week` and `status` and nothing else.
The read type also carries `completedAt`, which the server stamps and a client must never
send, and `planned`, which no action produces.

## What the types say and do not say

- **The eight wire keys, exactly.** `transcriptionRev` is absent and must stay absent —
  holding it would give `fe` one obvious thing to do with it, and that is the two-version-axes
  collapse.
- **`emphasis` is a plain `string`, not a union.** The render rule is an allow-list of
  `"added-2022"`; every other value renders as normal. A union would make the unknown case
  unrepresentable and therefore untestable, and would put a second, staler authority on a
  vocabulary the corpus owns.
- **Nothing in the module knows how many weeks a year has.** `27` appears on zero lines, and
  the suite greps the source to keep it that way.

## Known rough edges

- **`fe` narrows two of `be`'s nullables.** `emphasisLegend` and `weeks[].unitId` are non-null
  here and nullable on the wire. Unreachable against all five corpus documents — but a
  legend-less document would crash the two components that read `legend.text`, not degrade.
  Whoever meets that document first widens it here, not in the components.
- **`deriveRuns` does not sort.** It renders the order the route sends, which is week order
  today. A future projection that reordered `weeks[]` would produce a wrong bar rather than a
  loud one. Not defended against on purpose — a defensive sort hides the same fault.
- **`runFill` returns a float**, and rounding belongs to the caller.

## The fetcher

`getClassProgramme(teacherId, classId)` goes through `request()` to a relative `/api/...`,
so the header, the correlation id and the lane proxy come for free, and it **unwraps the
envelope** — there is one key worth having. `saveProgress`'s body type was widened with an
optional `entry`; the runtime already passed it through, and without one it sends the
slice-1 body byte for byte.

## Realizes
- [[feat-programme-surface]] — every number on both screens

## Depends on
- [[cmp-be-programme-api]] — the shape this mirrors

## Related
- [[cmp-fe-programme-bar]] · [[cmp-fe-week-card]] · [[cmp-fe-tracker]] · [[cmp-fe-nav]]
