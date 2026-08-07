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

## Sub-issues (this stack's technical work)

<!-- Personal-only. Six slots each — conventions/writing-sub-issues.md. -->

```yaml
---
kind: sub-issue
id: be-1
parent: i1
stack: be
status: todo
depends_on: []
estimate: S
---
```

### be-1 — make a run visible while it runs

1. **Intent:** a 114-second request currently logs **one line, at the end**
   (SEED kit §4). The loop cannot verify what it cannot see, and neither can a
   teacher-facing progress UI reason about queueing. Make the run's lifecycle
   observable.

2. **Ground truth (recorded + re-run command):**
   ```
   $ tools/obs trace b792d6b9-1f17-4275-8579-52da9ebbf068
   [BE] {"level":"info","msg":"request","method":"POST","path":"/api/generate",
         "status":200,"ms":114461.8,"correlationId":"b792d6b9-…"}
   ```
   One line. Nothing between accept and complete. Re-run:
   `curl -s -X POST localhost:9100/api/generate -d @../recordings/refine1.request.json -H 'content-type: application/json'`
   then `tools/obs trace <the returned correlationId>`.

3. **Delta:** `teacher-be/src/claude/runner.ts` (spawn/queue/complete logging,
   stderr capture) · `teacher-be/src/app.ts` (pass `correlationId` into `runClaude`).
   **Everything else frozen.** Freeze check:
   `git status --short -- src/claude/runner.ts src/app.ts`

4. **Oracle (two-sided, executable):**
   - *positive:* one refine run emits, in order and all carrying the same
     `correlationId`: `claude.queued` (with depth) → `claude.spawn` (skill, pid) →
     `claude.exit` (code, ms, costUsd). Assert: `tools/obs trace <id>` shows ≥4 lines
     for one request, where it showed 1.
   - *positive:* CLI `stderr` on a **successful** run is captured and logged at
     `debug`/`warn` — the KaTeX glyph warning (R1) currently vanishes.
   - *negative:* the response body is unchanged — `recordings/refine1.json`'s shape
     still reproduces (`id`/`points`/`label` preserved); no new fields, no timing change
     beyond noise.
   - *obs assertion:* `tools/obs logs be` shows the lifecycle for a live run.

5. **Boundaries:** logging only — no behaviour change, no new dependency, no
   response-shape change. JSON-on-stdout convention (one object per line). Budget: 6 iterations.

6. **Exit:** done-when = oracle green + freeze respected · ask-when = a lifecycle
   hook would require changing spawn semantics, or the response shape must change.

```yaml
---
kind: sub-issue
id: be-2
parent: i1
stack: be
status: todo
depends_on: []
estimate: S
---
```

### be-2 — stop Arabic leaking into math spans (R1)

1. **Intent:** the generator emits `\text{و}` inside math. KaTeX **parses it without
   error** but has no glyph metrics for Arabic, so it renders as a missing glyph —
   correct LaTeX, wrong output, no exception. Silent corruption of the product's
   only visual output.

2. **Ground truth (recorded + re-run command):**
   `../recordings/gen3-curriculum-gap.json`, exercise `ex1`:
   ```
   $u_0 = 1 \quad \text{و} \quad u_{n+1} = \dfrac{1}{2}\,u_n + 3$
   ```
   Re-run the detector:
   ```
   node -e '...katex.renderToString(span,{throwOnError:true})...'   # see SEED kit §7
   # → "No character metrics for 'و' in style 'Main-Regular'"  (warning, exit 0)
   ```

3. **Delta:** `teacher-be/agent/.claude/skills/exam-subject/SKILL.md` ·
   `teacher-be/agent/.claude/skills/refine-exercise/SKILL.md` ·
   `teacher-be/agent/CLAUDE.md` (the shared rule).
   **Everything else frozen.** Freeze check:
   `git status --short -- agent/`

4. **Oracle (two-sided, executable):**
   - *positive:* a rule stating Arabic must never appear inside `$…$`/`$$…$$` —
     including inside `\text{}` — and that the span must be split, with the Arabic
     as prose between two math spans (`$u_0 = 1$ و $u_{n+1} = …$`).
   - *positive:* re-running `../recordings/gen3.request.json` produces **zero**
     Arabic characters inside any math span. Detector: the SEED kit §7 script,
     extended to fail on `[؀-ۿ]` inside a span.
   - *negative:* every other §2 invariant still holds on that run — ids `ex1…exN`,
     Σ points == `totalPoints`, Arabic-only outside math, and the
     `الحسابيات` refusal still recorded in `meta.assumptions`.
   - *negative:* KaTeX still parses 100% of spans.

5. **Boundaries:** skill/context prose only — no TypeScript. Additive rule; do not
   restructure the skills. Budget: 8 iterations (this is prompt work; it may take
   more than one wording).

6. **Exit:** done-when = a fresh run of `gen3.request.json` has 0 Arabic-in-math and
   all negative pins hold · ask-when = the rule cannot be satisfied without
   changing the output schema, or 8 iterations pass without a clean run.

```yaml
---
kind: sub-issue
id: be-3
parent: i1
stack: be
status: todo
depends_on: [be-1]
estimate: S
---
```

### be-3 — record what each run cost and how long it took

1. **Intent:** `costUsd` and `durationMs` are returned per call and then discarded
   (SEED kit §5). The teacher test (brief §6) is supposed to answer "how many
   refines per exam" and what a teacher's usage actually looks like — impossible
   if nothing accumulates. Cheap now, unrecoverable later.

2. **Ground truth (recorded + re-run command):** `runner.ts:99` returns
   `{text, data, sessionId, costUsd, durationMs}`; nothing writes them anywhere.
   `grep -rn "costUsd" src/` → only `runner.ts` and `app.ts`'s response.

3. **Delta:** `teacher-be/src/claude/runner.ts` or a new `src/runlog.ts` (append
   one JSON line per run) · `teacher-be/src/config.ts` (path + enable flag).
   **Everything else frozen.** Freeze check:
   `git status --short -- src/`

4. **Oracle (two-sided, executable):**
   - *positive:* after one draft and one refine, the run log contains two lines,
     each with `ts`, `skill`, `correlationId`, `durationMs`, `costUsd`, and for a
     draft `exerciseCount`. Assert by reading the file.
   - *positive:* the log is append-only and survives a restart.
   - *negative:* response shape unchanged; a write failure must **not** fail the
     request (log-and-continue).
   - *obs assertion:* the `correlationId` in the run log matches the one in
     `tools/obs trace` for the same request.

5. **Boundaries:** a local file (JSONL). **No datastore** — persistence is out of
   scope for this job (SEED). No PII: never log the prompt, the teacher's note, or
   generated statements. Budget: 6 iterations.

6. **Exit:** done-when = oracle green · ask-when = anything suggests a real database.
