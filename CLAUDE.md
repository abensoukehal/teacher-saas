# teacher-saas — product context

> **This is the PRODUCT half of the command center.** It lives in the project repo, is
> versioned with the specs and the profile, and is loaded by the harness through
> `@project/CLAUDE.md` — so the harness clone itself stays product-agnostic and only ever
> refers to a product *through the `project/` folder*.
>
> The engine half — workspace map, tool index, phase pipeline — is the root `CLAUDE.md`
> at the harness clone root. What belongs here: architecture, repos, data model,
> deployments, integrations. See [`workflow/PROFILE.md`](../workflow/PROFILE.md) item 6.

**teacher-saas** is the **prep platform for Algerian lycée mathematics teachers** — it makes
the day-to-day easier and keeps the teacher on the official programme.

Grounded in the ministry's own التدرج السنوي, it knows what each class's stream teaches, in
what order, and where that class has actually reached, and produces what the teacher needs
next: the week's exercise series, a devoir, a trimester composition, the model correction.
They refine anything in plain Arabic, then print it.

**Two values, and the first is the pitch:**

- **Conformity to the official programme.** The right unit, the right level, within the ministry's stated limits, and never material the class has not been taught. This is the failure a teacher cannot afford — it is discovered in front of the class — and the one claim nothing else in their world makes.
- **Time.** An evening's work compressed into minutes, across the whole week's prep. Real, and second: speed is a convenience anyone can copy; being demonstrably on-programme is the moat.

> **Repositioned 2026-08-10** (brief §2, §6d–§6h). This file described an *exam generator*;
> exam generation is now one surface of a prep companion built on the programme. Also decided
> that day: the **course layer is in** (reversing the lesson-content exclusion below),
> **progress belongs to a class, not a teacher**, and **one generator serves four scopes**
> (course ⊂ week ⊂ unit ⊂ progress-to-date). See `docs/product-description.md` §5b for the
> domain model and the design-facing version.

Full reasoning — thesis, business model, roadmap, validation plan — is in
[`docs/product-brief.md`](docs/product-brief.md), which is the source of record. This
file is the condensed engineering-facing half; if the two disagree, the brief wins and
this file is stale.

> **Status: the core loop ships, exams persist, teachers have accounts, every exam can have
> its correction, and there is an operator's console.** As of
> 2026-08-08 the stacks are
> `be` (Express + TypeScript, which also hosts the Claude Code CLI wrapper) and `fe`
> (React + Vite). The core loop is built (`core-loop`), exam subjects are stored in
> MongoDB with per-teacher ownership (`persistence`), and a teacher now has a real
> account with a recovery code, keeps every superseded exercise, and can be told what an
> exam cost to produce (`persistence-gaps`). Roadmap item 1 — solution sheets with the grading
> scale — now ships (`solution-sheets`), and `accounts-hardening` added roles, an admin
> console with per-exam KPIs, and bounds on the auth surface. As of 2026-08-11
> (`classes-progress`, slice 1 of 7) **a teacher has classes and each class has its own
> position in the official programme** — the spine every later prep surface reads. Same day
> (`programme-surface`, slice 2 of 7) **that programme became visible**: one read route, a
> nav row, «هذا الأسبوع» and «البرنامج», and the first client of the per-week entries.
> Sections still marked ★ PENDING are stubs on purpose — they
> get written from the real checkouts as work lands, not guessed ahead of it. See
> `workflow/PROFILE.md` → "Greenfield deltas" for how the phases behave until then.

## Hard constraints

These are not preferences. Each one invalidates a plausible-looking implementation, so
check a design against this table before building it.

| Constraint | What it rules out |
|---|---|
| **Arabic only, RTL throughout** | Any LTR-first layout, any English UI string, any component that breaks under `dir="rtl"`. Not a later i18n pass — it is the only locale. **`fe` renders `be`'s `error.message` to the teacher**, so the constraint binds the backend's strings too. Every `message:` literal in `be/src` is Arabic today; what is still reachable in English is the five `POST /api/subjects` body-validation messages, `exercise "…" is not in this subject`, and everything forwarded through `err.message` from the Mongo driver or the Claude CLI — that last family needs mapping by `error.type`, not a string edit. `fe`'s `teacherMessage()` deny-list is the seam that stops the two known-foreign families. |
| **Math renders via KaTeX** | Non-negotiable for equations, fractions and arrays. Plain-text or image math is not acceptable output. |
| **LaTeX is fully hidden** | Teachers do not know what LaTeX is and must never see it. No LaTeX in an input, an editable field, an error message or an export. Refinement is natural-language only — "make the numbers smaller", never `\frac{}{}`. |
| **Inside the official Algerian curriculum** | Generation must stay on-syllabus. Not locked to exact textbook wording, but off-syllabus content is a correctness bug, not a style issue. The programme reference lives at `teacher-be/agent/curriculum/<file>.md` and `exam-subject` reads it. **Only شعبة الرياضيات has a file today**; every other stream (علوم تجريبية · تقني رياضي · تسيير واقتصاد) has none, and the skill is told to say so in `meta.assumptions` and stay with content common to all streams. The file's topic *names* are authoritative — they are the UI's own list — but its per-topic notes are marked ✎ as inference, not a transcription of the official programme. **Known gap (2026-08-09): the UI's topic list is missing two units of the programme — الحساب التكاملي and الأعداد والحساب — for the very stream it serves.** See the brief §6b. |
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

- ~~**Lesson plans, course content, lesson summaries**~~ — **exclusion REVERSED 2026-08-10**
  (brief §6g). Courses are in: each content item in a programme week gets an authored course
  with a sheet. Gated on an unsettled question — *what is the accuracy bar, and who verifies
  it?* Authored material is stored separately from the transcribed corpus and is visibly ours.
- **Anything student-facing** — that is a separate e-learning project. Mixing them
  muddies both. ⚠ The course sheet sits on this line: it is the teacher's own prep, never a
  student handout.
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
                                                    │      │  8 collections      │
                                                    │      └─────────────────────┘
                                                    │ spawns, headless
                                                    │ claude -p --output-format json
                                                    ▼
                                      ┌─────────────────────────────┐
                                      │ claude  (Claude Code CLI)   │
                                      │  agent/.claude/skills/<n>/  │
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
| `src/routes/subjects.ts` | the subject surfaces, incl. regenerating ONE exercise |
| `src/routes/exams.ts` | `POST /api/exams` — plan, insert the skeleton, fan out, fill in place |
| `src/routes/corrections.ts` | per-exercise corrections; stores each as it lands |
| `src/inflight.ts` | **one writer per slot / exam / correction batch**, shared by all three |
| `src/teacher.ts` | issues + resolves the opaque teacher id |
| `src/store/classes.ts` | the `classes` collection — create, list, `getOwned` |
| `src/store/progress.ts` | the `progress` collection — the lazy read and the one-operation CAS |
| `src/routes/classes.ts` | `/api/classes`, behind `requireTeacher` on the **prefix** |
| `src/routes/progress.ts` | `/api/progress/:classId` — the one 404, and the bounds |
| `src/routes/programme.ts` | `GET /api/classes/:classId/programme` — the read, and **its own ETag/304** |
| `src/store/programmes.ts` | the corpus: the two readers, and `toProgrammeRecord` — the wire whitelist |
| `src/mutationlog.ts` | one structured line per class/progress write, **including CAS losses** |
| `agent/.claude/skills/<name>/SKILL.md` | **the capabilities themselves** — under `agent/`, NOT the repo root: `config.ts` points the CLI at `<repo>/agent` and `claude/skills.ts` lists `<cwd>/.claude/skills`. Adding a directory there IS the registration; `/api/skills` is that listing. |

**API surface.** `/health` (reports the CLI's version, whether it authenticates,
queue depth, the datastore, **and the fan-out budget**) · `/api` · `/api/skills` ·
`/api/generate` · **`/api/exams`** (progressive generation — plans, stores the skeleton,
answers, then fills each exercise concurrently) ·
`/api/teacher` (mints **and records** an anonymous row) ·
`/api/auth/signup` · `/api/auth/signin` · `/api/auth/recover` ·
**`PUT /api/teacher/school`** (behind `requireTeacher`, not an auth route; write-only) ·
**`/api/classes`** (`POST` create · `GET` list, createdAt ASCENDING — no update, no delete) ·
**`/api/progress/:classId`** (`GET` — synthesizes week 0 for a class never written to, and
carries a live `programme {docKey, edition, totalWeeks}`; `PUT` — the compare-and-set, whose
200 body carries **no** `programme`) ·
**`GET /api/classes/:classId/programme`** (behind `requireTeacher`; returns the **whole
projected programme document** for that class's stream, and answers **`304` with a zero-byte
body on a matching `If-None-Match`**. The precondition is evaluated at the origin, by hand:
Express's default ETag hashes the response body, and this body carries a per-request
`correlationId`, which made the validator a **nonce** that could never match — so the tag is
computed over the projection alone; and `fetch` forces `Cache-Control: no-cache` when a caller
sets `If-None-Match`, which makes Express's `fresh()` refuse to revalidate, so the comparison
happens in the handler. Neither is a cache: the `findOne` still runs every time. Note the same
two causes mean **`GET /api/progress/:classId` still cannot 304**) ·
`/api/subjects` (create — takes an optional `classId` · list, filterable with `?classId=` ·
get · replace one exercise ·
`GET /subjects/:id/exercises/:exerciseId/revisions` ·
**`POST /subjects/:id/exercises/:exerciseId/regenerate`** (rebuild ONE exercise in place) ·
`POST`/`GET /subjects/:id/solutions` ·
**`POST /subjects/:id/solutions/generate`** (202 — corrects each exercise separately)) ·
`GET /api/admin/{kpis,teachers,exams}` (admin-only, behind `requireAdmin`).

**The six skills** (`agent/.claude/skills/`) — the product's actual capabilities. Three are
whole-artifact; three are the per-exercise splits that make progressive generation possible:

| skill | in | out |
|---|---|---|
| `exam-subject` | controls: topic, difficulty, exercise count, duration, stream | the whole exam — `exercises[]` with stable `ex1…exN` ids |
| `refine-exercise` | `{instruction, exercise, examContext}`, instruction in plain Arabic | **one** exercise, `id`/`points`/`label` unchanged |
| `solution-sheet` | the stored exam | the correction — one worked answer + grading scale (السلّم) per exercise, scale summing exactly to that exercise's points |
| `exam-plan` | the same controls | the SKELETON only — `assignments[]` with id, label, points, difficulty and an `avoid` list. Writes no exercise content |
| `exercise-one` | one assignment | **one** exercise, reasoning only about its own mathematics |
| `solution-one` | one exercise | **one** correction + its scale |

**The splits exist because a fan-out costs `max`, not `mean`.** `exercise-one` was measured at
3,376–6,492 output tokens against `exam-subject`'s 6,606-token floor *for a single exercise* —
the envelope reasoning (topic spread, points arithmetic, duration budget) moves to `exam-plan`
and is paid once. `solution-one` is the same split for corrections.

`refine-exercise` is core-loop step 4. `exam-subject`'s per-exercise output shape
exists to make it possible — a skill emitting one blob of exam text would leave the
product's central interaction unbuildable. Both return JSON only; `/api/generate`
returns it as `data` (`null` when a run returns prose).

**Generation is progressive, and that is a shape, not an optimisation.** `POST /api/exams`
plans once, inserts the whole exam with `status:"pending"` placeholders, answers, then fills
each slot concurrently through `replaceExercise`'s existing compare-and-set. `fe` polls
`GET /api/subjects/:id` and renders what has arrived. **It is not faster** — an exam is
finished when its slowest exercise is, and measured wall clock was ~114 s against the
monolith's ~110 s. What it buys is that the first exercise is readable at ~68–91 s, and that
one unusable exercise (~8% of the time) costs one exercise instead of the whole exam.

**One writer per slot, per exam, per correction batch** — `src/inflight.ts`, shared by all
three generation surfaces. A second writer is refused (`409 conflict`) rather than allowed to
duplicate a ~110 s run whose result nobody would keep. This is also what makes an abandoned
`pending` slot recoverable after a restart: there is no live writer, so the regenerate is
simply allowed. Deliberately **no field and no timer** — "does this slot have a live writer"
is process-local, and any field a restart could outlive would be a lie.

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
**`503 store_unavailable` (datastore down — RETRYABLE)** · `401 teacher_required` ·
`401 invalid_credentials` · `401 invalid_recovery` ·
`409 conflict` (the same exercise is being refined twice at once — **and now also a lost
progress compare-and-set**) ·
**`404 class_not_found`** (the class is absent, another teacher's, malformed, or the
uppercase spelling of a real one — one byte-identical body across all four, on
`GET`/`PUT /api/progress/:classId` and `POST /api/subjects`) ·
`404 not_found` (the catch-all — **now Arabic, and it now carries a `correlationId` in the
body**, which is where `fe` reads it) ·
`403 forbidden` (a real teacher who is not an admin — distinct from 401) ·
`429 rate_limited` (auth routes only, retryable) ·
`400 invalid_request` (includes a malformed body) · `413 payload_too_large` ·
`500` for this service's own bugs. Note that `claude_auth` and `store_unavailable` share a
status and mean opposite things: callers branch on `error.type`, never on the code.

> **`409 email_taken` is gone, and its absence is the security decision.** A duplicate-email
> sign-up now answers **`201` with a brand-new working `teacherId` and a decoy recovery
> code** — indistinguishable from a first sign-up. The old 409 was a clean one-request
> enumeration oracle (one call per address, unambiguous) that undid all the care taken to
> make sign-*in* indistinguishable. Three things make the replacement hold: the id must be a
> **working** one, or the caller could probe with it and read the answer off a 401 from
> `requireTeacher`; the duplicate path burns comparable hashing work, so the clock does not
> answer what the status no longer does; and the code **cannot** be anything but a decoy,
> because recovery looks an account up by email and the row it belongs to has none. The real
> account is untouched, and an operator still sees `auth.signup.duplicate` (no address, no
> id). `fe` still carries a dead `email_taken` key in its `KIND` table. The cost, recorded:
> a teacher who reuses their own address is left holding a code that cannot be redeemed,
> with nothing telling them why.
>
> **`fe` cannot map three types `be` emits** — `rate_limited` (429), `payload_too_large`
> (413) and `claude_bad_output` (502) all fall to the default *retryable backend failure*.
> For 413 that is actively wrong advice: a too-large body never succeeds on retry.

**The correlation-id middleware runs BEFORE the body parser.** It used to run after, so a
malformed body short-circuited into the error handler with no `correlationId` — the one
response a caller most needs to trace was the one that could not be traced.

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
> (`project/tests/<key>`) instead of the job.
>
> **A gate that verified nothing is no longer a pass (WF-82).** Zero tests resolved is red
> in job mode; and a run that resolves tests and *executes none of them* — every one
> skipped, which is what black-box suites do when no lane is up — reports
> `gate FAIL` in job mode and `gate INCOMPLETE` on a mainline. It never reads as PASS.
> The old note here claimed a fresh job's receipt reads `ci baseline: green` with no gate
> at all. That was true, and stayed true longer than it looked: the receipt gated the
> *mainline* net rather than the job, and only recorded RED while those suites happened to
> hard-fail. Fixed properly in WF-83 — the receipt now runs the JOB's gate from the job
> worktree, and a fresh job honestly reads `RED — no gate yet`.
>
> Black-box suites take their lane from `CHAR_BE_URL` / `CHAR_BE_LOG`, which `tools/ci`
> derives from the checkout's own slot. **Never hardcode a port in a suite** — it will skip
> forever on every other lane, which is indistinguishable from passing.
>
> ⚠ **`tools/ci be` from the clone root is currently UNTRUSTWORTHY, and the cause is engine,
> not this product.** `maxWorkers: 1` keeps disappearing from
> `tools/tests/jest.characterization.config.js`: added by WF-89, deleted by a pull, restored,
> and **deleted again by the next pull within three hours** — comment and all. Without it the
> promoted net runs on jest's default pool and reports a different failure count every run on
> an unchanged tree (30 / 33 / 32 of 509 at the time of writing; 34 / 28 / 41 earlier). Forced
> serial it is stable at 3 of 509, five runs byte-identical. Twenty-four of thirty failures
> were manufactured by the pool — one black-box suite driving the live service while another
> snapshots `run-log.jsonl`, and a loader suite dropping its scratch database in `beforeEach`
> while a sibling's child process is using it. Filed as **WF-95** (the instance, whose durable
> fix asserts the flag is present) and **WF-96** (the mechanism — a path-scoped pull takes
> upstream's copy with no notion of newer). **The job gates are unaffected** and stay the real
> evidence: run from the worktree with `--slug`.
>
> Two more promoted-net facts recorded while measuring that: one suite resolves its seed with
> one `..` too many after promotion (right where authored, wrong where `tools/promote-tests`
> puts it) and reads a nonexistent path; and one `auth-recover` clause does two scrypt hashes
> against jest's 5 s default, so it times out under load.
>
> **A job lane cannot judge maths typography.** `tools/provision` symlinks the worktree fe's
> `node_modules` to the main checkout's, Vite resolves KaTeX font URLs through the symlink to
> the real path, and `server.fs` denies it — every `KaTeX_*` family 403s and all maths renders
> in a browser fallback face. Glyphs, structure and error counts are unaffected, so every
> recorded oracle still means what it said, but no lane screenshot shows the type a production
> build would. Main-checkout fe is unaffected. Harness fix, not a product one.

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

**MongoDB, database `teacher_saas`, eight collections: `subjects`, `teachers`,
`exercise_revisions`, `solutions`, `programmes`, `programme_revisions`, `classes`,
`progress`.** Chosen because Mongo
already runs as declared shared infra on this machine and `services.sh` had already
reserved that db name — and because an exam subject *is* a JSON document, so the stored
shape and the wire shape are the same object with no mapping layer to drift.

```
subjects
  _id               ObjectId
  teacherId         string · 32 hex          ← the owner
  subject           { title, meta, exercises[] }   ← the generated payload, VERBATIM
                      exercises[].status  "pending" | "ready" | "failed"  (OPTIONAL)
                      ← ABSENT MEANS READY. Every monolith-era exam predates the field, so
                        absent must never read as pending or they all become half-finished.
                        Both stacks read it through an allow-list, never `?? "ready"`.
  controls          object | null
  classId           string · 24 hex (OPTIONAL) ← the class this exam was made for.
                      ← ABSENT MEANS LEGACY, and legacy belongs to ALL of a teacher's
                        classes, not to none: it was written before the question existed.
                        Read only through `classOf`, an ALLOW-LIST — absent, null, a
                        number, an object, an array, a boolean and "" all degrade to
                        legacy. `create` SPREADS it in, so a subject made without one has
                        the same on-disk shape as every subject that predates classes.
                        NOTHING SETS IT YET: generation stores no classId.
  genCorrelationId  string | null            ← the /api/generate run that produced it;
                                               the join key into run-log.jsonl's costUsd
  rev               int (optional)           ← optimistic-concurrency counter, $inc-ed on
                                               each replaceExercise. NOT updatedAt: a
                                               millisecond timestamp is not a version token
  createdAt         Date
  updatedAt         Date

index: { teacherId: 1, updatedAt: -1 }      ← the only query the product makes

teachers                                     ← accounts ADOPT the opaque teacherId
  teacherId      string · 32 hex             ← THE JOIN KEY. Same value subjects hold.
  email          string | null               ← null = an ANONYMOUS row
  passwordHash   string | null               ← scrypt$N$r$p$salt$key (node:crypto)
  recoveryHash   string | null               ← scrypt over the recovery code
  recoveryUsedAt Date | null                 ← WHEN one was last consumed (informational)
  role           "teacher" | "admin"         ← absent reads as teacher; sign-up NEVER sets it
  school         string | null (OPTIONAL)    ← «سيظهر على الموضوع المطبوع». Absent reads as
                                               null, same discipline as role. WRITE-ONLY —
                                               PUT /api/teacher/school sets it and NO route
                                               returns it. Only {null, non-empty trimmed
                                               string} are ever stored (the write path
                                               normalises), so a reader has two cases.
  createdAt · updatedAt  Date

indexes: { email: 1 } unique PARTIAL ($type:"string")  ← partial so many anonymous rows
                                                         (email null) can coexist
         { teacherId: 1 } unique

exercise_revisions                           ← every superseded version, append-only
  subjectId      ObjectId
  teacherId      string · 32 hex             ← denormalised: ownership scoped IN the query
  exerciseId     string                      ← "ex1" … "exN"
  exercise       object                      ← the SUPERSEDED version, verbatim
  supersededAt   Date
  correlationId  string | null

index: { subjectId: 1, exerciseId: 1, supersededAt: -1 }

solutions                                    ← one CURRENT correction per exercise
  subjectId      ObjectId
  teacherId      string · 32 hex             ← denormalised: ownership scoped IN the query
  exerciseId     string
  answer         string                      ← Arabic markdown, maths in $…$ — WORKED
  scale          [ { part, points } ]        ← السلّم; sums exactly to the exercise's points
  answersHash    string                      ← sha256 of the statement it ANSWERS
  genCorrelationId string | null
  createdAt · updatedAt  Date

index: { subjectId: 1, exerciseId: 1 } unique

classes                                      ← the classes a teacher teaches. THE SPINE.
  _id            ObjectId                    ← 24 LOWERCASE hex on the wire; uppercase is
                                               refused at the route, before the store,
                                               because ObjectId.isValid accepts it
  teacherId      string · 32 hex             ← denormalised: ownership scoped IN the query
  name           string                      ← trimmed, 1..80 chars (measured AFTER trim)
  stream         string                      ← validated against the CORPUS at create time,
                                               never against a union in TypeScript
  createdAt · updatedAt  Date

index: { teacherId: 1, createdAt: 1 }        ← ASCENDING, and that IS the tab order in the
                                               class bar. Newest-first would reorder the
                                               switcher under the teacher's finger.

wire shape: { id, name, stream, createdAt } — four keys, built key by key. No teacherId.

progress                                     ← where a class has reached. ONE DOC PER CLASS.
  classId                    string · 24 hex ← THE key. Progress belongs to a CLASS.
  teacherId                  string · 32 hex ← denormalised: ownership scoped IN the query
  markedWeek                 int             ← 0 = not started. Upper bound is the class's
                                               OWN programme totals.weeks, never the
                                               constant 27
  entries                    [ { week, status, note?, completedAt? } ]
                              ↑ week is 1-BASED while markedWeek is 0-based — 0 is "not
                                started" and there is no week 0 to annotate
                              ↑ status ∈ planned|done|skipped, an ALLOW-LIST (uppercase
                                DONE is refused, not folded)
                              ↑ completedAt is stamped by the SERVER and only for `done`;
                                a client-supplied value is accepted on the key and DISCARDED
  rev                        int             ← the compare-and-set token. The insert writes
                                               1, so NO stored document ever carries rev 0
  programmeDocKey            string          ← IDENTITY, $ifNull-stamped ONCE
  programmeEdition           string          ← IDENTITY, $ifNull-stamped ONCE
  programmeTranscriptionRev  int             ← PROVENANCE ONLY, never compared
  createdAt · updatedAt      Date

indexes: { classId: 1 } UNIQUE · { teacherId: 1 }
```

```
programmes                    ← the official التدرجات السنوية, transcribed. ONE doc per source PDF.
  docKey        string        ← "tadarroj-3as-math" — stable across editions
  edition       "2022-09"     ← THE MINISTRY'S version
  current       bool          ← exactly one true per docKey; derived from the GREATEST edition
  streams       [string]      ← the lettres document carries TWO streams in one record
  weeklyHours   7|6|5|4|2     ← the per-week oracle
  totals        { weeks: 27, hours }        ← and totals.hours == weeklyHours × 27, always
  competencies  [ {domain, statements[]} ] | null   ← NULL for gestion/lettres: they have no
                                                      such section. Absent ≠ empty.
  units         [ { id, name, weeks, hours } ]      ← المحاور, from the SUMMARY table
                  ↑ id is ASSIGNED ("u1"…), NEVER derived from the name: units repeat and are
                    non-contiguous. علوم تجريبية lists المتتاليات العددية twice.
                  ↑ weeks may be .5 — `أسبوع ونصف` is real
  weeks         [ { week, unitId, hours, source: {pdfPages[]},
                    rows: [ {competencies[], contents[], guidance[], hours, emphasis}] } ]
                  ↑ emphasis is REQUIRED on every row. Red text is SEMANTIC — it marks content
                    not covered in 2021-2022. A missing value is a load error, never a default.
  transcriptionRev int        ← OUR version — a correction to our own reading
  contentHash      string     ← the loader's guard against a hand-edit in Mongo

indexes: { docKey: 1, edition: 1 } unique · { streams: 1, current: 1 } · { docKey: 1, current: 1 } partial

programme_revisions           ← append-only, mirroring exercise_revisions
```

**The wire projection — `toProgrammeRecord`, a field-explicit WHITELIST built key by key.**
Eight keys reach a client: `docKey · edition · weeklyHours · totals{weeks,hours} ·
source{authority,title} · emphasisLegend{text,pdfPage}|null · units[{id,name}] ·
weeks[{week,unitId,hours,pdfPages,rows[]}]`, each row `{competencies, contents, guidance,
hours, emphasis}`. Anything unnamed is excluded by construction, and the oracle asserts
key-set equality at three depths — a field arrives on the wire by amendment, never by
passthrough.

> **`units[].weeks` and `units[].hours` are deliberately NOT sent, and that is a correctness
> exclusion, not a byte saving.** They are the summary table's numbers and **they disagree
> with the week rows**. A bar segment is one unit **RUN** — a maximal stretch of consecutive
> weeks sharing a `unitId` — not one per unit: maths yields **15 runs from 14 units**, because
> `u12` is non-contiguous (week 20, `u11` at 21, `u12` again at 22–23). Sizing those runs by
> the declared per-unit hours counts `u12`'s twice and sums to **210 against a 189-hour
> total — 111%, a bar that overflows its own track**. Withholding the declared figures makes
> the correct computation (run-summed `weeks[].hours`) the only one a client can perform;
> shipping them "for completeness" hands a caller a plausible wrong number. The defect is
> invisible on the three documents that happen to have no split unit.

Also excluded, each for its own reason: `contentHash` (it hashes the STORED document while
this emits a projection — a validator that had silently stopped validating);
`transcriptionRev` (the one obvious use is diffing it against the class's stamp, which is the
two-axes collapse below); `weekNumberPrinted` (equal to `week` in all 135 rows — it records a
disagreement that does not exist); `nameText`/`weeksText`/`hoursText`;
`source.file/pages/renderedAt` and `weeks[].source.docPages`; document-level `competencies`;
`frontMatter`; and the storage bookkeeping. Row-level `competencies` is **in**: it is the
densest field in the corpus (76 of 103 maths rows, against contents' 63 and guidance's 55),
and excluding it renders four of week 20's seven ministry rows blank. Measured cost of
including it: **+28%** — maths is 49,673 B projected.

**Corpus as it stands: 5 documents · 6 streams · 135 weeks · 379 rows · 648 hours.**

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
- **History lives in its own collection, never inside the subject.** The subject-open path
  must stay one cheap read; embedding revisions would put every discarded variant on the
  hottest read and grow the document without bound.
- **`replaceExercise` is a compare-and-set on `rev`.** Two simultaneous refines used to
  both return 200 with one version silently lost — from the sheet *and* from history. A
  loser re-reads and retries; five failures yield `409 conflict`.
- **The recovery code's single-use is enforced by rotating `recoveryHash`**, not by
  `recoveryUsedAt`. Guarding on a field the same update resets guards nothing.
- **A correction's staleness is DERIVED on read, never stored.** `answersHash` is the hash of
  the statement the answer was written for, and the caller supplies that statement — the
  service cannot otherwise know which version was answered, because generating takes ~145 s
  and a refine can land inside that window. A per-exercise hash and not the subject's `rev`:
  `rev` advances for the whole document, so one refine would mark every correction stale.
  Deriving rather than storing also means restoring an exercise heals its correction.
- **A placeholder fill is NOT a revision.** `exercise_revisions` records superseded
  *teacher-visible* work; an empty slot is not that. Recording it would put a blank statement
  in history and let "restore" restore nothing. A regenerate over a **ready** exercise DOES
  write one — that is a real supersession.
- **Nothing is stored for a correction that could not be produced.** Absent, not a blank row:
  `solutions` holds the *current* correction, and an empty one is indistinguishable from a
  real answer that says nothing. Presence is therefore the only signal `fe` has.
- **The programme corpus is versioned as TEXT and the database is its projection.** The
  transcription lives in `project/data/programmes/*.jsonl`; `scripts/load-programmes.mjs` is the
  **only** writer. A hand-edit in Mongo is refused, not overwritten — if `contentHash` fires,
  the database is wrong and the file is right. A 73-page manual transcription with no diff
  would be unauditable; git is the trust root.
- **Two version axes, never collapsed.** `edition` is the ministry revising the programme;
  `transcriptionRev` is us fixing our own reading of an unchanged page. A new edition is a new
  document and must be asked for with `--new-edition`; a correction can never move a document
  between editions. Collapsing them would make "the syllabus changed" indistinguishable from
  "we misread a number".
- **What a verifier green does NOT mean.** A1–A8 certify that the corpus is arithmetically and
  structurally consistent and untampered relative to its own loader. **They certify nothing
  about whether any Arabic string matches the printed page.** Page fidelity rests on the
  independent human re-read and on sampling. Never quote a green as a fidelity certificate.
- **The corpus has had one EDITORIAL RESTORATION, and it is the first.** `\square` was not a
  misreading — it was a placeholder for double-struck set symbols **the source PDFs fail to
  embed**. `pdftotext` on the ministry's own page finds *no character at all* where ℤ should
  be, because the documents carry `Cambria`/`Calibri`/`Symbol`/`Arial`/`Arabic`/`Wingdings`
  and no math font, while every other formula on the same page extracts cleanly. Whoever
  transcribed it wrote a box because a box is what the page shows, and every reader sees one.
  On **2026-08-11** all **61 occurrences across 48 strings in 3 documents** were restored
  through the loader with `--correct`: `transcriptionRev` **4→5 · 3→4 · 4→5**, `edition`
  untouched at `2022-09` on all five, `programme_revisions` **9 → 12**, A1–A8 green on each,
  zero `\square` left corpus-wide. Document totals are unchanged — still 5 · 6 streams · 135
  weeks · 379 rows. It is defensible only because the mathematics fixes each symbol uniquely,
  and it was **not** safe to batch-replace: the same decoration means ℝ*₊ in week 8 and ℤ*₊ in
  week 15. These 61 are now *our* symbols in a corpus whose whole point is that it is the
  ministry's — so they head the human page-check queue, together with one still open: week
  15's division theorem quantifies over `a` twice where the second variable is almost
  certainly `b`. **That one must not be fixed the same way.** A restored glyph reproduces what
  the page means to show; a wrong *letter* may be what the ministry actually printed, and
  verbatim then means keeping it. Only the page can say. And the standing rule above is
  unchanged by any of it: the verifier green that followed certifies structure and arithmetic,
  never fidelity.
- **`solutions` upserts** — one current correction per exercise. A history of corrections is
  deliberately out of scope; the exam's history is not.
- **Classes are their own collection, not an array on `teachers`.** Both `progress.classId`
  and `subjects.classId` must be validated with one `findOne({_id, teacherId})`; an array
  element has no id a query can match, so validating one would mean reading the credential
  row and scanning in application code — the post-hoc ownership check every store refuses.
  And `teachers` holds both scrypt hashes and is the row `requireAdmin` reads: a weekly class
  edit must not be a write against that document.
- **The progress document is LAZY, and week 0 is a state.** A class is created by one insert
  into `classes` and nothing else — no cross-collection two-step that can half-fail. A class
  with no progress document IS "not started", so `GET` synthesizes
  `{markedWeek: 0, entries: [], rev: 0}` with the identity fields null and **the same key set
  a stored document produces**. A shape that gained keys after the first write would make `fe`
  branch on which of two it got, and the branch it forgot would be the empty one.
- **The progress write is one atomic compare-and-set, and there is NO retry.** The CAS, the
  entry upsert, the `$ifNull` identity stamp and the lazy insert are a single
  aggregation-pipeline update, because read-modify-write opens the exact window the CAS
  exists to refuse. `rev === 0` runs with `upsert: true` (no stored doc carries 0, so the
  filter cannot match; a duplicate key on `{classId:1}` IS a CAS loss and is mapped to one);
  `rev >= 1` runs with `upsert: false`, or a caller naming a rev for a class with no document
  would seed that rev into a conjured one. Unlike `replaceExercise` — which merges ONE
  exercise and may safely rebase five times — a progress write is whole-state intent about
  what the teacher was LOOKING AT. If `rev` moved, that view is gone and only they can decide
  again. The loser gets `409 conflict` immediately.
- **`inflight.ts` is deliberately NOT used for progress.** It guards ~110 s agent loops from
  duplicate work; a progress PUT measures 4–13 ms.
- **`entries` is EMBEDDED, unlike `exercise_revisions`.** Bounded at one row per programme
  week, upserted BY WEEK, and wanted by every read of a position. Revisions are unbounded and
  wanted by almost nobody. Same reasoning, opposite answer, because the shapes are opposite.
  Never rebuilt from the request — a skipped week's note must survive every later write.
- **The programme identity is stamped once and never rewritten.** A later write can never
  re-point a class at another programme; re-pointing is a future explicit surface, not a side
  effect of recording a week. `transcriptionRev` rides the wire only so the key set never
  changes, and nothing compares on it — that is the two-version-axes rule above.
- **`markedWeek`'s ceiling comes from the class's own programme**, read live through
  `getProgrammeForStream`. Every corpus document says 27 today, which is exactly what would
  let a hardcoded 27 survive until the first one that doesn't. **That pin is now closed on
  `be` too** (`programme-surface`, be-2): a mutant hardcoding 27 used to survive all 411
  backend tests, and now **fails 5 clauses**. The fixture is a synthetic `totals.weeks: 30`
  programme **inserted directly into Mongo by the suite** — it cannot come through the loader,
  because `WEEKS_PER_YEAR = 27` is enforced by the seed validator and those guards are
  correct — on a stream value no real document carries, deleted in `afterAll`, with a final
  clause asserting the corpus's six streams are back. Two further mutants proved the pins are
  independent rather than one broad clause catching everything: hardcoding the *entry* bound
  kills exactly 2, hardcoding the wire projection's `totals.weeks` kills exactly 1. `fe`'s
  twin mutant is killed the same way, and `27` appears on zero lines of `lib/programme.ts`.
  Still not mutation-proven: `totals.hours`.
- **A class is never deleted, renamed or archived.** No route, no field, no store function.
  The design has no remove affordance on any screen.

**Accounts adopt the opaque id; they did not replace it.** Sign-in returns the *same*
32-hex `teacherId` the browser already sends as `x-teacher-id`, so no subject document was
moved or rewritten and the `{teacherId:1, updatedAt:-1}` index stayed valid. `requireTeacher`
now **rejects** an id the server never recorded — "issued" means minted AND recorded, which
includes anonymous rows from `POST /api/teacher` and a one-time backfill of the 159 ids that
predated the registry.

⚠ **The teacherId is still a BEARER value.** Accounts made it *recoverable*, not secret.
Turning it into a rotating, expiring session is a separate job, and until then whoever holds
an id reads that teacher's exams — and now their classes and where each class has reached.
The auth routes are rate limited (`429`, with a `retryAfterSeconds`); `POST /api/classes` and
`PUT /api/teacher/school` are not. **And bearer ids reach the log**: the generic request
logger writes URL path segments, so `GET /api/admin/teachers/<32hex>/subjects` puts a whole
id in it. The mutation lines and the auth lines are clean — 8-char `teacherIdPrefix`, one key
name across the service — but "no full 32-hex id anywhere in the log" is not true of the log
as a whole. Accepted for the two-teacher milestone; recorded so it is inherited knowingly.

## Cost is not money, and throughput is the real constraint

**The product runs on a Claude subscription, not credit-based API billing.** So `costUsd` —
in `run-log.jsonl` and now on the subject — is the CLI's *notional API-equivalent*. It is a
stable, comparable **usage signal** (two identical runs both measured 0.6454), and it is
**not** cost of goods sold. Nothing is billed per exam.

> Earlier jobs recorded "~$1.40 per finished exam, ~11 exams to break even". **That framing
> was wrong** and is corrected here. There is no per-exam COGS to break even against. Never
> render `costUsd` as currency to a teacher or an admin — a KPI labelled in dollars would be
> the product lying to its own operator.

A subscription buys a **rate**, not a quantity, so "how many teachers can this serve" is a
throughput question. Measured on this machine (`accounts-hardening`, real generations):

| concurrent | p50 | p95 | max | under 100 s |
|---|---|---|---|---|
| 1 | 73 s | — | 73 s | 1/1 |
| 3 | 76 s | 76 s | 81 s | 3/3 |
| 6 | 73 s | 78 s | 91 s | 6/6 |
| **9** | **68 s** | **87 s** | **93 s** | **9/9** |
| 12 | 82 s | 110 s | 113 s | 10/12 |
| 20 | 118 s | 146 s | 146 s | 5/20 |
| 50 | 201 s | 259 s | 286 s | 0/50 |

**Nine concurrent teachers hold a 100 s bar; twelve breaks it.** Zero upstream throttling at
*every* level tested, up to 50 — nothing was ever refused, rate-limited or timed out. The
ceiling is latency, not rate limiting.

**Above ~12 the bottleneck stops being the service and becomes the HOST.** This machine is 8
cores / 16 GB, and each generation is a full agent loop, not a request. At 20 concurrent free
memory sat at 14–16 MB for the whole run with 66 k swapins; at 50 it took **1.29 M swapins**
and load hit 67 on 8 cores. Those runs measure this laptop, not the product — quote them as a
host-sizing result and never as the product's capacity. The practical reading: concurrency
capacity is bought with RAM, and the honest per-loop figure here is **~0.75–1 GB**.

**One soft failure in 200-odd generations, and it appeared only at 50**: HTTP 200 with
`data: null` — the run returned prose instead of JSON, burning a full agent loop for nothing.
That is the `/api/generate` contract working as designed, but it is the first time the study
produced one, so treat `data: null` as a real user-facing outcome under load rather than a
theoretical branch.

**Exam SIZE dominates, not concurrency.** Those numbers are a 2-exercise / 60-minute devoir.
A 3-exercise / 120-minute composition takes **128 s at concurrency 1** and never meets 100 s
at any concurrency. What a teacher asks for decides whether the bar is met.

`CLAUDE_MAX_CONCURRENT` still defaults to **3** (`config.ts`). The measured safe ceiling is
**9** — raising it is a config change with evidence behind it, deliberately not applied
silently by the job that measured it.

**Not the datastore:** `run-log.jsonl` is an append-only file carrying run cost/duration
plus `{op, subjectId}` link lines. It holds no teacher content and must not start to.

### Still not persisted (the honest gaps)

| Gap | Status |
|---|---|
| ~~The teacher id itself~~ | **CLOSED.** `teachers` collection + email/password accounts, with a one-time recovery code as the reset path (no mail integration needed). Sign-in returns the same id, so exams survive a cleared browser and reach a second machine. |
| ~~Exercise revision history~~ | **CLOSED.** `exercise_revisions`, append-only. Restore reuses `PUT`, so it is itself a supersession — history grows, nothing is destroyed. |
| ~~Generation cost per subject~~ | **CLOSED.** `subjects.genCorrelationId` joins to `run-log.jsonl`'s `costUsd`. `/api/generate` needed no change: it already returned the envelope. |
| ~~Failed saves~~ | **CLOSED.** A retryable failure queues to `teacher.pending.v1` and is **offered** on next load, never replayed silently — `create` is insert-only, so a silent double replay would make two exams. |
| ~~A teacher's classes~~ | **CLOSED.** `classes`, one document per class, owner-scoped in the query. Declared at sign-up (step 3) or from «أقسامي». No update, delete or archive — a class made by mistake is permanent, and an invisible-only name (a pasted RLM/ZWSP) passes `trim()` on both stacks and makes a permanently blank tab. |
| ~~Where a class has reached~~ | **CLOSED.** `progress`, one lazy document per class, compare-and-set on `rev`. Per-week `entries` now have a client too: the tracker's «تمّ ✓» / «تخطٍّ ↷» write `done` and `skipped`, verified live including upsert-by-week and a forged client `completedAt` being discarded. A **note** is still rendered and never authored, and nothing writes `planned`. |
| ~~The programme itself~~ | **CLOSED.** `GET /api/classes/:classId/programme` serves the projected document, and «هذا الأسبوع» + «البرنامج» render it. Before this the corpus was loaded and **nothing served it** — the conformity claim had no surface. |
| ~~The teacher's school~~ | **HALF closed.** Stored on `teachers` by `PUT /api/teacher/school`, and **read by nothing** — no route returns it, so «أقسامي» cannot show it. End to end it reads as "the setting does not work". The print sheet is what will read it. |
| **A generated exam belongs to no class** | `subjects.classId` exists and generation never sets it, so every exam is legacy and appears under **every** class. Deliberate — tagging generation is a later slice — and it is the sharpest teacher-facing surprise the class layer ships. |
| **A class's own stream list** | `fe` mirrors the six corpus streams by hand in `lib/classdraft.ts`; there is no `GET /api/streams`. Proven a live drift hazard: with a synthetic seventh-stream programme, `be` accepted a class the picker could not offer. Defensible only because `be` refuses an unknown value, so drift fails loudly. **Recorded a third time now** — the programme route is class-scoped precisely so `fe` never holds a second stream mapping, which makes this the only one left. |
| **Ministry text in a `title` attribute** | Three surfaces speak only through an attribute, where KaTeX cannot run: the programme bar's unit name, and both emphasis markers' legend caption. Safe **today only because the data is safe** — no unit name and no legend contains `$`, measured — and the guard-rail sweep certifies current data only. It contradicts the rule those components state: the channel is chosen by **who wrote the string**, never by what this corpus contains. A future transcription with maths in a unit name leaks LaTeX source to a teacher, which is a hard-constraint violation. (Paired with: a `title` on a `div` is announced by nothing, so the fifteen unit names are unreachable non-visually. One fix retires both.) |
| **`fe`'s programme types narrow `be`'s nullables** | `emphasisLegend` and `weeks[].unitId` are non-null in `fe/src/lib/programme.ts` and nullable on the wire. Unreachable against all five documents — but a legend-less document would **crash** `legend.text` rather than degrade. Widen in `fe`'s types, never by branching in the components. |
| **Signing IN does not merge an anonymous session** | Open by design: adopting on sign-in would re-point subject documents. The displaced id is kept in `teacher.previous.v1` and the teacher is told in Arabic — the loss is visible and recoverable, not silent. |
| **Accounts, billing, credits** | Accounts exist; billing and credits do not. |
| **Backups / a deploy target** | Still nothing. See Deployments — and note the store now holds **credentials**, not just exam drafts. |

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
