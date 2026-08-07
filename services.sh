#!/usr/bin/env bash
#
# projects/<name>/services.sh — this project's LOCAL SERVICE TOPOLOGY and
# observability endpoints: which app services exist, their base ports, log stems,
# health paths, the shared infra layer, staging apps, and where the tracing/error
# surfaces live.
#
# ★ PROFILE — FILL ME SECOND (workflow/PROFILE.md item 2). SOURCED (not executed)
# by tools/project.sh, which pairs it with the engine lookups in
# tools/services-lib.sh — and through tools/lanes.sh with tools/dev, tools/obs,
# tools/graf, tools/provision. So every service FACT lives in ONE place (WF-77).
# The per-service START RECIPES live next door in recipes.sh (WF-78).
#
# bash 3.2-safe (macOS default): plain arrays of pipe-delimited records.
#
# One record per app service:  key | repo-key | label | base-port | log-stem | health-path
#   key         — CLI handle (dev restart <key>, obs logs <key>)
#   repo-key    — repos.sh key of the checkout that serves it ("" = none)
#   label       — display name in status tables / provenance lines
#   base-port   — slot-0 port; a lane's port = base + slot*100 (tools/lanes.sh).
#                 ⚠ space bases ≥ N*100 apart (N = max parallel lanes you'll run):
#                 with bases 100 apart, lane 1 of one service COLLIDES with lane 0
#                 of the next. Safe pattern: 1000-apart bases (3000/4000/8008 style).
#                 ⚠ macOS: AirPlay (ControlCenter) squats :5000 AND :7000 — avoid
#                 bases whose lane range crosses them.
#                 ⚠ ACROSS PROJECTS: lane slots are allocated per project, so two
#                 projects CAN collide on ports. Give each project its own band.
#   log-stem    — /tmp/<stem><lane-suffix>.log — written by dev, read by obs
#                 (and tailed by tools/grafana/promtail — keep them in sync).
#                 Prefix it with the project name so two projects never share a log.
#   health-path — path curl'd on the service port for a health detail ("" = TCP-only)
#
# Example:
#   "fe|fe|frontend|3000|myproject-frontend|/"
#   "be|be|backend|4000|myproject-backend|/api"
#   "ai|ai|AI-svc|8008|myproject-ai|/health"

# ★ THIS PROJECT'S RESERVED BAND — cross-product safety.
# The machine also runs a harness clone at ~/workspace/lablabee, which shares /tmp
# and the infra layer with this one. It has taken bases 3000 / 4000 / 8008, RUN_STEM
# "lablabee-run", and log stems "lablabee-*" + "tapai-native".
# teacher-saas therefore claims:
#   base ports  — 9000, then +1000 per service (9000, 10000, 11000, …)
#                 (+1000 keeps 10 lanes collision-free at base + slot*100;
#                  5000 and 7000 are unusable — macOS AirPlay squats both)
#   log stems   — "teacher-<key>"
#   RUN_STEM    — "teacher-run"
#   DB name     — teacher_saas
# Honour this band when adding records below; do not reuse a lablabee base.
SERVICE_TABLE=(
  # "key|repo-key|label|base-port|log-stem|health-path"
  # ← EMPTY ON PURPOSE: no stack repos exist yet (greenfield, 2026-08-07).
  #   First records, when the stacks land — keep the reserved band:
  #   "fe|fe|frontend|9000|teacher-frontend|/"
  #   "be|be|backend|10000|teacher-backend|/api"
)

# Shared infra (never lane-shifted — all lanes use the same instances):
#   key | brew-service | port
INFRA_TABLE=(
  # "mongo|mongodb-community|27017"                       ← FILL ME (or empty)
  # "redis|redis|6379"
)

# ---- scalar facts ----------------------------------------------------------------
RUN_STEM="teacher-run"                # pidfile dir: /tmp/<RUN_STEM><lane-suffix>
AI_DOCKER_CONTAINER=""                # slot-0 docker alternative for one service ("" = none)
LOCAL_DB_URL=""                       # ← FILL ME once the store is chosen. Infra is SHARED
                                      #   with the lablabee clone, so use DB name
                                      #   "teacher_saas" (lablabee holds "lablabee").

# Backend → downstream wiring env vars shown by `obs status` (read from the
# backend checkout's .env; local vs remote per value). "" = skip the section.
BE_WIRING_VARS=""

# Staging (PaaS) apps — `obs staging` and `graf staging`; override via env.
STAGING_BE_APP="${OBS_STAGING_BE_APP:-}"
STAGING_FE_APP="${OBS_STAGING_FE_APP:-}"

# LLM tracing (obs ls): the env file (relative to THIS PROJECT DIR) that holds
# LANGCHAIN_API_KEY / LANGCHAIN_PROJECT, and the project fallback. "" = no tracing.
LS_ENV_FILE=""
LS_DEFAULT_PROJECT=""

# Error tracking (obs sentry): org + target table  key | project-slug | label
SENTRY_ORG_DEFAULT=""
SENTRY_TABLE=(
  # "be|my-backend-sentry-slug|backend"                   ← FILL ME (or empty)
)

# Grafana (tools/graf): dashboard uid (matches tools/grafana/grafana/dashboards/).
GRAF_DASH_UID="unified-logs"
