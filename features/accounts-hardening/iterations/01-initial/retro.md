# Retro — accounts-hardening · 01-initial

Six sub-issues. The job answered a capacity question, corrected a costing error that had been
propagating for three jobs, and added a privilege level to a system that had none.

## The correction that mattered most

**There is no per-exam cost.** The product runs on a subscription, not credit billing, so
`costUsd` is the CLI's notional API-equivalent — a usage signal. Three jobs' worth of
documents said "~$1.40 per finished exam, ~11 exams to break even". That was wrong, and it
was **mine**: I measured a real number, attached the wrong meaning to it, and repeated it in
two retros and the product context until the user corrected it.

The lesson is not "check the billing model". It is that a **measured** number feels verified
even when only its magnitude was measured and its *meaning* was assumed. `costUsd` was real;
"cost" was the assumption.

Corrected in `project/CLAUDE.md` and both affected retros.

## The premise that was wrong in a useful direction

The brief asked how many concurrent teachers hold a 100 s bar, and the honest first answer
looked like *zero* — a measured exam took 128 s uncontended. Running it anyway found the
real shape: that 128 s was a 3-exercise, 120-minute composition. A 2-exercise, 60-minute
devoir takes **73 s**, and **nine** of them run concurrently while every one stays under
100 s. Twelve breaks it. No upstream throttling at any level.

**Exam size dominates, not concurrency** — the same system meets or misses the bar depending
on what the teacher asks for, which nobody had framed as a product decision.

→ The measurement was cheap and would have been skipped under a cost constraint that, as it
turns out, did not exist.

## Two mutations that survived a green gate

Review's mutation battery killed 4 of 6. The two survivors were the finding:

1. **`roleOf` inverted (absent → admin) passed the entire gate.** Two tests covered
   "legacy row" behaviour — but through the *listing's own inline ternary* and a teacher
   route. **Neither sent a null-role id through `requireAdmin`**, which is the guard's sole
   privilege decision. 68% of rows carry no `role`, so an inverted default would have made
   thousands of accounts admin, silently, with everything green.
   → **A duplicated rule gets tested at the copy, not the original.** `roleOf` and the
   listing's ternary say the same thing in two places; the tests hit the one that did not
   matter.

2. **Dropping `Number.isFinite` passed too** — the suite tested non-*number* rejection but
   never a reachable non-*finite* number. `1e999` is valid JSON that parses to `Infinity`.
   Proving it also demonstrated the harm: running that mutant **stored a real Infinity**, and
   the averages stayed poisoned after the source was reverted until three documents were
   deleted from Mongo.

## What QA found that review could not

Review probed the attacker. QA probed the **operator**, and found the dashboard misleading
while fully spec-compliant: `totalTeachers` counted anonymous sessions and signup decoys, so
*exams per teacher* read **0.49 instead of 1.42** — about three times low. Nothing was
"broken"; the number was simply one an operator would act on wrongly.

→ **Every aggregate must state what it was computed over.** `examsWithKpis` already did this
for usage and duration; the teacher metrics did not, and that inconsistency was the bug.
The teacher list had the same shape of flaw — uncapped at 9069 rows, then capped *and made
to say so*, because a truncated list that hides its truncation is a lie.

## The scope line, and why it held

Replacing the bearer `teacherId` with a real session touches 7 backend files, 11 promoted
suites and the frontend's whole storage layer. Doing it in the same job that introduces a
privilege level would mean changing the authentication mechanism and adding privilege
simultaneously — each masking the other's mistakes. It was **fenced** at DISCOVERY, stated in
the SEED and the contract, and the fence held under pressure from a job that kept finding
auth-adjacent work.

## Carried out

- **The bearer credential remains.** The follow-on job replaces it. Until then the admin's id
  is a higher-value target than a teacher's — which is why bounding the surface was in scope.
- `CLAUDE_MAX_CONCURRENT` ships at **3**; the measured safe ceiling is **9**. Raising it is a
  config change with evidence, deliberately not applied by the job that measured it.
- The rate limiter is **in-process** — correct for one instance, wrong for two.
- `roleOf` is duplicated by an inline ternary in the listing; folding them would let one test
  cover both.
- The shared dev store carries heavy probe pollution (~267 probe admin rows, ~5969
  anonymous/decoy rows) that dominates the KPIs an operator sees today. Fixtures, not
  defects, but worth clearing before any demo.
