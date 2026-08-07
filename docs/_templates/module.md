---
kind: module
id: mod-<stack>-<name>         # immutable (e.g. mod-be-ai)
title: "<Module name>"
plane: implementation
part_of: svc-<name>
# NOTE: modules do NOT author `realizes` — a module's feature links are DERIVED
# (roll-up of its components' `realizes`). Only component + flow author `realizes`.
source: [<repo>/path/to/module/]
status: stub
last_verified:
tags: []
---

# <Module>

> A cohesive code area inside a service. Groups `component` nodes.

## Responsibility
<!-- What this module owns. -->

## Components
- [[cmp-<stack>-<name>]] — <one line>

## Features it serves
<!-- reverse of the parallel; each realizes id, one line. [[feat-...]] -->
