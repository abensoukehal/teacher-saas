# Stack spec — teacher-be (Express · TypeScript · ESM · Node 20+)

> The per-job skeleton for the **be** repo (`repos.sh` key `be`).
> Filled at PLANNING for `programme-surface` (slice 2 of 7) from the locked SEED.
> Implemented by the `be` stack agent against this feature's `contracts/`.
>
> **be is small in this slice, and that is the plan, not an accident.** One read route
> over a store that already exists, one field-explicit projection, and the closing of a
> vacuous test pin slice 1 left behind. No collection is added, no write path changes,
> nothing here reaches `src/claude/`. If a sub-issue grows a second route or a write,
> it is scoped wrong.

## Scope recap (from SEED.md + this stack's sub-issues)
- Modules: `GET /api/classes/:classId/programme` (new route) · `toProgrammeRecord`
  projection appended in `src/store/programmes.ts` · mount + `/api` index entry ·
  **closing the `markedWeek` bound pin** (test-only — the slice-1 mutation survivor).
- Contracts this stack must honor: `contracts/fe-be-programme.contract.md` (§§0–5, 7,
  8), `contracts/flows.md`. Slice 1's `fe-be-classes-progress.contract.md` stays in
  force untouched.

## Current behavior baseline
> Captured 2026-08-11 against lane slot 9 (be :9900) — SEED §2 is the recording of
> record; re-run commands there. Pinned by
> `features/programme-surface/tests/be/*.characterization.test.js`
> (WF-53 home; run `tools/ci be --slug programme-surface` FROM THE JOB WORKTREE;
> lane from `CHAR_BE_URL`, log from `CHAR_BE_LOG` — never a hardcoded port).

- No programme route: `curl -s -o /dev/null -w '%{http_code}' $CHAR_BE_URL/api/programmes`
  → `404`; `curl -s $CHAR_BE_URL/api` → 9 route entries, none for the programme.
- The readers exist unmounted: `getProgramme` (`src/store/programmes.ts:1019`),
  `getProgrammeForStream` (`:1052`, slice 1, over the `{streams:1, current:1}` index).
- Corpus: 5 docs · 6 streams · 27 weeks each · rows **103/97/81/59/39**
  (`mongosh teacher_saas --quiet --eval 'db.programmes.find().toArray().map(d => d.weeks.flatMap(w => w.rows).length)'`).
  Maths field density: competencies **76**/103 · contents 63 · guidance 55.
- Cost of serving: projection **38,775 B** (whole doc 62,883); find + stringify
  **p50 1.06 ms · p95 2.55 ms** over 30 runs. `If-None-Match` on `/api/skills` →
  `304` zero-byte (Express default ETag, no middleware). `Accept-Encoding: gzip` →
  no `Content-Encoding` (no compression, parked — SEED §6).
- The one 404: `resolve()`/`notFound()` (`src/routes/progress.ts:44-56,77-113`) —
  lowercase-hex check → `getOwned` → `{"error":{"message":"القسم غير موجود","type":"class_not_found"},…}`,
  byte-identical across probe variants. **`progress.ts` is read-only this slice** —
  the programme route replicates the guard; parity is pinned by byte-compare
  (contract §0).
- The vacuous pin: `markedWeek`'s bound reads the class's own programme
  (`progress.ts:111,127,139,177` — code correct), but a mutant hardcoding 27
  **survives all 411 be tests** because every corpus doc says 27
  (`classes-progress/known-gaps.md`). Recorded live with a synthetic
  `totals.weeks: 30` programme: `markedWeek 28 → 200`, `31 → 400` — **a hardcoded 27
  gives 400 at 28, the kill** (SEED §2).
- The loader refuses non-27 by design: `WEEKS_PER_YEAR = 27` enforced at
  `src/store/programmes.ts:445,556,679`. Those guards are **correct and frozen** —
  which is exactly why the pin's fixture must be a direct Mongo insert in the suite.
- ci gate: `tools/ci be --slug programme-surface` → `FAIL: no characterization tests
  resolved` — RED, correct (WF-82; a fresh job has no gate yet).

## Observability (PIN co-requisite)
- Visible today: correlation id on every response (middleware BEFORE the body parser —
  must not regress); `mutationlog` covers every class/progress write incl. CAS losses
  (`teacherIdPrefix`, 8 chars, one key name).
- **No blind spot to close, and that is a finding, not an omission (SEED §5):** a
  programme read is a cache-friendly read of a public document — a mutation-style log
  line would be noise, and the oracle pins its ABSENCE. What matters operationally is
  the tracker's new write pattern (many small PUTs → `cas_loss` becomes a frequency
  signal), and the existing `progress.write` line already carries it. Nothing to add.
- Verify: `tools/obs logs be`, `tools/obs trace <correlationId>`; suites read
  `CHAR_BE_LOG`.

## Data model changes
| Model / store | Field | Change | Migration? |
|---------------|-------|--------|-----------|
| — none — | | no collection, no field, no index; `toProgrammeRecord` is a read-side projection appended to `src/store/programmes.ts` | no |

## Surfaces (Express routes)
> Mounting in `src/app.ts:118-146` (after `progressRouter()` at `:138`); the `/api`
> index list at `src/app.ts:100-117` gains exactly one entry (contract §0).

| Surface | Implementation path | New/Modify | Contract |
|---------|--------------------|-----------|----------|
| `GET /api/classes/:classId/programme` | new `src/routes/programme.ts` | new | §1, §2, §7 |
| `toProgrammeRecord(doc)` | `src/store/programmes.ts` (append after `:1052`, touch no existing function) | modify (append only) | §2 |
| mount + index entry | `src/app.ts:100-117` (index), `:138+` (mount) | modify | §0 |

## Skills touched (`.claude/skills/`)
| Skill | New/Modify | What it produces | How its output is judged |
|-------|-----------|------------------|--------------------------|
| — none — | | this slice generates nothing | |

## Gating (concurrency, timeouts)
Untouched. No new path reaches `src/claude/runner.ts`. The programme read is a 1 ms
`findOne` + stringify on an existing index; it queues behind nothing.

## Failure classification
No new type, no new 5xx. The route reuses: `401 teacher_required` ·
`404 class_not_found` (**byte-identical body to the progress routes' — contract §7,
pinned by cross-route compare**) · `503 store_unavailable` (retryable) · `500` only
for the corpus-moved-underneath-us invariant (same rule as `GET /api/progress/:classId`
— a class's stream that stops resolving is OUR broken invariant, never the caller's
400). Callers branch on `error.type`, never the status code.

## Perimeter — two slice-1 pins this slice must respect (SEED §3)

1. **The `/api` route-count pin fires at promotion, not here.**
   `features/classes-progress/tests/be/progress.characterization.test.js:1074-1079`
   asserts the index has **exactly** `RECORDED_ROUTES.length + 1` entries. That suite
   is **not yet promoted**, so this slice's gate is unaffected — but promoting
   `classes-progress` after this lands turns it red. The amendment (a declared
   supersession, WF-65) is a promotion-time decision for that net; recorded here so it
   surprises nobody.
2. **`classes.characterization.test.js:198-203` pins `distinct("streams")` to exactly
   the six recorded values.** A synthetic programme left behind by a crashed run turns
   it red. be-2's fixture therefore self-heals (deletes any leftover in `beforeAll`)
   and cleans up in `afterAll` — **never at the end of a test body**.

---

## Sub-issues (this stack's technical work, grouped by issue)

```yaml
---
kind: sub-issue
id: be-1
parent: i1
stack: be
status: done
depends_on: []
estimate: M
---
```

### be-1 — the programme route: the corpus becomes visible, whole and whitelisted

**tag:** happy-path

**Intent.** The product's lead value is conformity to the official programme and the
programme is invisible — one guarded, class-scoped read route serves the whole
field-explicit projection, so `fe` never holds a stream→programme mapping and the
verbatim ministry text reaches the screens from data, not from UI literals.

**Ground truth.** SEED §2, lane slot 9 — pre-flight: reproduce all three before
writing a line:
```
curl -s -o /dev/null -w '%{http_code}' $CHAR_BE_URL/api/programmes        → 404
curl -s $CHAR_BE_URL/api | jq '.routes | length'                          → 9 (no programme entry)
mongosh teacher_saas --quiet --eval \
  'const d = db.programmes.findOne({docKey:"tadarroj-3as-math",current:true});
   print(d.totals.weeks, d.totals.hours, d.units.length, d.weeks.length)' → 27 189 14 27
```
The readers exist unmounted (`programmes.ts:1019,1052`); the 404 body to match is the
recorded `{"error":{"message":"القسم غير موجود","type":"class_not_found"},…}` from
`GET /api/progress/:classId` (progress.ts:50-56). Projection payload measured at
38,775 B, p50 1.06 ms.

**Delta (freeze).** May touch: new `src/routes/programme.ts` (the route: hex-shape
check → `getOwned` → `getProgrammeForStream` → `toProgrammeRecord`, behind
`requireTeacher`); `src/store/programmes.ts` (**append** `toProgrammeRecord(doc)` +
its return type after `:1052` — touch no existing function, and NOTHING between
`:396-750`: the validators and `WEEKS_PER_YEAR` are gated by the promoted
`programme-corpus` suite); `src/app.ts:100-117` (one index entry:
`"/api/classes/:classId/programme"`) and `:138+` (mount). **Frozen:**
`src/routes/progress.ts` (the guard is REPLICATED, not exported — SEED marks the file
read-only; parity is pinned executable below), `src/store/progress.ts`,
`src/routes/classes.ts`, `src/store/classes.ts`, `src/teacher.ts`, `src/inflight.ts`,
`src/mutationlog.ts`. Freeze check:
`git status --short -- src/routes/progress.ts src/store/progress.ts src/routes/classes.ts src/store/classes.ts src/teacher.ts src/inflight.ts src/mutationlog.ts` empty.

**Oracle.** `features/programme-surface/tests/be/programme.characterization.test.js`
(jest, black-box over `CHAR_BE_URL`, `describeIfLane` from `guard` — model:
`classes-progress/tests/be/classes.characterization.test.js`)
- mint a teacher → class on `شعبة الرياضيات` → `GET /api/classes/:id/programme` →
  `200`; `programme.docKey "tadarroj-3as-math"`, `edition` present, `weeklyHours 7`,
  `totals` exactly `{weeks: 27, hours: 189}`, `units.length 14`, `weeks.length 27`
  (positive)
- **key-set equality, three depths** (the whitelist is executable — contract §2):
  `Object.keys(programme).sort()` is exactly the eight; each unit exactly `{id, name}`;
  each week exactly `{week, unitId, hours, pdfPages, rows}`; each row exactly
  `{competencies, contents, guidance, hours, emphasis}`. Excluded-by-name spot checks:
  no `contentHash`, `transcriptionRev`, `frontMatter`, `weekNumberPrinted`, `nameText`,
  `units[].hours` anywhere in the payload string (negative)
- **verbatim is a comparison, not a fixture**: `source.authority/title`,
  `emphasisLegend.{text, pdfPage}`, and week 20's full `rows` byte-equal the same
  fields read directly from Mongo in the suite (positive — the projection may drop
  fields, never alter one)
- **one probe per corpus document, WF-70**: a class per stream (all six — the lettres
  document serves two streams the same doc), each GET returns the doc whose `streams`
  held that stream, `weeks.length 27`, and total row counts `103/97/81/59/39` per
  docKey (positive)
- the density fact that drove the contract: maths rows with non-empty `competencies`
  = **76**, contents 63, guidance 55; week 20 has 7 rows with 7 competencies and 3
  contents (positive — if a re-transcription moves these, the recording moved and the
  ask-when fires)
- **404 parity, cross-route**: {nonexistent id, another teacher's real class,
  non-hex garbage, UPPERCASE of the owned id} → all `404 class_not_found`, all four
  bodies byte-identical to each other AND to `GET /api/progress/:classId`'s 404 for
  the same probes (negative — contract §0/§7; the replicated guard cannot drift)
- no `x-teacher-id` → `401 teacher_required`, recorded body (negative)
- second GET with `If-None-Match` from the first's `ETag` → `304`, zero-byte body
  (positive — the caching story is the default ETag; a middleware that breaks it goes
  red here)
- `/api` index: contains `"/api/classes/:classId/programme"` and grew by exactly one
  entry over this suite's own recorded slice-1 list (negative — and see Perimeter 1:
  the OLD suite's count pin is amended at promotion, not here)
- `GET /api/progress/:classId` response for the same class byte-identical in key set
  and `programme {docKey, edition, totalWeeks}` to the slice-1 recording (negative —
  the picker's bound is untouched, contract §3)
- **obs assertion:** the programme GET's `correlationId` echoes in the response, and
  `CHAR_BE_LOG` gains NO `class.created`/`progress.write`-style mutation line for it —
  the deliberate read silence (SEED §5), pinned

**Boundaries.** Contract §§0–3, 7, 8.1, 8.10. Additive only — one route, one index
entry, zero changes to existing responses. Budget 10 iterations.

**Exit protocol.** Done-when: oracle green ×2 · freeze paths clean ·
`tools/ci be --slug programme-surface` green from the job worktree. Ask-when: the
projection seems to need a field outside the whitelist (contract amendment, not a
judgment call) · the 404 body cannot be made byte-identical without touching
`progress.ts` · any frozen file · budget blown.

---

```yaml
---
kind: sub-issue
id: be-2
parent: i1
stack: be
status: todo
depends_on: [be-1]
estimate: M
---
```

### be-2 — the bound pin closes: a programme that is not 27 weeks, at last

**tag:** hardening

**Intent.** Slice 1's only mutation survivor dies: hardcoding `27` for `totalWeeks`
survives all 411 be tests because every corpus document says 27 — so this sub-issue
gives the suite what reality refuses to provide, a programme with a different ceiling,
inserted directly because the loader's own guards (correctly) forbid making one.

**Ground truth.** The kill is proven live (SEED §2, lane s9): with a synthetic
`totals.weeks: 30` programme and a class on it, `PUT markedWeek: 28 → 200` and
`31 → 400` — **a hardcoded 27 answers 400 at 28**. The obstacle is written down:
`WEEKS_PER_YEAR = 27` is enforced at `src/store/programmes.ts:445,556,679`, those
guards are right and frozen, so the fixture CANNOT come through
`scripts/load-programmes.mjs` — it is a direct Mongo insert in the suite, on a stream
value no real document carries. Slice 1 already proved `be` accepts a class on a
synthetic-stream programme (the drift experiment, `known-gaps.md`). The tripwire to
respect: `classes-progress/tests/be/classes.characterization.test.js:198-203` pins
`distinct("streams")` to exactly the six. Pre-flight:
`mongosh teacher_saas --quiet --eval 'db.programmes.distinct("streams").length'` → `6`
(no leftover), and be-1's suite green.

**Delta (freeze).** May touch: **only** the new suite
`features/programme-surface/tests/be/bound-pin.characterization.test.js`.
**No product code — `git status --short` inside `stacks/teacher-be` stays empty for
this sub-issue.** Frozen explicitly: `WEEKS_PER_YEAR`, the seed validator, and every
line of `src/` (the implementation is already correct; the PIN is the deliverable).

**Oracle.** The suite itself (jest, black-box, `CHAR_BE_URL` + direct Mongo):
- `beforeAll`: **self-heal** — delete any `docKey: "synthetic-bound-pin"` residue from
  a prior crashed run; then insert the synthetic programme: stream
  `"شعبة اصطناعية — اختبار"` (no real document carries it), `current: true`,
  `totals: {weeks: 30, hours: 210}`, 30 `weeks[]` entries with `unitId`s/`rows`
  minimal but shaped, `edition`/`transcriptionRev` present (the stamp fields
  `resolve()` reads). The fixture is deliberately NOT loader-valid — varying the
  ceiling is its whole job
- create a class on the synthetic stream → `201` (the corpus, not a TS union, is the
  validator — re-proving slice 1's rule) (positive)
- `GET /api/progress/:classId` → `programme.totalWeeks: 30` (the picker's bound
  follows the class's OWN document) (positive)
- **the kill**: `PUT {rev: 0, markedWeek: 28}` → `200` — a hardcoded-27 mutant answers
  `400` here and this clause goes red; `markedWeek: 30` → `200`; `31` → `400
  invalid_request` (positive + negative — the bound is the document's, exactly)
- the entry bound follows the same ceiling (`progress.ts:139`): entry `{week: 29,
  status: "done"}` accepted; `{week: 31}` → `400` (positive + negative — WF-70, the
  second consumer of `totalWeeks`)
- **the twin kill on the new route**: `GET /api/classes/:classId/programme` →
  `totals.weeks: 30` and `weeks.length: 30` served verbatim — a projection-side
  hardcode or a `WEEKS_PER_YEAR` reuse in `toProgrammeRecord` dies here (positive)
- `afterAll`: delete the synthetic programme and the classes/progress docs created on
  it — **cleanup lives in `afterAll`, never at the end of a test body** (a mid-suite
  failure must still clean up); final clause runs slice 1's own guard expression:
  `distinct("streams")` equals exactly the six recorded values again (negative — the
  corpus-guard restored, executable in THIS suite so the leak is caught where it is
  made)

**Boundaries.** Contract §3 (the two week-totals are separate sources — this suite is
why); the promoted `programme-corpus` suite gates the loader and must stay green
untouched. Budget 8 iterations. Never touch `project/data/programmes/*.jsonl` — the
fixture lives and dies inside Mongo and this suite.

**Exit protocol.** Done-when: suite green ×2 (including the restored-corpus clause) ·
`git status --short` empty in `stacks/teacher-be` · `tools/ci be --slug
programme-surface` green · the promoted `project/tests/be` net still green. Ask-when:
class creation refuses the synthetic stream (the corpus-validation contract moved) ·
the synthetic insert trips any guard other than the ones named · budget blown.

---

```yaml
---
kind: sub-issue
id: be-3
parent: i1
stack: be
status: todo
depends_on: [be-1]
estimate: S
---
```

### be-3 — main's promoted gate is not red, it is non-deterministic

**status:** todo · **tag:** hardening

**Intent.** `tools/ci be` from the clone root — the promoted regression net on `main` — cannot
answer "did my change break it?". Not because it is red, but because **it is red by a
different amount every run on an unchanged tree**. Five slices remain, and every one of them
needs a baseline it can subtract. Fix determinism first; the staleness is the easy half.

**Ground truth (measured 2026-08-11, unchanged tree, `tools/ci be` from the clone root).**
Seven consecutive runs — four by the be-2 loop, three re-measured at planning time:

```
34 failed / 475 passed      41 failed / 468 passed      28 failed / 481 passed
29 failed / 480 passed      34 failed / 475 passed      32 failed / 477 passed
(+ one run in which the `--new-edition` clauses that failed in run 1 did not fail at all)
Tests total: 509 every time — nothing is being skipped.
```

The same suites pass and fail non-deterministically. be-2's diagnosis, not yet proven: the
`programme-corpus` loader and verifier suites spawn `scripts/load-programmes.mjs` against the
**shared scratch database `programme_corpus`** and contend with each other. `jest.characterization.config.js`
sets `maxWorkers: 1` (WF-84) for the *lane*-sharing reason, so if these still collide the
contention is between sequential runs' residue, not parallel workers — establish which before
changing anything.

**The deterministic half is separate and known.** Three clauses in the promoted net enumerate
the database's collections and were recorded before slice 1 added `classes` and `progress`:

```
project/tests/be/programme-corpus/loader.characterization.test.js:562
project/tests/be/programme-corpus/programmes-store.characterization.test.js:665
project/tests/be/programme-corpus/verifier.characterization.test.js:609
    "teacher_saas is untouched by this suite" / "holds the same collections before and after"
    → fails with  + "classes", + "progress"
```

Proven pre-existing: the be-1 verifier ran the same suites against base `7c18729` and got
**byte-identical** results on both sides.

**Third, small:** `src/routes/programme.ts:20-26`'s comment still carries the pre-fix claim
("Express's default ETag already answers a repeat visit with a zero-byte 304") that the two
comments ~100 lines below disprove twice over. The file argues with itself.

**Delta (freeze).** May touch: the three named collection-set clauses; whatever the flakiness
diagnosis actually implicates in `project/tests/be/programme-corpus/` (fixture isolation, a
per-run scratch db name, an `afterAll` that does not run, ordering) — **name it in the journal
before changing it**; and the comment block at `src/routes/programme.ts:20-26`.
**Frozen:** every other promoted clause · all product code except that comment · the corpus,
its loader and `scripts/verify-programmes.mjs` · `WEEKS_PER_YEAR` and the seed validator ·
this slice's own suites.

**Order of work, and it matters.** Diagnose and fix determinism **first**, then re-measure the
baseline over **at least five consecutive runs**, and only then decide what the collection-set
amendment has to say. Widening three clauses against a moving target proves nothing.

**The amendment must not weaken.** Those clauses exist to catch a suite that writes to the
product database. Keep exact collection-set equality — widen the *expected* set, never relax
to a subset check. Stronger and preferred if it is available: diff the collection set
**before and after within the run** rather than against a hardcoded list, which is immune to
the next collection anyone adds. Say which you chose and why. This is a **WF-65 declared
supersession of a promoted oracle** — declare it in the journal: which clauses, why, what did
not change.

**Oracle.**
- **`tools/ci be` from the clone root is green, and green FIVE consecutive times.** One green
  run is not evidence for this sub-issue; the whole point is repeatability.
- `tools/ci be --slug programme-surface` stays green (65/65).
- **Negative, and it is the important one:** the amended clauses must still go **red** when a
  suite really does create a collection. Prove it by planting one temporarily and showing the
  clause fires.
- Negative: no promoted clause outside the three is amended — diff the promoted tree and show
  the changed set.

**Boundaries.** Budget 8. Do not fix unrelated pre-existing reds; report them. If the
flakiness turns out to be environmental (host load — be-2 measured load average **59.9 on 8
cores** while two loops ran) rather than a suite defect, **say so and stop** rather than
inventing a fix: that is a stop-and-ask, and the right answer might be a serialisation rule
in `tools/ci`, which is engine and out of this Delta.

**Exit protocol.** Done-when: five consecutive greens from the clone root · this slice's gate
green · the supersession declared · freeze audit · the flakiness root cause named in the
journal with its evidence. Ask-when: the cause is environmental or lives in `tools/`
(engine) · a promoted clause is red for a reason unrelated to slice 1 · the amendment cannot
keep exact-set semantics.
