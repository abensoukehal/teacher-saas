# Stack spec — teacher-fe

> Filled by `/planning` 2026-08-08 from the locked SEED.

## Scope recap
- **Modules:** `src/lib/api.ts` (modify) · `src/components/SolutionView.tsx` (new) ·
  `src/App.tsx` (modify) · `src/App.css` (modify — the print sheet needs it)
- **Contract:** `contracts/fe-be-solutions.contract.md`
- **Not in scope:** refining a solution by instruction · anything that meters generation.

## Current behavior baseline

| Area | Today | Ref |
|---|---|---|
| generation | `generateExam` posts `{skill:"exam-subject"}` and keeps the envelope | `src/lib/api.ts` |
| print | one path — `window.print()` over the exam sheet | `src/App.tsx:482` |
| printable mode | `ExamView` already takes `printable` | `src/components/ExamView.tsx:13` |
| solutions | nothing — no call, no view, no print | — |

### Harness
- Suites in `features/solution-sheets/tests/fe/`, `*.characterization.test.tsx`,
  run via `../../tools/ci fe --slug solution-sheets` **from the worktree**.
- `node_modules` is a symlink to the main checkout — verified complete (88 packages).
- **Never call `/api/generate`.** Mock it, or replay
  `tests/be/fixtures/rec-solution-sheet.<date>.json` — copy it beside the fe suite rather
  than reaching across (that has broken promotion three times).
- Where a behaviour can race or repeat, **write the concurrency clause from the start.**

## States (non-negotiable at this latency)
A correction is a second ~2-minute generation. Every surface answers: **idle · generating ·
empty · stale · error(retryable) · error(hard) · success.**

**Arabic only, RTL.** **No LaTeX may ever be visible** — a correction is dense with maths
and is the likeliest place to leak it. Maths renders through KaTeX, as the exam does.

---

## Sub-issues

```yaml
---
kind: sub-issue
id: fe-1
parent: i1
stack: fe
status: done
depends_on: [be-2]
estimate: L
---
```

### fe-1 — generate a correction, show it, and never hide that it is stale

1. **Intent:** the teacher's correction is the point of the job; and a correction that
   quietly describes an old version of an exercise is worse than having none at all.

2. **Ground truth (recorded + re-run):**
   ```bash
   $ grep -rn "solution\|تصحيح" stacks/teacher-fe/src/ | grep -v node_modules
   (no matches — nothing exists)
   ```
   Pre-flight: open the app on the lane, load a saved exam, and confirm there is no way to
   ask for a correction.

3. **Delta:**
   - `src/lib/api.ts` — `generateSolutions(exam)` (posts `{skill:"solution-sheet"}` to the
     **existing frozen** `/api/generate`), `saveSolutions(...)`, `listSolutions(...)`.
   - `src/components/SolutionView.tsx` — **new**: per-exercise answer + grading scale.
   - `src/App.tsx` — wire the action, the states, and the stale affordance.
   **Frozen:** `ExamView`, `RefinePanel`, `exam.ts`, `persist.ts`, the auth flow.

4. **Oracle (two-sided, executable):**
   - *positive:* with no correction → an Arabic empty state and an action to generate.
   - *positive:* generating posts `{skill:"solution-sheet"}` to `/api/generate` and then
     saves the result — the request body carries `genCorrelationId` from the run.
   - *positive:* answers and scales render; **maths goes through KaTeX**.
   - *positive — the stale path:* a solution the API reports `stale: true` is shown as stale
     in Arabic, with a way to regenerate **just that exercise** — and it is never rendered as
     though it were current.
   - *positive (each state):* idle · generating (~2 min, control disabled, no double-fire) ·
     empty · stale · `store_unavailable` retryable · `claude_auth` **not** retryable.
   - *positive (race, from the start):* double-clicking generate issues **one**
     `/api/generate` call. This is a ~$0.65 operation; a double-fire is real money.
   - *negative:* **no LaTeX anywhere** — assert the rendered correction contains no `\frac`,
     `$`, `\(`.
   - *negative:* every new string Arabic (no `[A-Za-z]{4,}` in rendered copy).
   - *negative:* the exam sheet and `ExamView` render byte-identically — a correction is a
     separate surface, never mixed into the exam.
   - *obs:* all calls are relative `/api/...`; no absolute URL.

5. **Boundaries:** honours the contract's surfaces and error table; branches on
   `error.type`, never a status code. Budget: 10 iterations.

6. **Exit:** done-when = oracle green + freeze + `tools/ci fe --slug solution-sheets` green ·
   ask-when = a state has no error type to render · a correction cannot render without
   exposing LaTeX · generating would need a second call per exercise on the first pass.

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

### fe-2 — a printable correction sheet, separate from the exam

1. **Intent:** the teacher prints the exam for students and keeps the correction; one sheet
   containing both would be worse than useless.

2. **Ground truth:** `src/App.tsx:482` — a single `window.print()` over the exam.
   `ExamView` already accepts `printable`. Pre-flight: print preview shows the exam only.

3. **Delta:** `src/App.tsx` (a second print action), `src/components/SolutionView.tsx`
   (a `printable` mode mirroring `ExamView`'s), `src/App.css` (print rules).
   **Frozen:** `ExamView` and the existing exam print output.

4. **Oracle:**
   - *positive:* a print action for the correction exists, distinct from the exam's.
   - *positive:* the printable correction contains every exercise's answer and scale, in
     exam order, with the exercise label and its points.
   - *positive:* a **stale** solution is marked as such **in the printed sheet too** — the
     teacher must not carry a stale correction to a class on paper.
   - *negative:* **the exam's print output is byte-identical** to the recorded baseline —
     this is the clause that stops the correction leaking into the students' sheet.
   - *negative:* Arabic only; no LaTeX; RTL intact.

5. **Boundaries:** `App.css` is in this Delta (the print sheet is unusable without it).
   Budget: 10 iterations.

6. **Exit:** done-when = oracle green + freeze + gate green · ask-when = the exam's print
   output cannot stay byte-identical · print rules would have to change `ExamView`.
