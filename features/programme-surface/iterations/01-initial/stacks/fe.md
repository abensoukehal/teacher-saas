# Stack spec — teacher-fe (React 19 · TypeScript · Vite)

> The per-job skeleton for the **fe** repo (`repos.sh` key `fe`).
> Filled at PLANNING for `programme-surface` (slice 2 of 7) from the locked SEED.
> Implemented by the `fe` stack agent against this feature's `contracts/`.
>
> **This slice triggers no generation** — every call here is millisecond CRUD plus one
> 38 KB document read. What is load-bearing instead: **the screen cannot be ported**
> (the handoff draws one row per week; the corpus gives maths 103 rows over 27 weeks,
> a 5.1× band-height ratio, and a ~8,060 px tracker — collapse and scroll-to-marked
> are what make it usable, not polish), and **two text channels** (ministry text
> through KaTeX, teacher text plain — `Statement` silently corrupts two `$`).
> **No CSS framework** — Tailwind is slice 5; everything ships in the `App.css` idiom.
>
> **The partition is deliberate (WF-86):** components first, each in its own file with
> a props contract; ONE integrator sub-issue (fe-5) owns `App.tsx`, `App.css` and
> `Nav.tsx` and mounts everything. `App.css` has no per-component sibling in this
> repo, so ALL new css rules land in fe-5's append — the component sub-issues ship
> classNames and structure, jsdom pins behaviour, and fe-6's live pass pins looks.

## Scope recap (from SEED.md + this stack's sub-issues)
- Modules: `src/lib/programme.ts` (types + the **run** derivation + the advance-write
  builder) · `ProgrammeBar.tsx` (segments from unit runs) · `WeekCard.tsx` ·
  `Tracker.tsx` (collapse-by-default, scroll-to-marked, row-local 409) — all three as
  pure props-driven components · then `Nav.tsx` + the `view` state + hash mirror +
  mounting, in one integrator (NOT a router, NOT the hash early-return) ·
  `emphasis` as muted provenance · «تمّ ✓ / تخطٍّ ↷ / وصلنا هنا» writes.
- Contracts this stack must honor: `contracts/fe-be-programme.contract.md` (all §§),
  `contracts/flows.md`; slice 1's contract §§0, 4, 5, 7 stay binding.

## Current behavior baseline
> Captured 2026-08-11 against lane slot 9 (fe :10900 → be :9900) — SEED §2. Pinned by
> `features/programme-surface/tests/fe/*.characterization.test.tsx`
> (WF-53 home; vitest + jsdom + Testing Library; run
> `tools/ci fe --slug programme-surface` FROM THE JOB WORKTREE; import `@/App`,
> `@/components/...`, `@/lib/...` — never relative `../../` into src. Model:
> `classes-progress/tests/fe/class-bar.characterization.test.tsx`).

- The shell's **four render decisions** are `App.tsx:1137` (auth gate), `:1153`
  (`#/admin` — "THE ONLY ROUTE THIS APP HAS", early-returned BEFORE the shell, so it
  has no class bar), `:1175` (`withClasses` — the class-bar modifier row), `:1192+`
  (the shell return). No nav exists; no view state exists.
- `.app` grid: 2 **columns** (`App.css:10-15`); the RTL warning at `:1-8` concerns
  columns — the class bar already added a ROW via the `app--classes` modifier, the
  proven-safe shape this slice repeats for the nav.
- `Statement` (`src/lib/katex.tsx:105-141`): ministry-safe, teacher-unsafe —
  recorded: the 432-char corpus worst case renders 12 islands / 0 errors / RTL order
  intact; but «من 5 $ إلى 9 $ دينار» silently loses both `$` (pairing), and a leading
  `1.` is eaten (`katex.tsx:126-129`). Zero corpus strings have an odd `$` count.
- The rail pattern and the ruling to inherit: `ClassBar.tsx:56-62`,
  `App.css:949-976` — fill is inline width in the document's own direction, and
  **never accent on a position surface**.
- Fetch layer: `request()` (`api.ts:345`, internal — the single place `x-teacher-id`
  is set); `getProgress` (`api.ts:903`), `saveProgress` (`api.ts:923-933`, body typed
  `{rev, markedWeek}` — **does not yet accept `entry`**); `ProgressEntry` type exists
  (`classes.ts:28`). No programme fetcher, no programme types.
- fe promoted net: **313 clauses, 21 suites, renders `App` directly with no router
  provider** — which is why a router is the wrong answer (SEED §6).
- ci gate: `tools/ci fe --slug programme-surface` → `FAIL: no characterization tests
  resolved` — RED, correct (WF-82).

## Observability (PIN co-requisite)
- Visible today: every `request()` response carries `correlationId`; `be` logs every
  progress write incl. `cas_loss`. fe adds no logging layer (none exists) — the story
  stays: every new call flows through `request()`, so `tools/obs trace <id>`
  correlates a tap to the be line. The tracker multiplies writes, so `cas_loss`
  frequency becomes the operational signal — carried by the EXISTING `progress.write`
  line, nothing to add.
- Blind spot: none opened — every write's outcome renders (success advances the row,
  bar and rail; a 409 renders the row-local re-ask). The programme read renders or
  errors visibly; there is no fire-and-forget call in this slice.

## Client state / types
| Type or store | Field | Change | Backend contract it mirrors |
|---------------|-------|--------|-----------------------------|
| `src/lib/programme.ts` (new) | `Programme` mirroring the §2 whitelist exactly (`docKey, edition, weeklyHours, totals{weeks,hours}, source{authority,title}, emphasisLegend{text,pdfPage}, units[{id,name}], weeks[{week,unitId,hours,pdfPages,rows[]}]`, rows `{competencies, contents, guidance, hours, emphasis}`) · `UnitRun` · run/fill derivations · the advance-write builder | add | contract §§1–5 — mirrors recorded shapes, never the handoff's `contracts.ts` (its flat week is the reason this slice exists) |
| `src/lib/api.ts` | `getClassProgramme(teacherId, classId)` via `request()`; `saveProgress` body widened to `{rev, markedWeek, entry?}` (additive type) | modify (append/widen) | §1, §5 |
| App state (`App.tsx`, fe-5) | `view: "home" \| "week" \| "tracker"` · `programmes: Record<classId, Programme>` (session cache — 304s make refetch near-free) | add | §0 |
| localStorage | **no new key** — the view mirrors into the hash, not into storage | — | §0 |

## Surfaces (routes / views / components)
| Surface | Implementation path | New/Modify | Owner | Contract |
|---------|--------------------|-----------|-------|----------|
| Types + derivations + fetch | new `src/lib/programme.ts` · `src/lib/api.ts` | new + modify | fe-1 | §§1–5 |
| Segmented bar (both hosts — WF-69 perimeter) | new `src/components/ProgrammeBar.tsx` | new | fe-2 | §4 |
| Week card «هذا الأسبوع» | new `src/components/WeekCard.tsx` (pure, props-driven) | new | fe-3 | §§1, 4, 5, 6 |
| Tracker «البرنامج» | new `src/components/Tracker.tsx` (pure; imports `ProgrammeBar`) | new | fe-4 | §§1, 4, 5, 6, 7 |
| Nav row + `view` state + hash mirror + mounting + ALL new css | new `src/components/Nav.tsx` · `App.tsx` (branch inside the shell, after `:1175`) · `App.css` (append only) | new + modify | fe-5 | §0 + hosting all |

## States (non-negotiable)
> Answered in Arabic, RTL, Western digits, no red/green, no English — per surface.

| State | What the teacher sees |
|---|---|
| no classes (every pre-slice teacher) | the app EXACTLY as today — no nav row, no programme fetch, nothing (contract §8.7) |
| classes, none selected | nav shows «الرئيسية» + «الحساب» only; a hash deep-link to `#/week`/`#/programme` renders the explicit «اختر قسمًا من الشريط أعلاه» state pointing at the bar — never an error, never an auto-selection |
| programme loading | the screen skeleton holds; the read is ~1 ms + 38 KB — no spinner ceremony, but never a flash of wrong content |
| `markedWeek: 0` | week view: the invitation «أين وصل هذا القسم؟» + «حدّد أين وصلت» (→ the tracker) — no bar fill, no pacing. Tracker: no current row; «وصلنا هنا» on every row |
| positioned | week card for week W; tracker scrolled to W's band, W expanded, actions live |
| write in flight | that row's (or card's) controls disable for the beat |
| `409 conflict` | **at the row**: the fresh position renders and the row re-asks in Arabic; never auto-resubmitted; other rows untouched (contract §7) |
| `503 store_unavailable` | retryable Arabic message local to the surface that called |
| `401 teacher_required` | the existing rejected-identity path, unchanged |
| `\square` in a ministry string | the literal box, untouched — the escalated corpus defect ships visibly (contract §6.5); no remap, no hide |

## Network discipline
All new calls go through `request()` to relative `/api/...` — the header, the
correlationId and the lane proxy come for free. One programme GET per class per
session (state cache; the default ETag 304 covers the rest). An absolute URL or a
second fetch path is a defect.

---

## Sub-issues (this stack's technical work, grouped by issue)

```yaml
---
kind: sub-issue
id: fe-1
parent: i1
stack: fe
status: done
depends_on: [be-1]
estimate: M
---
```

### fe-1 — the programme becomes data fe can hold: types, runs, and the advance write

**tag:** happy-path

**Intent.** Everything numeric this slice renders derives from one small pure module —
the run derivation whose naive version overflows its own track by 11%, the fill
formula, and the advance-write builder — so the components consume proven functions
instead of re-deriving arithmetic in JSX, and the ≠27 mutant has a killing fixture on
this stack too.

**Ground truth.** Contract §2's wire shape, recorded live once be-1 lands
(pre-flight, lane s9): `curl -s -H "x-teacher-id: <id>"
$CHAR_BE_URL/api/classes/<classId>/programme | jq '{k: (.programme | keys), u: (.programme.units | length), w: (.programme.weeks | length)}'`
→ the eight top-level keys, 14 units, 27 weeks for maths. The derivation facts
(SEED §2/H3): maths has **15 unit runs from 14 units** (`u12` splits at week 21);
the prototype's per-unique-unit sum = **210 of 189 hours = 111%**, overflow;
run-summed `weeks[].hours` is exact on all five documents. `saveProgress`
(`api.ts:923-933`) body type today is `{rev, markedWeek}` — no `entry`.

**Delta (freeze).** May touch: new `src/lib/programme.ts` (the `Programme` types
mirroring §2 exactly; `deriveRuns(weeks) → UnitRun[]`; `runFill(run, markedWeek)`;
`trackTotal = Σ weeks[].hours`; `advanceWrite(markedWeek, totalWeeks, "done" |
"skipped") → {markedWeek, entry}` refusing `markedWeek < 1`);
`src/lib/api.ts` (append `getClassProgramme` via `request()`; widen `saveProgress`'s
body type with optional `entry` — runtime already passes it through). **Frozen:**
`request()` itself, `src/lib/classes.ts`, `src/lib/katex.tsx`, `src/lib/taxonomy.ts`,
every component. Freeze check:
`git status --short -- src/lib/classes.ts src/lib/katex.tsx src/lib/taxonomy.ts src/components` empty.

**Oracle.** `features/programme-surface/tests/fe/programme-lib.characterization.test.tsx`
(vitest; fixtures are hand-built from the contract, including **one synthetic
programme with `totals.weeks: 30`** — the proven ≠27 technique, mandated)
- a maths-shaped fixture (14 units, one split across weeks 20 and 22–23) →
  `deriveRuns` yields **15 runs** in week order, each run's hours = Σ its weeks'
  hours, and Σ run hours === Σ `weeks[].hours` — **a per-unique-unit derivation fails
  both clauses** (positive — the 111% kill, executable)
- segment fractions over `trackTotal` sum to 1 ± float noise; `totals.hours` is
  NEVER the denominator — a fixture where Σ weeks[].hours ≠ totals.hours (the real
  divergence §2 records) still sums to 1 (positive + negative — contract §4)
- `runFill`: `markedWeek: 0` → every run 0; mid-run marks fill partially
  (`Σ hours where week ≤ markedWeek ÷ run.hours`); a fully-passed run → 1 (positive)
- the ≠27 fixture: all derivations follow `totals.weeks: 30` / 30 weeks — no `27`
  literal anywhere in the module (grep clause: `grep -c '27' src/lib/programme.ts`
  → 0) (negative — the twin of be-2's kill)
- `advanceWrite(5, 27, "done")` → `{markedWeek: 6, entry: {week: 5, status:
  "done"}}`; `(27, 27, "skipped")` → `{markedWeek: 27, entry: {week: 27, status:
  "skipped"}}` — the clamp; `(5, 30, …)` follows 30; `(0, …)` throws — week 0 has no
  current week to mark (positive + negative — contract §5, one probe per variant
  WF-70)
- `getClassProgramme` hits `GET /api/classes/:id/programme` relative, via the mocked
  fetch, header included; `saveProgress` with an `entry` serialises it verbatim and
  without one sends the slice-1 body byte-identical (positive + negative — the widened
  type is additive)

**Boundaries.** Contract §§1–5. Additive; no new dependency. Budget 10 iterations.

**Exit protocol.** Done-when: oracle green ×2 · freeze paths clean ·
`tools/ci fe --slug programme-surface` green from the job worktree · promoted fe net
green. Ask-when: the wire shape from the live route contradicts §2 (contract problem,
not an adaptation) · budget blown.

---

```yaml
---
kind: sub-issue
id: fe-2
parent: i1
stack: fe
status: done
depends_on: [fe-1]
estimate: M
---
```

### fe-2 — the segmented bar: fifteen segments where the prototype drew fourteen

**tag:** happy-path

**Intent.** The year-at-a-glance bar renders one segment per unit RUN sized by
run-summed week hours — the only derivation that is exact on all five documents — and
ships WITHOUT the prototype's expected-week marker and pacing sentence, because the
absence of an invented calendar is the deliverable, not a gap.

**Ground truth.** fe-1's `deriveRuns` green. The geometry precedent to inherit:
`ClassBar.tsx:56-62` + `App.css:949-976` — inline width IS the datum, RTL fill needs
no physical side, and **never accent on a position surface**. The prototype's bar
(`Prototype v2.dc.html:134-148` home, `:222-232` tracker) draws segments + an accent
marker + a pace line — the marker and the line are the `hasReference` branch, whose
`expectedWeekNow` has no data source (the corpus carries no date of any kind — SEED
H6). Pre-flight: fe-1's suite green; re-read the two prototype ranges.

**Delta (freeze).** May touch: new `src/components/ProgrammeBar.tsx` ONLY — a pure
component (`{programme, markedWeek}` props), classNames without rules (`App.css` is
fe-5's; jsdom pins structure and inline widths, fe-6's live pass pins looks).
**Frozen:** everything else, incl. `src/lib/programme.ts` (consume, never edit — a
derivation that seems wrong is a stop) and `App.css`. Freeze check:
`git status --short -- src/lib src/App.tsx src/App.css src/components/ClassBar.tsx` empty.

**Oracle.** `features/programme-surface/tests/fe/programme-bar.characterization.test.tsx`
(imports `@/components/ProgrammeBar` directly)
- the maths-shaped fixture (fe-1's) → exactly **15 segments** in week order; each
  segment's inline width fraction = run hours ÷ Σ `weeks[].hours`; widths sum to 100%
  ± float noise (positive — a per-unique-unit bar renders 14 and fails)
- each segment carries the unit's name (+ its run hours) as its accessible
  title/tooltip — from `units[{id,name}]`, never from a literal (positive)
- fill at `markedWeek: 9` matches `runFill` per segment; RTL: the fill element uses
  logical/inline geometry only — assert no `left:`/`right:` physical style (positive)
- `markedWeek: 0` → zero fill in every segment and no fill node claiming otherwise
  (negative — slice 1 §7.2: no invented pacing)
- **no accent marker node, no «متوقَّع» string, no pacing sentence, no
  `--color-accent`/accent classname anywhere in the component** (negative — the
  shipped absence, executable; «never accent on a position surface»)
- the ≠27 fixture (30 weeks) renders correctly — segment count and widths follow the
  fixture (negative — no 27 literal)
- no red/green classnames or inline colors (negative — never grade the teacher)

**Boundaries.** Contract §4, §6.4. Additive. Budget 8 iterations.

**Exit protocol.** Done-when: oracle green ×2 · freeze paths clean ·
`tools/ci fe --slug programme-surface` green. Ask-when: the widths cannot be exact
without reading `units[].hours` (they are excluded ON PURPOSE — contract §2; wanting
them is the 111% bug knocking) · budget blown.

---

```yaml
---
kind: sub-issue
id: fe-3
parent: i1
stack: fe
status: done
depends_on: [fe-1]
estimate: L
---
```

### fe-3 — the week card: the ministry's words for this week, verbatim and attributed

**tag:** happy-path

**Intent.** «هذا الأسبوع» shows the marked week as the ministry wrote it — unit,
every row's contents AND competencies (the field whose exclusion would blank four of
week 20's seven rows), the السير المنهجي block verbatim with its provenance line from
DATA — and «أنهيت هذا الأسبوع ✓» performs the one advance write, because the week
card is where the position earns its meaning.

**Ground truth.** The handoff's week card (`Prototype v2.dc.html:163-188`): unit
heading, contents list, the guidance block with «نصّ الوزارة حرفيًا» source line, two
actions. The corpus facts that reshape it (SEED §2): a week has `rows[]` — real week
20 has **7 rows**, competencies on all 7, contents on 3; guidance is paragraphs
(median 96, max 432 chars) carrying LaTeX (36/103 maths rows). The provenance line is
hardcoded in the prototype and MUST come from `source.authority/title` on the wire
(contract §2). Pre-flight (lane s9, be-1 live): fetch the maths programme, confirm
week 20's row shape; fe-1's suite green.

**Delta (freeze).** May touch: new `src/components/WeekCard.tsx` ONLY — a **pure
component**: props `{programme, position: {markedWeek, totalWeeks, rev}, onAdvance:
(status) => Promise<…>, onGoTracker: () => void}`. It does not fetch and does not
know the view mechanism — fe-5 wires both. classNames without rules (`App.css` is
fe-5's). **Frozen:** everything else — `src/lib/*` (consume only; `Statement` is used
AS IS, its quirks are pinned, not fixed), `App.tsx`, `App.css`, every existing
component. Freeze check:
`git status --short -- src/lib src/App.tsx src/App.css src/components/Nav.tsx src/components/ProgrammeBar.tsx` empty
(missing paths report as nothing — the check passes iff no named path is dirty).

**Oracle.** `features/programme-surface/tests/fe/week-card.characterization.test.tsx`
(imports `@/components/WeekCard`; fixtures include the ≠27 programme and a
week-20-shaped week)
- positioned class (week 8 of the maths fixture) → the card shows
  «هذا الأسبوع — الأسبوع 8 من 27» with BOTH numbers from props (the ≠27 fixture
  renders «من 30» — a 27 literal dies), and the week's unit name resolved via
  `unitId → units[].name` (positive)
- **the multi-row week renders every row**: the 7-row fixture shows all 7 rows'
  content; a row with competencies and no contents shows its competencies — never a
  blank row (positive — the H2 kill, contract §2)
- guidance renders through `Statement`: a fixture row whose guidance carries
  `$\lim$`-style spans produces `.math` KaTeX islands inside RTL prose; **a fixture
  carrying `$\square$` renders the literal box** — no remap, no substitution
  (positive + the §6.5 escalation pin)
- the provenance line renders `source.authority` + `source.title` FROM THE FIXTURE —
  change the fixture string and the DOM follows; no hardcoded «وزارة…» literal in the
  component source (positive — grep clause on the component for the authority
  string → absent)
- contents render as **inert plain items**: no anchor, no onClick, no «الدرس ←»
  affordance (negative — courses are slice 7; the corpus has no stable content id)
- an `added-2022` row shows the muted provenance tag whose text quotes
  `emphasisLegend.text` from the fixture; `normal` rows show no tag; an unknown
  emphasis value renders as normal — allow-list, no branch for `red-unlegended`
  (positive + negative — contract §6.3)
- «أنهيت هذا الأسبوع ✓» → calls `onAdvance("done")` exactly once; while the promise
  is pending the action disables; on resolve the card renders whatever fresh props
  arrive (positive — contract §5; the WRITE shape itself is fe-1's builder, pinned
  there and again in fe-5's integration)
- a rejection typed `conflict` → the card shows the Arabic re-ask and does NOT call
  `onAdvance` again without a new tap (negative — contract §7)
- a rejection typed `store_unavailable` → retryable Arabic message, action re-enabled
  (positive)
- `markedWeek: 0` → the invitation «أين وصل هذا القسم؟» + «حدّد أين وصلت» calling
  `onGoTracker`; NO week content, NO pacing (positive + negative — slice 1 §7.2)
- no red/green, Arabic only, Western digits, no LaTeX source visible in the DOM's
  text nodes (`$` appears nowhere outside KaTeX internals) (negative)

**Boundaries.** Contract §§1–6. Additive. Budget 12 iterations. The «سلسلة تمارين هذا
الأسبوع» action and the «قادم» panel are ABSENT by contract §0 — building either is
scope error, not initiative.

**Exit protocol.** Done-when: oracle green ×2 · freeze paths clean ·
`tools/ci fe --slug programme-surface` green · promoted fe net green. Ask-when: a
corpus string renders wrongly through `Statement` (stop — its quirks are pinned;
fixing it is not this Delta) · the card seems to need `units[].hours` · budget blown.

---

```yaml
---
kind: sub-issue
id: fe-4
parent: i1
stack: fe
status: done
depends_on: [fe-1, fe-2]
estimate: L
---
```

### fe-4 — the tracker: nine screens made usable, and the writes where the eyes are

**tag:** happy-path

**Intent.** «البرنامج» renders the whole year as one band per week — collapsed by
default because the real page is ~8,060 px with a 5.1× band-height ratio, scrolled to
the marked week because the teacher's own position must never be off-screen — and the
current band carries «تمّ ✓ / تخطٍّ ↷» whose 409 re-asks at the row, because the
tracker turns one write per session into many.

**Ground truth.** Measured in the live page (SEED §2/§6): week 20 (7 rows) is
**505 px**, week 6 (1 row) is 99 px — 5.1×; the full maths tracker ~8,060 px ≈ 9
screens. The prototype (`Prototype v2.dc.html:214-266`): pinned bar, the ministry's
columns, current-row actions, `showSetHere`, note chip, the two footer rules. The
grid ruling (SEED, locked): **a nested sub-grid, not a rowspan** — three columns are
week-scoped, two are row-scoped; `grid-row: span N` would force all 27 weeks into one
grid and kill the per-week band. The write facts: `markedWeek` required on every PUT
(entry-only → 400, measured); both actions advance `min(W+1, T)`. Pre-flight: fe-1
and fe-2 green; re-read the prototype range.

**Delta (freeze).** May touch: new `src/components/Tracker.tsx` ONLY — a **pure
component**: props `{programme, progress: {markedWeek, entries, rev}, totalWeeks,
onWrite: ({markedWeek, entry?}) => Promise<…>}`; it IMPORTS `ProgrammeBar`
(composition, not modification) and does not fetch — fe-5 wires it. classNames
without rules (`App.css` is fe-5's; the nested-sub-grid rules land there — this
component ships the STRUCTURE: one band per week, the middle cell its own grid so
per-row hours line up under the week total, making "the rows sum to the week"
visible rather than asserted). **Frozen:** everything else — `WeekCard.tsx`,
`ProgrammeBar.tsx`, `src/lib/*`, `katex.tsx`, `App.tsx`, `App.css`. Freeze check:
`git status --short -- src/lib src/App.tsx src/App.css src/components/WeekCard.tsx src/components/ProgrammeBar.tsx` empty.

**Oracle.** `features/programme-surface/tests/fe/tracker.characterization.test.tsx`
(imports `@/components/Tracker`; fixtures: the maths-shaped programme, the ≠27
programme, entries incl. a skipped week with a note)
- 27 week bands render (30 on the ≠27 fixture — the mandated fixture, killing any 27
  literal); the `ProgrammeBar` is present above them (positive)
- **collapse-by-default**: a non-current week renders ONE summary line (week number,
  unit, status — its `rows[]` NOT in the DOM); clicking expands it to the full
  sub-grid; the current week mounts expanded (positive — the 8,060 px fact is WHY;
  jsdom pins the mechanism)
- **scroll-to-marked**: on mount, the marked week's band receives the scroll call
  (`scrollIntoView` spied) — and NOT on later re-renders (positive + negative)
- an expanded multi-row week shows per-row `hours` beside the week's total `hours` —
  both visible, from data (positive — the sub-grid's reason)
- status vocabulary (contract §0): `< markedWeek` no entry → «منجز»; entry `skipped`
  → «مُتخطّى»; `=== markedWeek` → «الأسبوع الحالي»; `> markedWeek` → «قادم» — one
  probe per variant (WF-70) (positive)
- **a note renders as PLAIN TEXT**: the fixture note «من 5 $ إلى 9 $ دينار» appears
  byte-verbatim, both `$` present, NO `.math` island inside the note chip — the
  recorded `Statement` corruption cannot reach teacher text (negative — contract
  §6.2, THE two-channel pin)
- ministry cells (contents/competencies/guidance) DO go through `Statement`; an
  `added-2022` row carries the muted legend-quoting tag (positive — §6.1/6.3)
- current row: «تمّ ✓» → exactly one `onWrite({markedWeek: min(W+1, T), entry:
  {week: W, status: "done"}})`; «تخطٍّ ↷» → same with `"skipped"` — the two bodies
  differ ONLY in `entry.status` (positive — contract §5; assert the diff is exactly
  that key)
- while a write is pending, THAT row's controls disable; success re-renders from the
  fresh props: band W reads «منجز»/«مُتخطّى», band W+1 is current and expanded, the
  bar fill advances (positive — flows Flow 2)
- **the 409 is row-local**: a rejection typed `conflict` → THAT band shows the fresh
  state and re-asks in Arabic; no global banner element exists; no auto-resubmit;
  other bands' DOM untouched (negative — contract §7, the many-small-writes reality)
- `markedWeek: 0` → no current band; **«وصلنا هنا» on every row**; positioned → on
  every non-current row; clicking row N → `onWrite({markedWeek: N})` with NO entry
  (positive — contract §0/§5, flows Flow 3)
- at `W === totalWeeks`, «تمّ ✓» sends `markedWeek: totalWeeks` (the clamp) and the
  entry still records (positive — the boundary variant)
- the footer renders the two rules — «النص الرسمي معروض حرفيًا …» and
  «ما هو من إعدادنا … مُعلَّم ✎» (deliberate copy, handoff README) (positive)
- «سلسلة الأسبوع» and «تمارين دعم على هذا المحور» appear NOWHERE (negative —
  contract §0 absences)
- no red/green classnames or inline colors on any band, tag or status (negative)

**Boundaries.** Contract §§4–7. Additive. Budget 12 iterations. `entry.note` is
rendered, never authored — no input exists in this slice (contract §0).

**Exit protocol.** Done-when: oracle green ×2 · freeze paths clean ·
`tools/ci fe --slug programme-surface` green · promoted fe net green. Ask-when: the
collapse or sub-grid cannot work as a pure component · a slice-1 progress pin reads
wrong against the real tracker (`entry` was written by tests, not a client — re-read,
then stop-and-ask, don't reinterpret) · budget blown.

---

```yaml
---
kind: sub-issue
id: fe-5
parent: i1
stack: fe
status: done
depends_on: [fe-2, fe-3, fe-4]
estimate: L
---
```

### fe-5 — the shell learns views: nav, hash mirror, wiring — and every new css rule

**tag:** happy-path

**Intent.** The finished components get somewhere to live — the locked mechanism (a
`view` state + a nav row inside the shell, hash written on change and read once at
mount) wires them to real fetchers and the 409 re-read — while the three existing
render decisions stay byte-stable, because a router is a new dependency 313 promoted
clauses never provided for and the `#/admin` early-return has no class bar.

**Ground truth.** The four render decisions: `App.tsx:1137` (gate), `:1153`
(`#/admin` early return — BEFORE the shell), `:1175` (`withClasses`), `:1192+` (the
shell). The class bar is the proven additive-row precedent (`app--classes` modifier;
`App.css:1-8` warns about COLUMNS, a row is safe). No nav element exists
(`document.querySelectorAll('nav').length → 0` in the running app). Pre-flight:
reproduce the four-decision structure and nav=0; fe-2/fe-3/fe-4 suites green.

**Delta (freeze).** May touch: new `src/components/Nav.tsx`; `src/App.tsx` (add
`view` + `programmes` cache state; initialize `view` from `location.hash` ONCE at
mount; write `#/week`/`#/programme`/clear on change; render the nav row and mount
`WeekCard`/`Tracker`/`ProgrammeBar` in the view regions with real fetchers, fe-1's
builder for `onAdvance`/`onWrite`, and the 409 re-read: a `conflict` rejection
triggers `getProgress`, fresh props flow down, the component re-asks); `src/App.css`
(**APPEND all of this slice's rules** — nav row via the `app--classes` idiom, the
bar, the card, the tracker's nested sub-grid — change no existing rule). **Frozen:**
the `#/admin` branch and its listener (it keeps serving admin only — contract §0),
the auth gate, `ClassBar.tsx`, the three new components (consume, never edit),
`src/lib/*`, every slice-1 flow. Freeze check:
`git status --short -- src/components/ClassBar.tsx src/components/AuthPanel.tsx src/components/AdminConsole.tsx src/components/WeekCard.tsx src/components/Tracker.tsx src/components/ProgrammeBar.tsx src/lib` empty.

**Oracle.** `features/programme-surface/tests/fe/nav-views.characterization.test.tsx`
(renders `@/App` with mocked fetch — the integration net)
- classes + a selected class → the nav row renders exactly four items:
  «الرئيسية» · «هذا الأسبوع» · «البرنامج» · «الحساب» (positive)
- **«إعداد موضوع» and «مكتبتي» appear NOWHERE in the DOM** — absent, not disabled or
  greyed (negative — SEED locked: a greyed item is a promise with a date)
- classes but NO selection → «هذا الأسبوع»/«البرنامج» not offered; «الرئيسية» and
  «الحساب» present (positive — contract §0)
- **ZERO classes → no nav element, shell DOM byte-identical to the recorded slice-1
  shape; no programme fetch ever fires** (negative — the 17,049-teacher case,
  contract §8.7)
- clicking «البرنامج» → the mounted `Tracker` renders the mocked programme and
  `location.hash === "#/programme"`; «الرئيسية» → the builder, hash cleared; the
  builder view's DOM is byte-identical to today's shell content — the default view
  IS the app as it was (positive + negative)
- mount with `#/week` + a restored selection → the week view; mount with
  `#/programme` and NO selection → the «اختر قسمًا من الشريط أعلاه» state pointing at
  the bar — never an error (positive — deep links land right)
- `#/admin` still early-returns the console with NO nav and NO class bar (negative —
  the frozen decision, executable)
- «الحساب» opens the account overlay exactly as the sidebar button does — one
  handler, `authOpen` (positive); the sidebar button itself is untouched (negative)
- the programme is fetched ONCE per class (`getClassProgramme` called once across
  view switches; a second class fetches its own) and the week card's «حدّد أين وصلت»
  navigates to the tracker view (positive — §0, the cache decision + `onGoTracker`)
- **the write wiring end to end**: «تمّ ✓» in the mounted tracker → one PUT
  `{rev, markedWeek: min(W+1, T), entry: {week: W, status: "done"}}` on the mocked
  fetch; the response's fresh progress re-renders band, bar and the class-bar rail
  together, NO programme refetch (positive — flows Flow 2, the shape pinned at the
  network edge this time)
- a mocked `409` on that PUT → exactly one `getProgress` re-read fires and the
  tracker receives the fresh position; NO retry PUT (negative — contract §7)
- a class SWITCH keeps the current view (contract §0) and the slice-1 total-context
  clears still fire — assert against the slice-1 recorded clear set, `pendingSave`
  intact (negative — perimeter WF-69: the switch handler is a host of this change)
- all new strings Arabic, Western digits (hard constraints)

**Boundaries.** Contract §0, §8.7. Additive; no router, no dependency, no new persist
key. Budget 12 iterations.

**Exit protocol.** Done-when: oracle green ×2 · freeze paths clean ·
`tools/ci fe --slug programme-surface` green · promoted fe net green (it renders
`App` directly — the nav must not break a single one of its 313 clauses). Ask-when:
the view cannot mount inside the shell without touching the `#/admin` branch · a
component's props contract does not fit the wiring (that is a contract change between
sub-issues — stop, do not edit the component) · budget blown.

---

```yaml
---
kind: sub-issue
id: fe-6
parent: i1
stack: fe
status: done
depends_on: [fe-1, fe-2, fe-3, fe-4, fe-5]
estimate: M
---
```

### fe-6 — the guard rails: absences, channels, and one pass against the real page

**tag:** hardening

**Intent.** The slice's promises that no single sub-issue owns get pinned as one net —
the shipped absences stay absent, the two text channels never cross, a class-less
teacher's app is bit-identical to today — and the whole surface runs once against the
REAL lane, because jsdom cannot measure a 9-screen page, an RTL sub-grid, or a pinned
bar.

**Ground truth.** fe-1..fe-5 green. The recorded geometry to re-verify live: week 20
≈ 505 px vs week 6 ≈ 99 px expanded; tracker ~8,060 px uncollapsed; the RTL+KaTeX
recording (paragraph `rtl`, math `ltr`, bidi `isolate`). The corpus's `\square`
strings (48 strings, 61 occurrences — maths weeks 15/17, pages 13–14). Pre-flight:
all five suites green, lane s9 up.

**Delta (freeze).** May touch: the suite itself, plus fix-only diffs in files
fe-1..fe-5 already own (each fix stays inside its owner's registered delta paths).
**Frozen:** fe-1..fe-5's oracle files (frozen against the implementer; a
wrong-seeming pin is stop-and-ask), every slice-1 flow, every absence contract §0
declares. No new component, no new dependency.

**Oracle.** `features/programme-surface/tests/fe/guard-rails.characterization.test.tsx`
- **the absence sweep** (contract §0, executable): across both new screens' rendered
  DOM — no «سلسلة», no «تمارين دعم», no «قادم — », no «متوقَّع», no pacing sentence,
  no accent marker node, no «إعداد موضوع», no «مكتبتي», no course affordance, no
  note input (negative — the ship IS the absence)
- **the channel sweep**: every `Statement` call site receives ministry fields only —
  a fixture progress whose note carries paired `$` renders it verbatim in every
  surface that shows notes; no teacher-authored string reaches KaTeX (negative —
  contract §6.2)
- **the `\square` pin**: a real corpus guidance string containing `$\square$` renders
  the box — and `grep -rn 'square' src/components src/lib/programme.ts` shows no
  remapping — the escalation ships visibly, untouched (negative — contract §6.5)
- **the legacy sweep**: zero classes → the shell snapshot matches slice 1's recorded
  shape (no nav, no programme fetch, no new request); the request SET on boot is
  byte-identical to slice 1's (negative — contract §8.7)
- **the language sweep**: every string fe-1..fe-5 introduced — no Latin words, no
  LaTeX fragments, Western digits, no "AI", no red/green classnames on any position
  surface (negative — hard constraints)
- every new fetch URL is relative `/api/...` (negative — network discipline)
- **live nav pass (manual commands in the exit, not jsdom):** `tools/dev up` on the
  job lane → select a real class → «هذا الأسبوع» shows real week content with KaTeX
  islands in RTL prose; «البرنامج» opens collapsed, scrolled to the marked week;
  expand week 20 (7 rows — the 505 px band) and week 6 (1 row); press «تمّ ✓», watch
  the band, bar and class-bar rail advance together; force a 409 (second tab, stale
  rev) and see the row-local re-ask; reload on `#/programme` and land back on the
  tracker (obs assertion: `tools/obs trace <correlationId>` of the «تمّ ✓» write
  shows fe→be with the be-side `progress.write win` line; the 409 drill leaves one
  `cas_loss` line)

**Boundaries.** Contract §§0, 6, 8 (all). Budget 8 iterations.

**Exit protocol.** Done-when: oracle green ×2 · the live nav pass recorded in the
journal with its correlationIds · `tools/ci fe --slug programme-surface` green ·
promoted fe net green. Ask-when: any guard-rail failure traces to a be behaviour
(file it against be, don't patch around it) · a geometry defect needs a frozen css
rule changed · budget blown.
