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

> **Status: greenfield.** As of 2026-08-07 no stack repos exist yet — only the harness
> clone and the project repo. The sections below are stubs on purpose: they get written
> from the real checkouts once the first stack repo lands, not guessed ahead of it. See
> `workflow/PROFILE.md` → "Greenfield deltas" for how the phases behave until then.

## The three git layers

One product, three repos, each versioned on its own — the convention this clone follows:

| layer | repo | lives at |
|---|---|---|
| harness (engine) | `abensoukehal/project-harness` | this clone root |
| project (management) | `abensoukehal/teacher-saas` | `project/` |
| stacks (code) | one repo per service — *none yet* | `project/<dir>/` |

The project repo holds the profile, `features/`, `stack-skeletons/` and `docs/`. It does
**not** hold product code; each service gets its own repo, cloned into `project/` and
registered in `repos.sh`.

## Git rules — branches, accounts, commit/push

Three questions, one answer per layer. [`git.sh`](git.sh) is the binding version (it sits
in this repo, next to this file, so the two move together); this table is how to read it.

| | branches | GitHub account | commit | push |
|---|---|---|---|---|
| **project** (`project/`) | `main`, plus one `feature/<slug>` per job | `abensoukehal` (personal) | **without asking** | **without asking** |
| **stacks** (`project/<dir>/`) | ★ not set — mainline will come from [`repos.sh`](repos.sh) | ★ not set | ★ **ask** | ★ **ask** |

★ **No stack repo exists, and no stack policy has been given yet** — it gets stated per
stack when each repo is decided. Until a `stack:*` or `stack:<key>` row lands in
`git.sh`, an unconfigured scope **fails closed**: every stack commit and push asks first.
That is enforced, not a note — `git_may stack:<anything> commit|push` returns "ask" while
the row is absent.

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
from each clone's own `origin`, so the engine never names an account or a product. Read it
with `git_policy harness`. One caveat recorded there: the harness's `push` means the
path-scoped `tools/harness push`, never a raw `git push` from the clone root — the root's
`origin` is the shared harness remote.

## Architecture in one diagram

```
★ PENDING — no stack repos yet. Draw the request path once the first services exist.
```

## Repos

★ PENDING — `repos.sh` is intentionally empty: no stack repos have been created.
Add one section here per repo key as each lands (purpose, stack, key modules, API
surface, deployment trigger), in step with `repos.sh`, `.claude/agents/<key>.md` and
`stack-skeletons/<key>.md`.

## Ports and log stems (reserved)

This machine runs a second harness clone at `~/workspace/lablabee` that shares `/tmp` and
the infra layer, so teacher-saas claims a disjoint band up front — see
`services.sh` for the binding version.

| | lablabee (taken) | teacher-saas (reserved) |
|---|---|---|
| service base ports | 3000, 4000, 8008 | **9000, then +1000 per service** |
| `RUN_STEM` | `lablabee-run` | `teacher-run` |
| log stems | `lablabee-*`, `tapai-native` | `teacher-*` |
| local DB name | `lablabee` | `teacher_saas` |

Bases step by 1000 because a lane's port is `base + slot*100` — 1000 apart keeps ten
lanes collision-free. 5000 and 7000 are unusable on macOS (AirPlay squats both).

## Data model

★ PENDING — no store chosen yet. Record the primary store, the tables/collections that
matter, and the field-naming gotchas once it exists.

## Deployments

★ PENDING — no deploy targets yet. Greenfield convention: each repo starts single-branch
(`prod` only, empty integration field in `repos.sh`), which makes the staging axis
(`/merge-back`) skip it until a staging branch is added.

## Integrations

★ PENDING — expect at least an LLM provider, since generating lessons/exercises/exams is
the core. Record each service, what it's used for, and where its config lives.
