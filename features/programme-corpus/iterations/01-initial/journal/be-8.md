# be-8 — transcribe تسيير واقتصاد (`tadarroj-3as-gestion`, 2022-09)

**Transcriber:** be stack agent (Opus 5), 2026-08-10.
**Source:** `project/docs/reference/curriculum/tadarroj-3as-gestion-2022.pdf`, 10 pages.
**Passes:** 3, as budgeted — pass 0 (front matter + summary table, commit `b7c604e`),
pass 1 (weeks 1–14, pdf 5–7, commit `9956cbe`), pass 2 (weeks 15–27, pdf 8–10, commit
`2014e90`). `verify --partial` green after each; its printed resume line was the only
hand-off.

**Method:** `pdftoppm -r 150` for the reading sweep, 300 dpi for every cell whose text I
would otherwise be guessing, 600 dpi for the legend, the source typos and every place a
dot or a diacritic decided the string. Cell extents were **never** read by eye: a pixel
script reports the horizontal rules inside each of the six columns separately, which is
what found the two merged cells that straddle a week boundary. **New in this document's
method — `pdftotext -bbox` for token x/y positions.** Reconstructing each line by
descending x (RTL) and joining with a gap test (>4 px at 150 dpi = a space) is what
resolved the bidi questions that a rendered crop cannot answer, and it is what I used to
settle the legend's year order. It also caught the spacing quirks (`-تبيان`,
`تعريف مركب دالتين .`) that a visual read normalises away without noticing.

> ⚠ **A warning for be-10 that cost me time: do not trust your own reading of *which side*
> a token sits on in a rendered Arabic crop.** I twice concluded a bullet or a `؛` was at
> the left when the bbox put it at the right. Every left/right claim in this journal is
> from `-bbox` coordinates, not from looking.

## Result

`data/programmes/tadarroj-3as-gestion.jsonl` — 28 lines, 27 weeks, **59 rows**, 0 rejected.
Loaded into `teacher_saas` at `transcriptionRev 1`, `contentHash 0358ffc4baed…`.

| oracle | result |
|---|---|
| `verify --file` A1–A7 | **green** — `{27, 108}`, weeklyHours 4, `108 == 4 × 27` |
| `verify --db --docKey tadarroj-3as-gestion` A1–A8 | **green** (A8 contentHash matches) |
| loader | `inserted` 27/59/0, then `unchanged` on a re-run — idempotent |
| `--partial` after each pass | green (pass 0: next week 1 · pass 1: next week 15 · pass 2: complete) |
| KaTeX | 83 math spans, 0 failures |
| `grep -c trimester` | 0 |
| every row carries `emphasis` | 59/59 (58 `normal`, 1 `added-2022`) |
| `competencies` | `null` — not `[]` |
| frozen paths (`docs/reference/curriculum/`, `stacks/`) | `git status` empty |
| `tools/ci be --slug programme-corpus` from the job worktree | **`gate PASS`, 97/97, twice** |
| promoted `be` net against the JOB checkout | **19 suites, 364/364, 0 failed** |

**The two schema questions this document was chosen to answer both came back clean, with
no change to the sealed tooling.**

1. **`competencies: null` works.** There is no الكفاءات المستهدفة section anywhere: the ten
   pages are cover / مقدمة / (مذكرة منهجية + ملامح التخرج) / summary table / six table
   pages, with nothing in between. The validator's distinction held exactly as be-9
   described it — the *key* is required, the *value* may be null — so "nobody looked" is
   still a reject while "the section does not exist" is representable.
2. **The smaller unit set works.** 12 units (against math's 14 and lettres' 10), three of
   them معالجة, and none of `الأعداد المركبة` / `الهندسة في الفضاء` / `الأعداد والحساب`.
   Nothing in the grammar assumes a unit count or a unit vocabulary.

`load-programmes.mjs`, `verify-programmes.mjs` and `src/store/programmes.ts` were used
**unmodified**.

## The legend — a FOURTH wording, and it never mentions the colour

**Found on pdf page 5**, in the السير المنهجي cell of **week 2's only row**, in **bold
black** beside that row's red contents:

> تم ادراج هذا المحور لعدم تناوله في تدرجات السنة الدراسية 2021 - 2022

Recorded as `emphasisLegend {text, pdfPage: 5}` and repeated as that row's single
`guidance` element — the double-recording convention be-4, be-6 and be-9 all used, because
the sentence really is printed inside that cell.

Three things make this the most divergent legend in the corpus:

- **It does not name red, or colour, at all.** The other three say "what is coloured red
  was included because…". This one says "**this محور** was included because it was not
  covered". A legend hunt keyed on `الأحمر` / `الملون` finds **nothing** in this document —
  I grepped all ten pages for `ادراج|إدراج|ملون|حمر|تناول|لون` and this sentence is the
  only hit. It is the legend by position and by function, not by vocabulary. Matching on
  *meaning* is not a nicety here; it is the only thing that works.
- **It is a fourth distinct sentence.** Maths (p18) «تم ادراج ما هوملّون باللون الأحمر لعدم
  تناوله…» · literary (p5) «تم ادراج العناصر الملونة بالاحمر لعدم تناولها…» · تقني رياضي
  (p18) run-together «تم ادراج ما هوملون باللون الأحمرلعدم تناولهفي…» · here «تم ادراج هذا
  المحور لعدم تناوله في تدرجات السنة الدراسية…». Note also the extra word **تدرجات** —
  it says "in the *annual plans* of school year …", which the other three do not.
- **The year order is REVERSED relative to all three finished documents.** They print and
  store `2022-2021`; this one prints **`2021 - 2022`**, with a *spaced hyphen*. Settled
  from bbox coordinates, not by eye: on line 1 the tokens run (left→right) `-`(x 96 pt),
  `2021`(x 103), `الدراسية`(x 133); `2022` is alone on line 2, flush **right** (x 334).
  In an RTL line, decreasing x is the reading direction, so the logical order after
  الدراسية is `2021`, `-`, `2022`. Because the hyphen is spaced it stays a bidi-neutral
  token and does **not** fuse the two numbers into one LTR run — the same mechanism be-9
  described for the intro's tatweel separator, arriving at the opposite answer. Confirmed
  at 600 dpi (`2021`, then `2022`; neither is `2202` or `2022`/`2021` transposed).
- `ادراج` and `في` as printed — no hamza on `ادراج`, matching lettres and تقني رياضي.

Guard satisfied: `emphasisLegend != null`, so `added-2022` is legal.

## The red sweep

A pixel red-sweep over **all ten pages** (`r>100 ∧ r−g>60 ∧ r−b>60`) finds red on **pdf
page 5 only**, in three bands at y 269–289, 302–322, 339–363 (150 dpi), all inside
x 809–1164 — which is the المحتويات المعرفية column and nothing else.

Mapped to rows, that is **exactly one row in the whole document**: week 2's single 4-hour
row. Its contents cell is red end to end (both prose lines and the
`$u_{n+1} = u_n + b$ و $u_{n+1} = au_n$` line); its الكفاءات cell — which is merged across
weeks 2–4 — is **black**, and its السير cell is **black** (it holds the legend).

So this is the same column shape the maths and تقني رياضي documents showed: **red lives in
المحتويات المعرفية, and الكفاءات is never red.** It is also the smallest red block in the
corpus — one row, 4 hours, against تقني رياضي's four rows and the literary document's five.
There is no mid-week cut-off question here because the red block *is* one whole week.

## Genuine ambiguities — every one resolved from the page, all worth re-checking

**A1 · The half-week units, and the one place the document contradicts itself.** This is
the finding be-10 should look at first, and the only place my file cannot satisfy every
piece of evidence at once.

The summary table gives **النهايات = أسبوع ونصف / 6 ساعات** and **دراسة دوال = أسبوع ونصف
/ 6 ساعات**. Those two units occupy weeks 8, 9, 10 — three weeks, 12 hours, which matches.
But `unitId` is a per-**week** field, and 1.5 + 1.5 means the boundary falls **inside week
9**. Three independent signals disagree about where:

| signal | says |
|---|---|
| the summary table's hours | النهايات = week 8 (4h) **+ week 9's first row (2h)** = 6h |
| the main table's المحور column | النهايات's cell ends at the week 8/9 boundary (pdf 7, y=162); `دراسة الدوال`'s cell covers **all** of weeks 9 and 10 |
| the *content* of week 9's first row | asymptotes (`المستقيمات المقاربة`) — a النهايات topic, and it sits in a cell merged with week 8's last row |

I assigned **week 9 → u05 (دراسة دوال)**, following the محور column, because that column is
the document's own per-week unit label and it is unambiguous (the cell is
`دراسة الدوال`, confirmed on a rotated 300 dpi crop; pdf 7's y 128–162 محور cell above it is
blank). The consequence, stated plainly so nobody reads the file as saying otherwise:

> **`units[u04].weeks` is 1.5 but exactly one week carries `unitId: "u04"`, and
> `units[u05].weeks` is 1.5 but two weeks carry `u05`.** The units table keeps the source's
> own numbers; the week→unit map keeps the source's own labels. They cannot both be
> honoured in a per-week field. A6 only checks that the two id sets close, so this
> verifies green either way.

This is the first document in the corpus where the "weeks per unit equals the summary
table's weeks column" cross-check that be-6 and be-9 both reported **does not hold**, and
it is not a transcription error — it is what `أسبوع ونصف` means. Every other unit does
match: u01 1 · u02 4 · u03 2 · u06 1 · u07 3 · u08 6 · u09 1 · u10 2 · u11 3 · u12 1.

**A2 · Two merged cells straddle a WEEK boundary.** Both were invisible at 150 dpi and were
found by comparing rule sets column by column. Both follow be-4's first-spanned-row
convention, so both are places an independent reader who attaches by visual adjacency will
disagree with me:

- **pdf 7, y 128–335.** الكفاءات, المحتويات *and* السير all lack the rule at y=162 that the
  hours and week columns have. One cell therefore covers **week 8's last row (1h) and week
  9's first row (2h)**. All of it — the two asymptote competency paragraphs, the
  `المستقيمات المقاربة` contents, the `يبرّر وجود مستقيم مقارب` bullet — is stored on
  **week 8's third row**, and week 9's first row is `competencies: []`, `contents: []`,
  `guidance: []`. That empty row is "this cell does not exist separately", not "the cell
  was blank".
- **pdf 9, y 128–196.** المحتويات lacks the rule at y=162. One cell covers **week 19's last
  row (1h) and week 20's first row (1h)**; `حل مشكلات متعلقة بإيداع أو تسديد تتدخل فيها
  اللوغاريتمات أو الأسّيات.` is stored on **week 19's third row**, and week 20's first row is
  empty in all three fields.

A third merge is week-internal and unremarkable: pdf 7, y 487–555 (all three text columns
lack the rule at 521), so week 12's third row is empty and its content sits on the second.

**A3 · The week column is honest in this document.** Unlike تقني رياضي (five false
boundaries) and the maths document (one), every week-column cell here bounds a real week,
every week number 1..27 is printed, and each number sits on its week's first row.
`weekNumberPrinted == week` for all 27. The three page-crossing weeks (8, 15, 19) print
their number on the earlier page, and the continuation row's hours digit is absent — the
same rendering be-6 recorded, and the reason the 4-hour invariant is still what closes each
week rather than the rules alone.

**A4 · Equation objects are mis-anchored, and two cells cannot be read in layout order.**
In three places the printed token order is not a sentence in any reading:

- pdf 8, week 16's competencies: line 1 `حساب نهايات جداءات أو حواصل قسمة`, line 2 (RTL)
  `و`, `$x^{n}$`, `$\ln x$`, line 3 `تتضمن`. Taken literally that is
  «… قسمة و x^n ln x تتضمن», which is not Arabic. The equation objects are floating and
  `تتضمن` has been pushed onto its own line. I stored the sentence the tokens obviously
  form: `حساب نهايات جداءات أو حواصل قسمة تتضمن $\ln x$ و $x^{n}$`. Week 18's
  competencies has the identical layout and is stored as
  `… تتضمن $x^{n}$ و $e^{x}$`. **The set of objects is certain; their order and the
  position of `تتضمن` are reconstructed.** `pdftotext`'s own bidi resolution agrees with
  the object order I chose (`و ln x x n` / `و xn e x`).
- pdf 9, week 22's fourth row: the regression-coefficient formulas render (left→right)
  `؛`, `$a = …$`, `;`, `$b = \overline{y} - a\overline{x}$`. Read as RTL that would put the
  `b` formula first, which is backwards mathematically. Read as LTR — which is what these
  equation-only runs behave like — it is `a` then `b`, and that is what I stored.
- **The `؛` marks that separate the formula groups are the residue of this.** I placed each
  where an LTR reading puts it, which is *before* the formulas in weeks 16 and 22 and
  *after* them in week 18. That inconsistency is in the file because it is on the page; I
  do not claim to know the author's logical order for a bidi-neutral character sitting
  between two LTR runs.

**A5 · The main table's محور labels differ from the summary table's unit names**, exactly as
SEED §2.3.7 predicts. `verify --compare` will report `unitLabel` discrepancies — disposition
them `seed-correct`:

| weeks | main table prints | summary table (`nameText`) |
|---|---|---|
| 9–10 | `دراسة الدوال` | `دراسة دوال` |
| 22–23 | `الإحصاء` | `الاحصاء` |
| 24–26 | `الإحتمالات` | `الاحتمالات` |
| 2–5 | `المتتاليات العددية` | `المــتتاليـــــات` |

**A6 · The list markers are typed characters and the document mixes three of them.** `-`
(U+002D), `ـ` (U+0640 TATWEEL) and `–` (U+2013) all appear as leading markers, sometimes
within one cell (week 15's contents uses `ـ`, `–` and `-` on four consecutive lines). They
are kept verbatim, because their *spacing* is inconsistent in a way only typing explains —
week 2's fourth competency is `-تبيان` with no space while the three above it have one
(measured: 0.2 px gap vs 6.5 px). The Symbol-font bullet `` (U+F0B7) that opens most
السير paragraphs is **dropped**, as the whole corpus drops it; one bullet per array element.

**A7 · A hanging marker renders at the END of the previous line.** In week 15 (comp and
contents) and week 17 (comp) the marker for the second item is printed at the far left of
the first item's line, e.g. `تعريف الدالة اللوغاريتم النيبيري. ـ` / `معرفة الخواص…`. I
stored the marker with the item it introduces (`ـ معرفة الخواص المميزة لها.`), not with the
line it renders on.

**A8 · One parenthetical that is a line of its own.** Week 2's third competency prints
`- التعرّف إن كانت متتالية رتيبة.` and then `(تزايد أو تناقص متتالية)` on the next line, at
normal line spacing and with no marker, even though it would have fitted. Stored as **one**
element with a space: `- التعرّف إن كانت متتالية رتيبة. (تزايد أو تناقص متتالية)`.
`pdftotext` joins the two without a space; both readings are defensible.

**A9 · Nothing is clipped at a cell border in this document.** I ran be-6's border test —
for every column rule on every table page, the minimum word `xMin` inside it — and the
closest any word comes to a left rule is **2.7 pt**. Zero hits at the 2 pt threshold on all
six table pages. تقني رياضي's word-eating clip is a property of that document, not of the
corpus; it still has to be tested per document, and here the test is a clean negative.

## The front matter — method, and a defect it exposes in two finished seeds

مقدمة, مذكرة منهجية and ملامح التخرج are shared boilerplate. Rather than re-key them (or
copy a seed blind, which be-6 rightly warns against), I compared the **PDFs' own text
layers**: `pdftotext` output for gestion pages 2 and 3 is **byte-identical** to
`tadarroj-3as-sciences` except for three justification-spacing artefacts (`األدا ء`,
`ف ي`, `وت جسيدا` — spurious spaces the extractor inserts, absent from the render) and one
bullet-token placement. On that evidence I adopted the sciences seed's de-mangled strings,
then verified every risky class against gestion's own render: the diacritics, the shadda
positions, the bullet glyph, and the two places gestion genuinely differs —

- **gestion's ملامح التخرج stops at `ووسائله.`** The sciences seed continues into a
  `الكفاءات الرياضية في نهاية السنة الثالثة في شعبة العلوم التجريبية` section that this
  document does not have. Truncated accordingly.
- **gestion prints the `◄` marker on the fifth bullet; the sciences text layer does not.**
  Added back from gestion's own 600 dpi render.

That comparison turned up a defect in two *other* seeds, reported here rather than touched:

> **`tadarroj-3as-math` and `tadarroj-3as-techmath` store the intro's year separator as an
> EN DASH (`2022 – 2023`, U+2013). It is two TATWEELs (U+0640 U+0640).** All five PDFs
> extract that line byte-identically — I checked math, gestion and lettres directly — and
> `tadarroj-3as-sciences` and `tadarroj-3as-lettres` both store the tatweels. gestion's own
> 600 dpi render shows a long **baseline-level** connector, not a mid-height dash.
> be-9 already flagged the divergence from the maths seed; this establishes which side is
> wrong. A `--correct` on those two documents, not mine to make.

Two more front-matter facts worth carrying: the cover writes **`المادة`** (no shadda) while
the summary table's own header writes **`المادّة`** (shadda on the dal) — both stored as
printed; and the summary table's weeks header is **`عدد الاسابيع`**, hamza-less, as the
sub-issue predicted (against `عدد الأسابيع` in maths and `الحجم الأسبوعي` in lettres).

## Source errors preserved (do not "fix" these)

All confirmed at 600 dpi or in the text layer, and stored as printed:

- **`لهده الدالة`** (week 15 r1 guidance) — `د` where `ذ` is meant. The dot is simply not
  there at 600 dpi.
- **`فهم مبرهنة القبم المتوسطة`** (week 7 r2 competencies) — `القبم` for `القيم`, one dot
  below instead of two. The *contents* cell of that same row writes `القيم` correctly.
  One row, two spellings.
- **`منالشكل:`** (same cell) — `من` and `الشكل` run together with no space. 600 dpi.
- **`تعريف الدالة الأسية النيبرية .`** (week 17 r1) — `النيبرية` missing its `ي`, where the
  rest of the document writes `النيبيري`. And a space before the period.
- **`تعريف مركب دالتين .`** (week 7 r1) — space before the period, in a cell whose other
  two items have none.
- **`-تبيان إن كانت متتالية متقاربة.`** (week 2) — no space after the dash, unlike the three
  items above it in the same cell.
- **`العمليات على النهايات:(تابع)`** (week 8) — colon immediately followed by the paren, no
  space. Same shape be-6 recorded for `المضاعف المشترك الأصغر:.`.
- **`أو.`** (week 23 contents) — `أمثلة لسلاسل احصائية من الشكل $(x ; \ln y)$ **أو.**
  $(\ln x ; y)$`. A period glued to `أو` in the middle of the sentence. The parallel
  guidance sentence in the same row writes plain `أو`.
- **A lone `.` as a whole contents cell** (week 26 r0). The competency beside it is a full
  sentence; the contents cell holds one period and nothing else. Verified against the rule
  set — it is a real cell with real ink, not bleed.
- **The same limit printed twice** (week 18 competencies):
  `$\lim_{x \to -\infty} xe^{x} = 0$ . $\lim_{x \to -\infty} x e^{x} = 0$` — identical
  except for the space between `x` and `e`. Both kept.
- **`(للدوال المرجعية` never closes its parenthesis** (week 6 r1 contents).
- **`نشرح مبدأ مربعات الدنيا`** (week 22 r3) — missing the `ال` on `المربعات`, in a bullet
  that then writes `بالمربعات الدنيا` correctly two sentences later.
- **`تعريف سلسلة إحصائية لمتغيرين عددين`** (week 22 r0 competencies) vs
  **`لمتغيرين عدديين`** in that same row's contents.
- **`احصائية`** (week 23) without hamza, against `إحصائية` in week 22.
- **`تقويم تشخيصي للمكتسبات التلاميذ`** in the main table vs **`لمكتسبات التلاميذ`** in the
  summary table — the same inconsistency be-5 found in the maths document, in the same two
  places.
- **`: تعيين قانون احتمال مرفق بتجربة عشوائية…`** (week 24 r0 competencies) — a colon
  printed at the *start* of the cell (rightmost token, per bbox), with nothing before it.
- Summary-table spellings kept as printed: `اسبوع` (u01) and `أسبوع` (u06 etc.) in one
  column; `أسبوعان` (u03) and `أسبوعين` (u10) for the same quantity; `3أسابيع` (u07) with no
  space against `3 أسابيع` (u11) with one; `المــتتاليـــــات` with 2 + 5 tatweels
  (`name` carries the tatweel-free `المتتاليات`, per be-4's convention).

## How this document differs structurally from the other four

- **59 rows over 27 weeks** — the sparsest dense document (تقني رياضي 97, lettres 39 at
  2h/week). Weeks are commonly one or two rows; 4-hour single rows are normal here and
  are not only معالجة (weeks 10 and 11 are both single 4h rows, and only 11 is معالجة).
- **Half-week units.** First appearance in the corpus of `أسبوع ونصف`, and it lands as the
  ambiguity in A1 rather than as a formatting curiosity. `weeks: 1.5` loaded and verified
  with no schema change.
- **The legend does not name the colour** (above) — and the red it explains is one row.
- **The محور column is trustworthy but low-resolution**: no blank cells, no slivers, no
  garbled strings, no rotation problems; but its boundaries are drawn at row granularity,
  which is what makes the half-week unrepresentable.
- **No معالجة row merges five columns**, and the merge width is not even consistent. A
  vertical-rule scan restricted to each single-row week gives: **weeks 1 and 27** merge
  **four** columns (المحور + الكفاءات + المحتويات + السير — only x=156 and x=1585 survive),
  while **weeks 11 and 21** merge **three** (السير + المحتويات + الكفاءات; the محور column
  keeps its own cell at x=1507). All four are stored the same way — the text in `contents`,
  with `competencies: []` and `guidance: []` — matching be-6's week-11 call and the maths
  seed. `[]` here means "this cell does not exist separately", not "it was empty".
- **No `$\square$` anywhere.** This document never uses the double-struck set letters, so
  the unrecoverable-glyph case be-5 predicted does not arise. Its mathematics is functions,
  limits, integrals, statistics and probability — all of it renders.

## Tooling notes

- The three tools were used **unmodified**. `--partial`'s resume line was the only hand-off
  between passes.
- **The text layer's digit corruption is real and selective here**, which makes it more
  dangerous than a blanket failure: on the summary table, `4`, `6`, `8`, `12`, `16`, `24`
  and `3` extract correctly while `27` comes out `22` and **`108` comes out `128`**. That
  is precisely the figure the SEED recorded as the published error (§2.1). Every digit in
  this file was read from a render.
- The lam-alef ligature reverses as always (`االحصاء` = `الاحصاء`, `التالميذ` = `التلاميذ`),
  combining marks split onto their own tokens (`التعرّ ف` = `التعرّف`), and justification
  inserts spurious spaces inside words. The layer is reliable for **letter identity,
  diacritics and tatweels**, and for nothing else.
- Reproducing the promoted-net run needs the **lane** env, not just the roots — be-6's note
  is correct and I hit the same wall. What worked, with the lane up on slot 7:
  ```
  CHAR_ROOTDIR=<job>/stacks/teacher-be   CHAR_TESTDIR=<job>/tests/be
  CHAR_GUARD=<clone>/tools/tests/guard.js
  CHAR_LANE_SLOT=7  CHAR_BE_URL=http://localhost:9700  CHAR_BE_LOG=/tmp/teacher-backend.s7.log
  npx jest -c tools/tests/jest.characterization.config.js     → 19 suites, 364/364
  ```
  One addition to be-6's note: `tools/profile.sh` and `tools/lanes.sh` are **bash**
  (`${BASH_SOURCE[0]}`), so sourcing them from zsh silently resolves the clone root to `/`
  and every lookup fails with "no project/ in this harness clone (/)". Run them under
  `bash -c`. Also `lane_port KEY SLOT` and `lane_log KEY SFX` take the *slot/suffix*, not
  the worktree path.
- **be-9's blocked exit is cleared.** The four perimeter assertions that hard-coded the
  pre-corpus collection list were re-baselined in `337644c`; the job gate now reads
  `gate PASS 97/97` and the live `teacher_saas` listing is
  `exercise_revisions, programme_revisions, programmes, solutions, subjects, teachers`.

## What be-10 should check first

1. **Week 9's `unitId`** (A1). The one place the document's own two tables disagree.
2. **The two cross-week merged cells** (A2, pdf 7 y128–335 and pdf 9 y128–196). An
   independent reader attaching by visual adjacency will move that content one week later.
3. **The legend's year order** — `2021 - 2022`, against `2022-2021` in all three finished
   documents (A/legend). If be-10 reads it the other way, one of us has the bidi wrong and
   it is worth settling for the corpus as a whole.
4. **Weeks 16, 18 and 22's reconstructed math sentences** (A4) — the only strings in this
   file whose word order is not directly attested by the layout.
