# teacher-saas — product context

> **This is the PRODUCT half of the command center.** It lives in the project repo, is
> versioned with the specs and the profile, and is loaded by the harness through
> `@project/CLAUDE.md` — so the harness clone itself stays product-agnostic and only ever
> refers to a product *through the `project/` folder*.
>
> The engine half — workspace map, tool index, phase pipeline — is the root `CLAUDE.md`
> at the harness clone root. What belongs here: architecture, repos, data model,
> deployments, integrations. See [`workflow/PROFILE.md`](../workflow/PROFILE.md) item 6.

**teacher-saas** is an AI exam-prep tool for **Algerian lycée BAC mathematics teachers**.
A teacher describes what they want, gets a full draft exam subject in seconds, then
drills into individual exercises and refines them in plain Arabic until it matches what
they'll actually hand their class. Then they print it.

The value sold is **time** — an evening's work compressed into minutes. Not more
material, not better pedagogy: the same exam the teacher would have written, faster.

Full reasoning — thesis, business model, roadmap, validation plan — is in
[`docs/product-brief.md`](docs/product-brief.md), which is the source of record. This
file is the condensed engineering-facing half; if the two disagree, the brief wins and
this file is stale.

> **Status: the core loop ships, and exams persist.** As of 2026-08-08 the stacks are
> `be` (Express + TypeScript, which also hosts the Claude Code CLI wrapper) and `fe`
> (React + Vite). The core loop is built (`core-loop`), and exam subjects are stored in
> MongoDB with per-teacher ownership (`persistence`). Sections still marked ★ PENDING are stubs on purpose — they
> get written from the real checkouts as work lands, not guessed ahead of it. See
> `workflow/PROFILE.md` → "Greenfield deltas" for how the phases behave until then.

## Hard constraints

These are not preferences. Each one invalidates a plausible-looking implementation, so
check a design against this table before building it.

| Constraint | What it rules out |
|---|---|
| **Arabic only, RTL throughout** | Any LTR-first layout, any English UI string, any component that breaks under `dir="rtl"`. Not a later i18n pass — it is the only locale. |
| **Math renders via KaTeX** | Non-negotiable for equations, fractions and arrays. Plain-text or image math is not acceptable output. |
| **LaTeX is fully hidden** | Teachers do not know what LaTeX is and must never see it. No LaTeX in an input, an editable field, an error message or an export. Refinement is natural-language only — "make the numbers smaller", never `\frac{}{}`. |
| **Inside the official Algerian curriculum** | Generation must stay on-syllabus. Not locked to exact textbook wording, but off-syllabus content is a correctness bug, not a style issue. |
| **Don't over-engineer** | Ship lean, test fast. The next milestone is two teacher friends reacting to a working core loop — not a platform. |

## The core loop

Everything in the MVP serves this, in order:

1. Structured controls — topic, difficulty, exercise count, duration
2. Optional free-text note, with topic-aware suggestion chips
3. Generate a full draft exam
4. **Drill into one exercise and refine it** — change the values, change *that* exercise's
   difficulty, or swap it for a different one on the same topic
5. Export to a printable sheet (print-to-PDF from a standalone printable page)

Step 4 is the product. Iterate-until-right is the behaviour everything else exists to
support — which is why metering it is a business-model landmine (see the brief §4) and
why latency and partial-result UX matter more here than anywhere else.

## Scope — what this is NOT

Deliberately excluded. Building any of these is scope error, not initiative:

- **Lesson plans, course content, lesson summaries** — teachers have the textbook and
  their own notes. Explicitly skipped.
- **Anything student-facing** — that is a separate e-learning project. Mixing them
  muddies both.
- **Slides and presentations** — most Algerian lycée classrooms have no projector.
- **Subjects other than mathematics** — math first; others later.

## Roadmap, ranked

Not the MVP, but the shape work should grow into — the ordering is deliberate and comes
from one strategic problem: **exam generation is low-frequency** (3–6 real exams per
trimester), which is a weak habit loop. Additions should raise usage frequency.

1. **Solution sheets** (التصحيح النموذجي) with the grading scale (السلّم) — same engine,
   near-zero extra build, more tedious by hand than the exam. Arguably MVP.
2. **Multiple versions of one exam** (نماذج متعددة) — same questions, different numbers,
   shuffled. Anti-cheating in crowded rooms. Cheap once exercise-level regeneration works.
3. **Weekly exercise series** (سلاسل التمارين) — needed *weekly*, not per trimester.
   **This is the fix for the frequency problem.** If only one thing is added, this.
4. **Devoirs vs compositions** as distinct formats — 1h narrow vs 2h trimestrial.
5. **Remediation sheets** (تمارين الدعم) — targeted easier exercises for a weak chapter.
6. **Personal exercise library** — searchable by chapter; real switching cost.

Later, large: OCR auto-correction of submitted student exams.

## The three git layers

One product, three repos, each versioned on its own — the convention this clone follows:

| layer | repo | lives at |
|---|---|---|
| harness (engine) | `abensoukehal/project-harness` | this clone root |
| project (management) | `abensoukehal/teacher-saas` | `project/` |
| stacks (code) | `abensoukehal/teacher-be` · `abensoukehal/teacher-fe` | `project/stacks/teacher-be/` · `project/stacks/teacher-fe/` |

The project repo holds the profile, `features/`, `stack-skeletons/` and `docs/`. It does
**not** hold product code; each service gets its own repo, cloned into
**`project/stacks/`** and registered in `repos.sh` with that prefix in its `dir` field
(`"be|stacks/teacher-be||main"`).

> Don't confuse the two similarly-named dirs: **`stacks/`** holds the repo CHECKOUTS,
> **`stack-skeletons/`** holds the per-repo sub-issue TEMPLATES. See
> [`workflow/PROFILE.md`](../workflow/PROFILE.md) item 5.

## Git rules — branches, accounts, commit/push

Three questions, one answer per layer. [`git.sh`](git.sh) is the binding version (it sits
in this repo, next to this file, so the two move together); this table is how to read it.

| | branches | GitHub account | commit | push |
|---|---|---|---|---|
| **project** (`project/`) | `main`, plus one `feature/<slug>` per job | `abensoukehal` (personal) | **without asking** | **without asking** |
| **stacks** (`project/<dir>/`) | mainline from [`repos.sh`](repos.sh) (`be`, `fe` → `main`), plus one `feature/<slug>` per job | `abensoukehal` (personal) | **without asking** | **without asking** |

The stack row is `stack:*` — one default covering every stack repo. Autonomous commit and
push are safe there because they only ever move a **job branch**: work never happens on a
mainline, and landing it still goes through a reviewed PR. A repo that must differ (a
different owner, a stricter gate) gets its own `stack:<key>` row.

Resolution is most-specific-first: an exact `stack:<key>` row wins, then `stack:*`, then
the engine defaults. Since `stack:*` is now present, **every** stack key inherits it —
including a repo cloned but not yet added to `repos.sh`. Fail-closed only remains for a
scope no row matches at all.

Read it back, never guess:

```bash
source tools/profile.sh && git_policy project   # scope | account | remote | mainline | commit | push
git_may stack:be push && echo "push freely" || echo "ask first"
```

What the table cannot relax:

- **PR and merge are gated on every layer**, whatever the push column says — that is
  `/open-pr` (feature → base) and `/merge-back` (feature → staging), and both ask first
  ([`git-branching.md`](../workflow/conventions/git-branching.md)).
- **No commits on a mainline or staging branch**, even where commit is autonomous. Work
  happens on `feature/*` · `bugfix/*` · `hotfix/*`, one branch per job per repo, named
  after the job slug.
- **A stack repo with no staging branch is skipped by `/merge-back`** — that is the empty
  integration field in `repos.sh`, which is where every branch fact for a stack repo lives.

Per-repo exceptions go in `git.sh` as a `stack:<key>` row (a repo under a different
account, or one that needs a stricter gate); `stack:*` covers the rest.

### The harness layer is not configured here

Its rules — `main`, commit and push without asking — are **engine**, in
`tools/git-lib.sh`, so every harness clone answers the same and `tools/harness push`/`pull`
keeps them aligned. That file states the *policy* only: the account and remote are derived
from each clone's own harness remote, so the engine never names an account or a product.
Read it with `git_policy harness`. One caveat recorded there: the harness's `push` means the
path-scoped `tools/harness push`, never a raw `git push` from the clone root — the root's
`harness` remote is the shared harness remote.

**This clone's root remote is named `harness`, not `origin`** (as is `~/workspace/lablabee`'s).
Both clones are clones of one repo, so both had the same `origin` URL — and the Claude Code
sidebar labels a project by its origin, which listed them both as "project-harness" with no
way to tell the products apart. With no `origin`, it falls back to the directory name.
`tools/harness` follows either name, so a clone that never renamed is unaffected.

## Architecture in one diagram

```
  fe · teacher-fe  :10000                    be · teacher-be  :9000
  ┌────────────────────────┐                 ┌──────────────────────────────────┐
  │ React 19 + TS (Vite)   │   /api/*        │ Express + TS (ESM)               │
  │ Arabic · RTL · KaTeX   │─── proxy ──────▶│  src/app.ts     routes           │
  │                        │  (relative,     │  src/config.ts  env, once        │
  │ controls → draft exam  │   same-origin)  │                                  │
  │ → refine one exercise  │                 │  src/claude/    ◀── the wrapper  │
  │ → reopen a saved exam  │                 │  src/store/     ◀── the subjects │
  │ → print                │                 │  src/routes/    ◀── subject API  │
  └────────────────────────┘                 └──────┬──────────────────┬────────┘
                                                    │                  │ mongodb
                                                    │                  ▼
                                                    │      ┌─────────────────────┐
                                                    │      │ teacher_saas        │
                                                    │      │  subjects — 1 coll. │
                                                    │      └─────────────────────┘
                                                    │ spawns, headless
                                                    │ claude -p --output-format json
                                                    ▼
                                      ┌─────────────────────────────┐
                                      │ claude  (Claude Code CLI)   │
                                      │  .claude/skills/<name>/     │
                                      │      SKILL.md  ◀── the      │
                                      │      capabilities           │
                                      └─────────────────────────────┘
```

Reading it: **there is no LLM provider SDK anywhere in this product, and no API key.**
Coursework is generated by running Claude Code as a subprocess, and the unit of
capability is a Claude Code **skill**. Adding a new kind of material — an exam, a
rubric, a revision sheet — means writing a `SKILL.md`, not writing orchestration code.

The consequence that shapes everything downstream: a generation is a **whole agent
loop**, not a completion. It takes minutes, it can queue, and it fails in ways a user
must distinguish (expired login vs. timeout vs. a bad run). That is why `be` classifies
failures instead of returning 500, and why `fe`'s loading and error states are
load-bearing rather than polish.

## Repos

One section per repo key in [`repos.sh`](repos.sh). Both are **single-branch** (`main`),
so their integration field in `repos.sh` is empty and `/merge-back` skips them.

### `be` — application tier + the Claude Code wrapper

| | |
|---|---|
| **repo** | `abensoukehal/teacher-be` (private) |
| **dir** | `project/stacks/teacher-be/` |
| **stack** | Express 4 · TypeScript 5 · ESM · Node 20+ · `tsx` in dev, `tsc` to build |
| **local** | base port `9000` (lanes 9000/9100/…); log stem `teacher-backend`; health `/health` |
| **deploy** | ★ PENDING |

**Two jobs at once.** It owns the product's API and data *and* the Claude Code CLI
wrapper that does the generating.

| path | owns |
|---|---|
| `src/index.ts` | process entry — listen + graceful shutdown |
| `src/app.ts` | the Express app: middleware, routes, error classification |
| `src/config.ts` | env parsed once into one typed object — the **only** place env is read |
| `src/claude/runner.ts` | spawns the CLI; concurrency gate, timeout, error mapping |
| `src/claude/skills.ts` | reads the skill catalogue; validates a requested skill |
| `src/store/client.ts` | the Mongo connection — lazy, single-flight, never caches a failure |
| `src/store/subjects.ts` | the `subjects` collection. **`create` inserts; there is no upsert** |
| `src/routes/subjects.ts` | the subject surfaces |
| `src/teacher.ts` | issues + resolves the opaque teacher id |
| `.claude/skills/<name>/SKILL.md` | **the capabilities themselves** |

**API surface.** `/health` (reports the CLI's version, whether it authenticates,
queue depth, **and the datastore**) · `/api` · `/api/skills` · `/api/generate` ·
`/api/teacher` · `/api/subjects` (create · list · get · replace one exercise).

**The two skills** (`.claude/skills/`) — the product's actual capabilities:

| skill | in | out |
|---|---|---|
| `exam-subject` | controls: topic, difficulty, exercise count, duration, stream | the whole exam — `exercises[]` with stable `ex1…exN` ids |
| `refine-exercise` | `{instruction, exercise, examContext}`, instruction in plain Arabic | **one** exercise, `id`/`points`/`label` unchanged |

`refine-exercise` is core-loop step 4. `exam-subject`'s per-exercise output shape
exists to make it possible — a skill emitting one blob of exam text would leave the
product's central interaction unbuildable. Both return JSON only; `/api/generate`
returns it as `data` (`null` when a run returns prose).

**What must not be undone here:**

1. **Skill names are validated against the catalogue** before spawning — the name is
   interpolated into the prompt as `/<name>`, so caller input must never reach the CLI
   unchecked.
2. **stdout is parsed before the exit code is checked.** The CLI emits its result JSON
   even on failure, with the real reason in `result`; reading the exit code first
   discards the only useful diagnostic and yields a bare "exited 1". This was found the
   first time a real run failed — the reason was an expired login, and the original code
   hid it.
3. **The concurrency cap stays.** Each run is a full agent loop that can spawn tools and
   subagents; unbounded fan-out exhausts the machine long before the API.
4. **`--setting-sources project`** pins the CLI to this repo's `.claude/`, so behaviour
   doesn't depend on the ambient config of whoever started the server.

**Failure classification:** `503 claude_auth` (a human must re-login — not retryable) ·
`503 claude_not_installed` · `504 claude_timeout` · `502 claude_exit` ·
**`503 store_unavailable` (datastore down — RETRYABLE)** · `500` for this service's own
bugs. Note that `claude_auth` and `store_unavailable` share a status and mean opposite
things: callers branch on `error.type`, never on the code.

### `fe` — the teacher-facing UI

| | |
|---|---|
| **repo** | `abensoukehal/teacher-fe` (private) |
| **dir** | `project/stacks/teacher-fe/` |
| **stack** | React 19 · TypeScript · Vite 8 · oxlint |
| **local** | base port `10000` (lanes 10000/10100/…); log stem `teacher-frontend`; health `/` |
| **deploy** | ★ PENDING |

Talks **only** to `be`; never reaches an LLM directly. `vite.config.ts` is adapted to the
harness lane model, and the three adaptations all guard the same failure — a job lane
silently talking to the main checkout:

- `PORT` and `BACKEND_API` come from the environment (`tools/dev` passes the lane's
  values); the literals in the config are standalone fallbacks only.
- `/api` is **proxied**, so app code fetches relative URLs and no absolute backend URL is
  ever compiled into a component.
- `strictPort: true` — Vite's default drift to `port+1` would land the dev server on the
  next lane's port. A refused boot is the better failure.

**Test gate.** `tools/ci <be|fe> --slug <slug>`, **run from the job worktree** — it
resolves both repos and runs jest/vitest. Its hardcoded third key `ai` has no repo here
and reports "repo not attached", which is harmless. Tests belong in
`features/<slug>/tests/<key>/`, never inside a repo tree (WF-53).

> Run it from the worktree **and** pass `--slug`. From the clone root, `tools/ci <key>`
> resolves to the *main* checkout and gates the promoted regression net
> (`project/tests/<key>`) instead of the job — and passes on zero tests. That is also
> why a fresh job's provision receipt reads `ci baseline: green` when the job in fact
> has no gate at all; see `features/<slug>/build.md` → "CI baseline".

## Ports and log stems (reserved)

This machine runs a second harness clone at `~/workspace/lablabee` that shares `/tmp` and
the infra layer, so teacher-saas claims a disjoint band up front — see
`services.sh` for the binding version.

| | lablabee (taken) | teacher-saas (reserved) |
|---|---|---|
| service base ports | 3000, 4000, 8008 | **9000, then +1000 per service** — `be` 9000, `fe` 10000 |
| `RUN_STEM` | `lablabee-run` | `teacher-run` |
| log stems | `lablabee-*`, `tapai-native` | `teacher-*` |
| local DB name | `lablabee` | `teacher_saas` |

Bases step by 1000 because a lane's port is `base + slot*100` — 1000 apart keeps ten
lanes collision-free. 5000 and 7000 are unusable on macOS (AirPlay squats both).

## Data model

**MongoDB, database `teacher_saas`, one collection: `subjects`.** Chosen because Mongo
already runs as declared shared infra on this machine and `services.sh` had already
reserved that db name — and because an exam subject *is* a JSON document, so the stored
shape and the wire shape are the same object with no mapping layer to drift.

```
subjects
  _id        ObjectId
  teacherId  string · 32 hex          ← the owner
  subject    { title, meta, exercises[] }   ← the generated payload, VERBATIM
  controls   object | null
  createdAt  Date
  updatedAt  Date

index: { teacherId: 1, updatedAt: -1 }      ← the only query the product makes
```

**The rules that shape it:**

- **`create` inserts. There is no upsert and no fixed key.** The defect this replaced
  was a single `localStorage` key, where a teacher's second exam destroyed their first.
  Insert-only makes that unrepresentable, not merely guarded.
- **There is no delete route.** Nothing generated is thrown away — that is what makes
  the exercise library (roadmap 6) cheap to add.
- **An exercise is replaced in place, by id.** An unknown id raises rather than
  appending. Exercise ids (`ex1…exN`) are the join key the whole core loop turns on.
- **Ownership is scoped inside the query.** Another teacher's subject returns the same
  not-found as one that never existed; existence is not probeable.
- **`subject` nests the payload verbatim** — never spread into columns.

**There is no `teachers` collection.** The id is generated, handed to the client, and
never written down; a well-formed unknown id is accepted and owns nothing. It is a
**bearer value** — whoever holds it reads that teacher's exams — and a deliberate
placeholder a real accounts layer can adopt without moving data. It must not silently
become the auth model.

**Not the datastore:** `run-log.jsonl` is an append-only file carrying run cost/duration
plus `{op, subjectId}` link lines. It holds no teacher content and must not start to.

### Still not persisted (the honest gaps)

| Gap | Consequence |
|---|---|
| **The teacher id itself** | Clearing site data orphans every exam — they exist server-side but nothing can find them again. Same reason there is no cross-device access. This is what the accounts job fixes. |
| **Exercise revision history** | `replaceExercise` overwrites in place, so earlier versions of a reworked exercise are gone. "Everything generated is worth keeping" is only half-honoured: subjects accumulate, revisions do not. |
| **Generation cost per subject** | `sessionId` and the run's `correlationId` are not tied to the stored subject, so cost-per-exam is still unanswerable. Revisions-per-exam *is* answerable. |
| **Failed saves** | Retry is offered in-session only; a failed save is not queued across a reload. |
| **Accounts, billing, credits** | Nothing. The store makes them possible; none is built. |
| **Backups / a deploy target** | Mongo is local-only. See Deployments. |

## Deployments

★ PENDING — no deploy targets yet. Greenfield convention: each repo starts single-branch
(`prod` only, empty integration field in `repos.sh`), which makes the staging axis
(`/merge-back`) skip it until a staging branch is added.

## Integrations

**Claude Code — as a subprocess, not an API.** The only integration today, and it is
deliberately not an HTTP provider integration: `be` spawns the `claude` binary
(`src/claude/runner.ts`). There is **no API key in this product** — the CLI carries its
own credentials, so auth is configured by running `claude` interactively and `/login`,
not by an env var. Tunables live in `project/stacks/teacher-be/.env` (gitignored;
`.env.example` documents them): `CLAUDE_BIN`, `CLAUDE_CWD`, `CLAUDE_TIMEOUT_MS`,
`CLAUDE_MAX_CONCURRENT`.

The operational consequence: **an expired CLI login takes generation down**, and no
config change fixes it — a human must re-authenticate. `GET /health` reports this
(`claude.ok`), and `/api/generate` returns `503 claude_auth` rather than a retryable
error, so it is visible rather than looking like a flaky backend.

★ PENDING — everything else (payments, mail, storage, teacher accounts) as it lands.
