---
kind: route
id: rt-<name>                  # immutable, e.g. rt-ai-test
title: "<route path>"          # e.g. /ai-test
plane: product
renders: []                    # [view ids] rendered at this route (states/screens)
repos: [<fe-repo-dir>]
status: stub
last_verified:
tags: []
---

# <Route>

> A FE route (URL) — the horizontal graph's entry point. It `renders` one or more
> **views** (the states a user can land in). Discovered/verified by the crawler (WF-40).

## Path & guards
<!-- URL pattern; role/auth guards (manager vs student render differently); redirects. -->

## Views rendered
| View | When |
|---|---|
| [[vw-<...>]] | default / data present |
| [[vw-<...>]] | empty / loading / error |
