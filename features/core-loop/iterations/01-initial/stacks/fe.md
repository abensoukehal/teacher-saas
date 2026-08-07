# Stack spec — teacher-fe (React 19 · TypeScript · Vite)

> The per-job skeleton for the **fe** repo (`repos.sh` key `fe`).
> `tools/provision` copies this into every new job's `stack-skeletons/`; the job
> fills it in. Filled and implemented by the `fe` stack agent (reads
> `project/CLAUDE.md`'s fe section + this feature's `contracts/`).
> Loop-engineering format: everything an implementing agent needs, issue by issue.
>
> **The latency shape drives the UI here.** `/api/generate` runs a whole Claude
> Code agent loop: minutes, and it can queue behind other runs. Loading and
> failure states are load-bearing, not polish.

## Scope recap (from SEED.md + this stack's sub-issues)
- Modules:
- Contracts this stack must honor: `contracts/<a>-<b>`, …

## Current behavior baseline
> What the touched areas do today, with file:line refs.
> Pinned by `features/<slug>/tests/fe/*.characterization.*` (the WF-53 home —
> never sub-repo-local; run via `tools/ci fe --slug <slug>`; import by module
> resolution, never relative `../../` paths into the repo).

### Run headless (to investigate — do this before writing the Blueprint)
> Exercise the real code; record real shapes. Don't assume.
- Run the WHOLE stack (`tools/dev up`) — this service is only meaningful against a
  live backend lane, and the proxy target is that lane's port.
- Record the ACTUAL shapes from `be` (`/api/skills`, `/api/generate`) → paste into
  the contract's "current shape". Do not infer them from the UI.
- Watch it: `tools/obs logs fe`, `tools/obs logs be`, `tools/obs trace <id>`.

## Observability (PIN co-requisite)
> Before implementing: is this area observable today? What must be added.
- Logs: key transitions, structured fields, correlation id in/out
- Errors: error-tracker capture on the paths we touch
- Trace: correlation id received upstream, propagated downstream
- Blind spots → first issue(s) in the slice. Verify: `tools/obs logs`, `tools/obs trace <id>`

## Client state / types
| Type or store | Field | Change | Backend contract it mirrors |
|---------------|-------|--------|-----------------------------|
| | | add / modify | |

> Response types must mirror `be`'s recorded shapes, not a guess. When `be`
> changes one, this side changes in the same job.

## Surfaces (routes / views / components)
| Surface | Implementation path | New/Modify | Contract |
|---------|--------------------|-----------|----------|
| | `src/…` | | |

## States (non-negotiable at this latency)
> A generation takes minutes and may queue. Every surface that triggers one must
> answer all of these — an unanswered row is an incomplete sub-issue.

| State | What the teacher sees |
|---|---|
| idle | |
| queued (behind other runs) | |
| running (minutes) | |
| failed — 503 auth | needs a human to re-login; **not** a retry |
| failed — 504 timeout | retryable |
| failed — 502 CLI error | retryable, but surface the reason |
| empty / unusable result | |

## Network discipline
> All calls go to `/api/...` **relative**, through the Vite proxy. Flag any
> absolute backend URL introduced by this job — it silently crosses lanes.

---

## Sub-issues (this stack's technical work)

<!-- Personal-only. Six slots each — conventions/writing-sub-issues.md.
     Shared ground truth: ../recordings/ (real payloads) + ../contracts/.
     MOST OF THIS STACK NEEDS NO LIVE GENERATION — render the recordings. -->

```yaml
---
kind: sub-issue
id: fe-1
parent: i1
stack: fe
status: todo
depends_on: []
estimate: M
---
```

### fe-1 — Arabic RTL shell, replacing the Vite starter

1. **Intent:** the app is still the 122-line Vite demo. Everything else in this
   stack needs a correct RTL Arabic surface to build on, and RTL is the constraint
   most likely to be retrofitted badly if it is not the foundation.

2. **Ground truth:** `stacks/teacher-fe/src/App.tsx:7` — Vite starter demo;
   `src/App.css` + `src/index.css` = 295 lines of starter styles.
   Re-run: `tools/dev up -d` from the worktree → `http://localhost:10100/`.

3. **Delta:** `teacher-fe/index.html` (`lang="ar" dir="rtl"`) ·
   `src/App.tsx` (replace) · `src/main.tsx` · `src/index.css`, `src/App.css`
   (replace) · new `src/styles/tokens.css`. Delete `src/assets/*` starter art.
   **Everything else frozen** — `vite.config.ts` is read-only (already correct).
   Freeze check: `git status --short -- index.html src/`

4. **Oracle (two-sided, executable):**
   - *positive:* `document.documentElement.dir === "rtl"` and `lang === "ar"`;
     the two-pane layout (controls / workspace) renders with controls on the
     **right**; an Arabic font with real glyph coverage is applied.
   - *positive:* **screenshot** at 1280×800 and at 375×812 — this closes SEED R2,
     which cannot be closed by a parse check.
   - *negative:* `npm run build` succeeds; no starter demo text remains
     (`grep -r "Vite\|Edit src/App" src/` empty).
   - *obs assertion:* `tools/obs status` shows `frontend` UP on the lane port.

5. **Boundaries:** shell + tokens only — no controls, no data fetching, no KaTeX.
   No UI framework dependency without asking. Budget: 8 iterations.

6. **Exit:** done-when = oracle green incl. both screenshots · ask-when = RTL needs
   a library, or the design requires a decision the SEED does not settle.

```yaml
---
kind: sub-issue
id: fe-2
parent: i1
stack: fe
status: todo
depends_on: [fe-1]
estimate: M
---
```

### fe-2 — the controls panel

1. **Intent:** step 1–2 of the loop. These controls become the `exam-subject`
   input verbatim, so their vocabulary must match the skill's contract exactly —
   a mismatch here silently produces off-taxonomy exams.

2. **Ground truth:** the request shape actually accepted, from
   `../recordings/gen1.request.json` / `gen2.request.json`:
   `{stream, level, topic, difficulty, exerciseCount, durationMinutes, format, note?}`.
   The **topic taxonomy is fixed** and defined in
   `teacher-be/agent/curriculum/3as-mathematiques.md` — 7 topics plus
   `مواضيع مختلطة من البرنامج`. Difficulty enum: `سهل · متوسط · صعب`.

3. **Delta:** new `src/components/Controls.tsx` · `src/lib/taxonomy.ts` (the topic
   list + enums) · wire into `src/App.tsx`.
   **Everything else frozen.** Freeze check:
   `git status --short -- src/components src/lib src/App.tsx`

4. **Oracle (two-sided, executable):**
   - *positive:* the topic `<select>` offers exactly the 8 taxonomy entries, in
     order, in Arabic; difficulty is a 3-way control; exercise count and duration
     are numeric with sane defaults (3 · 90); the free-text note is optional and
     has topic-aware suggestion chips that append to it.
   - *positive:* submitting builds a request object **byte-equal** to
     `../recordings/gen2.request.json` when the matching controls are selected.
     This is the executable pin — assert deep-equality against the recording.
   - *negative:* no network call is made by this sub-issue (fe-4 owns that);
     `npm run build` green.
   - *state coverage:* default · all-touched · note empty vs filled.

5. **Boundaries:** produces a request object; does not send it. Budget: 8 iterations.

6. **Exit:** done-when = the deep-equality pin passes · ask-when = the taxonomy in
   `curriculum/` disagrees with what the controls need.

```yaml
---
kind: sub-issue
id: fe-3
parent: i1
stack: fe
status: todo
depends_on: [fe-1]
estimate: L
---
```

### fe-3 — render an exam: KaTeX, per exercise

1. **Intent:** the visual core. Arabic prose with embedded LTR math is exactly
   where RTL breaks, and SEED R1/R2 are open here. Renders from a payload — needs
   **no live generation**, so it is built against the recordings.

2. **Ground truth:** `../recordings/gen1.json` (4 exercises), `gen2.json` (3),
   `gen3-curriculum-gap.json` (carries a **refusal** in `meta.assumptions`).
   KaTeX parses **222/222** spans across them (SEED kit §2) — but `gen3/ex1`
   contains `\text{و}`, which parses and renders wrong (R1).
   Re-run: `node check.mjs ../recordings/gen1.json`.

3. **Delta:** new `src/components/ExamView.tsx`, `ExerciseCard.tsx`,
   `src/lib/katex.ts` (render helper) · `package.json` (+ `katex`) ·
   `src/styles/katex-rtl.css`.
   **Everything else frozen.** Freeze check:
   `git status --short -- src/components src/lib src/styles package.json`

4. **Oracle (two-sided, executable):**
   - *positive:* rendering each of the three recordings produces one card per
     exercise, each showing `label`, `points`, `difficulty`, and the statement with
     **all** math rendered (assert `.katex` node count > 0 per span; assert zero
     `.katex-error` nodes across all three).
   - *positive:* `meta.assumptions` is displayed — `gen3` must visibly tell the
     teacher its topic was substituted (contract invariant 4).
   - *positive:* **screenshots** of `gen1` and `gen3` at 1280×800 — closes R2, and
     shows whether R1's `\text{و}` renders as tofu (expected until be-2 lands).
   - *negative:* no LaTeX source is visible anywhere in the DOM text
     (`document.body.innerText` contains no `$`, no `\frac`, no `\text`).
   - *negative:* `npm run build` green.
   - *state coverage:* 3-exercise · 4-exercise · with-assumptions · empty exercises.

5. **Boundaries:** display only — no fetching, no refine affordances (fe-5).
   KaTeX only; no MathJax, no server-side rendering. Budget: 10 iterations.

6. **Exit:** done-when = zero `.katex-error`, no LaTeX in visible text, screenshots
   captured · ask-when = RTL layout needs a change to the *statement* format (that
   is a contract change → stop).

```yaml
---
kind: sub-issue
id: fe-4
parent: i1
stack: fe
status: todo
depends_on: [fe-2, fe-3]
estimate: L
---
```

### fe-4 — the generate flow, built for minutes

1. **Intent:** the SEED's headline correction. A draft takes **114–133 s** and may
   queue. Progress, cancel and reload-survival are MVP, not polish — a bare spinner
   for two minutes reads as a hung app.

2. **Ground truth:** measured 8 runs — draft 114–133 s, refine 47–48 s
   (SEED kit §2 + seal). `be` returns **once**; there is no stream
   (`../contracts/flows.md` Flow A). Queue depth is visible at `GET /health`
   (`claude.active`/`queued`/`max`). Re-run: `curl -s localhost:9100/health`.

3. **Delta:** new `src/lib/api.ts` (fetch + abort + error mapping) ·
   `src/lib/persist.ts` (local draft + in-flight marker) ·
   `src/components/GenerateProgress.tsx` · wire into `src/App.tsx`.
   **Everything else frozen.** Freeze check:
   `git status --short -- src/lib src/components src/App.tsx`

4. **Oracle (two-sided, executable):**
   - *positive:* against a **stubbed slow endpoint** (no live generation needed):
     elapsed time is shown and advances; cancel aborts the request and restores the
     prior state; a reload mid-flight restores the last good draft and does not show
     a phantom in-flight run forever.
   - *positive:* error mapping — 503 `claude_auth` renders as **not retryable**;
     504/502 offer retry; `200` with `data: null` is treated as failure, not an
     empty exam; `correlationId` is shown on error
     (`../contracts/fe-be.contract.md` errors table).
   - *positive:* **one live end-to-end run** against `:9100` produces a rendered exam.
   - *negative:* the existing draft survives every failure path — assert the draft is
     unchanged after each simulated error.
   - *obs assertion:* the `correlationId` shown in `fe` on error appears in
     `tools/obs trace <id>`.

5. **Boundaries:** no streaming (engine change — out of scope). Cancel is
   client-side only; do **not** claim server work stopped. Budget: 10 iterations.

6. **Exit:** done-when = oracle green incl. one live run · ask-when = reload-survival
   appears to need server-side persistence (out of scope → stop).

```yaml
---
kind: sub-issue
id: fe-5
parent: i1
stack: fe
status: todo
depends_on: [fe-3, fe-4]
estimate: L
---
```

### fe-5 — refine one exercise · **the product**

1. **Intent:** step 4. This is the interaction the whole product exists for and the
   one a teacher repeats most. Everything else is scaffolding around it.

2. **Ground truth:** `../recordings/refine1.request.json` → `refine1.json`.
   The request carries the exercise **verbatim** plus
   `examContext.otherExercises` (id · topics · difficulty). The response preserves
   `id` (`ex2`), `points` (4) and `label` (التمرين الثاني) byte-identically and
   changed `متوسط`→`صعب`. Re-run:
   `curl -s -X POST localhost:9100/api/generate -H 'content-type: application/json' -d @../recordings/refine1.request.json`

3. **Delta:** new `src/components/RefinePanel.tsx` · `src/lib/refine.ts`
   (request assembly + splice-by-id) · `ExerciseCard.tsx` (refine affordance).
   **Everything else frozen.** Freeze check:
   `git status --short -- src/components src/lib`

4. **Oracle (two-sided, executable):**
   - *positive:* selecting an exercise and submitting an Arabic instruction builds a
     request **deep-equal** to `../recordings/refine1.request.json` (given the same
     exam and instruction) — the executable pin.
   - *positive:* the three shortcuts (غيّر الأرقام · صعّبه/سهّله · بدّله) each produce
     a valid instruction; free text also accepted.
   - *positive:* splicing `refine1.json` into `gen1.json` replaces **only** `ex2`;
     `ex1`, `ex3`, `ex4` are byte-identical afterwards, and Σ points still 20.
   - *negative:* a response whose `id` differs from the requested one is **rejected**,
     not spliced (contract invariant 1).
   - *negative:* no LaTeX appears in the instruction input or its placeholder.
   - *positive:* **one live refine** against `:9100` visibly changes one card only.
   - *state coverage:* idle · in-flight (≈48 s) · failed · rejected-id.

5. **Boundaries:** one exercise per request. No batch refine, no undo history
   (not in SEED scope). Budget: 10 iterations.

6. **Exit:** done-when = the splice pin + rejected-id pin pass and one live refine
   works · ask-when = the loop seems to need server state.

```yaml
---
kind: sub-issue
id: fe-6
parent: i1
stack: fe
status: todo
depends_on: [fe-3]
estimate: M
---
```

### fe-6 — the printable page

1. **Intent:** step 5, and the artifact that actually reaches students. The brief
   scopes it deliberately small: a standalone printable page, print-to-PDF.

2. **Ground truth:** `../contracts/flows.md` Flow C — no backend call; renders the
   exam already in hand. `meta.assumptions` is **not** printed (guidance for the
   teacher, not part of the students' paper). Print target is **parked** in SEED §6
   (`blocked_on: teacher test`) — build the simplest correct sheet, do not invent a
   school header.

3. **Delta:** new `src/routes/Print.tsx` (or a print route in `App.tsx`) ·
   `src/styles/print.css`.
   **Everything else frozen.** Freeze check:
   `git status --short -- src/routes src/styles src/App.tsx`

4. **Oracle (two-sided, executable):**
   - *positive:* the print view renders title, `meta` (stream · duration · total
     points) and every exercise with label, points and rendered math — RTL, A4.
   - *positive:* `meta.assumptions` is **absent** from the printed output.
   - *positive:* no app chrome (controls, refine affordances, buttons) appears in
     `@media print` — assert via the print stylesheet and a screenshot.
   - *negative:* KaTeX still renders (zero `.katex-error`) in the print view.
   - *negative:* `npm run build` green.

5. **Boundaries:** browser print only — no PDF library, no server-side rendering.
   Budget: 8 iterations.

6. **Exit:** done-when = oracle green + a print-preview screenshot · ask-when = the
   sheet needs a school header (parked unknown → stop and ask).
