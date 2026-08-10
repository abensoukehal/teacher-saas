# be-9 — transcribe آداب وفلسفة + لغات أجنبية (`tadarroj-3as-lettres`, 2022-09)

**Transcriber:** be stack agent (Opus 5), 2026-08-10.
**Source:** `project/docs/reference/curriculum/tadarroj-3as-lettres-2022.pdf`, 8 pages.
**Method:** `pdftoppm -r 150 -png` for the reading pass; 300 dpi for every cell whose text
I would otherwise be guessing; 450 dpi for the summary table; 600 dpi for the legend, the
`بـِ` diacritic and the recurring `معرّفة` shadda. Cell-merge extents were **not** read by
eye — I scanned each column for horizontal rules with a pixel test (`dark fraction > 0.85`
across the column's x-range) and compared the rule sets column by column. That is what
found the two merged السير cells that a visual read gets wrong (below).
**Budget:** 2 passes, as planned. Pass 0 = pdf 1–4 (front matter + summary table);
pass 1 = pdf 5–8 (all 27 weeks). One commit each.

## Result

`data/programmes/tadarroj-3as-lettres.jsonl` — 28 lines, 27 weeks, 39 rows, 0 rejected.
Loaded into `teacher_saas` at `transcriptionRev 1`, `contentHash 545faf060784…`.

| oracle | result |
|---|---|
| `verify --file` A1–A7 | **green** — `{27, 54}`, weeklyHours 2, `54 == 2 × 27` |
| `verify --db --docKey tadarroj-3as-lettres` A1–A8 | **green** (A8 contentHash matches) |
| loader | `inserted` 27/39/0, then `unchanged` on a re-run — idempotent |
| `grep -c trimester` | 0 |
| every row carries `emphasis` | 39/39 |
| frozen paths (`docs/reference/curriculum/`, `stacks/`) | `git status` empty |

Weeks per unit came out exactly equal to the summary table's own `weeks` column for all
ten units (u01 1 · u02 7 · u03 2 · u04 1 · u05 2 · u06 7 · u07 1 · u08 1 · u09 4 · u10 1).
A6 only checks that the reference sets close; this stronger equality is the real evidence
that the week→محور assignment is right, and it is worth re-checking in be-10.

## The three things this document was chosen to stress — all three worked unchanged

**1 · Two streams, one record.** `streams: ["آداب وفلسفة", "لغات أجنبية"]`. The cover reads
`شعبتا : آداب وفلسفة + لغات أجنبية` (dual — "the two streams"), so one record is what the
source itself describes. Live proof of the SEED §3.1 deviation:

```
db.programmes.find({streams:"آداب وفلسفة"})  -> 1 doc, _id 6a79aa2cc75c979fa284958d
db.programmes.find({streams:"لغات أجنبية"})  -> 1 doc, _id 6a79aa2cc75c979fa284958d   (same)
```

The multikey `{streams, current}` index answers both per-stream queries from the one
document. Nothing is duplicated, so nothing can drift.

**2 · `competencies: null`.** The document has no الكفاءات المستهدفة section and no
ملامح التخرج — pages are cover / مقدمة / مذكرة منهجية / summary table / four table pages,
with nothing else in between. `competencies: null` and `frontMatter.graduateProfile: null`
loaded and verified with no schema change. The store's validator distinguishes the two
cases exactly as designed: `"competencies" in line` is required (so "nobody looked" is a
reject) while the value may be `null` (so "the section does not exist" is representable).
`[]` would have been a lie and is rejected anyway (`must be null or a non-empty array`).

**3 · Different column headers, stored verbatim.** The summary table heads its weeks column
**`الحجم الأسبوعي`** and its hours column **`الحجم الساعي`** — where the maths document uses
`عدد الأسابيع`. Nothing was normalised: the cells under those headers are stored exactly as
printed, inconsistencies included (below).

> ⚠ **But the header STRINGS themselves have nowhere to live.** The contract's programme
> line has no `columnHeaders` field, and the loader rejects unknown keys, so "store the
> header verbatim" is not representable in the sealed grammar. I did **not** invent a field.
> The headers are recorded here instead: main table (pdf 5–8), right to left —
> `الأسبوع` · `المحور` · `الكفاءات المستهدفة` · `المحتويات المعرفية` ·
> `السير المنهجي لتدرج التعلمات` · `الحجم الساعي`; summary table (pdf 4), right to left —
> `المادّة: رياضيات` · `المستوى: السنة الثالثة اداب و فلسفة + لغات اجنبية` ·
> `الحجم الأسبوعي` · `الحجم الساعي`, with a single merged `الفصول` cell down the right side
> and `المجموع` on the last row. **This is a contract gap, not a transcription choice** —
> raise it if the corpus is ever expected to answer "what did this document call its
> columns?".

## The red-text legend

**Found, on pdf page 5** — the first main-table page, in the السير المنهجي cell of
**week 2's first row**, printed in **black** above that cell's red bullets:

> تم ادراج العناصر الملونة بالاحمر لعدم تناولها في السنة الدراسية 2022-2021

Recorded as `emphasisLegend {text, pdfPage: 5}` and repeated as the first `guidance`
element of week 2 row 0 — the same double-recording be-4 used for the maths document,
because the sentence really is printed inside that cell and dropping it there would make
the cell's transcription incomplete.

be-5's warning transferred exactly: **the legend is inside a guidance cell, not in a
header, a footnote or a margin.** A legend hunt that looks only at page furniture finds
nothing here.

Three details worth carrying to be-10 and to the remaining documents:

- **The wording differs from the maths document's legend.** Maths (pdf 18):
  «تم ادراج ما هو ملوّن باللون الأحمر لعدم تناوله في السنة الدراسية 2022-2021». Here:
  «تم ادراج العناصر الملونة بالاحمر لعدم تناولها…». Same meaning, different sentence —
  so a legend search must match on *meaning*, never on the maths document's string.
- **No hamzas.** The page prints `ادراج` and `بالاحمر`, not `إدراج`/`بالأحمر`. The SEED
  §2.4 quotes it with hamzas; that quote is a normalisation, and the seed keeps the page.
  Confirmed in the text layer (`باالحمر` is the extractor's lam-alef mangling of `بالاحمر`).
- **The year renders `2022-2021`**, and that is what is stored — same as be-4's maths
  legend. See "digit order" under ambiguities.

**Red sweep.** A per-page pixel scan (`r>120 ∧ r−g>60 ∧ r−b>60`) over all 8 pages found red
on **page 5 only**, in nine contiguous bands. Mapped to rows, that is exactly five rows:

| week · row | hours | red content |
|---|---|---|
| 2 · r0 | 1 | contents `توليد متتالية…` + the whole guidance cell except the black legend |
| 2 · r1 | 1 | contents `المتتاليات الحسابية…` + its guidance |
| 3 · r0 | 1 | contents `حساب مجموع الحدود الاولى من متتالية حسابية.` |
| 3 · r1 | 1 | contents `المتتاليات الهندسية…` + its guidance |
| 4 · r0 | 1 | contents `حساب مجموع الحدود الاولى من متتالية هندسية.` |

All five carry `emphasis: "added-2022"` (legal here because the document has a legend); the
other 34 rows are `normal`. Note the *hours digits* are red too in those rows, and the
bullet glyphs `●` are black while the text they introduce is red — neither changes the
row-level classification, but both are things a colour-based L2 read will see.

Week 4 row 1 is black. The red block therefore ends **mid-week**, which is the case an
"all of weeks 2–4 are red" shortcut would get wrong.

## Genuine ambiguities — all resolved from the page, all worth re-checking

**A1 · The السير cell that spans a page break (weeks 7→8).** On pdf 6 the guidance column
has **no rule** between the first and second content rows, while contents and hours both do.
So one guidance cell covers week 7's second row *and* week 8's first row. Its text (the
`v_n = u_n - \dfrac{b}{1-a}` paragraph) is attached to week 7 row 1 — the first spanned row,
be-4's convention. A reader who attaches by visual adjacency lands in the same place here;
the next one is where it matters.

**A2 · The السير cell merged over weeks 24 and 25, whose text runs onto the next page.**
Same pixel test: pdf 7 has no guidance rule at the 24/25 boundary. The cell holds three
bullets, and because week 25's row splits across the page break, **one bullet prints on
pdf 7 and two on pdf 8**. Following the first-spanned-row convention, all three are stored
on **week 24**, and week 25's `guidance` is `[]`:

1. `نعيد بعض التجارب المرجعية…` (renders on pdf 7, level with week 24)
2. `تمديد العمل المنجز خلال السنة السابقة…` (renders on pdf 8)
3. `تعطى أمثلة للسحب بإعادة وبدون إعادة.` (renders on pdf 8)

**This is the single most likely disagreement with be-10.** An independent reader will
almost certainly put bullets 2 and 3 on week 25, because that is where they sit on the page.
Both readings are defensible; the convention decides, and I followed it. Week 24's
`source.pdfPages` is `[7, 8]` for that reason — part of what it stores is only re-readable
on page 8.

**A3 · Four محور cells are simply blank**, so the unit label is unavailable exactly where a
transcriber most wants it: weeks 7–8 (page 6, continuation), weeks 12–13, week 22, and
weeks 14–15 (page 6; the label `الدوال العددية` prints on page 7 for weeks 15–20). The
assignment came from the summary table's `weeks` column walked in order, then confirmed
against the labels that *are* printed (`المتتاليات العددية` p5, `الحساب` p6,
`الدوال العددية` p7, `الإحصاء و الاحتمالات` p8) and against the week→unit totals. `unitId`
is assigned, never derived from a name — which is what makes the blank cells harmless.

**A4 · The main table's محور label ≠ the summary table's unit name.** The main table prints
`الدوال العددية`; the summary table prints `الــدوال العدديـة` (two tatweels). Also
`الإحصاء و الاحتمالات` (main, with a space around the و) vs `الإحصاء والاحتمالات`
(summary). `nameText` keeps the summary cell verbatim, so **`verify --compare` will report a
`unitLabel` discrepancy for weeks 14–20 and 23–26**. That is SEED §2.3.7 behaving as
predicted, not a defect — disposition it as `seed-correct`.

**A5 · Digit order in the legend.** The legend renders `2022-2021` (that visual order) and a
hyphen between two numbers is a bidi number-joiner, so the display order *is* the logical
order: the stored string is `…السنة الدراسية 2022-2021`. Same call be-4 made for the maths
legend, so the two documents agree. The intro's `2022 ــ 2023` is the opposite case — the
separator there is **two ARABIC TATWEELs**, not a dash, so the two numbers are separate runs
and the rendered order is reversed relative to the logical one. Both were read off the
600 dpi render; the text layer corrupts every digit to `2` and is useless for this.

**A6 · The intro's dash differs from the maths seed's.** The maths seed stores
`2022 – 2023` (en dash); this page prints `2022 ــ 2023` (tatweels — confirmed in the text
layer, where tatweels survive extraction intact). Kept verbatim rather than harmonised.

**A7 · One paragraph where the maths seed has two.** This document's مقدمة runs
`…وطرق المعالجة. وحتى تستجيب…` as a single justified paragraph; the maths seed has a line
break there. Transcribed as printed here. The rest of the مقدمة and the whole مذكرة منهجية
are word-for-word identical to the maths document (verified at 300 dpi against the stored
maths strings), which is a useful cross-check: this boilerplate is shared across the five
documents, so a divergence in it is a reading error, not a source difference.

## Source errors preserved (do not "fix" these)

The summary table is inconsistent with itself in six places, and every one is stored as
printed:

| unit | printed | the "correct" form it is not |
|---|---|---|
| u01, u08, totals | `اسبوع` / `27 اسبوع` | `أسبوع` (u04, u07, u10 spell it with the hamza) |
| u05 | `اسبوعان` | `أسبوعان` (u03 has the hamza) |
| u06, u09 | `7 أسابع` / `4 أسابع` | `أسابيع` (u02 has the yeh) |
| u05 | `4 ساعة` | `4 ساعات` |
| u06 | `14ساعة` | `14 ساعات` — no space at all before the noun |
| u06, u07, u10 | `الــدوال العدديـة`, `معالجــة بيداغوجية` | tatweel padding, kept in `nameText` |

`name` carries the tatweel-free form (be-4's convention); `nameText` carries the cell.

In the body: `حساب مجموع الحدود الاولى…` (twice, weeks 3 and 4) has no hamza on `الاولى`
while week 4 row 1 writes `الأولى` with one — same page, same column, two spellings.
Week 13's guidance prints `حلات اخري` for `حالات أخرى`, and week 23's guidance prints
`توترات` / `توتراتها` where its own contents cell says `تواترات`. Week 24's contents has a
space before its colon (`الاحتمالات : حساب…`) where week 25's does not
(`قانون الاحتمال: تعيين…`). All kept.

Two spellings that look like errors and are **not** mine to normalise either: the شعبة line
on the cover reads `آداب وفلسفة + لغات أجنبية` (with hamzas) while the summary table's own
header reads `اداب و فلسفة + لغات اجنبية` (without). `streams` uses the cover's spelling,
which is also the one the main-table title uses (`شعبتا آداب وفلسفة + لغات أجنبية`).

## Tooling notes

- **The text layer is unusable for content but excellent for two things**: diacritics and
  letter identity. It is how I confirmed `بـِ` is BEH + TATWEEL + KASRA (not a rendering
  artefact) and that `حلات` really is missing its alef. Its systematic corruption is the
  lam-alef ligature (extracted as `ا`+`ل` in the wrong order — `مشكالت` = `مشكلات`) and
  **every digit becomes `2`**. Never take a number from it.
- **`pdftoppm -r 150` is not enough for this document's borders.** Three of my first-pass
  row groupings were wrong until I scanned the rules numerically; the week column's cell
  boundaries and the content rows' boundaries differ in six places on page 5 alone.
- The tooling (`load-programmes.mjs`, `verify-programmes.mjs`, `src/store/programmes.ts`)
  was used unmodified. `--partial`'s resume line was the only hand-off between the passes.

## The promoted regression net is green

Run against the **job** be checkout (not the main one — the job branch carries the three
new tooling files, so gating the main checkout would verify the wrong code):

```
CHAR_ROOTDIR=<job>/stacks/teacher-be  CHAR_TESTDIR=<job>/tests/be  \
  npx jest -c tools/tests/jest.characterization.config.js
→ 19 suites passed, 364 tests passed, 0 failed
```

`tools/ci` has no way to ask for the promoted net from a feature branch (mode is derived
from the branch name and `--slug ""` re-derives it), so the config was invoked directly with
the same environment `run_layer` exports. 364 is the count SEED §6.3 recorded as the
baseline — unchanged, as it must be: be-9 touches no be-repo file.

## ⚠ Blocked exit: the job gate is RED, and it was red before be-9

`tools/ci be --slug programme-corpus` from the job worktree: **`gate FAIL`, 4 failed /
93 passed**, identical across three runs. The four failures are all the same assertion,
written by be-1…be-4, which hard-codes the live database's collection list:

```
expect(names).toEqual(["exercise_revisions", "solutions", "subjects", "teachers"]);
```

- `be-1 · perimeter — the real database is not touched › teacher_saas holds the same collections before and after this suite`
- `be-2 · perimeter › teacher_saas is untouched by this suite`
- `be-3 · CLI surface + perimeter › teacher_saas is untouched by this suite`
- `be-4 · the live-database guard › THE CASE THIS EXISTS FOR: a forgotten --db falls back to teacher_saas and is refused`

**be-9 did not cause this.** `teacher_saas` gained `programmes` at
`2026-08-10T08:34:41Z` (be-4's load) and `programme_revisions` at `09:53:15Z` (be-5's
`--correct`); be-9's document was inserted at `10:38:36Z` into a collection that already
existed. Dropping my document would not drop either collection, so the assertion fails
identically without be-9. The cause is structural: **be-4…be-9 are all instructed to load
into `--db teacher_saas --allow-live-db`, and those four tests assert that database still
holds exactly the four pre-corpus collections.** The two instructions cannot both hold.

Per the loop's rule — *an oracle that seems wrong is a stop-and-ask, never an edit* — I have
**not** touched the suites. The corpus itself is complete and green on every oracle that is
about the corpus (A1–A8, loader, freeze, negative checks). What needs a decision is whether
those four perimeter assertions should now expect the six-collection list, or whether the
corpus belongs in a database other than `teacher_saas`. Note `state.json` still marks be-4
and be-5 `todo`, which is consistent with the gate having been red since be-4.
