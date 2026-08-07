#!/usr/bin/env bash
#
# projects/<name>/repos.sh — this project's REPO TABLE.
#
# ★ PROFILE — FILL ME FIRST (workflow/PROFILE.md item 1). The engine never names
# a repo directly; every tool and skill resolves repos through this table.
#
# SOURCED (not executed) by tools/project.sh, which pairs it with the engine
# lookups in tools/repos-lib.sh (repo_record / repo_dir / repo_int_branch /
# repo_prod_branch / repo_path). Paths resolve under THIS project's dir, so two
# projects can both have a repo keyed `be` without colliding.
#
# bash 3.2-safe (macOS default): a plain array of pipe-delimited records.
#
# One record per repo:  key | dir | integration-branch | prod-branch
#   key   — short handle used on the CLI (e.g. fe, be, api, app …)
#   dir   — repo directory name UNDER THIS PROJECT DIR (a separately-cloned git
#           repo, gitignored by the harness — see the root .gitignore)
#   integration-branch — the staging/dev branch features cut off + merge into
#                        (what job-wt rebases onto; what pull-all fast-forwards first)
#   prod-branch        — the production branch (also fast-forwarded by pull-all).
#                        GROUND TRUTH for the docs graph's stamps.
# An EMPTY branch field = untracked for that repo: pull-all skips it and job-wt
# sync asks for an explicit --base. Single-branch repos (greenfield): leave the
# integration field empty and the staging axis (/merge-back) skips that repo.
#
# Example:
#   "fe|my-frontend|dev|main"
#   "be|my-backend|dev|main"
#   "ai|my-ai-service|dev|main"

# ★ THIS PROJECT: three git layers, and only the first two exist today.
#     harness (engine)      abensoukehal/project-harness   → this clone root
#     project (management)  abensoukehal/teacher-saas      → THIS dir
#     stacks  (code)        one repo per service           → none created yet
#   The project repo holds the profile, features/, stack-skeletons/ and docs/ —
#   never product code. Each service gets its OWN repo, cloned into this dir and
#   registered below.
#
# When you add the first stack repo, do all five in one pass or the job pipeline
# will have a hole:
#   1. clone it into this dir            5. .claude/agents/<key>.md (from the template,
#   2. add its record below                 at the CLONE ROOT — one per repo key)
#   3. anchor its dir in .gitignore      + services.sh record, honouring the reserved
#   4. stack-skeletons/<key>.md            port band, and a start_<key>() in recipes.sh
#
# Its BRANCHES are the two fields below; its GitHub account and commit/push rules
# come from git.sh — the `stack:*` row covers every repo, so add a `stack:<key>`
# row there ONLY if this repo must differ (a different owner, a stricter gate).
#
# Greenfield convention (workflow/PROFILE.md): a repo with no staging branch yet
# leaves the integration field EMPTY — /merge-back then skips it, e.g.
#   "app|teacher-app||main"
REPO_TABLE=(
  # "key|repo-dir|integration-branch|prod-branch"
  # ← EMPTY ON PURPOSE: no stack repos exist yet (greenfield, 2026-08-07).
)
