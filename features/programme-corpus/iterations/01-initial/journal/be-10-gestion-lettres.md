# be-10 — Layer-2 verification: تسيير واقتصاد (gestion) + آداب وفلسفة/لغات أجنبية (lettres)

Independent re-read of all 18 pages (150 dpi full pages, 300–600 dpi crops on every
uncertain cell), own reading written to
`features/programme-corpus/verification/tadarroj-3as-{gestion,lettres}.l2.jsonl`
BEFORE opening either seed, then compared with
`verify-programmes.mjs --compare` and adjudicated cell by cell on the page.

Method note: the L2 files are the record of the *independent pass* — where this journal
says "L2 was wrong", the L2 file deliberately keeps my pre-comparison reading; this
journal is the adjudication.

---

## Verdict

| document | verdict |
|---|---|
| **gestion** | **Faithful — build on it.** One word-level omission to patch (week 24), one unmarked reconstruction convention to record (weeks 16/18). Everything else checked — including every trap I could find — is transcribed exactly, typos and all. |
| **lettres** | **Faithful — build on it.** No defects found at all. Every kept-typo I hunted (أسابع، توترات، علم تاريخه، the week-13 cluster) is real on the page and real in the seed. |

---

## The two claims, decided from the pages

### (a) gestion week 9 unitId — be-8 is RIGHT

600 dpi of pdf p7's right edge settles it structurally:

- Week 8's fourth hour (the 1h `المستقيمات المقاربة` row, first row of p7) has an **empty
  fragment cell of its own in the محور column** — the tail of the النهايات cell split by
  the page break. The **دراسة الدوال cell starts exactly at week 9's first row**.
- So the محور column puts the unit boundary at the 8/9 week boundary: week 8 → u04
  النهايات, week 9 → u05 دراسة دوال. That is what the seed encodes. Correct.
- The summary's `أسبوع ونصف / أسبوع ونصف` (6h/6h) cannot be mapped onto the table at all:
  by content, week 8 holds 3h of نهايات rows plus the 1h asymptotes row, and weeks 9–10
  are 8h of دراسة الدوال. **Weeks-per-unit ≠ the summary's weeks column for this
  document** — a summary-vs-table inconsistency in the source, not a transcription error.

### (b) The legends — both seeds exactly right, including the year-digit order

| doc | text (verbatim) | where | colour named? | year block as printed |
|---|---|---|---|---|
| gestion | `تم ادراج هذا المحور لعدم تناوله في تدرجات السنة الدراسية 2021 - 2022` | pdf p5, week-2 **guidance cell**, black bold | **no** | `2021 -` ends line 1, `2022` on line 2 — spaced dash, reads 2021 - 2022 (600 dpi verified) |
| lettres | `تم ادراج العناصر الملونة بالاحمر لعدم تناولها في السنة الدراسية 2022-2021` | pdf p5, week-2 row-1 **guidance cell**, black bold, red bullets follow in the same cell | yes (بالاحمر) | **`2022-2021`**, unspaced — the page genuinely prints the inverted order (600 dpi verified); bidi-consistent with a logical `2022-2021` string |

The seeds' disagreement on digit order is the *documents'* disagreement. Both seeds match
their page.

---

## Emphasis / red — pixel sweep, all 18 pages

- **gestion: exactly ONE red row — confirmed.** Red pixels (255,0,0) exist only on pdf p5,
  y-band of week 2, x-band of the **contents cell only**: the two-line
  `عموميات حول المتتاليات…` text plus the equation line
  `u_{n+1}=u_n+b و u_{n+1}=au_n`. The legend sentence in the same row's guidance cell is
  **pure black** (bold) — sampled, zero red pixels. Nothing else in 10 pages is red.
- **lettres: red confined to pdf p5, ends mid-week 4 — confirmed.** Five red rows: week 2
  rows 1–2, week 3 rows 1–2, week 4 row 1 (contents, the guidance bullets under the black
  legend line, and the **hour digits** of those rows are red). Week 4 row 2
  (`التعرّف على متتالية بالتراجع…`) is black — red stops inside the week. Seed emphasis
  values match row-for-row (`added-2022` ×5, `normal` elsewhere).
- Nice micro-confirmation of the boundary: the red rows print `الاولى` (no hamza), the
  black row right after prints `الأولى` — both kept correctly in the seed.

---

## Discrepancies — gestion

### Real seed defect (1)

1. **Week 24, row 1 (الأمل الرياضياتي), guidance — one word omitted.**
   - Page (600 dpi, pdf p10): `تستخرج المفاهيم الأساسية انطلاقاً من تجارب عشوائية متقطعة ذات إمكانيات عددية.`
   - Seed: `تستخرج المفاهيم الأساسية من تجارب عشوائية متقطعة ذات إمكانيات عددية.`
   - **The page is right; the seed dropped `انطلاقاً`.** Needs a `--correct` pass.

### Unmarked reconstruction in the mis-anchored-equation cells (record, decide policy)

2. **Week 16 row 1 and week 18 row 2 (the معرفة وتفسير النهايات cells).** The printed
   token stream is not a sentence (equation objects mis-anchored — be-8's own flag):
   - Week 16 prints a stray floating `x` after `معرفة وتفسير النهايات:` (line 1, far
     left) and its last line prints `تتضمن ln x  x^n` with **no `و`** between the tokens.
   - Week 18's last line likewise prints `x^n  e^x` with **no `و`** (600 dpi checked).
   - The seed renders both as clean sentences: `…تتضمن $\ln x$ و $x^{n}$` /
     `…تتضمن $x^{n}$ و $e^{x}$` — i.e. it **inserted a `و` the page does not print and
     dropped the stray `x`, with no note marking the reconstruction**. Meaning-preserving
     and almost certainly what the author intended, but it is the one place the seed is
     not strictly verbatim. Suggest: keep the reading, add a transcription note (the
     same courtesy the seed's `؛`-line-initial in week 16 already extends), so
     empty-vs-omitted stays auditable.
   - Everything else in those cells is impressively faithful: the line-initial `؛`, the
     `lim_{x⤳0}` with the small `>` over the arrow, and week 18's **duplicated limit**
     (`lim_{x→-∞} xe^x = 0 . lim_{x→-∞} x e^x = 0` — printed twice on the page, kept
     twice in the seed, verified at 600 dpi).

### Places I initially read differently and the SEED is right (adjudicated against my L2)

3. **Week 8/9 competencies (`إثبات وجود مستقيم مقارب مائل…`).** I first attributed it to
   week 9. 600 dpi shows the competencies column on p7 is **one merged cell with no
   internal border**, containing both `تعيين المستقيمات…` and `إثبات وجود…`, spanning
   week 8's carried-over row and week 9's first row. Anchoring it all at week 8 row 2 is
   the seed's consistent first-row policy. Week 9 row 0 fully empty in the seed is the
   *page's* structure, not an omission. (This is be-8's flagged straddle #1 — genuine
   ambiguity, seed's resolution defensible and consistent.)
4. **Week 23 row 0 — `إنشاء مستقيم تعديل خطي. (تابع)` is in the CONTENTS column.** 600 dpi:
   same column as `أمثلة لسلاسل احصائية…` below it. Seed right, my L2 wrong. (Quirk of the
   page: week 22 put the parent phrase in *competencies*, week 23 puts the (تابع) in
   *contents* — the seed mirrors the page's own inconsistency, which is correct behaviour.)
5. **Week 15 row 1 guidance — the page prints `لهده الدالة` (dal, no dot).** Seed keeps the
   typo; my L2 silently corrected it to لهذه. Seed right — and this is exactly the failure
   mode L2 verifiers are warned about, on the other foot.

### Non-defects worth one line

- unitLabel variants: the units table (p4) vs the rotated محور column disagree in the
  source — `المــتتاليـــــات` vs `المتتاليات العددية`, `دراسة دوال` vs `دراسة الدوال`,
  `الاحصاء` vs `الإحصاء`. The seed's `units[].nameText` takes the summary cell per the
  schema; correct.
- Week 19/20 contents straddle (`حل مشكلات متعلقة بإيداع أو تسديد…`) anchored at week 19
  row 2, week 20 row 0 empty — same first-row policy, matches the merged cell (be-8's
  straddle #2).
- Confirmed kept as printed: week-1 `للمكتسبات` vs unit `لمكتسبات`; `3أسابيع` (no space);
  `أسبوعان` vs `أسبوعين`; week-24 competencies' **leading colon** (`: تعيين…`); week-26
  row-0 contents = a **lone period**; week-22 `عددين`/`عدديين` per cell; week-23
  `أو. (ln x ; y)` stray period.

## Discrepancies — lettres

**None that survive adjudication.** Points checked and settled in the seed's favour:

1. **Week 14 competencies**: I read an extra `بيانيا` after `وتمثيلها`; 600 dpi shows the
   line ends `…وتمثيلها` — seed (`دراسة دوال عددية وتمثيلها حل المعادلات بيانيا…`) right,
   my L2 wrong. (The cell is itself a non-sentence — line order as printed.)
2. **Units table spellings are real**: `7 أسابيع` (u02) but `7 أسابع` (u06) and `4 أسابع`
   (u09) — verified at 600 dpi, missing-ي and all; also `اسبوعان`/`أسبوعان`, `4 ساعة` vs
   `4 ساعات`, `14 ساعات`, `14ساعة` (no space), totals `27 اسبوع`. Seed matches every one.
3. **Week 23 guidance `توترات النتائج… توتراتها النظرية`** (missing alef, twice) while the
   contents cell prints `تواترات` — 600 dpi confirmed, seed keeps both as printed.
4. **Week 13 typo cluster** (`انشطة، اجل، ابراز، ان، الى، حلات اخري`) and week 12's
   `علم تاريخه` — on the page, in the seed.
5. Merged-cell anchoring is consistent: week 7/8 guidance (`v_n = u_n − b/(1−a)…`,
   lowercase `s_n` vs week 8's uppercase `S_n` kept per cell), week 24/25 guidance
   (including the p8 continuation `تمديد العمل المنجز…`), week 25's page-split contents
   rejoined into one string.
6. Cosmetic-only, no action: seed renders the page's `......` (six dots) in `s_n=u_1+…`
   as `\ldots`, and week 13's closing dash as `-` where the page's dash could be read as
   `ـ` — both inside the allowed maths/typography latitude, noted for completeness.

## Ambiguities where a careful reader could genuinely go either way

- **gestion wk8/9 competencies + guidance cells** and **wk19/20 contents cell** — both are
  single merged cells straddling a week boundary whose first row is fully empty on one
  side; first-row anchoring (the seed's choice) vs semantic anchoring (my first instinct)
  are both defensible. The seed is at least *consistent*, which is the property that
  matters for a corpus.
- **lettres wk7/8 guidance cell** — same shape, same resolution.
- **The three mis-anchored equation cells** (gestion wk16, wk18; lettres wk7's
  `مع a≠0 و b≠0 :` colon placement) — printed token order is not a sentence; any
  transcription is an interpretation. Only gestion wk16/18's invented `و` + dropped stray
  `x` actually changes the token inventory; flagged above as the one policy call to
  record.

## Errata for the be-8/be-9 record

- The claim "gestion has exactly one red row" is **true** and now pixel-verified; note the
  precision that within that row only the *contents* cell is red — the legend sentence
  sharing the row is black bold.
- gestion's legend year order is `2021 - 2022` (spaced, wrapped); lettres' is `2022-2021`
  (unspaced, visually inverted). Any attempt to "harmonise" these across documents would
  be a defect.

## review

**Verdict: approve-with-debt.**

The gestion fix is applied and audited: `انطلاقاً` is in the seed, gestion is at rev 2, and
the revision row holds the superseded doc. Lettres needed nothing and is at rev 1 —
consistent. The pixel-sweep-before-reading method makes the emphasis verification here the
strongest in the job; the mid-week red boundaries (lettres wk 4, sciences wk 23) are
exactly what a row-level `emphasis` field exists to capture and both seeds match.

Debt (shared with the other be-10 journal): no `<docKey>.l2-report.md` disposition files;
the weeks-16/18 reconstruction policy is recorded only in be-8's journal appendix, with no
marker in the data itself. Additionally, sciences S2 (dot at the wrong end, ×2 rows)
remains unapplied — explicitly deferred as batchable, which is a recorded disposition, so
this is a note, not a defect.

### debt closed (micro-loop)

The techmath/sciences journal carries the record: **T4 is applied** (techmath rev 2 → 3) and
**sciences S2 is deliberately not** — one page, two rows, cosmetic, batched into whatever
`--correct` sciences next needs. It is now a written decision instead of a silence. The
`<docKey>.l2-report.md` debt is untouched: this journal is still the disposition of record.
