# be-6 — corrections fan out per exercise, and cannot be started twice

**status:** done · **tag:** hardening · **filed by:** QA (bugs A + B)

## What changed

`stacks/teacher-be`:

| file | change |
|---|---|
| `agent/.claude/skills/solution-one/SKILL.md` | NEW — the lean per-exercise correction skill, split out of `solution-sheet` |
| `src/inflight.ts` | NEW — THE in-flight registry, extracted so there is exactly one |
| `src/routes/corrections.ts` | NEW — `correctable`, `readCorrection`, the per-exercise fan-out |
| `src/routes/subjects.ts` | `POST /subjects/:id/solutions/generate` |
| `src/routes/exams.ts` | uses the extracted registry instead of its own `writing` set |
| `agent/CLAUDE.md` | the skill table gains `solution-one` |

**`/api/generate` is byte-identical, and `solution-sheet` is untouched.** QA confirmed it
consumes an assembled fan-out exam correctly, so the monolithic path keeps working
alongside the new one.

### Bug A — the criterion that was never built

SEED §5 criterion 3 said "corrections stream per exercise the same way" and was dropped
between the SEED and the contract, which never named a transport. QA measured the result:
`solutions: []` on every poll for 230 s, then all three at once.

The fix mirrors the exam fan-out exactly, because it is the same problem:
`POST /subjects/:id/solutions/generate` answers **202** with the exercises it will correct,
then runs `solution-one` per exercise and writes each correction the moment it lands.
`GET /subjects/:id/solutions` — unchanged, already ownership-scoped — shows a growing sheet.

⚠ **Not faster.** Same arithmetic as the exam fan-out: `max(exercise)`, not `mean`. What it
buys is time-to-first-correction and a failure that costs one correction instead of the
sheet. Nothing in the code, the response or the logs claims otherwise.

### Bug B — the one generation surface with no guard

Refine had its `409` from the CAS; regenerate had the in-flight set; solutions had neither,
so two tabs meant two full runs (QA drove `claude.active` 1→2 with 206 s and 233 s runs both
completing). Double quota for a result nobody sees, because the upsert makes the second one
win silently.

Rather than add a second registry, the existing one moved to **`src/inflight.ts`** and now
serves all three surfaces. Keys:

| key | claimed by |
|---|---|
| `slot:<subjectId>:<exerciseId>` | the exercise fan-out and `regenerate` |
| `solutions:<subjectId>` | one correction RUN — the batch is what a teacher starts |
| `solution:<subjectId>:<exerciseId>` | one correction inside that run |

The batch claim is held by the **detached** run, not by the request, so a second tab is
refused for as long as the first one's loops are still going.

### The hazard this job created

An exam can now legitimately carry a `pending` or `failed` exercise whose statement is `""`.
`correctable()` refuses to send one: ~145 s and a full agent loop writing a worked answer to
nothing, which would then be stored as that exercise's **current** correction — a confident
answer to a question that does not exist.

It checks **both** facts, not just `status`: a legacy exercise carries no status at all and
reads `ready` by the allow-list, so there the empty statement is the only signal.

## What the oracle asserts

`features/parallel-exercises/tests/be/solutions-fanout.characterization.test.js`

**Bug A.** 202 naming `exerciseIds` and `skipped`; **one correction readable while the
others are still generating** (`>= 1` and `< 3` — not empty, not whole, which is exactly
what QA measured absent); the rest follow in exam order; every `scale` sums exactly to that
exercise's `points` with positive, labelled parts; one row per exercise; one run each.

**Bug B.** The second tab is `409 conflict` in Arabic **without spawning anything** — the
clause counts loops, because quota was the actual cost; the claim releases, so the sheet can
be regenerated afterwards; a *different* exam is not blocked.

**The hazard.** A `failed` and a `pending` slot are skipped with **zero spawns** for either;
a legacy exercise with no status but a blank statement is skipped too; an exam with nothing
correctable is `400`, not a spawn.

**Refusals cost only themselves.** A scale that does not sum is never stored — the other two
corrections land, and ex2 has no row at all (absent is honest; a wrong scale is graded
against thirty papers). Same for a malformed result. Both are retried once, bounded.

**Staleness.** Refining one exercise marks only that correction stale; restoring the
statement heals it — which is only true because staleness is derived on read, never stored.

**Negative surface.** Another teacher and a ghost id get the identical 404; no header is
401; `solution-one` is in the catalogue and `solution-sheet` is still there.

## Decisions the sub-issue did not cover

1. **Nothing is stored for a correction that could not be produced.** The exercise fan-out
   writes a `failed` placeholder because the slot must keep its points and its place in the
   exam. `solutions` has no such need: it holds the CURRENT correction, and an empty one
   would be indistinguishable from a real answer that says nothing. Absent is the honest
   state, and the teacher can ask again.

2. **202, not 201.** Nothing is created at the moment of the response — the corrections
   arrive afterwards. `POST /api/exams` answers 201 because it *has* inserted the skeleton.

3. **The batch key is the exam, not the teacher.** One teacher correcting two different
   exams at once is ordinary use; the same exam twice is the bug. Pinned both ways.

4. **`upsertMany` with a single entry** rather than a new `upsertOne`. The store already
   owns the hashing and the unique-index upsert, and a second write path would be a second
   place for the `answersHash` rule to drift.

5. **The statement is captured at spawn time** and passed into `readCorrection`, never
   re-read from the document. Hashing the live exercise would let a refine landing inside
   the ~145 s window store the new statement's hash against an answer written for the old
   one, which then reads as current — the exact failure `answersHash` exists to prevent.

6. **`solution-one` is grouped by `subjectId`** for be-5's per-exam budget, so a correction
   batch cannot take the whole global gate either.

## Two defects in my own test harness, found by the oracle failing

Worth recording because both would have produced a *green* suite that verified nothing:

- **The fixture builder made an invalid scale.** Rescaling a recorded 6-point correction
  onto a 5-point exercise by overwriting the last part drove it negative, got clamped, and
  summed to 5.5. `readCorrection` refused it — correctly. The service was right and the
  fixture was wrong; it now rescales proportionally and lands the exact remainder.
- **`attempts()` hardcoded the `exercise-one-` prefix**, so every correction clause would
  have read 0 spawns instead of failing. The skill is now an explicit argument.

## Mutation spot-checks — 4/4 killed

| mutation | clauses red |
|---|---|
| `correctable()` returns true (blanks sent for correction) | **3** |
| the batch claim removed (bug B restored) | **2** |
| the scale-sums-to-points check removed | **1** |
| upserts batched to the end (the PRE-FIX monolithic behaviour) | **1** — "ONE correction is readable while the others are still generating" |

The last one is the important one: it re-creates exactly what QA measured and the
criterion's own clause catches it, so bug A cannot silently come back.

## Exit protocol

- oracle green ×2 — 140/140 across six suites, twice
- promoted `be` net green against the JOB checkout — 224/224, 13 suites
- `/api/generate` byte-identical; `solution-sheet` skill untouched; the store-only
  `POST /subjects/:id/solutions` validation untouched
- mutation spot-checks 4/4 killed
- journal sealed
