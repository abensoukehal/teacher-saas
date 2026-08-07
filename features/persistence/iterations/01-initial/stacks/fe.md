# Stack spec — teacher-fe (React 19 · TypeScript · Vite)

> Job `persistence`, iteration `01-initial`. Derived from the locked `SEED.md`;
> honours `contracts/fe-be-subjects.contract.md` + `.schema.yaml` + `flows.md`.
>
> **`fe` owns the defect.** `src/lib/persist.ts:10` is where a teacher's second exam
> destroys their first. This stack's job is to move the source of truth to the
> server and make earlier subjects reachable — in Arabic, RTL, with KaTeX intact.

## Scope recap (from SEED.md + this stack's sub-issues)
- **Modules:** `src/lib/api.ts` (modify) · `src/lib/persist.ts` (modify — demoted to
  cache) · `src/App.tsx` (modify) · `src/components/SubjectList.tsx` (new)
- **Contracts:** `contracts/fe-be-subjects.contract.md`, `flows.md` F1–F5
- **Frozen:** `src/lib/exam.ts` (the `ExamSubject` type and `spliceExercise`),
  `src/lib/katex.tsx`, `src/components/{ExamView,RefinePanel,Controls,Progress}.tsx`,
  `src/lib/taxonomy.ts`, `src/styles/`. SEED kit §7 records component internals as
  **not swept** — touching them is a stop-and-ask, not a judgment call.

## Current behavior baseline

```ts
// src/lib/persist.ts:10-11
const KEY_EXAM = "teacher.draft.v1";        // ONE slot — the defect
const KEY_CONTROLS = "teacher.controls.v1";
```
```ts
// src/App.tsx
23:  const [exam, setExam] = useState<ExamSubject | null>(() => loadDraft());
29:  useEffect(() => saveControls(controls), [controls]);
30:  useEffect(() => saveDraft(exam), [exam]);      // overwrites on every change
59:  if (next) setExam(next);                       // generate → replaces the draft
72:  setExam(spliceExercise(exam, updated));        // refine → splices by id
```
A refresh loses **nothing** (the brief was wrong — SEED journal H1). A *second
generation* loses **everything** from the first. Every storage access in
`persist.ts` is wrapped in `try/catch {}` (lines 15–34) and fails **silently**.

Pinned by `features/persistence/tests/fe/*.characterization.*` (WF-53 home).
Run via `tools/ci fe --slug persistence`.

## Run headless
```bash
cd project-worktrees/persistence && ../../tools/dev up -d     # fe :10200 → be :9200
```
`fe` needs `npm install` in its worktree before it will boot (the extend linked
`node_modules`; verify with `tools/dev status`).

## Observability (PIN co-requisite)
- **Today:** browser console only; no client telemetry. `be` stamps a
  `correlationId` on every response — `fe` currently discards it.
- **Blind spot:** a silently-failed save is invisible to both teacher and developer.
  That is `fe-4`, and it is the direct consequence of moving the source of truth to
  the network.

## Client state / types

| Type or store | Field | Change | Backend contract it mirrors |
|---|---|---|---|
| `SubjectSummary` (new) | `id,title,topic,exerciseCount,totalPoints,createdAt,updatedAt` | add | § Subject surfaces → `GET /api/subjects` |
| `SubjectRecord` (new) | `id,createdAt,updatedAt,subject` | add | § Subject surfaces → `GET /api/subjects/:id` |
| `ExamSubject` | — | **unchanged, frozen** | `exam.ts:26`, already correct |
| app state | `currentSubjectId: string \| null` | add | F2/F4 |
| app state | `saveState: "idle"\|"saving"\|"saved"\|"error"` | add (`fe-4`) | F5 |
| `localStorage` | `teacher.id.v1` | add | § Identity |
| `localStorage` | `teacher.draft.v1` | **demote to cache, then adopt + clear** | F1 |

## Surfaces (routes / views / components)

| Surface | Implementation path | New/Modify | Contract |
|---|---|---|---|
| subject list | `src/components/SubjectList.tsx` | **New** | F4 |
| api client | `src/lib/api.ts` | Modify | whole contract |
| app shell | `src/App.tsx` | Modify | F1–F5 |
| local cache | `src/lib/persist.ts` | Modify | F1 |

## States (non-negotiable at this latency)

| State | What the teacher sees |
|---|---|
| idle | controls + the subject list; if a subject is open, its exercises |
| queued | existing progress UI — **unchanged** by this job |
| running (minutes) | existing progress UI — **unchanged** |
| failed — 503 `claude_auth` | existing Arabic message; **no retry button** (a human must re-login) |
| failed — 503 `store_unavailable` | **new**: Arabic "لم نتمكّن من الحفظ" + **retry** — this one IS retryable |
| failed — 504 timeout | existing, retryable |
| failed — 502 CLI error | existing, retryable, reason surfaced |
| empty (no subjects yet) | Arabic empty state in the list — never a blank panel |
| saving / saved | **new** (`fe-4`) — a visible, honest save indicator |

> Branch on `error.type`, **never on the status code**: `claude_auth` and
> `store_unavailable` are both `503` and need opposite advice (flows F5).

## Network discipline

All calls stay **relative** `/api/...` through the Vite proxy. `vite.config.ts`
sets `strictPort` and reads `BACKEND_API` from the lane env; an absolute backend
URL introduced by this job would silently cross lanes and must be flagged.

---

## Sub-issues (this stack's technical work, grouped by issue)

```yaml
---
kind: sub-issue
id: fe-1
parent: i1
stack: fe
status: todo
depends_on: [be-3]
estimate: M
---
```

### fe-1 — a typed client for subjects and identity

1. **Intent:** give the app a single, typed way to reach the new `be` surfaces, so
   `App.tsx` never hand-rolls a fetch and the response types mirror `be`'s recorded
   shapes rather than a guess.

2. **Ground truth (recorded + re-run command):** the live surfaces, once `be-3` has
   landed:
   ```
   curl -s -X POST localhost:9200/api/teacher
   curl -s -H "x-teacher-id: $TID" localhost:9200/api/subjects
   ```
   The current client for contrast:
   ```
   $ git show origin/main:src/lib/api.ts | head -30      # only /api/generate today
   ```

3. **Delta:** `teacher-fe/src/lib/api.ts` (add `issueTeacher`, `createSubject`,
   `listSubjects`, `getSubject`, `replaceExercise`, and the `SubjectSummary` /
   `SubjectRecord` types). **Everything else frozen.** Freeze check:
   `git status --short -- src/lib/api.ts`

4. **Oracle (two-sided, executable):** suite in
   `features/persistence/tests/fe/api-subjects.spec.ts`:
   - *positive:* each function issues a **relative** `/api/...` URL (assert the
     string starts with `/api/` — an absolute URL crosses lanes) and attaches
     `x-teacher-id` on every subject call.
   - *positive:* responses parse into the declared types against fixtures copied
     from `be`'s recorded shapes.
   - *positive (error mapping, one per variant — WF-70):* `401 teacher_required`,
     `404 subject_not_found`, `409 exercise_not_found`, `503 store_unavailable` each
     surface as a typed error carrying **`error.type`**, not just a status.
   - *negative:* the existing `generate` call is **byte-identical** in URL, method,
     headers and body shape — pin it, this is the frozen perimeter.
   - *negative:* no absolute `http://` literal appears anywhere in `api.ts`.

5. **Boundaries:** honours the contract's status/type table exactly. No UI, no state
   wiring — that is `fe-2`. Budget: 8 iterations.

6. **Exit:** done-when = oracle green + freeze respected + `tools/ci fe --slug
   persistence` green · ask-when = a surface returns something the contract does not
   describe · the existing `generate` client would have to change.

```yaml
---
kind: sub-issue
id: fe-2
parent: i1
stack: fe
status: todo
depends_on: [fe-1]
estimate: L
---
```

### fe-2 — move the source of truth to the server; adopt the orphan draft

1. **Intent:** **this closes the defect.** Generating an exam must create a new
   stored subject instead of overwriting `teacher.draft.v1`, and the draft a teacher
   already has must survive the transition rather than being stranded.

2. **Ground truth (recorded + re-run command):** the overwrite, live:
   ```
   $ git show origin/main:src/lib/persist.ts | grep -n KEY_EXAM
   10:const KEY_EXAM = "teacher.draft.v1";
   $ git show origin/main:src/App.tsx | sed -n '23p;30p'
   const [exam, setExam] = useState<ExamSubject | null>(() => loadDraft());
   useEffect(() => saveDraft(exam), [exam]);
   ```
   Reproduce the defect in a browser: generate exam A, generate exam B, reload →
   only B exists, A is unrecoverable.

3. **Delta:** `teacher-fe/src/App.tsx` (identity bootstrap, `currentSubjectId`,
   create-on-generate, write-through-on-refine, one-shot adoption) ·
   `teacher-fe/src/lib/persist.ts` (add `teacher.id.v1`; demote `teacher.draft.v1`
   to a cache + `adoptLegacyDraft`). **Everything else frozen** — in particular
   `src/lib/exam.ts` and every component. Freeze check:
   `git status --short -- src/App.tsx src/lib/persist.ts`

4. **Oracle (two-sided, executable):** suite in
   `features/persistence/tests/fe/app-persistence.spec.ts`:
   - *positive (the defect, pinned):* generate A, then generate B → **two**
     `POST /api/subjects` calls with **different** returned ids, and A is still
     retrievable via `getSubject(idA)`. **An implementation that overwrites fails
     here.**
   - *positive (F1):* with no `teacher.id.v1`, boot issues exactly **one**
     `POST /api/teacher` and stores it; with one present, boot issues **zero**.
   - *positive (F1 adoption):* with a legacy `teacher.draft.v1` present, boot posts
     it once as a subject **and then clears the key**; a second boot posts nothing.
   - *positive (adoption failure):* if that create fails, the key is **NOT** cleared
     — the draft must not be destroyed by a failed migration. Assert the key survives.
   - *positive (F3):* a refine issues `PUT …/exercises/<id>` with the spliced
     exercise, and `spliceExercise`'s throw-on-unknown-id behaviour is preserved.
   - *positive (F4):* opening a stored subject sets `currentSubjectId` and renders
     its exercises.
   - *negative:* `POST /api/generate` request shape is unchanged (frozen perimeter).
   - *negative:* `exam.ts` is untouched — `spliceExercise` still **throws** on an
     unknown id rather than merging (`exam.ts:38`).
   - *negative:* controls persistence (`teacher.controls.v1`) still works exactly as
     before — same key, same shape.
   - *negative (RTL/KaTeX):* rendering is unchanged — no component file appears in
     the diff.

5. **Boundaries:** honours `flows.md` F1–F4. **Arabic-only, RTL** for any new
   user-visible string. `localStorage` is now a cache, never the source of truth.
   Budget: 12 iterations.

6. **Exit:** done-when = oracle green + freeze respected + `tools/ci fe --slug
   persistence` green · ask-when = a frozen component must change to wire this ·
   the contract cannot express a needed call · adoption cannot be made
   exactly-once-and-safe.

```yaml
---
kind: sub-issue
id: fe-3
parent: i1
stack: fe
status: todo
depends_on: [fe-2]
estimate: M
---
```

### fe-3 — a teacher can see and reopen their earlier subjects

1. **Intent:** storing many subjects is worthless if a teacher cannot reach them.
   The minimum surface that makes the fix real — and the seed of the exercise
   library (roadmap 6), without building it.

2. **Ground truth (recorded + re-run command):** no such surface exists.
   ```
   $ git show origin/main:src/App.tsx | grep -c SubjectList     → 0
   $ ls src/components/                                          → Controls, ExamView, Progress, RefinePanel
   ```
   The list payload it renders:
   `curl -s -H "x-teacher-id: $TID" localhost:9200/api/subjects`

3. **Delta:** `teacher-fe/src/components/SubjectList.tsx` (**new**) ·
   `teacher-fe/src/App.tsx` (mount it) · `teacher-fe/src/App.css` (list styles only).
   **Everything else frozen.** Freeze check:
   `git status --short -- src/components/SubjectList.tsx src/App.tsx src/App.css`

4. **Oracle (two-sided, executable):** suite in
   `features/persistence/tests/fe/subject-list.spec.ts`:
   - *positive:* given N summaries, renders N rows, **newest first**, each showing
     title, topic, exercise count and total points.
   - *positive (states):* `empty` → an Arabic empty-state message, never a blank
     panel; `loading` → a pending indicator; `error 503 store_unavailable` → Arabic
     message **with** a retry affordance.
   - *positive:* clicking a row calls `getSubject(id)` and opens it (F4).
   - *negative (RTL — a hard constraint):* the rendered container resolves under
     `dir="rtl"`; assert no `text-align: left`, no `margin-left`/`padding-left`
     hardcoded in the new CSS (use logical properties), and no Latin-script UI
     string in the new component.
   - *negative (LaTeX must never surface):* summaries contain no `statement`, so
     assert the rendered list contains no `$` or `\` sequence — a teacher must never
     see LaTeX (hard constraint).
   - *negative (perimeter, WF-69):* every existing mount site of `App` still renders;
     `ExamView` / `RefinePanel` / `Controls` / `Progress` are unchanged in the diff.

5. **Boundaries:** honours `flows.md` F4 and the contract's `SubjectSummary` shape.
   **Arabic only, RTL, no LaTeX, KaTeX untouched.** No search, no filter, no delete,
   no pagination — that is the library job. Budget: 10 iterations.

6. **Exit:** done-when = oracle green + freeze respected + `tools/ci fe --slug
   persistence` green · ask-when = a frozen component must change · the summary
   shape is insufficient to render a useful row · RTL cannot be satisfied without
   touching `styles/tokens.css`.

```yaml
---
kind: sub-issue
id: fe-4
parent: i1
stack: fe
status: todo
depends_on: [fe-2]
tag: hardening
estimate: S
---
```

### fe-4 — never let a teacher believe unsaved work is saved

1. **Intent:** `persist.ts` deliberately swallows every storage error
   (`catch {}`, lines 15–34). That was right when the cost was a lost local cache.
   Now that the server is the source of truth, a swallowed **network** failure means
   a teacher believes an exam is stored when it is not — the exact harm this job
   exists to prevent, reintroduced by silence (SEED → Risks).

2. **Ground truth (recorded + re-run command):**
   ```
   $ git show origin/main:src/lib/persist.ts | sed -n '24,30p'
   function write(key: string, value: unknown): void {
     try { localStorage.setItem(key, JSON.stringify(value)); }
     catch { /* non-fatal */ }
   }
   ```
   Reproduce: stop `be` (`tools/dev down be`), generate → today nothing tells the
   teacher the result was not stored.

3. **Delta:** `teacher-fe/src/App.tsx` (`saveState` + the indicator) ·
   `teacher-fe/src/App.css` (indicator styles only).
   **Everything else frozen.** Freeze check:
   `git status --short -- src/App.tsx src/App.css`

4. **Oracle (two-sided, executable):** suite in
   `features/persistence/tests/fe/save-state.spec.ts`:
   - *positive:* a successful create/update drives `saving → saved`, and `saved` is
     visible to the teacher in Arabic.
   - *positive:* a `503 store_unavailable` drives `error`, shows an Arabic message
     **and** offers retry; retry re-issues the same call.
   - *positive:* a `503 claude_auth` does **not** offer retry (different advice, same
     status — flows F5).
   - *negative:* the local cache still never throws — a `localStorage` failure is
     still swallowed and still does not break the app (`persist.ts`'s existing
     guarantee, including the `remove` path that a review probe caught last job).
   - *negative:* no change to generation, rendering, or any frozen component.

5. **Boundaries:** honours `flows.md` F5 and the states table above. Branch on
   `error.type`, never the status code. Arabic only, RTL. Budget: 6 iterations.

6. **Exit:** done-when = oracle green + freeze respected + `tools/ci fe --slug
   persistence` green · ask-when = distinguishing the failure classes needs a
   contract change · the indicator cannot be expressed without touching a frozen
   component.
