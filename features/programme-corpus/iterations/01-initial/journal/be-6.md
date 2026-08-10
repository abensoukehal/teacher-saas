# be-6 — transcribe تقني رياضي (`tadarroj-3as-techmath`, 2022-09)

**Transcriber:** be stack agent (Opus 5), 2026-08-10.
**Source:** `project/docs/reference/curriculum/tadarroj-3as-techmath-2022.pdf`, 19 pages.
**Passes:** pass 0 + pass 1 by an earlier agent that then stalled (commits `53dec66`,
`c966c07` — front matter, units table, weeks 1–12 from pdf 6–10). This journal covers
**pass 2** (weeks 13–19, pdf 11–15, commit `0876fbf`) and **pass 3** (weeks 20–27,
pdf 15–19, commit `49423f9`). Two passes, two commits, resumed entirely from
`verify --partial`'s printed resume line — nothing was carried in from the stalled run.

**Method:** `pdftoppm -r 150` for the reading sweep, **300 dpi for every cell whose text I
would otherwise be guessing**, 600 dpi for the legend, for `خاصةيكون`, for the
`للمعادلات` typo and for every place a diacritic or a period decided the string. Cell and
row extents were **never** read by eye: a pixel script reports the horizontal rules inside
each of the six columns separately, which is what found the five week-column boundaries
that are not week boundaries and the six merged content/guidance cells. `pdftotext` was
used for exactly two things — recovering text the cell **clips** (below) and confirming
letter/diacritic identity. Never for a number, never for content.

## Result

`data/programmes/tadarroj-3as-techmath.jsonl` — 28 lines, 27 weeks, **97 rows**, 0 rejected.
Loaded into `teacher_saas` at `transcriptionRev 1`, `contentHash 04d58aaf9f6c…`.

| oracle | result |
|---|---|
| `verify --file` A1–A7 | **green** — `{27, 162}`, weeklyHours 6, `162 == 6 × 27` |
| `verify --db --docKey tadarroj-3as-techmath` A1–A8 | **green** (A8 contentHash matches) |
| loader | `inserted` 27/97/0, then `unchanged` on a re-run — idempotent |
| `--partial` after each pass | green (pass 2: `next week 20`; pass 3: complete) |
| KaTeX | 264 math spans, 0 failures |
| `grep -c trimester` | 0 |
| every row carries `emphasis` | 97/97 (93 `normal`, 4 `added-2022`) |
| frozen paths (`docs/reference/curriculum/`, `stacks/`) | `git status` empty |

**Weeks per unit equal the summary table's own `weeks` column for all fourteen units** —
u01 1 · u02 2 · u03 2 · u04 1 · u05 2 · u06 2 · u07 1 · u08 3 · u09 3 · u10 2 · u11 1 ·
u12 3 · u13 3 · u14 1. A6 only checks that the reference sets close; this stronger equality
is the real evidence the week→محور assignment is right, and it is the check be-10 should
re-run first.

## The red-text finding

**A pixel red-sweep over all 19 pages (`r>100 ∧ r−g>60 ∧ r−b>60`) finds red on pdf page 18
only**, in one band, y 221–746 at 150 dpi. Every other page is clean — including the ones
a reader would guess (the complex-numbers and space-geometry pages 15–17, 19).

Resolved per row **and per column**:

| row (p18) | hours | week | red where |
|---|---|---|---|
| r0 | 2 | 24 | contents fully red; السير cell is **black** (it holds the legend) |
| r1 | 1 | 24 | contents red **and** السير red |
| r2 | 1 | 24 | contents red |
| r3 | 1 | 24 | contents red **and** السير red |
| r4 | 1 | 24 | **no red at all** — الجُداء السُلَّمي row, black |

Two things worth carrying:

- **The red block ends MID-WEEK.** Week 24's fifth row is entirely black. "All of week 24
  is red" is wrong, exactly as "all of weeks 2–4" was wrong in the literary document.
- **الكفاءات is empty for all four red rows** — the red content lives only in
  المحتويات المعرفية (+ السير on two rows). Same shape as the maths document.

**The legend is present**, in **bold black**, inside the السير cell of week 24's first row
on pdf p18 — recorded by pass 0 as `emphasisLegend {pdfPage: 18}`, and repeated as that
row's single `guidance` element (be-4/be-9's double-recording convention: the sentence
really is printed in that cell, so dropping it there would make the cell incomplete):

> تم ادراج ما هوملون باللون الأحمرلعدم تناولهفي السنة الدراسية 2022-2021

⚠ **This is a THIRD distinct wording.** Maths (p18): «تم ادراج ما هو ملّون باللون الأحمر
لعدم تناوله…» — spaced, with a shadda on ملّون. Literary (p5): «تم ادراج العناصر الملونة
بالاحمر لعدم تناولها…». Here: the words run together — `هوملون`, `الأحمرلعدم`,
`تناولهفي` — and there is no shadda. Same meaning, three sentences. **Any legend hunt that
matches on the maths document's string finds nothing in this document**, and the run-together
spelling is preserved exactly as printed. Confirmed at 600 dpi.

The year renders `2022-2021` and is stored in that order — same call be-4 and be-9 made, so
all three documents agree.

Guard satisfied: `emphasisLegend != null`, so `added-2022` is legal on those four rows.

## Genuine ambiguities — every one resolved from the page

**A1 · The week column is the least trustworthy of the three documents.** It draws a
boundary where no week starts in **five** places, and once puts the printed number on the
wrong row. Only the 6-hour invariant disambiguates:

| pdf | drawn week cells | what they really are |
|---|---|---|
| 11 | `[128–674]` blank, `[674–1143]` = **13** | both are week 13. The number **13 is printed on week 13's SECOND row**; its first row's week cell is empty |
| 12 | `[128–494]`, `[494–689]` = **14**, `[689–868]`, `[868–929]` = **15** | week 13's tail, then week 14 split across **two** cells (1+3h then 1+1h), then week 15 |
| 14 | `[128–760]`, `[760–1160]` = **17** | week 16's tail, then week 17 |
| 16 | `[128–364]`, `[364–493]` | both are week 20's tail — two cells, one week |
| 18 | `[128–219]`, `[219–840]` = **24**, `[840–1163]` = **25** | week 23's tail, week 24 (5 rows), week 25 |

A document whose weekly total were not constant would be undecidable here. be-5's
ambiguity #1 for the maths document is not an exception in this corpus — in تقني رياضي it
is the norm.

**A2 · Rows split across page breaks render their hours digit on the FIRST page only.** The
hours cell on the continuation page is empty and must not be read as a 0-hour row:
pdf 11 r1 → 12 r0 (2h), pdf 13 r4 → 14 r0 (1h), pdf 18 r9 → 19 r0 (2h). Detected from the
hours column's own rules plus the invariant, never from the visual.

**A3 · TWO cells CLIP their own text at the left border.** This document is the first in the
corpus to do it, and a visual-only read silently loses words:

| where | rendered | actually |
|---|---|---|
| week 18 r2 guidance (pdf 15) | «…من معالجة أنشطة **تتمحور**» | «…من معالجة أنشطة **في العدّ** تتمحور» |
| week 18 r2 guidance, last para (pdf 15) | «…بحيث تصبح **هذ**» / «…وضعيات مركّبة في **ال**» | «…تصبح **هذه**» / «…مركّبة في **العدّ**» |
| week 26 r1 guidance (pdf 19) | «…لمستقيمين يؤول **إل**» | «…يؤول **إلى**» |

Found mechanically: a 5-px strip immediately inside each column's left rule, scanned for
dark pixels. Only pdf 15 and pdf 19 have hits (the header/footer bars aside). The clipped
tails were recovered from the text layer and confirmed to read correctly in context. **This
is the failure mode a 150-dpi read cannot see at all** — the line simply ends and looks
finished.

**A4 · Six merged cells, all attached to the first spanned row** (be-4's convention). None
of them are visible from the row heights; each was found by comparing the rule sets column
by column:

- pdf 16: contents merged over week 20 r2+r3, and over week 22 r1+r2
- pdf 17: contents merged over week 23 r1+r2+r3
- pdf 18: contents merged over week 25 r0+r1+r2
- pdf 19: **contents AND السير both merged over week 26's 2h and 3h rows** — so week 26
  r2's `contents` and `guidance` are both `[]`, and the «نتطرّق إلى تقاطع ثلاثة مستويات»
  sentence sits on r1 even though it is level with and semantically about r2. This is the
  same cell be-5 flagged in the maths document (its ambiguity #2), and the same call.

**This is the most likely disagreement with be-10.** An independent reader who attaches by
visual adjacency will put those sentences one row lower.

**A5 · The محور column is nearly useless in this document.**

- pdf 13's محور cell is **entirely blank** — it covers week 15's middle and all of what
  the reader most wants labelled.
- u09's only label, «الأعداد والحساب», is printed rotated inside a **60-px sliver** on
  pdf 12 (week 15's first row). Same for u12's first appearance on pdf 15.
- **One summary-table unit shows three different main-table labels.** u12
  «الأعداد المركبة والتحويلات النقطية» appears as «الأعداد المركّبة» (pdf 15),
  «الأعداد المركّبة (تابع)» (pdf 16) and «التحويلات النقطية» (pdf 17).

`unitId` is assigned from the units table, never derived from a label, which is what makes
all of this harmless. But **`verify --compare` will report `unitLabel` discrepancies for
weeks 15–16 and 20–23**; that is SEED §2.3.7 behaving as designed — disposition
`seed-correct`.

**A6 · معالجة is NOT in schedule order.** The summary table lists u11 معالجة between u10
and u12, but the schedule runs: week 20 = الأعداد المركبة, **week 21 = معالجة**, weeks
22–23 = الأعداد المركبة/التحويلات النقطية. So **u11 sits inside u12's span (20, 22, 23)** —
the identical trap be-5 recorded for the maths document (its week 21). Walking the units
table in order would misassign weeks 20–23. u07 (week 11) and u14 (week 27) are in order.

**A7 · The معالجة rows merge five columns into one.** A vertical-rule scan restricted to
those bands leaves only x=160 and x=1589 — السير + المحتويات + الكفاءات + المحور are one
cell. Stored in `contents` as `["معالجة بيداغوجية"]`, matching week 11 (pass 1) and the
maths seed. `competencies` and `guidance` are `[]`, which is "this cell does not exist
separately", not "it was empty".

**A8 · One dash that is a wrap, not a paragraph break.** Week 22 r4's الكفاءات cell ends
line 1 with U+0640 ARABIC TATWEEL and wraps to «التعرّف عن تحويل…». Because the tatweel
**trails** line 1, this is one paragraph, and it is stored as **one** array element:
«تعيين الكتابة المركّبة للتحويلات النقطية المألوفة (الانسحاب، التحاكي، الدوران). ـ التعرّف
عن تحويل انطلاقاً من الكتابة المركّبة.» **The maths seed splits the same sentence into two
elements**, because in that document the tatweel leads line 2. Both are right for their own
page; recorded because `--compare` anchors will differ.

**A9 · The set-letter boxes recur exactly as be-5 predicted.** ℤ/ℕ/ℝ/ℂ render as empty
boxes at every dpi and are absent from the text layer. `$\square$` throughout (21 spans).
Writing ℤ there would be inference.

## The trap this document sets: units 8–13 are near-verbatim shared with the maths document

The integral-calculus, arithmetic, complex-number and space-geometry cells are **word-for-word
identical to `tadarroj-3as-math`** in most places. That is a useful cross-check and a very
dangerous shortcut: a transcriber who copied the maths seed for these units would produce a
file that passes A1–A8, KaTeX and every arithmetic assertion, and is wrong in the following
places. **Every cell here was read from تقني رياضي's own 300 dpi render**; these are the
divergences found, all confirmed at 600 dpi or in the text layer:

| where | تقني رياضي prints | الرياضيات prints |
|---|---|---|
| week 20 r2 contents | «حل بعض أنواع **للمعادلات** في □» | «حل بعض أنواع **المعادلات** في □» |
| week 22 r5 guidance | «**عالج** مسائل هندسية…» | «**تُعالج** مسائل هندسية…» |
| week 24 r4 guidance | «**تعمّم** تعريف الجُداء…» | «**نُعمّم** تعريف الجُداء…» |
| week 23 r1 competencies | «**التعرف** على تشابه مباشر» | «**التعرّف** على تشابه مباشر» |
| week 15 contents split | «القسمة الإقليدية في □ :» and «قابلية القسمة □» are on **two different rows** | both in one cell |
| week 22 r4 competencies | one paragraph (A8 above) | two |
| row grouping throughout | 6h weeks, 97 rows | 7h weeks, different splits |

## Source errors preserved (do not "fix" these)

Beyond the table above, everything below is printed as shown and stored as printed:

- **«حالات خاصةيكون فيها المستوي»** (week 24 r1) — `ة` and `ي` run together with no space.
  Confirmed at 600 dpi and in the text layer. It is *not* «خاصة يكون», and not «خاصةتيكون».
- **«نستعمل مبرهنة فيثاغورث لايجاد هذا الدستور»** (week 24 r3) — `لايجاد`, no hamza, in the
  same row whose contents writes `لإيجاد` with one.
- **«مستويات الاحداثيات»** in week 24 r1's guidance vs **«مستويات الإحداثيات»** in that same
  row's contents — one row, two spellings.
- **«معادلات كل من الكرة ،الاسطوانة ، المخروط الدوراني.»** — comma before the space, then
  space before the comma. Both kept.
- **«المضاعف المشترك الأصغر:.»** (week 16 r4 contents) — colon immediately followed by a
  period.
- **A lone `.` as its own paragraph**, twice: after «الأعداد الأوّلية:» (week 16 r2) and
  after «الاحتمالات المتساوية على مجموعة منتهية:» (week 18 r0). Verified at 600 dpi — it is
  a separate line in the cell, not a stray mark. Stored as a second array element `"."`.
- **«تقايساً موجباً(أو إزاحة)»** (week 23 r1) — no space before the parenthesis.
- **«الجداء السلمي وتطبيقاته. التعريف والعبارة التحليلية.»** (week 25 r0 contents) —
  completely unvocalised, while all five surrounding الكفاءات cells write
  «الجُداء السُلَّمي» with damma + fatha + shadda (`0x64f`, `0x64e 0x651`).
- **«تعريف، الكتابة المركبة حالة خاصة (التقايسات) ، مركب تشابهين مباشرين، خواص»** — space
  before the comma.
- **«من أجل $a \in \square$ و $a \in \square_{+}^{*}$»** (week 15 r2) — the page really
  prints **a twice**; it should be `b`. Same typo as the maths document, same disposition:
  preserved. And **`$0 \le r \le b$`** — both signs are ≤, which is mathematically wrong and
  is what the page says.
- **«تابع استعمال التكامل بالتجزئة»** (week 14 r0) — no final period, unlike its
  predecessor «استعمال التكامل بالتجزئة.».
- **«حل مسائل في الحساب»**, **«حل مسائل في العد باستعمال قوانين التحليل التوفيقي»**,
  **«توظيف خواص التشابهات المباشرة لحل مسائل هندسية»** — no final periods.
- **«ومستوٍ.» / «لمستوٍ.»** — no space before the period, despite what `pdftotext` shows
  (the extractor inserts one around the tanween; the 600 dpi render does not).

## How this document differs structurally from the other two

- **97 rows over 27 weeks** vs the literary document's 39 — the densest per-week table so far
  (week 22 and week 23 have six rows each, all 1h).
- **It clips text at cell borders.** Neither of the finished documents does. A per-page
  border-pixel test belongs in the method from now on.
- **Its week column lies more than the others'** — five false boundaries, and one week whose
  printed number is on its second row (A1). The maths document had one such split; this one
  has five.
- **No garbled محور cell** (unlike the maths document's doubled string), but one entirely
  blank one and two slivers, plus three different labels for one unit.
- **The معالجة rows merge five columns**, which the literary document (2h/week, no معالجة
  rows) never exercised.

## Tooling notes

- `load-programmes.mjs`, `verify-programmes.mjs` and `src/store/programmes.ts` were used
  **unmodified**. `--partial`'s resume line was the only hand-off between passes, and it was
  enough to resume a run someone else abandoned mid-document.
- The text layer's known corruptions all showed up again: the lam-alef ligature comes out
  reversed (`االحتماالت` = `الاحتمالات`), **every digit becomes `2`** (the legend's year
  extracts as `2222-2222`), and combining marks are split onto their own lines. It is
  reliable for letter identity and for clipped tails, and for nothing else.
- 300 dpi is the floor for this document, not an escalation. Three of my own 150-dpi
  readings were wrong — «في العدّ» dropped, «خاصةيكون» read as «خاصةتيكون», and week 13's
  fourth guidance paragraph mis-split — and only the crops caught them.

## Gate status

`tools/ci be --slug programme-corpus` from the job worktree: **`gate PASS`, 97/97, twice.**
The four perimeter assertions be-9 reported as red were re-baselined for the corpus
collections in `337644c`, before this pass ran.

**The promoted `be` net against the JOB checkout: 19 suites, 364/364, 0 failed** — the
SEED §6.3 baseline, unchanged, as it must be (be-6 touches no be-repo file).

> ⚠ Reproducing that run needs more environment than be-9's journal records. `tools/ci`
> cannot be asked for the promoted net from a feature branch (mode is derived from the
> branch), so jest is invoked directly — but `run_layer` also exports the **lane**:
>
> ```
> CHAR_ROOTDIR=<job>/stacks/teacher-be   CHAR_TESTDIR=<job>/tests/be
> CHAR_GUARD=<clone>/tools/tests/guard.js
> CHAR_LANE_SLOT=<slot>  CHAR_BE_URL=http://localhost:<port>  CHAR_BE_LOG=/tmp/teacher-backend.s<slot>.log
> npx jest -c tools/tests/jest.characterization.config.js
> ```
>
> with the slot/port/log read back from `tools/lanes.sh` (`lane_slot`, `lane_port`,
> `lane_log`) and a lane actually up. Omitting `CHAR_BE_URL`/`CHAR_BE_LOG` produces **5
> failures in 3 suites** — `auth-bounds`, `runlog-subject`, `persistence-gaps/revisions` —
> which read exactly like product regressions and are not: the black-box halves throw
> `CHAR_BE_LOG is unset` or grep an empty run log. I hit this before spotting it. It is the
> hollow-lane failure `tools/ci`'s own comment warns about, arriving from the other side.

## review

**Verdict: approve.**

Re-verified from the live DB: A1–A8 green at `transcriptionRev 2`, seed `unchanged` against
the store, totals 27/162, weeklyHours 6, 97 rows. The en-dash→tatweel correction adjudicated
by be-10 is applied (no U+2013 remains in any seed intro; the tatweel pair is present), and
T2 (`نتطّرق`) and T3 (`أعطيت`) are in the file. The gate claim reproduces: `tools/ci be
--slug programme-corpus` → `gate PASS 97/97` at review time. Freeze clean. One loose end is
charged to be-10's review (T4), not here. The clip-scan finding (A3) and the five false
week boundaries are exactly the material a reviewer wants and could not have invented.
