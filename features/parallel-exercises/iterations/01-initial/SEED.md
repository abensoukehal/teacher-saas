# SEED — parallel-exercises

> **STATUS: the brief's central projection is FALSIFIED.** Fan-out does not make an exam
> faster. It makes the *first exercise* arrive sooner and makes failure cheaper to repair.
> Those are real wins, but they are a different job from the one the brief proposed, so
> this SEED is **not sealed** pending a scope decision. See §5.

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

Recommendation: **(a)**, with (b) investigated first as a cheaper path to the same win.

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
