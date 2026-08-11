# fe-5 — the shell learns views: nav, hash mirror, wiring — and every new css rule

> Implementer journal. Lane slot 9 (fe :10900 → be :9900), both up. `fe-1`…`fe-4` done
> and verified before this started. The lane was used twice: once in pre-flight to
> reproduce the four render decisions in the running app, and once at the end for the
> live pass through both new screens — which is the only thing that can judge a
> nine-screen RTL sub-grid.

## Pre-flight — the ground truth reproduces

| probe | expected (sub-issue) | got |
|---|---|---|
| lane s9 up | be + fe answering | `GET :9900/health` → `200`, `GET :10900/` → `200` |
| fe worktree clean | nothing dirty | `git status --short` empty, on `feature/programme-surface` |
| the four render decisions | `:1137` gate · `:1153` `#/admin` · `:1175` `withClasses` · `:1192+` shell | `1137` / `1153` / `1176` / `1192` — the third is one line off the sub-issue's number and is the same decision (`const withClasses = classes.length > 0`) |
| no nav exists | `querySelectorAll('nav').length → 0` | `grep -c '<nav' src/**` → **0** in all 17 components and `App.tsx` |
| fe-1..fe-4 suites | green | **179 passed (179)**, `gate PASS`, 3.7 s |
| promoted fe net, against the JOB worktree | 313 | **313 passed (313)**, 21 files |
| `.app--classes` is the additive-row precedent | one modifier, `auto 1fr` | `App.css:904-906` — and it is the rule I may not edit, which is what makes the nav row a SECOND modifier (below) |
| the colour scanner aimed at me | fe-2 `.progbar*`, fe-3 `.weekcard*` | both read `src/App.css` and resolve `var(--token)` against BOTH themes. **fe-4's tracker suite has none** — its journal says the scanner is aimed at `.tracker__*` and it is not; this oracle adds it |
| the tokens the scanner calls ink | `--ink*`, `--border*`, `--surface*` | measured: every one is under 0.3 HSV saturation in BOTH themes. `--accent`, `--danger`, `--warn` are over it |
| `--destructive` | the sub-issue's name for the error token | this repo spells it **`--danger`** (`tokens.css:26`). Same rule, different name — neither appears in anything I wrote |

> **The promoted net had to be re-aimed to mean anything.** `tools/ci fe` from the clone
> root gates the **main** checkout, which does not carry a line of this job's code — so
> its 313 green says nothing about a nav row that renders inside `App`. The number in the
> done-protocol is the promoted net run with `CHAR_ROOTDIR` pointed at the **job
> worktree's** fe checkout (plus the `node_modules` symlink bridge `tools/ci` makes for
> itself). Both were run; only the second one is evidence.

## What was built

| path | what |
|---|---|
| `src/components/Nav.tsx` (new) | four items, two of them absent; the per-class pair appears with a selection |
| `src/App.tsx` | `view` derived from the hash · `go()` · the programme cache + its read · `onProgressWrite` (rev, the 409 re-read, the class-gone path) · the nav row · `programmeScreen()` |
| `src/App.css` | **every rule this slice ships** — nav, the two screens' states, the bar, the card, the tracker's nested sub-grid. Appended below one marker comment; no existing rule touched |

`src/lib/*`, `ClassBar.tsx`, `WeekCard.tsx`, `Tracker.tsx`, `ProgrammeBar.tsx` were not
opened for writing.

Decisions worth naming:

1. **The view is DERIVED from the hash, not stored beside it.** `viewOf(hash)`, and the
   `hashchange` listener that already existed for `#/admin` is the only subscription.
   That is one state and one listener for three screens, and it is what makes Back and
   Forward move the screen instead of only the URL — the contract's seal amendment,
   implemented by deletion rather than by a second mechanism. A class-less teacher's
   view is forced to `home` at the same line, so a shared `#/programme` link cannot
   change what they see.
2. **A second grid modifier, because `.app--classes` is slice 1's rule.** The nav needs a
   third `auto` track and the Delta forbids editing an existing rule, so the shell is
   either `app` exactly or `app app--classes app--nav`. Both modifiers are added by one
   condition, and the appended rule wins on source order. Pinned executably — the
   zero-class clause reads `className === "app"`, the with-classes clause reads the full
   string and the child order.
3. **The 409 re-read is one function, and every write goes through it.** `rev` is added
   in exactly one place; `advanceWrite` builds the pair; «وصلنا هنا» passes a bare
   position through untouched. On a conflict it re-reads once and rethrows, because the
   ROW owns the re-ask (§7) and swallowing the rejection would make a tap produce
   nothing visible. The re-read failing is caught and dropped — the conflict the teacher
   needs to see must not be replaced by a second failure.
4. **Both hosts key their component by class.** For the card it stops a pending write and
   a notice following the teacher into another classroom. For the tracker it is
   load-bearing: fe-4's scroll is a MOUNT effect, so without a key the component survives
   a switch and never lands on the new class's week — and the previous class's open bands
   stay open. Two clauses pin it, one of them switching to a class whose document is
   already cached so nothing suspends the tracker on its own.
5. **The screens replace the workspace's content, and the builder is wrapped rather than
   rewritten.** «الرئيسية» is asserted byte-identical by capturing `.workspace`'s
   `innerHTML` before the first switch and comparing after coming back.
6. **`programmeAsked` is a ref, and a failed read leaves it.** Asked and arrived are
   different facts; the cache guard keys on the first, and a class whose read failed has
   to be askable again or a later visit shows a waiting line for a request nobody is
   making. That distinction survived only because a mutant killed it (M15 below).
7. **The bar is a host decision.** The tracker always draws it; the week screen draws it
   only from week 1, so an unpositioned class gets the question and not an empty year
   beside it. Contract §4 as amended — «no pacing» is not «no bar», and the branch lives
   in the host rather than inside the component.

## Loop

### Iteration 1 — the oracle, then the wiring

Written oracle-first and red before a line of `App.tsx` moved (43 clauses at that point;
228 in the gate today, against 179 inherited). One clause failed on its own spelling
rather than on the code — it demanded `.tracker__row { display: contents }` as a rule of
its own, and the stylesheet says it in a grouped selector with `.tracker__sum`, which is
the same statement for the same reason. Replaced with `declaresFor()`, which asks whether
any rule NAMING that selector declares the property, and carries a negative control so it
cannot pass vacuously.

### Iteration 2 — the mutation pass

Thirty-eight mutants against the three files this sub-issue owns, the whole job gate
re-run on each, the source restored between, and the driver aborts if a substitution does
not apply. **Four survived the first pass, and all four were real holes.**

| # | mutant | clauses killed |
|---|---|---|
| M7 | the nav is not a row of the shell | **34** |
| M14 | the programme cache is dropped — every view switch re-reads 38 KB | **25** |
| M29 | a class switch takes the teacher back to the builder | **25** |
| M8 | the hash is written but never read — deep links and Back die | **22** |
| M2 | «إعداد موضوع» ships greyed | 4 |
| M9 | the hash is not written on a view change | 4 |
| M21 | `rev` is not the one the teacher was looking at | 4 |
| M23 | **the 409 re-read is skipped** | 3 |
| M24 | the conflict is auto-resubmitted after the re-read | 3 |
| M1 | the nav renders for a class-less teacher | 2 |
| M13 | the programme is read on the builder too | 2 |
| M18 | the write's 200 is trusted for the week ceiling too | 2 |
| M22 | a write failure is swallowed — the row never re-asks | 2 |
| M28 | an unselected class is an ERROR rather than a question | 2 |
| M33 | the bar's fill becomes a score | 2 |
| M3 · M4 · M5 · M6 · M10 · M11 · M12 · M16 · M17 · M19 · M20 · M25 · M26 · M27 · M30 · M31 · M32 · M34 · M35 · M36 · M37 · M38 | one each | 1 |

† **The four survivors, and what each one exposed:**

- **M15 — a failed programme read could never be retried.** The retry button calls the
  loader directly, so deleting the id from `programmeAsked` looked dead. It is not: it is
  the difference between «coming back to this class asks again» and «coming back to this
  class waits forever». Clause added; the mutant dies.
- **M19 — the week card's write body built inline instead of through fe-1's builder.**
  Invisible at week 8 of 30, where `markedWeek + 1` and the builder agree. The tracker had
  a last-week clause; the card did not. Added at `W === T`, where the two part.
- **M20 — `programme.totals.weeks` used as the write bound.** Exactly the contract §3
  collapse, and every fixture in this suite had the two numbers agreeing — which is the
  condition the contract warns about, reproduced accidentally in my own harness. The
  clause now renders the real 27-week maths document under a 30-week bound and asserts
  the card says «من 30», the header says «27 أسبوعًا», and the write clamps to 28.
- **M27 — the tracker unkeyed.** It survived because the first switch always misses the
  programme cache, which unmounts the tracker anyway. The second clause switches BACK to
  a class whose document is held, folds a band first, and asserts the return is a fresh
  visit.

After the additions: **38 of 38 dead.**

### Iteration 3 — the live pass, and two things jsdom could not have told me

Lane s9, real teacher `b7d20ce6…`, two real classes (3ر1 · maths · week 8, 3ع2 · sciences
· week 27). Both screens driven in a real browser, dark theme and light.

| what | outcome |
|---|---|
| «هذا الأسبوع» | week 8's two rows, both ministry columns, guidance through KaTeX — `x ↦ e^{-λx²}`, `a ∈ ℝ*₊`, `a^b = e^{b\ln a}` as islands inside RTL prose, order intact |
| «البرنامج» | 27 bands, collapsed; page **3,515 px** against ~8,060 uncollapsed. Week 20 open = 1,239 px / 7 rows; week 1 = 161 px / 1 row — **7.7×**, sharper than the recorded 5.1× because this layout's content column is narrower |
| week 24 | 4 ✱ flags and the legend, quoted verbatim with «الصفحة 18» — muted ink, no hue |
| the sub-grid | `getComputedStyle` reports `subgrid` live; per-row hours and «مجموع الأسبوع» stack in one column, week 20's seven ones under its seven |
| «تمّ ✓» on week 8 | band 8 → «منجز», band 9 current and open, bar fill advanced, class-bar rail 29.6% → 33.3%, hours-to-date 56 → 63 — one PUT, `progress.write outcome:win`, `correlationId 7c739e57-8457-4aed-b9ef-a118b188fbf4` |
| the 409 drill | a `curl` PUT moved the class to week 14 behind the tab's back; «تمّ ✓» then answered 409 (`f6ede1d4-8288-4c92-b351-d9049520cf53`, `outcome:cas_loss`, one line), the position re-read to 14 **and the re-ask rendered inside band 9 only** — no banner, no second PUT, other bands untouched |
| class switch | the view held, the second class's own programme was read (5-hour weeks, its own units), the tracker remounted on **its** week 27 |
| Back | moved the screen to the builder, «الرئيسية» marked current |
| reload on `#/programme` | landed on the tracker; the second programme GET answered **`304`** — the ETag story, live |
| zero classes | a real class-less teacher: `className="app"`, children `[sidebar, workspace]`, no `<nav>`, and the boot request set is `GET /subjects` · `GET /classes` — **no programme request** |

**Three CSS defects the live page found, all fixed here:**

1. **The list marker sat on its own line.** `Statement` returns a block, so a `::before`
   on the item was pushed above it. The item is a flex row now and the ministry's block
   takes the rest of it.
2. **The tracker header was pinned and shouldn't be.** Sticky, it covered a quarter of a
   900-px workspace and hid the very band the mount scroll had just landed on. Dropped,
   with the reasoning written into the rule: it is worth revisiting when the BAR can be
   pinned without the provenance line and hours-to-date coming with it.
3. **The row-local 409 notice was a 128-px column of seven lines.** The status track is
   sized for a tag and two short buttons. `\.tracker__band:has(.tracker__notice)` widens
   that track for the one band that has something to say — the band that lost the CAS
   gets room to explain, at the expense of its own content column and nothing else.

## Done-protocol

| rung | outcome |
|---|---|
| oracle green ×2 | **PASS** — `228 passed (228)` twice |
| all 179 prior clauses still green | **PASS** — they run in the same gate; 20 + 29 + 56 + 74 + fe-5's 49 = 228 |
| freeze audit (fe-5 scope) | **clean** — `git status --short -- src/components/{ClassBar,AuthPanel,AdminConsole,WeekCard,Tracker,ProgrammeBar}.tsx src/lib` empty; the whole fe diff is `M src/App.css`, `M src/App.tsx`, `?? src/components/Nav.tsx` |
| `tools/ci fe --slug programme-surface` from the fe worktree | **gate PASS** |
| promoted fe net `project/tests/fe` | **313 passed (313)**, 21 files, **run against the JOB worktree** (see pre-flight), quiet host — no test runner alive, load 2.43 |
| `tsc -b --force` / `oxlint src` | clean, exit 0 |
| live pass, both screens | recorded above with its correlationIds |

## What this sub-issue did not settle

- **A hard reload beats the scroll-to-marked, and it is the browser winning, not a bug.**
  Measured: scroll to the middle of the tracker, press F5, and Chrome restores that
  scroll AFTER the mount effect has run — the marked week is not landed on. The effect
  itself is fine (instrumented live: it fires on every mount, and lands correctly on
  every in-session view switch and class switch). The one-line fix,
  `history.scrollRestoration = "manual"`, is global: it would also stop a teacher's
  place in a long exam sheet from being restored on the builder. Left alone deliberately,
  and flagged for fe-6.
- **The pinned bar is a real loss, recorded rather than hidden.** The prototype pins its
  bar and the instinct is right on a four-screen page; what could not ship is pinning the
  whole header. Pinning the bar ALONE needs a structural split inside `Tracker`.
- **The tracker has no class name.** fe-4 left the question here, and the class bar
  directly above already marks the selected class. Adding one would be new copy on a
  screen whose whole discipline is that the copy is the ministry's — not worth inventing
  under this Delta.
- **A programme read that fails has ONE error slot, not one per class.** Only the selected
  class has a screen, so a second slot would hold a message nobody can see. Cleared on
  switch and on retry. If a later slice renders two classes at once this becomes wrong.
- **The band's columns are tuned for a 900-px workspace and there is no media query.**
  At this width the content track is 370 px, which is tight for a 432-character guidance
  paragraph. It reads, and fe-6 measures the real page; a narrow-viewport rule would be a
  layout path nothing in this job tests.
- **`.tracker__band:has(…)` is the first `:has()` in this stylesheet.** Well supported
  everywhere this ships, and it is the only way a CSS-only fix could reach a notice the
  component nests inside the status cell.
- **Neither screen renders the builder's banners.** A generation that fails while the
  teacher is reading the tracker reports nothing until they return to «الرئيسية». The
  alternative — the exam surface's alert on a programme screen — is the borrowed-error
  state slice 1 already ruled against.
- **fe-4's journal says the colour scanner is aimed at `.tracker__*`. It was not** — that
  suite has no stylesheet scanner at all. This oracle carries it, over five prefixes at
  once, with positive controls in both themes.
