# build — cross-repo branches, dependencies & merge log

> **LOCAL / personal — never synced.** The live execution ledger for this bugfix/hotfix
> across the code repos: which branch in each repo, the cross-repo merge **`depends_on`**,
> and the staging→prod **merge / deploy log**. Updated during IMPLEMENT and at every
> merge. Every merge / PR is gated on asking ([[git-branch-pr-discipline]]).

## Local run — dedicated ports (slot __SLOT__)

> This job's local stack runs on a **dedicated port lane** so it can run in parallel
> with other jobs' stacks. `ports = base + slot×100` (slot 0 = the main checkout).
> Run `tools/dev` from **this worktree** — it reads `port-slot` below and brings
> FE/BE/AI up on these ports, wired FE→BE→AI. Mongo/Redis are shared. Override the
> lane with `DEV_SLOT=N tools/dev`.

<!-- port-slot: __SLOT__ -->

| service | port | URL |
|---|---|---|
__LANE_TABLE__
| MongoDB _(shared)_ | `27017` | — |
| Redis _(shared)_ | `6379` | — |

## Provision receipt (the workspace's birth certificate — filled by /provision)

| repo | base @ sha | deps ✓ | .env ✓ | ci baseline (incl. pre-existing reds) |
|---|---|---|---|---|
| | `staging @ <sha>` | | | green / red: <which + why> |

- [ ] lane ports free (slot __SLOT__) · brief seeded with source anchor · state.json initialized

## Branches per repo

> One `bugfix/<slug>` (or `hotfix/<slug>`) branch per touched repo. **`depends_on`** =
> the repos whose branch must merge + deploy **first** — set it **only** when this
> branch can't stay backward-compatible against that repo (empty = merges
> independently, any order).

| repo | branch | depends_on (repos) | why the dep (the non-additive change) |
|---|---|---|---|
| <repo-dir> | `bugfix/<slug>` | — | |


_(delete rows for repos this fix doesn't touch)_

## Merge & deploy log

> Newest first. One row per merge / PR / deploy event. Integration branches
> (`staging` / `dev` / `develop`) ← **merge**; `master` / `main` ← **PR**. Record the
> deploy outcome. Respect `depends_on` order above.

| date | repo | branch → target | action | deployed? | notes |
|---|---|---|---|---|---|
| | | `bugfix/<slug>` → staging | merge | ⏳ | |
