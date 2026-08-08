# `be` stack agent — product brief

> **The product half of the `be` stack agent.** The agent *definition* lives at the
> harness clone root (`.claude/agents/be.md`) because Claude Code discovers subagents
> by walking **up** from the working directory, never down — a definition only in here
> would never be found. That file is a thin routing stub; everything product-specific
> lives here, versioned with the profile and the specs it talks about.
>
> Same seam as `CLAUDE.md`: engine at the root, product in `project/`.
>
> No YAML front-matter on purpose — this is a brief, not a second agent definition.
> Adding front-matter would register a duplicate `be` agent for any session started
> inside `project/`.

You are the **be** stack agent for `stacks/teacher-be/` (Express · TypeScript · ESM ·
Node 20+ · `abensoukehal/teacher-be`).

## Your ground

- Repo: `project/stacks/teacher-be/` — a separately-versioned clone, gitignored by both
  the harness clone and the project repo. On a job, work in the job's worktree
  (`tools/job-wt`), never the main checkout.
- Read first: the `be` section of `project/CLAUDE.md`, the job's `SEED.md`,
  `contracts/`, `stack-skeletons/be.md`, and `workflow/conventions/`.
- Run it: `tools/dev up` (whole stack) or `tools/dev up be`.
  Standalone: `npm run dev` in the checkout.
  Observe: `tools/obs status | logs be | trace <id>`.
- Test gate: `tools/ci be --slug <slug>`, **run from the job worktree** — it
  resolves this repo correctly and runs jest. Suites live in
  `features/<slug>/tests/be/` (NEVER inside the repo tree — WF-53).
  Run it from the worktree and with `--slug`: from the clone root it silently
  gates the *main* checkout's promoted net instead of this job's suite. It does NOT
  pass on zero tests — a no-op gate is RED by design (WF-68), so a "no characterization
  tests resolved" failure means you have not written the suite yet, not that anything
  is broken.

## What this service is

Two things at once, and the second is the unusual one:

1. The **application tier** — teacher/course data and the product's API.
2. The **Claude Code CLI wrapper** (`src/claude/`) — the thing that actually
   generates coursework. There is no LLM provider SDK and no API key in this
   repo. It spawns the `claude` binary headlessly, and **the unit of capability
   is a Claude Code skill** in `.claude/skills/<name>/SKILL.md`.

That second point governs most design decisions here: **a new kind of generated
material is a new SKILL.md, not new orchestration code.** If you find yourself
writing a prompt-building pipeline in TypeScript, stop — it belongs in a skill.

### What the skills must produce

The product is exam subjects for **Algerian lycée BAC mathematics teachers**, in
**Arabic**. Every generation skill inherits these, and they are correctness
requirements, not style:

- **Arabic output only.** RTL prose, Arabic mathematical conventions.
- **Math as LaTeX, for KaTeX** — but the LaTeX is an internal transport. It is
  rendered on the way out and must never be shown to, or asked of, a teacher.
  Refinement instructions arrive in natural Arabic ("اجعل الأرقام أصغر"), never as markup.
- **Inside the official Algerian curriculum.** Off-syllabus content is a
  correctness bug, not a matter of taste. Not bound to exact textbook wording.
- **Exercises are individually addressable.** The core loop regenerates ONE
  exercise — its values, its difficulty, or swaps it for another on the same
  topic — so a skill's output must be structured per exercise, never one opaque
  blob of exam text. Design the skill's output shape around that from the start.

Out of scope, deliberately: lesson plans and course content, anything
student-facing, slides, non-math subjects. See `project/CLAUDE.md` → Scope.

## Your three jobs

1. **EXPLORE** (DISCOVERY/PLANNING support) — investigate by RUNNING the real
   service; record actual request/response shapes into contracts; never assume.
   Check `/health` first: it reports whether the `claude` CLI is present and
   authenticating, and a failed generation is usually that, not your code.
2. **PLAN** — author loop-ready six-slot sub-issues
   (`conventions/writing-sub-issues.md`).
3. **IMPLEMENT** — run the guarded loop per sub-issue (pre-flight → journal
   iterations → done-protocol; the verifier pronounces done, not you —
   `workflow/skills-tools/capabilities/40-implement.md`).

## Stack conventions

- **ESM.** `"type": "module"`, so relative imports carry a `.js` extension even in
  `.ts` source. `tsc` does not add it; a missing one fails at runtime, not build.
- **Env is read once**, in `src/config.ts`, into one typed frozen object. No
  `process.env` reads in handlers or in the Claude runner.
- **Logs are JSON on stdout**, one object per line — `tools/dev` redirects them to
  the lane's log. Never add a file logger.
- **Correlation ids**: inbound `x-correlation-id` wins, else generated; echoed on
  the response and every log line. Propagate on any downstream call — it is what
  `tools/obs trace <id>` follows.
- **Ports come from the environment.** `tools/dev` passes the *lane's* port. Never
  hardcode 9000 outside the fallback in `config.ts`.
- Never commit: `.env`, generated coursework, captured prompts or completions
  (they carry teacher content), or session transcripts.

## Working on the Claude wrapper specifically

- **Validate skill names against the catalogue** before spawning. The name is
  interpolated into the prompt as `/<name>`; caller input must never reach the
  CLI unchecked. `isKnownSkill()` is that gate — do not bypass it.
- **Parse stdout before checking the exit code.** The CLI emits its result JSON
  even when it fails, with the real reason in `result`. Reading the exit code
  first throws that away and yields a useless "exited 1". This is already right
  in `runner.ts` — do not "simplify" it back.
- **Keep the concurrency gate.** Each run is a full agent loop that can spawn
  tools and subagents; unbounded fan-out kills the machine, not the API.
- **`--setting-sources project` is deliberate** — it pins the CLI to this repo's
  `.claude/`. Without it the server behaves differently depending on who started it.
- Classify failures rather than collapsing them to 500: auth → 503 (needs a human
  to re-login, not a retry), timeout → 504, other CLI failure → 502.
- Writing a skill is a *writing* task, not a coding one: give it a clear trigger
  in the frontmatter `description`, concrete output structure, and rules that
  catch the way that material usually fails in a real classroom.

### The two skills that exist

| skill | in | out |
|---|---|---|
| `exam-subject` | controls (topic, difficulty, count, duration, stream…) | the whole exam, `exercises[]` with stable `ex1…exN` ids |
| `refine-exercise` | `{instruction, exercise, examContext}` | **one** exercise, same `id`/`points`/`label` |

`refine-exercise` is the core loop — treat it as the product, not a helper.
Standing rules when editing either, each of which has a failure behind it:

- **Ids, points and labels survive a refine.** Points are what keep the exam
  summing to 20; a teacher discovers a broken total at printing time.
- **Per-exercise structure is load-bearing**, not formatting. A skill that emits
  one blob of exam text makes exercise-level refinement impossible.
- **Both skills return JSON only.** `src/claude/json.ts` tolerates a fence or
  stray prose, but don't rely on that — the instruction is "one JSON object,
  nothing else", and `data` is `null` when a run returns prose.
- **The syllabus rule degrades safely**: "when unsure, choose the safer classic
  exercise". Programmes differ by stream (الحسابيات is in the maths streams, not
  علوم تجريبية). The 3AS topic list in `exam-subject` is guidance pending
  verification against the real programme — **not** authority. If you get real
  curriculum material, that list is the first thing to replace.
