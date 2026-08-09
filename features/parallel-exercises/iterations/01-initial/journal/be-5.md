# be-5 — a fan-out gets a budget, not a bigger cap

**status:** done · **tag:** hardening · **cycles used:** 3 of 8

## What changed

`stacks/teacher-be`, commit `abcf269`:

| file | change |
|---|---|
| `src/config.ts` | `claude.fanoutBudget` — `CLAUDE_FANOUT_BUDGET`, default **2** |
| `src/claude/runner.ts` | `RunOptions.group`, the per-group semaphore, `fanoutBudget()`, `fanoutLoad()`; `runClaude` splits into the group gate + `runGated` |
| `src/app.ts` | `/health` gains a **top-level** `fanout` |
| `src/routes/exams.ts` | every fan-out and regenerate run passes `group: subjectId` |

**The default global cap is untouched at 3.** The capacity study measured a safe ceiling
of 9 and deliberately left raising it to a human with the evidence in hand;
`project/CLAUDE.md` records "the concurrency cap stays" as a must-not-undo. The budget is
an *additional* bound underneath it.

### The mechanism

The per-exam gate is acquired **before** the global one and released after — one lock
ordering, always. Taking a global slot and then waiting on the group would hold a
machine-wide resource while doing nothing, starving exactly the teachers this gate exists
to protect.

```
effective budget = max(1, min(configured, globalCap - 1))
```

The clamp is the whole guarantee: **at least one loop is always reservable by somebody who
is not this exam.** An operator setting `CLAUDE_FANOUT_BUDGET=99` would otherwise silently
remove the property the gate exists for. The floor of 1 is there because a budget of 0
would deadlock every fan-out rather than throttle it.

The group map deletes its entry when the last run of an exam releases, so it does not leak
an entry per exam ever generated.

## What the oracle asserts

`features/parallel-exercises/tests/be/fanout-budget.characterization.test.js` — 11 clauses.

**The budget binds.** A 6-exercise fan-out is run while `/health` is sampled every 40 ms;
peak observed `claude.active` ≤ 2. A guard clause first asserts the probe collected more
than five samples and saw a non-zero peak, so the bound cannot pass vacuously on a sample
of zeroes. Every sample is also ≤ the global cap — the budget must never become the *only*
bound. And the exam still completes all six `ready`, summing to 20: a budget throttles, it
does not drop work.

**Nobody is starved.** With a 6-exercise fan-out in flight, a second teacher's `POST
/api/exams` returns 201 with its skeleton. Stated as a starvation bound, not a latency
claim (SEED §10.2 forbids a timing oracle): six replayed exercises at 700 ms each cannot
finish inside the two-second bound, so the plan demonstrably did not queue behind them.

**It cannot be configured away.** Budget 99 against cap 3 clamps to 2; budget 0 clamps to
1 and a fan-out still completes.

**The cap's default is pinned against `config.ts` source**, because every instance in
these suites passes the value explicitly and would never notice the *default* moving.

**`/health`'s `claude` sub-object is asserted NOT to have grown** — see below.

### Mutation spot-checks

| mutation | result |
|---|---|
| per-exam gate becomes a no-op | **1 clause red** — peak reaches the global cap |
| drop the clamp | **2 clauses red** — 99 and 0 both pass through |

## Decisions the contract did not cover

1. **`fanout` is top-level on `/health`, not inside `claude`.** The promoted regression
   net pins `claude`'s keys as *exactly* `{ok, detail, active, queued, max}`
   (`project/tests/be/persistence/health-store:123`). Adding a field there would redden
   the mainline gate after merge. `authRateLimit` already sits top-level for the same
   reason, so this follows an established precedent rather than inventing one — and this
   suite adds a clause asserting the `claude` object did **not** grow, so the constraint is
   now defended from this side too.

2. **`fanout` reports `budget` *and* `configured` *and* `globalCap`.** An operator whose
   configured value is being clamped needs to see both numbers, or the clamp looks like the
   service ignoring its configuration. `groups` (exams currently fanning out) comes along
   because it is the one number that says whether the gate is doing anything right now.

3. **The plan run is not grouped.** It is one loop per request and it happens before a
   subject id exists. A burst of plans is what the global cap is for.

4. **Regenerate is grouped too**, by subject id. A teacher regenerating several exercises
   of one exam at once is bounded by the same budget — which falls out of the design rather
   than needing its own rule.

## Exit protocol

- oracle green ×2 — 105/105, twice
- `/health` shape diffed: `claude` unchanged, `fanout` added top-level
- mutation spot-checks on the gate and the clamp — 3 clauses red between them
- the default cap verified unchanged at 3, pinned against source
- journal sealed
