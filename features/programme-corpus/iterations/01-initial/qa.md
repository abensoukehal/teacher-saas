# QA — programme-corpus · 01-initial

**Date:** 2026-08-10 · **Role:** reality gate, black-box. Inputs: SEED, the five source
PDFs, the live `teacher_saas.programmes` corpus, the journals' `## review` sections.
No product code was read. Every page cited below was re-rendered by QA
(`pdftoppm -r 150..600 -png`), every number re-derived from the database, every guard
probed against a scratch database (`qa_probe_corpus`, dropped after). The live corpus
was not modified.

**Verdict: `validated-provisional`** — two bugs recorded (B1 minor-cosmetic, B2 latent
design gap), neither meaning-inverting, neither blocking a consumer of the 2022-09
corpus. Details at the bottom.

---

## Ledger

### Q2 · Completeness — verified from the database, not from reports

| case | SEED claim | command | observed vs expected | verdict |
|---|---|---|---|---|
| C1 | 5 documents, one per PDF | `db.programmes.countDocuments` + per-doc dump | 5 docs, all `current:true`, `edition:"2022-09"` | ✅ |
| C2 | 6 streams incl. lettres carrying two | `streams` per doc | رياضيات · تقني رياضي · علوم تجريبية · تسيير واقتصاد + lettres = [آداب وفلسفة, لغات أجنبية] on ONE doc | ✅ |
| C3 | 135 weeks, 379 rows, 648 hours | independent re-sum over nested `weeks[].rows[]` | 27×5=135 weeks (1..27, no gap/dup in any doc) · rows 103+39+97+81+59=379 · Σ hours 189+54+162+135+108=648 | ✅ |
| C4 | totals = weeklyHours×27 (the §2.1 oracle) | re-derived | 7·6·5·4·2 ×27 = 189/162/135/108/54 — the three brief errors (181/128/44) are absent | ✅ |
| C5 | emphasis required on every row | scan | 379/379 rows carry it; 21 `added-2022`, 358 `normal`; zero absent | ✅ |
| C6 | unit referential integrity | scan | 0 orphan `unitId`, 0 unreferenced units, all five docs | ✅ |

### Q3 · The verifier, run by QA

| case | command | observed | verdict |
|---|---|---|---|
| V1 | `verify-programmes.mjs --db --db-name teacher_saas --docKey <each>` | A1–A8 `8 passed, 0 failed` ×5, revs math 3 / techmath 3 / sciences 2 / gestion 2 / lettres 1 | ✅ |
| V2 | tamper a scratch copy (`weeks.24.rows.0.contents.0 = "TAMPERED"`), re-verify | A8 FAIL "edited outside the loader", exit 1 | ✅ guard |

**What a green actually guarantees — quote this when building on the corpus:**
A1–A8 green guarantees *arithmetic and structural* consistency (sums, week range,
referential integrity, emphasis enum, page citations) plus *byte-integrity of the DB
against its own loader* (A8). **It guarantees nothing about whether any Arabic string
matches the printed page.** Attribution, wording and emphasis-assignment fidelity are
covered only by the human layer-2 eye-pass and by sampling like this QA's; a corpus
that is arithmetically perfect and textually wrong passes every gate (REVIEW built
three such; QA confirmed the class — a seed-side word swap that keeps the sums loads
and verifies green). The seed file in git is the trust root; git review is its only
guard.

### Q1 · Faithfulness — QA's own pixel sample (~12 pages, weighted to dense/merged/red)

| case | page(s) | what was compared | observed | verdict |
|---|---|---|---|---|
| F1 | lettres p5, 150+400 dpi | weeks 1–7: all row texts, hours, red boundaries | wk2r0–wk4r0 red, **wk4r1 black — red ends mid-week exactly as stored**; hours 2/1+1/1+1/1+1… match; formulas `u_n=f(n) أو u_{n+1}=f(u_n)` in correct RTL order | ✅ |
| F2 | lettres p5 legend | `emphasisLegend` verbatim | «تم ادراج العناصر الملونة بالاحمر…» incl. بالاحمر without hamza and the year printed 2022-2021 — byte-for-byte | ✅ |
| F3 | sciences p15–16, 150 dpi | weeks 22–25 complete | **red starts mid-week at wk23r2** (r0 h1 + r1 h2 black, empty-contents merged rows real on page); wk23 straddles pp15–16 as `pdfPages:[15,16]`; wk24 all 5 rows red verbatim; wk25 black again, rows 1/1/1/2 | ✅ |
| F4 | sciences p15 legend | third wording | «تم ادراج ما هو ملون بالأحمر لعدم تناوله…» with its odd double spaces — matches | ✅ |
| F5 | gestion p5, 150 dpi | weeks 1–5 | single red row wk2 (whole week, h4); hours 4 / 4 / 1+2+1 / 2+2 / 2+2 all match | ✅ |
| F6 | gestion p5 legend | the wording that never names a colour | «تم ادراج هذا المحور لعدم تناوله في تدرجات السنة الدراسية 2021 - 2022» — exact, incl. spaced hyphen | ✅ |
| F7 | math p18, 150–600 dpi | wk24 red block + attribution | 4 red rows + trailing normal h2 — **red ends mid-week**; the h2 red row above the printed "24" marker belongs to wk24: wk23's 7 rows already sum to 7, and the الهندسة في الفضاء محور cell starts at that row — both oracles agree with the stored attribution | ✅ |
| F8 | math p18 legend | fourth wording | **B1 — see bugs.** Page prints `هوملّون` (one cluster, no space); DB stores `هو ملوّن`. Everything else in the legend matches | ⚠ B1 |
| F9 | techmath p18, 150 dpi + word-bbox | legend + wk24 | the squashed `الأحمرلعدم تناولهفي` is real on the page (bbox gaps 0.3pt / ~0 vs 3.0pt normal spaces) and stored exactly; 4 red rows + normal h1 tail match | ✅ |
| F10 | math p7, 300 dpi | the sin/cos correction (rev 2→3) | page prints **cos-first** in both the competencies bullet (`cos x ، sin x ، a sin(ωt+φ)`) and the guidance bullet (`cos(ax+b) ، sin(ax+b) ، tan x`); DB matches; `programme_revisions` holds the rev-2 supersession | ✅ |
| F11 | techmath p2, 600 dpi + bbox | the en-dash→tatweel correction | the text layer itself decodes the mark as a **two-U+0640 token, 6.66pt = 2×3.33pt advance**; years 2022/2023 read from pixels (digits extract corrupted as "2222" — the §2.1 disqualification reconfirmed); all five intros carry `2022 ــ 2023`, zero U+2013 anywhere; revision row recorded | ✅ |
| F12 | gestion p7, 150–300 dpi | **the split week** (u04 النهايات 1.5wk / u05 دراسة دوال 1.5wk) | the page's own محور border starts دراسة الدوال exactly at wk9 → stored `wk9→u05` matches the main table. The summary's 6h/6h vs the table's 4h/8h is the **source's own tension**, preserved on both records rather than invented away | ✅ |
| F13 | math p12, 150 dpi | fresh dense page (wk13–14, ~15 cells) | the 10-bullet guidance block incl. six integral formulas (شال relation bounds a/c/b, |f(x)| bars, mean-value bracket) verbatim; wk13/14 attribution again forced by hours (4+1+2=7) | ✅ |
| F14 | techmath p10, 150 dpi | fresh dense page (wk9–12, ~20 cells) | all sampled K/C/G cells verbatim, incl. preserved source grammar `اثبات تجاور متتاليتان`; RTL formula order `y'=f(x) ، y''=f(x)` correct | ✅ |
| F15 | gestion p8, 200 dpi | source-error discipline + the be-8 reconstruction | the page **prints the same limit twice** (`lim xe^x=0 . lim x e^x=0`) and the seed stores the duplication verbatim; the wk16 stray `x` glyph is on the page and (per the recorded be-8 adjudication) dropped from the seed | ✅ |
| F16 | DB scan | structural nullability (SEED §2.3) | competencies: math 6 / techmath 6 / **sciences 5 (drops الحساب)** / gestion NULL / lettres NULL; graduateProfile null for lettres only; methodNote present ×5 | ✅ |

### Q4 · Scope — verified independently via git and the DB

| case | claim | command | observed | verdict |
|---|---|---|---|---|
| S1 | skills keep reading the old file | `git diff main -- agent/curriculum/` in teacher-be worktree | empty — byte-identical | ✅ |
| S2 | `taxonomy.ts` unmodified / fe untouched | `git diff main --stat` in teacher-fe worktree | empty diff | ✅ |
| S3 | `/api/generate` frozen | `git diff main --stat` in teacher-be | only 4 new files (`src/store/programmes.ts`, two scripts, `scripts/lib/db-arg.mjs`); zero existing files touched | ✅ |
| S4 | four product collections undisturbed | collection list + counts | subjects 8319 · teachers 16848 · exercise_revisions 3716 · solutions 2237 all present; additions are exactly `programmes`(5) + `programme_revisions`(6) | ✅ |

### Q5 · Induced failure — what an operator would actually break (scratch db only)

| case | attack | observed | verdict |
|---|---|---|---|
| I1 | loader at live db, no flag (`MONGO_DB=teacher_saas` and `--db teacher_saas`) | exit 4 both ways, "REFUSED — holds the product's live collections", nothing written | ✅ |
| I2 | hand-edit in scratch, reload | exit 2, "The DB is wrong and the file is right", nothing written, tamper left for investigation | ✅ |
| I3 | hand-edit + `--correct` | **still refused** — `--correct` will not paper over a hand-edit. Correct posture, but no message says how to actually recover (drop the doc, reload); the block also stops any other load for that docKey. One documented sentence would close this | ✅ (note) |
| I4 | truncated file, mid-line cut | "line 6: not valid JSON", whole-file reject, 0 writes | ✅ |
| I5 | truncated file, clean cut (24 weeks) | "expected 27 week lines, found 24 — …a truncated reading, not a short year", whole-file reject, 0 writes | ✅ |
| I6 | **new edition load** (edition bumped, content identical / changed) | **B2 — see bugs.** identical → "unchanged", new edition string silently discarded; changed → refused, and `--correct` absorbs the new syllabus into the 2022-09 doc as `transcriptionRev++`, edition unchanged, mismatch never mentioned | ⚠ B2 |

---

## Bugs

**B1 · math legend normalises a source squash (fidelity class, minor).**
Page (math p18): `تم ادراج ما هوملّون باللون الأحمر…` — one cluster, no space between
هو and ملّون. Proven twice: 600 dpi crop, and word-bboxes (the token spans هومل
continuously, junction gap −0.1pt, against 3.0pt for every real space on the line; the
same instrument reproduces techmath's stored squashes exactly, which validates it).
DB/seed store `هو ملوّن` in `emphasisLegend.text` **and** wk24 r0 guidance. This is
precisely the squash class the corpus preserved for techmath (`الأحمرلعدم تناولهفي`)
and corrected via `--correct` elsewhere (T2–T4); here it was silently normalised.
The shadda's base letter (ل vs و) is indeterminate from pixels; the missing space is
definite. Disposition: one `--correct` with a note, rev 3→4.

**B2 · the edition axis is schema-only — the loader cannot represent a second edition.**
SEED §3.1: two version axes, `{docKey, edition}` unique, "collapsing them would make
'the syllabus changed' indistinguishable from 'we misread a number'". Observed (scratch
db): the loader keys on docKey alone. A future ministry edition would either be silently
discarded (identical content) or — following the tool's own "re-run with --correct"
prompt — absorbed into the 2022-09 document as a transcription correction, collapsing
exactly the two axes the design exists to keep apart. No code path can ever create a
second-edition document, so the unique index and `current` machinery are unreachable.
Latent today (one edition exists); must be fixed or explicitly documented as
"single-edition loader" before any 2023+ document is ever loaded.

---

## Confirmed vs taken on trust

**Confirmed by QA first-hand:** all completeness numbers; all five A1–A8 greens; both
post-layer-2 corrections and their revision rows; four of five legends byte-exact (the
fifth is B1); red boundaries in four documents (lettres, sciences, math, techmath)
against pixels, including all three mid-week edges; the gestion split week against the
محور border; two fresh dense pages (~35 cells) verbatim; source-error preservation
(duplicated limit, stray x); the whole §4 freeze; every loader guard incl. two
truncation shapes.

**Taken on trust:** the ~60 main-table pages outside the QA sample (each already read
twice — transcription + layer 2 — but the deep-in-cell class has no mechanical net, so
residual risk on unsampled pages is bounded by two independent human reads having
agreed, not by a gate); the shadda-level adjudications T2/T3 at 600 dpi; the
"inserted و" half of the be-8 reconstruction; the l2 files' independence (`--compare`
not re-run by QA); the user gate's "explicit yes" after the maths document — still
unevidenced in any artifact (be-5 review debt 2, open).

## Would QA build a product on this corpus?

**Yes — for the 2022-09 edition, with two caveats stated plainly.** Everything sampled
matched the page except one legend spacing; the corrections process demonstrably works
(6 revision rows, each verified applied); the guards refused every misuse attempted,
including ones REVIEW did not try. Caveat one: a verifier green means internally
consistent and untampered, never page-faithful — do not let a consumer treat A1–A8 as a
fidelity certificate. Caveat two: do not load any future edition until B2 is resolved;
today's loader would corrupt the version history while exiting 0.
