# Whole-job retro — core-loop

One iteration, `01-initial`. It took the product from *an engine nobody could
reach* to a loop a teacher can actually use, and both repos landed on `main`.

The per-iteration retro holds the tactical findings. This is what the arc taught.

## 1. The brief was wrong about a load-bearing fact, and only running it showed that

The brief promised "a full draft in seconds". Measured: **114–133 s** for a draft,
**47 s** for a refine, held across eight runs. That is not a slower version of the
same product — it is a different interaction, and it moved progress, cancel and
reload-survival from polish into the MVP.

DISCOVERY exists to test the brief's framing before building on it. Here it
repaid immediately. Everything downstream — the progress component, the local
draft, the whole error taxonomy — descends from that one measurement.

## 2. Verification by running beat verification by reading, every single time

Four defects reached a commit. **All four** were caught by executing something;
**none** by reading code:

- a mirrored RTL layout that type-checked and built perfectly
- LaTeX leaking through the generator's notes, while statements rendered clean
- a refine panel mounting off-screen
- a crash on first load with storage disabled, under 22 green tests

The pattern generalises past this job: the failures that survive review are the
ones where the code is *correct* and the outcome is wrong. Only the outcome can
convict them.

The corollary bit too — I once reported a verification as passing when I had
restarted a backend that did not contain the code under test. The claim was
retracted and re-run. **A green you did not watch execute is not a green.**

## 3. The architecture moved twice, mid-job, on user input — and that was fine

The agent workspace went from "context that happened to sit in the backend repo"
→ a separate stack repo → a named folder inside the backend. Each move was a
better answer to the same question, and the second reversed the first.

It was survivable because the job's contracts were pinned to **recordings** rather
than to a design. The recorded request/response shapes did not change when the
workspace moved, so nothing downstream had to be renegotiated.

Worth keeping: pin to observed behaviour, not to intended structure.

## 4. The harness's own defects only appeared under use

Three, all fixed at the source rather than worked around:

- `project/features/_templates/` was a stale one-time copy, so the first
  `tools/provision` failed three ways. **The systemic gap remains**: engine
  template improvements never reach an existing project, and nothing detects the
  drift.
- `tools/provision` computes its CI baseline from the *clone root without a slug*,
  so it measures the main checkout's empty regression net and records "green" for
  a job that has no gate at all.
- `CLAUDE.md` declared itself engine but was pinned local, so the two clones had
  drifted into entirely different documents.

A harness is only as true as the last time someone used it end to end.

## 5. What this job deliberately did not do

No datastore, no accounts, no billing, no security hardening. Each was a recorded
decision with a reason, not an omission — and the SEED's unknowns ledger carries
them with their dispositions.

The one that will bite first: **there is no store**, so a teacher loses their exam
if they clear the browser, and the credit model in the brief has nothing to meter.

## 6. Open, carried out of this job

| item | why it matters |
|---|---|
| R1 has no automated gate | deleting the Arabic-in-maths rule fails nothing — and the obvious detector is *wrong* |
| REVIEW was not independent | same agent implemented and reviewed; one real conviction, but a cross-model pass is owed |
| the subprocess inherits the whole parent environment | a default, not a decision; belongs with the parked security work |
| `meta.topic` can disagree with the sidebar | the teacher is told, but nothing links the two on screen |
| unit economics | ~$0.49 a draft, ~$0.31 a refine, ~$0.20 of it fixed per call — the credit model needs this checked against a real subscription |

## 7. The measured facts, for whoever picks this up

- draft **114–133 s**, refine **47–48 s**, over 8 runs
- marks summed to the stated total on **8/8** exams
- KaTeX parsed **222/222** maths spans across the recorded exams
- a prompt-injection-shaped note did not take: output stayed Arabic, no URL
- 23 checks green through the job's gate at close
