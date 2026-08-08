# SEED — accounts hardening, admin role, and per-exam KPIs

> **Phase:** DISCOVERY. **Input:** `00-brief.md`. **Output:** this file.
> **Status: LOCKED 2026-08-08.**

## Anchor
- **Job kind:** feature
- **Upstream:** https://github.com/abensoukehal/teacher-saas/issues/7

## Problem (enriched)

Two jobs accepted auth debt on the way to shipping accounts, on the grounds that the store
held exam drafts. It now holds **credentials and three jobs' worth of teacher work**, and the
product is about to grow an **admin who sees everything** — a privilege boundary on a system
that currently has no boundary, only a bearer string that never expires and cannot be
revoked.

Separately, the operator cannot answer basic questions about their own system: what an exam
took to generate, how much work a teacher represents, how many teachers can be served at
once. The data exists; nothing reads it back.

**The capacity question turned out to be the important one** — see H5. Because the product
runs on a subscription rather than credit billing, throughput is the binding constraint, not
money.

## Current reality — the planning kit

### 1 · Acting-surface map

| Stack | Path | Role | Change |
|---|---|---|---|
| be | `src/teacher.ts:41` | `requireTeacher` — accepts a bearer id on presentation | modify |
| be | `src/routes/auth.ts` | signup/signin/recover; **`409 email_taken` leaks existence** | modify |
| be | `src/store/teachers.ts` | the `teachers` collection — no role field | modify |
| be | `src/routes/subjects.ts` | every subject route, ownership scoped in-query | read-only (**do not relax**) |
| be | `src/store/subjects.ts:create` | where `costUsd`/`durationMs` would land | modify |
| be | `src/claude/runner.ts:66-84` | the concurrency semaphore + waiting queue | read-only |
| be | `src/config.ts:44` | `CLAUDE_MAX_CONCURRENT`, default **3** | read-only |
| be | `src/routes/` (new) | admin read surfaces | new |
| fe | `src/lib/api.ts` | holds `x-teacher-id`; already receives `costUsd`+`durationMs` | modify |
| fe | `src/App.tsx`, `persist.ts` | identity storage | modify |
| fe | (new) admin console | a second UI surface, Arabic + RTL | new |

### 2 · Baseline recordings

Captured 2026-08-08, lane slot 5 (`be` :9500, `fe` :10500).

| Surface | Re-run | Recorded |
|---|---|---|
| role concept | `grep -rniE '\brole\b\|isAdmin' src/` | **none** — every hit is an ARIA attribute |
| header blast radius | `grep -rl teacherId stacks/teacher-be/src` | **7 files**; 11 promoted suites reference `x-teacher-id` |
| subject document | `mongosh … subjects.findOne()` | `_id, teacherId, subject, controls, createdAt, updatedAt` (+`genCorrelationId`,`rev` on newer) — **no cost, no duration** |
| the generate envelope | recorded fixture | carries `costUsd`, `durationMs`, `correlationId`, `sessionId` — **fe already receives both KPI numbers** |
| concurrency gate | `curl -s :9500/health` | `{active, queued, max}` — `max` from `CLAUDE_MAX_CONCURRENT`, default 3 |
| proxy | `vite.config.ts:26-28` | `/api` proxied `changeOrigin` — **same-origin from the browser**, so an httpOnly cookie is viable |

### 3 · Perimeter consumers

| Consumer | Surface | Note |
|---|---|---|
| promoted regression nets | 131 `be` + 210 `fe` clauses | 11 suites assert `x-teacher-id` behaviour directly |
| `fe` storage layer | `teacher.id.v1` in `localStorage` | the id is read on boot and sent on every call |
| every subject/solution/revision route | `requireTeacher` | ownership scoped **inside the query** — an admin path must not relax it |

### 4 · End-to-end trace (the capacity experiment)

Real generations, `exam-subject`, 2 exercises / 60 min / devoir, cap raised to 16:

| concurrent | p50 | p95 | max | under 100 s | failures |
|---|---|---|---|---|---|
| 1 | 73 s | — | 73 s | 1/1 | 0 |
| 3 | 76 s | 76 s | 81 s | 3/3 | 0 |
| 6 | 73 s | 78 s | 91 s | 6/6 | 0 |
| **9** | **68 s** | **87 s** | **93 s** | **9/9** | 0 |
| 12 | 82 s | 110 s | 113 s | **10/12** | 0 |

Contrast, same machine: a **3-exercise / 120-min composition takes 128 s at concurrency 1** —
it never meets 100 s at any concurrency.

### 5 · Observability baseline

- **Visible:** `run-log.jsonl` run lines (`skill`, `costUsd`, `durationMs`, `ok`);
  `/health` `{active, queued, max}`; structured `store.write` lines.
- **Blind spots this job closes:** per-exam cost/duration as *data* (today it is a file
  nobody parses); per-teacher usage; global KPIs; who is an admin.
- **Blind spot it must not create:** an admin read path that bypasses ownership scoping
  without being obviously, separately, a privileged path.

### 6 · Unknowns ledger

| Unknown | Disposition |
|---|---|
| Is <100 s reachable? | **resolved — yes, for a small exam.** 73 s for 2×60-min devoir; 128 s for 3×120-min composition. **Exam size dominates, not concurrency.** |
| How many concurrent under 100 s? | **resolved — 9.** 9/9 hold; 12 gives 10/12 and p95 110 s. |
| Is the ceiling upstream? | **resolved — no.** Zero failures and zero throttling at every level up to 12; the limit found is latency, not rate limiting. |
| Can KPIs come from Mongo alone? | **resolved — yes, if stored.** `fe` already receives `costUsd` and `durationMs`; storing them mirrors `genCorrelationId` exactly. The JSONL is not needed and stays "not the datastore". |
| Is a cookie viable? | **resolved — plausible.** `/api` is same-origin through the proxy. Must be re-verified against a production topology, which does not exist yet. |
| Does replacing the header stay additive? | **resolved — NO.** 7 `be` files, 11 promoted suites, and `fe`'s whole storage layer. This is the job's biggest risk. |
| What does `costUsd` mean under a subscription? | **resolved — a usage signal, not money** (user, 2026-08-08). Never render it as currency. |
| Admin password handling | **resolved — env/script seeded, never committed.** |

### 7 · Sweep statement

- **Swept:** the auth surface, the concurrency semaphore and its config, the subject
  document shape, the generate envelope, the Vite proxy, both promoted nets' reliance on the
  header, and the live capacity curve at 1/3/6/9/12.
- **Not swept:** production topology (none exists — cookie viability is verified only on the
  dev proxy); the admin UI's visual design; any rate-limiter library (none is installed);
  whether a bigger exam's curve differs in shape from the small one's.

## Solution direction (locked)

**Four strands, in dependency order. Hardening is the floor; the console stands on it.**

**1 · Per-exam KPIs — store what is already received.** `costUsd` and `durationMs` land on
the subject at create time, exactly as `genCorrelationId` did. Small, additive, no migration:
absent reads as null. This is what makes every later KPI a query rather than a file parse.
- *Why not aggregate from `run-log.jsonl`:* it is a file, explicitly "not the datastore", and
  it is per-lane — the worktree's copy had zero cost lines while the main checkout had three.

**2 · A real role.** `teachers` gains `role: "teacher" | "admin"`, defaulting to teacher.
`admin@app.com` is seeded by a script taking the password from the environment. Admin is
**not self-registerable** — sign-up always creates a teacher.

**3 · Admin read surfaces — separate paths, never a relaxed teacher path.** Ownership scoped
inside the query is load-bearing and admits no exception; admin gets its own routes behind
its own guard. Global KPIs: total exams, avg cost per exam, avg generation time per exam, avg
exams per teacher — plus a teacher list and an exam list carrying per-exam cost and duration.
- **Cost is displayed as a usage figure, never as currency.** There is no per-exam cash.

**4 · Bound the auth surface.** Rate-limit the auth routes (`signin`, `recover` especially —
a 60-bit recovery code is only safe against *bounded* guessing). Close the sign-up
enumeration oracle. **Replacing the bearer header with a session is explicitly NOT in this
job** — see below.

### The scope line, and why it is drawn here

Turning the bearer id into a real session touches 7 `be` files, 11 promoted suites and all of
`fe`'s storage layer. Doing it *in the same job* that introduces an admin role would mean
changing the authentication mechanism and adding a privilege level simultaneously — the two
changes most likely to produce a security hole when combined, each masking the other's
mistakes.

So this job **bounds** the existing credential (rate limits, no enumeration, a real role
check) and a follow-on job **replaces** it. The bearer risk is not fixed here; it is fenced,
and the fence is stated rather than implied.

## Scope & boundaries

- **In:** cost/duration on the subject · `role` on teachers + a seeded admin · admin-only
  read surfaces + global KPIs · an admin UI (Arabic, RTL) · rate limiting on auth · closing
  the sign-up enumeration oracle · the capacity findings written into the product context.
- **Out:** replacing the bearer header with a session (**own job**) · pricing decisions ·
  deploy/backups (teacher-saas#4) · making generation faster (the 128 s composition is a real
  finding and its own job).
- **Stacks:** `be` · `fe`.

## Risks

- **An admin route that reuses a teacher query is a data-leak bug**, not a shortcut. The
  separation must be structural, not a boolean inside an existing handler.
- **The bearer credential remains** for the life of this job. An admin bearer id is a
  higher-value target than a teacher's, which is exactly why bounding the auth surface is in
  scope and why the replacement is the next job rather than never.
- **`CLAUDE_MAX_CONCURRENT` defaults to 3** while the measured safe ceiling is **9**. Raising
  it is a config change this job should recommend with evidence, not silently apply.
- A local `.env` with `CLAUDE_MAX_CONCURRENT=16` was written for the experiment; it is
  gitignored and must not be mistaken for a shipped default.

## Investigation journal

- **H1 — "replacing the bearer id is the core of this job."**
  → test: count references. → result: 7 `be` source files, 11 promoted suites, `fe`'s entire
  storage layer. → belief: **refined into a scope decision.** It is too big to combine with
  introducing a privilege level; combining them is how holes get made. Fenced, not fixed.

- **H2 — "there may already be a role concept."** → test: grep. → result: none; every hit is
  an ARIA attribute. → belief: killed, nothing retires.

- **H3 — "KPIs need `run-log.jsonl` to become queryable."**
  → test: read the generate envelope and the subject document. → result: the envelope already
  carries `costUsd` and `durationMs`, and `fe` already receives both — it simply discards them,
  exactly as it once discarded `correlationId`. → belief: **killed.** Storing two numbers at
  create time removes the need to touch the log at all.

- **H4 — "an httpOnly cookie may not be possible."** → test: read `vite.config.ts`. → result:
  `/api` is proxied with `changeOrigin`, so the browser sees one origin. → belief: kept, with
  the honest limit that this is the dev topology and production does not exist yet.

- **H5 — "100 s is unreachable, so the capacity question is moot."**
  → test: run it. A small exam (2 exercises, 60 min devoir) at concurrency 1.
  → result: **73 s.** The 128 s figure was a 3-exercise, 120-minute composition. **Exam size
  dominates, not concurrency.** Sweeping 3/6/9/12: 9 concurrent hold 100 s for every request
  (p50 68 s, max 93 s); 12 gives 10/12 with p95 110 s. Zero failures and zero upstream
  throttling anywhere.
  → belief: **the brief's premise was wrong in the useful direction.** The target is
  reachable, the answer is **9 concurrent teachers**, and the real lever on latency is the
  size of the exam being asked for — which is a product decision nobody had framed as one.

## Ready-for-PLANNING
- [x] brief tested, not assumed (H1, H3, H5 all changed the job)
- [x] direction agreed and locked · acting-surface map · recordings · consumers · trace ·
      obs · unknowns dispositioned · sweep stated
