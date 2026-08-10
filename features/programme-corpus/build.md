# build — cross-repo branches, dependencies & merge log

> **LOCAL / personal — never synced.** The live execution ledger for this job across
> the code repos: which branch in each repo, the cross-repo merge **`depends_on`**,
> and the staging→prod **merge / deploy log**. Scope lives in `SEED.md` (product-level)
> and each stack's `stacks/*.md` + sub-issues (concrete files); this file is the
> *running state*, updated during IMPLEMENT and at every merge.
> Every merge / PR is gated on asking ([[git-branch-pr-discipline]]).

## Local run — dedicated ports (slot 7)

> This job's local stack runs on a **dedicated port lane** so it can run in parallel
> with other jobs' stacks. `ports = base + slot×100` (slot 0 = the main checkout).
> Run `tools/dev` from **this worktree** — it reads `port-slot` below and brings
> FE/BE/AI up on these ports, wired FE→BE→AI. Mongo/Redis are shared. Override the
> lane with `DEV_SLOT=N tools/dev`.

<!-- port-slot: 7 -->

| service | port | URL |
|---|---|---|
| backend | `9700` | http://localhost:9700/health |
| frontend | `10700` | http://localhost:10700/ |

| MongoDB _(shared)_ | `27017` | — |
| Redis _(shared)_ | `6379` | — |

## Provision receipt (the workspace's birth certificate — filled by /provision)

> Recorded once at PROVISION, extended if a repo is attached mid-job. The base shas anchor
> every later "what moved since provision" / `rebase-sync` question; the CI baseline is the
> WF-50 "prove it's pre-existing" trail, manufactured in advance.

| repo | base @ sha | deps ✓ | .env ✓ | ci baseline (incl. pre-existing reds) |
|---|---|---|---|---|
| | `staging @ <sha>` | | | green / red: <which + why> |

- [ ] lane ports free (slot 7) · brief seeded with source anchor · state.json initialized

## Branches per repo

> One `feature/<slug>` branch per touched repo (WF-01 — one branch per job, per repo).
> **`depends_on`** = the repos whose branch must merge + deploy **first**. Set it
> **only** when this branch can't stay backward-compatible against that repo; leave it
> empty when the change is additive (then repos merge **independently, any order**).

| repo | branch | depends_on (repos) | why the dep (the non-additive change) |
|---|---|---|---|
| <repo-dir> | `feature/<slug>` | — | |


_(delete rows for repos this job doesn't touch)_

## Coverage gates (before touching a surface)

> For every surface a sub-issue modifies: **pin current behavior first** (characterization
> test; brand-new surface gets spec-tests against the contract instead), and **confirm we
> can SEE it work** (blind spots become the slice's first issues). Per-stack detail lives
> in `stacks/*.md`; this is the cross-stack checklist.

- [ ] characterization: `tools/ci <be|fe|ai|all>` green **before AND after** implementation
- [ ] observability: each touched flow visible via `tools/obs status|logs|ai|trace <id>` (see this lane's `dev-up.md`)

## Merge & deploy log

> Newest first. One row per merge / PR / deploy event. Integration branches
> (`staging` / `dev` / `develop`) ← **merge**; `master` / `main` ← **PR**. Record the
> deploy outcome so we can see what's actually live where. Respect `depends_on` order
> above.

| date | repo | branch → target | action | deployed? | notes |
|---|---|---|---|---|---|
| | | `feature/<slug>` → staging | merge | ⏳ | |
