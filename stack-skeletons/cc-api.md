# Stack spec — cc-api (Python · FastAPI · Poetry)

> The per-job skeleton for the **cc-api** repo (`repos.sh` key `cc-api`).
> `tools/provision` copies this into every new job's `stack-skeletons/`; the job
> fills it in. Filled and implemented by the `cc-api` stack agent (reads
> `project/CLAUDE.md`'s cc-api section + this feature's `contracts/`).
> Loop-engineering format: everything an implementing agent needs, issue by issue.
>
> **Repo:** `abensoukehal/claude-code-openai-wrapper` (fork of
> `RichardAtCT/claude-code-openai-wrapper`) · Python 3.10+ · FastAPI · uvicorn ·
> Poetry · pytest. Single-branch `main`, so `/merge-back` skips it.
> **Role:** the product's LLM edge — an OpenAI-compatible API over the Claude
> Agent SDK. Its wire shapes are a public contract; OpenAI clients break on drift.

## Scope recap (from SEED.md + this stack's sub-issues)
- Modules:
- Contracts this stack must honor: `contracts/<a>-<b>`, …

## Current behavior baseline
> What the touched areas do today, with file:line refs.
> Pinned by `features/<slug>/tests/cc-api/*.characterization.*` (the WF-53 home —
> never sub-repo-local; run via `tools/ci cc-api --slug <slug>`; import by module
> resolution, never relative `../../` paths into the repo).

### Run headless (to investigate — do this before writing the Blueprint)
> Exercise the real code; record real shapes. Don't assume.
- Run the local stack (`tools/dev up`) or just this one: `tools/dev up cc-api`
  (standalone: `poetry run uvicorn src.main:app --reload --port 9000`).
- Sanity + context first — behavior forks on the active auth method:
  `curl localhost:<lane-port>/health` · `curl localhost:<lane-port>/v1/auth/status`
- Call the target surfaces (curl / a throwaway script), record ACTUAL
  request/response shapes → paste into the contract's "current shape".
- Watch it: `tools/obs logs cc-api`, `tools/obs trace <id>`.

> ⚠ Real calls to `/v1/chat/completions` and `/v1/messages` **spend Claude quota**.
> Say so in the sub-issue when an oracle depends on one, and prefer the recorded
> shape over a live re-call where a characterization test will do.

## Observability (PIN co-requisite)
> Before implementing: is this area observable today? What must be added.
- Logs: key transitions, structured fields, correlation id in/out
- Errors: error-tracker capture on the paths we touch
- Trace: correlation id received upstream, propagated downstream
- Blind spots → first issue(s) in the slice. Verify: `tools/obs logs`, `tools/obs trace <id>`

## Wire-shape changes (`src/models.py`)
> This service has no database. Its "data model" is the Pydantic request/response
> layer — which is exactly the part OpenAI clients depend on.

| Pydantic model | Field | Change | Breaks a client? |
|----------------|-------|--------|------------------|
| | | add optional / modify | yes/no |

> Additive, backward-compatible. A renamed or removed field is a contract break,
> not a refactor — version it instead.
>
> Session state lives in `src/session_manager.py` (in-memory, per-process): it does
> **not** survive a restart, and a lane restart wipes it. Never write an oracle that
> assumes a session outlives the process.

## Surfaces (FastAPI routes)
> Every route is declared in `src/main.py`. Existing surface, for orientation:
> `/v1/chat/completions` · `/v1/messages` · `/v1/models` · `/v1/sessions*` ·
> `/v1/tools*` · `/v1/mcp/*` · `/v1/auth/status` · `/health` · `/version` · `/`

| Surface | Implementation path | New/Modify | Contract |
|---------|--------------------|-----------|----------|
| | `src/main.py:LINE` | | |

## Gating (auth, rate limits)
> `src/auth.py` — which auth method the route assumes (cli / api_key / bedrock / vertex).
> `src/rate_limiter.py` — slowapi limits are PER-ROUTE-CLASS and env-tunable
> (`RATE_LIMIT_CHAT_PER_MINUTE` etc.); a new route inherits nothing, so state its bucket.

## Upstream divergence
> This repo is a live fork. For each file this job touches: does the change belong
> upstream instead? Record the answer — silent divergence taxes every future
> `git pull upstream main`.

---

## Sub-issues (this stack's technical work, grouped by issue)

<!-- Personal-only. Each rolls its status UP to its parent issue. No board title. -->

```yaml
---
kind: sub-issue
id: cc-api-1
parent: i1                  # the board issue this builds
stack: cc-api
status: todo                # rolls up to the issue
depends_on: []
estimate: M
---
```

### cc-api-1 — <short name>
<!-- Six slots — the loop-ready contract (conventions/writing-sub-issues.md). -->
1. **Intent:** why this sub-issue exists, one sentence — the loop's tiebreaker.
2. **Ground truth (recorded + re-run command):** real shapes from the running
   service (`curl …` / `tools/obs trace <id>`) — pasted here with the command.
   Pre-flight: the loop re-runs this and must reproduce it before writing a line.
3. **Delta:** target files (`path:LINE`) + the change. **Everything else frozen**
   (freeze check is path-scoped: `git status --short -- <delta paths>`, never repo-wide — WF-63).
4. **Oracle (executable, two-sided):**
   - positive: spec-test / characterization `features/<slug>/tests/cc-api/…`
     (run: `tools/ci cc-api --slug <slug>`);
     acceptance as commands + expected observations, states incl. (loading/error/empty)
   - negative: existing consumers' recorded shapes bit-stable; untouched paths unchanged
   - obs assertion: `tools/obs trace <id>` shows the flow with expected status
5. **Boundaries:** contract refs; additive/versioned only; budget: 10 loop iterations.
6. **Exit:** done-when = oracle green + freeze respected + `tools/ci cc-api` green ·
   ask-when = contract change needed / non-additive / frozen file / red pin / budget blown
   (see `conventions/autonomy.md`).
