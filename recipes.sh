#!/usr/bin/env bash
#
# projects/<name>/recipes.sh — this project's RUN RECIPES: the irreducibly
# product-specific shell that tools/dev and tools/obs need but cannot generalize.
#
# ★ PROFILE — FILL ME THIRD (workflow/PROFILE.md item 3). Before WF-78 these
# lived inside tools/dev and tools/obs behind `── PROFILE ──` banners, which meant
# rewriting an engine tool per project. Now the engine is untouched and each
# project ships its own recipes here.
#
# SOURCED (not executed) by tools/dev and tools/obs after the profile tables, so
# everything from projects/<name>/services.sh is already in scope, plus the
# engine helpers below.
#
# Available to you here:
#   sv_port KEY   this lane's port for a service   (base + slot*100)
#   sv_log  KEY   this lane's log path
#   sv_dir  KEY   absolute checkout path for a service ("" if it has no repo)
#   start_app KEY WORKDIR CMD…   the generic launcher (handles ports, logs, pidfiles,
#                                foreign-process refusal) — your recipes call this
#   PROJECT_DIR   this project's dir (profile + content + repo clones)
#
# ---- 1. per-service start recipes (tools/dev) ----------------------------------
# Define ONE function per service key in services.sh: start_<key>().
# Cross-service URLs must use the LANE ports (`$(sv_port be)`), never the base
# port — otherwise a job lane silently talks to the main checkout's stack.
# A service with build artifacts (venv, dist) should refuse LOUDLY here when
# they're missing rather than silently starting the wrong thing (WF-64).
#
# Example:
#   start_be(){
#     start_app be "$(sv_dir be)" \
#       env PORT="$(sv_port be)" npm run dev
#   }
#   start_fe(){
#     start_app fe "$(sv_dir fe)" \
#       env PORT="$(sv_port fe)" BACKEND_API="http://localhost:$(sv_port be)/api" npm run dev
#   }
#   start_ai(){
#     [ -x "$(sv_dir ai)/.venv/bin/uvicorn" ] || { err "ai: no .venv — run uv sync first"; return 1; }
#     start_app ai "$(sv_dir ai)" \
#       .venv/bin/uvicorn main:app --port "$(sv_port ai)"
#   }

# ← FILL ME: one start_<key>() per SERVICE_TABLE key

# ---- 2. the E2E verify recipe (tools/obs verify) --------------------------------
# Your product's headless end-to-end check: mint/obtain auth, drive the entry
# endpoint, stream/poll the result, print a compact verdict. Mark it loudly if it
# spends quota or calls remote services. Leave it undefined and `obs verify` says
# so honestly instead of reporting a green it didn't earn.
#
#   cmd_verify(){
#     …
#   }
