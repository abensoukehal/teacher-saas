# Brief — J1 · the programme corpus

> **This is a starting claim, not a fact.** DISCOVERY's first duty is to falsify it against the
> real system. Every previous job's brief was wrong about something load-bearing — including
> the first version of this one, which quoted an hours figure that text extraction had
> corrupted.

The product is repositioning from an exam generator to the teacher's prep companion, built on
the official programme, serving **all six 3AS streams** (brief §2, §6f). This job builds the
foundation everything else stands on.

## 1 · The source — already obtained and archived

`project/docs/reference/curriculum/`, five official **التدرجات السنوية**
(وزارة التربية الوطنية · المفتشية العامة للتربية الوطنية · سبتمبر 2022 — verified current,
brief §6d):

| document | stream(s) | pages |
|---|---|---|
| `tadarroj-3as-math-2022.pdf` | شعبة الرياضيات | 19 |
| `tadarroj-3as-techmath-2022.pdf` | تقني رياضي | 19 |
| `tadarroj-3as-sciences-2022.pdf` | علوم تجريبية | 17 |
| `tadarroj-3as-gestion-2022.pdf` | تسيير واقتصاد | 10 |
| `tadarroj-3as-lettres-2022.pdf` | آداب وفلسفة **+** لغات أجنبية | 8 |

**73 pages, 6 streams.** Every document: cover (authority · مادة · مستوى · شعبة · date) →
مقدمة → الكفاءات المستهدفة (grouped by domain) → summary table (المحور · عدد الأسابيع ·
الحجم الساعي, grouped by الفصول) → the main table, one row per week:

`الأسبوع · المحور · الكفاءات المستهدفة · المحتويات المعرفية · السير المنهجي لتدرج التعلمات · الحجم الساعي`

> ⚠ The `.txt` files beside the PDFs are **text extraction and are not to be trusted** — see §2.
> They are kept only as a search aid.

## 2 · The method — deep OCR, page by page. Not text extraction.

**Text extraction is rejected on evidence.** `pdftotext` reported شعبة الرياضيات's annual total
as **181 ساعة**. The rendered page reads **189**, and the column sums confirm it
(7+14+14+7+14+14+7+21+21+14+7+21+21+7 = 189 over 27 weeks). That wrong figure was published in
the product brief and in `project/CLAUDE.md` before anyone looked at the page.

- **`pdftoppm` → PNG, read page by page.** Renders clean and correctly ordered. Reading the PDF
  directly comes out letter-reversed — verified, do not use it.
- **Arabic prose VERBATIM.** Never paraphrased, reordered or summarised.
- **Mathematics as LaTeX** in `$…$` — what the product already renders through KaTeX, so the
  corpus is directly usable. Converting `f ( x) � k` to `$f(x) = k$` recovers what the page
  says; rewriting a sentence does not, and remains forbidden.
- **Every summary table has a total — check the arithmetic.** It is a free correctness oracle
  and it is what caught the 181/189 error. A total that does not sum means the page needs a
  closer read.
- **Only علوم تجريبية's figure is independently verified** (135 = 5 h × 27 weeks). Every other
  number in brief §6b came from text extraction and is **untrusted until re-read from a PNG** —
  including the hours, the unit counts, and the per-stream unit tables.

## 3 · Storage — structured, and the skills stop reading files

**Today** four skills read `curriculum/` off disk at generation time — `exam-subject`,
`refine-exercise`, `solution-one`, `solution-sheet` — because the CLI is a subprocess with
`<repo>/agent` as cwd. `teacher-fe/src/lib/taxonomy.ts` separately hardcodes
`STREAM = "شعبة الرياضيات"` and eight topics.

**Target: the corpus is a structured store in MongoDB** (decided 2026-08-10 — the open
question in §6 is closed; do not re-litigate it).

**The consumers are OUT of this job.** Injection into the skills — `be` querying the corpus and
passing a scoped slice into the prompt — remains the intended design (brief §6f), but it is
**deferred**. The four skills keep reading their existing `curriculum/` file exactly as they do
today; **that path is untouched by this job.**

**One real cost of choosing Mongo, to be answered rather than ignored:** a 73-page manual
transcription lands as database writes with no diff. Versioned files would have been reviewable
and correctable-with-history for free. DISCOVERY must propose how a reviewer checks a page
against its transcription, and how a correction six months from now is visible rather than
silent.

Shape (brief §F.2), one record per stream:

```
programme
  stream · level              (the lettres document covers TWO streams)
  source   { authority, title, date: "2022-09", file, page }   ← provenance, always
  competencies [ { domain, statements[] } ]     ← الكفاءات المستهدفة (stream level)
  totals   { weeks, hours }                     ← and they MUST sum from the units
  units    [ { id, name, weeks, hours, trimester } ]
  weeks    [ { week, unitId, competencies[], contents[], guidance[], hours } ]
                                                  ↑ guidance is where a course layer
                                                    attaches later — leave room, build nothing
```

**Cost discipline binds.** `agent/CLAUDE.md`: context is charged on every invocation and refine
is the most-repeated action. The current curriculum file is 5,189 bytes; the maths programme is
~113k characters of extracted text. **The injected slice must be scoped — never the whole
programme.**

## 4 · The gap this closes for existing teachers

The product's eight-topic list is missing roughly a quarter of the teaching year for
شعبة الرياضيات — the one stream it serves today:

| missing | official weight |
|---|---|
| **الدوال الأصلية والحساب التكاملي** | 3 أسابيع · 21 ساعة |
| **الأعداد والحساب** | 3 أسابيع · 21 ساعة |
| **التحويلات النقطية** | inside a 3-week unit with الأعداد المركبة |

Two mismatches to design around, not paper over: the product's topic *cuts* differ from the
programme's, and **the taxonomy is no longer one global list** — الأعداد والحساب exists for two
streams and not a third; التحويلات النقطية is bundled in two and standalone in another.

## 5 · Scope

**J1 is exactly one thing: read the 73 pages properly and land them in Mongo as a faithful,
verifiable, structured corpus.** No consumer, no rewiring, no product surface. Its correctness
is the whole deliverable — it either transcribed the programme faithfully or it did not.

**In:** the Mongo collection and its schema · deep-OCR transcription of all five documents,
**شعبة الرياضيات end to end FIRST and checked with the user before the other four** (a method
proof, not a scope limit — it is the hardest document) · a verification pass **separate from
the transcription pass that does not trust it** · a way for a human to review a page against
its transcription.

**Out — all deferred, none cancelled:**
- **Exam-side enhancement** (deferred 2026-08-10): injecting curriculum into the skills, and
  the missing units (الحساب التكاملي · الأعداد والحساب · التحويلات النقطية). The skills keep
  reading their current file; `taxonomy.ts` is not touched.
- **The course layer** (brief §6f) — leave room in the schema, build nothing.
- التوزيع السنوي / calendar (J6) · teacher profile and stream selector (J2) · progress
  tracking (J3) · levels other than 3AS · subjects other than maths.

## 6 · Open questions for DISCOVERY — do not assume answers

- **How many pages can be transcribed reliably per pass, and what does failure look like on a
  dense page?** Decides whether 73 pages is one job or must be split.
- **Do all five documents really share one schema?** The literary one is 8 pages / 4 units; the
  management one has no الأعداد المركبة and no هندسة. **A single counter-example matters more
  than four confirmations.**
- **What is the smallest independently verifiable unit** — a week, a محور, a page?
- **What is the Mongo schema?** The collection shape, and the indexes the known queries need —
  "the units for stream X", "week N of stream X", and the tracker's future
  "which units do weeks 1..N cover". How is a document's identity and version keyed, given the
  ministry revises these?
- **How does a human review a transcription against the page?** The reviewability cost of
  choosing Mongo (§3). Not solved perfectly, but not ignored.

## 7 · Constraints

**Arabic only, RTL** · **maths via KaTeX** · **LaTeX never visible to a teacher** — the corpus
stores LaTeX, the teacher never sees it · **inside the official curriculum** — this job is that
constraint's foundation · **don't over-engineer**.

Plus: never call a real generation from a test (~110 s and real quota — record and replay) ·
`/api/generate` is frozen · suites take their lane from `CHAR_BE_URL`/`CHAR_BE_LOG` and keep
fixtures beside themselves · where a behaviour can race or repeat, write the concurrency clause
from the start.
