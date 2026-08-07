---
kind: flow
id: flow-<name>                # immutable
title: "<End-to-end flow name>"
plane: flow
realizes: []                   # [feature ids] this flow delivers
steps: []                      # ORDERED [component ids] — the sequence
crosses: []                    # [service ids] the flow spans
status: stub
last_verified:
tags: []
---

# <Flow>

> An ordered end-to-end sequence across components that realizes a feature. This
> is what makes a cross-stack feature legible: the exact hop-by-hop path.

## Sequence
<!-- Mirror the ordered `steps` above. One line per hop: node — what it does —
     what it passes on (real payload/event shape, recorded, not guessed). -->
1. [[cmp-<...>]] — <does X> → <passes Y>
2. [[cmp-<...>]] — …

```mermaid
sequenceDiagram
  participant FE
  participant BE
  participant TAP
  FE->>BE: <request>
  BE->>TAP: <call>
  TAP-->>BE: <result>
  BE-->>FE: <SSE/response>
```

## Failure modes
<!-- Where it breaks, what the user sees, where to look (obs trace). -->
