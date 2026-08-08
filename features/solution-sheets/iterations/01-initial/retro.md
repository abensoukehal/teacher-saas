# Retro — solution-sheets · 01-initial

Four sub-issues, one paid generation, one reopen. Roadmap item 1 ships.

## What the brief got wrong, and what that cost

The brief said the capabilities live at `teacher-be/.claude/skills/`. They live at
`teacher-be/agent/.claude/skills/` — `config.ts` points the CLI at `<repo>/agent`. **The
product context said the same wrong thing, in two places, and had done for two prior jobs.**
One `ls` in the first ten minutes of DISCOVERY caught it. Corrected now in both.

The brief's *substance* held: "the unit of capability is a SKILL.md" is true, and registration
really is just the directory existing — adding it took `/api/skills` from two entries to three
with zero `src/` change.

## The number that decided the design

**~$0.20 of per-invocation overhead before any work happens**, and `exam-subject` measured at
$0.645. That single fact ruled out naive per-exercise generation (a 3-exercise exam would burn
~$0.60 of pure overhead) and made granularity the whole design question rather than a detail:
**one run for the exam, stored per exercise.**

Reading `agent/CLAUDE.md`'s cost discipline section was worth more than any amount of
reasoning about the feature.

## The bug review caught, and why the oracles missed it

Staleness was hashed from the **live** exercise at store time. Generating takes ~145 s, so a
refine landing in that window — or from a second device, which accounts now make ordinary —
stored the new statement's hash against an old answer, and the correction was served as
**current**. The exact harm the mechanism exists to prevent.

Every oracle exercised store-then-refine. **None exercised refine-then-store.** The order that
breaks it is the order nobody writes down, because it is not how a person describes the
feature. The fix delivers the statement rather than inferring it, and the failure mode is now
fail-safe: a statement matching nothing is permanently stale, never falsely current.

→ **Carry forward:** when a value can be computed at two different times, write a clause for
the *other* time. "Derived on read" is only honest if the input is the one the answer was
written for.

## The verification bug that would have corrupted the skill

Three property checks reported FAIL on output that was correct:
LaTeX commands counted as "Latin prose"; splitting on `$` puts `$$…$$` display math on an even
index so it reads as prose; the same parity error reported 174 phantom Arabic-in-math
violations. **Strip display math first, then inline.**

Written any of those ways the check would have failed forever on good output — and the natural
response to a red check is to *fix the thing being checked*. That is how a good skill gets
edited into a worse one. This is a specific instance of a general risk with generated material:
the oracle is prose-shaped, and prose-shaped oracles are easy to get subtly wrong.

## Two things the agents caught on themselves

- The `fe` agent's first double-click mutation **was not caught** — `fireEvent` flushes React
  between events, so by the second press the control was already disabled and the clause was
  testing the `disabled` attribute rather than the guard. Repaired to dispatch inside one
  `act()` and re-verified against the same mutant. Third time this exact shape has appeared.
- A baseline had to be refreshed mid-job because an unrelated merged fix (`**bold**` now
  renders as bold) legitimately changed the exam's printed HTML. That is the move most likely
  to hide a regression, so it was earned: this job's diff touches neither `ExamView` nor
  `katex.tsx`, and the bold run is the only divergence. Recorded in the suite, not silently.

## Cost, stated plainly

A correction costs **$0.756** — *more than the $0.645 exam it corrects*. A finished
exam-plus-correction is ~$1.40 against a price point under consideration of ~$15/month:
**~11 exams to break even, down from ~23.** Recorded per correction and deliberately not
metered, per the decision taken at DISCOVERY. It is the largest single change to unit
economics the product has made, and pricing has not accounted for it.
