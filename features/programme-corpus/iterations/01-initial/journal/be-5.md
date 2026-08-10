# be-5 — layer-2 independent verification of `tadarroj-3as-math` (2022-09)

**Verifier:** independent agent (Fable 5), 2026-08-10.
**Method:** rendered all 19 pages with `pdftoppm -r 150` into a scratch directory, read pages
1–19 and wrote my own week-by-week reading to
`features/programme-corpus/verification/tadarroj-3as-math.l2.jsonl` **before** opening the
seed, the sample, be-4's journal, or Mongo. Ambiguous/dense regions were re-rendered at
300–600 dpi and cropped (~25 crops). Only after the l2 file existed did I open
`data/programmes/tadarroj-3as-math.jsonl` and run
`node stacks/teacher-be/scripts/verify-programmes.mjs --compare`. Every disagreement below was
settled by going back to the page, not by preferring either reading.

## Verdict

**Faithful enough to build on. No re-transcription needed.** One meaning-flipping verbatim
error and one spelling normalization need a `--correct` pass; everything else I could
challenge — structure, hours, attribution, red text, source typos — the seed got right,
including several places where my own first-pass reading was the wrong one.

Structure matched my independent reading 100%: all 27 weeks, every row count, every row-hour
vector, every pdf-page citation, and the unit assignment of every week — including the
non-obvious ones (week 21 معالجة sitting *inside* unit u12's span 20/22/23; the محور change
mid-week in week 12 and mid-week in week 22).

## Defects found (seed wrong, page right)

| # | Where | Seed says | Page says | Which is correct |
|---|---|---|---|---|
| D1 | week 25, row[3].contents (pdf p19) | «…التلاقي، انتماء 4 نقط **ليست على** نفس المستوي.» | «…التلاقي، انتماء 4 نقط **إلى** نفس المستوي.» | **The page.** Verified at 300 dpi. The seed's wording negates the ministry's meaning (belonging to one plane → *not lying on* one plane). Likely contamination from the guidance sentence below («3 نقط ليست على استقامة واحدة»). This is exactly the error class arithmetic cannot see — it is the one real misstatement in the corpus. |
| D2 | week 4, row[0].guidance (pdf p7) | «بتطبيق طريقة **أويلر**» | «بتطبيق طريقة **أولير**» | **The page** (600 dpi: alef-waw-lam-**ya**-ra). The document spells Euler three ways — أولر (p17 contents), أولير (p17 guidance ×2, p7) — and the seed preserved the p17 pair verbatim but normalized p7's to أويلر. Verbatim rule says keep أولير. |
| D3 (cosmetic) | emphasisLegend / week 24 row[0].guidance (pdf p18) | «تم ادراج ما **هو ملوّن** باللون الأحمر…» | printed run-together: «ما **هوملّون** باللون الأحمر» | The page has no visible space (bold Arabic, likely a typing slip in the source). Seed inserted the space. I'd call the seed's reading the intended text; flagging only because the rule is verbatim. Not worth a correction on its own. |

Nothing omitted and nothing invented anywhere else: I checked every week's cells against the
seed, plus the intro, the مذكرة منهجية, ملامح التخرج, all six competency domains, and the
units table.

## Where the seed is right and a careful reader could go wrong

These are positive confirmations — each one is a place my own pass-1 reading or a plausible
transcriber instinct disagreed with the seed, and the page sided with the seed:

- **`0 ≤ r ≤ b` (pdf p13).** Both signs really are ≤ (mathematically wrong; should be `< b`).
  Seed preserved the source typo. Confirmed at 600 dpi and in the text layer (U+F0A3 twice).
- **`a ∈ □ و a ∈ □*₊` (pdf p13).** The page literally prints the letter **a twice** (should be
  b ∈ ℕ*). Seed preserved it. Confirmed at 600 dpi.
- **The double-struck set letters (ℤ/ℕ/ℝ/ℂ) are unrecoverable from this PDF.** They render as
  empty box glyphs at every dpi *and are absent from the text layer* (the Symbol-font ∈, =, ≤
  survive as PUA codepoints; the set letter itself yields no character). The seed's `$\square$`
  is the honest transcription — any concrete ℤ/ℕ there would have been inference. This will
  recur in the other four documents.
- **«ln a» twice where «ln» is meant (pdf p8)** — seed keeps both, verbatim.
- **«اثبات تجاور متتاليتان» (pdf p10)** — kept with the source's grammatical slip (متتاليتان,
  not متتاليتين).
- **«خواصهما» (pdf p9), «حجر النرد» (pdf p16), the paren placement in «تُعطى مبرهنات الحصر
  (نهاية منتهية، غير منتهية، وكذا … نهايتين).» (pdf p8)** — my own draft had all three
  slightly wrong; the page matches the seed. (My l2 file carries the corrections.)
- **Week-1 wording differs between pages and the seed keeps both:** units table (pdf p5)
  «تقويم تشخيصي **لمكتسبات** التلاميذ» vs the week-1 row (pdf p6) «تقويم تشخيصي **للمكتسبات**
  التلاميذ». Source inconsistency, correctly not harmonized.
- Stray source punctuation preserved (« الأعداد الأوّلية .», «المضاعف المشترك الأصغر:.»,
  «توظيف المحاكاة في بناء نموذج احتمالي**؟**» in the competencies).
- All spot-checked mathematics is faithful: the four growth-comparison limits (p9), the
  differential notations d²f/dx², dy = f′(x)·dx, Δy ≈ f′(x)·Δx, y′=y ، y′=1/x (p7),
  exp(x+y)=exp(x)×exp(y) (p7), a^b = e^{b ln a} (p9), Chasles/mean-value/negative-f integral
  properties (p12), ∫πf² for volumes (p12→13), PGCD/PPCM identities (p13–14), z²=z₀ (p16),
  e^{iα} = cos α + i sin α (p17), z′ = a z̄ + b (p18), N = a₀+a₁x¹+⋯+aₙxⁿ (p13).

## The red-text finding

**A legend EXISTS in this document — the sub-issue brief's premise ("no legend on its page")
is wrong for this document.** On pdf page 18, in the السير المنهجي cell of week 24's first
row, printed in **bold black**:

> تم ادراج ما هوملّون باللون الأحمر لعدم تناوله في السنة الدراسية 2021-2022

("What is coloured red was included because it was not covered in school year 2021-2022.")

The seed found it too: `emphasisLegend = {text…, pdfPage: 18}` and the red rows carry
`added-2022`, which is the correct enum per the contract's guard. Its placement is terrible —
inside one row's guidance cell, not in a header or footnote — so for the other four documents
the legend hunt must include *cell contents*, not just margins.

Every red block, verified at 300 dpi (all of them in weeks 24 only, and **all red content sits
in the المحتويات المعرفية column — the الكفاءات column is empty for all four rows**):

| pdf page | row (hours) | red text |
|---|---|---|
| 18 | 24-r0 (2h) | contents: «استعمال الأشعة لإثبات توازي شعاعين واستقامية ثلاث نقط.» «البرهان على أنّ أشعة من نفس المستوي.» (guidance of this row is the black legend) |
| 18 | 24-r1 (1h) | contents: «التعليم في الفضاء: تعليم نقطة أعطيت إحداثياتها.» «تعيين معادلة لمستوٍ موازٍ لأحد مستويات الإحداثيات.» «تعيين معادلات مستقيم معرّف بنقطة وشعاع توجيه له.» + guidance also red: «تهدف هذه الفقرة إلى تمكين التلاميذ من التعليم في الفضاء…» |
| 18 | 24-r2 (1h) | contents: «إثبات أنّ أشعة معطاة تنتمي إلى نفس المستوي.» |
| 19 | 24-r3 (1h) | contents: «المسافة بين نقطتين: استعمال مبرهنة فيثاغورث…سطح كرة، الاسطوانة الدورانية، المخروط الدوراني.» + guidance also red: «نستعمل مبرهنة فيثاغورث لايجاد هذا الدستور…» |

No red anywhere else in the 19 pages (pass-1 sweep at 150 dpi, where red is unmistakable).
One false alarm: what looked like a yellow mark under «(النهايات)» on pdf p8 at 150 dpi is a
rendering artifact — absent at 300 dpi.

## Genuinely ambiguous on the page (these will recur in the other four documents)

1. **The week column can split where no week boundary is (pdf p17).** Week 22's hour rows are
   1+2+1+1+1+1. The week column draws "22" over the first four rows (5h) and then an
   *unnumbered* cell over the last two rows (2h, where the محور changes to التحويلات
   النقطية). Read naively, week 22 has 5 hours and week 23 has 9. Only the 7h/week invariant
   forces the correct grouping. A document whose weekly total isn't constant would be
   undecidable here — check the week column against hours *before* trusting either.
2. **Merged cells attach ambiguously; the seed's convention is "first spanned row".** Verified
   spans: week 10 competencies (one cell across all 3 rows — two statements, including the bold
   «اثبات تجاور متتاليتان»), week 20 contents («حل بعض أنواع المعادلات في □» spans rows 2–4),
   week 26 guidance (one cell across the 2h and 3h rows — the «نتطرّق إلى تقاطع ثلاثة مستويات»
   sentence is level with, and semantically about, the 3h row, but the cell is merged). The
   convention is consistent and defensible, but it silently drops the span extent; a course
   layer attaching to guidance rows should know that an "empty" guidance cell may be covered
   by the row above. My own first crop of week 10 misread a neighbouring column's border as a
   cell boundary — narrow crops lie; always crop wide enough to see the full column.
3. **The محور cell is not the unit name.** For weeks 7–8 the vertical محور cell literally reads
   the doubled string «التزايد المقارن و الدوال العددية التزايد المقارن ودراسة الدوال» (rotated
   and confirmed). Unit names must come from the units table (pdf p5), which the seed does.
4. **Units-table order ≠ schedule order.** The table places معالجة between الإحصاء and الأعداد
   المركبة, but the schedule puts it at week 21, *inside* the complex-numbers unit
   (20, 22, 23). Deriving week→unit by walking the table in order would misassign weeks 20–23.
5. **The set-letter boxes** (item above): invisible in render and text layer both. `$\square$`
   plus context is all this PDF can support.
6. **Where a "week 3" begins on the page before its number is printed** (rows at the bottom of
   pdf p6 belong to week 3 whose number prints on p7) — page-spanning weeks need the hours
   invariant again.

## Tooling notes

- `verify-programmes.mjs --compare` ran (27 vs 27 weeks) and reported 112 discrepancies, all
  but a handful being anchor-prefix truncation artifacts (my l2 anchors are longer than the
  tool's compare window) plus my three since-corrected misreads. The two real defects D1/D2 it
  cannot see: D1 is inside a contents string beyond the anchor prefix, D2 is a guidance word.
  Full-text L2 spot-checking by eye remains necessary; the tool checks structure, not text.
- `pdftotext` is indeed unusable for content (confirmed: RTL/digit scrambling), but it *is*
  useful as a secondary hint for identifying Symbol-font PUA codepoints (∈, ≤, =) in dense
  math — used here only to corroborate what the 600 dpi render already showed.

## Budget

Pass 1 (all 19 pages, 150 dpi, full reading + own notes): one sitting — the 6–8 pages-per-pass
estimate is roughly right for *transcription-grade* reading of the table pages; front matter is
fast. Pass 2 (~15 targeted 300–600 dpi crops for dense math, red text, cell borders) and
pass 3 (~10 more crops to adjudicate seed-vs-me disagreements) each cost about as much as half
a full pass. Total ≈ 2.5 of the budgeted 4 passes. The crops are not optional: three of my own
pass-1 readings were wrong and only high-dpi re-reads caught them; the same will hold for any
single-pass transcription of the remaining documents.

## Recommended actions (report only — nothing was modified)

1. `--correct` rev 2 fixing D1 (week 25 row[3].contents → «انتماء 4 نقط إلى نفس المستوي.») and
   D2 (week 4 guidance → «أولير»). D3 optional.
2. Record conventions 1–5 above in the transcription contract before the next four documents
   are attempted — every one of them is a trap this document merely happened to survive.
