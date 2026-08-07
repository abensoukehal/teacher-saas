#!/usr/bin/env bash
#
# project/git.sh — THIS PRODUCT'S GIT POLICY. Per layer: which GitHub account owns
# the remote, which branch is the mainline, and how autonomous I am with commits
# and pushes.
#
# Local to this clone, never synced. Each product configures its own — edit the
# table, nothing else. (teacher-saas here; the lablabee clone has its own copy.)

# ┌──────────────────────────────────────────────────────────────────────────────┐
# │ THE KNOBS — edit these six-field rows and you are done.                      │
# │   scope | account | remote | mainline | commit | push                        │
# │                                                                              │
# │   scope     project      → project/ (specs, profile, docs, job branches)     │
# │             stack:*      → the default for EVERY stack repo                  │
# │             stack:<key>  → override one repos.sh key (stack:be, stack:fe)     │
# │   account   the GitHub account/org that owns the remote                      │
# │   remote    <owner>/<repo>   — leave EMPTY on stack:* (no single remote)      │
# │   mainline  the long-lived branch — leave EMPTY on any stack row, so the      │
# │             branch stays single-sourced in repos.sh (prod-branch field)       │
# │   commit    auto = commit on the job's branch without asking · ask = gated    │
# │   push      auto = push without asking          · ask = every push gated      │
# └──────────────────────────────────────────────────────────────────────────────┘
GIT_POLICY_TABLE=(
  # "scope|account|remote|mainline|commit|push"
  "project|abensoukehal|abensoukehal/teacher-saas|main|auto|auto"

  # ── stacks: NOT CONFIGURED YET ────────────────────────────────────────────────
  # No stack repo exists, and the policy for them has not been given — so there is
  # deliberately no stack:* row. An unconfigured scope FAILS CLOSED: git_may returns
  # "ask" for commit AND push, so nothing about a stack repo happens unattended
  # until a row lands here. Uncomment and fill when the first stack is decided:
  # "stack:*|<account>|<owner>/<repo> or empty||<auto|ask>|<auto|ask>"
  # "stack:be|<account>|<owner>/<repo>||<auto|ask>|<auto|ask>"   # per-repo override
)

# ── read it back ───────────────────────────────────────────────────────────────
#   source tools/profile.sh
#   git_policy project        git_account stack:be     git_mainline stack:be
#   git_may stack:be push  && echo "push freely" || echo "ask first"
#
# ── what the table can NOT do ──────────────────────────────────────────────────
#   · PR and merge are gated on every layer, always — /open-pr and /merge-back ask,
#     whatever the push column says. No value here relaxes that.
#   · No committing on a mainline/staging branch, even at commit=auto. Work happens
#     on feature/* · bugfix/* · hotfix/* (workflow/conventions/git-branching.md).
#
# ── the harness layer is deliberately absent ───────────────────────────────────
#   It is the same repo in every clone, so its row is ENGINE — tools/git-lib.sh,
#   GIT_POLICY_DEFAULTS — and travels to all clones via `tools/harness push`/`pull`.
#   Read it with `git_policy harness`; change it there. (Adding a `harness` row here
#   would override it for this clone only — the project table is searched first.)
#
# ── why the values above (given 2026-08-07) ────────────────────────────────────
#   project  abensoukehal/teacher-saas · main · commit auto · push auto — stated by
#            the user. Private management repo: specs, profile, docs graph, job
#            branches. Nothing outward-facing, so committing and pushing as work
#            lands costs nothing and keeps job history durable. Jobs still branch
#            off main as feature/<slug> — auto never means "commit on main".
#
#   stacks   UNSET, on purpose. The user will state each stack's account, branches
#            and gates when the repo is decided; guessing them here would be the
#            one place a wrong default could push product code somewhere unasked.
#            Until then every stack action asks. When a row is added, its BRANCHES
#            still come from repos.sh (leave the mainline field empty).
#
# ── engine contract ────────────────────────────────────────────────────────────
#   SOURCED (not executed) by tools/profile.sh; lookups live in tools/git-lib.sh.
#   Profile item 1b — workflow/PROFILE.md. bash 3.2-safe: plain pipe-delimited array.
