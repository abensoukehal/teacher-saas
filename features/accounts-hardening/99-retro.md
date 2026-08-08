# 99 — Retro (feeds workflow evolution)

One iteration. Roles, an operator's console, per-exam usage figures, a bounded auth surface,
and a measured answer to "how many teachers at once".

## What worked

**Running the experiment instead of reasoning about it.** The brief's premise looked dead on
arrival — a measured exam took 128 s against a 100 s bar. Running it anyway found that the
128 s was a *3-exercise composition*; a 2-exercise devoir is **73 s**, and **nine** run
concurrently with every one under 100 s. Exam **size** dominates, not concurrency. The
measurement was cheap, and would have been skipped under a cost constraint that turned out
not to exist.

**Drawing a scope line at DISCOVERY and holding it.** Replacing the bearer `teacherId`
touches 7 backend files, 11 promoted suites and the frontend's whole storage layer. Doing it
in the same job that adds a privilege level means changing the authentication mechanism and
adding privilege at once, each masking the other's mistakes. Fenced in the SEED and the
contract, and it held under a job that kept finding auth-adjacent work.

**Adversarial review, again.** Two mutations survived a fully green gate — and one of them
was the single highest-blast-radius line in the job.

## Friction / gaps hit

**A measured number felt verified when only its magnitude was measured.** `costUsd` was real;
"cost" was an assumption. The product runs on a **subscription**, so it is a usage signal and
there is no per-exam money — yet "~$1.40 per exam, ~11 to break even" propagated through
three jobs' retros and the product context before the user corrected it. Corrected everywhere
now.
→ **Carry forward:** when a number comes from a tool, verify what it *means*, not just that
it is stable.

**A duplicated rule gets tested at the copy, not the original.** Inverting `roleOf` so an
absent role means *admin* passed the whole gate: the "legacy row" tests exercised the
listing's own inline ternary and a teacher route, never the guard itself. 68% of rows carry
no `role`, so that inversion would have made thousands of accounts admin, silently, green.

**Spec-compliant and misleading is still a bug.** QA found the console reporting 9069
teachers when ~3100 were accounts, so exams-per-teacher read ~3× low. Nothing was broken; the
number was one an operator would act on wrongly. The fix generalised into a rule the contract
now states: **every aggregate says what it was computed over.**

**Proving a guard by removing it has a cost.** Running the `Number.isFinite` mutant stored a
real `Infinity`, and the averages stayed poisoned after the revert until three documents were
deleted. Mutation testing against a shared live datastore writes real data.

**I committed a credential while asserting I hadn't.** A review verdict quoted the seeded
admin password in the sentence saying it appeared nowhere. Caught by the ship-step scan with
the branch still unpushed; the branch was rebuilt from a tree that never contains it, because
a credential in git history cannot be rotated. The scan works — the habit that made it
necessary is quoting a secret to say you didn't.

## Carried out of this job

- **The bearer credential remains** — the follow-on job replaces it. Until then an admin's id
  is a higher-value target than a teacher's, which is why bounding the surface was in scope.
- `CLAUDE_MAX_CONCURRENT` ships at **3**; the measured safe ceiling is **9**. Evidence
  recorded, change deliberately not applied by the job that measured it.
- The rate limiter is **in-process** — wrong the moment there are two instances.
- A residual enumeration channel (sign-up then recover) is disclosed rather than claimed
  closed.
- The shared dev store carries heavy probe pollution that dominates the KPIs an operator sees
  today. Fixtures, not defects — worth clearing before a demo.
- Still nothing deployed and nothing backed up (teacher-saas#4).
