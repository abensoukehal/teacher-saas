# 99 — Retro (feeds workflow evolution)

> Whole-job retro, written at close. One iteration (`01-initial`), shipped and
> merged 2026-08-07/08. The per-iteration detail is in
> `iterations/01-initial/retro.md`; this is what the arc as a whole taught.

## What this job was, in the end

It was booked as "persistence — pick a datastore" and it was really **a data-loss
bug**. That gap between the two is the whole story of this job.

## The finding that mattered most

**The brief was wrong about its own premise, and the phase that exists to catch
that caught it in ten minutes.**

The brief claimed the backend was stateless so a refresh lost the teacher's work.
DISCOVERY's first act was to grep the *frontend* — the stack the brief did not
blame — and found it already persisting. The brief's "done when" described
behaviour that already shipped. The real defect was one line away: a single fixed
storage key, so a teacher's second exam destroyed their first, silently.

Had PLANNING run from the brief, the headline deliverable would have been a feature
that already existed and the actual defect would have shipped untouched.

**Generalisable:** the cheapest falsification is aimed at the claim the brief is
most confident about, and often at the component the brief does *not* accuse.
"Falsify the brief first" earned its place in the ladder here.

## The second finding: gates verify slices, seams break

Every sub-issue oracle went green. Two real defects still survived to QA:

- identity that failed at boot silently discarded **every** save for the session —
  and it defeated the very sub-issue (`fe-4`) built to make save failures visible,
  because no write was ever attempted;
- a promise made in one sub-issue's spec ("`be-3` will assert this") was never
  picked up by the receiving sub-issue.

Both live exactly where slice isolation excludes: **between** slices, and between an
effect and the handler that depends on it. The six-slot model makes each slice
independently verifiable, which is its strength and precisely its blind spot.

**Concrete workflow change worth making:** a deferral from one sub-issue to another
should be recorded as an explicit obligation *on the receiving sub-issue*, not as
prose in the one deferring. Nothing mechanical currently checks a deferral is honoured.

## Where the harness itself cost time

Three engine-level findings, all worth fixing upstream:

1. **The provision receipt reported a green it had not earned** — `ci baseline: green`
   for `be` when the gate, run properly from the worktree, was RED. A false green is
   worse than a red: it silences the signal that would have prompted a look. The
   receipt should run the same command it tells you to re-run.
2. **`tools/docs-verify` does not exist in this clone**, yet `/document` instructs
   you to run it on touched flows. A skill should not mandate a step that cannot be taken.
3. **`tools/docs-graph` resolves its target from the profile, not the cwd** — so
   running it from the clone root writes the graph into the **main** checkout while
   the job's other artifacts go to the worktree. That is what happened here: the
   whole documentation was authored on `main` by mistake and had to be moved onto
   the job branch before archiving. It contradicts the harness's own stated rule that
   every tool resolves the checkout from the cwd of the command that runs it. Either
   the tool should follow cwd like the others, or `/document` should say plainly:
   run it from the worktree.

Also: `fe`'s `node_modules` symlink pointed at a main checkout holding 24 of 88
packages, so the frontend gate could not run at all until an install. The provision
receipt's `deps ✓` evidently checks presence, not completeness.

## What worked and should be repeated

- **Record one real generation, reuse it everywhere.** At ~128 s and ~$0.65 a call,
  no loop iteration ever spent model budget, and every oracle ran against a genuine
  Arabic + LaTeX payload rather than a hand-written fixture.
- **Probe the test harness before writing oracles.** Three planning assumptions about
  how `be` could be tested were wrong (filename pattern, TypeScript, ESM import).
  `be` had never had a test; discovering that from a trivial probe rather than from a
  half-written suite would have saved the most time of anything in this job.
- **Write deviations into the spec at the point of deviation**, with the evidence
  that forced them. Two sub-issues were restructured mid-flight; both are recorded
  where a future reader meets them, so the specs read as what happened rather than
  what was hoped.
- **Prove acceptance by driving the live stack end to end**, not by declaring victory
  on unit greens. The real generate → persist → generate again → reopen → refine run
  is what actually established the defect was closed.

## What this job deliberately did not finish

Six gaps, each with its evidence and a recommended order, are written up in
`project/handoffs/2026-08-08-what-is-not-persisted.md`. The one that still loses a
teacher's work is identity: the teacher id is never stored, so clearing site data
orphans every exam permanently.

One strategic note recorded there and worth repeating: none of those six fixes the
product's actual problem, which is that exam generation is low-frequency. The
roadmap's weekly exercise series is the item that does.
