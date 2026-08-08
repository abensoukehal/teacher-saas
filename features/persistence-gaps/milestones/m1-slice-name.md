---
kind: milestone
id: m1
title: "<Epic title — company Milestone shows this verbatim>"
goal: "<One sentence: what moves forward toward the global goal after this epic.>"
status: rollup                 # derived from its issues
company_linear_id: null
---

# m1 — <epic name>

> A milestone is an epic that delivers user value end-to-end. It contains ISSUES
> (short, board-visible summaries — usually product, sometimes foundation), and
> each issue is decomposed into SUB-ISSUES (personal-only technical detail, in
> `stacks/*.md`). Only this file's milestone + issues sync to company Linear.
>
> Ordering: the contract sub-issue (or a foundation issue) comes first as a
> blocker, then the per-stack sub-issues that depend on it.

## User value
<!-- Product framing. Seeds the company Milestone description. -->

## Issues (board-visible, short) and their sub-issues (personal)

<!-- Each issue: short front-matter + one-line summary. Its sub-issues list the
     technical work; full detail lives in stacks/<stack>.md and contracts/. -->

```yaml
---
kind: issue
id: i1
title: "Implement FE→BE live-progress contract"   # a foundation issue (still short)
summary: "Agree + wire the API the app uses to receive live progress."
milestone: m1
status: rollup
company_linear_id: null
depends_on: []
---
```
### i1 — <short name>
Sub-issues:
- `contract-fe-be` (stack: contract) → `contracts/fe-be.contract.md`
- `obs-1` (stack: obs) → instrument the flow (ships via PR) — see `stacks/be.md`

```yaml
---
kind: issue
id: i2
title: "Manager sees live validation progress"    # a product issue
summary: "A manager watching a run sees progress update without refreshing."
milestone: m1
status: rollup
company_linear_id: null
depends_on: [i1]
---
```
### i2 — <short name>
Sub-issues (detail in `stacks/*.md`):
- `be-1`  (stack: be)     → stream engine events over SSE      → `stacks/be.md#be-1`
- `ai-1`  (stack: ai)     → emit progress stream events     → `stacks/ai.md#ai-1`
- `fe-1`  (stack: fe)     → render live progress                → `stacks/fe.md#fe-1`

## Definition of done (milestone)
- [ ] all issues roll up to `done` (every sub-issue `done`)
- [ ] `tools/ci all` green — characterization intact, or pins updated + reviewed
      where behavior intentionally changed
- [ ] target area observable: flow traceable end-to-end via `tools/obs trace <id>`
- [ ] flow in `contracts/flows.md` verified end-to-end
- [ ] specs reconciled to as-built
- [ ] backward-compat checklist passed on every contract touched
