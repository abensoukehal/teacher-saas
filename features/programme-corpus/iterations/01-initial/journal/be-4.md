# be-4 — transcribe شعبة الرياضيات

> ⚠ **RECONSTRUCTED, not first-person.** The agent that transcribed this document died
> before writing a journal. This file was backfilled afterwards (micro-loop, closing REVIEW
> debt 1) from artifacts only: the five pass commits `d053486 · d9010f6 · 5fc72d1 · d841e19 ·
> a01634f`, the be-repo commit `bbdf7cc` those passes produced, the seed file itself, the
> sub-issue in `stacks/be.md`, `transcription-sample.md`, and be-5's independent re-read.
>
> Everything below is *derivable from those*. Where a real journal would record a judgement
> — why a cell was read one way — this one can only report what the file ended up saying. It
> is a record of the work, not a record of the reasoning, and it should not be quoted as if a
> transcriber wrote it. The one place that distinction matters most is marked in place.

## The document

`tadarroj-3as-math-2022.pdf`, 19 pages · شعبة الرياضيات · وزارة التربية الوطنية — المفتشية
العامة للتربية الوطنية · edition `2022-09`. The hardest of the five and deliberately first:
the sub-issue's intent was to break the schema where breaking is cheapest, and this is the
file the user gate was judged on.

What it produced — `data/programmes/tadarroj-3as-math.jsonl`, 28 lines:

| | |
|---|---|
| weeklyHours · totals | **7** · `{weeks: 27, hours: 189}` — 189 = 7 × 27, A3's whole point |
| units | 14, `u01…u14`, incl. **three** معالجة rows and one تقويم تشخيصي — repeated names, distinct assigned ids |
| weeks · rows | 27 · 103 |
| competency domains | 6 |
| frontMatter | all three present (intro 1209 ch · مذكرة منهجية 1801 ch · ملامح التخرج 1162 ch) |
| weekNumberPrinted | printed on all 27 — this document never omits it (the unprinted-number case shows up in the other four) |
| unitId | never null; every week belongs to a محور |
| pdf pages cited | 6–19, and **8 of 27 weeks straddle a page break** (3, 6, 12, 14, 16, 19, 23, 24) |
| emphasis | four `added-2022` rows, all in week 24 |

## The pass trail

Budget was **5 passes**. It used exactly 5, and each one is a commit whose content the
`--partial` gate had to accept before it could be written:

| # | commit | weeks | pdf pages | what the diff shows |
|---|---|---|---|---|
| 0 | `d053486` 05:06 | — | 1–5 | the `programme` line alone: front matter + the 14-row summary table. A1–A3 computable from this one line, which is the gate that catches a mis-read total *before* any week is typed. Also carries the live-db guard's six clauses (below). |
| 1 | `d9010f6` 06:07 | 1–8 | 6–9 | +8 lines, nothing rewritten |
| 2 | `5fc72d1` 06:42 | 9–15 | 10–13 | +7 lines, **and week 8 re-read** (below) |
| 3 | `d841e19` 07:10 | 16–21 | 13–16 | +6 lines, nothing rewritten |
| 4 | `a01634f` 09:33 | 22–27 | 16–19 | +6 lines, **and the programme line rewritten to carry the legend** (below) |

Two of the five touched an earlier line, which is the protocol working rather than failing —
a pass may only commit *closed* weeks, and re-reading a page is cheap:

- **Pass 2 re-read week 8's guidance** (pdf p9) and changed one token:
  `$a \in \mathbb{R}_{+}^{*}$` → `$a \in \square_{+}^{*}$`. That is the tofu-box convention
  arriving: the double-struck set letters in this PDF render as empty boxes at every dpi and
  are **absent from the text layer entirely**, so `\square` is the honest reading and a
  concrete `\mathbb{R}` was inference. be-5 later confirmed the same thing independently, and
  be-10 recorded it as a standing ambiguity for all five documents. Pass 2 also re-serialised
  the programme line (compact → spaced JSON); the parsed object is identical, verified.
- **Pass 4 set `emphasisLegend`** — see below.

## The stop-and-ask: p19's red, and where the legend actually was

The sub-issue made this a **hard stop before pdf p19**: that page carries red blocks and no
legend on it, and the SEED forbids guessing what red means. Find the legend → `added-2022`.
Not found → stop, show the user the crop, and record either `emphasisLegend: null` with
`red-unlegended` rows or the user's ruling.

**A legend was found, so the stop never escalated.** Passes 0–3 all carry
`emphasisLegend: null`; pass 4 — the pass that reaches pages 18–19 — sets it:

```
{"text": "تم ادراج ما هو ملوّن باللون الأحمر لعدم تناوله في السنة الدراسية 2022-2021",
 "pdfPage": 18}
```

and marks week 24's four rows `added-2022`. The two facts land in the same commit, which is
the shape the contract's guard forces: `added-2022` is only representable once the document
carries a legend, so a pass cannot mark red before it has found the legend to justify it.

Its placement is the finding worth inheriting, and be-5 verified it independently from the
crop: **the legend is not in a header, a footnote or a margin — it is printed in bold black
inside the السير المنهجي cell of week 24's first row.** A legend hunt that reads only page
furniture would have missed it and would honestly have reported `red-unlegended` for a
document that has a legend. be-6…be-9 inherited "search cell contents too" from this.

> This is the one place the missing journal costs something real. Whether the legend was found
> before p19 was transcribed (the protocol) or while transcribing it (the same outcome by
> luck) is not recoverable from the artifacts — pass 4 covers pages 16–19 in one commit. The
> outcome is right and independently confirmed; the *order* is not evidenced.

## The exit-4 decision — the live-database guard

Pass 0's commit also carries six new clauses in `loader.characterization.test.js`, and the
be-repo commit they gate is `bbdf7cc`, "load-programmes: refuse a database that holds the
product's collections". This is be-4's, and it is the one be-repo change the sub-issue's
delta said would not happen — the sub-issue said "NO be-repo file changes".

What it is: a database that already holds any of `subjects · teachers · exercise_revisions ·
solutions` is refused with **exit 4** unless `--allow-live-db` is passed. It is a property of
the *target database*, checked at connection time, not of the arguments — because the failure
being guarded is a **forgotten or ignored `--db`**, and no amount of argument checking can see
that. It fires under `--dry-run` too: a guard that trusts the flag it is guarding is not a
guard.

Why it exists here: be-4 is the sub-issue that first pointed the loader at `teacher_saas` for
real. Exit 4 is not in the contract's error table; the loader's header says so out loud and
credits it here. REVIEW attacked it hard afterwards — forgotten `--db`, `MONGO_DB=teacher_saas`,
a db name smuggled into `MONGO_URL`'s path, dry-run exemption — and could not get through.

## What layer 2 found afterwards

be-5 re-read all 19 pages independently and called the transcription **faithful enough to
build on, no re-transcription**, with 100% structural agreement — every row count, every
row-hour vector, every pdf-page citation, and every unit assignment, including the awkward
ones (week 21's معالجة sitting *inside* u12's span; the محور changing mid-week in weeks 12 and
22). Three items went the page's way:

| | what | outcome |
|---|---|---|
| D1 | week 25 r3 contents: `ليست على` where the page says `إلى` | **the one meaning-flipping error in the corpus** — "4 points belonging to one plane" had become "not lying on one plane". Fixed, rev 1 → 2. |
| D2 | week 4 r0 guidance: `أويلر` where the page says `أولير` | the document spells Euler three ways and the seed had normalised one of them. Fixed in the same pass. |
| D3 | the legend's `هو ملوّن` vs the page's run-together `هوملّون` | cosmetic; recorded, not corrected. |

be-10 later added one more: the week-3 trigonometry bullet stored `sin ، cos` where glyph
geometry proves the page prints **cos first** in the RTL sentence. Fixed, rev 2 → 3.

**The document stands at `transcriptionRev 3` today**, A1–A8 green from `--db`, with the seed
file reading `unchanged` against the store and `programme_revisions` holding both superseded
versions.

## Verification, re-run at backfill time

```
verify-programmes.mjs --file data/programmes/tadarroj-3as-math.jsonl   → A1–A7 green
verify-programmes.mjs --db teacher_saas --docKey tadarroj-3as-math     → A1–A8 green, rev 3
grep -c trimester data/programmes/*.jsonl                              → 0 everywhere
```

## review

**Verdict: approve-with-debt.**

The work product itself checks out everywhere I could attack it: `verify --db --docKey
tadarroj-3as-math` is A1–A8 green today at `transcriptionRev 3`; the seed file is
`unchanged` against the DB; totals 27/189, weeklyHours 7; the p19 red block was resolved
with a found legend (pdf p18, confirmed independently by be-5 with the crop) rather than a
guess; `trimester` appears nowhere; the frozen paths are clean in all three repos
(`agent/curriculum/` byte-identical to main, fe untouched, archive untouched). The per-pass
protocol left a verifiable trail: five commits, each `--partial`-gated.

Debt:

1. **The journal is missing.** The largest sub-issue in the job — 19 pages, the document the
   user gate was judged on, the sub-issue whose stop-and-ask (p19) the SEED singled out —
   has no first-person record. The p19 legend outcome, pass budget consumption, and the
   guard decision (exit 4) are reconstructible only from other artifacts. Write it from the
   commit trail, or leave this note as the record of its absence.
2. `state.json` marked be-4/be-5 `todo` long after both were done (be-9 recorded this);
   the flip to `done` is present but **uncommitted** in the project worktree at review time.

### debt closed (micro-loop)

1. **Backfilled above**, from the commit trail, `bbdf7cc`, the seed and be-5 — and labelled a
   reconstruction, because it is one. The p19 legend outcome, the 5-of-5 pass budget and the
   exit-4 decision are now recorded where a reader looks for them. The one thing the
   artifacts cannot settle — whether the legend was found *before* p19 was transcribed or
   during — is stated as unevidenced rather than smoothed over.
2. **`state.json` committed.**
