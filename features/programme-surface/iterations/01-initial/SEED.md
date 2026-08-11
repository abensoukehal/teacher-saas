# SEED — the programme surface (slice 2 of 7)

> **Phase:** DISCOVERY. **Input:** `00-brief.md`. **Consumed by:** PLANNING.
> Locked 2026-08-11 after EXPLORE fan-out to both stack agents against the running lane
> (slot 9: be :9900 · fe :10900). Every number below was measured, not estimated.

## Anchor
- **Job kind:** feature
- **Upstream:** `artefacts/design_handoff_prep_companion/ANALYSIS.md#slice-2`

## Problem (enriched)

The ministry's التدرج السنوي is loaded — 5 documents, 6 streams, 135 weeks, 379 rows — and
**nothing serves it**. `getProgramme` and (since slice 1) `getProgrammeForStream` exist in
`src/store/programmes.ts`; no route is mounted, and `GET /api/programmes` 404s. The product's
lead value is conformity to the official programme, and the programme is invisible.

Slice 1 gave each class a marked week. This slice gives that week a **meaning** — the unit it
sits in, the ministry's own guidance for it, and the year around it.

**The screen cannot be ported.** The handoff draws one grid row per week; the corpus gives a
week `rows[]`. Maths: 27 weeks, **103 rows** — four weeks with one row, eight with four, two
with seven.

## Current reality — the planning kit

### 1 · Acting-surface map

| Stack | Path | Role | Change |
|---|---|---|---|
| be | `src/routes/programme.ts` | the read route | **new** |
| be | `src/store/programmes.ts:1019` `getProgramme` · the `getProgrammeForStream` added in slice 1 | the readers | read-only |
| be | `src/store/programmes.ts` | a field-explicit projection (`toProgrammeRecord`) | modify (append only) |
| be | `src/routes/progress.ts:111,127,139,177` | `totalWeeks` — the bound whose pin is vacuous | read-only (code correct; the **pin** is the target) |
| be | `src/app.ts` | mount | modify |
| fe | `src/App.tsx:1137,1153,1176,1192` | the four render decisions; `#/admin` is "THE ONLY ROUTE THIS APP HAS" | modify |
| fe | `src/components/Nav.tsx` · `WeekCard.tsx` · `Tracker.tsx` · `ProgrammeBar.tsx` | the screens | **new** |
| fe | `src/lib/programme.ts` | types + the **run** derivation | **new** |
| fe | `src/lib/katex.tsx:17,106,120-136` | `Statement` — the renderer verbatim text must go through | read-only (freeze) |
| fe | `src/components/ClassBar.tsx:56-62`, `App.css:949-976` | the rail pattern, and the "never accent on a position surface" ruling | read-only |
| fe | `src/App.css:1-8,10-15,377-384` | the RTL column warning, the shell grid, the `.math` isolation | modify (append) |

### 2 · Baseline recordings

Captured 2026-08-11, lane slot 9. Re-run from the respective worktree.

| Surface | Re-run command | Recorded | Captured |
|---|---|---|---|
| no programme route | `curl -s -o /dev/null -w '%{http_code}' localhost:9900/api/programmes` | `404` | s9 |
| `/api` index | `curl -s localhost:9900/api` | 9 route entries, none for the programme | s9 |
| corpus shape | `mongosh teacher_saas --eval 'db.programmes.find()'` | 5 docs · 27 weeks each · rows 103/97/81/59/39 | — |
| rows per week (maths) | aggregate over `weeks.rows` | `1×4, 2×1, 3×6, 4×8, 5×3, 6×3, 7×2` | — |
| field density (maths, 103 rows) | count non-empty per field | **competencies 76 · contents 63 · guidance 55** | — |
| guidance length | per element | median 96 · p90 191 · **max 432** chars | — |
| LaTeX | count `$…$` spans | 36/103 maths rows carry it; 219 spans in guidance, 20 in contents; one string has 12 | — |
| emphasis | distribution | `normal 358 · added-2022 21 · red-unlegended 0` corpus-wide | — |
| unit runs | walk `weeks[]` | **maths 15 runs from 14 units** (u12 non-contiguous: 20, then u11 at 21, then 22–23) | — |
| payload | `JSON.stringify` the projection | maths **38,775 B** (whole doc 62,883; gzip 9,546) | — |
| server cost | 30 runs, find + stringify | **p50 1.06 ms · p95 2.55 ms** | s9 |
| ETag/304 | `If-None-Match` on `/api/skills` | `304`, zero-byte body — Express default, already works | s9 |
| compression | `Accept-Encoding: gzip` | **no `Content-Encoding`** — no middleware, no dependency | s9 |
| `entry` write | `PUT /api/progress/:id {rev, markedWeek, entry}` | `200`, entry stored, `rev` advanced | s9 |
| `entry` alone is refused | same without `markedWeek` | `400 invalid_request` «الأسبوع غير صالح» | s9 |
| the bound is live | insert a synthetic programme `totals.weeks: 30`, class on it | `markedWeek 28 → 200`; `31 → 400`. **A hardcoded 27 gives 400 at 28 — the kill.** | s9 |
| ci gate, both | `tools/ci <be\|fe> --slug programme-surface` | `FAIL: no characterization tests resolved` → **RED, correct** | s9 |

### 3 · Perimeter consumers

| Consumer | Surface | Recorded |
|---|---|---|
| `GET /api/progress/:classId` | already returns `programme {docKey, edition, totalWeeks}` | **the picker's bound.** Must stay the single source for that number |
| `classes-progress` suite | `progress.characterization.test.js:1074-1079` | asserts `/api` has **exactly** `RECORDED_ROUTES.length + 1` entries. **Adding a route turns it red at promotion** — it is not promoted yet, so this slice's gate is unaffected |
| `classes.characterization.test.js:198-203` | `distinct("streams")` equals exactly the six | a synthetic stream left behind by a crashed run turns it red — cleanup must be in `afterAll`, never at the end of a test body |
| `programme-corpus` promoted suite | the loader + verifier | untouched, **provided `WEEKS_PER_YEAR` and the seed validator stay untouched** |
| fe promoted net | 313 clauses, 21 suites | renders `App` directly with no router provider — which is why a router is the wrong answer |

### 4 · End-to-end trace

`GET /api/classes` → the class's stream → `getProgrammeForStream({streams, current:true})` →
the projected document → the bar's runs and the tracker's rows. The read is one `findOne`
over the existing `{streams:1, current:1}` index, 1.06 ms.

### 5 · Observability baseline

- **Visible:** correlation id on every response; `mutationlog` covers class/progress writes.
- **Blind spot:** a read route logs nothing today beyond the generic request line. That is
  **fine and deliberate** — this route is a cache-friendly read of a public document; adding
  a mutation-style log line would be noise. What *does* need visibility is the tracker's new
  write pattern: it makes many small `PUT`s where slice 1 made one, so `cas_loss` frequency
  becomes an operational signal. The existing `progress.write` line already carries it.

### 6 · Unknowns ledger

| Unknown | Disposition | Evidence |
|---|---|---|
| Route shape | **resolved** | `GET /api/classes/:classId/programme`, behind `requireTeacher`, whole projected document. Reuses `resolve()`'s ownership and the one byte-identical `404 class_not_found`, so `fe` never holds a stream→programme mapping — the exact drift hazard `known-gaps.md` records for the hardcoded stream list. Splitting per-week saves 36 KB on home only and costs a second contract; the tracker pulls everything anyway. |
| `rows[].competencies` — include or not? | **resolved: INCLUDE.** This overrides the be agent's recommendation. | be argued exclude (19% of payload, no column in the prototype). fe **measured** the consequence: competencies is the **densest field — 76/103 rows, against 63 contents and 55 guidance** — and in real week 20 all 7 rows have a competency while only 3 have contents. Excluding it renders four of seven ministry rows **blank**. The byte cost is real; a blank tracker is worse. |
| Cache | **resolved: none** | 1.06 ms uncached; Express's ETag already gives `304` on repeat visits. An in-process memo would serve a stale corpus across a re-transcription — the loader writes out of band with no signal to a running service, and `contentHash` cannot help because checking it *is* the read the memo avoids. |
| Compression | **parked** | 39 KB → 9.5 KB measured, ~4 lines, one dependency — but it changes **every** response including the ~110 s generation ones. Revisit when a deploy target exists. |
| Authorisation | **resolved: behind `requireTeacher`** | Not to protect the corpus (a public ministry document) but the **id space**: the URL carries a `classId`, and an unguarded route would answer "is this class real?" — the oracle `progress.ts:44-52` exists to close. Every teacher-data route in this codebase guards on the prefix. |
| The pacing marker | **resolved: build nothing, ship the absence** | There is no calendar anywhere, and **the corpus carries no date of any kind**. A field on `progress` is forbidden (§5b rule 5 — it merges the school-year lifetime into the class lifetime, and a calendar is one per teacher-year, not per class). The prototype's `hasReference` is *literally the same expression* as `hasPosition` with `expected = 12` hardcoded. **Correction to the brief:** `data/school_year.json` ships `expectedWeekNow: 12`, not `null` — the *type* carries the null rule; the fixture is the populated example. Plan against the type. |
| Segment derivation | **resolved** | One segment per unit **run** (contiguous same-`unitId` weeks), sized by **run-summed `weeks[].hours`**. Maths → **15 segments from 14 units**. The prototype's approach (`segH = u.h`, one per unique unit) sums to **210 of 189 = 111%** on maths and techmath and **overflows its own track**; it is exact only on the three streams that happen to have no non-contiguous unit. Fill = `Σ week.hours where week ≤ markedWeek ÷ run.hours`. |
| `emphasis` | **resolved: render it, as provenance, never as status** | 21 rows corpus-wide carry `added-2022`; **`red-unlegended` occurs zero times in all five documents**. Every document carries the ministry's own `emphasisLegend` («تم ادراج ما هو ملّون باللون الأحمر لعدم تناوله في السنة الدراسية 2022-2021») with a page number. A muted inline tag quoting that legend — ink, never hue. Red is ruled out twice: `--destructive` is "reserved for true errors only — NEVER pacing", and the product never grades. Leaving it unrendered means `be` pays to keep a required signal no surface consumes, on the screen whose whole job is showing the ministry's words. |
| «تمّ ✓» vs «تخطٍّ ↷» | **resolved** | `markedWeek` is **required on every PUT** (measured — an entry-only write is a 400), so the decision is forced rather than optional. Both advance the position to `min(markedWeek + 1, totalWeeks)`; «تمّ ✓» writes `entry {week: markedWeek, status:"done"}`, «تخطٍّ ↷» writes `status:"skipped"`. This matches the prototype, where both buttons call the same `markWeekDone`. |
| Tracker length | **resolved: collapse by default** | Measured in the live page: week 20 (7 rows) is **505 px**, week 6 (1 row) is 99 px — a **5.1× ratio**, and the full maths tracker is **~8,060 px ≈ 9 screens**. Non-current weeks collapse to one summary line; the current week and any the teacher opens expand. Scroll to the marked week on mount, or the teacher's own position is off-screen every visit. |
| Where the screens live | **resolved: a `view` state + a nav row inside the shell** | Not the hash (`#/admin` returns *before* the shell, so it has no class bar — the tracker needs one, so it would need a second routing mechanism with different semantics). Not a router (new dep on a 3-dep repo; all 98 fe clauses render `App` directly with no provider). Mirror the view into the hash **read-only at mount** so Back and refresh land right — slice 1 already recorded the wizard's Back problem, and repeating it on a weekly screen is worse. Nav shows four items with «إعداد موضوع» and «مكتبتي» **absent, not disabled** — a greyed item is a promise with a date. |
| No class selected | **resolved** | Both new screens are per-class and neither has a meaningful unselected state. Keep the builder as the landing view; offer the two nav items only once a class is selected, and give each screen an explicit "choose a class" state pointing at the bar. Auto-selecting would break fe-2's pinned oracle. |
| The teacher's note on a KaTeX surface | **resolved: notes render as PLAIN TEXT** | `Statement` pairs two `$` and silently corrupts: `من 5 $ إلى 9 $ دينار` renders as `من 5 إلى9 دينار` with both `$` gone. Zero corpus strings have an odd `$` count, so ministry text is safe — but a note is teacher-authored. Also pinned: `Statement` eats a leading `1.` (`katex.tsx:126-129`), harmless today, a silent numbering loss on a future transcription. |
| The bound pin | **resolved: close it in this slice** | Technique proven live (§2). The obstacle nobody had written down: **you cannot make a non-27 programme through the loader** — `WEEKS_PER_YEAR = 27` is enforced at `programmes.ts:445,556,679` and those guards are right. The fixture must be a **direct Mongo insert in the suite**, on a stream value no real document carries, cleaned up in `afterAll`. ~40 lines, touches no product code. |
| Content-item ids | **resolved: emit plain strings** | The corpus's `rows[].contents` are plain strings; the handoff assumes `{id, text, courseId}`. Slice 7 needs an addressable content item and there is nothing stable to address — position moves on a `transcriptionRev` bump. Emitting plain strings forecloses nothing; emitting a synthesized id would be a lie. |
| `GET /api/streams` | **parked** | Still absent; `classdraft.ts` mirrors six streams by hand. Same corpus read, arguably this slice's — but it is not on either screen's critical path. Recorded again. |
| Two reports of the week total | **resolved** | `progress.programme.totalWeeks` stays the **picker's bound** (the slice-1 suite explicitly refused two sources for one bound). The programme route's `totals` is the **ministry's summary table** — same number today, different question. Named differently on purpose. |
| **`\square` — 26 occurrences, and it is a fidelity defect** | **ESCALATED — see below** | |
| `red-unlegended` is dead | **accepted risk** | Zero instances in all five documents. Whatever is built for it is untestable against real data. Keep the type; do not build a branch for it. |
| The lettres document serves two streams | **accepted** | آداب وفلسفة and لغات أجنبية resolve to the same document and get identical trackers. Correct per the corpus; unverified as a product expectation. |

### ⚠ Escalation — the corpus says □ where the ministry printed ℤ

**`\square` is the single most frequent TeX command in the corpus and it is a transcription
placeholder.** Measured corpus-wide at seal time — **61 occurrences across 48 strings**, in
three of the five documents:

| docKey | occurrences |
|---|---|
| `tadarroj-3as-math` | 26 |
| `tadarroj-3as-techmath` | 25 |
| `tadarroj-3as-sciences` | 10 |
| `tadarroj-3as-gestion` · `-lettres` | 0 |

They cluster in the arithmetic unit — maths weeks 15 and 17, pdf pages 13–14 — where the
ministry printed **ℤ**. KaTeX renders each as a literal empty box:

```
corpus : القسمة الإقليدية في $\square$ :        → renders □
ministry: القسمة الإقليدية في ℤ
corpus : المجموعة $\square$  (week 20, complex numbers) → should be ℂ
corpus : $a \in \square_{+}^{*}$                        → should be ℝ*₊
```

This slice builds the screen whose entire promise is *ministry text shown verbatim*, and it
is the first surface that will display these strings. Shipping □ where the page prints ℤ
breaks that promise on exactly the screen made to keep it.

**It is a corpus fix, not an `fe` fix, and an agent must not guess it.** Choosing which set
each □ means is precisely the derivation the verbatim rule forbids. Most are plainly ℤ from
context («القسمة الإقليدية في $\square$», «الموافقات في $\square$»), which is exactly what
makes guessing tempting and wrong — «توسيع مفهوم القاسم المشترك الأكبر إلى $\square$» and
`$a \in \square_{+}^{*}$` are not the same set. It needs a human reading the 48 strings
against the printed page — `weeks[].source.pdfPages` gives the page for each —
then a `transcriptionRev` bump through `scripts/load-programmes.mjs` and a re-verify.
`project/CLAUDE.md` already warns that a verifier green certifies nothing about page fidelity;
this is that warning coming true.

**Disposition: PARKED, `blocked_on: a human page-check.** The slice ships without it, and the
tracker will show □ until it is done. Recorded here so it is inherited knowingly rather than
discovered by a teacher.

### 7 · Sweep statement

- **Swept:** the whole corpus (all five documents, every measurement above), both programme
  readers, the progress route's bound, the `/api` index, the fe shell and its four render
  decisions, `Statement` against real corpus strings, the RTL bar pattern geometrically in
  the live page, both test harnesses.
- **Not swept:** generation (untouched), the admin console, the print sheet, solutions and
  revisions. Courses (slice 7) beyond confirming there is no stable content id to address.

## Solution direction (locked)

**One read route, whole projected document, class-scoped and guarded.** The projection is a
field-explicit whitelist. It carries `docKey`/`edition` (a tracker draws a position against a
*document*; only these say if the class was marked against another edition), `weeklyHours`,
`totals`, `source.authority`/`title` (the prototype hardcodes the provenance line as a UI
literal — the conformity pitch requires it be data), `emphasisLegend`, `units[].{id,name}`,
and `weeks[].{week, unitId, hours, pdfPages, rows[]}` with each row's
`{competencies, contents, guidance, hours, emphasis}`.

It deliberately **excludes** `contentHash` (a validator that would silently stop validating,
since it hashes the stored doc and we emit a projection), `transcriptionRev` (shipping it
gives `fe` one obvious thing to do — diff it against the stamp — which is the two-axes
collapse the model forbids), document-level `competencies` (nullable, rendered nowhere),
`frontMatter`, `units[].weeks`/`hours` (**a correctness exclusion**: they are the summary
table's numbers and they disagree with the week rows — withholding them makes the correct
computation the only available one), `nameText` (PDF tatweel stretching, not the ministry's
words), `docPages`, and `weekNumberPrinted` (equal to `week` in all 135 rows — it records a
disagreement that does not exist).

**The bar is built from unit runs.** *Why not the prototype's version:* it sums to 111% on
the flagship stream and overflows its track, and the bug is invisible on three of five
documents.

**The tracker is a nested sub-grid, not a rowspan.** Three of the five columns are
week-scoped and two are row-scoped; `grid-row: span N` would force all 27 weeks into one grid
and destroy the per-week band that carries the current-week highlight. Keep one band per
week; make the middle cell its own grid so per-row hours line up with the week's total —
which makes "the rows sum to the week" visible rather than asserted.

**No pacing marker and no pacing sentence.** *Why not build a calendar:* it is a whole
sub-feature whose expensive half is the September editing UI, and the pacing comparison is
the one thing on these screens that could read as grading the teacher. Shipping it with an
invented calendar is worse than shipping without it.

## User value

A teacher can see the official programme for the class they are looking at — the ministry's
own words for this week, and where this class sits in the year — instead of taking the
product's word for it.

## Scope & boundaries

- **In:** the read route + projection; the nav and view state; the week card; the tracker with
  collapse and the current-week actions; the segmented bar from unit runs; `emphasis` as
  provenance; `entry` writes from «تمّ ✓» / «تخطٍّ ↷»; **closing the `markedWeek` bound pin**.
- **Out:** the pacing marker and any calendar; generation scope and the exclusion list
  (slice 3); courses behind content items (slice 7, gated); Tailwind and the redesign
  (slice 5); `GET /api/streams`; compression; the `\square` corpus fix (escalated).
- **Stacks touched:** be · fe

## Risks & backward-compat flags

- **Additive on the wire.** One new route; no existing response changes.
- **The `/api` route-count pin fires at promotion**, not in this slice's gate. Flag it at
  planning as a previous job's frozen oracle — the amendment is a planning-time decision.
- **A synthetic programme left behind turns a slice-1 corpus guard red.** Cleanup in
  `afterAll`, on a stream value no real document carries.
- **`WEEKS_PER_YEAR` and the seed validator must not be touched** — the `programme-corpus`
  promoted suite gates them, and the guards are correct.
- **The tracker multiplies progress writes.** One `PUT` per week marked, where slice 1 made
  one per session. `409 conflict` becomes far more likely, and the re-ask must happen **at
  the row**, not in a global banner.

## Investigation journal

- **H1 (the brief's framing): "the tracker cannot be ported."** → test: measure rows per week
  across all five documents; render real week 20 and week 6 in the live page → result: 103
  rows over 27 weeks for maths, and a 5.1× height ratio between a 7-row and a 1-row week →
  belief: **kept, and sharpened** — it is not only the row count, it is that the screen is
  ~8,060 px and the prototype's screenshot shows seven even bands.
- **H2: "exclude `competencies` — the prototype has no column for it and it is 19% of the
  payload."** → test: count non-empty fields per row → result: **competencies is the densest
  field, 76/103 against contents 63 and guidance 55**; week 20 has a competency on all seven
  rows and contents on three → belief: **killed.** Excluding it renders most rows blank.
- **H3: "the prototype's bar arithmetic is probably fine, just needs the unit ids."** →
  test: compute both ways against all five documents → result: naive sums to **210 of 189**
  on maths — 111%, an overflow — because `u12` is one id split across two runs → belief:
  **killed.** Run-summing `weeks[].hours` is exact on all five.
- **H4: "guidance is a short quoted clause, as the prototype shows."** → test: measure
  → result: median 96, **max 432 chars**, up to 3 strings per row across up to 7 rows, and
  **36/103 maths rows carry LaTeX** → belief: **killed.** It is paragraphs, and it needs KaTeX.
- **H5: "KaTeX will struggle inside long RTL prose."** → test: run the 432-char string through
  the shipped `Statement` and measure the rendered geometry in the live document → result:
  12 islands, 0 errors, every line reads right-to-left in order, no horizontal overflow →
  belief: **killed** — but the test found a different defect: two `$` in teacher-authored text
  silently corrupt, so notes must never go through it.
- **H6: "the pacing marker just needs the calendar wired up."** → test: grep for any calendar;
  inspect the corpus for dates → result: no collection, no route, and **the corpus carries no
  date of any kind** → belief: **refined** — it is not wiring, it is an unbuilt sub-feature,
  and the honest ship is the absence.

## Ready-for-PLANNING checklist
- [x] the brief's framing was tested, not assumed (H1)
- [x] problem + solution direction locked; why-nots cite killing evidence
- [x] acting-surface map present; scope in/out stated
- [x] every acting surface has a baseline recording with its re-run command
- [x] perimeter consumers recorded, including the pin that fires at promotion
- [x] one correlated end-to-end trace saved
- [x] observability baseline stated
- [x] no undispositioned unknowns — two parked, one **escalated**
- [x] sweep statement present
