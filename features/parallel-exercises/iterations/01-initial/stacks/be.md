# Stack spec — teacher-be (Express · TypeScript · ESM · Node 20+)

> The per-job skeleton for the **be** repo (`repos.sh` key `be`).
> `tools/provision` copies this into every new job's `stack-skeletons/`; the job
> fills it in. Filled and implemented by the `be` stack agent (reads
> `project/CLAUDE.md`'s be section + this feature's `contracts/`).
> Loop-engineering format: everything an implementing agent needs, issue by issue.
>
> **This repo is two things:** the application tier, and the **Claude Code CLI
> wrapper** (`src/claude/`) that generates coursework. A new kind of generated
> material is a new `.claude/skills/<name>/SKILL.md` — *not* new orchestration
> code. If a sub-issue here is building a prompt pipeline in TypeScript, it is
> scoped wrong.

## Scope recap (from SEED.md + this stack's sub-issues)
- Modules:
- Contracts this stack must honor: `contracts/<a>-<b>`, …

## Current behavior baseline
> What the touched areas do today, with file:line refs.
> Pinned by `features/<slug>/tests/be/*.characterization.*` (the WF-53 home —
> never sub-repo-local; run via `tools/ci be --slug <slug>`; import by module
> resolution, never relative `../../` paths into the repo).

### Run headless (to investigate — do this before writing the Blueprint)
> Exercise the real code; record real shapes. Don't assume.
- Run the local stack (`tools/dev up`) or just this one: `tools/dev up be`.
- **Check the CLI first** — most generation failures are environmental, not code:
  `curl localhost:<lane-port>/health` → `claude.ok`, version, queue depth.
  A `503 claude_auth` means the CLI needs an interactive `/login`, not a fix here.
- Call the target surfaces (curl / a throwaway script), record ACTUAL
  request/response shapes → paste into the contract's "current shape".
- Watch it: `tools/obs logs be`, `tools/obs trace <id>` (correlation id is echoed
  on every response and log line).

> ⚠ `POST /api/generate` runs a **whole Claude Code agent loop** — minutes, and it
> spends quota. Record the shape once and pin it with a characterization test;
> don't re-call it on every loop iteration.

## Observability (PIN co-requisite)
> Before implementing: is this area observable today? What must be added.
- Logs: key transitions, structured fields, correlation id in/out
- Errors: error-tracker capture on the paths we touch
- Trace: correlation id received upstream, propagated downstream
- Blind spots → first issue(s) in the slice. Verify: `tools/obs logs`, `tools/obs trace <id>`

## Data model changes
| Model / store | Field | Change | Migration? |
|---------------|-------|--------|-----------|
| | | add / modify | yes/no |

> ★ No datastore is chosen yet — record the decision here the first time a job
> needs one. Additive, backward-compatible; never drop/rename in the same release
> as the code change.

## Surfaces (Express routes)
> Declared in `src/app.ts`. Existing surface: `/health` · `/api` · `/api/skills`
> · `/api/generate`.

| Surface | Implementation path | New/Modify | Contract |
|---------|--------------------|-----------|----------|
| | `src/app.ts:LINE` | | |

## Skills touched (`.claude/skills/`)
> The product's real capability layer. One row per skill this job adds or changes.

| Skill | New/Modify | What it produces | How its output is judged |
|-------|-----------|------------------|--------------------------|
| | | | |

> A skill's oracle is not a string match — it is whether the material is usable in
> a real classroom. State the checkable properties (e.g. "segment minutes sum to
> the stated duration", "objectives are observable"), and pin those.

## Gating (concurrency, timeouts)
> `CLAUDE_MAX_CONCURRENT` queues runs; `CLAUDE_TIMEOUT_MS` bounds one. If this job
> makes generation slower or more parallel, say what happens to the queue.

## Failure classification
> Auth → 503 · timeout → 504 · other CLI failure → 502 · this service's own bug →
> 500. A new failure path must land in the right bucket; collapsing to 500 hides
> the ones a human can actually act on.

---

## Sub-issues (this stack's technical work, grouped by issue)

<!-- Personal-only. Each rolls its status UP to its parent issue. No board title. -->

```yaml
---
kind: sub-issue
id: be-1
parent: i1                  # the board issue this builds
stack: be
status: todo                # rolls up to the issue
depends_on: []
estimate: M
---
```

### be-1 — <short name>
<!-- Six slots — the loop-ready contract (conventions/writing-sub-issues.md). -->
1. **Intent:** why this sub-issue exists, one sentence — the loop's tiebreaker.
2. **Ground truth (recorded + re-run command):** real shapes from the running
   service (`curl …` / `tools/obs trace <id>`) — pasted here with the command.
   Pre-flight: the loop re-runs this and must reproduce it before writing a line.
3. **Delta:** target files (`path:LINE`) + the change. **Everything else frozen**
   (freeze check is path-scoped: `git status --short -- <delta paths>`, never repo-wide — WF-63).
4. **Oracle (executable, two-sided):**
   - positive: spec-test / characterization `features/<slug>/tests/be/…`
     (run: `tools/ci be --slug <slug>`);
     acceptance as commands + expected observations, states incl. (loading/error/empty)
   - negative: existing consumers' recorded shapes bit-stable; untouched paths unchanged
   - obs assertion: `tools/obs trace <id>` shows the flow with expected status
5. **Boundaries:** contract refs; additive/versioned only; budget: 10 loop iterations.
6. **Exit:** done-when = oracle green + freeze respected + `tools/ci be` green ·
   ask-when = contract change needed / non-additive / frozen file / red pin / budget blown
   (see `conventions/autonomy.md`).
