# SEED — programme-corpus

**Job kind:** feature · **Iteration:** 01-initial · **Locked:** 2026-08-10

## 1 · The problem, stated precisely

The product claims to generate exams "inside the official Algerian curriculum" — a hard
constraint where a violation is a correctness bug, not a style issue. What actually grounds
that claim today is `teacher-be/agent/curriculum/3as-mathematiques.md`: **5,189 bytes,
hand-written, one stream, and explicitly marked ✎ inference rather than transcription.**

The real programme is five ministry documents, 73 pages, covering six streams. They are
archived at `project/docs/reference/curriculum/` and nothing in the product can read them.

**This job reads those 73 pages properly and lands them in MongoDB as a faithful, verifiable,
structured corpus.** Nothing else. No consumer, no rewiring, no product surface.

That narrowness is deliberate: the corpus's correctness *is* the deliverable. It either
transcribed the programme faithfully or it did not, and nothing else is entangled with the
question.

## 2 · What DISCOVERY established

### 2.1 · Text extraction is disqualified — three published figures were wrong

`pdftotext` corrupted numbers that were then published in the product brief and in
`project/CLAUDE.md`:

| stream | true (read from page) | text extraction said |
|---|---|---|
| شعبة الرياضيات | **189** | ~~181~~ |
| تقني رياضي | 162 | 162 ✓ |
| علوم تجريبية | 135 | 135 ✓ |
| تسيير واقتصاد | **108** | ~~128~~ |
| آداب وفلسفة + لغات أجنبية | **54** | ~~44~~ |

**Each error was off by exactly one digit** — 181/189, 128/108, 44/54 — the shape that reads as
plausible and survives review.

**The oracle that catches all three: every total is exactly `weeklyHours × 27`.**
189=7×27 · 162=6×27 · 135=5×27 · 108=4×27 · 54=2×27. None of 181/27, 128/27, 44/27 is an
integer.

### 2.2 · The method, proven on the hardest document

`pdftoppm -r 150 -png` renders all 19 maths pages in 4.5 s, clean and correctly ordered.
Reading the PDF directly is letter-reversed — verified, unusable. Dense mathematics needs a
300 dpi re-render and crop.

**Sample transcription:** `transcription-sample.md` (this iteration) — three pages, Arabic
verbatim, maths as KaTeX-safe LaTeX. Every week's hours sum to 7. The source uses `\mapsto`,
`\dfrac`, `\sqrt`, `\circ`, `\Delta`, Greek — nothing exotic.

**Cost:** ~8–12 k tokens per dense page, ~2 k front matter. **6–8 pages per pass →
73 pages is 11–13 passes**, each handing off running state.

### 2.3 · The five documents do NOT share one schema

The brief assumed they did. False, in ways that change the data model:

| | math | techmath | sciences | gestion | lettres |
|---|---|---|---|---|---|
| الكفاءات المستهدفة | ✓ 6 domains | ✓ 6 | ✓ **5** | **absent** | **absent** |
| ملامح التخرج | ✓ | ✓ | ✓ | ✓ | **absent** |
| مذكرة منهجية | ✓ | ✓ | ✓ | ✓ | ✓ |

1. **competencies must be NULLABLE** — absent ≠ empty.
2. **Domain sets are per-document data, never an enum** — علوم تجريبية drops الحساب entirely.
3. **`trimester` has NO SOURCE and is dropped.** `الفصول` is one merged cell spanning every
   row; there is no grouping in any document. Inferring it from معالجة positions would be
   invention.
4. **Weeks are not integers** — `أسبوع ونصف`, `أسبوعان ونصف`, `3 أسابيع ونصف`.
5. **Units repeat and are non-contiguous** — علوم تجريبية lists المتتاليات العددية twice;
   lettres splits الحساب / الحساب تابع. **`unitId` must be assigned, never derived** from name
   or position.
6. **Column headers differ** — lettres heads its weeks column `الحجم الأسبوعي`; gestion drops
   the hamza. Store verbatim, never normalise.
7. **A محور label in the main table can differ from the summary's unit name.**
8. **`مذكرة منهجية` exists in all five** and was in no prior reading.

### 2.4 · ⚠ Red text is semantic — the finding that most shapes the schema

تسيير واقتصاد and آداب وفلسفة carry an on-page legend:
**«تم إدراج العناصر الملونة بالأحمر لعدم تناولها في السنة الدراسية 2021-2022»** — post-COVID
catch-up content, red because it was *not covered* the previous year.

**The mathematics document also contains red blocks (PDF p19) with no legend on that page.**

A plain-text transcription destroys this silently. **`emphasis` is a required field on every
row** — the loader rejects a row without it, so a forgotten colour is a hard error rather than
a silent loss. The maths document's unlegended red must have its meaning **found or its absence
recorded — never guessed.**

### 2.5 · The week is the smallest independently verifiable unit

Not the page: PDF p11 has two rows and no week number; weeks 3 and 9 straddle page breaks. Not
the محور: up to 3 weeks over 4 pages.

**The week wins because it has a built-in oracle** — its rows' hours must sum to the stream's
constant weekly hours. A verifier holds one week's record against its page(s) and checks
arithmetic, not just prose.

**Consequence:** a week is not page-local, so every week record **must** store
`source.pdfPages`. Without it the verifier cannot find the page and the unit stops being
verifiable.

## 3 · Direction

### 3.1 · Storage — MongoDB, seeded from versioned JSONL

```
programmes                    ← one document per source PDF, weeks nested
  docKey        "tadarroj-3as-math"      ← stable across editions
  edition       "2022-09"                ← THE MINISTRY'S version
  current       bool                     ← exactly one true per docKey
  streams       [string]                 ← lettres holds TWO
  level         string
  source        { authority, title, file, pages, renderedAt }
  weeklyHours   7|6|5|4|2                ← the per-week oracle
  totals        { weeks: 27, hours, weeksText, hoursText }
  frontMatter   { intro, methodNote, graduateProfile }   ← each string|null, VERBATIM
  competencies  [ { domain, statements[] } ] | null      ← NULL for gestion/lettres
  units         [ { id, name, nameText, weeks, weeksText, hours, hoursText, sourcePdfPage } ]
  weeks         [ { week, weekNumberPrinted, unitId|null, hours,
                    source: { pdfPages[], docPages[] },
                    rows: [ { competencies[], contents[], guidance[], hours,
                              emphasis: "normal"|"added-2022" } ] } ]
  transcriptionRev int        ← OUR version, bumped on every correction
  contentHash      string     ← the loader's guard against hand-edits
```

**Two version axes on purpose.** `edition` is the ministry revising the programme;
`transcriptionRev` is us fixing our own reading of an unchanged page. Collapsing them would
make "the syllabus changed" indistinguishable from "we misread a number" — the exact confusion
that put 181, 128 and 44 into the brief.

**Indexes:** `{docKey, edition}` unique (a double-load becomes unrepresentable) ·
`{streams, current}` · `{docKey, current}` partial on `current: true`.

**Deviation from the brief's §F.2, deliberate:** it said one record per stream, which would
duplicate the lettres document into two records that must not drift. `streams: [...]` with a
multikey index queries identically and cannot drift.

### 3.2 · Reviewability — the real cost of choosing Mongo

Database writes have no diff. A 73-page manual transcription with no diff is unauditable.

**The seed file is the source of record; Mongo is its projection.**
Transcription lands as **committed JSONL in the project repo** — one line per week, one per
header — and an **idempotent loader is the only writer**. Diff, review, blame and correction
are ordinary git.

This does reintroduce two artifacts, which is the failure class this project keeps hitting, so
it is bounded explicitly: the relation is **build input → output**, not two hand-maintained
copies; the loader is the **only** writer; and `contentHash` makes a hand-edit in Mongo a hard
error rather than a silent overwrite. **If that guard fires, the DB is wrong and the file is
right.**

Corrections are recorded, not applied silently: `programme_revisions`, append-only, mirroring
the `exercise_revisions` pattern already in this product.

### 3.3 · Verification — two layers, and the second is not optional

**Layer 1 — arithmetic, as a script:**
```
Σ units.hours == totals.hours          Σ units.weeks == totals.weeks == 27
totals.hours == weeklyHours × 27       ← would have caught all three brief errors
∀ w: Σ w.rows.hours == weeklyHours
weeks are 1..27, no gap, no repeat
∀ w: w.unitId ∈ units.id ∪ {null}   ∧   ∀ u: ∃ w with w.unitId == u.id
```

**Layer 2 — an independent re-read of the page.** Layer 1 catches every arithmetic and
structural error and **none** of the attribution or emphasis errors. The verifier reads the PNG
independently and compares to the stored week. Budget ~11–13 passes, same as transcription.

## 4 · Scope

**In:** the `programmes` collection and schema · deep-OCR transcription of all five documents,
**شعبة الرياضيات end to end FIRST and checked with the user before the other four** · the JSONL
seed + idempotent loader · both verification layers · `programme_revisions`.

**Out — deferred, not cancelled:** exam-side enhancement (injecting curriculum into the four
skills; the missing topic units) — **the skills keep reading their current file, untouched, and
`taxonomy.ts` is not modified** · the course layer (leave room via `guidance`, build nothing) ·
التوزيع السنوي / calendar · teacher profile and stream selector · progress tracking · levels
other than 3AS · subjects other than maths.

## 5 · Risks

**The biggest, and it has no arithmetic defence: silent attribution drift.** Merged cells make
row correspondence a judgement call on nearly every dense page — on maths p7 one `الحجم الساعي`
of 3 spans two `السير` paragraphs and three `كفاءات` lines. A paragraph attached to the wrong
competency produces a record that passes every check, reads correctly in Arabic, and misstates
what the ministry said. Mitigation: layer-2 verification re-reads the page.

**Emphasis loss** — same class, same mitigation, plus `emphasis` being required rather than
defaulted.

**Scale fatigue** — 11–13 transcription passes plus 11–13 verification passes. Running state
between passes (last week, last محور, hours accumulated in the open week) is not recoverable
from the next page alone.

## 6 · Planning kit

**6.1 Acting-surface map**

| repo | path | role |
|---|---|---|
| be | `src/store/programmes.ts` | NEW — the collection, its indexes, the loader's write path |
| be | `src/store/client.ts` | existing Mongo connection — reuse, do not fork |
| project | `data/programmes/*.jsonl` | NEW — the seed files, the source of record |
| project | `docs/reference/curriculum/*.pdf` | **READ-ONLY archive.** Never modified |
| be | `scripts/load-programmes.mjs` | NEW — the idempotent loader, the only writer |
| be | `scripts/verify-programmes.mjs` | NEW — layer-1 arithmetic gate |

**Frozen:** `agent/curriculum/3as-mathematiques.md` and every skill that reads it ·
`teacher-fe/src/lib/taxonomy.ts` · `/api/generate` · every existing collection.

**6.2 Baseline recordings** — `transcription-sample.md` (3 pages, verbatim) · the corrected
five-stream totals in §2.1 · rendered PNGs at
`/private/tmp/claude-501/…/f58aeed8…/scratchpad/png/` (80 files).
Re-run: `pdftoppm -r 150 -png <pdf> <outstem>`.

**6.3 Perimeter consumers** — **none.** This job has no reader. That is the point: nothing can
regress because nothing consumes it yet. The promoted nets (`project/tests/be` 364,
`project/tests/fe` 313) must stay green, which they will if the frozen list holds.

**6.4 E2E trace** — `JSONL in git → load-programmes.mjs → programmes collection →
verify-programmes.mjs → green`. No HTTP path, no UI, no skill.

**6.5 Obs baseline** — the loader reports rows written and rejected; the verifier reports each
assertion. Neither touches `run-log.jsonl`, and neither may carry teacher content.

**6.6 Dispositioned unknowns**

| unknown | disposition |
|---|---|
| the maths document's unlegended red text | **MUST resolve before transcribing p19** — find the legend or record its absence. Never guess |
| running state between passes | **PLANNING decides** the hand-off shape |
| whether 300 dpi suffices for every dense page | **known-good for the sample**; escalate per page as needed |
| `nameText`/`weeksText`/`hoursText` verbatim duplicates | **IN** — `ساعتان` and `2` are the same value in two representations; keep both |

**6.7 Sweep statement**

Evidence covers: all five summary tables re-read from PNGs and re-summed; three pages of the
maths main table transcribed; the section inventory of all five documents; the red-text legend
in two of five.

**Not covered** — freeze boundaries must be tight and no oracle may assume otherwise: the other
16 maths pages, and the main tables of all four remaining documents, are **unread**. The
schema's fitness beyond شعبة الرياضيات is inferred from summary tables and section inventories,
not from their main tables. **That is exactly why شعبة الرياضيات goes first and is checked
before the rest.**
