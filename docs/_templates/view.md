---
kind: view
id: vw-<name>                  # immutable
title: "<View name>"
plane: product
part_of:                       # rt-<...> (optional — also reachable via route.renders)
repos: [<fe-repo-dir>]
status: stub
last_verified:
tags: []
---

# <View>

> A rendered screen/state at a route. Holds the **interactions** (clickables) a user can
> take (each authors `part_of: <this view>`). Product-plane truth (headings/labels,
> i18n resolved) is captured by the crawler.

## What the user sees
<!-- headings, key labels (i18n resolved), which state this view represents
     (data / empty / loading / error). -->

## Interactions
| Interaction | Kind | Goes to / triggers |
|---|---|---|
| [[ix-<...>]] | button / CTA / link / form | [[vw-...]] / [[flow-...]] |
