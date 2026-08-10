# Brief — J1 · the programme corpus

> **This is a starting claim, not a spec.** DISCOVERY's first duty is to falsify it against
> the real system. Every previous job's brief was wrong about something load-bearing.

The product is repositioning from an exam generator to the teacher's prep companion, built on
the official programme (brief §2). **This job is the foundation the rest stands on**: the
ministry's التدرجات السنوية, stored so the product can reason about them.

It also delivers the only thing on the shelf that fixes something for teachers we already
have — see §3.

## 1 · What exists today

**The corpus is already obtained and archived** at `project/docs/reference/curriculum/`:

| document | stream(s) | hours/yr | units | pages |
|---|---|---|---|---|
| `tadarroj-3as-math-2022.pdf` | رياضيات | 181 | 11 | 19 |
| `tadarroj-3as-techmath-2022.pdf` | تقني رياضي | 162 | 11 | 19 |
| `tadarroj-3as-sciences-2022.pdf` | علوم تجريبية | 135 | 11 | 17 |
| `tadarroj-3as-gestion-2022.pdf` | تسيير واقتصاد | 128 | 9 | 10 |
| `tadarroj-3as-lettres-2022.pdf` | آداب وفلسفة **+** لغات أجنبية | 44 | 4 | 8 |

Extracted `.txt` sits beside each. **September 2022 is verified current** — no newer ministry
progression exists (brief §6d).

Every document has the same shape: cover (authority chain · مادة · مستوى · شعبة · date) →
مقدمة → الكفاءات المستهدفة في شعبة X (grouped by domain) → summary table (المحور · عدد الأسابيع ·
الحجم الساعي, grouped by الفصول) → **the main table, one row per week**:

`الأسبوع · المحور · الكفاءات المستهدفة · المحتويات المعرفية · السير المنهجي لتدرج التعلمات · الحجم الساعي`

**Today the product has none of this.** `teacher-be/agent/curriculum/3as-mathematiques.md` is a
hand-written ✎ file with a topic list and inferred notes, for one stream, and
`teacher-fe/src/lib/taxonomy.ts` hardcodes `STREAM = "شعبة الرياضيات"` with eight topics.

## 2 · The target shape (brief §F.2)

```
programme                       ← OFFICIAL. Immutable reference data, versioned by document.
  stream · level                  (one record per stream; lettres covers TWO streams)
  source        { authority, title, date: "2022-09", file }   ← provenance, always
  competencies  [ { domain, statements[] } ]        ← الكفاءات المستهدفة (stream level)
  totals        { weeks, hours }
  units         [ { id, name, weeks, hours, trimester } ]     ← المحاور
  weeks         [ { week, unitId, competencies[], contents[], guidance[], hours } ]
```

Four rules that must not be negotiated away:

1. **Official text stored VERBATIM.** Never paraphrased, never summarised. Paraphrasing
   السير المنهجي makes us the author of the programme, silently — and not being that is the
   whole value.
2. **Anything derived is marked as derived.** Mappings onto the product's own taxonomy,
   inferred weights, trimester boundaries — useful, none of them the ministry's words. The ✎
   discipline extends here.
3. **Programme and teacher state are separate collections with separate lifetimes.** No
   `teacher_progress` in this job — but the schema must not make it awkward to add.
4. **`source` on every record.** A claim about the programme must be traceable to a page.

## 3 · The gap this closes for existing teachers

Against the official programme, the product's eight-topic list is **missing roughly a quarter
of the teaching year** for شعبة الرياضيات — the one stream it serves:

| missing | official weight |
|---|---|
| **الدوال الأصلية والحساب التكاملي** | 3 أسابيع · 21 ساعة |
| **الأعداد والحساب** | 3 أسابيع · 21 ساعة |
| **التحويلات النقطية** | inside a 3-week unit with الأعداد المركبة |

**6 of 27 teaching weeks a teacher cannot ask for**, plus part of a seventh.

Two mismatches to design around rather than paper over:
- **Granularity.** The product splits «الدوال العددية والنهايات» from «الاشتقاق ودراسة الدوال»;
  the programme splits الاشتقاقية والاستمرارية / النهايات / التزايد المقارن. The product's names
  are the teacher-facing taxonomy and need not match word for word — they must **cover** the
  programme.
- **The taxonomy is no longer one global list.** الأعداد والحساب exists for two streams and not
  the third; التحويلات النقطية is bundled in two and standalone in the third.

## 4 · Scope

**In:**
- The `programme` schema and its storage
- Transcription of all five **تدرجات** — **شعبة الرياضيات end to end FIRST**, verified, and
  shown to the user before the other four are touched
- **A verification pass separate from the transcription pass, which does not trust it**
- The missing units added to the product's topic list for شعبة الرياضيات
- `exam-subject` grounds in the corpus instead of the hand-written file

**Out:**
- **التوزيع السنوي / the calendar** — deferred to J6 by decision (§6d). Different source,
  different authority, different lifecycle.
- Teacher profile, stream selector (J2) · progress tracking (J3) · any new UI beyond the topic list
- Levels other than 3AS; subjects other than maths

## 5 · Open questions for DISCOVERY — do not assume answers

- **Where does the corpus live — files in the repo, or MongoDB?** The existing curriculum file
  is read from disk by the CLI at generation time (`config.cwd` → `<repo>/agent`). A database
  record is not reachable that way without a change. **Verify how the skill actually reads it
  before choosing.**
- **Does `exam-subject` need the whole programme, or a per-stream slice?** Its prompt budget
  matters — the maths document is 113k characters and a skill reading all of it every run
  would be absurd.
- **What is the unit of transcription that can be verified?** Per week? Per unit? A verifier
  must be able to hold the claim and the page side by side.
- **Do the five documents really share one schema?** The literary document is 8 pages and 4
  units; the management one has no الأعداد المركبة and no هندسة. **Check before generalising
  from the maths document.**
- **How should the product's topic list relate to the programme's محاور?** Same list, a
  mapping, or the programme's names verbatim? This decides whether the dropdown changes for
  existing teachers.

## 6 · Constraints

From `project/CLAUDE.md` → Hard constraints, all binding:

- **Arabic only, RTL throughout** · **LaTeX never visible** · **inside the official curriculum**
  — this job *is* that constraint's foundation · **don't over-engineer**

Plus:

- **The extraction is a transcription job, not a parsing job.** Digits reverse (`2022`→`2222`),
  ligatures drop characters (`الحجم`→`الح�م`), and the six-column table interleaves so a row's
  cells are not adjacent in the text stream. A regex pass will produce confident garbage. Read
  with judgement, then verify against the PDF.
- **Never call a real generation from a test** — ~110 s and real quota. Record and replay.
- `/api/generate` is frozen; `POST /api/exams` is the progressive path.
- Suites take their lane from `CHAR_BE_URL`/`CHAR_BE_LOG` and keep fixtures beside themselves.
- Where a behaviour can race or repeat, write the concurrency clause from the start.
