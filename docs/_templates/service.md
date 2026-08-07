---
kind: service
id: svc-<name>                 # immutable (e.g. svc-my-backend)
title: "<Service / repo name>"
plane: implementation
repos: [<repo>@<sha>]          # version pin → staleness detection (cron reads this)
source: [<repo>/]
status: stub
last_verified:
tags: []
---

# <Service>

> A repo / deployable. Groups `module` nodes. Carries the version pin the doc cron
> diffs against repo HEAD to detect drift.

## Role in the platform
<!-- What this service is responsible for; where it sits in the request path. -->

## Modules
- [[mod-<stack>-<name>]] — <one line>

## Deploy / runtime
<!-- how it's deployed + how to run it headless for investigate-by-running
     (link the relevant `run`/`verify` recipe or memory). -->
