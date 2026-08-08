# Brief — solution sheets (التصحيح النموذجي)

**Source:** https://github.com/abensoukehal/teacher-saas/issues/5

> **This is a starting claim, not a spec.** DISCOVERY's first duty is to try to falsify it
> against the real system. The last two jobs both found their brief wrong about something
> load-bearing — one grep each time.

Roadmap item 1 from [`docs/product-brief.md`](docs/product-brief.md). The brief calls it
*"same engine, near-zero extra build, more tedious by hand than the exam. Arguably MVP."*

## The problem

A teacher who has just generated and refined an exam still has to write the **correction**
by hand: a worked answer for every exercise, and the **grading scale** (السلّم) that says
how the marks break down inside each one. That is the part of the evening that survives
the exam being generated in minutes — and it is more mechanical than writing the exam,
which is exactly the shape of work worth automating.

Unlike the exam itself, there is no creative judgement in it: the answers are determined
by the exercises that already exist.

## Why it should be cheap

The product's unit of capability is a **Claude Code skill** (`.claude/skills/<name>/SKILL.md`),
not orchestration code. `be` already has two — `exam-subject` and `refine-exercise` — and
spawns the CLI through one wrapper. Adding a kind of generated material means writing a
SKILL.md, not new plumbing. If this job starts building a prompt pipeline in TypeScript, it
is scoped wrong.

The exam is already stored as a first-class entity with stable exercise ids (`ex1…exN`), so
a solution has something durable to attach to.

## What a teacher should get

1. A model answer per exercise, worked rather than just stated.
2. The grading scale: how the exercise's points break down across its steps. Points per
   exercise are already on the stored exam.
3. A printable correction sheet, separate from the exam sheet — the teacher prints the exam
   for students and keeps the correction.

## Open questions for DISCOVERY (do not assume answers)

- **Is the solution generated per exam, or per exercise?** Per-exercise mirrors
  `refine-exercise` and survives the core loop — refining an exercise must not leave a
  stale answer attached to it. That interaction is the product's centre, so this matters
  more than it looks.
- **What happens to a solution when its exercise is refined?** The exam now keeps every
  superseded version of an exercise; a correction that silently describes a version the
  teacher no longer has is worse than no correction.
- **Where does it live?** The exam subject is the billing and storage unit. A solution is
  presumably part of it — but the subject-open path is deliberately one cheap read, and
  history was kept out of the document for that reason.
- **How is a wrong answer detected?** Generation is a whole agent loop and can be wrong.
  A model answer that is subtly incorrect is worse for a teacher than none — they will
  hand it to a class. What is the honest failure mode, and can the teacher refine a
  solution the way they refine an exercise?
- **Does the grading scale need to sum to the exercise's points?** If so that is a
  checkable property, and checkable properties are what a skill's output can be judged on.

## Constraints (each invalidates a plausible design)

From `CLAUDE.md` → Hard constraints:

- **Arabic only, RTL throughout.** Every new string, every new state.
- **Maths renders via KaTeX**, and **LaTeX is never visible to a teacher** — not in an
  input, a placeholder, an error, or an export. A correction sheet is dense with maths and
  is the most likely place to leak raw LaTeX.
- **Inside the Algerian curriculum.** A correct-but-off-syllabus method is a defect.
- **Don't over-engineer.** The milestone is still two teacher friends reacting to a working
  product.

Plus what the last jobs established:

- `/api/generate` is frozen in request and response shape.
- `claude_auth` and `store_unavailable` are both 503 and mean opposite things — branch on
  `error.type`, never the status code.
- A generation costs ~$0.65 and takes ~128 s. **Record one and reuse it**; never call it
  inside a loop iteration.
- Black-box `be` suites take their lane from `CHAR_BE_URL` / `CHAR_BE_LOG`. Never hardcode
  a port, and never let a suite reach outside its own directory for a fixture — that breaks
  the moment it is promoted, and it has now happened three times.
- Where a behaviour can race or repeat, write the concurrency clause from the start. Two
  data-loss bugs shipped last job because every oracle exercised things sequentially.
