# fe-5 — the guard rails: legacy invisibility, language, and one live pass

> Implementer journal. Lane slot 8 (fe :10800 → be :9800). `fe-1` (`0e840fe`),
> `fe-2` (`7dc9485`), `fe-3` (`4aebcf0`) and `fe-4` (`68d3f0d`) done and verified;
> `be-1..be-7` done. Every freeze check below is **path-scoped to fe-5's own delta**
> (WF-63). No supersession of any frozen oracle was needed (WF-65) — the two product
> changes below are in files fe-1 and the pre-slice app own, and no fe-1..fe-4 clause
> asserts on either.

## Pre-flight — the ground truth reproduces

| probe | expected | got |
|---|---|---|
| `tools/ci fe --slug classes-progress` from the fe worktree | fe-1..fe-4 green | **73/73 · gate PASS** |
| `tools/dev status` | lane 8 up | backend 9800 UP · frontend 10800 UP |
| `src/components/Controls.tsx:145` | ships «…بالذكاء الاصطناعي…» | reproduced, verbatim |
| `grep -rn 'ذكاء\|اصطناع' src/ index.html` | ONE hit | **one hit, that line** |
| Latin `AI`/`LLM`/`GPT`/`Anthropic` in `src/` | none | none (the only match was the string `CLAUDE.md` in a `tokens.css` comment) |
| absolute URL / host / port in `src/` | none | none |
| Arabic-Indic digits in `src/` | none in UI copy | one in an `index.css` COMMENT explaining why they are not used |

The independent verifier's three findings all confirmed, including the one that says
**leave things alone**: «المولّد» is user-visible in five places and is the product's own
name. It names the mechanism *neutrally*, which is what §13.1 asks for **instead of**
"AI" — the rule is not "never name the thing", it is "never name it as a clever machine".

## The one real fix — and the copy

```
- يولّد الموضوع بالذكاء الاصطناعي استناداً إلى البرنامج الرسمي. راجع المحتوى دائماً قبل الاستعمال في القسم.
+ الموضوع مبنيّ على البرنامج الرسمي. راجع المحتوى دائماً قبل الاستعمال في القسم.
```

Three things it does, and one it deliberately does not:

1. **The mechanism is gone, and the SOURCE takes its place.** §13.1's rule is not a word
   filter; the reason it gives is that naming the machine undercuts the claim. So the
   clause that was spent on the machine is spent on the programme instead. A nominal
   sentence («الموضوع مبنيّ على…») rather than a verb with a hidden agent — «يولّد
   الموضوع…» with the agent deleted reads as a passive missing its doer, and invites the
   reader to supply the word that was just removed.
2. **The second sentence is byte-unchanged.** «راجع المحتوى دائماً قبل الاستعمال في
   القسم.» was never the part that was wrong. Reviewing before class is a standing
   professional instruction and stands without a machine to justify it.
3. **It got shorter**, which on the busiest screen in the product is a gain by itself.
4. **It does not touch «المولّد»** — not in the brand block, not in `index.html`'s title,
   not in the four other places. Changing those renames the product, and fe-5's scope is
   a language sweep, not a rebrand.

## The two judgement calls

### 1 · The selected tab's green rail — CHANGED to ink

`.classtab--on .classtab__rail-fill` was `var(--accent)`. `--accent` is `#1f6b52` light /
`#4fae8a` dark: green, both ways.

**The fe-1 verifier's defence is correct on its facts and still loses.** The colour did
encode *selection*, not pacing, and two classes at the same week did draw identically —
I re-confirmed both. But the question is not what the colour encodes, it is what the
teacher reads, and the thing on screen is a **proportionally-filled green bar**, which is
the visual grammar of a score everywhere else in their life. The token is not a defence:
`var(--accent)` resolves to green, and a rule that a hex would violate cannot be satisfied
by spelling the same colour differently.

What decided it is that **the slice had already made this exact call twice and gone the
other way.** `App.css:983-984` (fe-3) and `:1076` (fe-4) both refuse the accent in so
many words — *"which rules out red, green, and the accent, which happens to be green in
this theme"* — and fill the affirmative action with ink instead. The rail was the one
position surface still using it. That is an inconsistency inside one slice, not a
principled exception.

Selection is now carried by contrast: `--ink-soft` against the unselected
`--border-strong`. It is still the loudest rail on the bar, and the tab itself already
carries selection three other ways (`--surface-sunk` background, a border, `--ink` text).
Hierarchy from contrast, not from hue — the same trade `.classpos__go` makes.

Pinned at both ends so it cannot drift back: no grading classname or inline colour in the
DOM, and **no accent/danger/warn/literal colour in any App.css block whose selector draws
a position**. The second clause is the one that matters — the first would have passed the
original happily.

### 2 · The class layer's silence — KEPT, and pinned

fe-1, fe-2 and fe-3 each flagged that a failed progress *read* degrades to nothing: no
panel, no rail, no message. **That silence is right, and it is now three executable
clauses instead of three open notes.**

The argument that settles it is already in `App.tsx:404-415` and it is about blast
radius: **a `be` that predates this slice answers `404` to every class call.** If the
class layer had an error surface, every teacher on an older backend would boot into a
banner about a feature they have never used and cannot use — contract §10 says deploying
one stack alone changes nothing the other's users see, and 17,861 teachers is what "every
teacher" means here. Whatever an error state buys, it cannot buy that.

Three more reasons it is honest rather than merely convenient:

- **Nothing recoverable is lost.** The class layer is read-only until the teacher acts,
  and every *write* has a full state machine already (`409` re-reads and re-asks, `503`
  is retryable with the week still chosen, `401` drops the identity). Silence on a read
  costs a bar; silence on a write would be a defect, and there is none.
- **The degradation is the app itself.** A failed class list renders the legacy shell —
  and this is now asserted against the *same byte recording* the zero-class case uses, so
  "degrades to the app they had yesterday" is a measurement, not a description.
- **A class whose position could not be read gets no setter, and that is the load-bearing
  half.** The plausible "fix" for the silence is to synthesize an empty snapshot so the
  surface renders. That would ask a teacher who positioned this class last week «أين وصل
  هذا القسم؟» again, primed at week 0 against a `rev` nobody read. It is pinned
  negatively, and the mutant that does it (M5) is killed by that clause alone.

**What I am NOT claiming.** In the bar, a failed read and a genuine week-0 class look the
same — both draw the name alone. That is a real ambiguity and I am recording it rather
than papering over it: it cannot lead to a wrong action (no setter, so no write), it
heals on the next successful read, and the only way to remove it is to say something,
which is the thing that must not happen on an old `be`. If it ever needs a surface, the
place is the class's own panel, never the tab.

## What was built

| path | what |
|---|---|
| `features/…/tests/fe/guard-rails.characterization.test.tsx` (new) | the net — 22 clauses |
| `src/components/Controls.tsx` | the disclaimer, and the note saying why |
| `src/App.css` | `.classtab--on .classtab__rail-fill`: `--accent` → `--ink-soft` |

### The recording, and how it was taken

The strongest clause in the suite compares the whole legacy shell to a **literal
`outerHTML` recording of the pre-slice app**. A clause phrased as "no class node is
present" passes for an implementation that moved a button; byte equality does not.

It is a real capture, not a transcription: `main` (`f994678`) checked out into a detached
worktree, its `App` rendered through the *same* runner config with `GET /api/subjects`
answering `{subjects: []}`, and `.app`'s `outerHTML` written to a file and injected into
the suite programmatically. 3,018 chars. The worktree is removed.

The pin then reads: **today's shell === the recording with exactly one substitution**,
and it asserts the recording really contains the old sentence — otherwise the
substitution is a no-op and the clause would pass proving nothing.

### Two things the suite got wrong first, and what they taught

1. **The language helper failed on its own label.** `assertClean` folded the surface name
   («classbar», «signup/step3») into the string it matched, and those names are Latin.
   Three clauses went red for the harness, not the app. The name rides in the assertion
   *message* now.
2. **The banned-word clause flagged its own explanation.** Writing down *why* «الذكاء
   الاصطناعي» is banned put the phrase back in the tree, and the naive grep could not tell
   a violation from the note describing it. Fixed by scanning **comment-stripped** source:
   the rule is about what a teacher reads, and only a quoted string or JSX text can reach
   a screen. A blanket ban would delete its own reasoning — which is how a rule survives
   as a lint and dies as an idea. The same strip fixed the CSS clause, which had been
   reading the comment above the rule as part of the rule.

## Mutation checks — the oracle bites

Ten mutants, each reverted immediately. `guard-rails` has 22 clauses; the counts below
are across ALL five fe suites.

| mutant | clauses killed |
|---|---|
| M1 · the disclaimer reverts to «بالذكاء الاصطناعي» (**the revert-check**) | **4** |
| M2 · the rail goes back to `var(--accent)` | 1 |
| M3 · the bar renders for a teacher with no classes | 6 |
| M4 · a failed class list calls `report` | 3 |
| M5 · a failed progress read synthesizes an empty snapshot | 1 |
| M6 · the list always sends `?classId=` | 7 |
| M7 · an Arabic-Indic digit reaches a tab («أسبوع ٨») | 5 |
| M8 · the rail gets an inline `background` | 1 |
| M9 · an English string on the position surface | 5 |
| M10 · `\frac` leaks into the position line | 3 |

**The revert-check, in full.** `git stash push -- src/components/Controls.tsx` →
`gate FAIL`, 4 failed / 90 passed:

```
× the shell is BYTE-IDENTICAL to the pre-slice recording, save the one declared sentence
× «ذكاء» and «اصطناعي» appear in no string and no markup anywhere in the tree
× the builder's disclaimer names the PROGRAMME, and still tells the teacher to review
× a `be` that predates this slice (`404` on the class list) renders the LEGACY SHELL, byte for byte
```

`git stash pop` → 95/95 green again.

**M5 and M10 each exposed a hole, and one was mine.** M5 killed only the no-setter
clause, not "draws by name alone" — correct, because a synthesized week-0 snapshot draws
no rail either; the setter clause is the one that has to carry it. M10 was caught by
**fe-3's** suite and not by mine: my position-surface clause opens on a *week-0* class,
which is the one state that has no position line and no notice at all, so «موقعكم
المسجَّل…» and the `409` notice were both being swept by a clause whose title claimed
them. A second clause now renders a positioned class and drives a real conflict; M10 and
M11 (the notice in English) both die there.

## Done-protocol

### 1 · The oracle, twice

| | result |
|---|---|
| `features/classes-progress/tests/fe/guard-rails.characterization.test.tsx` | **22/22** |
| all five fe suites — `tools/ci fe --slug classes-progress` from the fe worktree | **95/95 · gate PASS**, run 1 and run 2 |
| fe-1 + fe-2 + fe-3 + fe-4 oracles, unedited | **73/73** |
| `npx tsc -b` · `npm run lint` (oxlint) | clean, clean |

### 2 · The promoted net

`project/tests/fe` staged under a throwaway slug so it runs through `tools/ci`'s own
entry point against the JOB checkout (`features/_perimeter-fe/`, deleted afterwards) —
the invocation fe-1..fe-4 all used:

| | result |
|---|---|
| `project/tests/fe` — 21 suites, with fe-5's `src/` | **313/313 PASS** |

Unchanged from fe-1..fe-4's recorded 313/313. **Worth naming: the promoted net did not
catch the AI string.** 313 clauses over 21 suites, including three that render the
builder, and none of them looks at the disclaimer. That is exactly why a hardening
sub-issue exists — a regression net pins what previous jobs decided to pin, and nobody
had decided to pin this.

### 3 · Freeze audit — path-scoped (WF-63)

```
git status --short -- features/classes-progress/tests/fe/{class-bar,class-switch,
    week-zero-position,signup-classes}.characterization.test.tsx        → empty
git status --short -- src/lib/{taxonomy,persist,classes,api}.ts \
    src/components/{AdminConsole,RefinePanel,ExamView,SolutionView,SubjectList,
    AuthPanel,ClassBar,ClassPosition,ClassEditor,SignupClasses,MyClasses}.tsx \
    src/App.tsx                                                          → empty
git status --short                       → M src/App.css · M src/components/Controls.tsx
```

Two files, both inside "fix-only diffs in files fe-1..fe-4 already own": `App.css` is
fe-1's grid/bar block, `Controls.tsx` is the pre-slice app, which the language clause's
own scope makes fe-5's to fix. **No new component, no new dependency, and every
fe-1..fe-4 oracle byte-untouched** — no WF-65 supersession was needed or taken.

### 4 · The live nav pass — lane slot 8

**The legacy half, first, because it is the one with 17,861 users.** A fresh anonymous
teacher minted straight off the lane (`POST /api/teacher` → `312884c3…`, zero classes),
seeded into the browser, page loaded:

```
appClass "app"   ·   .classbar absent   ·   .classpos absent   ·   [role=alert] 0
localStorage keys: teacher.id.v1, teacher.controls.v1   ·   teacher.class.v1 ABSENT
```

…and the shell's `outerHTML`, taken out of the live browser and diffed in a script
against the pre-slice recording:

```
pre-slice bytes : 3876
live       bytes: 3825
LIVE == pre-slice with the one declared substitution:  True
```

The real Vite dev server, the real `be`, the real browser — byte-identical to the app
that shipped before this job, apart from the sentence fe-5 changed on purpose.

**The class half**, on a teacher with two classes (`4c23267a…`):

| | observed |
|---|---|
| grid | `grid-template-rows: 64.75px 735.25px` · `grid-template-columns: 380px 900px` — the bar is a ROW; the two RTL columns are untouched |
| tab order (RTL) | «3ر1» left=1146, «3تج2» left=1081 — first class RIGHTMOST, matching `createdAt` ascending |
| rail fill, RTL | track `left 1171 → right 1243`; fill `left 1214 → right 1243`. **`fillRight == trackRight`** — it grows leftward from the right edge |
| rail colour | `rgb(168, 176, 169)` = `--ink-soft`. `--accent` in this theme is `#4fae8a`. **The judgement call is live** |
| week-0 class | «أين وصل هذا القسم؟» + «حدّد أين وصلت» + «نبدأ من الأسبوع 1», no rail, no pacing |
| switch | selection moves, `teacher.class.v1` = the new id |
| reload | «3تج2» still selected, restored from storage |
| the disclaimer, on screen | «الموضوع مبنيّ على البرنامج الرسمي. راجع المحتوى دائماً قبل الاستعمال في القسم.» |

**The obs assertion.** One progress write driven through the UI — week 24 → 11 on «3ر1»:

```
$ tools/obs trace 6dc85078-3da5-40fe-8b88-126cc37e7177
[BE] {"msg":"progress.write","classId":"6a7aa243…","week":11,"rev":6,
      "outcome":"win","correlationId":"6dc85078-…","teacher":"4c23267a"}
[BE] {"msg":"request","method":"PUT","path":"/progress/6a7aa243…","status":200,
      "ms":4.8,"correlationId":"6dc85078-…"}
```

fe → be, one correlationId, the `progress.write … outcome win` line the exit protocol
asks for. 4.8 ms — this slice's latency shape, and the reason none of its states are
about waiting.

## Not settled by the sub-issue

- **A failed progress read and a genuine week-0 class are indistinguishable in the bar.**
  Judged above and kept; recorded here so the next reader inherits it as a decision
  rather than finding it as a surprise.
- **The lane is shared, and it showed.** Mid-pass, `be`'s log carried `progress.write`
  lines for two other teachers (`87af62aa`, `05580e8c`) and a real `cas_loss`, and one of
  my fixture classes disappeared from `GET /api/classes` between two reads — there is no
  delete route, so something wrote Mongo directly. Nothing here is a product finding; it
  is a note that a live pass on a shared lane needs its own identity, which is why the
  legacy half was done on a freshly minted one.
- **The MCP browser's `read_page`/ref layer lagged the live DOM repeatedly** and a few
  blind clicks landed real writes (the extra `progress.write` lines around week 20/24 are
  mine). Every live claim above was therefore re-read out of the page itself rather than
  taken from a ref listing. Also: `localStorage.clear(); location.reload()` does **not**
  clear a session — React re-writes `teacher.id.v1` from state before the navigation
  lands. Clear, then `navigate`.
- **`ClassPosition` still has no `compact` prop** (fe-4's open note). Step 4 still hides
  the eyebrow and lede with CSS. Untouched on purpose: it needs its own oracle, and
  fe-5's Delta is fix-only.
- **The banned-word clause reads strings, not comments.** A deliberate narrowing, argued
  above. It means a future `// TODO: mention the AI` is legal — which is correct, and the
  rendered sweep is what stands behind it if such a comment ever became a string.
- **Western digits are pinned on rendered surfaces and in source**, but nothing pins the
  *number formatting* of a value `be` sends. Every number in this slice is a small
  integer rendered by template literal, so there is no `toLocaleString` to go wrong yet.
  The day one appears, `ar-DZ` will happily emit ٠-٩ and the rendered clause will catch
  it on whatever surface a test drives — not everywhere. Recorded as the sweep's edge.

## review

**Verdict: approve.** Cross-model review (Fable).

- The rail-colour supersession re-measured live: `rgb(168,176,169)` = `--ink-soft`,
  accent `#4fae8a` untouched elsewhere; no red/green anywhere on a position surface.
  The two-ended pin (DOM + CSS-block scan) is the right design — the CSS-side clause is
  the one that would have caught fe-1's original.
- The kept silence on a failed progress read re-examined and accepted: the no-setter
  half is load-bearing and pinned (M5), the blast-radius argument (17,861 teachers on an
  older `be`) is decisive, and the bar-ambiguity is honestly recorded.
- The legacy byte-recording held in my own live pass (zero-class teacher: `"app"`, no
  bar, no alerts, no class key).
- One scope note: fe-5's language sweep pinned the *rendered* surfaces, and rightly —
  but the slice's one remaining reachable English string arrives via `err.message` from
  `be` (`store_unavailable`), which no rendered-tree sweep can see until the failure
  happens. That is fe-3's reopen, not this sub-issue's miss; recorded here because the
  sweep's edge ("nothing pins a value `be` sends") is exactly where it lives.
