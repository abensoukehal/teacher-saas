# Stack spec — teacher-fe

> Filled by `/planning` 2026-08-08 from the locked SEED.

## Scope recap
- **Modules:** `src/lib/api.ts` · `src/App.tsx` · `src/components/AdminConsole.tsx` (new) ·
  `src/App.css`
- **Contract:** `contracts/fe-be-admin.contract.md`

## Current behavior baseline

| Area | Today |
|---|---|
| generation envelope | `generateExam` keeps `correlationId`/`costUsd` but only threads the id |
| roles | none — one UI for everyone |
| admin | nothing |

### Harness
- Suites in `features/accounts-hardening/tests/fe/`, `*.characterization.test.tsx`.
- **Never call `/api/generate`.** Mock it or replay a fixture kept BESIDE the suite.
- **Arabic only, RTL.** No LaTeX visible. Every new string Arabic.
- Race clauses written from the start — `fireEvent` flushes React between events, so a
  double-click clause must dispatch inside one `act()` or it proves nothing.

---

## Sub-issues

```yaml
---
kind: sub-issue
id: fe-1
parent: i1
stack: fe
status: done
depends_on: [be-1]
estimate: S
---
```

### fe-1 — stop discarding the two numbers

1. **Intent:** cost and duration arrive on every generation and are dropped; storing them is
   what makes the operator's questions answerable.
2. **Ground truth:** `grep -n "costUsd" src/lib/api.ts` — received, never sent on.
3. **Delta:** `src/lib/api.ts` (`createSubject` sends both), `src/App.tsx` (thread them from
   the run). **Frozen:** everything else.
4. **Oracle:**
   - *positive:* after a generation, the `POST /api/subjects` body carries `costUsd` and
     `durationMs` from that run's envelope.
   - *positive:* the legacy-draft adoption path sends **null** for both — an adopted draft has
     no generation to measure, and inventing a zero would corrupt every average.
   - *negative:* rendering is unchanged; the exam view is byte-identical.
5. **Boundaries:** contract §1. Budget 10.
6. **Exit:** ask-when = the values would have to be invented for any path.

```yaml
---
kind: sub-issue
id: fe-2
parent: i1
stack: fe
status: done
depends_on: [be-3]
estimate: L
---
```

### fe-2 — the admin console

1. **Intent:** an operator who cannot see their own system cannot run it.
2. **Ground truth:** no admin UI exists; signing in as any account lands on the builder.
3. **Delta:** `src/components/AdminConsole.tsx` (new), `src/lib/api.ts` (admin calls),
   `src/App.tsx` (route to it when the signed-in account is an admin), `src/App.css`.
   **Frozen:** `ExamView`, `RefinePanel`, `SolutionView`, the print paths.
4. **Oracle:**
   - *positive:* an admin sees the console; a teacher **never** does — assert the teacher UI
     renders and no admin call is made.
   - *positive:* the four global KPIs render, plus **what they were computed over**
     (`examsWithKpis`) — an average with no denominator is a misleading number.
   - *positive:* cost is rendered as a **usage figure, never with a currency symbol.** Assert
     no `$`/`USD`/`دج` appears next to it. There is no per-exam cash.
   - *positive:* teacher and exam lists render, newest first, with per-exam cost and duration.
   - *positive (each state):* loading · empty (a fresh system shows zeroes, not an error) ·
     `403` · `store_unavailable` retryable · success.
   - *negative:* **no hash or password field ever reaches the DOM** — assert the rendered
     output contains no `scrypt$`.
   - *negative:* every string Arabic; RTL intact; no LaTeX.
5. **Boundaries:** contract §3. Budget 10.
6. **Exit:** ask-when = a KPI has no defined empty-system value · the console would need a
   teacher-scoped route.
