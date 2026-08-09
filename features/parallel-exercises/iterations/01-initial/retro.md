# Retro — parallel-exercises · iteration 01-initial

## What this iteration actually was

A speed job that turned out to have no speed in it, and shipped anyway because the
measurement found something better underneath.

The brief projected a 3-exercise composition dropping from ~110 s to 55–60 s. Discovery
built both skills as throwaway prototypes and measured **~114 s** — slightly *worse*. What
survived was time-to-first-exercise (~68–91 s vs ~110 s) and, more valuable, failure
containment: one unusable exercise costs one exercise instead of the whole exam.

## What went right

**Discovery falsified the brief in its first hour, before any code was designed around it.**
The prototype cost two throwaway skills and a handful of real runs. Had planning assembled
against the brief's 55–60 s claim, the whole job would have been shaped around a number that
does not exist, and the exit criteria would have been unmeetable by construction.

**Writing the concurrency clause first paid immediately.** The SEED required it ("where a
behaviour can race or repeat, write the concurrency clause from the start") because two
data-loss bugs shipped in earlier jobs from oracles that only tested the order a person would
describe. Here, mutating `replaceExercise`'s compare-and-set to a single attempt lost **2 of 3
fills permanently** — a teacher's exam arriving two-thirds empty with no error anywhere. That
is the exact failure the rule exists to catch, caught before review.

**Cross-model review and QA each found what the other could not.** REVIEW (prosecution, with
code) found the double-writer race and proved it by execution. QA (black-box, no code) found
that an entire exit criterion was never built. Neither would have found the other's.

## What went wrong, and the lesson

**An exit criterion vanished between the SEED and the contract.** SEED §5 criterion 3 —
"corrections stream per exercise" — was never given a transport in
`fe-be-progressive.contract.md`, so no sub-issue owned it, no oracle asserted it, and every
gate stayed green while it simply did not exist. QA measured it: 230 s of empty polls, then
all three at once.

> **Lesson: the contract must be checked against the exit criteria, item by item, before
> PLANNING seals.** Nothing in the pipeline does this today. Every gate downstream of the
> contract verifies the contract; none verifies that the contract still covers the SEED. A
> criterion that is not in the contract is invisible for the rest of the job.

**A measured number was wrong in the direction that flattered the design.** §10.1 first read
"~15% malformed". The counting script used a bare JSON parse while the service strips a
```json fence — one of the two failures was recoverable and the service handles it. The real
figure is **~8%**. Found by the be agent while writing the oracle, not by the author.

> **Lesson: a measurement script is code and gets the same scepticism.** This one was written
> quickly, used once, and its output was quoted three times before anyone re-derived it.

**Reachability was nobody's job.** fe-1 shipped `startExam` tested but uncalled — the feature
was unreachable, and the sub-issue's exit protocol was still fully satisfied. It surfaced only
because the agent flagged it rather than declaring done.

> **Lesson: "a user can reach this" belongs in a happy-path sub-issue's exit protocol**, not
> inferred from the sum of the parts.

## Workflow findings

- **WF-84 (fixed this session)** — black-box suites ran in parallel against one shared
  service and raced on its rate-limit state. `maxWorkers: 1` now pinned in the shared config.
- **Agents sweeping each other's files.** `git add -A` on a shared job worktree caught the
  other stack's in-progress files, twice, before both agents moved to path-scoped adds.
  Worth making the default guidance rather than a lesson each job relearns.
- **`tools/ci <key>` from the clone root gates the MAIN checkout** — a vacuous green for a
  job branch. Both agents independently discovered this and worked around it with explicit
  `CHAR_ROOTDIR`/`CHAR_TESTDIR`. WF-83 fixed the provision receipt; the same trap remains for
  a hand-run perimeter check.
- **Commit messages leaked the private layer** (sub-issue ids, "SEED", "review:") and were
  caught only by the pre-push scan, after the branch had already been pushed by an agent. The
  history had to be rewritten and force-pushed. **Agents committing to a job branch should be
  told the commit-message hygiene rule up front**, not have it corrected at the ship gate.

## Carried forward, knowingly

- **The fan-out budget is per-exam, not per-teacher.** One teacher with two exams holds the
  whole default gate. Fine at the two-teacher milestone; it matters when the cap is raised.
- **The corrections backstop takes 5–10 minutes** to give up on a dead batch. Bounded and
  honest, but a teacher waits a long while before being offered the retry.
- **No organic truncation has ever been observed rendering.** ~8% never fired across every
  live run of this job; all failure-rendering evidence is replay-driven. The correction
  analogue *was* reached organically (by killing the service mid-batch) and held.
- **Criterion 1's "70–80 s" is a median, not a promise** — three real samples: 74 / 68.5 / 91 s,
  against a measured 2.7× spread on identical work.
- **The "missing curriculum file" was my error, not a defect.** `agent/curriculum/3as-mathematiques.md`
  exists and always has. I searched for `*program*`, which cannot match `curriculum/`, and looked
  in the skill's directory rather than the agent root — then carried the false claim into the
  SEED, this retro and the close-out summary before the user corrected it.
  **Lesson: a negative finding ("X does not exist") needs the same proof as a positive one.**
  I never ran a plain `ls` on the directory the skill actually names.
