# Contract — `fe` ↔ `be` · roles, admin surfaces, per-exam KPIs

> **Status:** locked by `/planning`, 2026-08-08. Derived from the locked SEED.
> **Posture:** additive for teachers. Nothing a teacher touches changes shape.

## 1 · Per-exam KPIs — store what is already received

`/api/generate` already returns `costUsd` and `durationMs`; `fe` receives both and discards
them. They land on the subject exactly as `genCorrelationId` did.

```
subjects
  …
  costUsd     number | null   ← the generation's usage figure. NOT money — see below.
  durationMs  number | null   ← how long the generation took
```

`POST /api/subjects` accepts both, optional and nullable; omitting them stays valid, and
documents written before this read back `null` with no migration.

> **`costUsd` IS NOT MONEY.** The product runs on a subscription, not credit billing, so this
> is the CLI's notional API-equivalent — a stable *usage signal* (two identical runs both
> measured 0.6454). It must never be rendered as currency, to a teacher or an admin. A KPI
> labelled in dollars would be the product lying to its own operator.

## 2 · Roles

```
teachers
  …
  role  "teacher" | "admin"    ← absent reads as "teacher"
```

- **Sign-up always creates a teacher.** There is no self-service path to admin, and no request
  field can influence the role.
- The admin is seeded by `scripts/seed-admin.mjs`, which takes the password from
  **`ADMIN_PASSWORD` in the environment**. The value is never committed: a credential in git
  history cannot be rotated, and this repo stores password hashes.

## 3 · Admin surfaces — separate routes, never a relaxed teacher path

`getOwned` scopes ownership **inside the query** so another teacher's subject is
indistinguishable from one that does not exist. That rule is load-bearing and admits no
exception. Admin therefore gets its **own routes behind its own guard** — `requireAdmin`,
which resolves the teacher and then checks `role === "admin"`.

A boolean branch inside an existing teacher handler is expressly forbidden: that is how an
ownership check gets bypassed by accident.

### `GET /api/admin/kpis`

```jsonc
{
  "totalExams": 412,
  "totalTeachers": 37,          // ACCOUNTS only — rows with an email
  "anonymousSessions": 118,     // rows without one; never in avgExamsPerTeacher
  "avgCostUsdPerExam": 0.6454,      // usage figure, not currency
  "avgDurationMsPerExam": 128000,
  "avgExamsPerTeacher": 11.1,
  "examsWithKpis": 120,             // how many exams actually carry the numbers
  "correlationId": "…"
}
```

> **AMENDMENT 2026-08-08 (QA F4 + F1).** Two of the numbers above were spec-compliant and
> still misleading, which is the only kind of dashboard bug that matters.
>
> - **`totalTeachers` counted every row**, including anonymous sessions from
>   `POST /api/teacher` and the decoy rows a non-confirming sign-up creates. On the live
>   store that was 9069 rows against ~3100 real accounts, so `avgExamsPerTeacher` read
>   ~3× low. It now counts **accounts** (rows with an email) and reports
>   `anonymousSessions` alongside, so the split is stated rather than buried.
> - **`GET /api/admin/teachers` was uncapped** and returned 1.30 MB. It is now capped at
>   200 like `/exams`, with `total` reported.
>
> The principle both share: **every aggregate states what it was computed over.** An
> average whose denominator is invisible is a number an operator will act on wrongly.

**`examsWithKpis` is required, not decoration.** The averages are computed over exams that
have the fields; everything created before this job has `null`. Reporting an average without
saying what it was computed over is how a dashboard misleads its owner.

### `GET /api/admin/teachers`

```jsonc
{ "teachers": [ { "teacherId": "…", "email": "…", "role": "teacher",
                  "examCount": 12, "createdAt": "…" } ],
  "total": 9069,                // the true count; the list is capped at 200
  "correlationId": "…" }
```

**Never returns `passwordHash`, `recoveryHash`, or any hash.** An admin console has no use
for them and every leak of them is permanent.

### `GET /api/admin/exams`

```jsonc
{ "exams": [ { "id": "…", "teacherId": "…", "title": "…", "exerciseCount": 3,
               "costUsd": 0.6454, "durationMs": 128000, "createdAt": "…" } ],
  "correlationId": "…" }
```

Newest first, capped at 200 per response.

### Errors

| Status | `type` | When |
|---|---|---|
| 401 | `teacher_required` | no/unknown id — identical to the teacher surfaces |
| 403 | `forbidden` | a valid teacher who is not an admin |

**403 and 401 are different on purpose.** A teacher hitting an admin route is authenticated
and refused; conflating that with "who are you" makes the failure unreadable in a log.

## 4 · Bounding the auth surface

- **Rate limiting on `/api/auth/*`** — a fixed window per IP+route. `signin` and especially
  `recover` matter: a ~60-bit recovery code is safe against online guessing **only if guessing
  is bounded**, and QA measured ~28 req/s with no throttle at all. Exceeded → `429 rate_limited`,
  Arabic, retryable.
- **Sign-up no longer confirms an address exists.** `409 email_taken` is a clean enumeration
  oracle: one request per address, unambiguous — and it undoes the care taken to make sign-**in**
  indistinguishable (identical bodies, decoy scrypt on the unknown-email path, timings measured).
  Sign-up now answers `201` either way; a duplicate simply does not create a second account.

> **What this contract does NOT do:** replace the bearer `x-teacher-id`. That touches 7 `be`
> files, 11 promoted suites and all of `fe`'s storage layer. Changing the authentication
> mechanism in the same job that introduces a privilege level is how holes get made — each
> change masks the other's mistakes. It is fenced here and replaced by a follow-on job.
