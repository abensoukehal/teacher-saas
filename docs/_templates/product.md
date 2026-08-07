---
kind: product
id: prod-<slug>                # prod-ask | prod-ai-test | prod-ai-troubleshoot
title: "<PRODUCT NAME>"
plane: product
composed_of: []                # [service ids] this product is built on (many-to-many; FE/BE shared)
status: stub                   # fresh | drift | stub (stub = planned / not built)
last_verified:
tags: []
---

# <PRODUCT NAME>

> One of the three products — a top-level **entry-point** for graph traversal.
> Product language only; the "how" is reached via each feature's `realized_by`
> and this product's `composed_of` services.

## What it is (product view)
<!-- The user-facing product in one paragraph: who uses it, the value. -->

## Composed of (services)
<!-- mirror composed_of. FE and BE are shared across products. -->
- [[svc-<...>]] — <role in this product>

## Features
<!-- each feature under this product is its own node here. [[feat-...]] -->
- [[feat-<...>]] — <one line>

## Boundaries
<!-- what's in this product vs the adjacent ones (ASK / AI TEST / AI TROUBLESHOOT). -->
