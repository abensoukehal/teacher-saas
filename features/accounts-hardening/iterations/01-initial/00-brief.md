# Brief — accounts hardening + pricing reality

**Source:** https://github.com/abensoukehal/teacher-saas/issues/7

> **This is a starting claim, not a spec.** DISCOVERY's first duty is to try to falsify it
> against the real system. Every previous job's brief was wrong about something
> load-bearing, and each time one command in the first ten minutes caught it.

Two jobs deliberately accepted debt on the way to shipping accounts. The milestone that
justified accepting it — "two teacher friends trying the core loop" — is the same milestone
we are still at, but **what the store holds has changed**: it now carries credentials and
three jobs' worth of teacher work, not exam drafts.

## 1 · The teacherId is still a bearer value

`persistence-gaps` made the opaque id **recoverable**, not secret. Sign-in hands back the
same 32-hex `teacherId` the browser then sends as `x-teacher-id` on every request, and
`requireTeacher` accepts it on presentation.

So: **whoever holds that value reads and writes that teacher's exams**, forever. It does not
expire, it cannot be revoked, it is stored in `localStorage`, and it is sent as a plain
header. `project/CLAUDE.md` records this explicitly as "must not silently become the auth
model" — and it has been the auth model for two jobs.

There is also **no sign-out**, which QA graded a seed-gap: nothing in the product can end a
session, because there is no session to end.

## 2 · No rate limiting anywhere

Measured during `persistence-gaps` QA: 40 consecutive wrong-password sign-ins, no throttle,
no lockout, ~28 requests/second. `POST /api/auth/signin` is the obvious target, but
`/api/auth/recover` matters more — a recovery code is ~60 bits, which is fine against online
guessing *only if* online guessing is bounded.

`be` has nine dependencies and none of them is a rate limiter.

## 3 · Sign-up is an account-enumeration oracle

`POST /api/auth/signup` answers `409 email_taken` for a registered address and `201`
otherwise. One request per address, unambiguous.

Note what this is *not*: sign-**in** was deliberately built to be indistinguishable — same
body, same timing (a decoy scrypt runs on the unknown-email path), and QA measured the
timings to confirm it. That care is undone by the sign-up route next door.

## 4 · The pricing number nobody has acted on

Measured, not estimated:

| | cost | duration |
|---|---|---|
| `exam-subject` | **$0.645** | 128 s |
| `solution-sheet` | **$0.756** | 145 s |
| a finished exam + its correction | **~$1.40** | ~4.5 min |

Against a price point under consideration of 2,000 DZD/month (~$15), that is **~11 finished
exams to break even before any infrastructure** — down from ~23 before corrections existed.
The brief (§4) says the billing model must not be locked in before the teacher test, and
that iteration must never be metered. Both still hold. But the *number* has moved by half
and nothing has been recomputed against it.

**What is engineering here and what is not:** deciding the price is not an engineering job.
Making cost *answerable per teacher* is — the join key exists (`subjects.genCorrelationId`
and the solutions' own, both into `run-log.jsonl`) but nothing aggregates it, so the question
"what has this teacher cost us this month" requires parsing a JSONL by hand.

## Open questions for DISCOVERY — do not assume answers

- **What replaces the bearer id, and what breaks?** Every subject route, the promoted
  regression nets (131 `be` / 210 `fe` clauses), and `fe`'s entire storage layer assume
  `x-teacher-id`. A session that changes that header is not additive.
- **Cookie or token?** `fe` talks to `be` through a same-origin Vite proxy, which makes an
  httpOnly cookie plausible — but that is a claim to verify against the real config, not
  assume.
- **Does the id itself have to change?** Adopting rather than replacing is what let accounts
  ship without rewriting a document. The same trick may or may not apply twice.
- **Where does a rate limiter's state live?** In-process is trivial and wrong the moment
  there are two instances; store-backed is a write on every auth attempt.
- **Can sign-up stop leaking without hurting a real teacher?** The honest alternatives are
  known to be worse in other ways; this needs a decision, not an invention.
- **Is per-teacher cost aggregation in scope, or a separate reporting concern?**

## Constraints

From `project/CLAUDE.md` → Hard constraints, all still binding:

- **Arabic only, RTL throughout.** Any new state, any new message.
- **LaTeX never visible**, maths via KaTeX.
- **Don't over-engineer.** The milestone is still two teacher friends. A full OAuth stack is
  the wrong answer; so is leaving a permanent bearer credential in `localStorage`.

Plus what the last jobs established:

- `/api/generate` is frozen.
- `claude_auth` and `store_unavailable` are both 503 and mean opposite things — branch on
  `error.type`.
- A generation costs ~$0.65–0.76 and takes ~2 minutes. **Record one and replay it**; never
  call it in a test.
- Suites take their lane from `CHAR_BE_URL`/`CHAR_BE_LOG` and keep fixtures beside
  themselves — reaching outside a suite's own directory has broken promotion three times.
- Where a behaviour can race or repeat, write the concurrency clause from the start. Two
  data-loss bugs and one staleness bypass shipped because oracles only ever exercised the
  order a person would describe.

---

# SCOPE EXPANSION — added by the user, 2026-08-08 (before DISCOVERY)

The job is now four things, not one. Hardening is the floor the rest stands on: an admin
who "sees everything" is a privilege boundary, and there is currently no boundary — only a
bearer string. Building the console first would mean building it on sand.

## A · Per-exam cost and generation time, visible

Both numbers already exist and are already joined; nothing aggregates or displays them.
`run-log.jsonl` run lines carry `costUsd` and `durationMs`; `subjects.genCorrelationId` and
the solutions' own ids are the join keys. What is missing is reading them back as data
rather than by hand.

## B · Two roles: teacher and admin

- **admin** — `admin@app.com`, seeded, not self-registerable.
- Sees **everything**: every teacher, every exam, with cost and generation time per exam.
- Global KPIs: **avg cost per exam · avg generation time per exam · avg exams per teacher ·
  total exams**.

> **The seed password will NOT be committed.** The user supplied one; it goes in through an
> env var or a seeding script argument with the value documented outside the repo. A
> credential in git history is a credential you cannot rotate, and this repo is the one that
> now stores password hashes.

Note what this collides with: `getOwned` scopes ownership **inside the query** so that
another teacher's subject is indistinguishable from one that does not exist. That rule is
load-bearing and deliberately admits no exception. An admin read path is therefore a
*separate* path, never a relaxation of that one.

## C · Capacity: how many concurrent generations can we sustain?

`CLAUDE_MAX_CONCURRENT` is **3** by default (`config.ts:44`), enforced in `runner.ts:72`,
and `/health` reports `{active, queued, max}` — so the gate and its observability already
exist. The open question is what value the machine and the upstream API actually sustain.

**The premise needs correcting before the experiment is designed.** The user's target was
"an exam in 100 s". Measured, uncontended, three identical runs:

| | cost | duration |
|---|---|---|
| `exam-subject` | $0.6454 | **128 s** |
| `solution-sheet` | $0.7561 | **145 s** |

So at concurrency **1**, with nothing else running, the 100 s target is already missed by
28%. Concurrency can only make it worse. The honest questions are therefore:

1. What target *is* achievable at concurrency 1? (~130 s today.)
2. At what concurrency does p95 latency break whatever target is chosen?
3. Where does throughput actually collapse — the local process, the CLI, or upstream limits?
4. Would a faster generation (less context per invocation, a different skill shape) move the
   floor? That is a different job, but this one should produce the evidence for it.

**This experiment costs real money and cannot be replayed from a fixture** — measuring
concurrency requires concurrent *real* runs:

| concurrent runs | ≈ cost |
|---|---|
| 3 | $1.94 |
| 5 | $3.23 |
| 10 | $6.45 |
| 20 | $12.90 |

A budget must be agreed before any of it runs, and the experiment should be designed to
answer the most with the fewest paid runs.

## D · Pricing reality (unchanged from above)

~$1.40 per finished exam-plus-correction, ~11 exams to break even at ~$15/month. With A and
B in place this stops being a spreadsheet exercise and becomes a query.

## What DISCOVERY must not assume

- That the 100 s target is achievable. It is not, today, at any concurrency.
- That an admin role can reuse the teacher read paths. Ownership-in-the-query is a rule the
  product depends on.
- That KPIs can be computed from Mongo alone — cost and duration live in a **file**
  (`run-log.jsonl`), which is not a queryable store and is explicitly "not the datastore".
  Whether that stays true is a real design question with a migration behind it.
- That the admin console is small. It is a second UI surface, in Arabic and RTL, on a
  product whose only UI so far is a single builder screen.

---

# CORRECTION — there is no real cost (user, 2026-08-08)

**The product runs on a Claude subscription, not credit-based API billing.** So `costUsd`
in `run-log.jsonl` is the CLI's *notional API-equivalent*, not money that leaves anyone's
account. Nothing has been billed per exam.

This invalidates framing that has been carried since `persistence-gaps` and is written into
two retros, the product context and this job's own brief above:

- ~~"a finished exam-plus-correction costs ~$1.40"~~ — it costs **no marginal cash**.
- ~~"~11 exams to break even at ~$15/month"~~ — there is no per-exam COGS to break even
  against. **Correct these in `/document`.**

## What `costUsd` still is, and is not

- **Is:** a stable, comparable **usage signal**. Two identical runs measured $0.6454 both
  times, so it tracks work done and is fine for "which skill is heavy", "did a prompt change
  make this cheaper", and per-teacher usage share.
- **Is not:** cost of goods sold. It must never be presented to anyone — teacher or admin —
  as an amount owed or spent. Labelling a KPI "cost" in currency would be a lie the product
  tells its own operator.

## What this does to the economics

The binding constraint moves from **money** to **throughput**. A subscription buys a rate,
not a quantity, so the question "how many teachers can this serve" is answered by
concurrency and latency — not by dividing a price by a unit cost. **That makes the capacity
experiment the central economic question of this job, not a side investigation.**

## The experiment, as now scoped

Cost is not a constraint. The question is exactly: **how many concurrent teachers can
generate an exam while each finishes in under 100 s?**

Design notes that follow from the measurements already in hand:

- At concurrency 1 a 3-exercise composition took **128 s**, so the answer may well be
  **zero** for that exam shape. That is a finding, not a failure — and it makes exam *size*
  a variable worth holding constant or varying deliberately (a 2-exercise, 60-minute devoir
  is a different workload from a 3-exercise, 120-minute composition).
- `CLAUDE_MAX_CONCURRENT` is 3 today (`config.ts:44`), enforced in `runner.ts:72`, with
  `{active, queued, max}` already on `/health`. The gate and its observability exist; the
  experiment sets the number.
- **The real ceiling may be upstream, not local.** A subscription has its own rate limits,
  and hitting them degrades the operator's *own* Claude usage, not just this app. The
  experiment must therefore watch for upstream throttling as a distinct outcome from local
  saturation, and stop rather than push through it.
- Report **p50 and p95 per concurrency level**, plus queue depth — not a single average.
