# teacher-saas — product context

> **This is the PRODUCT half of the command center.** It lives in the project repo, is
> versioned with the specs and the profile, and is loaded by the harness through
> `@project/CLAUDE.md` — so the harness clone itself stays product-agnostic and only ever
> refers to a product *through the `project/` folder*.
>
> The engine half — workspace map, tool index, phase pipeline — is the root `CLAUDE.md`
> at the harness clone root. What belongs here: architecture, repos, data model,
> deployments, integrations. See [`workflow/PROFILE.md`](../workflow/PROFILE.md) item 6.

**teacher-saas** is a SaaS that helps teachers prepare their coursework: lesson plans,
exercises, exams and the rest of the material that goes with a class. The users are
teachers; the product's job is to take what a teacher is teaching and turn it into
ready-to-use prepared material.

> **Status: greenfield, one stack repo in.** As of 2026-08-07 the only stack repo is
> `cc-api` (the LLM edge) — there is no application backend, frontend or datastore yet.
> Sections still marked ★ PENDING are stubs on purpose: they get written from the real
> checkouts as each repo lands, not guessed ahead of it. See `workflow/PROFILE.md` →
> "Greenfield deltas" for how the phases behave until then.

## The three git layers

One product, three repos, each versioned on its own — the convention this clone follows:

| layer | repo | lives at |
|---|---|---|
| harness (engine) | `abensoukehal/project-harness` | this clone root |
| project (management) | `abensoukehal/teacher-saas` | `project/` |
| stacks (code) | one repo per service — `abensoukehal/claude-code-openai-wrapper` | `project/cc-api/` |

The project repo holds the profile, `features/`, `stack-skeletons/` and `docs/`. It does
**not** hold product code; each service gets its own repo, cloned into `project/` and
registered in `repos.sh`.

## Git rules — branches, accounts, commit/push

Three questions, one answer per layer. [`git.sh`](git.sh) is the binding version (it sits
in this repo, next to this file, so the two move together); this table is how to read it.

| | branches | GitHub account | commit | push |
|---|---|---|---|---|
| **project** (`project/`) | `main`, plus one `feature/<slug>` per job | `abensoukehal` (personal) | **without asking** | **without asking** |
| **stacks** (`project/<dir>/`) | mainline from [`repos.sh`](repos.sh) (`cc-api` → `main`), plus one `feature/<slug>` per job | `abensoukehal` (personal) | **without asking** | **without asking** |

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
★ PARTIAL — only the LLM edge exists. The app tier that will call it is not built yet.

  (teacher app — ★ PENDING)                       cc-api  :9000
   lesson / exercise / exam            OpenAI-shaped   ┌──────────────────────┐
   generation                    ─────────HTTP────────▶│ FastAPI              │
                                  /v1/chat/completions │  src/main.py         │
                                  /v1/messages         │  claude_cli.py       │
                                                       └──────────┬───────────┘
                                                                  │ Claude Agent SDK
                                                                  ▼
                                                        Anthropic API · Bedrock
                                                        · Vertex · Claude CLI auth
```

Reading it: the product's generation features do **not** embed a provider SDK. They
speak OpenAI-compatible HTTP to `cc-api`, which owns auth, model selection, session
continuity, cost/token accounting and rate limiting in one place.

## Repos

One section per repo key in [`repos.sh`](repos.sh).

### `cc-api` — the LLM edge

| | |
|---|---|
| **repo** | `abensoukehal/claude-code-openai-wrapper` — a fork of `RichardAtCT/claude-code-openai-wrapper` (upstream v2.3.0) |
| **dir** | `project/cc-api/` |
| **stack** | Python 3.10+ · FastAPI · uvicorn · Poetry · pytest (`black` @ 100 cols, `mypy`, `bandit` in the repo's own CI) |
| **branches** | `main` only — **single-branch**, so the integration field in `repos.sh` is empty and `/merge-back` skips this repo |
| **local port** | base `9000` (lane ports 9000/9100/…); log stem `teacher-cc-api`; health `/health` |
| **deploy** | ★ PENDING — no deploy target yet |

**Purpose.** An OpenAI-API-compatible wrapper over the Claude Agent SDK. Everything in
teacher-saas that turns a teacher's subject matter into prepared material (lesson plans,
exercises, exams) goes through it, so the product depends on one stable HTTP surface
rather than on a provider SDK scattered through the app tier.

**Key modules** (flat under `src/`, no package tree):

| module | owns |
|---|---|
| `main.py` | every FastAPI route (~2k lines) — the whole HTTP surface |
| `models.py` | Pydantic request/response shapes — **the public contract** |
| `claude_cli.py` | the Claude Agent SDK call path |
| `auth.py` | multi-provider auth detection: CLI · API key · Bedrock · Vertex |
| `session_manager.py` | conversation continuity — **in-memory, per-process** |
| `tool_manager.py`, `mcp_client.py` | optional Claude Code tools + MCP servers |
| `rate_limiter.py`, `parameter_validator.py`, `message_adapter.py` | slowapi limits, request validation, OpenAI↔Anthropic message translation |

**API surface.** `/v1/chat/completions` · `/v1/messages` · `/v1/models` · `/v1/sessions*`
· `/v1/tools*` · `/v1/mcp/*` · `/v1/auth/status` · `/v1/debug/request` · `/health` ·
`/version` · `/` (an interactive API explorer).

**Two things to know before touching it.**

1. **It is a live fork.** Keep local edits narrow and deliberate, and check whether a
   change belongs upstream first — divergence taxes every future `git pull upstream main`.
2. **It executes Claude Code tools when they are enabled.** Upstream binds `0.0.0.0`;
   locally we bind `127.0.0.1` (see `start_cc-api()` in [`recipes.sh`](recipes.sh)). Do
   not widen that without saying so.

Also note: `session_manager` state is per-process, so a lane restart wipes it — no test
may assume a session outlives the process. And live calls to the completion endpoints
spend Claude quota.

**Known engine gap.** `tools/ci` hardcodes the keys `be|fe|ai` and does not know
`cc-api`, so `tools/ci cc-api` is not available yet. Until that is fixed, run a job's
suite directly: `poetry run pytest features/<slug>/tests/cc-api/` (tests still live under
`features/<slug>/tests/cc-api/`, never inside the repo tree — WF-53).

## Ports and log stems (reserved)

This machine runs a second harness clone at `~/workspace/lablabee` that shares `/tmp` and
the infra layer, so teacher-saas claims a disjoint band up front — see
`services.sh` for the binding version.

| | lablabee (taken) | teacher-saas (reserved) |
|---|---|---|
| service base ports | 3000, 4000, 8008 | **9000, then +1000 per service** — `cc-api` holds 9000 |
| `RUN_STEM` | `lablabee-run` | `teacher-run` |
| log stems | `lablabee-*`, `tapai-native` | `teacher-*` |
| local DB name | `lablabee` | `teacher_saas` |

Bases step by 1000 because a lane's port is `base + slot*100` — 1000 apart keeps ten
lanes collision-free. 5000 and 7000 are unusable on macOS (AirPlay squats both).

## Data model

★ PENDING — no store chosen yet, and `cc-api` does not need one: it is stateless apart
from in-memory sessions (`src/session_manager.py`), which are per-process and lost on
restart. Record the primary store, the tables/collections that matter, and the
field-naming gotchas once the app tier lands.

## Deployments

★ PENDING — no deploy targets yet. Greenfield convention: each repo starts single-branch
(`prod` only, empty integration field in `repos.sh`), which makes the staging axis
(`/merge-back`) skip it until a staging branch is added.

## Integrations

**Anthropic / Claude — via `cc-api`, not directly.** The LLM integration is the `cc-api`
service; nothing else in the product should hold a provider SDK. Its auth is
multi-provider and auto-detected (`src/auth.py`): Claude CLI subscription auth,
`ANTHROPIC_API_KEY`, AWS Bedrock, or Google Vertex — override with `CLAUDE_AUTH_METHOD`.
Config lives in `project/cc-api/.env` (gitignored; `.env.example` documents every key:
`PORT`, `DEFAULT_MODEL`, `FAST_MODEL`, `CLAUDE_MODELS_OVERRIDE`, the `RATE_LIMIT_*`
family). Check what is actually active at runtime with `/v1/auth/status`.

★ PENDING — everything else (payments, mail, storage, auth for teachers) once the app
tier exists.
