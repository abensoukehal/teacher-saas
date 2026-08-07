---
kind: issue
id: i1                          # stable forever; the join key
title: "<Short title — company Issue shows this verbatim>"
summary: "<One or two lines: what's wrong / what should be done, product view.>"
company_linear_id: null         # SEEDED from 00-brief source_url (this issue already
                                # exists upstream — a bugfix/hotfix anchors to it directly)
status: rollup                  # derived from the sub-issues below
depends_on: []
---

# <slug> — direct issue (bugfix / hotfix)

> **Issue-level path.** A bugfix/hotfix is NOT a full feature — it has no
> project/milestone wrapper. It's a single upstream **Issue** (the front-matter
> above, board-visible, short) decomposed into **sub-issues** (personal-only
> technical depth, below). Only `title` + `summary` sync; everything under
> "Sub-issues" stays on this machine.
>
> Leak check on `summary`: if it names a file, endpoint, or schema field, it
> belongs in a sub-issue, not the summary.

## Root cause
> Locked in **`SEED.md`** (the DISCOVERY output, troubleshoot mode — there is no
> separate RCA.md). Summarize the one-line cause here and link the SEED; the full
> reproduction, evidence, and blast radius live there. The sub-issues below
> implement the fix the SEED points to.

## Sub-issues (personal — technical depth)

> One section per stack touched. Each is loop-ready: target files, current shape
> (recorded, not guessed), the change, tests, compat. Set `status` on each as you
> work — it rolls UP to the issue front-matter and onto the board automatically.

```yaml
---
kind: sub-issue
id: be-1                        # <stack>-<n>
parent: i1
stack: be                       # a repo key from the project's repos.sh | contract | harness | obs
status: todo                    # YOU set this; rolls up to the issue
estimate: S                     # S | M | L (optional)
---
```
### be-1 — <short name>
<!-- Six slots — the loop-ready contract (conventions/writing-sub-issues.md). -->
1. **Intent:** why this sub-issue exists, one sentence (for a bugfix: the user-visible wrong
   behavior the SEED's root cause explains).
2. **Ground truth (recorded + re-run command):** the reproduction — real behavior/payload
   captured by running it, pasted with the command. Pre-flight: the loop re-runs this and
   must reproduce the bug before writing a line.
3. **Delta:** target files (`repo/path:LINE`) + precisely what to change. **Everything else frozen.**
4. **Oracle (executable, two-sided):**
   - positive: characterization over the buggy area — GREEN on current (broken) behavior
     first, then updated to assert the fix; acceptance as commands + expected observations
   - negative: neighboring behavior bit-stable (the fix changes ONLY the buggy path)
   - obs assertion: the fixed flow visible via `tools/obs trace <id>`
5. **Boundaries:** contract refs if any; additive/versioned; budget: 10 loop iterations.
6. **Exit:** done-when = oracle green + freeze respected + `tools/ci <stack>` green ·
   ask-when = contract change / non-additive / frozen file / red pin / budget blown
   (see `conventions/autonomy.md`).

## Harness (bugfix touches existing code → pin it first)
- [ ] characterization test over the buggy area is GREEN on current (broken/old)
      behavior, then updated to assert the fix — LOCAL only (`tools/ci <stack>`)
- [ ] the area is observable end-to-end before the change (`tools/obs trace <id>`);
      if it's a blind spot, instrumenting it is the first `stack: obs` sub-issue
      (ships via its own PR)

## Definition of done (issue)
- [ ] all sub-issues roll up to `done`
- [ ] `tools/ci <stack>` green — characterization intact or pins updated + reviewed
- [ ] fix verified against the real flow (`verify` skill / `tools/obs trace <id>`)
- [ ] backward-compat preserved (additive; no consumer broken)
- [ ] spec reconciled to as-built; upstream Issue status rolled up via sync
