# Stack spec — teacher-be (+ the project repo's `data/programmes/`)

> Filled by `/planning` 2026-08-10 from the locked SEED. **This job is backend-only** —
> `fe.md` stays empty and `teacher-fe` is untouched.
>
> Unusual shape, on purpose: most of the work is not code, it is **reading 73 pages
> correctly**. The code (one store module, two scripts) exists to make that reading
> loadable, diffable and verifiable. There is **no HTTP surface, no skill, no consumer**
> (SEED §6.3–6.4) — the E2E trace is
> `JSONL in git → load-programmes.mjs → programmes → verify-programmes.mjs → green`.

## Scope recap

- **Modules:** `src/store/programmes.ts` (new — schema, canonical hash, indexes, write
  path) · `scripts/load-programmes.mjs` (new — the ONLY writer) ·
  `scripts/verify-programmes.mjs` (new — layer-1 gate, partial/resume mode, L2 compare) ·
  `data/programmes/*.jsonl` in the **project repo** (new — the source of record) ·
  `features/programme-corpus/verification/` (L2 artifacts).
- **Contract:** `contracts/programme-corpus.contract.md` (+ `.schema.yaml`). Every
  sub-issue binds to it.
- **Hard sequencing gate:** شعبة الرياضيات is transcribed, layer-1-green, layer-2-verified
  **and checked with the user** before any of the other four documents is transcribed
  (be-5's exit protocol; be-6…be-9 depend on it).
- **Not in scope:** any consumer · injecting curriculum into skills · `taxonomy.ts` ·
  التوزيع السنوي · levels other than 3AS · subjects other than maths.

## Current behavior baseline (recorded 2026-08-10, from the job worktree)

| probe | recorded |
|---|---|
| `mongosh --quiet --eval 'print(db.getSiblingDB("teacher_saas").getCollectionNames().sort().join(", "))'` | `exercise_revisions, solutions, subjects, teachers` — **no `programmes`, no `programme_revisions`** |
| `ls stacks/teacher-be/scripts/` | `backfill-teachers.mjs capacity.mjs purge-orphans.mjs seed-admin.mjs` — no loader/verifier; the `.mjs` + `MONGO_URL`/`MONGO_DB` env pattern is established here |
| `ls stacks/teacher-be/src/store/` | `client.ts revisions.ts solutions.ts subjects.ts teachers.ts` — no `programmes.ts` |
| `ls docs/reference/curriculum/` | the five `tadarroj-3as-*-2022.pdf` (+ their untrusted `.txt`, + an out-of-scope `EXAMPLE-tawzi3` pair) |
| `ls <scratchpad>/png/ \| wc -l` | **80** rendered PNGs (all five docs) at `/private/tmp/claude-501/-Users-lablabee-workspace-teacher-saas/f58aeed8-6a8a-4580-a372-b20bc0d1e9c5/scratchpad/png/` — re-render: `pdftoppm -r 150 -png <pdf> <outstem>` |
| `data/programmes/` | does not exist yet |

Corrected five-stream totals (SEED §2.1 — re-read from pages, NOT from text extraction):
math **189**=7×27 · techmath **162**=6×27 · sciences **135**=5×27 · gestion **108**=4×27 ·
lettres **54**=2×27. The `.txt` files beside the PDFs corrupted three of these (181/128/44)
and are never an input to anything.

### Test harness — read before writing a test
- Tests live in `features/programme-corpus/tests/be/`, filename `*.characterization.test.js`,
  run via `tools/ci be --slug programme-corpus` **from the job worktree** (WF-53).
- Fixtures live **beside the suite** (`tests/be/fixtures/`), read with `__dirname`.
- No lane and no HTTP needed here: suites spawn
  `node stacks/teacher-be/scripts/<x>.mjs` as a child process and assert on exit code +
  output. Loader suites pass `--db programme_corpus_ci` (a scratch db they drop) —
  **never** `teacher_saas`.
- The scripts import from `dist/` — run `(cd stacks/teacher-be && npm run build)` before
  gating; a suite that can't find `dist/store/programmes.js` must FAIL with that message,
  not skip (a hollow gate is RED, WF-82).
- **This job spawns no generations, ever.** No test, no pass, no verification step calls
  `/api/generate` or the CLI.

## Observability

- The loader reports lines read / weeks written / rows written / rows rejected / action
  taken; the verifier reports each assertion individually (SEED §6.5).
- Neither script touches `run-log.jsonl`; neither carries teacher content.
- Blind spot this job must not create: a correction landing silently. Every post-load
  content change goes through `--correct`, which writes `programme_revisions` — the audit
  trail IS the observability.

## Data model changes

| Store | Change |
|---|---|
| `programmes` (**new**) | one doc per source PDF; `{docKey, edition}` unique · `{streams, current}` · `{docKey, current}` partial. Full shape: contract |
| `programme_revisions` (**new**) | append-only supersession log, mirrors `exercise_revisions` |

Nothing existing is migrated or touched. `subjects`/`teachers`/`exercise_revisions`/`solutions` frozen.

## Surfaces

None. No route is added or modified; `src/app.ts` is not touched.

## Frozen for the whole job (any touch = stop-and-ask)

`agent/curriculum/3as-mathematiques.md` and the four skills reading it ·
`teacher-fe/**` (incl. `src/lib/taxonomy.ts`) · `/api/generate` and all of `src/routes/` ·
`src/app.ts` · every existing collection · `docs/reference/curriculum/*.pdf` (read-only
archive — the transcription READS renders of them, never writes beside them).

---

## Sub-issues

Dependency graph (the gate is structural, not a preference):

```
be-1 ─┬─ be-2 ─┐
      └─ be-3 ─┴─ be-4 ── be-5 ──[USER CHECK]──┬─ be-6 ─┐
                          (math L2 + gate)     ├─ be-7 ─┤
                                               ├─ be-8 ─┼─ be-10
                                               └─ be-9 ─┘
```

```yaml
---
kind: sub-issue
id: be-1
parent: i1
stack: be
status: todo
depends_on: []
estimate: M
---
```

### be-1 — `src/store/programmes.ts`: one definition of the shape

1. **Intent:** loader, verifier and (someday) the app must share exactly one definition of
   the document shape, its indexes and its `contentHash` — two definitions would drift, and
   drift here is the two-artifacts failure the SEED bounds explicitly (§3.2).

2. **Ground truth (recorded 2026-08-10 + re-run):**
   ```bash
   $ mongosh --quiet --eval 'print(db.getSiblingDB("teacher_saas").getCollectionNames().sort().join(", "))'
   exercise_revisions, solutions, subjects, teachers        # no programmes, no programme_revisions
   $ ls stacks/teacher-be/src/store/
   client.ts revisions.ts solutions.ts subjects.ts teachers.ts   # no programmes.ts
   ```
   Pre-flight must reproduce both.

3. **Delta:** `teacher-be/src/store/programmes.ts` — **new, the only file.** Exports:
   `validateProgrammeLine` / `validateWeekLine` (schema per contract, incl. the emphasis
   enum + its two guards) · `assembleDoc(lines)` · `canonicalContentHash(doc)` (sorted keys,
   no whitespace, no Unicode normalisation, excludes
   `_id, contentHash, transcriptionRev, current, createdAt, updatedAt`) ·
   `ensureProgrammeIndexes(db)` · `upsertProgramme(db, doc, {correct})` implementing the
   loader state table (insert / unchanged / hand-edit / refuse / correct+revision) ·
   `getProgramme(db, docKey, {edition?})`. Takes a `Db` handle from the caller — does NOT
   import or modify `src/store/client.ts`'s app singleton.
   Freeze: `git status --short -- src/store/programmes.ts` (in `stacks/teacher-be`) is the
   only be-repo dirt this sub-issue makes.

4. **Oracle (two-sided, executable):**
   `features/programme-corpus/tests/be/programmes-store.characterization.test.js`, run
   `tools/ci be --slug programme-corpus`:
   - *positive:* a synthetic valid fixture (27 weeks, weeklyHours 7) validates; hash is
     stable across key order and across `transcriptionRev`/`current` changes; `upsertProgramme`
     twice = one doc, second call reports unchanged; a mutated stored doc (simulated
     hand-edit) makes the hash check throw; the `correct` path writes one `programme_revisions`
     row holding the superseded doc and bumps `transcriptionRev` (scratch db
     `programme_corpus_ci`, dropped after).
   - *negative (rejects, one fixture per variant — WF-70):* a row without `emphasis` · an
     out-of-enum emphasis · `added-2022` under `emphasisLegend: null` · `red-unlegended`
     under a non-null legend · a week with empty `source.pdfPages` · 26 weeks · a week
     repeated · any field named `trimester` anywhere → validation error naming the line.
   - *negative (perimeter):* `mongosh` collection listing of `teacher_saas` is unchanged
     by the test run (tests only touch the scratch db).
   - *obs:* n/a (library module; reporting is the scripts' job).

5. **Boundaries:** contract §§ seed-file grammar, collections, contentHash — the schema
   there is binding; a shape question is answered by editing NOTHING and asking. Additive
   only. Budget: 10 iterations.

6. **Exit:** done-when = oracle green + freeze respected + `tools/ci be --slug programme-corpus`
   green. Ask-when = the contract's shape proves unimplementable as written · anything
   outside the one file needs touching · budget blown.

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

### be-2 — `scripts/load-programmes.mjs`: the only writer, idempotent, guarded

1. **Intent:** the seed file is the source of record and Mongo is its projection — this
   script is the single bridge, and its refusals (reject on missing emphasis, hard-error on
   hand-edits, `--correct` or nothing) are what make the projection trustworthy.

2. **Ground truth (recorded 2026-08-10 + re-run):**
   ```bash
   $ ls stacks/teacher-be/scripts/
   backfill-teachers.mjs capacity.mjs purge-orphans.mjs seed-admin.mjs   # no loader
   ```
   plus be-1's recording (no `programmes` collection). Pre-flight reproduces both.

3. **Delta:** `teacher-be/scripts/load-programmes.mjs` — **new, the only file.** CLI per
   contract (`--file · --db · --correct · --dry-run`; env `MONGO_URL`); imports everything
   shape-shaped from `../dist/store/programmes.js` (build first — duplicates no logic);
   exit codes 0/1/2/3 per the contract's state table; reports lines read / weeks written /
   rows written / rows rejected / action.
   Freeze: `git status --short -- scripts/load-programmes.mjs`.

4. **Oracle (two-sided, executable):**
   `features/programme-corpus/tests/be/loader.characterization.test.js` (scratch db
   `programme_corpus_ci`, dropped after; fixtures beside the suite):
   - *positive:* valid fixture → exit 0, doc present with `transcriptionRev: 1`,
     `current: true`, indexes exist · same file again → exit 0, output contains
     `unchanged`, still exactly one doc · edited fixture without `--correct` → exit 3,
     DB untouched · with `--correct` → exit 0, `programme_revisions` has exactly one row
     holding the SUPERSEDED doc verbatim, `transcriptionRev: 2` · `--dry-run` writes nothing.
   - *positive (hand-edit guard):* `mongosh` mutates one stored field → next load attempt
     exits 2 and the output names the hash mismatch; nothing written.
   - *negative:* a fixture with one emphasis-less row → exit 1, output names the line,
     **zero** documents written (whole-file reject, not partial load) · a second
     `programme` line → exit 1 · 26 weeks → exit 1.
   - *negative (perimeter):* `teacher_saas` collection listing unchanged by the suite.
   - *obs:* every run prints the report line; `run-log.jsonl` untouched (mtime/size stable
     across the suite).

5. **Boundaries:** contract § CLI load-programmes (the state table is binding, including
   "reject the whole file"). Additive; no import of `src/` app modules beyond
   `dist/store/programmes.js`. Budget: 10 iterations.

6. **Exit:** done-when = oracle green + freeze respected + ci green. Ask-when = the state
   table forces a behavior the store module (be-1, now frozen) cannot express · any second
   file needs touching · budget blown.

```yaml
---
kind: sub-issue
id: be-3
parent: i1
stack: be
status: todo
depends_on: [be-1]
estimate: M
---
```

### be-3 — `scripts/verify-programmes.mjs`: layer 1, the pass gate, and L2 compare

1. **Intent:** every arithmetic and structural property of the corpus must be a machine's
   verdict, not a reader's impression — this script is the gate every transcription pass
   and every load runs behind, and its `--partial` resume output is the pass hand-off.

2. **Ground truth (recorded 2026-08-10 + re-run):** same scripts-dir recording as be-2 (no
   verifier exists). Plus the arithmetic it must encode, recorded in SEED §2.1: the three
   brief errors 181/128/44 all fail `totals.hours == weeklyHours × 27`
   (181/27, 128/27, 44/27 — none an integer), and the sample's real values all pass.

3. **Delta:** `teacher-be/scripts/verify-programmes.mjs` — **new, the only file.** Three
   modes per contract: `--file [--partial]` · `--db --docKey` (adds the contentHash
   recompute) · `--compare <seed> <l2>`. Assertions A1–A7 reported individually; partial
   mode checks closed weeks + contiguity and prints the resume state (next week · last
   pdfPage · open unit and its consumed weeks · units not yet started). Imports shape code
   from `dist/store/programmes.js`.
   Freeze: `git status --short -- scripts/verify-programmes.mjs`.

4. **Oracle (two-sided, executable):**
   `features/programme-corpus/tests/be/verifier.characterization.test.js`, fixtures one per
   assertion (WF-70 — every way a check can fail gets a fixture):
   - *positive:* the valid 27-week fixture → exit 0, all assertions reported green ·
     a truncated 9-week fixture with `--partial` → exit 0 AND stdout contains
     `resume: next week 10` with the open unit's consumed-weeks count · `--compare` of a
     seed against a matching l2 file → exit 0.
   - *negative (each exits 1 and names its assertion):* totals corrupted to 181 (A3) ·
     units summing ≠ totals (A1, A2) · one week's rows summing to 6 (A4) · week 14 missing
     and week 14 duplicated (A5, two fixtures) · an orphan `unitId` and a unit no week
     references (A6, two fixtures) · empty `pdfPages` (A7) · `--compare` where the l2 file
     disagrees on one row's hours, on one emphasis, and on one anchor (three fixtures —
     the attribution-drift cases layer 1 cannot see MUST be exactly what compare catches).
   - *negative (perimeter):* the verifier never writes — no db change, no file change, in
     any mode.
   - *obs:* each assertion appears by name in the output (SEED §6.5).

5. **Boundaries:** contract §§ verify CLI + layer-2 protocol (comparable subset ONLY — it
   must not compare full text; two honest verbatim reads may differ in whitespace).
   Additive. Budget: 10 iterations.

6. **Exit:** done-when = oracle green + freeze respected + ci green. Ask-when = an
   assertion in the contract is ambiguous against a real fixture · resume state proves
   under-specified for some legal JSONL · budget blown.

```yaml
---
kind: sub-issue
id: be-4
parent: i1
stack: be
status: todo
depends_on: [be-2, be-3]
estimate: L
---
```

### be-4 — transcribe شعبة الرياضيات (19 pages) → `data/programmes/tadarroj-3as-math.jsonl`, loaded, layer-1 green

1. **Intent:** the hardest document first, end to end, so the schema and method are proven
   (or broken) where breaking is cheapest — this file is what the user checks at the gate.

2. **Ground truth (recorded + re-run):** the proven method and its three known failure
   modes are `transcription-sample.md` (three real pages of THIS document — week boundaries
   off-page, merged-cell attribution, فارغ cells). 80 PNGs at
   `<scratchpad>/png/` — re-run:
   `pdftoppm -r 150 -png docs/reference/curriculum/tadarroj-3as-math-2022.pdf <stem>`
   (4.5 s); dense pages `pdftoppm -r 300 -f <p> -l <p> -png` + crop. Recorded constants to
   hit: weeklyHours **7**, totals **189 = 7×27**, summary rows per the sample's pdf-p5
   table (14 unit rows incl. three معالجة and one تقويم تشخيصي). Pre-flight: PNGs exist
   (re-render if the scratchpad was cleaned) and the sample's p5 table still reads 189.

3. **Delta:** `data/programmes/tadarroj-3as-math.jsonl` — **new (project repo)**, plus the
   `programmes`/`programme_revisions` rows the loader writes from it. NO be-repo file
   changes. Committed to the job branch pass by pass — the diff trail is the reviewability
   the SEED bought by putting the seed in git (§3.2).
   Freeze: `git status --short -- data/ features/` is the only project-repo dirt;
   `git status --short -- docs/reference/curriculum/` is **empty**.

4. **Oracle (two-sided, executable):**
   - *positive:* `node stacks/teacher-be/scripts/verify-programmes.mjs --file data/programmes/tadarroj-3as-math.jsonl`
     → exit 0, A1–A7 green with totals `{27, 189}` · loader exit 0 ·
     `verify --db --docKey tadarroj-3as-math` → exit 0 ·
     `mongosh … 'db.programmes.findOne({docKey:"tadarroj-3as-math"},{weeklyHours:1,"totals.hours":1})'`
     → `7 / 189` · the three sample pages (pdf 5, 6, 7) match `transcription-sample.md` in
     structure and hours (week 2: 2+2+1+2 · week 3: 4+3 across the page break · week 4:
     2+2+2+1) — the sample is a frozen pin for those pages.
   - *positive (per pass — the protocol is the oracle for the middle):* after every pass,
     `verify --file --partial` exit 0; only closed weeks committed; each pass = one git
     commit whose message records the printed resume line.
   - *negative:* no `trimester` key anywhere (`grep -c trimester data/programmes/*.jsonl` → 0) ·
     every row carries `emphasis` (the loader already hard-rejects; the grep is belt) ·
     frozen paths untouched (path-scoped git status above) ·
     `agent/curriculum/3as-mathematiques.md` byte-identical
     (`git status --short -- agent/curriculum/` empty in the be repo).
   - *obs:* loader report shows 27 weeks written, 0 rejected.

5. **Boundaries:** contract §§ grammar + pass protocol (pass 0 first, its A1–A3 green
   before any week; closed weeks only; resume derived from the file, never remembered;
   rotated محور resolved from the units table + the page). Arabic verbatim; maths in `$…$`.
   **Budget: 5 passes** (19 pages at 6–8/pass = 3, +2 for 300 dpi re-reads), 10 loop
   iterations.

6. **Exit:** done-when = oracle green + freeze respected + `tools/ci be --slug programme-corpus`
   green. Ask-when (each is a hard stop, not a judgement call):
   - **BEFORE transcribing pdf p19:** the red blocks there have no on-page legend. Search
     all 19 pages (incl. cover and front matter) for a legend. Found → `emphasisLegend`
     set, red rows = `added-2022`. **Not found → STOP AND ASK the user** with the p19
     crop; record the outcome (`emphasisLegend: null` + rows `red-unlegended`, or the
     user's ruling). **Never guessed** (SEED §6.6).
   - a page where 300 dpi still cannot disambiguate a digit or a cell boundary ·
   - a structure the grammar cannot represent (e.g. a printed week spanning two محورs) ·
   - a summary-table total that does not re-sum from its own rows ·
   - budget blown.

```yaml
---
kind: sub-issue
id: be-5
parent: i1
stack: be
status: todo
depends_on: [be-4]
estimate: L
---
```

### be-5 — layer-2 independent re-read of شعبة الرياضيات + THE USER GATE

1. **Intent:** layer 1 catches no attribution or emphasis error — a paragraph on the wrong
   competency passes every check and misstates the ministry (SEED §5) — so a reader that
   has never seen the transcription re-reads every page; and the user signs off on this
   document before 54 more pages are committed to the same schema and method.

2. **Ground truth (recorded + re-run):** be-4's loaded, layer-1-green corpus
   (`verify --db --docKey tadarroj-3as-math` → exit 0 — pre-flight re-runs this) and the
   same PNGs. The known blind spot this exists for is recorded in
   `transcription-sample.md` § failure mode 2: on pdf p7 one `ح.س` of 3 spans two `السير`
   paragraphs and three `كفاءات` lines.

3. **Delta:** `features/programme-corpus/verification/tadarroj-3as-math.l2.jsonl` +
   `…l2-report.md` — **new**; plus, for any accepted fix, an edit to
   `data/programmes/tadarroj-3as-math.jsonl` re-landed via `load-programmes.mjs --correct`
   (each fix = one `programme_revisions` row + one git commit). No be-repo changes.
   Freeze: `git status --short -- data/programmes/ features/programme-corpus/verification/`.

4. **Oracle (two-sided, executable):**
   - *positive (independence is mechanical, not promised):* the l2 file is produced by
     fresh subagent passes whose prompts contain ONLY PNG paths + the `l2-week` shape from
     the contract — never the seed JSONL, never be-4's journal. The report records, per
     pass, which pages went in. 27 `l2-week` lines, every week covered.
   - *positive:* `node stacks/teacher-be/scripts/verify-programmes.mjs --compare data/programmes/tadarroj-3as-math.jsonl features/programme-corpus/verification/tadarroj-3as-math.l2.jsonl`
     → **exit 0 after disposition** — every discrepancy it printed is in the report as
     either `fixed` (with its `programme_revisions` rev) or `seed-correct` (with the page
     evidence); zero undispositioned.
   - *negative:* every fix went through `--correct` — revision-row count == fixes in the
     report · final `verify --file` AND `--db` still exit 0 (a fix may not break
     arithmetic) · the sample-pinned pages (pdf 5–7) still match the sample.
   - *obs:* the report tallies discrepancies by class (attribution / emphasis / hours /
     week-number) — the job's honest error-rate measurement, the baseline be-10 is judged
     against.
   - **Declared transient (for the reviewer, WF-65 spirit):** `--compare` is red between
     the l2 file landing and dispositions completing — that red inside this sub-issue's
     own scope is the process working, not a violation.

5. **Boundaries:** contract § layer-2 protocol (comparable subset only; anchors, hours,
   emphasis, structure — not full-text equality). **Budget: 4 L2 passes** (19 pages) +
   10 loop iterations.

6. **Exit:** done-when = oracle green + freeze respected + ci green, **and then the gate:
   present to the user** — the loaded doc's headline numbers, the l2-report's discrepancy
   tally and dispositions, 2–3 rendered-page-vs-stored-week spot checks, and the p19
   ruling made in be-4 — and **wait for an explicit yes. be-6…be-9 must not start
   before it** (SEED §4 — hard sequencing; this is where it is enforced).
   Ask-when = a discrepancy reveals a schema-level misfit (bounce to planning — cheaper
   now than after four more documents) · dispositions exceed the pass budget · the user
   says no or amends (amendments become `--correct` fixes, or a planning bounce if
   schema-shaped).

```yaml
---
kind: sub-issue
id: be-6
parent: i1
stack: be
status: todo
depends_on: [be-5]
estimate: L
---
```

### be-6 — transcribe تقني رياضي (19 pages) → `tadarroj-3as-techmath.jsonl`, loaded, layer-1 green

1. **Intent:** land the second-densest document with the user-validated schema and method.

2. **Ground truth (recorded + re-run):** SEED §2.1/§2.3 constants: weeklyHours **6**,
   totals **162 = 6×27**; 6 competency domains; ملامح التخرج present. Same PNG dir —
   re-run: `pdftoppm -r 150 -png docs/reference/curriculum/tadarroj-3as-techmath-2022.pdf <stem>`.
   ⚠ Unlike math, this document's MAIN table is **unread** (SEED §6.7) — the summary table
   and section inventory are the only prior evidence; a surprise is an ask-when, never an
   improvisation. Pre-flight: be-5's user gate recorded as passed; PNGs render.

3. **Delta:** `data/programmes/tadarroj-3as-techmath.jsonl` — **new**, plus its loaded
   rows. Freeze: as be-4 (data/ + verification/ only; archive untouched).

4. **Oracle (two-sided, executable):** as be-4 with this document's constants —
   `verify --file` exit 0 with totals `{27, 162}` and weeklyHours 6 · loader 27/0 ·
   `verify --db --docKey tadarroj-3as-techmath` exit 0 · per-pass `--partial` green +
   one commit per pass · negative: no `trimester`, every row has `emphasis`, frozen paths
   clean. Red text: legend present → `added-2022`; red with no legend anywhere in the
   document → the be-4 stop-and-ask pattern applies before that page is committed.

5. **Boundaries:** contract grammar + pass protocol. **Budget: 5 passes**, 10 iterations.

6. **Exit:** done-when = oracle green + freeze + ci green. Ask-when = unrepresentable
   structure (a printed week spanning two محورs · a summary total that will not re-sum ·
   a competency section that does not fit `{domain, statements[]}`) · unlegended red ·
   a cell unreadable at 300 dpi · budget blown.

```yaml
---
kind: sub-issue
id: be-7
parent: i1
stack: be
status: todo
depends_on: [be-5]
estimate: M
---
```

### be-7 — transcribe علوم تجريبية (17 pages) → `tadarroj-3as-sciences.jsonl`, loaded, layer-1 green

1. **Intent:** land the largest-audience stream — and the schema's known stress-test for
   assigned unit ids.

2. **Ground truth (recorded + re-run):** weeklyHours **5**, totals **135 = 5×27** (the one
   figure verified independently even before DISCOVERY); **5** competency domains — drops
   الحساب entirely (domain sets are per-document data, never an enum, SEED §2.3.2);
   **المتتاليات العددية appears TWICE in the units** (§2.3.5 — the reason `unitId` is
   assigned). Main table unread; same caveat as be-6. Re-render as be-6 with the sciences
   pdf.

3. **Delta:** `data/programmes/tadarroj-3as-sciences.jsonl` — **new**, plus loaded rows.
   Freeze as be-4.

4. **Oracle (two-sided, executable):** as be-4 with `{27, 135}` / weeklyHours 5, **plus:**
   the units array contains two distinct ids whose `name` is المتتاليات العددية, and A6
   confirms weeks reference both — the duplicate-unit case must exist in the data, not be
   merged away · `competencies` has exactly 5 domains.

5. **Boundaries:** contract grammar + pass protocol. **Budget: 4 passes**, 10 iterations.

6. **Exit:** as be-6 (same ask-whens, incl. unlegended red).

```yaml
---
kind: sub-issue
id: be-8
parent: i1
stack: be
status: todo
depends_on: [be-5]
estimate: M
---
```

### be-8 — transcribe تسيير واقتصاد (10 pages) → `tadarroj-3as-gestion.jsonl`, loaded, layer-1 green

1. **Intent:** land the first document with NO competencies section and WITH the red-text
   legend — the two schema decisions (nullable competencies, required emphasis) prove
   themselves here on real data.

2. **Ground truth (recorded + re-run):** weeklyHours **4**, totals **108 = 4×27** (the
   brief's 128 was extraction corruption — 128/27 is not an integer); الكفاءات المستهدفة
   **absent** → `competencies: null` (§2.3); ملامح التخرج present; carries the legend
   «تم إدراج العناصر الملونة بالأحمر لعدم تناولها في السنة الدراسية 2021-2022» (§2.4); its
   weeks column header drops the hamza — stored verbatim, never normalised (§2.3.6).
   Re-render as be-6 with the gestion pdf.

3. **Delta:** `data/programmes/tadarroj-3as-gestion.jsonl` — **new**, plus loaded rows.
   Freeze as be-4.

4. **Oracle (two-sided, executable):** as be-4 with `{27, 108}` / weeklyHours 4, **plus:**
   the programme line has `"competencies":null` (null, not `[]`) · `emphasisLegend.text`
   is the verbatim legend with its `pdfPage` · no row uses `red-unlegended` (a legend
   exists, so red is `added-2022`) · whether every red row was actually caught is be-10's
   job, not assumed here.

5. **Boundaries:** contract grammar + pass protocol. **Budget: 3 passes**, 10 iterations.

6. **Exit:** as be-6.

```yaml
---
kind: sub-issue
id: be-9
parent: i1
stack: be
status: todo
depends_on: [be-5]
estimate: M
---
```

### be-9 — transcribe آداب وفلسفة + لغات أجنبية (8 pages) → `tadarroj-3as-lettres.jsonl`, loaded, layer-1 green

1. **Intent:** land the two-streams-one-document case — the reason the SEED rejected
   one-record-per-stream — and the sparsest schema variant (no competencies, no ملامح
   التخرج).

2. **Ground truth (recorded + re-run):** weeklyHours **2**, totals **54 = 2×27** (brief
   said 44 — 44/27 not an integer); `streams` holds **two** values; `competencies: null`
   AND `frontMatter.graduateProfile: null` (§2.3); carries the red legend; splits
   الحساب / الحساب تابع into distinct units (assigned ids again, §2.3.5); heads its weeks
   column `الحجم الأسبوعي` — stored verbatim (§2.3.6). Re-render as be-6 with the lettres
   pdf.

3. **Delta:** `data/programmes/tadarroj-3as-lettres.jsonl` — **new**, plus loaded rows.
   Freeze as be-4.

4. **Oracle (two-sided, executable):** as be-4 with `{27, 54}` / weeklyHours 2, **plus:**
   `db.programmes.find({streams:"آداب وفلسفة"})` and `…find({streams:"لغات أجنبية"})` each
   return exactly one doc and it is the SAME `_id` (the multikey index answers per-stream
   queries with zero duplication — the SEED's §3.1 deviation, proven live) ·
   `competencies` null · `graduateProfile` null · legend recorded · الحساب and
   الحساب تابع are distinct unit ids.

5. **Boundaries:** contract grammar + pass protocol. **Budget: 2 passes**, 10 iterations.

6. **Exit:** as be-6.

```yaml
---
kind: sub-issue
id: be-10
parent: i1
stack: be
status: todo
depends_on: [be-6, be-7, be-8, be-9]
estimate: L
---
```

### be-10 — layer-2 independent re-read of the four remaining documents

1. **Intent:** the corpus's claim is "faithful to the ministry", and for 54 of its 73
   pages no independent reader has checked attribution or emphasis — this closes that gap
   with the exact protocol the user already validated on math.

2. **Ground truth (recorded + re-run):** be-6…be-9 loaded and layer-1 green
   (`verify --db --docKey <each>` → exit 0 ×4 — pre-flight re-runs all four); be-5's
   l2-report tally as the expected discrepancy-rate baseline; the same PNG dir.

3. **Delta:** `features/programme-corpus/verification/<docKey>.l2.jsonl` + `…l2-report.md`
   for the four docKeys — **new**; accepted fixes edit the corresponding
   `data/programmes/*.jsonl` and re-land via `--correct` (one revision row + one commit
   each). No be-repo changes. Freeze: as be-5.

4. **Oracle (two-sided, executable):**
   - *positive:* per document — fresh-subagent passes (PNGs + the l2-week shape ONLY, per
     the contract's independence rule), 27 l2-week lines, `verify --compare` exit 0 after
     disposition, zero undispositioned.
   - *positive (emphasis sweep):* for gestion and lettres the l2 read records
     `rowEmphasis` from colour alone; every red row the l2 pass saw must be `added-2022`
     in the seed — a colour the transcription missed is exactly what this catches (§2.4).
   - *negative:* every fix through `--correct` (revision rows == fixes) · all four still
     layer-1 green after fixes · math's corpus and report untouched
     (`git status --short -- data/programmes/tadarroj-3as-math.jsonl features/programme-corpus/verification/tadarroj-3as-math.l2.jsonl features/programme-corpus/verification/tadarroj-3as-math.l2-report.md` empty).
   - *obs:* each report tallies discrepancies by class; the four tallies land in the job
     journal beside be-5's — the corpus ships with its measured error rate.
   - Transient `--compare` red before disposition: declared, as in be-5.

5. **Boundaries:** contract § layer-2 protocol. **Budget: 9 L2 passes total**
   (19+17+10+8 = 54 pages) + 10 loop iterations.

6. **Exit:** done-when = all four oracles green + freeze respected +
   `tools/ci be --slug programme-corpus` green (the whole suite, one last time).
   Ask-when = a discrepancy class exceeds ~3× be-5's rate on any document (the method may
   not transfer to that layout — stop and report, don't grind) · a schema misfit · budget
   blown.
