# Known gaps at the end of slice 2 — input to /qa and /document

Each item was found by an independent verifier or the cross-model review, and each is
recorded rather than fixed because it fell outside a sub-issue's Delta. Every one has a
reproduction.

## BLOCKING the mainline promotion — not slice code

**`maxWorkers: 1` is absent from `tools/tests/jest.characterization.config.js` again.**
Added by `3b20e8c`, deleted by `6964a26` (pull), restored by `8e8fd03`, **deleted again by
`c09eb64` (pull) within three hours** — including the comment recording the first deletion.
With it gone the promoted net reports a different failure count every run on an unchanged
tree (33 · 30 · 32 of 509 at HEAD). **`tools/ci be` from the clone root cannot be trusted
until this returns**, so slice 2's promotion cannot be certified against it. Filed as
**WF-95** (the instance, whose durable fix is a clause that asserts the flag is present)
and **WF-96** (the mechanism — a path-scoped pull takes upstream's copy with no notion of
newer). The job gates are unaffected: `fe 261/261`, `be 65/65`.

## Debt the cross-model REVIEW graded (7 approve · 2 approve-with-debt · 0 reopens)

- **Ministry text reaches `title` attributes raw**, bypassing `Statement`. `ProgrammeBar`
  puts the unit *name* there; both emphasis markers put `emphasisLegend.text` there. Safe
  **today only because the data happens to be safe** — 0 unit names and no legend contain
  `$` (measured) — and the guard-rails attribute sweep certifies current data only. This
  contradicts fe-3's own stated rule: **the channel is chosen by who wrote the string, never
  by what today's corpus contains.** A future transcription with inline maths in a unit name
  leaks LaTeX source to a teacher, which is a hard-constraint violation.
- **`fe` types narrow `be`'s nullables.** `emphasisLegend` and `weeks[].unitId` are
  non-null in `fe`'s types where `be` can send null. Unreachable today (all five documents
  carry both), but a legend-less document **crashes** `legend.text` rather than degrading.
- **`WeekCard` and `Tracker` duplicate helpers** — `Field` · `pageLabel` · `isFlagged` ·
  `hoursTo`, plus the conflict sentence. A `/distill` candidate; the delta partition made
  the duplication the correct local choice, and only the whole-slice read can see it.
- **`scrollIntoView({block: "center"})` lands a tall band's heading above the fold.** Week 22
  open is 1,878 px, so centred, its week number, tag and both buttons are off-screen and the
  teacher arrives mid-paragraph. `"start"` is better at every band height. fe-6 found it,
  left it — `Tracker.tsx` is fe-4's and the parameter is a deliberate choice, so this is
  suboptimal rather than broken. One word for whoever picks it up.

## Inherited from slice 1, and how slice 2 moved them

**Closed:** the vacuous `markedWeek` bound pin (be-2 — with independence-proven kills, so
hardcoding `27` now fails 5 clauses); `entry` finally has a client (the tracker — upsert-by-
week and the server-stamped `completedAt` both verified live, including a forged client
timestamp being discarded); browser Back now moves the screen rather than only the URL.

**Unchanged:** the hand-mirrored stream list (`fe/src/lib/classdraft.ts`) — **recorded a
third time now**, and it deserves the `GET /api/streams` sub-issue the ledger keeps asking
for; `rate_limited` / `payload_too_large` / `claude_bad_output` still unmapped in `fe`'s
`KIND`; bearer ids in the request log (this slice adds only classIds to paths); the
promoted-oracle stop-and-ask in `RefinePanel`.

**Sharper:** a generated exam still carries no `classId`, so every exam appears under every
class — and that now sits **adjacent to two genuinely per-class screens**, which makes the
surprise more visible than when slice 1 recorded it. Slice 3 binds it.

## Corrections to this slice's own SEED, found by measurement

- **The uncollapsed tracker is 28,194 px (~39 screens), not the SEED's ~8,060 / 9.** The SEED
  measured the *prototype's* flat layout; the shipped component carries the ministry's three
  columns. Collapsed it is 3,544 px — an 8× reduction. The argument for collapse-by-default
  is much stronger than it was written.
- **«week 6 (1 row)» is wrong** — week 6 has four rows. The one-row maths weeks are 1, 11,
  21, 27.
- **The `\square` escalation's diagnosis was wrong**, and the SEED now records the correction
  in full: the transcription was faithful and the source PDFs embed no math font, so the box
  was the page's rather than ours. Fixed at the source; 61 restored, `transcriptionRev`
  bumped, `edition` untouched.
