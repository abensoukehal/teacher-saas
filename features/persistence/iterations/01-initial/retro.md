# Retro — `persistence`, iteration `01-initial`

## What the phases actually caught

**The brief was wrong, and ten minutes of falsification caught it.** The brief said
drafts were lost on refresh and framed the job as durability. One grep of the
*frontend* — before reading any backend code — found `src/lib/persist.ts` already
persisting. The brief's own "done when" described behaviour that already shipped.
Had planning started from the brief, the headline deliverable would have been a
feature that already existed, and the real defect (one fixed key, so exam #2
destroys exam #1) would have shipped untouched.

The lesson is procedural, not lucky: **the cheapest test was aimed at the thing the
brief was most confident about**, and it was aimed at the *other* stack from the one
the brief blamed.

**The provision receipt lied and nobody would have noticed.** It reported `ci
baseline: green` for `be`. Run properly from the worktree, both gates were RED —
correctly, since no suite existed (WF-68). A green that was never earned is worse
than a red, because it silences the one signal that would have prompted a look.

## What cost time, and what would prevent it

| Friction | Root cause | Prevention |
|---|---|---|
| Three failed attempts at a `be` test harness | `be` had **never** had a test. Filename must match `*.characterization.test.js`; no TS transform; `dist/` is ESM and jest's CJS runner cannot import it without a flag that lives in the shared engine config | Probe the harness with a trivial test **before** writing any oracle. Recorded in `stacks/be.md` → "Test harness" so the next job pays this once, not again |
| `fe` gate could not run at all | `node_modules` was a symlink to a main checkout with 24 of 88 packages — `katex`, `vitest`, testing-library all missing | Provision's receipt checks `deps ✓` but evidently not *completeness*. Worth an engine issue |
| Two sub-issues restructured mid-loop | `be-2` was a pure module with no HTTP surface — unverifiable under the harness. `be-4`'s Delta assumed `recordRun` could know a subject id that does not exist yet | Both are the same mistake: **planning wrote oracles before the verification mechanism was known**. The harness probe above fixes the first; the second is a sequencing error I should have caught by tracing when each write actually happens |

## What the gates did not catch

Two defects survived every green gate and were found by adversarial probing:

- **QA-1** — a failed boot `/api/teacher` left identity null for the session, so
  every later generation rendered and was silently never stored. High severity, and
  it *defeated* `fe-4`: the save indicator never fires because no write is attempted.
  Every sub-issue oracle passed. What found it was reading the diff asking "what
  happens if the thing before this failed?"
- **QA-2** — `be-1` deferred an assertion to `be-3`, and `be-3`'s suite never picked
  it up. A promise made in a spec and quietly dropped. Nothing mechanical checks that
  a deferral is honoured.

**The generalisable finding:** both are *seam* failures — one between an effect and
the handler that depends on it, one between two sub-issues. The six-slot model makes
each slice verifiable in isolation, and both bugs lived precisely in what isolation
excludes. A deferral like `be-1`'s should be recorded as an explicit obligation on
the receiving sub-issue, not as prose in the one deferring.

## Workflow findings

- `tools/docs-verify`, which `/document` instructs you to run on touched product-plane
  flows, **does not exist in this clone**. `tools/` has no such file. Either the skill
  references a tool that was never built or it was removed; the skill should not
  instruct a step that cannot be taken.
- `tools/docs-graph coverage` reports a permanent phantom gap — `stacks/<repo-dir>`,
  the literal placeholder row in `repos.sh`'s comments, is read as a real service.
- The provision receipt's CI-baseline check disagrees with `tools/ci --slug` run from
  the worktree. The receipt is the thing people trust at a glance; it should run the
  same command it tells you to re-run.

## What went right, worth repeating

- Recording a **real** payload once (128 s, $0.65) and reusing it as the fixture for
  every oracle. No loop iteration ever spent model budget.
- Every spec deviation written into the spec **at the point of deviation**, with the
  evidence that forced it — `be-2`'s fold, `be-1`'s moved clause, `be-4`'s different
  shape. The specs read as what happened, not as what was hoped.
- Acceptance proven by driving the live stack end to end with a real generation,
  rather than declaring victory on unit greens.
