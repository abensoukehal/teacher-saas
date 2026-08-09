> **This is a starting claim, not a spec.** DISCOVERY's first duty is to try to falsify it
> against the real system. Every previous job's brief was wrong about something
> load-bearing, and each time one command in the first ten minutes caught it.

Generation is slow, and the current shape makes it slower the bigger the exam. A 2-exercise
devoir takes ~73–87 s; a 3-exercise composition takes ~110–128 s and **never** meets the
100 s bar at any concurrency. Exam size, not load, is what decides whether the bar is met.

The proposal: stop generating one exam serially. Plan the skeleton cheaply, then generate
each exercise **in parallel**, and render each one as it lands rather than at the end. Same
for corrections.

## 1 · Where the time actually goes — measured, not assumed

One clean run of `exam-subject` (2 exercises, 60 min, devoir), captured straight off the CLI
with `--output-format json`:

| | |
|---|---|
| wall clock | 87.2 s |
| **`duration_api_ms`** | **81.8 s — 94%** |
| `num_turns` | **3** |
| output tokens | 6,219 |
| throughput | ~76 tok/s |

**There is no overhead to reclaim.** Not spawn cost, not tool round trips, not config
loading — 3 turns and 94% API time. Every "make the wrapper faster" idea is dead on
arrival. The time is the model producing tokens.

## 2 · Nine tokens in ten are reasoning, not exam

| exam | billed output | final JSON | reasoning share |
|---|---|---|---|
| 1 exercise | 6,606 tok | ~591 tok | **91%** |
| 3 exercises | 9,035 tok | ~945 tok | **90%** |

The skill tells the model to work each solution through before writing the question. That
reasoning **is** the correctness guarantee — it is not waste, and cutting it is not the
optimisation. But it is where the seconds are, and it is **independent per exercise**:
exercise 2's mathematics does not depend on exercise 1's.

## 3 · The trap in the obvious implementation

Output does **not** scale linearly with exercise count:

```
1 exercise  → 6,606 tokens      2 exercises → 6,219 tokens      3 exercises → 9,035 tokens
```

A single exercise costs nearly as much as three. `exam-subject` always reasons about the
whole envelope — topic spread, points summing to 20, fitting the duration — no matter how
many exercises it is asked for.

**So fanning out by calling `exam-subject` N times with `exerciseCount: 1` pays the envelope
cost N times and wins almost nothing.** The fan-out needs a *lean* per-exercise capability
that receives its assignment and reasons only about its own mathematics.

Timings above are `claude -p` runs from `stacks/teacher-be/agent`, 2026-08-08/09, on the
lane-0 checkout at `main`. Re-runnable; see §"open questions" for what was never measured.

## 4 · What was NOT measured — the number the whole design rests on

**Nobody has yet measured a lean single-exercise skill.** The projection is 35–45 s each,
giving ~55–60 s for a 3-exercise composition against 110 s today. That projection is
arithmetic on the tables above, **not an observation**, and it is the first thing DISCOVERY
must go get. If a lean exercise still costs ~6,000 reasoning tokens, the whole idea is worth
far less than it looks and this job should shrink to the streaming half.

## 5 · A negative result, already in hand

**Model choice is not the lever.** Same prompt on Sonnet 5: 82.0 s vs Opus 5's 87.2 s —
barely faster, because throughput is similar and it emitted *more* tokens (7,733). Worse, it
returned **invalid JSON**, tripping the `data: null` path — the same soft failure seen once
in 50 concurrent generations. Do not re-litigate model swaps without new evidence.

## Open questions for DISCOVERY — do not assume answers

- **What does a lean single-exercise generation actually cost?** §4. Everything else is
  downstream of this number.
- **Can a plan step keep the exam coherent?** Independent exercises can overlap, repeat a
  technique, or collectively miss the syllabus spread. The plan is what prevents it — is a
  cheap plan strong enough, and what does it cost?
- **Points must sum to 20.** Serial generation gets this for free. Fan-out has to be *told*,
  and a wrong sum is a defect a teacher sees immediately.
- **Is a new skill needed, or can `exam-subject` take an assignment?** Adding a directory
  under `agent/.claude/skills/` IS the registration — but `exam-subject`'s output shape is
  depended on by the store and the whole core loop.
- **What happens to the concurrency cap?** One exam becomes N loops. Nine teachers writing
  3-exercise compositions is 27 loops, ~10 GB at the measured 375 MB per loop.
  `CLAUDE_MAX_CONCURRENT` is a flat global gate (default 3) — a fan-out of 3 saturates it
  alone. Per-exam fan-out plus a global cap is a different gate, not a bigger number.
- **How does a partial exam persist?** `subjects.create` is insert-only and stores the
  payload verbatim. Does a half-arrived exam get written once at the end, or progressively?
  There is **no delete route**, so a discarded partial is not removable.
- **What does `fe` render while exercises are missing?** And what happens when one exercise
  of five fails while four succeed — is that an exam, or an error?

## Constraints

From `project/CLAUDE.md` → Hard constraints, all binding:

- **Arabic only, RTL throughout** — including every new loading and partial state.
- **LaTeX never visible**; maths via KaTeX.
- **Inside the official Algerian curriculum.** Note the skill instructs the model to read
  `curriculum/3as-mathematiques.md` **and that file does not exist** — no `curriculum/`
  directory is present, and no stored exam's `meta.assumptions` reports it missing. Whatever
  this job does, it must not deepen a dependency on a file that isn't there.
- **Don't over-engineer.** The milestone is still two teacher friends.

Plus what the last jobs established:

- `/api/generate` is frozen.
- A generation costs ~$0.54–0.76 notional and takes ~1.5–2 minutes. **Record one and replay
  it**; never call it in a test.
- `costUsd` is a usage signal, **not money** — subscription, not credit billing.
- Suites take their lane from `CHAR_BE_URL`/`CHAR_BE_LOG`, keep fixtures beside themselves,
  and **may not assume they run alone against the service** (WF-84).
- Where a behaviour can race or repeat, write the concurrency clause from the start. This
  job is *entirely* about concurrency, so that applies with unusual force.
