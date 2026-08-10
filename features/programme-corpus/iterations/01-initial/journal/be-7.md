# be-7 — transcribe علوم تجريبية (`tadarroj-3as-sciences`, 2022-09)

**Transcriber:** be stack agent (Opus 5), 2026-08-10.
**Source:** `project/docs/reference/curriculum/tadarroj-3as-sciences-2022.pdf`, 17 pages.
**Method:** `pdftoppm -r 150 -png` for orientation; **300 dpi for every table page**, read in
2–4 crops each; 450 dpi for the summary table; 600 dpi for the legend, for every uncertain
glyph and for the two cells whose ending I could not otherwise fix. Cell-merge extents were
**not** read by eye — a per-column pixel rule scan (`dark fraction > 0.85` across each
column's x-range) gave the horizontal rules of every column separately, and comparing those
rule sets is what found the false week boundaries and the merged كفاءات cells. Word gaps were
measured from `pdftotext -bbox-layout` (a normal gap is 3.0 pt at this body size; 6.0 is a
double space) — that is how the legend's three double spaces were established rather than
guessed.
**Budget: 4 passes, as planned.** Pass 0 = pdf 1–5 (front matter + summary table);
pass 1 = pdf 6–9 (weeks 1–9); pass 2 = pdf 10–13 (weeks 10–18); pass 3 = pdf 14–17
(weeks 19–27). One commit each.

## Result

`data/programmes/tadarroj-3as-sciences.jsonl` — 28 lines, 27 weeks, **81 rows**, 0 rejected.
Loaded into `teacher_saas` at `transcriptionRev 1`, `contentHash 6f635972ecc3…`.

| oracle | result |
|---|---|
| `verify --file` A1–A7 | **green** — `{27, 135}`, weeklyHours 5, `135 == 5 × 27` |
| `verify --db --docKey tadarroj-3as-sciences` A1–A8 | **green** (A8 contentHash matches) |
| loader | `inserted` 27/81/0, then `unchanged` on a re-run — idempotent |
| `grep -c trimester` | 0 |
| every row carries `emphasis` | 81/81 (7 of them `added-2022`) |
| `competencies` domain count | **5** — الحساب is absent, as DISCOVERY predicted |
| two distinct unit ids named المتتاليات العددية | **u05 and u07**, both referenced by weeks |
| frozen paths (`docs/reference/curriculum/`, `stacks/`) | `git status` empty |

Weeks per unit vs the summary table's own `weeks` column:

```
u01 1/1 · u02 2/2 · u03 2/2 · u04 3/3 · u05 2/2 · u06 1/1 · u07 1/1
u08 3/2.5 · u09 2/2.5 · u10 3/3 · u11 1/1 · u12 2/1.5 · u13 3/3.5 · u14 1/1
```

The four disagreements are exactly the four half-week units, and they are **not** errors —
see "the half-weeks" below. Every whole-week unit matches exactly, which is the same stronger
evidence be-9 recorded for the literary document.

---

## The two things this document was chosen to stress

### 1 · The duplicate non-contiguous unit — worked, unchanged

`المتتاليات العددية` appears twice in the summary table: **أسبوعان / 10 ساعات** and, after an
intervening `معالجــة بيداغوجية`, **اسبوع / 5 ساعات** (note the second spells أسبوع without
its hamza — preserved). They are `u05` and `u07`, two ids, never merged. The schedule confirms
they are genuinely separate blocks:

```
w9  w10   u05  محور "المتتاليات العددية"      (pdf 9, 10)
w11       u06  محور "معالجة بيداغوجية"          (pdf 10)
w12       u07  محور "تابع : المتتاليات العددية"  (pdf 10)
```

**The main table names the second one differently** — `تابع : المتتاليات العددية` ("continued:
…") where the summary says plain `المتتاليات العددية`. That is SEED §2.3.7 again, and it is
also the page's own confirmation that the two blocks are one topic taught in two stretches. The
`nameText` keeps the summary cell; the main-table label is recorded here and nowhere else,
because the grammar has no field for it (same contract gap be-9 raised for column headers).

**Nothing in the sealed schema had to change.** `unitId` being assigned rather than derived is
what made this a non-event: had it been derived from the name, u05 and u07 would have collapsed
into one unit with 3 weeks and 15 hours, A1/A2 would still have passed, and the corpus would
have silently claimed the ministry teaches المتتاليات in one 3-week block.

### 2 · The half-weeks — worked, and they are mid-week محور changes

Four units carry non-integer weeks: `u08 2.5` (اسبوعان و نصف), `u09 2.5` (أسبوعان ونصف),
`u12 1.5` (أسبوع و نصف), `u13 3.5` (3 أسابيع ونصف). `weeks` is a number, `weeksText` keeps the
cell, and the loader accepted both without complaint.

What a half-week **is**, on the page, is a week whose rows are split between two محور cells:

| week | rows | محور | unit |
|---|---|---|---|
| 15 | 1+1+1 h | الدوال الأصلية و الحساب التكاملي | u08 |
| 15 | 2 h | الاحتمالات | u09 |
| 23 | 1+2 h | التحويلات النقطية | u12 |
| 23 | 1+1 h | الهندسة في الفضاء | u13 |

And the arithmetic closes exactly: u08 = 5+5+3 = **13** ✓ · u09 = 2+5+5 = **12** ✓ ·
u12 = 5+3 = **8** ✓ · u13 = 2+5+5+5 = **17** ✓. All four match the summary's hours column to
the hour. **That is the strongest structural check this document offers**, and it is only
available because the summary table splits hours unevenly across half-weeks (13/12, 8/17)
rather than halving them.

`unitId` is per-week, not per-row, so each split week had to be assigned to one unit. I gave it
to the unit holding the **majority of the week's hours** (week 15 → u08 with 3 h; week 23 → u12
with 3 h). The alternative (the unit the week *starts* in) gives the same answer for both, so
this document does not discriminate between the two rules. **Recorded because a future document
may.**

> The 2.5-week units are why the units table's `weeks` column and the count of weeks carrying a
> unit's id cannot be equal here, and why A6 checks only that the reference sets close.

### 3 · The two-name row-group — the one place I had to choose

`الدوال العددية (النهايات)` and `التزايد المقارن ودراسة الدوال` sit in **two separate name
cells sharing one weeks cell (`3 أسابيع`) and one hours cell (`15 ساعة`)**. The maths document
has these as two units (1 week / 7 h and 2 weeks / 14 h); this one does not.

I made them **one unit, `u04`, whose `name`/`nameText` carry both printed lines separated by a
newline**. Reasoning, in order:

1. A unit in this grammar is a summary-table **row-group** — the thing that has one `weeks` and
   one `hours` value. This row-group has one of each.
2. Splitting into two units would need per-unit `weeks` and `hours` numbers that **the page
   does not print**, and `weeksText`/`hoursText` are defined as the verbatim cell — one cell,
   shared. Any split would be invention, and `units[i].weeks > 0` is enforced, so a 0-week
   partner is not even representable.
3. The main table shows **why** the page merged them: النهايات covers week 6 and week 7's first
   hour (6 h), التزايد المقارن covers week 7's remaining 4 h and week 8 (9 h). 6 + 9 = 15, and
   **neither lands on a week boundary**. The pair genuinely cannot be split into whole weeks,
   which is presumably why the ministry's own table did not try.
4. As a bonus this makes the mid-week محور change in week 7 (النهايات → التزايد المقارن, right
   at the pdf 8/9 page break) a non-issue: both halves carry the same `unitId`.

The newline is not a new convention — `source.title` and every `frontMatter` field already use
`\n` for the source's own line breaks.

**This is the genuine judgement call of this document.** The alternative worth naming: two
units with weeks 1.5/1.5 and hours 6/9 derived from the main table. I rejected it because the
weeks would be arithmetic I performed, not text the page prints, and `weeksText` would have to
repeat the shared cell on both — a number and its "verbatim" text that no longer agree.

---

## The red-text finding

**Legend found, on pdf page 15**, printed in **black** inside the السير المنهجي cell of week
23's third row, directly above that cell's red bullet:

> تم ادراج  ما هو ملون بالأحمر  لعدم تناوله في  السنة الدراسية 2021 -2022.

Recorded as `emphasisLegend {text, pdfPage: 15}` and repeated as the first `guidance` element
of that row — the same double-recording be-4 and be-9 used, because the sentence really is
printed inside the cell.

Four details, all of which differ from the two finished documents:

- **The wording is a third variant.** Maths (pdf 18): «تم ادراج ما هو ملوّن باللون الأحمر لعدم
  تناوله…». Lettres (pdf 5): «تم ادراج العناصر الملونة بالاحمر لعدم تناولها…». Here:
  «تم ادراج ما هو ملون بالأحمر لعدم تناوله…». Three documents, three sentences, one meaning.
  **A legend hunt that matches on any of the three strings finds nothing in the other two.**
- **The digit order is the opposite of the other two.** Maths and lettres both store
  `…السنة الدراسية 2022-2021`. This page renders `2021 -2022` and that is the logical order too
  (two separate LTR runs, the rightmost first). I read it off the 600 dpi render and confirmed
  the run structure in the text layer; the digits themselves are unusable there (every digit
  extracts as `2`, except a trailing `1` which is what distinguishes 2021 from 2022).
- **Spacing.** Three **double** spaces (after `ادراج`, after `بالأحمر`, after `في`), measured at
  6.0 pt against a 3.0 pt norm. `ملون` has **no shadda** (maths has `ملوّن`), and `بالأحمر`
  keeps its hamza (lettres' `بالاحمر` does not). Nothing normalised.
- **It ends with a period.** The other two do not.

**Red sweep.** A per-page pixel scan (`r>120 ∧ r−g>60 ∧ r−b>60`) over all 17 pages found red on
**pages 15 and 16 only**. Restricting the scan to each column's x-range then mapped it to rows:

| week · row | hours | pdf | red columns |
|---|---|---|---|
| 23 · r2 | 1 | 15 (+16 sliver) | كفاءات · محتويات · سير (the legend line inside سير is black) |
| 23 · r3 | 1 | 16 | محتويات only |
| 24 · r0 | 1 | 16 | محتويات · سير |
| 24 · r1 | 1 | 16 | محتويات · سير |
| 24 · r2 | 1 | 16 | محتويات only |
| 24 · r3 | 1 | 16 | محتويات only |
| 24 · r4 | 1 | 16 | محتويات · سير |

Seven rows, all `added-2022` (legal — the document has a legend). The other 74 are `normal`.

Two things the sweep caught that an assumption would not:

- **The red starts mid-week 23**, in its third row, not at a week boundary — be-9's warning
  about the literary document's red stopping mid-week, arriving from the other end.
- **The red stops exactly at the week 24/25 boundary** (y = 1359 on pdf 16, which is precisely
  the week-cell rule). The first black row after it is week 25's, so "weeks 23–25 are red"
  would have been wrong by a whole week.
- The **محور** cell and the **hours** cell are black in every red row — unlike the literary
  document, where the hours digits are red too.

---

## Genuine ambiguities — all resolved from the page, all worth re-checking

**A1 · A cell whose text runs onto the next page while its hours are already complete.**
Twice, and it is the trap of this document:

- **Week 9** is one 5-hour row on pdf 9. Its كفاءات cell does not end there: `اثبات تجاور
  متتاليتان` prints at the top of pdf 10, in a row whose hours cell is **empty**. Week 9 was
  committed in pass 1 as "closed at 5 hours" and had to be corrected in pass 2.
- **Week 18**'s last contents cell ends `…حيث $z_0$ عدد` at the bottom of pdf 13 and continues
  `مركب معلوم` at the top of pdf 14. Corrected in pass 3.

The pass protocol closes a week on `Σ rows.hours == weeklyHours`. **That is necessary and not
sufficient** — a week can be hour-complete and cell-incomplete. The reliable tell is a row
whose **hours cell is empty**: this document draws the full row grid on the continuation page,
so a leading row with no number is always a continuation, never a new row. I now check the
first row of every page for that before treating the previous page's last week as closed.
Four such continuation slivers exist: pdf 7 (`على هذا المجال.`), pdf 10, pdf 14, pdf 16.

**A2 · The week column draws boundaries where no week begins.** Three times, and only the
5-hour invariant disambiguates:

- pdf 8, y=524 — splits week 5's last hour off. Read naively, week 5 has 4 h and a 1 h week
  follows.
- pdf 10, y=319 — splits week 9's continuation sliver off from week 10.
- pdf 15, y=1825 — splits week 23 at the محور change **and prints "23" in BOTH cells.** Two
  adjacent week cells with the same printed number is a case neither finished document has.
  `weekNumberPrinted` is 23 once, and the week is one week of 1+2+1+1 hours.

**A3 · Two rows are duplicated verbatim between week 6 and week 8** (pdf 8 rows at
y=1446–1979, pdf 9 rows at y=1374–1946): the same competency, the same contents, the same three
guidance bullets, the same 2 h + 1 h. I compared the two 300 dpi crops side by side before
accepting it; they differ only in line wrapping. **This is the source repeating itself**, and it
is preserved. A transcriber who assumes a repeat means they lost their place will re-read pages
forever; a verifier who sees it in the seed should not read it as a copy-paste slip of mine.

**A4 · Bidi order of two `$…$` runs on one line.** Where a line prints two formulas separated
by an Arabic comma, they are two LTR runs inside an RTL paragraph, so the **rightmost is
logically first**. I verified this on a line whose Arabic words fix the order beyond doubt
(pdf 9: `حيث` at x=346 is the sentence's next word and is the rightmost token), and then applied
it everywhere: `$x=a$ ، $x=b$` (pdf 11), `$y'=f(x)$ ، $y''=f(x)$` (pdf 10),
`$x \mapsto \cos(ax+b)$ ، $x \mapsto \sin(ax+b)$` (pdf 6).

> ⚠ **The maths seed is inconsistent here and this document departs from it in one place.**
> `tadarroj-3as-math` reads right-to-left in at least three spots (`$\frac{df}{dx}$` before
> `$\frac{d^2f}{dx^2}$`; the four growth-comparison limits; `$y'=y$` before `$y'=\frac1x$`) but
> **left-to-right** in the trigonometric guidance bullet, where it stores
> `sin(ax+b) ، cos(ax+b)` from a page that prints cos to the right of sin. The sciences page
> prints the identical sentence with the identical geometry. I stored `cos ، sin`. So a
> cross-document diff of that one bullet will show a difference that is not a transcription
> error on this side — **and is, I believe, a defect in the maths seed** worth a `--correct`
> there. Flagged rather than harmonised, because harmonising to a reading I think is wrong is
> the worse of the two.

Inside a single formula, of course, left-to-right stands: Chasles is
`∫_a^b = ∫_a^c + ∫_c^b`, exactly as printed.

**A5 · Merged كفاءات cells spanning a week boundary.** pdf 7's كفاءات cell y=801–1734 covers
all three rows of week 4 **and** week 5's first row; pdf 8's y=1446–1979 covers week 6's last
two rows. Attached to the first spanned row, per be-4's convention. The rule scan is what
found these — the visual gives no hint, because the neighbouring columns *do* have rules there.

**A6 · The المعالجة weeks merge five columns.** Weeks 11, 21 and 27 are a single bold centred
`معالجة بيداغوجية` spanning كفاءات + محتويات + سير, 5 hours, with the محور cell empty. Stored in
`contents` (be-4's convention for the equivalent week-1 row). Note the main table prints
`معالجة بيداغوجية` while the summary prints `معالجــة بيداغوجية` with two tatweels — the
`name`/`nameText` pair keeps both, and the row's own text keeps the main table's.

**A7 · Which text belongs in `contents` vs `competencies` in the red block.** On pdf 16 the red
rows carry their text in the **محتويات المعرفية** column with the كفاءات column empty — the same
asymmetry be-5 recorded for the maths document's red block. I confirmed it by column-restricted
pixel scan rather than by eye, because the two columns are adjacent and a narrow crop makes them
easy to swap.

**A8 · Bullet markers.** The default bullet is a dash-like glyph (`ـ` / `-` depending on how it
extracts) and is **stripped**, per be-4. Two markers are **kept** because they are not the
default and carry structure: `*` (pdf 6 week 3, pdf 11 week 14 — the sub-items of a "الخواص
المتعلقة:" list) and `●` (pdf 15, the single red guidance bullet). Recorded because it is a
convention, not an observation.

---

## Source errors preserved (do not "fix" these)

Summary table (pdf 5):

| where | printed | the form it is not |
|---|---|---|
| u07 | `اسبوع` | `أسبوع` (u01, u06, u11, u14 all have the hamza) |
| u08 | `اسبوعان و نصف` | `أسبوعان ونصف` (u09, on the very next row, has both) |
| u06, u11, u14 | `معالجــة بيداغوجية` | tatweel padding, kept in `nameText` |
| totals | `135ساعة` | **no space at all** before the noun (`27 أسبوعا` has one) |
| u02, u03, u10, u12, u13 | `10 ساعة`, `15 ساعة`, `8 ساعة`, `17 ساعة` | singular ساعة after a plural count |

Front matter:

- The مقدمة's school year prints `2022 ــ 2023` with **two ARABIC TATWEELs**, not the en dash
  the maths seed stores. Confirmed in the text layer, where tatweels survive extraction.
  Same call be-9 made for the literary document.
- `ملامح التخرج` has **four** `◄` bullets and then a fifth line, `النقد الموضوعي والتعبير…`,
  **with no bullet at all**. The maths document bullets all five. Kept as printed.
- The whole مقدمة and مذكرة منهجية are otherwise word-for-word the maths document's. I read them
  at 300 dpi against the stored maths strings rather than copying them; this boilerplate is
  shared across the five documents, so a divergence in it is a reading error, not a source
  difference — and the two real divergences above are exactly the kind that would be lost by
  copying.
- The competency `توظيف المحاكاة في بناء نموذج احتمالي؟` really does end in a **question mark**,
  as in the maths document.

Body:

- `عيين الدالة أصلية التي تأخذ قيمة…` (week 13 r2) — missing the ت of `تعيين`, and
  `الدالة أصلية` where `الدالة الأصلية` is meant. Both kept.
- `حل معادلة من الشكل $z^2 = z_0$ حيث $z_0$ عدد مركب معلوم` — reads fine, but only because I
  found the continuation on pdf 14; on pdf 13 alone it ends at `عدد`.
- `5، ممارسة الحساب الشعاعي في الهندسة التحليلية في الفضاء.` (week 23 r2, red) — a literal
  digit **5** and an Arabic comma opening a competency line. Verified at 600 dpi. Whatever it
  was meant to be, that is what is printed.
- `: تحديد الوضع النسبي لمستويين، لمستقيم ومستوٍ، لمستقيمين.` (week 26 r2) — a leading colon.
- `استعمال المشتقات لدراسة خواص دالة و المنحني الممثل لها (التغيرات، التقريب الخطي و نقطة
  الانعطاف ....` — opens a parenthesis it never closes, and ends in **four** dots.
- `توظيف المشتقات لدراسة الدوال المثلثية: ، $x \mapsto \cos x$ ،` — a comma immediately after
  the colon.
- `في حالة التي تكون فيها…` (week 22 r3) — missing ال of `الحالة`; `إنّه تقايساً موجباً(أو
  إزاحة).` — accusative where nominative is meant, and no space before the parenthesis.
- `تعريف، الكتابة المركبة حالة خاصة (التقايسات) ، مركب تشابهين مباشرين، خواص` — space before a
  comma. Same string be-6 flagged in the technical document.
- The double-struck set letters (ℂ, ℝ) are **unrecoverable**: empty box glyphs at every dpi and
  absent from the text layer. Stored as `$\square$`, as be-4 and be-5 established. They appear
  in weeks 7, 18, 19, 22 and 23.

---

## Tooling notes

- **The rule-scan is not optional for this document.** Three false week boundaries and two
  cross-week merged كفاءات cells are invisible to a visual read at 150 dpi and misleading at
  300. Scanning each column's rules separately and diffing the rule sets is what surfaced them.
- **`pdftotext -bbox-layout` is the right tool for spacing**, and the only one. Word gaps come
  out as clean multiples (3.0 / 6.0), so "is that a double space or justification?" stops being
  a judgement. It is also how I confirmed the bidi run order in A4.
- **`pdftotext` remains unusable for content and for digits** (every digit becomes `2`), but its
  *word order per line* is a useful structural hint, and it found the legend on page 15 in one
  grep across 17 pages when a visual hunt would have been 17 page reads.
- The tooling (`load-programmes.mjs`, `verify-programmes.mjs`, `src/store/programmes.ts`) was
  used **unmodified**. `--partial`'s resume line was the only hand-off between passes; both
  corrections above were found by re-reading the page at the top of the next pass, which is
  exactly what the protocol is for.

## Gates

```
tools/ci be --slug programme-corpus   (from the job worktree)   gate PASS  97/97, twice
promoted be net against the JOB checkout                        19 suites, 364/364
```

The promoted net needs the lane environment, not just `CHAR_ROOTDIR` — be-6's journal records
the recipe. One correction to it: `lane_log be <slot>` yields `/tmp/teacher-backend<slot>.log`,
but the file the lane actually writes is **`/tmp/teacher-backend.s<slot>.log`**. Passing the
former silently gives an empty log and the black-box suites fail as if the product regressed.

Freeze audit clean: `git status --short -- docs/reference/curriculum/` empty, both stack repos
empty, `data/programmes/tadarroj-3as-sciences.jsonl` the only project-repo file I touched.
