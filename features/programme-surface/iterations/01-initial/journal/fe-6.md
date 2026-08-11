# fe-6 — the guard rails: absences, channels, and one pass against the real page

> Implementer journal. Lane slot 9 (fe :10900 → be :9900), both up. `fe-1`…`fe-5` done and
> verified before this started, and their 228 clauses are frozen against me. The lane was
> used for the whole of the middle of this sub-issue: a guard-rail net is the one job where
> jsdom cannot tell you whether the rail is in the right place.

## Pre-flight — the ground truth reproduces, with two corrections

| probe | expected (sub-issue) | got |
|---|---|---|
| lane s9 up | be + fe answering | `GET :9900/health` → `200`, `GET :10900/` → `200` |
| fe worktree clean | nothing dirty | `git status --short` empty, on `feature/programme-surface` |
| fe-1..fe-5 suites | 228 green | **228 passed (228)**, `gate PASS`, 3.9 s |
| the live maths programme | 8 keys · 14 units · 27 weeks | exactly that; 103 rows, 189 hours |
| `\square` left anywhere | **none** (sub-issue) | **0 strings, 0 occurrences** — confirmed |
| the symbols that replaced them | `\mathbb{…}` | **26 occurrences across 21 strings** — `\mathbb{R}`, `\mathbb{Z}`, `\mathbb{C}` |
| odd-`$` strings | zero (SEED H5) | **0** of 310 strings; 265 `$…$` spans |
| Latin outside a `$…$` island | — | **0 strings of 310.** Measured because it decides whether a document-level Latin sweep can be honest. It can |
| absolute URL in `src/` | none | `grep -rn 'https\?://\|localhost\|:9900\|:10900'` → **nothing** |
| the slice-2 CSS region | clean | 62 rules, 6 prefixes, **0 hued declarations** in either theme |
| `--danger` / `--accent` / `--warn` in the region | absent | present 5×, **all inside comments**; zero declarations |

**Two ground-truth corrections, neither a stop.**

1. **«week 6 (1 row)» is wrong.** Week 6 has **4** rows. The one-row weeks of the maths
   document are **1, 11, 21 and 27**. The fact being asserted — a 1-row band against the
   7-row week 20 — reproduces on week 1, which is the week fe-5 actually used. The SEED's
   `week 6 ≈ 99 px` is a stale label on a real measurement, not a contradiction, so this
   went in the record rather than to a stop-and-ask.
2. **`--destructive` is spelled `--danger` here** (`tokens.css:26`), as fe-5 already
   recorded. The sweep refuses both spellings so a rename cannot reopen the door.

## What was built

One file: `features/programme-surface/tests/fe/guard-rails.characterization.test.tsx`
— **33 clauses**, eight sections. Plus **one product fix**, an append to `src/App.css`
(§ *The second judgement*, below).

The design decision that shapes the whole net: **the sweeps are derived, never listed.**

- The colour scan reads **every rule after the slice-2 marker**, not a prefix list. fe-2,
  fe-3 and fe-5 each aimed a scanner at the selectors they knew about; a rule added under a
  seventh prefix would have escaped all three. 62 rules, both `:root` blocks, HSV
  saturation ≥ 0.3, with a positive control per theme.
- The absolute-URL scan walks **all of `src/`** off the filesystem.
- The island census computes its expected count **from the fixture** (265) rather than
  writing it down, so a re-recording moves both sides and a broken renderer moves one.
- `readableText()` walks text nodes and skips anything inside a `.math` island — which is
  what makes «not one Latin letter» a statement about the whole document rather than about
  a hand-picked list of elements.

Three scoping decisions that took a failing clause each to get right, all of the same
shape — **a sweep that answers itself is worse than no sweep**:

1. **KaTeX's own vocabulary.** `mspace` contains «pace»; `katex-accent` contains «accent».
   A raw-HTML regex for a pacing marker fails on correct code, and the obvious repair is to
   weaken it until it catches nothing. Every classname sweep now runs over `ourElements()`
   — `.progview [class]` minus `.math` descendants.
2. **Slice-1 prose.** `ExamView.tsx:121` names `\mathbb{C}` in a comment illustrating what a
   *generated exam* may contain; `Controls.tsx:146` records, in prose, that «يولّد الموضوع
   بالذكاء الاصطناعي…» was deleted from the busiest screen in the product. Both are the
   notes that keep those rules understood. The symbol and «AI» sweeps read stripped source;
   the two `square`/`mathbb` spellings still read RAW, scoped to this slice's seven files,
   so fe-3's `grep -rn square src/components` stays honest.
3. **«البرنامج» is the builder's word too** — the topic picker's first option is «مواضيع
   مختلطة من البرنامج». Banning it in the class-less sweep would have passed only by
   deleting slice-1 copy: a guard rail damaging what it guards.

## Loop

### Iteration 1 — the net, red in seven places, four of them mine

Seven clauses failed the first run. Four were the scoping faults above. The other three
were real information:

- **`totalWeeks` and the programme are separate knobs in the mock**, and my ≠27 clause set
  only one of them — so the card said «من 27» while the header said «30 أسبوعًا». That is
  contract §3 working exactly as written, discovered by tripping over it. The clause now
  drives both.
- **`readableText()` was not normalised.** `{totals.weeks}{" "}\n أسبوعًا` is three text
  nodes and one phrase; a raw join made «30 أسبوعًا» unfindable. A text-node boundary is a
  fact about JSX, not about what the teacher reads.
- The media-query clause was **written before the measurement** and failed honestly until
  the measurement was in (below).

### Iteration 2 — the mutation pass, and the hole it found

Twenty mutants against the files this slice owns, each restored between, the driver
aborting if a substitution did not apply.

> **The driver was wrong first, and the way it was wrong is worth recording.** Run one
> reported **all eighteen mutants surviving**. The invocation was missing the
> `node_modules` symlink bridge `tools/ci` makes for itself — the suites live in the
> personal repo, which has no `node_modules`, so five of six files failed to *collect* and
> the JSON reported `0 failed`. A green that means nothing ran: the exact hollow-run class
> WF-82 outlaws, reproduced inside my own harness. The driver now refuses any run that
> collects under 200 clauses.

| # | mutant | guard-rail clauses killed |
|---|---|---|
| M5 | an absolute backend URL compiled into `api.ts` | **19** |
| M3 | an English UI string in the nav | **16** |
| M2 · M16 | the note goes through KaTeX · guidance printed raw (LaTeX leaks) | 4 each |
| M14 | a course link «الدرس ←» on a content item | 3 |
| M4 · M6 · M7 | Arabic-Indic digits · `--danger` on the status tag · `--accent` on the bar fill | 2 each |
| M1 · M8 · M9 · M11 · M12 · M13 · M15 · M17 · M18 · M20 | one each | 1 |

**Eighteen of twenty dead. Two survive this net, and both are correct layering:**

- **M10 — the programme is fetched on the builder too.** fe-5's cache decision, pinned by
  fe-5 (3 clauses). Duplicating it here would be noise, not coverage.
- **M19 — the emphasis caption carries guidance instead of the legend.** fe-4's §6.3, killed
  there. It survives *my* net legitimately: the four `added-2022` rows' guidance carries no
  `$` and no backslash, so nothing actually leaks in this data and my clause is right to
  stay silent.

† **M18 was the real find, and it survived the first pass.** `title={`${run.hours} h
(expected)`}` on the bar's segments — an English label carrying the invented «expected»
reference §6.4 exists to refuse — walked straight through a sweep that only reads **text
nodes**. Three surfaces of this slice speak *only* through an attribute: the segment
tooltip, the emphasis flag's caption, the nav's landmark name. `readableAttributes()` was
added (`title` · `aria-label` · `placeholder` · `alt`, `.math` excluded, three non-vacuity
anchors), and M18 and M20 both die on it.

## The five sweeps

| sweep | result |
|---|---|
| **1 · language and constraints** | Clean. Not one Latin letter outside a KaTeX island on either screen, in text **or** in an attribute; no Arabic-Indic digit; no «AI» in the DOM or in stripped source anywhere in `src/`; no `$` and no backslash except the two `$` of the teacher's own note, which is counted exactly |
| **2 · legacy safety** | Clean in jsdom **and live**. A real class-less teacher (`da154f7e…`), deep-linked to `#/programme`: `className="app"`, children `[sidebar, workspace]`, one grid row, **0** `<nav>` / `.progview` / `.tracker` / `.weekcard` / `.progbar` / `.classbar`, zero slice-2 strings, and the API request set is exactly `GET /api/subjects` · `GET /api/classes` — **no programme request**, with the hash asking for one |
| **3 · relative URLs** | Clean. Every call at runtime, and every file under `src/` on disk |
| **4 · colour** | Clean. 62 rules, both themes, **0 hued declarations**; `--danger`/`--destructive`/`--accent`/`--warn`/`--success`/`--error` on no selector in the region; the four components name no colour at all, and no `color:`/`background` |
| **5 · live nav pass** | Below |

## The live pass

Lane s9, real teacher `b7d20ce6…`, two real classes. Desktop 1280×800 (workspace 900 px),
dark theme.

| step | what happened |
|---|---|
| land | the builder, «الرئيسية» current, hash empty, class bar showing «3ر1 · أسبوع 14» and «3ع2 · أسبوع 27» |
| switch class | to 3ع2 — view held on home, position card followed |
| «هذا الأسبوع» | on 3ع2: **its own** programme — «الشعبة : علوم تجريبية», 135 hours, 14 segments, week 27 fully filled |
| switch back | to 3ر1 — **the view held** (`#/week`), the maths document loaded: **15 segments** (the `u12` run split, live), week 14, 3 rows, 7 KaTeX islands, 0 errors. `direction` measured: page `rtl`, paragraph `rtl`, island `ltr` |
| «البرنامج» | 27 bands, **collapsed**, and the marked band scrolled to on mount (top at +58 px). Sub-grid live: `grid-template-columns: subgrid`, `grid-column: 3 / 5` |
| expand week 20 | **1,239 px, 7 rows, 4 `.mathbb` glyphs, 0 KaTeX errors**, «الصفحة 16» |
| expand week 1 | **161 px, 1 row** → the band-height ratio is **7.7×** |
| «تمّ ✓» on week 14 | band 14 → «منجز» and folded, offering «وصلنا هنا» · band 15 → «الأسبوع الحالي», open, offering both actions · hours-to-date **98 → 105** of 189 · class-bar rail **51.9% → 55.6%** · tab «أسبوع 14» → «أسبوع 15» · bar filled segments **8 → 9** · zero notices, zero banners. **One write moved all four.** |
| the trace | `tools/obs trace cd6cd445-d54a-49f4-ac06-49094fb51b96` → `[BE] progress.write … week:15 rev:4 outcome:"win"` and `[BE] request PUT /progress/… 200 21.6ms`. Two be lines, one tap |
| Back · Back · Forward | `#/programme` → `#/week` → builder (hash cleared, «الرئيسية» current) → `#/week`. **The screen moves, not just the URL** |
| the 409 drill | a `curl` PUT moved the class to week 22 behind the tab's back; «تمّ ✓» answered **409**, `outcome:"cas_loss"`, `d5360c3f-c166-4fae-a0ee-df8e94f617ad`, PUT 409 in 50.3 ms — **one** line, **one** notice, **inside band 15 only**, no banner, no second PUT, and the fresh position (week 22) re-rendered across bands, bar, hours-to-date and rail |
| reload on `#/programme` | landed back on the tracker |

**Two things the live page said that jsdom could not.**

1. **Uncollapsed, the tracker is 28,194 px — about 39 screens, not the SEED's ~8,060 / 9.**
   The SEED measured the prototype's flat layout; the shipped component carries the
   ministry's three columns, which the H2 kill put back. Band ratio is **12.6×** (week 15 at
   2,035 px against week 27 at 161 px), not 5.1×. Collapse takes it to **3,544 px** — an 8×
   reduction, five screens instead of thirty-nine. The argument for collapse was already
   won; it is much stronger than it was written.
2. **265 KaTeX islands, 26 `.mathbb` glyphs, 0 errors, 4 emphasis flags, 1 legend, across
   the whole year** — matching the corpus census exactly (265 `$…$` spans, 26 `\mathbb`, 4
   `added-2022` rows). Every span in the ministry's document became mathematics; none
   leaked. That measurement became a clause, computed from the fixture rather than written
   down. Week 15's «القسمة الإقليدية في ℤ» is the corpus correction on a real screen.

## The two judgements fe-5 handed on

### 1 · The reload — the symptom does not reproduce, so there is nothing to fix

fe-5 measured «a hard reload beats the scroll-to-marked» and declined the one-line
`history.scrollRestoration = "manual"` because it is global and would cost a teacher their
place in a long exam sheet on «الرئيسية». I re-measured, and **the effect wins** — twice,
from both directions:

```
parked at workspace scrollTop  300 → reload → landed at 2865   (the effect's target)
parked at workspace scrollTop 4081 → reload → landed at 2865   (the effect's target)
```

The reason is structural rather than lucky: **the scroller is `.workspace`, not the
document** (`overflow-y: auto`, slice 1). A browser can only restore an element's scroll
offset if that element is scrollable when restoration runs — and at that moment the tracker
is a waiting line, because its 27 bands do not exist until the programme read resolves.
There is no height to restore into, the restore is a no-op, and the mount effect then runs
against a laid-out page.

So the answer is not «accept the browser's answer» but «the layout already answered»:
taking over `scrollRestoration` would buy nothing here and still cost the builder its place.
**Left untouched, and both halves pinned** — the assignment must appear nowhere in `src/`,
and the app's own scroll must stay once-per-mount and confined to `Tracker.tsx`. The day the
tracker renders before its data, the browser's restore starts winning and this note stops
being true; the second pin is what will make that visible.

### 2 · The narrow viewport — a real defect, and it was inside my Delta

Measured live on the real maths document, the ministry's content track by viewport width:

| viewport | content track | verdict |
|---|---|---|
| 1280 | 370 px | reads |
| 820 | 322 px | reads |
| 700 | 202 px | a 432-character paragraph in a column two words wide |
| 560 | 62 px | unusable |
| **414** | **0 px** | **gone — and «مجموع الأسبوع» printed on top of «7 ساعة» in every collapsed band** |

The band's `4.5rem` and `3.5rem` tracks never shrink, so below roughly 465 px the `1fr`
content track is squeezed out of existence and the two `minmax(0, …)` tracks start colliding
with their own text. Nothing overflows and nothing scrolls sideways — the ministry's words
simply stop being on the screen, which is the one thing this surface exists to show.

**What made it a defect rather than a limitation: the builder reads perfectly at 414 px.**
Slice 1 already ships `@media (max-width: 900px)`, so this app claims narrow support and
every other screen honours it. The tracker was below its own product's standard, and it is
the only five-track grid in it.

Fixed, because it is inside my Delta: fe-6 may make fix-only diffs in files fe-1..fe-5
already own, `src/App.css` is fe-5's registered path, and the change is a pure **append**
below the slice-2 marker — one hunk at line 1910, **zero deletions**, no existing rule
edited. `@media (max-width: 820px)` — the handoff's own number, above the damage rather
than at it, so the switch costs a little density and buys the ministry's paragraphs the full
width instead of a third of it.

The sub-grid's *meaning* survives the switch, and that is the part a careless fix would
lose: with one band track there is nothing left for `subgrid` to inherit, so `.tracker__rows`
takes two tracks of its own. Verified live at 414 px — content track **284 px** (was 0), no
overlap, no horizontal overflow, and **every row's hours right-edge at 89 px, identical to
the week total's**. «The rows sum to the week» is still visible at exactly the width where
the teacher has least room to check it. Desktop re-measured after: `72px 144px 370px 56px
128px`, `subgrid`, `3 / 5` — unchanged.

## Done-protocol

| rung | outcome |
|---|---|
| oracle green ×2 | **PASS** — `261 passed (261)` twice, guard-rails **33/33** each time |
| all 228 prior clauses green | **PASS** — same gate; 20 + 29 + 56 + 74 + 49 + 33 = 261 |
| promoted fe net `project/tests/fe` | **313 passed (313)**, 21 files, **0 skipped**, run with `CHAR_ROOTDIR` on the JOB worktree's fe checkout (fe-5's aiming — the clone-root run gates a checkout carrying none of this code). Quiet host: load 3.37, no other runner alive |
| freeze audit (fe-6 scope) | **clean** — fe-1..fe-5's five oracle files, `programme-fixtures.ts` and `fixtures/` untouched; `contracts/` and `SEED.md` untouched; `src/components`, `src/lib`, `src/App.tsx`, `package.json` untouched. The whole fe diff is `M src/App.css`, one hunk, 50 insertions, **0 deletions**, entirely below the marker at line 1324 |
| `tools/ci fe --slug programme-surface` from the fe worktree | **gate PASS** |
| `tsc -b --force` · `oxlint src` | clean, exit 0 both |
| live nav pass with a traced write | recorded above, with both correlationIds |
| mutation pass | 18 of 20 dead by this net; the two survivors killed by the sub-issues that own them |

## What this sub-issue did not settle

- **`scrollIntoView({block: "center"})` lands a tall band's heading above the fold.** Week
  22 open is 1,878 px; centred, its week number, its status tag and both action buttons are
  off-screen, so the teacher arrives mid-paragraph in the ministry's text. `"start"` would
  be better at every band height. **Not changed**: `Tracker.tsx` is fe-4's, the parameter is
  their deliberate choice, and this is suboptimal rather than broken — everything is present
  and one small scroll away. It is a one-word change for whoever picks it up.
- **The `\square` clause the sub-issue's oracle text specifies does not exist**, on
  instruction: the escalation was closed at the source and there is no placeholder left to
  pin. What §6.5 actually forbids — a stack deciding what a symbol meant — is pinned in both
  directions instead, over this slice's seven files.
- **The Latin sweep rests on a corpus fact**, re-measured at pre-flight: zero of 310 strings
  carry a Latin letter outside a `$…$` island. A future document that puts a Latin word in
  Arabic prose would redden a clause that is not wrong. The clause names the measurement so
  the next reader knows what to re-check rather than what to delete.
- **The island census is fixture-bound by construction, not by a literal.** Both sides are
  derived and both are asserted non-zero (265 and 26), so a re-recording moves them together
  and an empty fixture cannot satisfy it by agreeing with an empty DOM.
- **`readableAttributes()` covers four attributes.** `title`, `aria-label`, `placeholder`,
  `alt` — the ones this slice uses. `aria-describedby` and friends carry no copy today.
- **The narrow rule is one breakpoint, not a responsive design.** Below 820 px the band is
  one column and reads; nothing else about the tracker was re-tuned for narrow, and the bar
  at 414 px draws fifteen segments the thinnest of which is 12 px.
- **28,194 px is the tracker with every band open**, which no teacher does. It is quoted as
  the reason collapse exists, never as a page weight.

## review

**Verdict: approve.**

Attack log (cross-model, prosecution):
- The derived-sweep design (marker-region CSS scan, fixture-computed island census, `readableAttributes`) is the right answer to the prefix-list blindness it names, and the hollow-run self-catch (a driver that reported 18/18 survivors because nothing collected, now refusing runs under 200 clauses) is exactly the WF-82 class of failure, caught in its own tooling and disclosed. That disclosure is why this net is trustworthy.
- Constraints re-swept independently on the live composed page at review time: 0 `$`, 0 backslash, 0 `□`, 0 Arabic-Indic digits, no "AI", attributes clean, 12 `.mathbb` glyphs on open week 15, 0 KaTeX errors. Confirmed.
- The reload judgement (structural argument: the browser cannot restore scroll into a scroller that has no height yet) was accepted on its pinned form rather than re-measured — the two pins (no `scrollRestoration` assignment anywhere; scroll once-per-mount confined to `Tracker.tsx`) are what make the claim safely falsifiable later, which is the right shape.
- The narrow-viewport fix is inside the declared fix-only Delta, append-only below the marker, and the 820px breakpoint verified present in `App.css`. The `scrollIntoView({block:"center"})` handoff to fe-4 stands as recorded debt.
- Its two mutation survivors were re-judged: both are correct layering, killed by the suites that own the rules.
