# be-10 · Layer-2 verification — تقني رياضي (19pp) + علوم تجريبية (17pp)

Independent re-read of both documents, page-first: rendered all 36 pages at 150 dpi,
wrote `verification/tadarroj-3as-{techmath,sciences}.l2.jsonl` **before** opening either
seed, then ran `--compare` and took every discrepancy back to the page at 300–1200 dpi.
A pixel sweep (r>120, g,b<90) located every red band before any table was read, so the
emphasis rows come from ink, not expectation.

## Compare result

- **techmath**: 27/27 weeks structure-match — rowCount, rowHours, rowEmphasis,
  weekNumberPrinted all agree. 34 anchor flags; all but 4 were my own truncated-math or
  shorter anchors (the tool compares first 6 tokens; seed tokens include `$…$` runs).
- **sciences**: 27/27 weeks structure-match. 33 anchor flags; all but 3 were anchor
  truncation or the stripped default dash-bullet (be-4/be-7 convention, `ـ` stripped —
  my l2 kept it; seed convention correct).

Where my l2 and the seed disagreed and the page was re-read, **the seed won 6 of 9**
(my 150 dpi read had hallucinated ومستوٍ for ومستو in w26, وتطبيقاته for وتطبيقات in
sc w25, and dropped the شدّة of أنّ, the fatha of السُلَّمي, the trailing periods). The
zooms are in the scratchpad; every verdict below is from ≥300 dpi ink.

## THE TWO ADJUDICATIONS

### (a) Bidi order of adjacent `$…$` runs — **be-7 is right; the maths seed is reversed**

Glyph geometry (mutool stext, legitimate for bbox questions), math PDF **page 7,
y=142.4**: `cos(ax+b)` at visual x=259.1, `sin(ax+b)` at x=151.9 — **cos is the
rightmost run**, therefore logically FIRST in the RTL sentence. The identical line in
my two documents agrees: techmath p7 (cos x=237.6 > sin x=129.6) and sciences p6
(cos x=232.9 > sin x=127.5). The same rule holds for the week-3 competency bullet
(`x↦cos x` prints right of `x↦sin x`, both docs).

**Verdict: the page prints cos first. `tadarroj-3as-math`'s `sin ، cos` on that bullet
is a transcription defect worth a `--correct` on the maths seed. The techmath and
sciences seeds store cos-first and are correct.**

### (b) EN DASH vs two TATWEELs — **be-8 is right; math/techmath's EN DASH is wrong**

The intro's year separator, all three PDFs I probed (techmath, sciences, math), is
**two U+0640 ARABIC TATWEEL glyphs**, proven three independent ways:

1. **Two extractors agree on the codepoints**: poppler pdftotext yields `ــ`
   between the year groups; mutool stext maps the same two glyphs to U+0640.
2. **Glyph geometry**: two glyphs, advance 3.35pt each, font **Arial** (the digits are
   a separate **Calibri** run — a real en dash typed inline would share the digits'
   run), ink band 2.28pt above baseline, 1.36pt thick. The in-word kashidas of
   `المــتتاليـات العدديـــة` (p5) sit 2.01pt above baseline — same stroke class. An
   en dash sits at ~0.25–0.3 em (≈4–5pt at this size). The separator is at kashida
   height, not dash height.
3. **Byte-identical across documents** (same x-positions, same fonts, same quads in
   techmath/sciences/math p2) — confirming the "all five extract identically" premise.

Caveat handled: this font's ToUnicode is corrupt for **digits** (both years extract as
"2222"), so the text layer alone would be inadmissible; the geometry and the Arial/
Calibri run split settle it independently.

**Verdict: the page prints `2022 ــ 2023` (two tatweels). `tadarroj-3as-sciences` and
`lettres` are right; `tadarroj-3as-techmath` (and per be-8, `math`) store an EN DASH
and need a `--correct`.** This is the one non-cosmetic defect I found in the techmath
seed. Note the techmath **legend** (p18) year pair is a *different* string again —
`2022-2021` with a plain HYPHEN and reversed order — and the seed stores exactly that;
correct there.

## Discrepancies — the full list, each decided from the page

### techmath (`tadarroj-3as-techmath.jsonl`)

| # | where | seed says | page says (dpi) | correct |
|---|---|---|---|---|
| T1 | `frontMatter.intro` year separator | EN DASH `2022 – 2023` | two TATWEELs (1200 dpi + glyph run analysis) | **PAGE — seed defect, needs `--correct`** (adjudication b) |
| T2 | w20 r4 guidance (pdf 16) | `نتطرّق إلى الجذرين التربيعيين لعدد مركّب.` | **`نتطّرق`** — the shadda sits on the ط, not the ر (600 dpi) | **PAGE — seed micro-defect** |
| T3 | w24 r2 contents (pdf 18, red) | `تعليم نقطة أُعطيت إحداثياتها` | **`أعطيت`** — hamza only, no damma (600 dpi) | **PAGE — seed micro-defect** |
| T4 | w6 r4 contents (pdf 9) | `المستقيم المقارب المائل .` | **`. المستقيم المقارب المائل.`** — a stray dot at the RTL *start* of the cell **plus** the attached sentence period (300 dpi). A leading isolated dot in an RTL paragraph renders at the right end, which is where the ink is; a trailing ` .` would render at the left end of the last line, where there is a *second*, attached dot | **PAGE — seed places one dot at the wrong end and drops the other** (micro; possibly a bullet-stripping judgement, see ambiguities) |
| — | w26 r3 guidance empty, both sentences on r2 | merged cell | one guidance cell spans rows 2–3 (border check, 300 dpi: comp column has 3 bordered cells, guidance has 2) | **SEED — correct** per attach-to-first-spanned-row convention; my split read was naive |
| — | w26 r2/r3 `ومستو` (no tanwin) · w15 r1 `أنّ` · `السُلَّمي` (fatha over shadda, 1200 dpi) · w25 r1 `لمستوٍ.` · legend verbatim incl. `هوملون`/`الأحمرلعدم`/`تناولهفي`/`2022-2021` · w15 r3 duplicated `$a$` in `من أجل a∈… و a∈…` (source typo kept) · w25 r3 formula order `حيث AM·u=k أو بصفة عامة αMA²+βMB²=k` | — | — | **SEED — all correct**; my l2 was wrong on the first four |

### sciences (`tadarroj-3as-sciences.jsonl`)

| # | where | seed says | page says (dpi) | correct |
|---|---|---|---|---|
| S1 | w18 r3 guidance (pdf 13) | `نتطرّق إلى الجذرين التربيعيين لعدد مركّب.` | **`نتطّرق`** — shadda on the ط (600 dpi), same as techmath | **PAGE — seed micro-defect** |
| S2 | w6 r2 + w8 r2 contents (pdf 8, 9) | `["النهايات باستعمال المبرهنات المتعلقة بالعمليات", "على  النهايات ."]` | **`. النهايات باستعمال …`** — the stray dot is at the RTL *start* of line 1 (300 dpi); no dot visible after `النهايات` on line 2 | **PAGE — seed carries the dot at the wrong end** (micro, ×2 rows; same class as T4) |
| — | w25 r1 contents `وتطبيقات له` · w23 r3 comp list incl. the literal **`5،`** item continuing `الهندسة التحليلية في الفضاء.` across the page break · legend `تم ادراج  ما هو ملون بالأحمر  لعدم تناوله في  السنة الدراسية 2021 -2022.` (double spaces, space-hyphen) · red `●` guidance bullet kept · w26 r1: كفاءات filled, محتويات EMPTY, `استعمال التمثيلات الوسيطية…` in guidance · `عيين الدالة أصلية` (w13, dropped ت — not clipped: whitespace on both sides at 300 dpi) · `اقتراح متتاليات` vs techmath's `تقترح` | — | — | **SEED — all correct, verbatim including the typos** |

### Emphasis / red — verified by pixel sweep then per-row reading

- **techmath**: red exists ONLY on pdf 18. Week 24 rows 1–4 red (contents + guidance;
  the r1 guidance cell holds the black bold LEGEND, its contents are red); **row 5
  (`توظيف الجُداء السُلَّمي لإثبات تعامد…`) is black — red ends MID-WEEK**. Weeks 25–27
  black. Seed's `added-2022` rows match exactly, and `emphasisLegend.pdfPage: 18` ✓.
- **sciences**: red on pdf 15–16 only. It **STARTS mid-week**: week 23 rows 3–4 red
  (r3 carries the legend in black inside its guidance, plus the red `●` bullet), all
  five rows of week 24 red, week 25 black — so it ends at a week boundary here. Seed
  matches row-for-row.

## Ambiguities a careful reader could take either way

1. **The stray dots (T4, S2).** Each is plausibly a degenerate bullet (the documents'
   default bullet is a dash-like glyph that the convention strips) rather than
   punctuation. If read as a bullet, stripping it would be the convention-conformant
   move — but then techmath's `المائل .` should have kept only the *attached* period.
   Either way the current strings don't quite match the ink; worth one deliberate
   convention sentence in a `--correct`, not silent edits.
2. **`السُلَّمي`**: the fatha stacked on the shadda is invisible below ~1200 dpi. The
   seeds are right; any future verifier reading at 300 dpi will "find" a defect here
   that is not one.
3. **The `▱` box glyphs** (ℤ/ℕ/ℝ/ℂ positions) are stored as `$\square$`. The print
   really shows tofu boxes — the intended set symbol is unrecoverable from the page.
   Faithful-to-print, consistent across both documents; just don't let anyone
   "restore" the intended symbols from mathematical context without marking it.
4. **techmath w26 guidance merge**: text visually level with the 3h row belongs to a
   cell spanning rows 2–3. The attach-to-first convention makes the seed right, but
   the visual reads the other way at first pass — the exact merged-cell trap this
   layer exists for; here the seed survived it.
5. **shadda placement varies by instance in the source itself**: w26's `نتطرّق` (ر) is
   printed differently from w20/w18's `نتطّرق` (ط). Each occurrence must be checked
   individually, not normalised.

## Verdicts

- **tadarroj-3as-techmath: faithful — build on it after one `--correct`** for the
  intro's EN DASH→two-tatweels (T1); fold in T2–T4 (two diacritics, one dot placement)
  in the same pass. No attribution errors found; structure, hours, emphasis and the
  hazard cells (legend, red block, merged cells, formula bidi order, preserved source
  typos) are all right.
- **tadarroj-3as-sciences: faithful — build on it as-is.** S1/S2 are two micro items
  (one shadda position, one dot end) worth batching into any future `--correct`;
  nothing structural, nothing attributional.

Files: my independent readings are
`features/programme-corpus/verification/tadarroj-3as-techmath.l2.jsonl` and
`…/tadarroj-3as-sciences.l2.jsonl`; compare runs:
`node stacks/teacher-be/scripts/verify-programmes.mjs --compare data/programmes/<doc>.jsonl <l2>` —
techmath 34 flags / sciences 33 flags, all adjudicated above.

## review

**Verdict: approve-with-debt.**

Both adjudications verified as applied, not just decided: (a) the maths seed now stores
cos-first on the wk-3 trig bullet (checked every cos+sin string in all three dense seeds —
all cos-first) with `programme_revisions` rev-2→3 recording it; (b) no U+2013 remains in
any of the five intros and the tatweel pair is present in all five. techmath is at rev 2
with T2/T3 folded in as promised.

Debt:

1. **T4 was not applied.** The verdict says "fold in T2–T4 in the same pass"; the seed
   still reads `المستقيم المقارب المائل .` (one dot, at the end this journal says is the
   wrong end). T2 and T3 landed; T4 did not, and no note records deferring it — the verdict
   text and the applied set disagree. One-line `--correct` or one sentence of deferral.
2. The contract-named `<docKey>.l2-report.md` files were never created for either document;
   the 34/33 anchor flags were dispositioned in bulk in this journal (see be-5's review —
   same debt, same reasoning).
