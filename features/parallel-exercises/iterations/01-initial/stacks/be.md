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

### be-1 — promote the two skills into the catalogue

**status:** done · **tag:** happy-path

**Intent.** `exam-plan` and `exercise-one` exist as measured prototypes in
`agent/.claude/skills/`. Make them real catalogue entries: listed by `/api/skills`,
spawnable by name, and pinned so their contracts cannot silently drift. No orchestration
code — a skill IS the capability (`project/CLAUDE.md`, be section).

**Ground truth.** Both already run and were measured (SEED §1, §10):
```
cd stacks/teacher-be/agent
claude -p --output-format json --setting-sources project '/exam-plan {"stream":"علوم تجريبية","level":"3AS","topic":"الدوال العددية والنهايات","difficulty":"متوسط","exerciseCount":3,"durationMinutes":120,"format":"composition","totalPoints":20}'
```
→ 25.8 s, `points [5,7,8]=20`, `workload [30,40,50]=120`, 3 assignments with `avoid`.
Replay fixtures: `scratchpad/plan.json`, `scratchpad/fan-ex{1,2,3}.json`.

**Delta (freeze).** May touch: `agent/.claude/skills/exam-plan/`,
`agent/.claude/skills/exercise-one/`. **Frozen:** every existing skill —
`exam-subject`, `refine-exercise`, `solution-sheet` are untouched, and `exam-subject`
keeps working for the monolith path until fe-1 lands.

**Oracle.** `features/parallel-exercises/tests/be/skills-catalogue.characterization.test.js`
- `GET /api/skills` lists `exam-plan` and `exercise-one` (positive)
- both names pass skill validation; `exam-plan-x` and `../etc` are rejected `400
  invalid_request` (negative — the name is interpolated into the prompt as `/<name>`)
- the three pre-existing skills are still listed (regression)
**Never call a real generation from a test** — replay the recorded fixtures.

**Boundaries.** Budget 6 cycles. Do not change the runner, routes or store here.

**Exit protocol.** Oracle green ×2 · `/api/skills` diffed against its recording ·
journal sealed.

---

### be-2 — POST /api/exams: plan, insert the skeleton, fan out, fill in place

**status:** done · **tag:** happy-path

**Intent.** The core of the job. Plan once, insert the whole exam with `pending`
placeholders, then generate the exercises concurrently and fill each slot as it returns —
so `GET /api/subjects/:id` shows a growing exam. Per
`contracts/fe-be-progressive.contract.md` §0, §2.

**Ground truth.** Today one call blocks ~110 s and returns everything at once:
```
curl -s -X POST localhost:9000/api/generate -H 'content-type: application/json' \
  -d '{"skill":"exam-subject","input":{…3 exercises…}}'
```
→ 109.7 s, 9,035 tok, whole `exercises[]` (recording: `scratchpad/run-ex3.json`).

**Delta (freeze).** May touch: `src/app.ts` (mount only), a new `src/routes/exams.ts`,
`src/store/subjects.ts` (status field + fill path), `src/claude/runner.ts` (fan-out call
site only). **FROZEN: `/api/generate` request and response, byte for byte** — SEED §9.1,
and `fe/src/lib/api.ts:235` records that freeze on the other side. Also frozen: the
`subjects` document shape apart from `exercises[].status`, and the `{teacherId,updatedAt}`
index.

**Oracle.** `tests/be/progressive-generate.characterization.test.js`
- POST `/api/exams` returns after the plan with N exercises, **all** `status:"pending"`,
  `statement:""`, and `points` already summing to 20 (positive)
- `GET /api/subjects/:id` for that id returns the same skeleton, owner-scoped (positive)
- a second teacher's id gets the same not-found as a nonexistent exam (negative —
  existence is not probeable)
- no `x-teacher-id` → `401 teacher_required` (negative)
- **CONCURRENCY (write it now, not later):** N concurrent fills into ONE document all land;
  no exercise is lost and `rev` advances once per fill. This is the first path that races
  `replaceExercise`'s CAS deliberately — contract §5.5
- filling a placeholder writes **no** `exercise_revisions` row (contract §5.4)
- an exercise's `id`, `label`, `points` after filling equal the plan's (contract §5.2)
- **absent `status` on a pre-existing subject reads as `ready`, never `pending`**
  (contract §1 — the `roleOf` absent→admin class of bug)

**Boundaries.** Budget 12 cycles. Retry and the failure path are be-3, not here — this
sub-issue assumes every exercise returns valid. Do not touch `fe`.
**Stop and ask** if the fan-out cannot fill concurrently without relaxing the CAS.

**Exit protocol.** Oracle green ×2 · perimeter diff vs `run-ex3.json` recording ·
`/api/generate` byte-identical · freeze audit · mutation spot-check on the absent-status
default · journal sealed.

---

### be-3 — a malformed exercise fails alone, and retries itself

**status:** done · **tag:** hardening

**Intent.** Measured ~8% unrecoverable (SEED §10.1) — so a 3-exercise fan-out has a **~22%**
chance of a hole. Detect it, retry that exercise automatically, and if it still fails mark
it `failed` while the rest of the exam stands.

**Ground truth.** A real truncated capture is in hand — 906 chars, unbalanced brace, and
the CLI reported `subtype: success`, `is_error: false`:
`scratchpad/fan-ex1.json` (also `trunc-9.json`, 763 chars). **Exit code and `is_error` are
useless here** — validity must be decided by parsing and shape-checking the result.

**Delta (freeze).** May touch: the fan-out result handling in `src/routes/exams.ts`,
validation helpers. **Frozen:** the retry must not change `id`/`label`/`points`, must not
write a revision row for a failed fill, and must not turn a partial exam into an error
response (contract §3).

**Oracle.** `tests/be/exercise-failure.characterization.test.js`
- a replayed truncated result marks that exercise `failed`, `statement:""`, and the OTHER
  exercises stay `ready` (positive — the whole point)
- retry is attempted before `failed` is written, and a retry that succeeds yields `ready`
  (positive)
- the exam is **not** an error response when one exercise fails (negative — contract §3)
- `points` still sum to 20 with a `failed` exercise present (negative)
- a `failed` fill writes no `exercise_revisions` row (negative)

**Boundaries.** Budget 10 cycles. Retry count is bounded and stated; unbounded retry on a
~110 s loop is a resource bug. Do not re-call real generations in tests — replay.

**Exit protocol.** Oracle green ×2 · replay fixtures used, not live calls · journal sealed.

---

### be-4 — regenerate one exercise on demand

**status:** done · **tag:** hardening

**Intent.** `POST /api/subjects/:id/exercises/:exerciseId/regenerate` — the teacher-facing
half of be-3, for an exercise that failed or that they abandoned. Contract §2.

**Ground truth.** The sibling surface already exists and is the shape to match:
`PUT /api/subjects/:id/exercises/:exerciseId` (replace) — see `src/routes/subjects.ts`, and
its recorded behaviour in the promoted net `project/tests/be/persistence-gaps/`.

**Delta (freeze).** May touch: `src/routes/subjects.ts` (or exams.ts). **Frozen:** the
existing replace and revisions routes, and ownership scoping — the new route is scoped
inside the query exactly as its siblings, never by a post-hoc check.

**Oracle.** `tests/be/regenerate.characterization.test.js`
- regenerating a `failed` exercise fills the same slot, same `id`/`label`/`points` (positive)
- an unknown `exerciseId` → 404, and another teacher's subject → the same 404 (negative)
- regenerating a `ready` exercise DOES write an `exercise_revisions` row — that one IS a
  supersession of teacher-visible work (positive; contrast contract §5.4)
- two concurrent regenerates of the same exercise → one wins, the other `409 conflict`
  (negative — the existing CAS behaviour must not regress)

**Boundaries.** Budget 8 cycles.

**Exit protocol.** Oracle green ×2 · the `409` path exercised · journal sealed.

---

### be-5 — a fan-out gets a budget, not a bigger cap

**status:** done · **tag:** hardening

**Intent.** One exam now occupies N+1 loops. `CLAUDE_MAX_CONCURRENT` defaults to **3**, so a
single 3-exercise fan-out saturates the whole gate and starves every other teacher
(SEED §6). Give a fan-out a per-exam budget under the global cap.

**Ground truth.** `src/claude/runner.ts:72` — `if (active >= config.claude.maxConcurrent)`
queues. `GET /health` reports `claude.{active,queued,max}`; measured live at
`active: 20, queued: 0` during the capacity study, so the gate is observable.
Measured cost: ~375 MB resident per loop.

**Delta (freeze).** May touch: `src/claude/runner.ts`, `src/config.ts`. **Frozen:** the
global cap must still bound total loops — a per-exam budget is an ADDITIONAL bound, never a
replacement. `project/CLAUDE.md` records "the concurrency cap stays" as a must-not-undo.

**Oracle.** `tests/be/fanout-budget.characterization.test.js`
- one exam's fan-out never occupies more than its budget of concurrent loops (positive)
- with the gate saturated by one exam, a second teacher's request still makes progress
  rather than starving (positive — the actual reason this exists)
- total active never exceeds the global cap (negative)
- `/health` reports the budget alongside the cap, so an operator can see it (positive)

**Boundaries.** Budget 8 cycles. **Do not raise the default cap** — that is a separate,
evidence-backed decision the capacity study deliberately left to the user.

**Exit protocol.** Oracle green ×2 · `/health` shape diffed · journal sealed.

---

### be-6 — corrections fan out per exercise, and cannot be started twice

**status:** done · **tag:** hardening · **filed by:** QA (bugs A + B)

**Intent.** SEED §5 exit criterion 3 — "corrections stream per exercise the same way" — was
**silently dropped between the SEED and the contract**, which never specified a transport for
it. QA measured the consequence: one monolithic `solution-sheet` run, `solutions: []` on every
poll for 230 s, then all three at once. The criterion is not met.

Second defect, same surface (QA bug B): **solutions generation has no in-flight guard.** The
same exam in two tabs gives two enabled buttons and two full runs — QA drove `claude.active`
1→2 with 206 s and 233 s runs both completing. Data survives (last-writer-wins on an upsert),
but it is double quota for a result nobody sees. Refine has its `409`, regenerate has the
`writing` registry; **solutions is the one generation surface with neither.**

**Ground truth.** QA's ledger, `.../iterations/01-initial/qa.md`, cases for bugs A and B —
both with repro. Today: `POST /api/generate {skill:"solution-sheet"}` takes the whole exam and
bulk-upserts. Recording: `run-log.jsonl` shows a single spawn per correction request.

**Delta (freeze).** May touch: a new per-exercise solution path in `src/routes/`, the solutions
store, and `agent/.claude/skills/` (a lean per-exercise correction skill, mirroring how
`exercise-one` was split out of `exam-subject`). **Frozen:** `/api/generate` byte-for-byte —
`solution-sheet` keeps working and QA confirmed it consumes an assembled fan-out exam
correctly; the `solutions` collection's `{subjectId, exerciseId}` unique index and its
`answersHash` staleness derivation; the scale-sums-to-points rule.

**Oracle.** `tests/be/solutions-fanout.characterization.test.js`
- corrections arrive per exercise: after the first lands, `GET .../solutions` returns ONE
  while others are still generating (positive — the criterion, and what QA measured absent)
- each `scale` still sums exactly to that exercise's `points` (negative — the existing
  invariant must survive the split)
- **two concurrent solution requests for the same exam: one proceeds, the other is refused
  without spawning** (positive — bug B; assert `claude.active` never exceeds one for that
  exam, the same way be-5's clause asserts its budget)
- a correction for one exercise does not disturb another's (negative)
- `answersHash` still derives staleness per exercise, and a refine mid-generation still marks
  only that exercise's correction stale (negative — the ~145 s window is why this exists)
- **a blank/`failed` exercise is never sent for correction** (negative — fe-2 recorded this
  hazard: ~145 s spent writing a worked answer to nothing, then stored as current)

**Boundaries.** Budget 12 cycles. Reuse the `writing` registry pattern from be-3/be-4 rather
than inventing a second one. Do NOT change `/api/generate`. Never call a real generation from
a test — QA's recordings and the existing fixtures replay.

**Exit protocol.** Oracle green ×2 · the promoted `be` net green against the JOB checkout ·
`/api/generate` byte-identical · journal sealed.
