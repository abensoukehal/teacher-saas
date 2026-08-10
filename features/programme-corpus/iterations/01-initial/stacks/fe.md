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

### fe-1 — <short name>
<!-- Six slots — the loop-ready contract (conventions/writing-sub-issues.md). -->
1. **Intent:** why this sub-issue exists, one sentence — the loop's tiebreaker.
2. **Ground truth (recorded + re-run command):** real shapes from the running
   service (`curl …` / `tools/obs trace <id>`) — pasted here with the command.
   Pre-flight: the loop re-runs this and must reproduce it before writing a line.
3. **Delta:** target files (`path:LINE`) + the change. **Everything else frozen**
   (freeze check is path-scoped: `git status --short -- <delta paths>`, never repo-wide — WF-63).
4. **Oracle (executable, two-sided):**
   - positive: spec-test / characterization `features/<slug>/tests/fe/…`
     (run: `tools/ci fe --slug <slug>`);
     acceptance as commands + expected observations, states incl. (loading/error/empty)
   - negative: existing consumers' recorded shapes bit-stable; untouched paths unchanged
   - obs assertion: `tools/obs trace <id>` shows the flow with expected status
5. **Boundaries:** contract refs; additive/versioned only; budget: 10 loop iterations.
6. **Exit:** done-when = oracle green + freeze respected + `tools/ci fe` green ·
   ask-when = contract change needed / non-additive / frozen file / red pin / budget blown
   (see `conventions/autonomy.md`).
