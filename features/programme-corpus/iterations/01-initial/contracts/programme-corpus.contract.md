---
kind: sub-issue
id: contract-corpus
parent: m1
stack: contract
status: todo
depends_on: []
estimate: M
---

# Contract: JSONL seed ↔ loader ↔ `programmes` collection ↔ verifiers

> The whole job runs through this one pipeline (SEED §6.4):
> `JSONL in git → load-programmes.mjs → programmes collection → verify-programmes.mjs → green`.
> No HTTP boundary, no UI, no skill. The "wire" here is the seed-file grammar and the
> collection shape, and both sides of every sub-issue bind to this file.
> Machine-readable schema: `programme-corpus.schema.yaml` beside this file.

## Boundary

- **Producer:** transcription passes (be-4, be-6…be-9) writing `data/programmes/<docKey>.jsonl`
  in the **project repo** — the source of record. Mongo is its projection (SEED §3.2).
- **Only writer to Mongo:** `teacher-be/scripts/load-programmes.mjs`. Nothing else writes
  `programmes` or `programme_revisions`. A hand-edit in Mongo is a **hard error** the loader
  detects via `contentHash` — when that guard fires, **the DB is wrong and the file is right**.
- **Consumers:** none (SEED §6.3). That is the point. `verify-programmes.mjs` is the only reader.

## The five documents (fixed constants — these ARE the oracle inputs, from SEED §2.1)

| docKey | file (`docs/reference/curriculum/`) | pdf pages | streams | weeklyHours | totals.hours | competencies | graduateProfile |
|---|---|---|---|---|---|---|---|
| `tadarroj-3as-math` | `tadarroj-3as-math-2022.pdf` | 19 | [شعبة الرياضيات] | 7 | **189** | 6 domains | present |
| `tadarroj-3as-techmath` | `tadarroj-3as-techmath-2022.pdf` | 19 | [تقني رياضي] | 6 | **162** | 6 domains | present |
| `tadarroj-3as-sciences` | `tadarroj-3as-sciences-2022.pdf` | 17 | [علوم تجريبية] | 5 | **135** | **5** domains | present |
| `tadarroj-3as-gestion` | `tadarroj-3as-gestion-2022.pdf` | 10 | [تسيير واقتصاد] | 4 | **108** | **null** | present |
| `tadarroj-3as-lettres` | `tadarroj-3as-lettres-2022.pdf` | 8 | [آداب وفلسفة, لغات أجنبية] | 2 | **54** | **null** | **null** |

`edition: "2022-09"` for all five. `totals.weeks: 27` for all five. `level: "3AS"`.
The lettres document is **one** record with two streams — never duplicated per stream.

## Seed-file grammar — `data/programmes/<docKey>.jsonl`

One file per document. UTF-8, one JSON object per line, **no normalisation of Arabic**
(kashidas, hamza variants, spacing — verbatim as printed; that is why `nameText` etc. exist).

**Line 1 — exactly one `programme` line:**

```jsonc
{ "type": "programme",
  "docKey": "tadarroj-3as-math", "edition": "2022-09",
  "streams": ["شعبة الرياضيات"], "level": "3AS",
  "source": { "authority": "وزارة التربية الوطنية — المفتشية العامة للتربية الوطنية",
              "title": "…verbatim cover title…", "file": "tadarroj-3as-math-2022.pdf",
              "pages": 19, "renderedAt": "2026-08-10" },
  "weeklyHours": 7,
  "totals": { "weeks": 27, "hours": 189, "weeksText": "27 أسبوع", "hoursText": "189 ساعة" },
  "frontMatter": { "intro": "…|null", "methodNote": "…|null", "graduateProfile": "…|null" },
  "competencies": [ { "domain": "…", "statements": ["…"] } ],   // or null — ABSENT ≠ EMPTY
  "emphasisLegend": { "text": "…verbatim…", "pdfPage": 3 },      // or null = no legend found
  "units": [ { "id": "u01", "name": "…", "nameText": "…verbatim cell…",
               "weeks": 1, "weeksText": "أسبوع", "hours": 7, "hoursText": "7 ساعات",
               "sourcePdfPage": 5 } ]
}
```

**Lines 2..28 — exactly 27 `week` lines, in order:**

```jsonc
{ "type": "week", "week": 3, "weekNumberPrinted": 3,          // or null when not printed
  "unitId": "u02",                                             // or null; NEVER derived
  "hours": 7,
  "source": { "pdfPages": [6, 7], "docPages": [5, 6] },        // REQUIRED, non-empty
  "rows": [ { "competencies": ["…"], "contents": ["…"], "guidance": ["…"],
              "hours": 2, "emphasis": "normal" } ]
}
```

### Field rules (each traces to a SEED finding)

- **`emphasis` is REQUIRED on every row.** Enum: `"normal"` · `"added-2022"` (red under a
  document that carries the legend «تم إدراج العناصر الملونة بالأحمر لعدم تناولها في السنة
  الدراسية 2021-2022») · `"red-unlegended"`. A missing or out-of-enum value is a loader
  **reject**, never a default (SEED §2.4).
  - `"red-unlegended"` is legal **only** when the document's `emphasisLegend` is `null` AND
    the legend search was performed and its absence recorded (see be-4's stop-and-ask). It
    stores the *fact* of red without guessing its *meaning*. ⚠ The SEED's schema line named
    only two values; its own disposition ("record the legend's absence — never guess") is
    unrepresentable in two values, so this third value is the deliberate contract-level
    resolution. The p19 stop-and-ask still happens — the user can override.
  - Guard: `emphasis == "added-2022"` requires `emphasisLegend != null` on the document.
- **`unitId` is assigned (`u01`, `u02`, … in summary-table order), never derived** from name
  or position — units repeat (علوم تجريبية lists المتتاليات twice) and are non-contiguous.
  Repeated معالجة rows are distinct units with distinct ids.
- **`trimester` does not exist anywhere in this contract.** الفصول is one merged cell with
  no per-row grouping in any document. Do not reintroduce it under any name.
- **`competencies: null`** for gestion and lettres — null, not `[]`.
- **`week` is our 1..27 ordinal; `weekNumberPrinted` is what the page shows** (int or null —
  week 3 of math is unprinted on pdf p6, printed on p7).
- **`weeks` values may be non-integer** (أسبوع ونصف = 1.5); `weeksText`/`hoursText`/`nameText`
  keep the verbatim cell (SEED §6.6: two representations of one value, both kept).
- **Maths as LaTeX in `$…$`**, KaTeX-safe; Arabic prose verbatim, never paraphrased.
- **`source.pdfPages` non-empty on every week** or the week is not verifiable (SEED §2.5).

## Collection: `programmes` (db `teacher_saas`)

One document per source PDF — the assembled JSONL (programme line + `weeks[]`) plus:

```
transcriptionRev  int      ← starts 1, $inc on every --correct. OUR version axis
contentHash       string   ← sha256 guard (below)
current           bool     ← exactly one true per docKey
createdAt · updatedAt
```

Two version axes, never collapsed: `edition` = the ministry revised the programme;
`transcriptionRev` = we fixed our reading of an unchanged page (SEED §3.1).

**Indexes:** `{docKey: 1, edition: 1}` unique · `{streams: 1, current: 1}` (multikey) ·
`{docKey: 1, current: 1}` partial on `{current: true}`.

**`contentHash`** = sha256 hex of the canonical JSON (recursively sorted keys, no
whitespace, UTF-8 bytes exactly as stored — **no** Unicode normalisation) of the document
**minus** `_id, contentHash, transcriptionRev, current, createdAt, updatedAt`.

## Collection: `programme_revisions` (append-only)

Mirrors `exercise_revisions`: `{ docKey, edition, transcriptionRev, doc (the SUPERSEDED
document, verbatim), note, correctedAt }`. Index `{docKey: 1, edition: 1, transcriptionRev: 1}`.
Nothing is ever deleted or updated here.

## CLI: `scripts/load-programmes.mjs` — the only writer

```
node scripts/load-programmes.mjs --file <path>.jsonl [--db teacher_saas] [--correct] [--dry-run]
```

Env: `MONGO_URL` (default `mongodb://127.0.0.1:27017`), `--db` overrides `MONGO_DB`
(tests use a scratch db, **never** the real one). Requires `npm run build` first — it
imports schema/hash/index code from `dist/store/programmes.js` so there is exactly one
definition of the shape.

| state | behaviour | exit |
|---|---|---|
| line fails schema (row missing `emphasis`, bad enum, missing `source.pdfPages`, wrong line count, …) | **reject the whole file** — report every bad line (`line N: <reason>`), write nothing | 1 |
| no doc for `{docKey, edition}` | insert with `transcriptionRev: 1`, computed `contentHash`, `current: true`; flip `current: false` on other editions of the docKey; ensure indexes | 0 |
| doc exists, file content identical (hash equal) | **no-op**, report `unchanged` — idempotent | 0 |
| doc exists, stored `contentHash` ≠ recompute(stored doc) | **hand-edit detected** — refuse everything, report `DB is wrong, file is right` | 2 |
| doc exists, file differs, no `--correct` | refuse, show a field-path summary of the difference | 3 |
| doc exists, file differs, `--correct` | append the superseded doc to `programme_revisions`, replace, `transcriptionRev + 1`, new hash | 0 |

Reporting (obs baseline, SEED §6.5): lines read, weeks written, rows written, rows rejected,
and the action taken. **Never touches `run-log.jsonl`; never carries teacher content.**

## CLI: `scripts/verify-programmes.mjs` — layer 1 + partial + L2-compare

```
node scripts/verify-programmes.mjs --file <path>.jsonl [--partial]
node scripts/verify-programmes.mjs --db [--db-name teacher_saas] --docKey <k>
node scripts/verify-programmes.mjs --compare <seed>.jsonl <l2>.jsonl
```

Exit 0 = every assertion green; exit 1 = any red; each assertion reported individually.

**Layer-1 assertions (SEED §3.3) — full mode, per document:**

```
A1  Σ units.hours  == totals.hours
A2  Σ units.weeks  == totals.weeks == 27
A3  totals.hours   == weeklyHours × 27        ← catches every §2.1 brief error
A4  ∀ week: Σ rows.hours == weeklyHours
A5  weeks are exactly 1..27, no gap, no repeat
A6  ∀ w: w.unitId ∈ units.id ∪ {null}   ∧   ∀ u: ∃ w with w.unitId == u.id
A7  structural: every row's emphasis in enum · every week's source.pdfPages non-empty ·
    emphasis guards (added-2022 ⇒ legend present; red-unlegended ⇒ legend null)
```

`--db` mode additionally recomputes `contentHash` and compares to the stored value.

**`--partial` mode (the pass-boundary gate):** A4, A6-left, A7 on the weeks present;
weeks contiguous `1..k`; then prints the **resume state**:

```
resume: next week k+1 · last pdfPage seen P · open unit uNN (M of its
        units.weeks consumed) · units not yet started: …
```

**`--compare` mode (layer 2's executable oracle):** field-by-field diff of the seed against
an independent `l2` read, on the comparable subset ONLY (below). Prints one line per
discrepancy (`week N · field · seed says X · page says Y`); exit 1 if any.

## The transcription pass protocol (binds be-4, be-6…be-9)

Running state between passes is **derived, never remembered** — that is the whole design:

1. **Pass 0 (per document):** cover + مقدمة + مذكرة منهجية + ملامح التخرج + الكفاءات
   المستهدفة + the **summary table** → the single `programme` line. Gate: A1–A3 already
   computable from this one line and must be green before any week is transcribed. (This is
   what caught 181/189.)
2. **Week passes, 6–8 pdf pages each:** append `week` lines **in order**. A pass may only
   commit **closed** weeks — `Σ rows.hours == weeklyHours`. A week left open at the pass's
   last page is NOT written; the next pass re-renders and re-reads its page(s) from the top
   of that week. Re-reading one page is cheap; a half-remembered week is not recoverable.
3. **After every pass:** `verify-programmes.mjs --file … --partial` must be green. Its
   printed resume state — next week, open unit and its consumed weeks (from the pass-0
   units table vs the weeks so far), last pdf page — is the ENTIRE hand-off. No pass may
   rely on anything not derivable from the JSONL file itself.
4. **Rotated/merged محور cells spanning a pass boundary** are resolved from the units
   table's expected `weeks` per unit + the resume state, then confirmed against the page —
   never from memory of the previous pass.
5. Dense pages: re-render at 300 dpi and crop (`pdftoppm -r 300 -f <p> -l <p> -png …`),
   per SEED §6.6 escalation.

## The layer-2 protocol (binds be-5, be-10)

Layer 1 catches **no attribution or emphasis error** (SEED §3.3) — merged cells make row
correspondence a judgement call, and a paragraph on the wrong competency passes every
arithmetic check. So:

- The L2 reader gets **only** the PNGs and the extraction checklist — never the seed JSONL,
  never the transcription sub-issue's journal. Mechanically: a fresh subagent per pass whose
  prompt contains PNG paths + the `l2-week` shape and nothing else.
- It emits `features/programme-corpus/verification/<docKey>.l2.jsonl`, one line per week:

```jsonc
{ "type": "l2-week", "week": 3, "weekNumberPrinted": 3, "unitLabelSeen": "…", "pdfPages": [6,7],
  "rowCount": 4, "rowHours": [2,2,1,2], "rowEmphasis": ["normal","normal","normal","normal"],
  "anchors": [ { "competenciesFirst": "first ~6 words of the cell", "contentsFirst": "…",
                 "guidanceFirst": "…" } ] }
```

- **Comparable subset** (what `--compare` diffs): week/weekNumberPrinted · unit label ↔ the
  seed's unitId's `nameText` · rowCount · per-row hours · per-row emphasis · per-cell first-words
  anchors (attribution boundaries — WHICH paragraph sits against WHICH hours/competency).
  Full-text equality is deliberately not compared: two independent verbatim reads of dense
  Arabic will differ in whitespace without either being wrong; anchors + structure catch the
  attribution drift that matters.
- Every discrepancy is **dispositioned** in `<docKey>.l2-report.md`: either fixed in the
  seed (reload via `--correct` once the doc is loaded, ordinary git diff either way) or
  recorded as `seed-correct` with the page evidence. Zero undispositioned discrepancies is
  the exit condition.

## Error contract

| exit | meaning |
|---|---|
| loader 1 | seed file invalid — fix the file |
| loader 2 | hand-edited DB — the file is right; reload after investigating |
| loader 3 | content changed without `--correct` — a correction needs its audit trail |
| verifier 1 | an assertion failed — the page needs a closer read |

## Backward-compat

Everything here is **new and additive**: two new collections, two new scripts, one new
store module, one new data dir. No existing collection, route, skill, or file is read or
written. The frozen list (SEED §6.1) is absolute: `agent/curriculum/3as-mathematiques.md`
and its four reader skills · `teacher-fe/src/lib/taxonomy.ts` · `/api/generate` ·
`subjects` / `teachers` / `exercise_revisions` / `solutions` ·
`docs/reference/curriculum/*.pdf` (read-only archive — `git status` there stays empty).
