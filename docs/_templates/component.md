---
kind: component
id: cmp-<stack>-<name>         # immutable (e.g. cmp-be-ai-sse-relay)
title: "<Component name>"
plane: implementation
part_of: mod-<stack>-<name>
realizes: []                   # [feature ids] — THE PARALLEL (reverse side; keep true)
depends_on: []                 # [component ids] it calls / needs
source: [<repo>/path/to/file.js:LINE]   # code anchor(s) — the ground truth
status: stub
last_verified:
tags: []
---

# <Component>

> A concrete implementation unit: a model, endpoint, service, worker, queue, or
> stream. The `source` anchors it to real code; `realizes` links it to the
> feature(s) it builds.

## What it does (as-implemented)
<!-- Real behavior TODAY, cited to source. For an endpoint/flow-step: the actual
     request/response or event shape, recorded from a real run (investigate-by-
     running), not assumed. -->

## Realizes
<!-- each feature this serves, one line. [[feat-...]] -->

## Depends on
<!-- each dependency, why. [[cmp-...]] -->

## Contract / wire shape
<!-- if this is a boundary (endpoint, event, SSE), the diffable shape lives here or
     links to the job contract that defined it. -->
