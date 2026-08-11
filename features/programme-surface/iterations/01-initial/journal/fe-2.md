# fe-2 — the segmented bar: fifteen segments where the prototype drew fourteen

> Implementer journal. Lane slot 9 (fe :10900 → be :9900). `fe-1` done and verified
> before this started. **No lane was needed**: fe-2 is a pure component and its oracle is
> jsdom-only — the only live ground truth it depends on (the wire shape, the 15 runs) was
> recorded by fe-1 and is frozen in `programme-fixtures.ts`.

## Pre-flight — the ground truth reproduces

| probe | expected (sub-issue) | got |
|---|---|---|
| fe-1's suite, from the fe worktree | green | **20 passed (20)**, `gate PASS` |
| fe worktree clean before the first edit | nothing dirty | `git status --short` empty, on `feature/programme-surface` |
| promoted fe net | 313/313 | **313 passed (313)**, 21 files, load average 2.26 |
| prototype home bar `Prototype v2.dc.html:134-148` | segments + accent marker + pace line | re-read: `:138` the segment loop, `:140` the 3 px `var(--color-accent)` tick, `:141` «متوقَّع — الأسبوع {{expectedWeek}}» |
| prototype tracker bar `:222-232` | the same bar, marker unconditional | re-read: `:226` draws the marker with **no `hasReference` guard at all** |
| the marker's data source | `hasReference` has none | `:1136` `hasReference: marked > 0` — **byte-identical to `hasPosition` on the same line**; `:936` `const marked = cls.week, expected = 12` |
| the pacing sentence | invented | `:941-942` `paceLine`/`paceNum` — «متأخرون بأسبوعين…», «(−2 أسابيع)», both computed from `marked - 12` |
| jsdom keeps logical CSS properties | unknown | probed: `inset-inline-start`, `inset-block`, `direction` all survive `el.style` — so RTL can be pinned in the DOM, not only at source level |

The `hasReference` finding is worth stating plainly because it is the whole reason this
sub-issue ships an absence: **the prototype's marker is not gated on having a reference.
It is gated on having a position, and the reference is the number twelve.**

## What was built

| path | what |
|---|---|
| `src/components/ProgrammeBar.tsx` (new) | the whole deliverable — a pure `{programme, markedWeek}` component. ~15 lines of JSX, the rest is why |

It consumes `deriveRuns` · `trackTotal` · `runFill` from fe-1 and does one division of its
own. `src/lib/programme.ts` was not touched, read-only as declared.

Decisions worth naming:

1. **The segment is the only thing with a width; the fill is the only thing with a
   position.** Inline style carries exactly what IS the datum (two widths) plus the
   positioning that makes those numbers mean anything (`position`, `inset-block`,
   `inset-inline-start`, and `direction: rtl` on the track). Every decorative rule —
   height, border, radius, **ink** — is absent and belongs to fe-5's `App.css` append.
   The line is deliberate: `ClassBar`'s single-block rail works only because one block in
   an RTL parent starts at the right on its own, and that does not generalise to fifteen
   segments each of which must fill from its own leading edge. Shipping that pattern as
   classNames alone would leave the one geometrically load-bearing fact of this component
   in a file this sub-issue may not write.
2. **`percent()` inherits `railPercent`'s two rulings and parts from it on precision.**
   Null rather than `"0%"`, and never a trailing zero (CSSOM stores `50.0%` back as
   `50%`). But four decimals, not one: a rail is a single block whose rounding is
   invisible, while fifteen widths must still add up to one track — at one decimal they
   can miss it by up to 0.75%, a visible sliver of unexplained bar. That is a real
   difference between the two surfaces, not a second spelling for the same one, and the
   mutation pass confirms it (M10 below).
3. **The tooltip is `title`, not the prototype's `data-tip`.** `data-tip` needs a CSS rule
   to become visible and every rule here is fe-5's; `title` needs none and is the
   accessible name. Content: the ministry's unit **name** (verbatim, resolved through
   `units[]`) · the run's hours · **✎**. The mark is scoped to the hours on purpose — the
   name is theirs, the run boundary and its sum are ours.
4. **A dangling `unitId` costs its name, not the bar.** `units.find(...)?.name`, and the
   tooltip falls back to the hours alone. It never prints the assigned id: `u12` is our
   bookkeeping and means nothing to a teacher.
5. **The bar renders no text node at all.** Not a style choice — it is the strongest
   available pin on absence two: a component with no text has nowhere for a pacing
   sentence to appear, whatever wording someone later reaches for.

## How the three absences are pinned

Each one is a negative that a future refactor could helpfully undo, so each is
executable rather than stated.

| absence | how it is held |
|---|---|
| **no expected-week marker** | the track's children are **exactly** the segments (an extra sibling fails) · the only absolutely-positioned nodes are fills, asserted by identity · no node is 3 px wide, none pins `top`/`bottom` (the marker's signature) · the rendered subtree has **zero text** · the code (comments stripped) contains no `expected`, `reference`, `hasReference`, «متوقَّع» |
| **no pacing sentence** | eleven phrases the prototype's `paceLine`/`paceNum`/caption can produce are absent from `textContent` **and from every attribute value**, at `markedWeek` 0/1/9/27 · and from the code |
| **no accent, no red, no green** | measured as a colour, not as a name — see below |

**The colour pin resolves tokens to hex and measures them.** `src/styles/tokens.css` is
parsed into its two themes (light + the dark `@media` override); HSV saturation ≥ 0.30 is
*hue*, below is *ink*. Then three clauses:

- **positive control** — `--accent`, `--accent-border`, `--danger`, `--warn` classify as
  hue in **both** themes; `--ink`, `--ink-soft`, `--ink-faint`, `--border`,
  `--border-strong` classify as ink in both. The slice-1 ruling is the gap this measures:
  `--accent` is 0.71 saturated, `--ink-soft` is 0.07. A clause that cannot fail is
  visible as one, so the classifier is shown to discriminate before it is trusted.
- **the stylesheet scanner** — every rule in the real `App.css` whose selector mentions
  `progbar`, `progbar__seg` or `progbar__fill`, with **every** declaration's value scanned
  for a hex or a `var(--token)` that resolves to one. Empty today, and that is the point:
  it is aimed at **fe-5**, who writes the rules. Its own positive control feeds it
  `.progbar__fill { background: var(--accent) }` (caught twice — once per theme, because
  a rule that is only green after dark is still green), a raw `#a4342a`, and a hue hidden
  inside a `border-inline-end` shorthand; and confirms it stays quiet on `var(--ink-soft)`,
  on `block-size`, and on another component's selector.
- **the component names no colour at all** — no hex, no `rgb()`/`hsl()`, no
  `--accent`/`--danger`/`--warn`/`--success`, no `green|red|success|danger|warning` word,
  no inline colour property on any rendered node, and no classname reading as a grade
  (`accent|danger|success|warn|green|red|behind|late|ahead`).

## Loop

### Iteration 1 — the component and the oracle, together

47 of 49 clauses green on the first run. The two failures were both **mine, not the
component's**:

- three absence greps ran against the raw file, and the file's own prose *names*
  `hasReference` and «متوقَّع» in the paragraph explaining why they are absent. Fixed by
  introducing `readCode()` (comments stripped) and running every absence clause against
  it. A grep that punishes the record of a decision pushes the reasoning out of the file;
  what must not appear is the code.
- the scanner's positive control expected one offender for `var(--accent)` and got two —
  correct behaviour (both themes), wrong expectation. The clause now asserts the two and
  says why.

### Iteration 2 — the mutation pass (the actual verification)

Twelve mutants applied to the shipped component, the gate re-run on each, source restored
between. **All twelve die.**

| # | mutant | clauses killed |
|---|---|---|
| M1 | one segment per unique unit — the prototype's segmentation | **10 of 49** |
| M2 | the denominator becomes `totals.hours` | **1** |
| M3 | a `width: 0%` fill node instead of no node | 4 |
| M4 | the ported expected-week marker (absolute, 3 px, `var(--accent)`) | 4 |
| M5 | «متأخرون بأسبوعين عن التوزيع السنوي» rendered above the track | 4 |
| M6 | the fill goes `background: var(--accent)` | 2 |
| M7 | `left: 0` instead of `inset-inline-start: 0` | 2 |
| M8 | the tooltip takes `run.unitId` instead of the unit's name | 4 |
| M9 | a hardcoded `27` clamping the fill | 2 |
| M10 | `toFixed(1)` — the rail's precision applied to fifteen segments | 3 |
| M11 | an English `aria-label` | 1 |
| M12 | the derived hours lose their ✎ | 3 |

**M2's single kill is the right number and the point of the synthetic fixture.** All five
real documents have `totals.hours === Σ weeks[].hours`, so on `MATH` the mutant is
*indistinguishable* — it draws the identical bar. Only `DIVERGENT_TOTALS` separates them,
which is exactly why fe-1 built it synthetic. One clause, and without it the contract §4
denominator ruling would be untested on this stack.

**M10 is the evidence behind decision 2.** One decimal is not a rounding preference: the
fifteen widths stop summing to the track and three clauses say so.

### Iteration 3 — done-protocol

## Done-protocol

| rung | outcome |
|---|---|
| oracle green ×2 | **PASS** — `49 passed (49)` twice (fe-1's 20 + fe-2's 29) |
| fe-1's suite still green | **PASS** — it runs inside the same gate, untouched |
| freeze audit (fe-2 scope) | **clean** — `git status --short -- src/lib src/App.tsx src/App.css src/components/ClassBar.tsx` empty; the only fe diff in the whole worktree is `?? src/components/ProgrammeBar.tsx` |
| `tools/ci fe --slug programme-surface` from the fe worktree | **gate PASS** |
| promoted fe net `project/tests/fe` | **313/313**, 21 files, load average 2.26 — quiet host, no flake |
| `tsc -b` / oxlint | clean, exit 0 |

## What this sub-issue did not settle

- **`markedWeek: 0` renders the TRACK with no fill node — not nothing at all.** The
  instruction that reached this loop said "renders no bar at all — not an empty bar, not a
  0% fill". Two readings, and they part on whether the segmented track survives. Shipped:
  the segments render, **no fill node exists in any of them**. The reasons, on the record
  so it can be overruled in one line:
  - contract §4 says «`markedWeek: 0` → zero fill and no invented pacing» and §8.8 says
    «bar **unfilled**» — both presuppose a bar;
  - this sub-issue's own oracle asks for «zero fill in every segment **and no fill node
    claiming otherwise**» — segments, and no fill node;
  - fe-4's oracle asks that «the `ProgrammeBar` is present above them», unconditioned, and
    its `markedWeek: 0` clause never says the bar goes away;
  - the handoff renders the track at `marked = 0` too — `noPosition` gates the pace line
    and the invitation card, never the bar;
  - and the `railPercent` precedent the instruction cites is a **fill-width** function
    returning `null` rather than `"0%"`, which is precisely what `percent()` now does.

  If the intent really was "the component returns null", it is one guard at the top of the
  function plus a re-pin — but it should be taken as a **contract amendment** (§8.8) with
  fe-4 in the room, not as a component tweak.
- **`\square` is untouched.** The maths fixture carries its 21 strings and this component
  neither reads guidance nor sanitises anything; `grep -n square src/components/ProgrammeBar.tsx`
  is empty. The escalation stays parked.
- **Every appearance rule is fe-5's, and the oracle is now aimed at it.** The bar has no
  height, no border, no radius and **no ink** until `App.css` gains them. The stylesheet
  colour scanner will fail the moment those rules give it a hue — a deliberate trap laid
  for a sub-issue that has not run yet, and the note fe-5 should read before writing them.
- **A `title` tooltip is a hover affordance and nothing else.** It is not announced by a
  screen reader on a `div`, and the track is `role="img"` with one Arabic label. Whether
  the fifteen unit names need to be reachable non-visually is a real question this slice
  does not answer; fe-6's live pass is where it would surface.
- **`deriveRuns` walks the route's order and does not sort** (fe-1's note, inherited). The
  bar renders that order verbatim, so a future reordering of `weeks[]` would draw a wrong
  bar rather than a loud one.

## review

**Verdict: approve-with-debt.**

Attack log (cross-model, prosecution):
- Live: 15 segments on maths (u12 split visible), 14 on sciences, **zero fill nodes at markedWeek 0** (probed with a real week-0 class), no text node, no marker, no hue. My composed rounding mutant (`toFixed(0)`) died.
- **The debt: the `title` tooltip is a raw-text channel for a ministry string.** This component's own rule — "the channel is chosen by WHO WROTE the string, never by what today's corpus happens to contain" — is the exact argument fe-3 used to force unit names through `Statement` in the card. Here the same ministry string goes into a `title` attribute, where KaTeX cannot run: the day a unit name carries `$…$`, the tooltip shows LaTeX source. Zero unit names carry maths today (measured), so this is latent, and the guard-rails attribute sweep only certifies current data. Pair it with the recorded accessibility gap (a `title` on a div is announced by nothing) — one future fix can retire both.
- The week-0 "no pacing ≠ no bar" ruling was correctly escalated as a contract amendment with fe-4 in the room rather than decided silently; the reasoning trail is exemplary.
