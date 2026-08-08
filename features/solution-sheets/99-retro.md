# 99 — Retro (feeds workflow evolution)

One iteration. Roadmap item 1 — solution sheets with the grading scale — ships.

## What worked

**Falsifying the brief in the first ten minutes.** One `ls` found that the capabilities do
not live where the brief *and the product context* said they did. The context had carried
that error through two prior jobs. DISCOVERY's first duty keeps paying.

**Reading the cost discipline before designing.** `agent/CLAUDE.md` records ~$0.20 of
per-invocation overhead before any work. That single number ruled out per-exercise generation
and turned granularity from a detail into the design. No amount of reasoning about the feature
would have produced it.

**The architectural call to store rather than generate.** `be` stores a correction; `fe` calls
the frozen `/api/generate` and posts the result, exactly as exams work. One code path can
invoke the CLI, and the storage routes are testable without paying $0.76 a run.

**Cross-model review.** It reproduced a staleness bypass at the API that all four oracles
missed, and it was the difference between shipping the feature and shipping the *appearance*
of the feature — staleness is the whole trustworthiness story here.

## Friction / gaps hit

**Oracles test the order a person would describe.** Every clause exercised store-then-refine;
none exercised refine-then-store, which is the order that breaks it. When a value can be
computed at two different times, write a clause for the *other* time.

**Prose-shaped oracles are easy to get subtly wrong.** Three property checks failed on correct
output — LaTeX commands counted as Latin prose, and `$`-splitting misreading `$$…$$`. A red
check invites you to fix the thing being checked, which here would have meant editing a good
skill into a worse one. Generated material makes this risk structural, not incidental.

**The `fireEvent` race-clause trap appeared for the third time.** React flushes between
events, so a double-click clause proves the `disabled` attribute rather than the guard. It
needs to be in the fe stack spec as a standing note, not rediscovered each job.

**A baseline needed refreshing mid-job** because an unrelated merged fix changed the exam's
printed HTML. Refreshing a byte-identical baseline is the move most likely to hide a
regression, so the provenance was proven and recorded rather than assumed.

## Carried out of this job

- **Cost:** a correction is **$0.756**, *more than the $0.645 exam*. Exam-plus-correction is
  ~$1.40 against a ~$15/month price point — **~11 to break even, down from ~23.** Recorded,
  not metered, by decision. Pricing has not accounted for it and should.
- Duplicate `exerciseId` within one batch is accepted last-wins; the contract is silent.
- The skill's oracle pins **one** recording. It proves that generation was well-shaped, not
  that the skill reliably is. Variance across runs is unmeasured and would cost a run each.
- Still nothing deployed and nothing backed up (teacher-saas#4).
