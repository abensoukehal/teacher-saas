# Stack spec — teacher-fe (React 19 · TypeScript · Vite)

> Filled by `/planning` 2026-08-08 from the locked SEED. Implemented by the `fe` stack agent.
>
> **The latency shape drives the UI here.** `/api/generate` runs a whole Claude Code agent
> loop: minutes, and it can queue. Loading and failure states are load-bearing, not polish.

## Scope recap (from SEED.md + this stack's sub-issues)

- **Modules:** `src/components/Auth*.tsx` (new) · `src/lib/api.ts` (modify) ·
  `src/lib/persist.ts` (modify) · `src/App.tsx` (modify) ·
  `src/components/RefinePanel.tsx` (modify)
- **Contracts:** `contracts/fe-be-auth.contract.md` · `contracts/fe-be-subjects-v2.contract.md`
- **Not in scope:** anything touching generation, KaTeX rendering, or the print sheet.

## Current behavior baseline

Recorded 2026-08-08 (SEED kit §1/§3). Pinned by
`features/persistence-gaps/tests/fe/*.characterization.test.tsx`, run via
`tools/ci fe --slug persistence-gaps` **from the job worktree**.

| Area | Today | Ref |
|---|---|---|
| identity | `teacher.id.v1` in `localStorage` — the **only** copy | `src/lib/persist.ts:23,65-66` |
| identity acquisition | `issueTeacher()` → `POST /api/teacher` | `src/lib/api.ts:212-215` |
| generation | `generateExam` returns `payload.data` — **envelope discarded** | `src/lib/api.ts:93` |
| save | `createSubject(id, subject, controls)` — 4th param `correlationId` **never passed** | `src/lib/api.ts:218-230`; callers `App.tsx:95,196` |
| save failure | `SaveState = {kind:"error"; retry:()=>void}` — a **closure in memory** | `src/App.tsx:48,61,209-217` |
| paint cache | `teacher.cache.v1`; no pending-save key exists | `src/lib/persist.ts:58-60` |
| controls | panel state in `teacher.controls.v1`; the **used** controls are already on the subject doc | `src/lib/persist.ts:62-63` |

### Run headless

```bash
cd project-worktrees/persistence-gaps && ../../tools/dev up -d    # fe :10300 → be :9300
```

Replay generations from
`project/features/persistence/iterations/01-initial/contracts/rec-exam-subject.2026-08-07.json`.
**Never call `/api/generate` in a loop iteration** — ~128 s, ~$0.65.

> **`fe`'s `node_modules` is a symlink to the main checkout.** Verified complete on
> 2026-08-08 (88 packages; `katex`, `vitest`, `@testing-library` all present). It was found
> at 24/88 during the last job — **check it before concluding a gate is broken.**

## Observability

- **Visible today:** every `be` response carries `correlationId`; errors surface `error.type`.
- **Blind spot this job must not create:** a queued save that replays on load must be
  *visible* to the teacher, or a silent background write is indistinguishable from data loss.

## Client state / types

Response types mirror `be`'s recorded shapes — never a guess.

| Type | Change |
|---|---|
| `SubjectRecord` / `SubjectSummary` | **+ `genCorrelationId: string \| null`** |
| `generateExam` return | `ExamSubject` → `{ subject, correlationId, costUsd? }` (**internal only** — the API is frozen and already returns these) |
| new | `AuthSession = { teacherId }`, `PendingSave` |

## Surfaces (routes / views / components)

| Surface | Path | New/Modify | Contract |
|---|---|---|---|
| sign-up / sign-in / recovery | `src/components/Auth*.tsx` | new | auth |
| exercise history + restore | `src/components/RefinePanel.tsx` | modify | subjects-v2 |
| save-state banner | `src/App.tsx:285-300` | modify | — |

## States (non-negotiable at this latency)

Every new surface answers all of: **idle · loading · empty · error(retryable) ·
error(hard) · success**. An unanswered row is an incomplete sub-issue.

**Arabic-only, RTL throughout.** Every new string is Arabic. **No LaTeX may ever surface** —
not in an input, a placeholder, an error, or an export. The single deliberate LTR exception
is the recovery code itself (`dir="ltr"`), because an RTL-flipped code is one a teacher
transcribes wrong.

## Network discipline

All calls relative through the Vite proxy. **Any absolute backend URL introduced by this job
is a defect** — it silently crosses lanes.

---

## Sub-issues

```yaml
---
kind: sub-issue
id: fe-1
parent: i1
stack: fe
status: todo
depends_on: [be-1, be-2]
estimate: L
---
```

### fe-1 — sign up, sign in, recover

1. **Intent:** `be` can now remember a teacher; until there is a way to sign in, no teacher
   can actually reach their exams from a second browser — which is the whole of gap #1.

2. **Ground truth (recorded + re-run command):**
   ```bash
   $ grep -n "KEY_TEACHER\|loadTeacherId" stacks/teacher-fe/src/lib/persist.ts
   23:const KEY_TEACHER = "teacher.id.v1";
   65:export const loadTeacherId = () => read<string>(KEY_TEACHER);
   ```
   Today the app calls `issueTeacher()` on first load and stores the result. Pre-flight: with
   `localStorage` cleared, loading the app mints a **new** id and shows an empty list.

3. **Delta:**
   - `teacher-fe/src/components/AuthPanel.tsx` — **new**: sign-up / sign-in / recover.
   - `teacher-fe/src/lib/api.ts` — **new**: `signup`, `signin`, `recover`.
   - `teacher-fe/src/App.tsx` — gate the app on a teacherId; render `AuthPanel` when absent.
   - `teacher-fe/src/lib/persist.ts` — unchanged keys; `teacher.id.v1` now written from
     sign-in rather than from `issueTeacher()`.
   **Frozen:** `exam.ts`, `katex.tsx`, `ExamView.tsx`, `Controls.tsx`, the print path.
   Freeze check: `git status --short -- src/components/AuthPanel.tsx src/lib/api.ts src/App.tsx src/lib/persist.ts`

4. **Oracle (two-sided, executable)** — `features/persistence-gaps/tests/fe/auth.characterization.test.tsx`:
   - *positive:* sign-up → the recovery code is displayed **once**, with `dir="ltr"` on that
     element, and a copy affordance. Assert the element's `dir` attribute — an RTL-flipped
     code is the failure this clause exists to catch.
   - *positive:* after sign-up the app stores `teacher.id.v1` = the returned `teacherId` and
     renders the exam builder.
   - *positive:* **the recovery code is never shown again** — re-mount after sign-up and
     assert it is absent from the DOM.
   - *positive (the load-bearing one):* clear `localStorage`, sign **in** → the subject list
     re-populates. This is gap #1 closed, asserted end-to-end.
   - *positive (each state, WF-70):* idle · submitting (control disabled, no double-submit) ·
     `401 invalid_credentials` → Arabic message, form still usable · `409 email_taken` →
     Arabic message · `503 store_unavailable` → **retryable** affordance.
   - *positive:* `503` with `type: "claude_auth"` is **not** treated as a store failure —
     branch on `error.type`, never the status code.
   - *positive:* recovery accepts `k7m2 p9qr 4xta` (lowercase, spaces) — the field
     normalises before sending.
   - *negative:* **every new string is Arabic** — assert no `[A-Za-z]{4,}` in rendered
     copy, except inside the `dir="ltr"` recovery-code element.
   - *negative:* **no LaTeX anywhere** — assert rendered text contains no `\frac`, `$`, `\(`.
   - *negative:* the exam builder, `ExamView` and the print sheet render byte-identically for
     an already-signed-in teacher (existing suites stay green).
   - *obs assertion:* every auth call goes to a **relative** `/api/...` URL — assert no
     absolute `http://localhost` in the fetch calls.

5. **Boundaries:** honours `fe-be-auth.contract.md` § Surfaces and § Error contract. Arabic
   + RTL is a hard constraint, not a preference. Budget: 10 iterations.

6. **Exit:** done-when = oracle green + freeze respected + `tools/ci fe --slug persistence-gaps`
   green · ask-when = a contract error type is missing for a state the UI must render · an
   English string seems unavoidable · the recovery code cannot be rendered LTR inside the RTL
   page · budget blown.

```yaml
---
kind: sub-issue
id: fe-2
parent: i1
stack: fe
status: todo
depends_on: [be-4]
estimate: S
---
```

### fe-2 — stop throwing the envelope away

1. **Intent:** the generation's `correlationId` is the only thing that can tie an exam to
   what it cost, and `fe` currently discards it one line before it would be useful.

2. **Ground truth (recorded + re-run command):**
   ```bash
   $ sed -n '93p;218,230p' stacks/teacher-fe/src/lib/api.ts
   return payload.data as T;                     # ← the envelope dies here
   export function createSubject(teacherId, subject, controls?, correlationId?) { … }
   $ grep -rn "createSubject(" stacks/teacher-fe/src | grep -v lib/api.ts
   src/App.tsx:95:  const rec = await createSubject(id, legacy, null);
   src/App.tsx:196: const rec = await createSubject(id, subject, controls);
   ```
   **Neither caller passes a 4th argument.** Pre-flight must reproduce exactly this.

3. **Delta:**
   - `teacher-fe/src/lib/api.ts:75-95` — `post`/`generateExam` return the envelope
     (`{subject, correlationId, costUsd}`) instead of bare `data`.
   - `teacher-fe/src/lib/api.ts:218-230` — `createSubject` sends `genCorrelationId` in the
     **body** (per contract), not as a header.
   - `teacher-fe/src/App.tsx:196` — thread the generation's correlationId into the save.
   - `teacher-fe/src/App.tsx:95` — legacy adoption passes **`null`**; a legacy draft has no
     generation and must not invent one.
   **Frozen:** everything else, and **`/api/generate` is not touched** — it already returns
   these fields (SEED journal H4).
   Freeze check: `git status --short -- src/lib/api.ts src/App.tsx`

4. **Oracle (two-sided, executable)** — `features/persistence-gaps/tests/fe/cost-join.characterization.test.tsx`:
   - *positive:* generate (mocked with the recorded envelope, `correlationId`
     `43e41235-f59a-44ad-9b2b-e91cff1f8610`) then save → the `POST /api/subjects` body
     carries `genCorrelationId` equal to that id.
   - *positive:* the two ids stay distinct — the save request's own correlation id is not
     what lands in `genCorrelationId`.
   - *positive:* legacy adoption (`App.tsx:95`) sends `genCorrelationId: null`.
   - *positive:* a generation that returns `data: null` still throws `no_data` exactly as
     today — the envelope change must not swallow that path.
   - *negative:* **rendering is unchanged** — the exam view for the recorded payload is
     byte-identical to the existing pin; the envelope change is invisible to the UI.
   - *negative:* `generateExam`'s error paths (`GenerateError` types and Arabic messages)
     are unchanged.
   - *obs assertion:* the request body — not a header, not a query param — carries the field.

5. **Boundaries:** honours `fe-be-subjects-v2.contract.md` Part B. `costUsd` is **not**
   persisted from `fe`; the join key is the deliverable. Budget: 10 iterations.

6. **Exit:** done-when = oracle green + freeze respected + `tools/ci fe --slug persistence-gaps`
   green · ask-when = the envelope change ripples into a component (it should not — stop) ·
   `/api/generate` seems to need changing · budget blown.

```yaml
---
kind: sub-issue
id: fe-3
parent: i1
stack: fe
status: todo
depends_on: [be-3]
estimate: M
---
```

### fe-3 — let a teacher go back to a previous version

1. **Intent:** refining until it is right is the product; without a way back, a teacher who
   refines an exercise into something worse has lost work that cost real money to generate.

2. **Ground truth (recorded + re-run command):**
   ```bash
   $ grep -n "refine\|onRefine\|replaceExercise" stacks/teacher-fe/src/components/RefinePanel.tsx | head
   ```
   Today refinement replaces the exercise in place with no history affordance. Pre-flight:
   refine an exercise twice and confirm nothing in the UI offers the earlier version.

3. **Delta:**
   - `teacher-fe/src/lib/api.ts` — **new**: `listRevisions(teacherId, subjectId, exerciseId)`.
   - `teacher-fe/src/components/RefinePanel.tsx` — a history affordance listing previous
     versions with their `supersededAt`, and a restore action.
   **Frozen:** `ExamView.tsx`, `katex.tsx`, `exam.ts`, the print path, `App.tsx`'s save flow.
   Freeze check: `git status --short -- src/lib/api.ts src/components/RefinePanel.tsx`

4. **Oracle (two-sided, executable)** — `features/persistence-gaps/tests/fe/revisions.characterization.test.tsx`:
   - *positive:* after two refinements, the panel lists **2** previous versions, newest first.
   - *positive (restore):* restoring version 1 issues the existing
     `PUT …/exercises/:exerciseId` with that version's body — **no new endpoint** — and the
     sheet then renders the restored statement.
   - *positive:* after restoring, the list grows to **3** — restoring is itself a
     supersession, never destructive. This mirrors `be-3`'s clause.
   - *positive (each state):* empty (never refined → an Arabic "no previous versions" line,
     **not** an error) · loading · error(retryable, `store_unavailable`) · success.
   - *positive:* previous versions render through **KaTeX**, like every other maths surface.
   - *negative:* **no LaTeX source is ever shown** — assert the rendered history contains no
     `\frac`, `$`, `\(`. A history panel is the most tempting place to leak raw LaTeX, and
     the hard constraint forbids it.
   - *negative:* every string Arabic (same assertion as `fe-1`).
   - *negative:* the exam sheet and print output for a subject with history are byte-identical
     to one without — history is an affordance, never part of the sheet.
   - *obs assertion:* opening the panel issues **one** revisions request, not one per render.

5. **Boundaries:** honours `fe-be-subjects-v2.contract.md` Part A — restore reuses the
   existing `PUT`. Budget: 10 iterations.

6. **Exit:** done-when = oracle green + freeze respected + `tools/ci fe --slug persistence-gaps`
   green · ask-when = restore appears to need a new endpoint (it does not — stop) · a
   previous version cannot render without exposing LaTeX · budget blown.

```yaml
---
kind: sub-issue
id: fe-4
parent: i1
stack: fe
status: todo
depends_on: []
estimate: M
---
```

### fe-4 — a failed save survives the tab closing  *(hardening)*

1. **Intent:** a teacher who hits a failed save and closes the tab loses that exam — the same
   silent-loss class the whole persistence arc exists to end. Folds in gap #5.

2. **Ground truth (recorded + re-run command):**
   ```bash
   $ grep -n "SaveState\|setSaveState" stacks/teacher-fe/src/App.tsx | head
   48:type SaveState = { kind: "idle"|"saving"|"saved" } | { kind: "error"; retry: () => void };
   61:const [saveState, setSaveState] = useState<SaveState>({ kind: "idle" });
   217:setSaveState(err.retryable ? { kind: "error", retry } : { kind: "idle" });
   $ grep -c "pending" stacks/teacher-fe/src/lib/persist.ts
   0
   ```
   The retry is a closure in memory; **no pending-save key exists.** Pre-flight must
   reproduce both.

3. **Delta:**
   - `teacher-fe/src/lib/persist.ts` — **new** `teacher.pending.v1` (load/save/clear), using
     the existing guarded `read`/`write`/`remove` helpers.
   - `teacher-fe/src/App.tsx:191-217` — on a retryable failure, persist the pending save; on
     mount, offer to replay it.
   **Frozen:** the generation path, `ExamView`, print.
   Freeze check: `git status --short -- src/lib/persist.ts src/App.tsx`

4. **Oracle (two-sided, executable)** — `features/persistence-gaps/tests/fe/pending-save.characterization.test.tsx`:
   - *positive:* a retryable save failure writes `teacher.pending.v1`; **remount** (simulating
     a reload) and the pending save is offered.
   - *positive:* replaying it successfully **clears** the key — no infinite re-offer.
   - *positive:* a **non-retryable** failure (e.g. `claude_auth`) does **not** queue — the
     existing rule that a human must act, not a retry loop.
   - *positive (visible, never silent):* the replay is surfaced to the teacher; assert it is
     **not** fired automatically on mount without an affordance. A silent background write is
     indistinguishable from data loss.
   - *positive (gap #5):* controls panel state continues to round-trip via
     `teacher.controls.v1` — unchanged behaviour, pinned so the fold-in does not disturb it.
   - *positive (each state):* idle · saving · saved · error(retryable, queued) · error(hard).
   - *negative:* **every `localStorage` access stays guarded, including `remove`** — this is
     the invariant `persistence`'s storage-resilience pin exists for (an unguarded
     `removeItem` crashed the app before first render in private mode). Simulate a throwing
     `localStorage` and assert the app still renders.
   - *negative:* the paint cache (`teacher.cache.v1`) keeps its current behaviour.
   - *obs assertion:* replay issues exactly one `POST /api/subjects`, never one per render.

5. **Boundaries:** additive keys only; no existing key changes name or shape. Budget: 10
   iterations.

6. **Exit:** done-when = oracle green + freeze respected + `tools/ci fe --slug persistence-gaps`
   green · ask-when = queueing would require an unguarded storage access · a replay could
   double-write a subject (insert-only means a double replay creates **two** exams — if that
   cannot be prevented client-side, stop and ask) · budget blown.
