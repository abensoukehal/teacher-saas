---
kind: module
id: mod-be-programme-corpus
title: "Programme corpus"
plane: implementation
part_of: svc-teacher-be
repos: [teacher-be@65603d6]
source: [teacher-be/src/store/programmes.ts]
status: fresh
last_verified: 2026-08-11
tags: [backend, mongodb, programme, corpus]
---

# Programme corpus

> The ministry's التدرجات السنوية, transcribed. One document per source PDF, and the
> transcription — not the database — is the trust root.

## Shape

```
programmes
  docKey            string   ← "tadarroj-3as-math" — stable across editions
  edition           string   ← "2022-09" — THE MINISTRY'S version
  current           bool     ← exactly one true per docKey, from the greatest edition
  streams           [string] ← multikey; the lettres document carries TWO streams
  weeklyHours       7|6|5|4|2
  totals            { weeks: 27, hours }        ← totals.hours == weeklyHours × 27, always
  competencies      [ {domain, statements[]} ] | null   ← NULL for gestion/lettres
  units             [ { id, name, weeks, hours } ]      ← from the SUMMARY table
  weeks             [ { week, unitId, hours, source: {pdfPages[]},
                        rows: [ {competencies[], contents[], guidance[], hours, emphasis} ] } ]
  transcriptionRev  int      ← OUR version — a correction to our own reading
  contentHash       string   ← the loader's guard against a hand-edit in Mongo

indexes: { docKey: 1, edition: 1 } unique · { streams: 1, current: 1 }
       · { docKey: 1, current: 1 } partial

programme_revisions   ← append-only, mirroring exercise_revisions
```

**As it stands: 5 documents · 6 streams · 135 weeks · 379 rows · 648 hours.** Row counts per
document are 103 / 97 / 81 / 59 / 39.

## The two readers

`getProgramme(db, docKey)` and **`getProgrammeForStream(db, stream)`** — a plain
`findOne({streams, current: true})` over the `{streams: 1, current: 1}` index. The second is
what validates a stream at class creation, bounds a week at write time, and now resolves a
class to the document [[cmp-be-programme-api]] serves. Six streams resolve onto five
documents.

Neither reader validates. `contentHash` is checked by `scripts/verify-programmes.mjs`, never
by the service — which is why a suite can insert a synthetic document straight into Mongo to
vary a number the loader would refuse (see below).

## The wire projection

`toProgrammeRecord(doc)` — added by this slice, appended after the readers, touching no
existing function. **A field-explicit whitelist built key by key**, the `toRecord` discipline
`store/subjects.ts` already follows: a spread would make the wire shape a function of
whatever the loader happened to write, so a new stored field would ship itself.

Eight keys out: `docKey · edition · weeklyHours · totals{weeks,hours} ·
source{authority,title} · emphasisLegend{text,pdfPage}|null · units[{id,name}] ·
weeks[{week,unitId,hours,pdfPages,rows[]}]`, each row `{competencies, contents, guidance,
hours, emphasis}`.

**Three of the exclusions are correctness, not byte savings:**

1. **`units[].weeks` and `units[].hours` are deliberately NOT sent.** They are the summary
   table's numbers and they disagree with the week rows. Sizing bar segments by the declared
   per-unit hours sums to **210 against a 189-hour total — 111%, a bar that overflows its own
   track** — because a unit id can be split across two non-contiguous runs. Withholding them
   makes the correct computation (run-summed `weeks[].hours`) the only one a client can
   perform. Shipping them "for completeness" hands a caller a plausible wrong number.
2. **`contentHash`** hashes the *stored* document while this emits a *projection*, so a
   client validating against it would run a validator that had silently stopped validating.
3. **`transcriptionRev`** is withheld because there is one obvious thing a client would do
   with it — diff it against the class's `programmeTranscriptionRev` stamp — and that is the
   two-axes collapse the data model forbids: a typo fix in our own reading would read to a
   teacher as "the syllabus changed".

Also out: `weekNumberPrinted` (equal to `week` in all 135 rows — it records a disagreement
that does not exist), `nameText`/`weeksText`/`hoursText` (PDF tatweel and label strings for
numbers already carried), `source.file/pages/renderedAt` and `weeks[].source.docPages` (our
plumbing, not their print), document-level `competencies`, `frontMatter`, and the storage
bookkeeping.

`competencies` on a row is **in**, over the original recommendation to drop it for ~19% of
the payload: it is the densest field in the corpus — 76 of 103 maths rows, against contents'
63 and guidance's 55 — and real week 20 has a competency on all seven rows and contents on
three. Excluding it renders four of seven ministry rows blank. The real cost measured after
the fact was **+28%**, not 19%.

`emphasisLegend` is null-preserving and the key is always present. The legend is the only
legal caption for an `emphasis` tag, so a document without one has to say so rather than
leave a client inventing wording for the ministry's red text.

## Things that must not be undone

1. **The corpus is versioned as TEXT and the database is its projection.** The transcription
   lives in `data/programmes/*.jsonl`; `scripts/load-programmes.mjs` is the only writer. A
   hand-edit in Mongo is refused, not overwritten — if `contentHash` fires, the database is
   wrong and the file is right.
2. **Two version axes, never collapsed.** `edition` is the ministry revising the programme;
   `transcriptionRev` is us fixing our own reading of an unchanged page. A new edition is a
   new document and must be asked for explicitly; a correction can never move a document
   between editions.
3. **A verifier green is not page fidelity.** A1–A8 certify that the corpus is
   arithmetically and structurally consistent and untampered relative to its own loader.
   They certify nothing about whether an Arabic string matches the printed page. That rests
   on a human re-read and on sampling.
4. **`WEEKS_PER_YEAR = 27` and the seed validator are frozen** and correct. A promoted suite
   gates them. It also means a programme with a different ceiling **cannot be made through
   the loader** — which is why the suite that proves the week bound is the class's own
   document inserts a synthetic 30-week programme directly into Mongo, on a stream value no
   real document carries, and deletes it in `afterAll`.
5. **Nothing in this stack alters a ministry string.** The projection may drop a field; a
   value it carries is carried byte for byte.

## The editorial restoration — 2026-08-11

**`\square` was a placeholder for double-struck set symbols the source PDFs fail to embed.**
Not a misreading: `pdftotext` on the ministry's own page finds **no character at all** where
ℤ should be, because the documents embed `Cambria`, `Calibri`, `Symbol`, `Arial`, `Arabic`
and `Wingdings` and no math font — while every other formula on the same page
(`PGCD(a;b)`, `a = bq + r`, `0 ≤ r ≤ b`) extracts cleanly. Whoever transcribed it wrote a box
because a box is what the page shows, and every reader sees one.

**61 occurrences across 48 strings in three documents were restored** through the loader with
`--correct`: `transcriptionRev` 4→5 · 3→4 · 4→5, `edition` untouched at `2022-09` on all
five, `programme_revisions` 9 → 12, A1–A8 green on each. Zero `\square` remain corpus-wide.

This is an **editorial restoration, the corpus's first** — and the only thing that makes it
defensible is that the mathematics determines each symbol uniquely: Euclidean division and
congruence are ℤ; a quadratic with real coefficients being solved inside الأعداد المركبة is
ℂ; a swept angle is ℝ. The applier was keyed on the exact surrounding fragment with an
expected count per rule and a hard abort on any unmatched string — 61 of 61 matched.

It was not safe to batch-replace, and the reason is worth keeping: **the same decoration
means ℝ*₊ in week 8 and ℤ*₊ in week 15.**

These 61 are now *our* symbols in a corpus whose whole point is that it is the ministry's.
If a human ever reads the printed pages, these are the strings to read first — together with
one still open: week 15's division theorem quantifies over `a` twice
(«من أجل $a \in \mathbb{Z}$ و $a \in \mathbb{Z}_{+}^{*}$ … حيث $a = bq + r$») where the
second variable is almost certainly `b`. **That is a different class of defect and must not
be fixed the same way.** A restored glyph reproduces what the page means to show; a wrong
*letter* may be what the ministry actually printed, and verbatim then means keeping it. Only
the page can say.

## Components
- [[cmp-be-programme-api]] — the one read route over this module

## Features it serves
- [[feat-programme-surface]] — the corpus on screen
- [[feat-classes-progress]] — a class's stream is validated here, and its week bounded here

## Related
- [[mod-be-progress-store]] · [[mod-be-class-store]] · [[svc-teacher-be]]
