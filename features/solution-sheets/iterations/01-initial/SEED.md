# SEED — solution sheets (التصحيح النموذجي)

> **Phase:** DISCOVERY. **Input:** `00-brief.md`. **Output:** this file.
> **Status: LOCKED** 2026-08-08. Both open forks decided by the user (see Solution direction).

## Anchor
- **Job kind:** feature
- **Upstream:** https://github.com/abensoukehal/teacher-saas/issues/5

## Problem (enriched)

A teacher generates an exam in minutes and then still writes the **correction** by hand: a
worked answer per exercise and the **grading scale** (السلّم) saying how the marks break
down inside it. That is the part of the evening the product has not touched, and it is more
mechanical than writing the exam — there is no creative judgement in it, because the
answers are determined by exercises that already exist.

It is also the roadmap's #1 (`docs/product-brief.md`), described as *"same engine,
near-zero extra build, arguably MVP."* The engine claim survives investigation (H1); the
"near-zero" one needs qualifying, because the cost model makes the *granularity* of
generation the whole design question (H5).

## Current reality — the planning kit

### 1 · Acting-surface map

| Stack | Path | Role | Change |
|---|---|---|---|
| be | `teacher-be/agent/.claude/skills/` | **the real catalogue** — two skills today | **new**: a third |
| be | `teacher-be/src/claude/skills.ts:19` | reads `config.claude.cwd + /.claude/skills` — catalogue is a directory listing | read-only |
| be | `teacher-be/src/app.ts` `/api/generate` | validates the skill name against the catalogue **before** spawning | read-only (**frozen**) |
| be | `teacher-be/src/config.ts:39` | `CLAUDE_WORKSPACE ?? <repo>/agent` | read-only |
| be | `teacher-be/agent/curriculum/3as-mathematiques.md` | the on-syllabus reference, read on demand | read-only |
| be | `teacher-be/src/store/` (new) | where a solution is stored | new |
| be | `teacher-be/src/routes/subjects.ts` | the surface a solution hangs off | modify |
| fe | `teacher-fe/src/components/ExamView.tsx:13` | already has a `printable` mode | modify |
| fe | `teacher-fe/src/App.tsx:482` | `window.print()` — the whole print path | modify |

### 2 · Baseline recordings

Captured 2026-08-08, lane slot 4 (`be` :9400, `fe` :10400).

| Surface | Re-run | Recorded |
|---|---|---|
| `GET /api/skills` | `curl -s localhost:9400/api/skills` | exactly **two**: `exam-subject`, `refine-exercise` — read from the directory, so a new SKILL.md self-advertises |
| `POST /api/generate` unknown skill | `curl -sX POST … -d '{"skill":"solution-sheet",…}'` | `400 {"type":"invalid_request","message":"unknown skill \"solution-sheet\""}` — rejected before the CLI is spawned |
| the exercise shape a solution must answer | `python3 -c` over `tests/be/persistence-gaps/fixtures/rec-exam-subject.2026-08-07.json` | keys `id,label,points,difficulty,topics,statement`; points `ex1:6 ex2:6 ex3:8` = `meta.totalPoints:20`; `statement` is Arabic markdown, maths in `$…$` |
| measured generation cost | `grep costUsd run-log.jsonl` | `exam-subject` **$0.6454 / 128 s**, twice, identical |
| per-invocation overhead | `agent/CLAUDE.md` → Cost discipline | **~$0.20 before any work happens**; a refine is ~$0.31 total |

### 3 · Perimeter consumers

| Consumer | Surface | Note |
|---|---|---|
| `fe` exam sheet + print | `subject.exercises[]` | must render identically; a solution is a *second* sheet, never mixed in |
| promoted regression net | `tests/{be,fe}/**` | 109 be + 144 fe, green — the subject read path is pinned |
| `skills.ts` catalogue | the skills directory | adding a directory changes `/api/skills` output; that response is pinned by the promoted net |

### 4 · End-to-end trace

```
fe controls → POST /api/generate {skill:"exam-subject"} → claude (agent/ as cwd, 128s, $0.645)
   → exercises[] with ex1..exN and points summing to meta.totalPoints
   → POST /api/subjects  (stored; genCorrelationId records the run)
   → refine one exercise → PUT …/exercises/exN  (rev++, old version archived)
```
A solution attaches at the end of that chain — and the **refine step is what makes it hard**:
the exercise a solution answers can change after the solution exists.

### 5 · Observability baseline

- **Visible:** `run-log.jsonl` run lines carry `skill`, `costUsd`, `durationMs`, `ok`; subject
  link lines carry `{op, subjectId, correlationId}`; `/health` reports CLI + store.
- **Blind spot this job must not create:** if a solution can be stale, staleness must be
  *visible* — an out-of-date correction handed to a class is worse than none.

### 6 · Unknowns ledger

| Unknown | Disposition |
|---|---|
| Do skills live at the repo root? | **resolved — NO.** `agent/.claude/skills/`. Brief and `project/CLAUDE.md` both wrong (H1). |
| Is any of it already built? | **resolved — none.** No match for correction/solution/تصحيح/السلّم in either stack. |
| Does the exercise carry points? | **resolved — yes**, and they sum to `meta.totalPoints`. A checkable property. |
| Generation granularity | **resolved (user, 2026-08-08)** — one run for the whole exam, stored per exercise |
| What happens to a solution when its exercise is refined? | **resolved (user, 2026-08-08)** — marked stale and shown as stale; the teacher regenerates that one exercise on demand |
| Should cost be metered? | **resolved (user, 2026-08-08)** — recorded, never metered. The solution run carries its own `genCorrelationId` so cost-per-exam stays answerable; no credits, no limits, no gating. |
| Can a teacher refine a *solution* in plain Arabic? | **parked** — out of scope for this iteration unless the fork says otherwise |
| Is a generated answer *correct*? | **accepted risk.** A model answer is a whole agent loop's output and can be subtly wrong. Mitigation is checkable properties (below) + the teacher reading it, never a claim of correctness. |

### 7 · Sweep statement

- **Swept:** the agent workspace (`agent/CLAUDE.md`, both SKILL.md files, the curriculum
  file and its provenance caveats), `skills.ts`, `config.ts`, `/api/generate`'s validation
  path, the stored exam shape, the run log's cost lines, `ExamView`'s printable mode.
- **Not swept:** the print CSS (`App.css` — no Delta touched it last job and it is unstyled
  for new surfaces); `fe` component tree below `ExamView`; anything about deploying.

## Solution direction (product-level)

**A solution is generated for the WHOLE exam in one run, but STORED per exercise, and
carries the identity of the exercise version it answers.**

Three facts force this shape:

1. **Per-invocation overhead is ~$0.20 before any work** (`agent/CLAUDE.md`). Generating
   per-exercise means N separate runs — for a 3-exercise exam that is ~$0.60 of pure
   overhead before a single answer is written. One run amortises it.
2. **Refining is the product's central act**, and it changes exactly one exercise. If the
   solution were one blob per exam, refining `ex2` would invalidate the whole correction —
   the same mistake the `exam-subject` skill already avoided by emitting `exercises[]`
   rather than one block of exam text.
3. **A stale correction is worse than none.** A teacher hands it to a class. So each stored
   solution records *which version of the exercise it answers*, and a mismatch is shown as
   stale rather than silently served.

**Checkable properties** (what the skill's output is judged on, since "is it correct" is not
mechanically decidable):
- the grading scale's parts **sum to that exercise's `points`**
- one solution per `id` present in the exam, and **no `id` invented**
- Arabic only; maths in `$…$`; no LaTeX visible to the teacher
- every step is a *worked* answer, not a bare final result

**Storage:** a separate collection, keyed by `subjectId + exerciseId` — the subject-open
path stays one cheap read, exactly as `exercise_revisions` did.

**Print:** a second printable sheet, separate from the exam. The teacher prints the exam for
students and keeps the correction.

### Alternatives, with why-nots

- *One solution blob per exam* — cheapest to generate, but one refine invalidates the whole
  thing, and the product's most repeated action is a refine.
- *Per-exercise generation from the start* — survives refines perfectly but pays the ~$0.20
  overhead N times on first generation. Kept as the **regeneration** path: when one exercise
  goes stale, only that one is re-run.
- *Solutions embedded in the subject document* — rejected for the reason history was:
  the subject-open path must stay one cheap read.

## Scope & boundaries

**Staleness, as decided:** refining an exercise marks its solution **stale** — it is neither
deleted nor silently served. The UI says so, and the teacher regenerates just that exercise.
Auto-regenerating was rejected: refining is exploratory, and a teacher may refine five times
before settling, so it would charge a generation on the product's most repeated action.
Dropping the solution was rejected as the silent-loss class the last two jobs existed to end.

**Cost, as decided:** recorded, never metered. The solution's own run id is stored so
cost-per-exam stays answerable through the join built last job. No limits and no gating —
the brief is explicit that iteration must not be metered, and pricing is not a decision to
make inside a feature job.

- **In:** a `solution-sheet` skill in the agent workspace; storage keyed per exercise with
  version identity; a route to generate and to read; staleness surfaced in the UI; a
  printable correction sheet; regeneration of a single stale solution.
- **Out:** refining a solution by plain-Arabic instruction (parked); solutions for anything
  but a stored exam; any claim that a generated answer is verified correct.
- **Stacks:** `be` · `fe`.

## Risks

- **A subtly wrong model answer reaches a class.** The honest posture is that the teacher is
  the reviewer; the product must never present the correction as checked. Checkable
  properties catch shape errors, not mathematics.
- **Cost doubles per exam.** A correction is a second paid generation (~$0.65 order). The
  billing model is still undecided (`docs/product-brief.md` §4) and this makes the unit
  economics of "one credit = one finished subject" materially worse. **Flagged, not solved.**
- **The curriculum file is explicitly not the official programme** (its own provenance
  section says so). A solution's method must stay classic; "correct but off-syllabus" is a
  defect.
- `/api/generate` stays frozen; `/api/skills` output changes only by gaining an entry.

## Investigation journal

- **H1 — "the unit of capability is a `SKILL.md` under `.claude/skills/`."**
  → test: `ls stacks/teacher-be/.claude/skills/`, then `find . -name SKILL.md`.
  → result: **the path is wrong.** That directory does not exist; the skills are at
  `teacher-be/agent/.claude/skills/{exam-subject,refine-exercise}/SKILL.md`, because
  `config.ts:39` points the CLI at `<repo>/agent` and `skills.ts:19` reads
  `config.claude.cwd + /.claude/skills`. **`project/CLAUDE.md` states the wrong path in two
  places** (the `be` path table and the architecture diagram) — a doc fix this job owes.
  → belief: **refined.** The engine claim holds; the location in the brief does not.

- **H2 — is any of it already built?**
  → test: grep both stacks for correction/solution/تصحيح/السلّم/grading.
  → result: nothing. → belief: killed; no scope retires.

- **H3 — can a solution attach to what is stored?**
  → test: read the recorded exam's exercise keys and points.
  → result: `id,label,points,difficulty,topics,statement`; points `6+6+8 = 20 = meta.totalPoints`.
  → belief: **kept** — and it hands the job a *checkable* property for the grading scale.

- **H4 — does a new skill need wiring?**
  → test: read `skills.ts`; POST an unknown skill.
  → result: the catalogue is a **directory listing**, so a new SKILL.md advertises itself on
  `/api/skills` with no code change; and an unknown name is rejected with `400` before the
  CLI is spawned, so nothing can be invoked by accident.
  → belief: **kept** — "near-zero extra build" is true *for the capability*. The build is in
  storage, staleness and print, not in orchestration.

- **H5 — what does a correction actually cost?**
  → test: `agent/CLAUDE.md` → Cost discipline; the run log's real lines.
  → result: **~$0.20 overhead per invocation before any work**, and `exam-subject` measured
  at **$0.6454 / 128 s** twice. → belief: **this is the decisive fact.** It rules out naive
  per-exercise generation for the first pass and makes granularity the design question
  rather than a detail. It also doubles the cost of a finished exam, which the pricing
  model has not accounted for.

## Ready-for-PLANNING
- [x] brief tested, not assumed (H1 falsified its structural claim)
- [x] direction agreed and **locked** (user, 2026-08-08)
- [x] acting-surface map · recordings · consumers · trace · obs · sweep
