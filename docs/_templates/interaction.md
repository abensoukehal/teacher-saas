---
kind: interaction
id: ix-<name>                  # immutable
title: "<interaction label>"   # the clickable's visible text/label
plane: product
part_of: vw-<name>             # the view it lives in
navigates_to: []               # [view ids] — where clicking lands (horizontal edge)
triggers: []                   # [component/flow ids] — BE logic/flow it fires (→ vertical parallel)
repos: [<fe-repo-dir>]
status: stub
last_verified:
tags: []
---

# <Interaction>

> A clickable / CTA / button / link / form control. `navigates_to` captures the
> horizontal move (which view it lands in); `triggers` links to the impl node or
> flow it fires — this is where the horizontal (UX) graph **joins the vertical
> (impl) parallel**. Captured by the crawler; labeled from the dense grounded path.

## Behavior
<!-- what clicking does: navigation, the BE call(s) it fires (method + path + shape),
     state change. Recorded by the crawler — not assumed. -->
