# be-2 — store a correction, and tell the truth about staleness

**Closed 2026-08-08.** Oracle 16/16 ×2, promoted net 109/109, freeze clean, mutation caught
by 4 clauses.

## Pre-flight
`teacher_saas` had three collections (no `solutions`); the route did not exist. Reproduced.

## The design, and the mutation that proves it

Staleness is a **per-exercise hash of the exercise statement**, recomputed on every read.

The obvious alternative — key it off the subject's `rev`, which `persistence-gaps` added —
fails the load-bearing clause: `rev` advances whenever **any** exercise is replaced, so a
single refine would mark every correction in the exam stale. The mutation (`stale` never
computed per exercise) is caught by 4 clauses, including *"refining ex2 makes ONLY ex2
stale"*.

Deriving it rather than storing a flag buys something else, pinned separately: **restoring
an exercise heals its correction.** A stored flag would still say stale.

## Two decisions worth the words

- **The whole batch is validated before anything is stored.** A partially-stored correction
  is one the teacher cannot trust and cannot inspect — they cannot see which half landed.
- **The grading scale must sum to the exercise's points, or the request is rejected.** It is
  the one property of a correction that is mechanically checkable, and a mis-scaled
  correction gets graded against thirty papers before anyone notices. Rejecting at the door
  is cheaper than any downstream warning.

## A declared supersession (WF-65)

Two promoted pins asserted `/api/skills` lists **exactly** two capabilities. `be-1`'s
declared scope is adding a capability, and the catalogue is a directory listing, so any new
skill changes that response by design — planning listed it as a perimeter consumer.

Both now assert what actually matters: the **existing** capabilities are still advertised
and still named the same. A skill name is interpolated into the CLI prompt, so renaming or
dropping one silently breaks a caller. Rewritten this way they will not need touching the
next time a skill is added.

## Done-protocol

| check | result |
|---|---|
| oracle ×2 | 16/16, 16/16 |
| promoted net vs this lane | 109/109 after the declared supersession |
| freeze | only `src/store/solutions.ts`, `src/routes/subjects.ts` |
| mutation — staleness not per-exercise | **caught**, 4 clauses |
| subject read path | no new key; the stored document carries nothing solution-shaped |
| concurrency (written from the start) | two simultaneous saves for one exercise leave exactly one row |

## review
**reopen-implement → FIXED and re-verified.** Storage, ownership, atomicity, per-exercise
staleness and concurrency all held under attack. One real hole:

**Finding 1 — a save could launder a stale correction.** `be` hashed the **live** exercise at
store time; it never saw what the solution was generated against. A generation takes ~145 s,
so refining inside that window — or from a second device, which accounts make ordinary —
stored the NEW statement's hash against an OLD answer, and it was then served as **current**.
Reproduced at the API by the reviewer. That is the exact harm the mechanism exists to prevent,
and it defeated the sub-issue's own stated intent.

Fixed: each entry carries the statement it was generated against and `be` hashes that. The
failure mode is now fail-safe — a statement matching nothing yields a permanent `stale: true`,
visible and recoverable, never a false current. The contract's `answersHash` definition already
said "as it was when the solution was generated"; the wire shape simply never delivered it, so
it was amended to. Reverting the fix fails 2 clauses.

**Finding 2 — the scale rule was sum-only.** `[8, -2]` sums to 6 and is nonsense to mark
against; empty labels and zero-point padding also passed. Parts now need a non-empty label and
points > 0. Three clauses added.

**Finding 3 — "worked answer" is not machine-enforceable** (a one-word answer passes every
check). Inside the SEED's accepted risk: checkable properties catch shape, not correctness, and
the teacher is the reviewer. Noted, no action.
