# Whole-job retro — parallel-exercises

One iteration, `01-initial`. Its own retro carries the detail; this is what the arc taught.

## The job was wrong about itself, and that was the most valuable hour

The brief asked for speed. There was none: a 3-exercise composition measured **~114 s**
against the monolith's **~110 s**, and the repeat runs made it worse — identical work varies
by **2.7×**, and a fan-out costs `max`, not `mean`, so the expected wall clock is *above* the
single sample that was measured first.

Two throwaway skills and a handful of real runs, in the first hour of discovery, retired the
premise the whole job was built on. Everything after that was shaped by evidence rather than
by the brief.

What replaced the speed claim was better than it: **the first exercise is readable at
~68–91 s instead of ~110 s, and one unusable exercise costs one exercise instead of the whole
exam.** At a measured ~8% failure rate, roughly one exam in five had been arriving broken and
unrecoverable.

## The pattern worth keeping

**Falsify first, and build the cheapest thing that could kill the idea.** The prototype
skills were written to be thrown away and they were the highest-value artifact of the job.

**Write the concurrency clause before the feature works.** Mutating the store's
compare-and-set to a single attempt lost 2 of 3 fills, silently. That clause existed only
because an earlier job's retro made it a standing rule.

**Two adversarial gates, on a different model, looking at different things.** Review
(with code) proved a double-writer race by execution; QA (without code) found that an entire
exit criterion had never been built. Neither could have found the other's, and neither is
the model that wrote the code.

## The failure to carry forward

**A criterion vanished between the spec and the contract, and every gate stayed green.**
"Corrections stream per exercise" was in the SEED, was never given a transport in the
contract, so no sub-issue owned it and no oracle asserted it. It shipped absent and only
black-box QA noticed.

> The pipeline verifies *the contract* at every downstream step. Nothing verifies that the
> contract still covers *the SEED*. That check belongs before PLANNING seals, item by item.

Second, smaller, same shape: **fe-1 shipped the feature unreachable** — tested, correct, and
called by nothing — with its exit protocol fully satisfied. "A user can reach this" has to be
written down, or it belongs to nobody.

## Honest state at close

Shipped: two merged PRs, 209 clauses, all five exit criteria confirmed by black-box QA
against a live service, including recovery from a service restart mid-generation.

Known and accepted: the fan-out budget is per-exam rather than per-teacher; the corrections
backstop takes 5–10 minutes to give up on a dead batch; no organic truncation has ever been
observed rendering, so that path's evidence remains replay-driven; and only شعبة الرياضيات has a
curriculum file — `علوم تجريبية`, which nearly every measurement here used, has none. (An earlier
claim in this retro that the curriculum file was *missing entirely* was my error; it exists and
always has. The file documents its own limits: authoritative topic names, inferred per-topic notes.)
