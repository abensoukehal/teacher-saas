# be-3 — a malformed exercise fails alone, and retries itself

**status:** done · **tag:** hardening · **cycles used:** 4 of 10

## What changed

`stacks/teacher-be`, commit `55ecd86`, all of it in `src/routes/exams.ts`:

- `GENERATION_ATTEMPTS = 2` and `worthRetrying(code)`
- `generateSlot()` — the per-exercise engine: generate → verify → fill, retrying, then
  marking the slot `failed`
- `failedPlaceholder()` — same `id`/`label`/`points`, `statement: ""`, `status: "failed"`
- `regenerateOne()` — extracted here so be-4 reuses the identical engine
- `fanOut()` reduced to `Promise.all(assignments.map(generateSlot))`; every slot is
  independent, so one failing can never reject another

### The retry budget, and why it stops at two

Measured malformed rate is ~10% (SEED §10.1). One automatic retry takes an exercise from
~10% to ~1%, and a 3-exercise exam from a **27% chance of a hole** to about 3%. A third
attempt would buy a tenth of that while tripling the worst case for an exercise a teacher
is watching — and each attempt is a whole agent loop, 45–120 s and a concurrency slot.
Past two, the lever is be-4's on-demand regenerate, which costs nothing until asked for.

### What is *not* retried

`auth` and `not_installed` need a human, not a repeat. `timeout` has already spent the
full timeout budget — retrying doubles the wait to reach the same answer. Everything else
(an unusable result, or a generic `exit`) is an independent draw and is worth one more.

## What the oracle asserts

`features/parallel-exercises/tests/be/exercise-failure.characterization.test.js` — 15
clauses over three replay modes.

**Permanently truncated (`rec-fan-ex1.json` on every attempt):** ex1 is `failed` with an
empty statement; ex2 and ex3 are `ready` with real statements; `POST` was 201 and `GET` is
200 with no `error`; points still sum to 20 and ex1 keeps its label and its 5 points; no
`exercise_revisions` row; `rev` advanced 3 times, the failed marking included; and exactly
**2** attempts for ex1 against **1** each for ex2 and ex3.

**Recovered on retry (`trunc-ex1-once`):** ex1 ends `ready`, in exactly 2 attempts —
which is only reachable if the first result was refused and a second taken, so the retry
demonstrably precedes the `failed` marking rather than following it.

**Fenced but complete (`rec-trunc-9.json`):** ready in **one** attempt — see below.

### Mutation spot-check

`GENERATION_ATTEMPTS = 1` turns **5 clauses red**, including be-2's rogue-echo clause.

## A finding that corrects the SEED

**`rec-trunc-9.json` is not truncated.** Measured while writing the oracle:

| fixture | chars | braces `{` / `}` | verdict |
|---|---|---|---|
| `rec-fan-ex1.json` | 906 | 22 / 21 | cut mid-object — genuinely unrecoverable |
| `rec-trunc-9.json` | 763 | 18 / 18, closing ``` present | **complete** |

Its raw `JSON.parse` fails only because of the ```json fence, and stripping that fence is
exactly what `src/claude/json.ts` exists to do. So SEED §10.1's "2/13 ≈ 15% malformed"
counts one case the service already recovers; the **service-visible** rate is lower than
the raw-parse rate.

This does not change the design — one unrecoverable case in thirteen still puts a
3-exercise exam near a 20% hole rate without retry, and the retry is what makes it
shippable. But an oracle asserting `failed` here would have pinned a wasted agent loop as
correct behaviour, so the clause asserts the opposite: **ready, in one attempt**, with no
retry spent and no ``` surviving into the statement.

## A latent flake this surfaced in be-2

be-2's rogue-echo clause asserted the refused slot stays `pending`. That was true when
be-2 shipped, and be-3 changes the terminal state to `failed`. Worse, it had been passing
by *timing* — the poll stopped as soon as two exercises were ready, which is before the
retry finishes. Rewritten to wait for the fan-out to settle and assert `failed`, with the
load-bearing part unchanged and now unambiguous: the rogue points were never stored, and
the exam still sums to 20.

## Decisions the contract did not cover

1. **Which failures are worth a retry** (above). The contract says a malformed generation
   marks the exercise `failed`; it does not say a `503 claude_auth` should not be retried
   first. Retrying one is pure waste — a human has to re-login either way.
2. **The `failed` marking goes through the same fill path**, so it takes the CAS and
   cannot be lost to the race, and — because the outgoing slot is a `pending` placeholder —
   it writes no revision without needing a special case.
3. **`chars` is logged on a malformed run.** It is the one diagnostic that distinguishes
   truncation from a wrong shape, and it carries no teacher content.

## Exit protocol

- oracle green ×2 — 105/105 across all five suites, twice
- replay fixtures used, never a live call, in every clause of this suite
- mutation spot-check on the retry budget — 5 clauses red
- journal sealed

## review

**Verdict: approve-with-debt** (one oracle gap; the mechanism itself held everything
thrown at it). (Cross-model REVIEW gate, 2026-08-09.)

**Attack log.**
- Permanent truncation (`trunc-ex1`) driven live on a replay boot: ex1 `failed` with
  `""`, ex2/ex3 `ready`, sum still 20, 201/200 throughout, no error response. Held.
- Mutation `GENERATION_ATTEMPTS = 1` → **6 clauses red** (journal claimed 5; be-4's
  suite has since added one — stronger, consistent).
- The §10.1 correction (trunc-9 is fenced, not truncated) was re-verified during review
  reading: the oracle asserting *ready in one attempt* for the fenced case is the right
  polarity, and it is what stops a wasted loop being pinned as correct.
- The `failed` marking going through the same fill path (CAS + no revision) held under
  the width-6 race probes.

**Debt — an oracle gap found by mutation:** `worthRetrying` mutated to `return true`
(retry `auth`, `not_installed`, `timeout` too) **survives the entire gate, 105/105
green**. The design decision is documented in this journal and in the code comment, but
no clause defends it. Cost if regressed: a timing-out exercise would spend
2 × CLAUDE_TIMEOUT_MS (10 min at defaults) before failing, and an expired login would
spawn N useless retries per exam. Cheap clause: replay a `claude_auth`-shaped failure
and assert exactly **1** attempt.

---

## Review follow-up (2026-08-09)

**Mutation survivor closed: `worthRetrying → always true`.** Nothing asserted that `auth`
and `timeout` are excluded from the retry, so the exclusion could have been deleted in
silence. Two clauses now cover it, each on its own replay mode:

- **`auth-ex1`** — the fake returns `is_error: true` with an expired-login `result`, which
  `runner.ts` classifies `auth`. The slot is `failed` after **one** spawn. Retrying an
  expired login is pure waste: it fails every exercise of every exam and only a human
  `/login` changes that.
- **`timeout-ex1`** — the fake hangs past a 1.2 s `CLAUDE_TIMEOUT_MS` so the real SIGKILL
  path runs without waiting the production 300 s. One spawn. This is the expensive one:
  a retried timeout means a **10-minute** worst case for a single slot, holding a
  concurrency slot the whole way.

Both also assert the other two exercises still land and the exam still sums to 20 — a
failure a retry cannot fix still costs one exercise, not the exam.

The attempt tally is written at spawn, not at exit, which is what makes a killed run
countable.
