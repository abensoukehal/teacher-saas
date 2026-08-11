# fe-3 — the week card: the ministry's words for this week, verbatim and attributed

> Implementer journal. Lane slot 9 (fe :10900 → be :9900), both up. `fe-1` and `fe-2`
> done and verified before this started. Unlike fe-2, this one **did** use the lane: the
> sub-issue's pre-flight asks for week 20's row shape from the live route, and the answer
> is the whole reason this card is not the prototype's card.

## Pre-flight — the ground truth reproduces

| probe | expected (sub-issue) | got |
|---|---|---|
| lane s9 up | be + fe answering | `GET :9900/health` → `200`, `GET :10900/` → `200` |
| fe worktree clean | nothing dirty | `git status --short` empty, on `feature/programme-surface` |
| fe-1 + fe-2 suites | green | **49 passed (49)**, `gate PASS`, 833 ms |
| live week 20 row shape | 7 rows, competencies on all 7, contents on 3 | `rows=7 withComp=7 withCont=3 withGuid=3`, `unitId=u12`, `pdfPages=[16]` |
| the frozen fixture still IS the live route | — | `JSON.stringify(fixture) === JSON.stringify(live)` → **true**. The recorded corpus has not drifted, so every clause below runs against real ministry text |
| provenance is on the wire | `source.authority` / `.title` | «وزارة التربية الوطنية — المفتشية العامة للتربية الوطنية» · a four-line title carrying `\n` |
| `emphasisLegend` | text + page | «تم ادراج ما هوملّون باللون الأحمر لعدم تناوله في السنة الدراسية 2022-2021» · page 18 |
| `added-2022` rows exist in the fixture | 21 corpus-wide | **week 24, four rows** — so the emphasis tag is pinned against real data, not a synthetic |
| multi-page weeks exist | — | 8 of 27 maths weeks span two pdf pages (3, 6, 12, 14, 16, 19, 23, 24) — the plural page label is exercised by the corpus, not invented |
| prototype week card `Prototype v2.dc.html:163-188` | unit heading · contents list · guidance block · two actions | re-read. `:172` «هذا الأسبوع — الأسبوع {{markedWeek}} من 27» — **27 written into the source** · `:177` «المحتويات المعرفية — كل محتوى يفتح درسًا» with `ct.open` and «الدرس ←» per item · `:179` the guidance block, `{{weekGuidance}}` **singular** · `:180` «نصّ الوزارة حرفيًا · التدرجات السنوية الرسمية» — a hardcoded literal |
| prototype invitation `:150-160` | the week-0 state | re-read: eyebrow «قسم جديد — {{className}}», h1 «أين وصل هذا القسم؟», the lede, «حدّد أين وصلت» + «نبدأ من الأسبوع 1» |
| the contract clause that moved | §4's `markedWeek: 0` | re-read as amended at fe-2: no pacing ≠ no bar; **the hosts decide whether the bar appears**, and the week card shows the invitation instead |

**The one number worth restating.** The prototype draws ONE contents list and ONE
guidance paragraph per week. Real week 20 has **seven rows**; four of them carry no
contents at all and three carry neither contents nor guidance. Rendered the prototype's
way, three of seven ministry rows are silently empty and the densest field in the whole
corpus — competencies, 76 of 103 maths rows — never appears. That is what this card is
for, and §1 of the oracle computes both counts from the fixture rather than quoting them.

## What was built

| path | what |
|---|---|
| `src/components/WeekCard.tsx` (new) | the whole deliverable — a pure `{programme, position, onAdvance, onGoTracker}` component |

`src/lib/programme.ts`, `src/lib/katex.tsx`, `src/lib/api.ts`, `App.tsx` and `App.css`
were not touched. It consumes `trackTotal` (fe-1), `Statement` (frozen, quirks and all)
and `GenerateError`/`teacherMessage` (slice 1's error seam), and does no arithmetic of
its own beyond one filter.

Decisions worth naming:

1. **The ministry's three columns are the card's three columns.** The prototype has a
   contents list and a guidance block; the corpus has `rows[]` with competencies,
   contents and guidance. Each row renders each of its non-empty columns under that
   column's Arabic name, and an **empty column renders nothing at all** — a labelled void
   reads as «the ministry said nothing here», when what actually happened is that the
   row's content lives in a different column.
2. **Guidance is joined with `\n`; contents and competencies are not joined at all.**
   Guidance is paragraphs (median 96 chars, max 432), so `Statement` makes one `<p>` per
   ministry sentence — week 20's first row carries two and they stay two. Contents and
   competencies are *items* in the ministry's table, so each gets its own `<li>` and its
   own `Statement`. Same rule from both directions: never fuse two of their strings.
3. **Provenance is one line, built from `source.authority` + `source.title` +
   `weeks[].pdfPages`.** The title carries embedded newlines and is put in the DOM
   **verbatim** — whitespace collapsing is CSS's business, and rewriting the string to
   make it fit would be the one edit this card exists to refuse. Eight of twenty-seven
   maths weeks span two pages, so «الصفحات 18، 19» is real data, not defensive code.
4. **The emphasis tag is a footnote marker plus the legend rendered ONCE.** Week 24 has
   four flagged rows; repeating a seventy-character ministry sentence four times is not a
   tag. So each flagged row gets «✱» (with the legend as its `title`) and the card ends
   with «✱ {legend.text} — الصفحة 18». Nothing paraphrases them, which is the §6.3 rule:
   the legend is the *only legal caption* for this marking.
5. **Exactly one ✎ on the card, and it is on hours-to-date.** That figure is the only
   thing here we compute — Σ `weeks[].hours` up to the mark, over Σ all of them, both
   through fe-1's `trackTotal`. Its denominator is the weeks and never `totals.hours`
   (§4), which the divergent fixture pins. Everything else is either theirs (verbatim, no
   mark) or the teacher's own (their week, their «أنهيت هذا الأسبوع ✓» — **no ✎**, because
   marking their decision as ours is the product taking credit for it).
6. **The card ships classNames and structure, with ZERO inline style.** `ProgrammeBar`
   needed inline widths because a width *was* the datum; nothing on this card is
   geometry, so every appearance rule — including the muted ink on «✱» — is fe-5's
   `App.css` append. That also makes «no inline colour» a one-line clause instead of a
   property allow-list.
7. **`onAdvance("done")` — the card builds no write body.** The Delta's props hand it a
   status, and fe-1's `advanceWrite` is fe-5's to call for both hosts. The oracle pins
   that this file contains no `advanceWrite`, no `entry`, no `Math.min` and no
   `markedWeek + 1`: one write shape, one place, per the sub-issue's rule 6.
8. **`position.rev` is declared and never read**, and that is deliberate — see «what this
   sub-issue did not settle».

## Loop

### Iteration 1 — the component and the oracle, together

**101 of 104 clauses green on the first run.** All three failures were the oracle's, not
the component's:

- two absence greps ran against the raw source, which quotes «27» and «التدرجات السنوية
  الرسمية» *in the prose explaining why neither is read from a literal*. Moved onto
  fe-2's `readCode()` (comments stripped) — same ruling, same reason: a grep that
  punishes the record of a decision pushes the reasoning out of the file.
- the corpus sweep («no ministry string is written into the component») tripped over a
  string that is literally `"."` — **two rows of the real maths document transcribe to a
  bare full stop**, and `expect(src).not.toContain(".")` can never pass. Filtered to
  strings longer than six characters and the surviving count (**308**) is asserted, so
  the clause cannot be emptied quietly later.
- «no inline style anywhere» failed on `height:0.675em` — **KaTeX's own output**. Added
  `ours()`, which excludes everything inside a `.math` island: the renderer's spans are
  not this component's DOM, and sweeping them would fail every clause on ministry text
  behaving exactly as designed.

One decision was moved OUT of the component during this iteration: the raw source now
contains neither the box-placeholder token nor any of ℤℂℝℕℚ, so **fe-6's
`grep -rn 'square' src/components` is pre-satisfied** rather than left to interpretation.

### Iteration 2 — the mutation pass (the actual verification)

Twenty mutants applied to the shipped component, the gate re-run on each, the source
restored between. **Eighteen died on the first pass; two survived and both were real
oracle gaps.**

| # | mutant | clauses killed |
|---|---|---|
| M1 | competencies dropped — a contents+guidance card | **5** |
| M2 | the prototype's card: contents only | **6** |
| M3 | one row per week — the handoff's flat shape | **7** |
| M4 | guidance joined with «·» instead of a newline | 2 |
| M5 | the position line reads `totals.weeks`, not the class's bound | 1 |
| M6 | a hardcoded twenty-seven in the position line | 3 |
| M7 | the provenance line becomes the prototype's hardcoded literal | 4 |
| M8 | contents become course links («الدرس ←») | 1 |
| M9 | the emphasis tag paraphrases instead of quoting the legend | 2 |
| M10 | the emphasis allow-list becomes a deny-list (`!== "normal"`) | 1 |
| M11 | the ✎ migrates onto «أنهيت هذا الأسبوع ✓» | 4 † |
| M12 | hours-to-date measured against `totals.hours` | 1 |
| M13 | week 0 renders a week instead of the invitation | 3 |
| M14 | the action sends `"skipped"` | 1 |
| M15 | the action stays live while the write is in flight | 1 |
| M16 | a 409 resubmits by itself | 1 |
| M17 | the notice goes `var(--danger)` | 1 |
| M18 | an English label reaches the DOM | 2 |
| M19 | the unit name skips KaTeX and renders as plain text | 1 † |
| M20 | the box placeholder is remapped to `\mathbb{C}` | 2 |

† **The two that first survived, and what each exposed:**

- **M19 was a genuine hole.** Nothing asserted that the unit heading goes *through*
  `Statement` — the channel clause only checked that the call sites, if present, take
  ministry expressions. The fix pins it twice: the heading contains a `.statement` node,
  **and** a forged unit name carrying `$[0;1]$` produces a `.math` island with no `$` in
  the text. Structural plus forged on purpose — no corpus unit name happens to contain
  maths today, and «this sample has no `$`» is an observation about one document while
  the rule is about **who wrote the string**.
- **M11 was a false survival**: `String.replace` took the *first* occurrence of «أنهيت
  هذا الأسبوع ✓», which is in the file's own doc comment. Re-aimed at the JSX, it dies on
  four clauses. Recorded because a mutant that edits a comment and "survives" is exactly
  how a mutation pass talks itself into a green.

**M1/M2/M3 are the point of this sub-issue and they kill the most.** M3 — the handoff's
own shape, one row per week — takes seven clauses down, which is the executable form of
«the screen cannot be ported».

### Iteration 3 — done-protocol

## Done-protocol

| rung | outcome |
|---|---|
| oracle green ×2 | **PASS** — `105 passed (105)` twice (fe-1's 20 + fe-2's 29 + fe-3's 56) |
| fe-1's and fe-2's suites still green | **PASS** — they run inside the same gate, untouched; their files were never opened for writing |
| freeze audit (fe-3 scope) | **clean** — `git status --short -- src/lib src/App.tsx src/App.css src/components/Nav.tsx src/components/ProgrammeBar.tsx` empty; the only fe diff in the whole worktree is `?? src/components/WeekCard.tsx` |
| `tools/ci fe --slug programme-surface` from the fe worktree | **gate PASS** |
| promoted fe net `project/tests/fe` | **313 passed (313)**, 21 files, no concurrent test loop (load 3.6, all of it the desktop — the fe-1 flakes came from a competing gate run, and there was none) |
| `tsc -b` / oxlint | clean, exit 0 |

## What this sub-issue did not settle

- **The note clause could not be pinned where it was asked for.** The instruction says to
  pin the two-channel rule «with a note containing two `$`», but the Delta's props are
  `{programme, position: {markedWeek, totalWeeks, rev}, onAdvance, onGoTracker}` — there
  are **no `entries` and no `note`**, so this card has no teacher-authored string to
  render. Pinned in the only way the frozen props allow, and it is arguably the stronger
  form: the corruption is reproduced as a **positive control** (`Statement` on «من 5 $
  إلى 9 $ دينار» loses both `$`), every `Statement` call site in the file is checked by
  name against a ministry-only allow-list, and the source is asserted to contain neither
  `note` nor `entries`. **The channel is closed by construction, not by discipline.** The
  rendered-note clause is fe-4's, where the data actually is.
- **`position.rev` is declared and never read.** It rides along because a position is one
  value and splitting it invites a caller to pass a stale half — but the compare-and-set
  token belongs to the write, and the write is fe-1's builder in fe-5's hands. The
  tempting use, clearing the 409 notice when a fresh `rev` arrives, is **wrong**: contract
  §7 says the losing surface shows the fresh state *and* re-asks, so the re-ask must
  survive exactly the re-read that produces a new `rev`. It is cleared by a new tap and by
  nothing else.
- **«نبدأ من الأسبوع 1» is not ported.** The prototype's invitation has two buttons; the
  second is a *write* (`markedWeek: 1`, no entry), and this card's only write prop builds
  an entry for the CURRENT week — which at 0 does not exist (`advanceWrite` throws below
  1, deliberately). Adding it means a second write prop, which is a props-contract change
  and therefore fe-5's decision, not a component tweak. «وصلنا هنا» in the tracker is the
  surface that already sets a position without annotating one.
- **The invitation drops the prototype's «قسم جديد — {className}» eyebrow.** The card has
  no class-name prop, and «قسم جديد» alone would be a claim: `markedWeek: 0` means
  *unpositioned*, not *new*. A class taught for a month whose teacher never recorded a
  week would be greeted as brand new. fe-5 has the class name if it wants the eyebrow back.
- **«تخطٍّ ↷» is not on this card.** The prototype's week card has one mark action and so
  does this one; the `onAdvance` prop is typed for both statuses because the *builder* is
  shared, and skipping is a tracker gesture (fe-4). Nothing here forecloses adding it.
- **The position line reads `position.totalWeeks`, not `programme.totals.weeks` — and
  contract §3 can be read the other way.** §3 says «never render the header off
  `totalWeeks`». The reasoning for the reading taken: this line is not the ministry's
  summary header (that is the tracker's, fe-4), it is a *mark stated against the bound
  that mark lives under*. If the two ever part, a card saying «من 27» while «أنهيت هذا
  الأسبوع ✓» clamps at 30 is the product contradicting itself in one glance. The
  discriminating clause is executable — the real maths programme (`totals.weeks: 27`)
  rendered at a 30-week bound must say «من 30» — so overruling this is a one-line fixture
  change plus a contract note, with fe-4 in the room.
- **A mark with no week behind it renders an honest line and no action.** Unreachable
  while the corpus is sound (`markedWeek` is bounded by the same document whose weeks are
  numbered 1…N), and the alternative — falling back to the invitation — would tell the
  teacher they have no position when they do. It offers no retry because nothing they can
  do fixes a gap in a transcription. Invented copy, so it is flagged here.
- **The unit heading is `role="heading" aria-level={1}` on a `div`, not an `<h1>`.**
  `Statement` returns a `<div>` and a `<div>` inside an `<h1>` is invalid phrasing
  content. Whether this card should own a heading level at all is fe-5's call — it owns
  the page.
- **Every appearance rule is still fe-5's, and the colour scanner is now aimed at this
  card too.** `.weekcard`, `.weekcard__row`, `.weekcard__flag`, `.weekcard__legend`,
  `.weekcard__field`, `.weekcard__notice`, `.weekcard__hours`, `.weekcard__provenance` —
  the moment any of them gets a hue in `App.css`, in either theme, this suite fails. The
  one most likely to attract red is `.weekcard__flag`; it must not have it (§6.3).
- **The box placeholder is untouched and now un-greppable.** The corpus's 21 such strings
  render as literal boxes, the card neither inspects nor remaps them, and the token
  appears nowhere in the file — comments included — so fe-6's raw grep is already clean.
  The escalation stays parked.
