# fe-1 — the class layer and the bar

> Implementer journal. Lane slot 8 (fe :10800 → be :9800). `be-1..be-4` done and
> verified before this started.

## Pre-flight — the ground truth reproduces

| probe | expected (SEED §2 / sub-issue) | got |
|---|---|---|
| `grep -rn "<nav" src \| wc -l` | 0 | **0** |
| `document.querySelectorAll('nav').length` in the RUNNING app | 0 | **0** (browser, :10800) |
| `sed -n '890p;906p;919p' src/App.tsx` | the three early returns | `if (!teacherId \|\| authOpen) {` · `if (hash === "#/admin") {` · `return (` |
| `.app` grid (`App.css:10-15`) | 2 columns, `grid-template-rows: 100%` | as recorded; RTL warning at `:1-8` is about COLUMNS |
| `tools/dev status` | lane 8 up | backend 9800 UP · frontend 10800 UP |

The `be` surfaces were probed with curl rather than trusted from the handoff summary:

- `POST /api/teacher` → `b7d20ce6…`; `GET /api/classes` → `{classes: []}` for a fresh id.
- `POST /api/classes {name:"3ر1", stream:"شعبة الرياضيات"}` → `201`, id `6a7a7a36…`
  (24 lowercase hex). **`stream:"شعبة العلوم التجريبية"` → `400 invalid_request`** — the
  corpus value is `علوم تجريبية`, and the streams are validated against the corpus, never
  a union (contract §2). The six live values were read out of
  `data/programmes/*.jsonl`.
- `GET /api/progress/:id` on a fresh class → the synthesized empty state, **all eight
  keys present including `programmeTranscriptionRev: null`**, plus a live
  `programme: {docKey, edition, totalWeeks: 27}`. On the sciences class the docKey is
  `tadarroj-3as-sciences` — per class, resolved from its own stream.
- `PUT {rev:0, markedWeek:8}` → `200`, `rev: 1`, identity fields stamped. Replaying the
  same `rev: 0` → **`409 conflict`, immediately**.
- `GET /api/subjects?classId=<id>` → `200`; `?classId=a&classId=b` → **`400`**;
  `?classId=` → **`200`**. Both degenerate values behave exactly as contract §5 pins them.

## What was built

| path | what |
|---|---|
| `src/lib/classes.ts` (new) | `ClassRef` · `Progress` · `ProgrammeSummary` · `ClassProgress`, plus `railPercent()` |
| `src/lib/api.ts` | `listClasses` · `getProgress`, both through `request()` — that function is byte-untouched |
| `src/lib/persist.ts` | `teacher.class.v1` + `load/save/clearCurrentClassId` |
| `src/components/ClassBar.tsx` (new) | the switcher: one tab per class, a 72px rail on the positioned ones |
| `src/App.tsx` | `classes` / `classProgress` / `currentClassId`, `loadClasses`, `onSelectClass`, the render branch, and the new key in `dropRejectedIdentity` |
| `src/App.css` | `.app--classes` + `.classbar`/`.classtab*` + one print rule — **appended, zero deleted lines** |

Three decisions worth naming:

1. **The grid row is a MODIFIER, not an edit to `.app`.** `.app` still reads
   `grid-template-rows: 100%`; `.app--classes` overrides it to `auto 1fr`. A teacher
   with no classes gets `className="app"` — the same string as today — so the
   zero-class shell is byte-stable by construction rather than by care.
2. **The list and the rails land together.** `loadClasses` awaits the class list *and*
   every class's progress before setting state. Painting names first and letting rails
   pop in a beat later would make a late rail indistinguishable from a class with no
   position, which is a different and meaningful state.
3. **A week-0 class shows its name and nothing else.** No rail, no «أسبوع 0». The
   prototype's tab label is `${name} · أسبوع ${week}` unconditionally; at week 0 that
   would be the product asserting a position nobody set (contract §7.2).

## Loop

### Iteration 1 — oracle red for the right reason

`class-bar.characterization.test.tsx` written first, 13 clauses.
`tools/ci fe --slug classes-progress` → `gate FAIL`, `Failed to resolve import
"@/lib/classes"`. Nothing existed yet; correct red.

### Iteration 2 — 12/13, and the one failure was a real finding

```
AssertionError: expected '50%' to be '50.0%'
```

`railPercent` emitted `50.0%`; **CSSOM stores `width: 50.0%` back as `50%`**, so the
value the function produced differed from the value the DOM reported for the very
element it had just sized. Fixed at the source — `Number(pct.toFixed(1))` — so one
decimal survives where it carries information (8/27 is 29.6%, not 30%) and never a
trailing `.0`. The oracle's two literal expectations were corrected in the same breath
(`100.0%` → `100%`); recorded here because it is the only pin that moved, it moved
before the file was ever green, and it moved to match the platform rather than the code.

`tools/ci fe --slug classes-progress` → **13/13, gate PASS**.

### Iteration 3 — the perimeter caught a real defect

The promoted `project/tests/fe` net (21 suites, 313 clauses) run against the JOB
checkout: **1 failed**.

```
FAIL persistence-gaps/revisions > 409 conflict is surfaced as RETRYABLE, in Arabic
  expected 'غير موجود…' to contain 'جارٍ تعديل هذا التمرين، أعد المحاولة'
```

Baseline on the same net with `src/` stashed: **313/313 green**. So it was mine, and it
was not a test artefact:

`loadClasses` sent its failures to `report`, which owns the exam surface's
`role="alert"`. That suite's fetch mock does not know `/api/classes`, so the 404 landed
in the alert and displaced the conflict message the teacher was supposed to read. The
same thing happens in production against **any `be` that predates this slice** — every
teacher would boot into a red banner about a feature they are not using, and it would
keep stealing the alert a refine or a save needs. Contract §10 says one stack deploying
alone changes nothing the other's users see.

Fix: a failed class read renders **no bar and nothing else**. The single exception is
`teacher_required`, which is not a class-layer failure at all — it goes to the gate.
A new negative clause was added to the oracle to pin it (an added pin, not a weakened
one), taking the suite to 14.

> **Left open, deliberately:** the class list has no error state of its own. "No bar"
> is the honest degradation for a switcher with nothing to switch between, but if
> fe-3/fe-4 give the class layer a surface that can fail visibly, that decision should
> be revisited there rather than inherited silently.

## Done-protocol

### 1 · Oracle green ×2

`tools/ci fe --slug classes-progress`, from the fe worktree, twice: **14/14, gate PASS**
both times.

### 2 · Perimeter differential

The promoted fe net staged under a throwaway slug so it runs through `tools/ci`'s own
entry point against the JOB checkout (`features/_perimeter-fe/`, deleted afterwards):

| | before (src stashed) | after | verdict |
|---|---|---|---|
| `project/tests/fe` — 21 suites | **313/313 PASS** | **313/313 PASS** | unchanged |
| `.app` className, zero classes | `app` | `app` | byte-identical |
| `.app` children, zero classes | `sidebar`, `workspace` | `sidebar`, `workspace` | unchanged |
| `GET /api/subjects`, zero classes | `/api/subjects` | `/api/subjects` | byte-identical |
| existing localStorage keys | the seven | the seven; the eighth exists only once a class is picked | additive |

### 3 · Freeze audit

```
git status --short -- src/lib/taxonomy.ts src/components/AdminConsole.tsx   → empty
git diff -- src/lib/api.ts    | grep '^-'  → no deleted lines   (request() untouched)
git diff -- src/App.css       | grep '^-'  → no deleted lines   (no existing rule changed)
git diff -- src/lib/persist.ts| grep '^-'  → no deleted lines
git diff -- src/App.tsx       | grep '^-'  → ONE line: the `.app` div's opening tag
```

That one line is the className expression the render branch requires, and it is inside
the sub-issue's delta. `npm run build` (tsc -b + vite) and `npm run lint` (oxlint) are
both clean.

### 4 · `tools/ci fe --slug classes-progress`

`gate PASS (1 ran, 0 skipped)` — 14/14, run from
`project-worktrees/classes-progress/stacks/teacher-fe`.

### 5 · The live pass (:10800, real `be` on :9800)

jsdom cannot see a grid row collide with an RTL column layout, so the geometry was
measured in the browser at 1280×800:

| | measured |
|---|---|
| bar | `l 0 → r 1280`, height 65, `top 0` — spans both columns, first row |
| sidebar | `l 900 → r 1280`, `top 65` — **still the rightmost track**, RTL intact |
| workspace | `l 0 → r 900`, `top 65` |
| tab order | `3ر1` at `1150–1256`, `3ع2` at `1091–1142` — **DOM order runs right to left** |
| rail, 8/27 | track 72px at `1171–1243`; fill `29.6%` = 21px at `1222–1243` — **flush RIGHT**, fills right-to-left |
| week-0 class | name only — no `.classtab__rail` node at all |
| after `PUT markedWeek: 27` on the second class | `3ع2 · أسبوع 27`, fill `100%` = 72px, while `3ر1` stayed at 29.6% — two classes, two independent positions |
| click + real reload | `teacher.class.v1` = `"6a7a7a57…"`, `.classtab--on` still `3ع2` |
| `#/admin` | console renders (403, not an admin), **no `.classbar`, no `.app`** |
| a teacher with zero classes | `className="app"`, children `[sidebar, workspace]`, both at `top 0`, no bar, no alert, no `teacher.class.v1` |
| every request | relative, lane-local: `/api/subjects`, `/api/classes`, `/api/progress/:id`. **No `classId` in any URL**, and the zero-class teacher fires no progress read at all |

Not verifiable headlessly and recorded as such: the `@media print { .classbar { display: none } }`
rule was inspected, not exercised — no print run was performed.

## Not settled by the sub-issue

- **Nothing is selected on a first load with classes.** The prototype defaults to the
  first class; the contract calls "no class selected" legacy mode, and fe-1's oracle
  pins no-selection as the fallback. Left unselected — the state that behaves exactly
  like today — and flagged for fe-3, where "which class am I looking at" becomes
  load-bearing.
- **The word AI, in Arabic, is already on screen.** `Controls.tsx`'s disclaimer reads
  «يولّد الموضوع بالذكاء الاصطناعي…». Pre-existing copy, not this slice's, and untouched
  here — but the handoff rule ("the word AI appears NOWHERE") is about the product, not
  about new strings, so fe-5's language sweep will have to decide about it deliberately.
- **`tools/ci` is the only invocation that resolves these suites.** Running the same
  vitest command by hand — identical cwd, identical env, identical args, verified with a
  shadowed `npx` — fails every `.tsx` suite with `Failed to resolve import
  "@testing-library/react"`. Unexplained, harmless (the supported entry point works),
  recorded so the next person does not lose the same twenty minutes.
