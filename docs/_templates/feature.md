---
kind: feature
id: feat-<name>                # immutable
title: "<Feature name>"
plane: product
part_of: prod-<slug>           # prod-ask | prod-ai-test | prod-ai-troubleshoot
realized_by: []                # [component / flow ids] — THE PARALLEL (required, non-empty)
status: stub
last_verified:
tags: []
---

# <Feature>

> One discrete user-facing capability. Its `realized_by` names every implementation
> node + flow that builds it — that link is mandatory and must stay true.

## Product behavior (what the user gets)
<!-- The feature from the user's side: what they do, what they see, the value. -->

## Implementation parallel
<!-- The other half of the parallel, in words. Each realized_by id, one line on its
     role. Keep the machine truth in front-matter `realized_by`; this is the prose. -->
| Node | Stack | Role |
|---|---|---|
| [[cmp-<...>]] | be | <what it does for this feature> |
| [[cmp-<...>]] | fe | |
| [[flow-<...>]] | — | end-to-end sequence |

## States & edges
<!-- loading / empty / error / limits — the non-happy paths users hit. -->

## Related
<!-- adjacent features, dependencies. [[feat-...]] -->
