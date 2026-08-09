# SEED — parallel-exercises

> **STATUS: the brief's central projection is FALSIFIED, and the job is re-scoped on that
> evidence.** Fan-out does not make an exam faster. It makes the *first exercise* arrive
> sooner and makes failure cheaper to repair. **Decision (2026-08-09): ship those two, drop
> the speed claim** — option (a) in §5. Total generation time is explicitly NOT a goal of
> this job, and no oracle may assert one.

## 1 · What the brief claimed, and what the prototype measured

The brief projected a 3-exercise composition dropping from ~110 s to **55–60 s** by
planning cheaply and generating exercises in parallel. Two throwaway skills were written to
test exactly that — `exam-plan` and `exercise-one`, both in the job worktree at
`stacks/teacher-be/agent/.claude/skills/` — and driven straight off the CLI.

**Result, same controls both ways (3 exercises · 120 min · composition · علوم تجريبية):**

| | total time | time to FIRST exercise | output tokens |
|---|---|---|---|
| monolith `exam-subject` (today) | **109.7 s** | 109.7 s | 9,035 |
| `exam-plan` + parallel `exercise-one` ×3 | **~114 s** | **~74 s** | 15,492 |

**Fan-out is not faster. It is marginally slower, and burns 71% more tokens.**

Per-run detail:

```
PLAN          25.8s   1,384 tok   1 turn   points [5,7,8]=20   workload [30,40,50]=120
  ex1 (5pt سهل)    43.4s   3,376 tok   ← landed at 48s into the fan-out
  ex2 (7pt متوسط)  56.8s   4,240 tok
  ex3 (8pt صعب)    83.2s   6,492 tok   ← the critical path
fan-out wall clock = 83–88s (bounded by ex3)   total = 25.8 + 88 ≈ 114s
```

## 2 · Why it fails — and it is structural, not bad luck

**A fan-out costs `max(exercise)`, not `mean(exercise)` — and the plan deliberately makes
one exercise the biggest.** `exam-plan`'s own progressive-difficulty rule assigns the last
exercise the most points and the hardest ground (here 8 pts / صعب / a full function study,
6,492 tokens). So the slowest task is on the critical path **by design**, and it alone cost
83 s — 76% of the monolith's entire runtime.

Add the plan's 25.8 s, which is **pure serial latency ahead of everything** (nothing can
start before assignments exist), and the arithmetic closes: 25.8 + 83.2 ≈ 109 s ≈ the
monolith. The parallelism is real; there is simply nothing left to win once one exercise
must be generated in full and a plan must precede it.

The brief's error was assuming per-exercise cost would fall proportionally. It does fall —
3,376 / 4,240 / 6,492 against the monolith's 6,606-token *floor for a single exercise*, so
the lean skill genuinely works — but the hardest exercise stays expensive because the
mathematics in it is expensive, and that is the one that sets the clock.

## 3 · What the prototype did prove

**Time-to-first-content improves by ~33%** — 74 s vs 109.7 s. The teacher sees a real,
finished, correct exercise while the rest are still being written. That is the half of the
brief that survived, and it is the half the request actually described ("first come, first
displayed").

**Failure becomes cheap and targeted.** One of the three exercises came back **truncated** —
906 chars, one unbalanced brace, and the CLI still reported `subtype: success`,
`is_error: false`. Under the monolith that is a dead 110 s exam and `data: null`. Under
fan-out it is one dead exercise, retryable in ~45 s, with the other two already on screen.
Given this is the second sighting of the truncation mode (once in 50 concurrent generations,
once in 3 lean ones), cheap targeted retry may be worth more than the latency.

**`exam-plan` is sound.** Points summed to exactly 20, workload to exactly 120, difficulty
was progressive, and the three assignments covered distinct ground with populated `avoid`
lists. The coherence risk the brief worried about did not materialise in this run.

## 4 · Negative results — do not re-litigate without new evidence

**Smaller models are not the lever. Tested twice, failed twice.**

| step | opus | sonnet | haiku |
|---|---|---|---|
| generate exam | 87.2 s / 6,219 tok / valid | 82.0 s / 7,733 tok / **invalid JSON** | — |
| plan | 25.8 s / 1,384 tok / **valid** | 27.4 s / 2,000 tok / **invalid JSON** | 23.7 s / 2,280 tok / **invalid JSON** |

Smaller models were **not meaningfully faster**, emitted **more** tokens, and **broke the
JSON-only contract every time** — including on the plan step, which is scheduling rather
than mathematics and was the most favourable case available. Throughput is ~76–84 tok/s
regardless of model, so wall clock tracks output volume, and the smaller models talk more.

**There is no wrapper overhead to reclaim.** 94% of wall clock is `duration_api_ms`, in 3
turns. Spawn cost, tool round trips and config loading are all noise.

## 5 · The scope decision this SEED is blocked on

The brief asked for a speed job. The evidence says there is no speed to be had this way.
Three honest options:

- **(a) Re-scope to progressive rendering + targeted retry.** Keep fan-out, drop the
  "faster" claim. Ship time-to-first-exercise 74 s vs 110 s, per-exercise retry, and
  per-exercise corrections streaming the same way. Total time unchanged.
- **(b) Re-scope to perceived latency only, no fan-out.** Stream the monolith's exercises
  as they are produced. Smaller change, no concurrency multiplication — but the CLI is
  invoked with `--output-format json`, not `stream-json`, so this needs verification that
  partial exercises are even observable mid-run. **Not yet investigated.**
- **(c) Retire the job.** Total generation time is what the 100 s bar measures, and nothing
  here moves it.

**DECIDED: (a).** Keep the fan-out, ship progressive rendering and targeted retry, and state
plainly that total time is unchanged. (b) was not chosen: streaming the monolith gives the
same first-paint win but keeps a whole exam hostage to one truncated response, and the
truncation mode has now been seen twice. Cheap targeted retry is the durable half of this
job, and it requires the fan-out.

**What "done" means here — the exit criteria:**

1. A teacher sees the first finished exercise at roughly 70–80 s, not 110 s, and each
   further exercise appears as it lands.
2. One exercise failing (truncated JSON, timeout, bad shape) costs that exercise only. The
   other exercises stay on screen, and the failed one is retryable on its own.
3. Corrections stream per exercise the same way — the `solutions` collection is already
   keyed per `exerciseId`, so this needs no data-model change.
4. Points still sum to 20 and exercise ids are still `ex1…exN` in order. The assembled exam
   is indistinguishable from a monolith exam to everything downstream.
5. **No claim, anywhere, that generation got faster.** It did not.

## 6 · Cost this decision must account for

Fan-out multiplies concurrent loops per teacher. One 3-exercise exam becomes 3 loops plus a
plan; nine concurrent teachers becomes ~27 loops, ≈10 GB at the measured 375 MB per loop.
`CLAUDE_MAX_CONCURRENT` is a flat global gate (default 3) — a single fan-out of 3 saturates
it alone, so this needs a per-exam fan-out budget *plus* a global cap, not a larger number.
Token usage also rises 71% per exam; that is a subscription rate question, not money.

## 7 · Open, not investigated

- Does `--output-format stream-json` expose exercises mid-generation? (decides option b)
- Is the truncation failure rate really ~1/3, or was this run unlucky? n=1 per mode; this
  needs a real repeat count before any retry budget is sized.
- Does the plan step hold up on `مواضيع مختلطة من البرنامج`, where it must spread across
  topics rather than within one? Only the single-topic case was exercised.
- `exam-subject` still instructs the model to read `curriculum/3as-mathematiques.md`, which
  **does not exist** — no `curriculum/` directory is present. No stored exam's
  `meta.assumptions` reports it missing, so generation has been running from memory against
  the "inside the official Algerian curriculum" hard constraint. Out of scope here, but it
  should not be inherited silently.

## 8 · Re-run commands

```
cd project-worktrees/parallel-exercises/stacks/teacher-be/agent
claude -p --output-format json --setting-sources project '/exam-plan {…}'
claude -p --output-format json --setting-sources project '/exercise-one {…}'
```
Captured 2026-08-09 on lane 0, job worktree at `feature/parallel-exercises`.
Raw runs: `scratchpad/{plan,plan-sonnet,plan-haiku,fan-ex1,fan-ex2,fan-ex3}.json`.

## 9 · Planning kit

PLANNING assembles from this without investigating. A gap here bounces back to DISCOVERY.

### 9.1 Acting-surface map — what this job may touch

| repo | path | role in this change |
|---|---|---|
| be | `agent/.claude/skills/exam-plan/SKILL.md` | NEW — the skeleton step (prototype exists, measured §1) |
| be | `agent/.claude/skills/exercise-one/SKILL.md` | NEW — one exercise from an assignment (prototype exists) |
| be | `src/claude/runner.ts` | the concurrency gate — a fan-out needs a per-exam budget, not a bigger global cap (§6) |
| be | `src/app.ts` | where a NEW progressive endpoint mounts. `/api/generate` is FROZEN — do not extend it |
| be | `src/store/subjects.ts` | how a partially-assembled exam persists. `create` is insert-only |
| be | `src/routes/subjects.ts` | per-exercise retry lands here or on the new endpoint — decide in PLANNING |
| fe | `src/lib/api.ts` | the only place `be` is called. `/api/generate` calls are byte-frozen (see its own comment at :235) |
| fe | `src/lib/exam.ts` | exam shape helpers |
| fe | `src/components/ExamView.tsx` | renders `exercises[]` — must tolerate a PARTIAL array |
| fe | `src/components/Progress.tsx` | the existing wait state; progressive arrival changes what it means |
| fe | `src/components/SolutionView.tsx` | corrections stream the same way (exit criterion 3) |
| fe | `src/App.tsx` | owns the generate→render flow |

**Frozen, do not modify:** `/api/generate` request/response, the `subjects` document shape,
exercise ids `ex1…exN`, `solutions`' unique `{subjectId, exerciseId}` index.

### 9.2 Baseline recordings — re-run commands in §8

| recording | value | file |
|---|---|---|
| monolith 3-exercise | 109.7 s · 9,035 tok · valid JSON | `scratchpad/run-ex3.json` |
| monolith 2-exercise | 87.2 s · 6,219 tok · 3 turns · 94% api | `scratchpad/one-run.json` |
| monolith 1-exercise | 86.5 s · 6,606 tok | `scratchpad/run-ex1.json` |
| plan (opus) | 25.8 s · 1,384 tok · points=20 workload=120 | `scratchpad/plan.json` |
| fan-out ×3 | 43.4 / 56.8 / 83.2 s · 3,376 / 4,240 / 6,492 tok | `scratchpad/fan-ex{1,2,3}.json` |
| **truncation failure** | ex1: 906 chars, unbalanced brace, `subtype: success` | `scratchpad/fan-ex1.json` |

Captured 2026-08-09, job worktree, lane 0. **Never call a real generation from a test** —
replay these.

### 9.3 Perimeter consumers

- `fe/src/lib/api.ts` is the sole caller of `be`; everything else in `fe` goes through it.
- The promoted regression net asserts today's whole-exam behaviour: `project/tests/be/`
  (224 clauses) and `project/tests/fe/` (242). A partial-exam render must not break the
  clauses that assert a complete one.
- `run-log.jsonl` gains one line per spawn. A fan-out of 3 writes 4 lines per exam where
  there was 1 — anything aggregating it (the admin KPIs join on `genCorrelationId`) will
  see a different shape. **This is a real perimeter break to design for.**
- `subjects.genCorrelationId` is a single value; a fan-out has N+1 correlation ids.

### 9.4 E2E trace (today, monolith)

`fe` Controls → `api.ts` POST `/api/generate` {skill:"exam-subject"} → `app.ts:129` →
`runner.ts` gate → `claude -p` (~110 s) → parse stdout → `recordRun` → response →
`fe` renders whole `exercises[]` → POST `/api/subjects` persists.

### 9.5 Obs baseline

`GET /health` reports `claude.{active,queued,max}` — the gate's live depth, which is how a
fan-out's effect on capacity is observed. `run-log.jsonl` carries per-run duration/cost.
Neither holds teacher content and neither may start to.

### 9.6 Dispositioned unknowns

| unknown | disposition |
|---|---|
| truncation rate | **MEASURED: 1/13 ≈ 8% unrecoverable** (2/13 raw-parse; see the §10.1 correction) |
| how `fe` receives progressive results (SSE vs poll) | **PLANNING decides** — both viable; `/api/generate` frozen means a new endpoint either way |
| partial-exam persistence timing | **PLANNING decides** — insert-only `create` forbids progressive upsert into one doc without a new mechanism |
| plan quality on `مواضيع مختلطة` | **PARKED** — single-topic only was exercised; not blocking, but no oracle may assume it |
| `curriculum/3as-mathematiques.md` missing | **PARKED, out of scope** (§7) — flag, do not deepen |
| `CLAUDE_MAX_CONCURRENT` default 3 vs fan-out | **IN SCOPE** — §6; a fan-out of 3 saturates the gate alone |

### 9.7 Sweep statement

Evidence covers: the monolith at 1/2/3 exercises, the plan step on three models, a 3-way
fan-out, and one truncation failure — all single-topic (`الدوال العددية والنهايات`),
`علوم تجريبية`, `3AS`, on lane 0, one machine, **n=1 per configuration**.

Not covered, so freeze boundaries must be tight and oracles must not assume: repeated runs
of anything (no variance data), mixed-topic exams, exercise counts above 3, any concurrency
above 1 exam at a time, and the interaction of fan-out with the `/api/generate` gate under
real multi-teacher load.


## 10 · Two findings from 10 repeat runs — both change the design

Ten `exercise-one` runs, rotating the three real assignments:

```
45.9s  46.7s  53.6s  55.6s  59.8s  69.9s  90.6s  100.3s  105.6s  121.8s
3,430  3,524  3,623  4,329  4,043  5,285  6,729   7,988   7,870    9,631 tok
                            ↑ MALFORMED (763 chars, truncated)
```

### 10.1 Unrecoverable output is ~8% — corrected during be-3

> **CORRECTION (be-3, 2026-08-09).** This section first read "1/10 malformed … 2/13 ≈ 15%".
> That **overcounted**, and the error was in the counting script, not the service: it used a
> bare `JSON.parse`, while `be` strips a ```json fence before parsing. `trunc-9.json` is
> wrapped in exactly such a fence — 763 chars, braces balanced **18/18** — so the service
> recovers it. Re-verified independently: `trunc-9` parses after stripping; `fan-ex1`
> (906 chars, braces **22/21**) is genuinely truncated and does not.

**Raw-parse failures: 2/13. Service-visible unrecoverable failures: 1/13 ≈ 8%.** Of the ten
repeat runs, **zero** were unrecoverable; the single unrecoverable case came from the
three-run fan-out.

For a 3-exercise fan-out, P(at least one exercise unrecoverable) = 1 − 0.92³ ≈ **22%**.
**Roughly one exam in five would arrive with a hole in it.** Per-exercise retry is therefore
not a nice-to-have in this design — it is what makes the design shippable at all, and it
must be automatic, not a button the teacher has to find.

Note what this also means for the monolith: the same failure kills the *entire* exam. The
current product has been running at this rate all along; fan-out does not introduce the
failure, it makes it survivable.

### 10.2 Latency variance is huge, and it makes fan-out WORSE than measured once

Same skill, same three assignments: **45.9 s to 121.8 s — a 2.7× spread**, tracking output
tokens (3,430 → 9,631) at the usual ~76–84 tok/s.

A fan-out's wall clock is `max` of N draws from that distribution, and **the max of N draws
grows with N**. The §1 measurement (83.2 s) was one sample of `max(3)`; from this spread the
expected `max(3)` is meaningfully higher — around 100 s — which would put the fan-out at
~126 s against the monolith's ~110 s.

**This strengthens §2 rather than changing the decision.** The job was already re-scoped off
speed; this says the speed story is not merely flat but probably negative, and the SEED's
exit criteria (§5) must never be read as implying otherwise. Time-to-FIRST-exercise is
unaffected — that is `min`, not `max`, and `min` of N draws *improves* with N. The first
exercise landing early is the one genuinely robust win here, and this data makes it more
robust, not less.

**Consequence for PLANNING:** an oracle may assert time-to-first-exercise. **No oracle may
assert total generation time**, in either direction — n=1 per configuration, and a 2.7×
spread means any single timing is noise.
