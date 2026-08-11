# be-2 — the bound pin closes: a programme that is not 27 weeks, at last

**Stack:** be · **tag:** hardening · **depends_on:** be-1
**Lane:** slot 9 — be `http://localhost:9900`, log `/tmp/teacher-backend.s9.log`
**Deliverable:** one test file. **Zero product code.**

---

## Pre-flight — the ground truth reproduced before a line was written

| Rung | Command | Expected | Got |
|---|---|---|---|
| corpus clean, no residue | `mongosh teacher_saas --eval 'db.programmes.distinct("streams").length'` | `6` | `6` ✓ |
| corpus size | `db.programmes.countDocuments({})` | `5` | `5` ✓ |
| be-1's suite green | `tools/ci be --slug programme-surface` (from the be worktree) | `gate PASS` | `49/49`, `gate PASS` ✓ |
| the route is mounted | `curl $CHAR_BE_URL/api` | 12 entries incl. `/api/classes/:classId/programme` | ✓ |

Then the **kill itself**, reproduced live against lane s9 with a scratch script
(synthetic `totals.weeks: 30` programme inserted directly, class created on it, probed,
everything deleted in a `finally`):

```
class create:            201
GET progress totalWeeks: 30
markedWeek 27 →          200
markedWeek 28 →          200      ← a hardcoded 27 answers 400 here
markedWeek 30 →          200
markedWeek 31 →          400 invalid_request «الأسبوع خارج المجال»
entry week 30 →          200
entry week 31 →          400 invalid_request «الأسبوع خارج المجال»
programme route totals:  {weeks:30, hours:210}, weeks.length 30
streams after cleanup:   6 — the six recorded values
programmes count:        5
```

Ground truth reproduced in full. No stop-and-ask.

---

## The technique, and why it is the only one available

`WEEKS_PER_YEAR = 27` is enforced by the seed validator at `src/store/programmes.ts:445`
(`totals.weeks must be 27`), `:556` (`week must be an integer 1..27`) and `:679`
(`expected 27 week lines… a short file is a truncated reading, not a short year`). Those
guards are **correct and frozen** — the promoted `programme-corpus` suite gates them — so
the fixture cannot come through `scripts/load-programmes.mjs`. It is a **direct Mongo
insert by the suite**, and nothing on the read path objects: `getProgrammeForStream` is a
plain `findOne({streams, current:true})` with no validation, and `contentHash` is checked
only by `scripts/verify-programmes.mjs`, never by the service.

The document is shaped for its exactly two readers and nothing else — `resolve()`
(`progress.ts`) reads `docKey`/`edition`/`transcriptionRev`/`totals.weeks`;
`toProgrammeRecord` additionally reads `weeklyHours`, `totals.hours`, `source.*`,
`emphasisLegend.*`, `units[].{id,name}` and every `weeks[]` entry down to its rows.

Two traps, both paid for in advance:

1. **The stream value is one no real document carries** (`شعبة اصطناعية — اختبار`).
   `streams` is multikey and `getProgrammeForStream` matches on it, so a synthetic
   document sharing a real stream would resolve **real** classes to it while it existed.
2. **Cleanup is in `afterAll`, never at the end of a test body**, and `beforeAll`
   **self-heals** (deletes any `docKey: "synthetic-bound-pin"` residue before inserting).
   Slice 1's `classes.characterization.test.js:198-203` pins `distinct("streams")` to
   exactly the six; residue from a crashed run would turn a suite this job does not own
   red, and one crash would poison every run after it.

The restored corpus is **asserted, not assumed**: the last `describe` is a *sibling* of
the fixture block, so jest runs it after that block's `afterAll`. The leak is therefore
caught in the file that makes it.

---

## Iterations

### 1 — write the oracle

`features/programme-surface/tests/be/bound-pin.characterization.test.js`, 16 clauses.
Black-box over `CHAR_BE_URL` (never a hardcoded port), `describeIfLane` from `guard`,
cleanup by owner. Green on the first run: `65/65` (49 be-1 + 16 be-2), `gate PASS`.

A green first run on a hardening pin proves nothing on its own — a pin that cannot go red
is exactly the defect being closed. So:

### 2 — mutation proof: four mutants, each planted and reverted

The lane runs `tsx src/index.ts` **without `watch`**, so a source edit does not reach the
running service. Rather than restart the shared lane (an `fe` agent is working
concurrently — WF-63), each mutant was served by a throwaway second instance on
`PORT=9905` and the suite pointed at it with `CHAR_BE_URL`. Lane 9900 was never touched.

| # | Mutation | Clauses killed |
|---|---|---|
| M1 | `progress.ts:127` `markedWeek > totalWeeks` → `> 27` | **5** — ★ markedWeek 28, markedWeek 30, entry 29, entry 30, the per-class control |
| M2 | `progress.ts:139` `(e.week) > totalWeeks` → `> 27` | **2** — entry 29, entry 30, and *nothing else* |
| M3 | `programmes.ts:1155` `totals: {weeks: doc.totals.weeks}` → `{weeks: 27}` | **1** — the twin kill on be-1's route, and *nothing else* |
| M4 | `progress.ts:111` `totalWeeks: doc.totals.weeks` → `27` | **6** — the `GET /api/progress` ceiling clause plus all of M1's |

M2 and M3 are the interesting ones: each kills **only** its own clauses. That is what
proves the two `totalWeeks` consumers (WF-70) and the projection are pinned
*independently*, rather than one broad clause happening to catch everything.

And in every mutant run the three corpus-restored clauses **passed** — which is the
`afterAll` discipline proven under a mid-suite failure, not merely asserted.

All four reverted from `/tmp/*.orig` copies. `git status --short` in the be worktree:
empty. `git diff HEAD`: empty.

---

## Done-protocol

| Rung | Result |
|---|---|
| oracle green ×2 | ✓ `65/65`, `gate PASS`, twice |
| be-1's suite still green | ✓ `49/49` inside the same run |
| **zero product-code changes** | ✓ `git status --short` and `git diff HEAD` both empty in `stacks/teacher-be` |
| `tools/ci be --slug programme-surface` from the be worktree | ✓ `gate PASS (1 ran, 0 skipped)` |
| corpus byte-restored | ✓ 5 docs · the six streams · all five `contentHash` values unchanged · 0 synthetic residue · 0 orphan classes · 8 collections, the documented set |

**Frozen paths audit** (scoped to be — WF-63): `git status --short` in the be worktree is
empty, so `WEEKS_PER_YEAR`, the seed validator and every line of `src/` are untouched by
construction.

---

## Not settled by this sub-issue

- **The promoted mainline net is not merely red — it is UNSTABLE, and be-3 does not know
  that yet.** be-3's ground truth records `tools/ci be` from the clone root as `28 failed
  / 481 passed`. Four consecutive runs here, same commit, same machine, nothing changed
  between them:

  | run | failed | passed | suites failed |
  |---|---|---|---|
  | 1 | 34 | 475 | 4 |
  | 2 | 28 | 481 | 3 |
  | 3 | 41 | 468 | 9 |
  | 4 | — | — | the `be-11 · --new-edition` clauses that failed in run 1 did not fail at all |

  Total is 509 every time, so nothing is being skipped — the same suites pass and fail
  non-deterministically. The unstable ones are the `programme-corpus` loader/verifier
  suites (`be-11 · a new edition…`, `be-2 · the hand-edit guard`, `be-3 · --db mode`),
  which spawn `scripts/load-programmes.mjs` against the shared scratch db
  `programme_corpus` — they appear to contend with each other, not with the product.

  Not ours, checked three ways: `teacher_saas` holds exactly its eight documented
  collections, all five `contentHash` values are unchanged, and there is no synthetic
  residue or orphan class. And run 2 reproduced be-3's `28/481` exactly.

  **This matters for be-3's scope.** be-3 plans to widen three collection-set clauses to
  include `classes` and `progress`. That fix is right, and it is **not sufficient** — a
  net whose failure count moves between 28 and 41 on an unchanged tree cannot certify
  anything, and "did my change break it?" stays unanswerable after the three clauses are
  fixed. be-3 should re-measure its own baseline over several runs before deciding what
  green means.
- **The synthetic-fixture technique is now load-bearing and undocumented outside this
  file.** Any later slice wanting to vary a corpus number must repeat it; if a third suite
  needs it, it wants extracting into a shared helper rather than a third copy.
- **`totals.hours` is not pinned against a mutant.** The fixture keeps it honest
  (7 × 30 = 210) and the twin clause asserts it, but no mutation was run against it —
  `weeks` was the survivor, `hours` was not.
