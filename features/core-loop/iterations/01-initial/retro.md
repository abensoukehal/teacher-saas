# Retro — iteration 01-initial

## What the ledgers say

Nine sub-issues, all closed. One reopened by REVIEW. Four defects that shipped
into a commit and were caught later — every one of them by **running the thing**,
none by reading code:

| defect | caught by | would a gate have caught it? |
|---|---|---|
| RTL layout mirrored | screenshot | **no** — it built and type-checked while wrong |
| LaTeX leaking through the generator's notes | DOM assertion over a recording | no — statements were clean, the notes were not |
| Refine panel opening off-screen | clicking it | no |
| Crash on first load with storage disabled | a review probe | no — 22 green tests all ran with working storage |

## What worked

**Pinning oracles to recordings rather than to hand-written expectations.** The
deep-equality pin and the splice pin both fail if the contract moves, which is the
point. Hand-written expectations drift with the code that broke them.

**Testing an intermittent defect at n=4.** R1 appeared in one recording and not
the other two. A single clean run would have "proved" a fix that had not happened.

**The discriminating test for the agent workspace.** Asking for a topic the
programme file forbids, and watching it decline, proved the workspace was actually
in effect. Inspecting the files would have proved nothing — and in fact I ran that
test once against a backend that did not contain the workspace at all, got a
plausible-looking pass, and only caught it because the file paths did not exist
later.

## What cost time

**Committing to the wrong branch.** The agent workspace landed on `main` in the
main checkout instead of the job branch. It also invalidated a verification I had
already reported as passing. Cheap to fix, but it meant re-running work and
retracting a claim.

**Stale project templates.** The first `tools/provision` failed three ways because
this project's `features/_templates/` predated the per-iteration layout. Fixed at
the source. The systemic gap is recorded: `project-template/` travels between
clones, but a project's copy is a one-time snapshot taken at init, and nothing
detects the drift — you find out when a job fails to scaffold.

**Estimating in dollars for a subscription.** I priced generation runs and gated
work on the total. The user runs on a subscription, so the marginal cost is not
money, and I had already noted that caveat myself before ignoring it.

## Carried forward

- **R1 has no automated gate.** Deleting the Arabic-in-maths rule fails nothing.
  And the obvious detector is *wrong* — a naive scan reported 11 false violations
  because display maths desynchronises the pairing. Needs a correct, committed
  check on the be side.
- **REVIEW was not independent.** Same agent implemented and reviewed. It still
  produced one real conviction, but a cross-model pass is owed.
- **The subprocess inherits the entire parent environment.** Not a considered
  decision — the default. Belongs with the parked security work.
- **`meta.topic` can disagree with the sidebar** after a substitution; the teacher
  is told, but nothing links the two on screen.
