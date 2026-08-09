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

## Sub-issues (this stack's technical work, grouped by issue)

<!-- Personal-only. Each rolls its status UP to its parent issue. No board title. -->

```yaml
---
kind: sub-issue
id: fe-1
parent: i1                  # the board issue this builds
stack: fe
status: todo                # rolls up to the issue
depends_on: []
estimate: M
---
```

### fe-1 — render the exam as it arrives

**status:** todo · **tag:** happy-path

**Intent.** Start a generation, then show each exercise the moment it exists instead of a
blank wait ending in everything at once. Per `contracts/fe-be-progressive.contract.md` §4.
This is the win the job is actually shipping (SEED §3): first exercise at ~74 s rather than
~110 s.

**Ground truth.** Today `api.ts:117` POSTs `/api/generate` and blocks; `ExamView.tsx`
renders a complete `exercises[]`; `Progress.tsx` is the wait state. Recorded monolith
response: `scratchpad/run-ex3.json`. Reproduce the current wait:
```
tools/dev up -d && open http://localhost:10000/
```

**Delta (freeze).** May touch: `src/lib/api.ts` (new calls only), `src/lib/exam.ts`,
`src/components/ExamView.tsx`, `src/components/Progress.tsx`, `src/App.tsx`.
**FROZEN: the existing `/api/generate` calls, byte for byte** — the comment at
`api.ts:235` states this and it is now contractual. The monolith path keeps working.

**Oracle.** `features/parallel-exercises/tests/fe/progressive-render.characterization.test.tsx`
- given a subject with `ex1: ready, ex2: pending, ex3: pending`, ex1's statement renders and
  the other two show a waiting state (positive — the whole feature)
- **an empty `statement` is never rendered as an exercise** (negative — contract §4; a blank
  exercise reads as a product bug)
- polling stops once no exercise is `pending` (negative — a poll that never stops is a
  battery and quota leak)
- a subject whose exercises have **no `status` field renders fully** — 6,086 stored exams
  predate it (negative; contract §1)
- every new string is Arabic and the layout holds under `dir="rtl"` (positive — hard
  constraint, and jsdom will not catch a visual break, so assert the strings)
- **no LaTeX is ever visible** — maths goes through KaTeX, never raw into a text node

**Boundaries.** Budget 10 cycles. Failure/retry UI is fe-2. Do not touch `be`.

**Exit protocol.** Oracle green ×2 · perimeter diff: the promoted `project/tests/fe` net
(242 clauses) still green · freeze audit on the `/api/generate` calls · journal sealed.

---

### fe-2 — reach the progressive path, and show a failed exercise honestly

**status:** todo · **tag:** hardening

> **SCOPE AMENDED after fe-1 (2026-08-09).** fe-1 shipped `startExam` tested but
> **uncalled** — nothing in the UI starts a progressive run, because the promoted net binds
> «توليد الموضوع» to `/api/generate` and fe-1's exit protocol required that net green. Both
> could not hold, so the frozen oracle won and reachability was deferred here. **SEED §5
> exit criterion 1 is not met until a teacher can actually reach this**, so it is now part
> of this sub-issue rather than a follow-up.
>
> **Decision: repoint the existing button. Do not add a second one.** Two generate buttons
> is the over-engineering the hard constraints forbid, and a teacher cannot be asked to know
> which one to press. `/api/generate` stays FROZEN as a *surface* — `solution-sheet` still
> uses it — but the exam-creation *flow* moves to `POST /api/exams`.
>
> **Consequence, and it must be deliberate:** promoted clauses that assert the button calls
> `/api/generate` (in `project/tests/fe/` — `cost-join`, `kpis-thread`, `auth`) are
> asserting behaviour this job intentionally replaces. Update them to the new flow **in the
> job's own test dir**, and state the change in the journal. A characterization net going
> red on an intended change is the net working; silently deleting a clause is not.

**Intent.** ~22% of 3-exercise exams will have a hole (SEED §10.1, as corrected). The teacher must see
which exercise is missing, in their language, and be able to ask for it again — without
losing the exercises that worked.

**Ground truth.** `be-3` marks it `status:"failed"` with `statement:""`; `be-4` exposes
`POST /api/subjects/:id/exercises/:exerciseId/regenerate`. Recorded failure shape:
`scratchpad/fan-ex1.json`.

**Delta (freeze).** May touch: `ExamView.tsx`, `api.ts` (the regenerate call),
`SolutionView.tsx` (corrections stream the same way — exit criterion 3).
**Frozen:** the refine flow (`RefinePanel.tsx`) — a *failed* exercise and a *refined* one
are different things and must not share a path.

**Oracle.** `tests/fe/exercise-failure.characterization.test.tsx`
- a `failed` exercise renders an Arabic explanation and a retry control (positive)
- the other exercises stay fully rendered and usable alongside it (positive — the reason
  fan-out was chosen over streaming the monolith)
- retry calls `/regenerate` for **that** `exerciseId` only (positive)
- the failure message contains no English, no error code, no `exerciseId`, and no LaTeX
  (negative — hard constraints; a teacher must never see internals)
- printing an exam with a `failed` exercise does not print an empty box (negative)
- **«توليد الموضوع» starts a PROGRESSIVE run** — `POST /api/exams`, then the first `ready`
  exercise paints without waiting for the rest (positive — the amended scope; without this
  clause the whole job is unreachable)
- the solution-sheet flow still calls `/api/generate` and is unaffected (negative — the
  surface is frozen, only the exam-creation flow moved)

**Boundaries.** Budget 8 cycles.

**Exit protocol.** Oracle green ×2 · Arabic-only assertions on every new string ·
journal sealed.

---

### fe-3 — corrections appear one by one

**status:** todo · **tag:** hardening · **filed by:** QA (bug A)

**Intent.** The teacher watches `solutions: []` for ~230 s and then gets everything at once.
Same defect the exam had before this job, on the correction path. Render each correction as it
lands, exactly as exercises now do.

**Ground truth.** QA's ledger `.../qa.md`, bug A: one spawn, 230 s of empty polls, then three
corrections together. `SolutionView.tsx` renders the whole set today.

**Delta (freeze).** May touch: `SolutionView.tsx`, the solutions calls in `api.ts`, the poll
helper (`lib/poll.ts` already exists and already provably stops — reuse it, do not write a
second poller). **Frozen:** the `/api/generate` calls, the exam-side progressive path shipped
in fe-1/fe-2, and the print sheet's behaviour.

**Oracle.** `tests/fe/solutions-progressive.characterization.test.tsx`
- one correction present and two pending → the one renders, the others show an Arabic waiting
  state (positive)
- polling stops once no correction is pending (negative — same brake as the exam poll)
- **the correction button cannot start a second run while one is in flight** (positive — QA
  bug B's user-facing half; two tabs gave two enabled buttons)
- an exam with no corrections yet renders no empty correction boxes (negative)
- every new string Arabic, no LaTeX visible, RTL holds (positive — hard constraints)

**Boundaries.** Budget 8 cycles. Do not touch the exam-side progressive path.

**Exit protocol.** Oracle green ×2 · promoted `fe` net green against the JOB checkout ·
journal sealed.
