# Stack spec — teacher-fe (React 19 · TypeScript · Vite)

> The per-job skeleton for the **fe** repo (`repos.sh` key `fe`).
> Filled at PLANNING for `classes-progress` from the locked SEED. Implemented by the
> `fe` stack agent against this feature's `contracts/`.
>
> **This slice triggers no generation.** Its latency shape is the opposite of the
> usual one: class and progress calls are millisecond CRUD. What is load-bearing here
> is *state hygiene* — a class switch is a TOTAL context switch, and the one thing it
> must never drop is `pendingSave`. **Slice 1 installs NO CSS framework** (SEED,
> Tailwind unknown — resolved, deferred to slice 5): everything ships in the existing
> `App.css` idiom.

## Scope recap (from SEED.md + this stack's sub-issues)
- Modules: `src/lib/classes.ts` (types + fetchers) · `src/components/ClassBar.tsx`
  (the switcher, a new grid row) · total context switch on class change · per-class
  subjects list (`?classId=`) · week-0 empty state + «حدّد أين وصلت» position setter ·
  sign-up steps 3–4 off the `issued` screen + the account «أقسامي» · persist key
  `teacher.class.v1` + `dropRejectedIdentity`.
- Contracts this stack must honor: `contracts/fe-be-classes-progress.contract.md`
  (esp. §§0, 4, 5, 6, 7), `contracts/flows.md`.

## Current behavior baseline
> Captured 2026-08-11 against lane slot 8 (fe :10800 → be :9800) — SEED §2. Pinned by
> `features/classes-progress/tests/fe/*.characterization.test.tsx`
> (WF-53 home; vitest + jsdom + Testing Library; run
> `tools/ci fe --slug classes-progress` FROM THE JOB WORKTREE; import `@/App`,
> `@/lib/...` — never relative `../../` into src. Model:
> `parallel-exercises/tests/fe/progressive-render.characterization.test.tsx`).

- **There is no navigation**: `document.querySelectorAll('nav').length` → `0` in the
  running app. The only "routing" is three top-level early returns —
  `App.tsx:890` (auth gate), `:906` (`#/admin`), `:919` (main shell).
- `App.tsx:96-197` is an ~18-`useState` block; no context, no store. The
  total-context-switch precedent is `onOpenSubject` (`App.tsx:479-495`).
- `.app` grid (`App.css:10-15`) is 2 **columns**; the RTL warning at `App.css:1-8`
  concerns columns — adding a **row** is safe (SEED).
- Persistence: seven localStorage keys (`persist.ts:20-34`);
  `dropRejectedIdentity` (`App.tsx:317-324`) clears identity-scoped keys when `be`
  rejects the id.
- `request()` (`api.ts:274-296`) is the single place `x-teacher-id` is set; all calls
  relative through the Vite proxy.
- `buildExamRequest` (`taxonomy.ts:10,78-91`) hardcodes `STREAM = "شعبة الرياضيات"` —
  the only stream fe knows today. **This slice does not change it** (generation binding
  is slice 3).
- `AuthPanel.tsx:23` a `Mode` union, two screens; the `issued` screen (recovery code)
  at `:115-254`. No step machine.
- RTL + KaTeX recording: an injected `.math > .katex` island inside an RTL paragraph →
  paragraph `rtl`, math `ltr`, bidi `isolate`, `inline-block`. This must survive
  every new surface.

## Observability (PIN co-requisite)
- Visible today: every `request()` response carries `correlationId`; be logs the new
  mutations (be-1). fe adds no logging layer (none exists; inventing one is out of
  scope) — the observability story for fe is that every class/progress call flows
  through `request()`, so `tools/obs trace <correlationId>` correlates a UI action to
  the be log line. Suites assert on rendered state + fetch calls.
- Blind spot: none newly opened — this slice adds no fire-and-forget calls; every
  write's outcome is rendered (success updates the rail/position; 409 renders the
  re-read state).

## Client state / types
| Type or store | Field | Change | Backend contract it mirrors |
|---------------|-------|--------|-----------------------------|
| `src/lib/classes.ts` (new) | `ClassRef {id, name, stream, createdAt}` · `Progress {classId, markedWeek, entries, rev, programmeDocKey, programmeEdition, updatedAt}` · `ProgrammeSummary {docKey, edition, totalWeeks}` | add | contract §3, §4 — mirrors recorded shapes, never the handoff's `contracts.ts` (its `programmeVersion: string` is wrong — contract §1) |
| App state (`App.tsx:96-197`) | `classes: ClassRef[]` · `currentClassId: string \| null` · per-class progress cache | add | §3, §4 |
| `persist.ts:20-34` | `teacher.class.v1` (the selected classId) | add key | §7.8; cleared by `dropRejectedIdentity` |
| `lib/api.ts` | fetchers for classes/progress/school | add (via `request()` only) | §3, §4, §0 |

## Surfaces (routes / views / components)
| Surface | Implementation path | New/Modify | Contract |
|---------|--------------------|-----------|----------|
| Class bar (switcher + thin per-class rail) | new `src/components/ClassBar.tsx` + `App.css:10-15` (add a grid ROW) + `App.tsx` (render branch AFTER `:890` auth gate and AFTER `:906` `#/admin`) | new | §3, §7.8 |
| Total context switch | `App.tsx` (reuse the `:479-495` shape) | modify | §7.8 |
| Per-class subjects list | the existing list fetch + `?classId=` | modify | §5 |
| Week-0 empty state + position setter | new component (used by home area, step 4, «أقسامي») | new | §4, §7.2 |
| Sign-up steps 3–4 | `src/components/AuthPanel.tsx:23,115-254` | modify | §0, §3, §4 |
| «أقسامي» (account) | AuthPanel / account area, reusing the class editor + setter | modify | §3, §4 |

## States (non-negotiable at this latency)
> No generation here — these are the slice's own states, and each must be answered in
> Arabic, RTL, with no red/green and no English.

| State | What the teacher sees |
|---|---|
| no classes (every existing teacher) | the app EXACTLY as today — no bar row, no `?classId=`, nothing (contract §0 legacy mode); classes are created via sign-up or «أقسامي» |
| classes loading | nothing flashes — the bar renders when the list arrives (ms) |
| week-0 class | «أين وصل هذا القسم؟» + «حدّد أين وصلت» + «نبدأ من الأسبوع 1» — an invitation, never an error, NO pacing, no bar fill invented |
| positioned class | the tab's thin rail fills markedWeek/totalWeeks; RTL fill |
| progress write in flight | the control disables for the beat; leaving is safe |
| `409 conflict` | the fresh position is re-read and shown, in Arabic: the position changed elsewhere — re-choose. NEVER auto-resubmitted |
| `503 store_unavailable` | retryable Arabic message; the chosen week stays selected locally |
| `401 teacher_required` | the existing rejected-identity path — which now also drops `teacher.class.v1` |

## Network discipline
All new calls go through `request()` (`api.ts:274-296`) to relative `/api/...` paths —
the header, the correlationId, and the lane proxy come for free. An absolute URL or a
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

### fe-1 — the class layer and the bar

**status:** done · **tag:** happy-path

**Intent.** The product can SHOW classes: a typed client layer mirroring the contract,
and a class bar as a new grid row that renders only when the teacher has classes — so
every existing teacher sees the app unchanged (contract §0), and slice 1 stays
invisible until a class exists.

**Ground truth.** SEED §2: `document.querySelectorAll('nav').length` → `0`;
`.app` grid is 2 columns (`App.css:10-15`), RTL warning at `:1-8` is about columns;
the three early returns at `App.tsx:890,906,919` are the only routing. Re-run:
`tools/dev up` and inspect. Pre-flight: reproduce nav=0 and the three-return structure
before writing a line.

**Delta (freeze).** May touch: new `src/lib/classes.ts`, new
`src/components/ClassBar.tsx`, `src/App.tsx` (state block `:96-197` — add
`classes`/`currentClassId`; render branch AFTER the auth gate `:890` and AFTER
`#/admin` `:906`), `src/App.css` (ADD a grid row at `:10-15`; change no existing
rule), `src/lib/persist.ts:20-34` (add `teacher.class.v1`), `App.tsx:317-324`
(`dropRejectedIdentity` clears the new key), `src/lib/api.ts` (fetchers via
`request()` only). **Frozen:** `request()` itself (`api.ts:274-296`),
`taxonomy.ts` (the hardcoded stream is slice 3's problem), the admin view, every
existing App.css rule. Freeze check:
`git status --short -- src/lib/taxonomy.ts src/components/AdminConsole.tsx` empty.

**Oracle.** `features/classes-progress/tests/fe/class-bar.characterization.test.tsx`
- teacher with two classes (mocked `GET /api/classes`) → the bar renders both names in
  createdAt order, and each tab shows a thin rail sized `markedWeek/totalWeeks` from
  that class's mocked progress (positive)
- **teacher with ZERO classes → no bar row exists in the DOM, no `/api/classes`-driven
  layout shift, and NO request carries `?classId=`** (negative — contract §0; this is
  the 17,049-teacher case)
- the selected class persists to `teacher.class.v1` and is restored on remount; a
  persisted id no longer in the class list falls back to no-selection without
  crashing (positive + negative)
- a rejected identity (`teacher_required` path) clears `teacher.class.v1` along with
  the existing keys (negative — App.tsx:317-324, SEED locked)
- `#/admin` renders WITHOUT the class bar (negative — SEED §6: the console gets no
  bar)
- the auth-gated (signed-out) state renders without the bar (negative — the branch is
  AFTER the gate)
- every new string is Arabic, Western digits, no LaTeX, and the bar's DOM order under
  `dir="rtl"` matches the class order (positive — hard constraints; assert strings,
  jsdom won't catch visuals)

**Boundaries.** Contract §3, §7.8–7.10. Additive; no CSS framework, no new dependency.
Budget 10 iterations.

**Exit protocol.** Done-when: oracle green ×2 · freeze paths clean ·
`tools/ci fe --slug classes-progress` green from the job worktree · the promoted
`project/tests/fe` net still green against the job checkout. Ask-when: the bar cannot
be a pure additional grid row · any frozen file · budget blown.

---

```yaml
---
kind: sub-issue
id: fe-2
parent: i1
stack: fe
status: done
depends_on: [fe-1, be-3]
estimate: M
---
```

### fe-2 — switching class is total, and the list follows

**status:** done · **tag:** happy-path

**Intent.** Tapping another class must feel like walking into another classroom:
everything contextual resets, the subjects list refetches scoped to that class — and
the ONE thing that survives is `pendingSave`, because an unsaved exam dropped on a tab
switch is exactly the silent loss the persistence work exists to prevent (SEED,
locked).

**Ground truth.** The precedent to reuse verbatim: `onOpenSubject`
(`App.tsx:479-495`) — the recorded total-context-switch shape clearing `exam`,
`subjectId`, `refining`, `solutions`, `subjects`. The list today calls
`GET /api/subjects` with no params. Pre-flight: read the `:479-495` shape and confirm
the list call is param-less.

**Delta (freeze).** May touch: `src/App.tsx` (the switch handler + the list fetch),
`src/lib/api.ts` (the list fetcher gains the optional `classId` param),
`src/components/ClassBar.tsx` (wire the tap). **Frozen:** the `pendingSave` queue
logic and its keys (`teacher.pending.v1`), the exam view, the refine flow, the
solutions flow — the switch CLEARS their state, it does not modify their code.
Freeze check: `git status --short -- src/lib/persist.ts` shows only fe-1's key line
if anything.

**Oracle.** `features/classes-progress/tests/fe/class-switch.characterization.test.tsx`
- with an exam open and a refine panel active, switching class clears `exam`,
  `subjectId`, `refining`, `solutions`, `subjects` — the DOM shows the fresh class
  context, no stale exercise text (positive — the flows.md Flow 3 shape)
- **a queued `pendingSave` survives the switch, byte-identical in storage** (positive —
  THE clause; SEED locked, contract §7.8)
- after the switch the list refetches with `?classId=<new class>`, and a mocked
  response containing a legacy (classId-less) subject renders it in the list (positive —
  legacy is never hidden, contract §5)
- with NO class selected, the list request has no `?classId=` — byte-identical query
  to today (negative — contract §0)
- switching to the SAME class is a no-op: no clears, no refetch storm (negative)
- the selected class lands in `teacher.class.v1` on every switch (positive)

**Boundaries.** Contract §5, §7.4, §7.8. Budget 10 iterations.

**Exit protocol.** Done-when: oracle green ×2 · freeze respected ·
`tools/ci fe --slug classes-progress` green · promoted fe net green. Ask-when:
clearing the context requires touching a frozen flow's internals · budget blown.

---

```yaml
---
kind: sub-issue
id: fe-3
parent: i1
stack: fe
status: done
depends_on: [fe-1, be-2]
estimate: M
---
```

### fe-3 — week 0 is an invitation: «أين وصل هذا القسم؟»

**status:** done · **tag:** happy-path

**Intent.** A class with no position renders the handoff's empty state — a question
and a single action, no invented pacing, no bar, no comparison — and «حدّد أين وصلت»
performs the contract's CAS write, treating a `409` as "someone else moved this" to
re-read and re-ask, never to auto-resubmit.

**Ground truth.** Contract §4's recorded-equivalent shapes (pinned by be-2's suite):
GET on a fresh class → `{progress: {markedWeek: 0, entries: [], rev: 0, …},
programme: {docKey, edition, totalWeeks: 27}}`; stale-rev PUT → `409 conflict`,
immediate. Copy source for the strings: the brief («أين وصل هذا القسم؟» ·
«حدّد أين وصلت» · «نبدأ من الأسبوع 1») — deliberate copy, do not rewrite (handoff
README, Fidelity). Pre-flight (needs be-2 on the lane): `curl` the GET against a fresh
class and reproduce the synthesized empty shape.

**Delta (freeze).** May touch: a new position-setter component (shared with fe-4),
`src/App.tsx` (mount it in the selected-class home area), `src/lib/classes.ts` /
`api.ts` (the GET/PUT fetchers). **Frozen:** ClassBar's structure from fe-1 (it only
gains live rail data), everything fe-2 froze. Freeze check: path-scoped as fe-1/fe-2.

**Oracle.** `features/classes-progress/tests/fe/week-zero-position.characterization.test.tsx`
- `markedWeek: 0` → the empty state renders exactly the three copy strings, and NO
  rail fill, NO pacing sentence, NO red/green classes anywhere in it (positive +
  negative — contract §7.2; "no pacing" is asserted, not assumed)
- the picker offers 0..`programme.totalWeeks` FROM THE RESPONSE — mock `totalWeeks:
  30` and assert the picker follows it, not 27 (positive — the constant-27 trap,
  SEED risk flag)
- choosing week 8 sends `PUT {rev: 0, markedWeek: 8}` and the success re-renders the
  position + rail (positive)
- a mocked `409 conflict` → the component REFETCHES, renders the fresh position with
  an Arabic explanation, and does NOT re-send the write (negative — contract §0,
  flows Flow 2)
- a mocked `503 store_unavailable` → retryable Arabic message, the chosen week still
  selected (positive — one-tap retry)
- `markedWeek: 0` never renders as an error state, and a positioned class (`8/27`)
  never renders the empty state (two-sided)
- all new strings Arabic, Western digits, no Latin words, no LaTeX (hard constraints)

**Boundaries.** Contract §4, §7.2, §7.9. Budget 10 iterations.

**Exit protocol.** Done-when: oracle green ×2 · freeze respected ·
`tools/ci fe --slug classes-progress` green. Ask-when: the picker seems to need the
programme's units/weeks content (that is slice 2 — stop, don't reach for it) · budget
blown.

---

```yaml
---
kind: sub-issue
id: fe-4
parent: i1
stack: fe
status: done
depends_on: [fe-3, be-4]
estimate: L
---
```

### fe-4 — sign-up learns steps 3 and 4, and the account gets «أقسامي»

**status:** done · **tag:** happy-path

**Intent.** A new teacher declares their classes and school right after the recovery
code (the account exists by then — that is WHY the steps hang off `issued`), positions
each class or skips it per class, and can later see and extend «أقسامي» — reusing the
class editor and the fe-3 setter, not duplicating them.

**Ground truth.** `AuthPanel.tsx:23` — a `Mode` union, two screens; the `issued`
screen at `:115-254` currently ends the flow. Copy from the brief/handoff:
«أقسامك هذه السنة» (step 3, name + stream, add-another is a normal action) ·
«سيظهر على الموضوع المطبوع» (school) · «أين وصل كل قسم؟» (step 4) ·
«تخطَّ الآن — يُضبط لاحقًا» (skip, per class). Pre-flight: run the lane, sign up,
confirm the flow ends at the recovery-code screen today.

**Delta (freeze).** May touch: `src/components/AuthPanel.tsx` (extend the step
machine off `issued`), the shared class-editor component (new), «أقسامي» in the
account area, `src/lib/api.ts` (`PUT /api/teacher/school` fetcher). **Frozen:** steps
1–2 — the signup POST, the recovery-code display, its confirm checkbox and its copy
are byte-untouched (that screen is load-bearing: the code shows once); the sign-in and
recover flows. Freeze check: no diff hunk in AuthPanel's signup/recovery handlers.

**Oracle.** `features/classes-progress/tests/fe/signup-classes.characterization.test.tsx`
- after `issued` is acknowledged, step 3 renders: class rows (name + the six streams),
  «أضف قسمًا آخر» adds a row without ceremony, and the school field carries
  «سيظهر على الموضوع المطبوع» (positive)
- completing step 3 POSTs one `/api/classes` per row and PUTs
  `/api/teacher/school` once when filled; an empty school sends NO school call
  (positive + negative)
- step 4 lists the created classes; setting a position drives the fe-3 setter
  (`PUT /api/progress/:classId`); **skipping a class sends NO progress call for it**
  — skip means absent, not week 0 written (positive + negative — the lazy-document
  contract §0)
- a class create failing with `400` keeps the teacher on step 3 with an Arabic inline
  error and the other rows intact (negative)
- the recovery-code screen upstream is byte-identical — same copy, same confirm gate
  (negative — perimeter, WF-69: the step machine's host is the whole AuthPanel)
- «أقسامي» shows each class with stream + position, and add-a-class works signed-in
  (positive — the only creation path for existing teachers)
- steps 3 and 4 never render for sign-IN (negative — they are sign-up-only)
- all new strings Arabic, Western digits, no Latin words (hard constraints)

**Boundaries.** Contract §0, §3, §4. Budget 12 iterations. Anonymous-session claim
stays untouched (SEED §6 parked — this must not make that decision harder).

**Exit protocol.** Done-when: oracle green ×2 · freeze respected ·
`tools/ci fe --slug classes-progress` green · promoted fe net green (AuthPanel is in
its perimeter). Ask-when: the steps cannot hang off `issued` without touching steps
1–2 · budget blown.

---

```yaml
---
kind: sub-issue
id: fe-5
parent: i1
stack: fe
status: todo
depends_on: [fe-1, fe-2, fe-3, fe-4]
estimate: M
---
```

### fe-5 — the guard rails: legacy invisibility, language, and one live pass

**status:** todo · **tag:** hardening

**Intent.** The slice's promises that no single sub-issue owns get pinned as one net:
a class-less teacher's experience is bit-identical to today, every new string obeys
the hard constraints, and the whole flow works once against the REAL lane — because
jsdom cannot see a grid row collide with an RTL column layout.

**Ground truth.** fe-1..fe-4 green. The RTL+KaTeX recording (SEED §2): paragraph
`rtl`, math `ltr`, bidi `isolate` — re-run by injecting the island in the running app.
The seven pre-existing persist keys (`persist.ts:20-34`). Pre-flight: fe suites green,
lane up.

**Delta (freeze).** May touch: the suite itself, plus fix-only diffs in files fe-1..
fe-4 already own. **Frozen:** fe-1..fe-4's oracle files (frozen against the
implementer; a wrong-seeming pin is stop-and-ask), every fe-2 frozen flow. No new
component, no new dependency.

**Oracle.** `features/classes-progress/tests/fe/guard-rails.characterization.test.tsx`
- **the legacy sweep:** zero classes → DOM snapshot of the main shell contains no
  class-related node; NO fetch to `/api/classes`-dependent surfaces adds params; the
  seven pre-existing persist keys' read/write behaviour is unchanged (negative —
  contract §0/§7.10, executable across the whole shell)
- **the language sweep:** collect every string the four sub-issues introduced (export
  a strings module or walk the rendered surfaces) → no Latin words, no LaTeX
  fragments, Western digits only, and no occurrence of "AI" in any form (negative —
  hard constraints + handoff rule)
- `teacher.class.v1` is dropped by the rejected-identity path AND absent from a fresh
  session (negative)
- no red/green classnames or inline colors on any pacing/position surface (negative —
  «never grade the teacher»)
- every new fetch URL is relative `/api/...` (negative — network discipline; assert on
  the mocked fetch's calls)
- **live nav pass (manual command in the exit, not jsdom):** `tools/dev up` on the
  job lane → create two classes, position one, switch between them, reload — the
  selection persists, the rail fills RTL, the week-0 class shows the empty state, and
  the bar row does not break the 2-column RTL grid (obs assertion:
  `tools/obs trace <correlationId>` of one progress write shows fe→be with the
  be-side `progress.write win` line)

**Boundaries.** Contract §6, §7 (all). Budget 8 iterations.

**Exit protocol.** Done-when: oracle green ×2 · the live nav pass recorded in the
journal with its correlationId · `tools/ci fe --slug classes-progress` green ·
promoted fe net green. Ask-when: any guard-rail failure traces to a be behaviour
(file it against be, don't patch around it) · budget blown.
