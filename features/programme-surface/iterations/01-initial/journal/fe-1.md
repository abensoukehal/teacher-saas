# fe-1 — the programme becomes data fe can hold

> Implementer journal. Lane slot 9 (fe :10900 → be :9900). `be-1` done and verified
> before this started; `be-2` was running concurrently in the `be` worktree, so every
> freeze check here is scoped to fe paths (WF-63).

## Pre-flight — the ground truth reproduces

| probe | expected (sub-issue / SEED §2) | got |
|---|---|---|
| `tools/dev status` | lane 9 up | backend 9900 **UP** · frontend 10900 **UP** |
| `GET /api/classes/:classId/programme` top-level keys | the envelope | `["correlationId","programme"]` |
| `programme` key set | the §2 whitelist, exactly 8 | `docKey · edition · emphasisLegend · source · totals · units · weeklyHours · weeks` |
| `units` / `weeks` counts (maths) | 14 / 27 | **14 / 27** |
| `units[]` key set | `{id, name}` and nothing else | `["id","name"]` — no `weeks`, no `hours` |
| `weeks[]` key set | `{week, unitId, hours, pdfPages, rows}` | exactly those five |
| `rows[]` key set | the ministry's columns | `competencies · contents · emphasis · guidance · hours` |
| unit runs | 15 from 14 units, `u12` split | **15**; `u12` at 20, `u11` at 21, `u12` at 22–23 |
| Σ `weeks[].hours` | 189 | **189**, and `totals.hours` also 189 |
| `saveProgress` body type (`api.ts:923-933`) | `{rev, markedWeek}`, no `entry` | as recorded |
| `tools/ci fe --slug programme-surface` from the fe worktree | RED, no tests resolved | `FAIL: no characterization tests resolved` |
| promoted fe net (`tools/ci fe` from the clone root) | 313/313 | **313 passed (313)**, 21 files |

The route was probed with curl, not taken from be-1's summary. A fresh teacher
(`POST /api/teacher`) and a fresh class on `شعبة الرياضيات` were minted for it; the
recorded body is now the suite's fixture, byte for byte.

### One correction to the sub-issue's oracle text

The sub-issue asks for "a fixture where Σ `weeks[].hours` ≠ `totals.hours` (**the real
divergence §2 records**)". **That divergence does not exist in the corpus.** Measured
across all five documents:

| docKey | `totals.hours` | Σ `weeks[].hours` | Σ `units[].hours` |
|---|---|---|---|
| math | 189 | 189 | 189 |
| techmath | 162 | 162 | 162 |
| sciences | 135 | 135 | 135 |
| gestion | 108 | 108 | 108 |
| lettres | 54 | 54 | 54 |

§2's exclusion note ("`units[].weeks`/`hours` … disagree with the week rows") is about
the **111% overflow**, which only appears once you walk *runs* and size each by its
unit's declared hours — `u12`'s 21 hours get counted twice, 189 → 210. The three raw
sums agree.

This is not a contract contradiction, so it is not a stop-and-ask: contract §4's rule
("the denominator is Σ `weeks[].hours`, never `totals.hours`") stands either way, and
the clause is still the right pin. It just has to be **synthetic** — which is the same
argument as the ≠27 fixture, and worth naming: a mutant reading `totals.hours` passes
against every real document today.

## What was built

| path | what |
|---|---|
| `src/lib/programme.ts` (new) | `Programme` + `ProgrammeUnit`/`ProgrammeWeek`/`ProgrammeRow` mirroring the §2 whitelist · `UnitRun` · `deriveRuns` · `trackTotal` · `runFill` · `ProgressEntryWrite`/`AdvanceWrite` · `advanceWrite` |
| `src/lib/api.ts` | `getClassProgramme()` through `request()`; `saveProgress`'s body widened with an optional `entry` — **appended and widened, zero lines deleted** |

Oracle: `features/programme-surface/tests/fe/programme-lib.characterization.test.tsx`
(20 clauses) + `programme-fixtures.ts` +
`fixtures/programme-math.2026-08-11.json` (the recorded 200's `programme`, verbatim —
including its 21 `\square` strings, untouched).

Five decisions worth naming:

1. **`UnitRun` carries its weeks, not a first/last pair.** `runFill(run, markedWeek)`
   is a sum over the run's own weeks; a range would force every caller to re-find them
   in `weeks[]`, and the u12 case makes "the weeks between first and last" wrong.
2. **`emphasis` is typed `string`, not a union.** Contract §6.3's render rule is an
   allow-list of `added-2022`; every other value renders as normal. A closed union
   would make the unknown case unrepresentable and therefore untestable, and would put
   a second, staler authority on a vocabulary the corpus owns — the same reasoning
   `ClassRef.stream` already carries.
3. **A narrow `ProgressEntryWrite`, not `ProgressEntry`.** The read type carries
   `completedAt`, which the server stamps and the client must never send, and
   `planned`, which no action in this slice produces. Typing the write with the read
   type would advertise both.
4. **The envelope is unwrapped.** `getClassProgramme` returns the `Programme`, the way
   `issueTeacher` returns the id. `getProgress` keeps its envelope because both of its
   keys are wanted; here there is one.
5. **No `deriveSegments` convenience.** The sub-issue names four functions; fe-2
   composes them. Adding a fifth that returns `{name, fraction, fill}` would move a
   render decision into the lib and pre-empt fe-2's props contract.

## Loop

### Iteration 1 — write the oracle, write the module, gate green

Both landed in one pass and `tools/ci fe --slug programme-surface` came back
`20 passed (20)` on the first run. **A first-run green is not evidence**, so the pass
was not accepted until every clause had been shown to discriminate.

### Iteration 2 — the mutation pass (the actual verification)

Eight mutants applied to the shipped source, gate re-run on each, source restored:

| # | mutant | clauses killed |
|---|---|---|
| M1 | `deriveRuns` groups by unique `unitId` (the prototype's segmentation) | **7 of 20** |
| M2 | `run.hours` counts weeks instead of summing hours | **8 of 20** |
| M3 | `advanceWrite` clamps to a hardcoded `27` | **2 of 20** (the 30-week clamp *and* the source grep) |
| M4 | `advanceWrite` accepts `markedWeek: 0` | 1 |
| M5 | `runFill` uses `<` instead of `<=` | 3 |
| M6 | `getClassProgramme` uses an absolute lane URL | 1 |
| M7 | `saveProgress` always sends `entry` (`?? null`) | 1 |
| M8 | `getClassProgramme` returns the envelope instead of the document | 1 |

M1 and M2 are the two the sub-issue names, and they are killed **positively**: the
suite writes each mutant out as a local function, asserts its own output on the record
(14 segments; a `u12` span of 20→23 that swallows u11's week 21; a 210-hour sum against
a 189-hour track, 111.1%), and then asserts the module differs from it. A clause that
only states the right answer leaves the reader trusting that the wrong answer is not
also the right one.

M3 is the twin of be-2's kill. Note it dies **twice** — once because
`advanceWrite(29, 30, "done")` must reach 30, and once because the module's own source
is read and grepped for the literal (`27` appears on zero lines of
`src/lib/programme.ts`; the check runs off `CHAR_ROOTDIR`).

### Iteration 3 — done-protocol

`npx tsc -b` clean, `npm run lint` (oxlint) clean, oracle green twice
(`20 passed (20)` both runs), freeze paths clean, promoted net re-run.

## Done-protocol

| rung | outcome |
|---|---|
| oracle green ×2 | **PASS** — `20 passed (20)`, twice |
| freeze audit (fe-1 scope) | **clean** — `git status --short -- src/lib/classes.ts src/lib/katex.tsx src/lib/taxonomy.ts src/components` is empty; the only fe diff is `M src/lib/api.ts` + `?? src/lib/programme.ts` |
| `tools/ci fe --slug programme-surface` from the fe worktree | **gate PASS** |
| promoted fe net `project/tests/fe` | **313/313** — see the flake note below |
| `tsc -b` / oxlint | clean |

**The promoted-net flake, recorded so it is not re-diagnosed.** Two mid-job runs of
`tools/ci fe` (clone root) came back with 1 and then 12 failures — every single one
`Test timed out in 5000ms`, in a different set of tests each time, in
`persistence-gaps` and `solution-sheets`. Host contention, not this change: the `be`
agent was running its jest suites and `load-programmes.mjs` concurrently and load
average was **59.9 on 8 cores**. The promoted net resolves the **main** checkout
(`project/stacks/teacher-fe`), which this job never touches — a fe-1 defect cannot
reach it. Re-run on a quiet host: 313/313, the same as the pre-flight baseline.

## What this sub-issue did not settle

- **The `\square` strings are in the fixture, untouched.** 21 of them in the maths
  document. Nothing here remaps, sanitises or special-cases them, and nothing
  downstream may either (contract §6.5). The escalation stays parked.
- **`deriveRuns` walks `weeks[]` in the order the route sends it** and does not sort.
  The route sends week order today (verified). If a future projection ever reorders,
  the runs would be wrong rather than loud. Not defended against on purpose — a
  defensive sort would hide the same fault instead of surfacing it — but it is an
  assumption, not a proof.
- **`runFill` returns a float, and rounding is fe-2's decision.** `railPercent` in
  `classes.ts` already has a ruling on this (one decimal, never a trailing `.0`,
  because CSSOM stores `50.0%` back as `50%`). fe-2 should inherit it rather than
  invent a second spelling.
- **Nothing calls `getClassProgramme` yet.** It is exercised against a mocked fetch
  here and against the live route only by curl; fe-5 is the first real caller, and
  the session cache (`programmes: Record<classId, Programme>`) lives there.
- **`ProgressEntryWrite` has no `note`.** Notes are display-only this slice
  (contract §0). Whoever adds authoring adds the key here, and `saveProgress`'s body
  type follows for free.
