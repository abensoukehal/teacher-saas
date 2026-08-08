# Stack spec — teacher-be

> Filled by `/planning` 2026-08-08 from the locked SEED.

## Scope recap
- **Modules:** `src/store/subjects.ts` · `src/store/teachers.ts` · `src/routes/auth.ts` ·
  `src/routes/admin.ts` (new) · `src/teacher.ts` · `src/ratelimit.ts` (new) ·
  `scripts/seed-admin.mjs` (new)
- **Contract:** `contracts/fe-be-admin.contract.md`
- **Not in scope:** replacing the bearer header (fenced — own job) · deploy · making
  generation faster.

## Current behavior baseline

| Surface | Today |
|---|---|
| roles | **none** — every `role` hit in the tree is an ARIA attribute |
| `subjects` doc | no `costUsd`, no `durationMs` |
| `/api/generate` envelope | already carries `costUsd` + `durationMs` |
| `POST /api/auth/signup` duplicate | `409 email_taken` — a clean enumeration oracle |
| auth rate limiting | **none**; ~28 req/s measured with no throttle |
| `CLAUDE_MAX_CONCURRENT` | default **3**; measured safe ceiling is **9** |

### Test harness — read before writing a test
- Black-box over HTTP; `*.characterization.test.js`; every sub-issue owns a route.
- `const { describeIfLane } = require("guard"); const BE = process.env.CHAR_BE_URL || "…";`
  **Never hardcode a lane.** Fixtures live BESIDE the suite, read with `__dirname`.
- A hollow gate is RED in job mode (WF-82) — `tools/dev up -d` first.
- **NEVER call `/api/generate`.** ~$0.65-equivalent and ~73–145 s. Replay a fixture.
- Where a behaviour can race or repeat, write the clause from the start.

## Data model changes

| Store | Change | Migration |
|---|---|---|
| `subjects` | `costUsd`, `durationMs` — both nullable | none; absent reads null |
| `teachers` | `role: "teacher"\|"admin"` | none; absent reads "teacher" |

---

## Sub-issues

```yaml
---
kind: sub-issue
id: be-1
parent: i1
stack: be
status: done
depends_on: []
estimate: S
---
```

### be-1 — store the two numbers the operator cannot currently see

1. **Intent:** cost and generation time already reach `fe` on every generation and are thrown
   away; without them no KPI is a query.
2. **Ground truth:** `mongosh … subjects.findOne()` → no `costUsd`, no `durationMs`. The
   recorded envelope carries both (`costUsd 0.756058`, `durationMs 145467`).
3. **Delta:** `src/store/subjects.ts` (fields + `create` + `toRecord`/`toSummary`),
   `src/routes/subjects.ts` (accept both, optional). **Everything else frozen.**
4. **Oracle:**
   - *positive:* create with both → stored and echoed on create/get/list.
   - *positive:* omitted → `201`, stored `null` (keeps it additive; `fe` may merge later).
   - *positive:* a non-number is rejected `400` — a bad KPI is worse than a missing one.
   - *negative:* documents written before this read back `null` and are **not rewritten**
     (`updatedAt` unchanged).
   - *negative:* the subject response is a **superset** of the recorded shape.
5. **Boundaries:** contract §1. `costUsd` is a usage figure — never validated or described as
   currency. Budget 10.
6. **Exit:** oracle green + freeze + `tools/ci be --slug accounts-hardening` green ·
   ask-when = a migration seems needed (it must not be).

```yaml
---
kind: sub-issue
id: be-2
parent: i1
stack: be
status: done
depends_on: []
estimate: M
---
```

### be-2 — a real role, and an admin that cannot be self-registered

1. **Intent:** an admin who "sees everything" is a privilege boundary; there is no boundary
   today, only a bearer string.
2. **Ground truth:** `grep -rniE '\brole\b|isAdmin' src/` → nothing but ARIA attributes.
3. **Delta:** `src/store/teachers.ts` (`role`, default teacher; `findByTeacherId` used by the
   guard), `src/teacher.ts` (`requireAdmin`), `scripts/seed-admin.mjs` (new).
   **`src/routes/subjects.ts` is FROZEN** — no ownership check may be relaxed.
4. **Oracle:**
   - *positive:* the seed script creates `admin@app.com` with `role:"admin"` from
     `ADMIN_PASSWORD`; re-running it does not duplicate and does not reset the password.
   - *positive:* **the password never appears in the repo** — grep the whole tree for the
     seeded value and assert zero hits (the script reads it from the environment).
   - *positive:* signup **always** yields `role:"teacher"`, even when the body carries
     `role:"admin"` — a request field must not influence privilege.
   - *positive:* `requireAdmin` → `401 teacher_required` for an unknown id, `403 forbidden`
     for a valid non-admin teacher, pass for the admin. **401 and 403 stay distinct.**
   - *negative:* every existing teacher row reads back as a teacher without being rewritten.
   - *negative:* the teacher-facing routes behave identically for the admin — an admin is not
     a super-teacher on those paths.
5. **Boundaries:** contract §2. Budget 10.
6. **Exit:** ask-when = privilege would need to be inferred from anything but the stored role ·
   the seed value would have to be written to a file.

```yaml
---
kind: sub-issue
id: be-3
parent: i1
stack: be
status: done
depends_on: [be-1, be-2]
estimate: M
---
```

### be-3 — admin read surfaces and the global KPIs

1. **Intent:** the operator cannot answer basic questions about their own system.
2. **Ground truth:** no `/api/admin/*` route exists; `curl` returns the SPA 404 envelope.
3. **Delta:** `src/routes/admin.ts` (new), mounted in `src/app.ts`.
   **`src/routes/subjects.ts` FROZEN.**
4. **Oracle:**
   - *positive:* `/api/admin/kpis` returns totals and averages, and **`examsWithKpis`** —
     averages must state what they were computed over, since older exams carry `null`.
   - *positive:* averages ignore null-KPI exams rather than counting them as zero. Seed one
     exam with KPIs and one without; assert the average equals the first, not half of it.
   - *positive:* `/api/admin/teachers` returns counts per teacher; `/api/admin/exams` returns
     newest-first, capped at 200.
   - *negative — THE CLAUSE THAT MATTERS:* **no hash is ever returned.** Assert
     `JSON.stringify(response)` contains neither `scrypt$` nor the substrings
     `passwordHash`/`recoveryHash`.
   - *negative:* a teacher (non-admin) gets `403` on every admin route; an unknown id `401`.
   - *negative:* admin routes do **not** relax ownership anywhere — a teacher still cannot
     read another teacher's subject.
   - *negative:* empty system → zeroes and empty lists, never a 404 or a divide-by-zero.
5. **Boundaries:** contract §3. Budget 10.
6. **Exit:** ask-when = a KPI cannot be computed without changing a teacher route.

```yaml
---
kind: sub-issue
id: be-4
parent: i1
stack: be
status: done
depends_on: []
estimate: M
---
```

### be-4 — bound the auth surface

1. **Intent:** a ~60-bit recovery code is safe against online guessing **only if guessing is
   bounded**, and sign-up currently confirms which addresses exist.
2. **Ground truth:** no limiter is installed (`be` has 9 deps); QA measured 40 consecutive
   wrong-password sign-ins at ~28 req/s with no throttle. `POST /api/auth/signup` on a
   registered address → `409 email_taken`.
3. **Delta:** `src/ratelimit.ts` (new, in-process fixed window), `src/routes/auth.ts`
   (apply it; make signup non-confirming). **Everything else frozen.**
4. **Oracle:**
   - *positive:* N+1 rapid `signin` attempts → the last is `429 rate_limited`, Arabic,
     retryable; a different route/IP is unaffected.
   - *positive:* `recover` is limited at least as tightly as `signin`.
   - *positive:* the window **expires** — after it passes, requests are accepted again.
   - *positive:* a *successful* sign-in is not punished by earlier failures beyond the limit.
   - *positive:* signup on a registered address returns the **same status and body** as a
     fresh one, and **creates no second account** (assert the row count is unchanged).
   - *negative:* sign-in's existing indistinguishability is intact — unknown email and wrong
     password still byte-identical.
   - *negative:* the limiter never blocks the subject routes.
   - *obs:* a throttled request logs at `warn` with the route, never a full teacherId.
5. **Boundaries:** contract §4. In-process is accepted **for this milestone** and must be
   stated as such — it is wrong the moment there are two instances. Budget 10.
6. **Exit:** ask-when = the limiter would need shared state to be correct here.
