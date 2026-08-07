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

**Who owns each remote, which branch is the mainline, and whether I may commit/push
without asking** is not restated here — it is the git policy table, and it is the only
place to read or change it:

```bash
source tools/profile.sh && git_policy project   # scope | account | remote | mainline | commit | push
```

- **project + stack rows** → [`git.sh`](git.sh), per product.
- **the harness row** → `tools/git-lib.sh` (engine), so every clone answers the same and
  `tools/harness push`/`pull` keeps them aligned.
- **PR and merge stay gated on every layer**, whatever the push column says
  ([`workflow/conventions/git-branching.md`](../workflow/conventions/git-branching.md)).

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
