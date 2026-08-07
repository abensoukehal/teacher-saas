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
  "stack:*|abensoukehal|||auto|ask"
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
# ── why the values above (chosen 2026-08-07) ───────────────────────────────────
#   project  auto/auto — private management repo: specs, profile, docs graph, job
#            branches. Nothing outward-facing, so committing and pushing as work
#            lands costs nothing and keeps job history durable.
#   stack:*  auto/ask  — product code is the only layer that reaches other people,
#            so it keeps the standing baseline: commit freely on the job's branch,
#            every push waits for you. Mainline comes from repos.sh; greenfield
#            repos are single-branch (prod only, empty integration field), so
#            /merge-back skips them until a staging branch exists.
#
#   No stack repo exists yet, so stack:* carries the whole policy. When one lands
#   under a different owner or a stricter gate, add an override instead of editing
#   stack:*:   "stack:be|acme-inc|acme-inc/teacher-backend||auto|ask"
#
# ── engine contract ────────────────────────────────────────────────────────────
#   SOURCED (not executed) by tools/profile.sh; lookups live in tools/git-lib.sh.
#   Profile item 1b — workflow/PROFILE.md. bash 3.2-safe: plain pipe-delimited array.
