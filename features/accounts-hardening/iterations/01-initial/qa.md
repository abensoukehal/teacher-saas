# QA ledger — accounts-hardening (01-initial)

> REALITY GATE. Inputs: SEED + contracts + REVIEW attack logs + the running system.
> RUNNING: be :9500 · fe :10500 · Mongo `teacher_saas`. Admin: `admin@app.com` →
> teacherId `02684f4022967d5069ecfb4f1787e1d9` (id IS the bearer credential — SEED-fenced).
> Never POST /api/generate. Starting where REVIEW stopped: operator confusion, boundaries,
> UI reality, induced failures. Written incrementally.

System baseline (probe): subjects 4416 (480 with costUsd, 3936 without) · teachers 9067.

## Ledger

| # | Case | SEED/contract claim | Command | Expected | Observed | Verdict |
|---|---|---|---|---|---|---|
| 1 | KPI math honesty | claim 4: avgs over exams that HAVE numbers, denom reported | `GET /api/admin/kpis` vs Mongo aggregate | digits match, nulls excluded | avgCost 0.55428798, avgDur 84818.49, examsWithKpis 480 — **exact match** to Mongo; 3936 nulls excluded | PASS |
| 2 | Hash leak on teachers | contract: never returns any hash | `GET /api/admin/teachers` string-scan | no hash fields | keys = teacherId,email,role,examCount,createdAt; no Hash/scrypt/recoveryUsedAt | PASS |
| 3 | teachers list uncapped | contract caps exams@200; teachers uncapped | `GET /api/admin/teachers`, `?limit=10` | (unspecified) | returns **all 9067 rows, 1.30 MB**, `?limit` ignored | SEED-GAP (see F1) |
| 4 | exams page all-null cost | claim 1: cost stored & readable | `GET /api/admin/exams` | some costs shown | newest 200 exams **all costUsd null** — first page cost column entirely empty | OPERATOR-CONFUSION (see F2) |
| 5 | unknown/no/malformed id → admin | contract: 401 teacher_required, Arabic | `GET /api/admin/kpis` w/ ffff…/none/`'; DROP`/`%00` | 401 Arabic, no crash | all 401, `مطلوب تسجيل الدخول`, type teacher_required | PASS |
| 6 | non-admin teacher → admin | contract: 403 forbidden, distinct from 401, Arabic | `GET /api/admin/kpis` as real teacher | 403 forbidden | 403 `هذه الصفحة مخصَّصة للمشرف`, type forbidden | PASS |
| 7 | POST to GET-only admin route | (unspecified) | `POST /api/admin/kpis` | 404/405 | 404 not_found (English msg, routing 404) | PASS (minor: EN routing msg) |
| 8 | admin demoted mid-session | boundary: guard re-checks per request | promote/demote probe-admin in Mongo between calls | 200→403→200 live | 200 (admin) → **403** (demoted) → 200 (re-promoted); no caching | PASS |
| 9 | signup no longer enumerates | claim 5: signup 201 either way | `POST /api/auth/signup` existing vs fresh email | both 201 indistinguishable | existing→201 +id+recovery; fresh→201 +id+recovery; identical shape | PASS |
| 10 | signup dup ≠ 2nd account / leak | contract: dup does not create 2nd account | Mongo check of decoy id vs real id | decoy ≠ real, email count 1 | decoy is fresh empty orphan (null email, no hash, 0 exams, diff id); real account untouched; **no credential leak** | PASS (side-effect F3) |
| 11 | rate limit signin | claim 5: 429 Arabic retryable | 12× `POST /api/auth/signin` | 429 after N, Arabic | 401×10 then 429; `محاولات كثيرة…` type rate_limited retryAfterSeconds 5 | PASS |
| 12 | ownership never relaxed | claim 3: admin not super-teacher on teacher routes | admin `GET /api/subjects/:id` (other owner) | 404 | 404 subject_not_found; owner gets 200 | PASS |
| 13 | non-ObjectId id → teacher route | induced failure: TRUE, retryable | `GET /api/subjects/not-an-objectid` | graceful 404, no 500 | 404 subject_not_found, no crash | PASS (msg English, pre-existing) |
| 14 | rate-limit window rollover | boundary: first req after window | 11× recover → 429, wait 6s, 1 more | first post-window req NOT 429 | 401×5 then 429×6; after 6s → **401** (allowed, counted fresh) | PASS (recover cap=5, tighter than signin) |
| 15 | teacher UI has no admin surface | fe-2: «مشرف» absent, no admin call | teacher session at `/` | no admin word/link/latin, rtl | hasAdminWord false, no admin link, no Latin prose, dir rtl | PASS |
| 16 | teacher at `#/admin` | server-gated 403, no data leak | teacher session → `#/admin` | Arabic 403 card, no data | `هذه الصفحة مخصَّصة للمشرف` + correlationId + return btn; zero data | PASS |
| 17 | admin console renders | claims 1,3,4,6 in real UI | admin session → `#/admin` | KPIs+tables, Arabic, RTL, no $ | full dashboard renders; see below | PASS |
| 18 | costUsd never currency (UI) | claim 6 | strict DOM scan for $ € دج USD etc | none | **zero currency symbols**; label `وحدات الاستهلاك`; bare `0.5543` | PASS |
| 19 | examsWithKpis legible | claim 4: denominator reported | read KPI card | operator can't misread avg | `المتوسّطان أعلاه محسوبان على 480 موضوعًا من أصل 4416 — المواضيع الأقدم لا تحمل هذه القياسات` — dual form scopes 480 to cost+duration ONLY | PASS (exemplary) |
| 20 | null KPIs render legibly | boundary: null vs 0 | exam rows w/ null cost/dur | not `0`, not `$0`, not blank | render as `—` (em dash); teacher w/ 0 exams → `0`; null email → `بدون بريد` | PASS |
| 21 | avgExamsPerTeacher scope | claim 4: correct denominator | verify 0.49 = totalExams/totalTeachers | uses ALL exams, not the 480 | 4416/9069 = 0.487 ✓ — NOT falsely scoped to examsWithKpis | PASS |
| 22 | teachers table at scale | task: unreadable at ~7000 rows? | admin teachers table | legible | UI displays `أول 200 من أصل 9069`; render bounded to 200 (API still returns all 9069 — see F1) | PASS (display) / see F1 |
| 23 | no LaTeX in admin UI | hard constraint | DOM scan `\frac \( $$` etc | none | none | PASS |

## UI observations (admin console `#/admin`)

KPI card: إجمالي المواضيع 4416 · إجمالي الأساتذة 9069 · متوسط وحدات الاستهلاك 0.5543 ·
متوسط زمن التوليد 84.8 ث · متوسط المواضيع لكل أستاذ 0.49. Duration correctly ms→seconds.
Denominator disclosure present and precisely dual-scoped. Teachers table: 200-of-9069 with
`بدون بريد` for anonymous, `أستاذ` role, examCount incl. `0`. Exams table: null cost/dur = `—`.
No currency, no LaTeX, no Latin UI prose, RTL throughout.

## Untested boundaries (data is populated; not safe to wipe live DB)

- **examsWithKpis = 0** (nearly-empty system): Mongo `$avg` over empty set → null, but the
  divide-by-zero on `avgExamsPerTeacher` when `totalTeachers = 0` is NOT exercisable without
  emptying the live collections. REVIEW's Infinity guard (be-1) was on *storage input*, not on
  the KPI division. Recommend a unit test asserting KPIs on an empty collection return
  null/0, never NaN/Infinity. Not a live finding — flagged honest.

## Findings (seed-gaps / operator-confusion — no SEED claim falsified)

### F4 — `totalTeachers` / `avgExamsPerTeacher` count anonymous sessions as teachers (operator-confusion) — PRIMARY
- **intent (claim):** claim 4 — "Global KPIs: … avg exams/teacher … with the denominator reported." The console must tell an operator the truth about their own system.
- **ground truth (repro):** Live DB — `db.teachers.countDocuments()` = 9069, but only **3100** carry an email+passwordHash (real accounts); **5969** are anonymous rows (POST /api/teacher sessions + duplicate-signup decoys). The dashboard renders `إجمالي الأساتذة 9069` and `متوسط المواضيع لكل أستاذ 0.49` with no disclosure that "teacher" here includes anonymous sessions.
- **oracle (observed vs expected):** observed — operator is shown "9069 teachers, 0.49 exams each"; expected — a figure an operator would not misread as 9069 real teachers (actual registered ≈ 3100). Unlike the cost/duration averages (which carry the exemplary `480 من أصل 4416` disclosure), these two teacher metrics carry NO qualifying denominator. Arithmetic is honest; the label overcounts real teachers ~3×.
- **verdict:** SEED-GAP. The SEED/contract define `totalTeachers = countDocuments(teachers)` and never distinguish registered vs anonymous, so this is spec-compliant but misleading on real data. Recommend either counting only email-bearing rows or disclosing the split (e.g. "9069 (منهم 3100 بحساب)").

### F1 — `/api/admin/teachers` is uncapped (over-fetch) while `/api/admin/exams` caps at 200
- **intent:** contract caps exams at 200/response; teachers unspecified.
- **ground truth:** `GET /api/admin/teachers` returns all **9069 rows, 1.30 MB**; `?limit=10` ignored. The FE fetches the whole payload but displays only 200 (`أول 200 من أصل 9069`).
- **oracle:** observed — full-collection fetch every admin load; expected — a bounded payload matching the 200-row display. Grows unbounded with the teachers collection.
- **verdict:** SEED-GAP (efficiency). Display is legible; only the payload is unbounded. Recommend server-side cap+pagination mirroring the exams route.

### F2 — admin exam list shows a 100%-empty cost column right now (operator-confusion, low)
- **ground truth:** exams are "newest first, cap 200"; the newest 200 all have `costUsd=null` (all 480 cost-bearing exams are older), so the per-exam cost/duration columns render entirely `—`. An operator paging the exam list never sees a single real per-exam usage figure, even though 480 exist.
- **oracle:** observed — cost column all `—`; expected — at least the cost-bearing exams reachable. Largely a test-data artifact (bulk null-KPI test rows dominate recent inserts); mitigated by the `—` rendering and the KPI card's aggregate. Low severity.
- **verdict:** OPERATOR-CONFUSION, low. Recommend an optional "with KPIs only" filter, or note it resolves itself once real generations dominate recent inserts.

### F3 — duplicate signup mints throwaway anonymous rows (accepted tradeoff, noted)
- **ground truth:** `POST /api/auth/signup` on an existing email returns 201 with a fresh, *recorded, usable* anonymous teacherId (verified GET /api/subjects → 200) that is NOT the existing account's id (no credential leak) and does not create a 2nd account for the email. Each duplicate attempt adds one orphan row, feeding F4's inflated denominator.
- **verdict:** ACCEPTED. Necessary for signup indistinguishability (a fake unrecorded id would re-open the enumeration oracle). Recorded only for its interaction with F4.

## Overall verdict: **validated-provisional**

Every SEED claim and hard constraint holds on the running system:
1. Per-exam cost/duration stored & readable — PASS (KPI math matches Mongo to the digit).
2. Two roles; admin seeded, not self-registerable — PASS (REVIEW-confirmed; live 401/403 distinct).
3. Admin via its own routes; ownership on teacher routes never relaxed — PASS (admin→other subject = 404; guard re-checks role per request incl. mid-session demotion).
4. Global KPIs over exams-with-numbers, denominator reported — PASS for cost/duration (exemplary `480/4416` dual-scoped disclosure). See **F4**: teacher-count metrics conflate anonymous sessions with real accounts.
5. Auth surface bounded — PASS (signin cap 10, recover cap 5, Arabic 429 retryable, clean window rollover; signup no longer enumerates via 409).
6. `costUsd` never currency — PASS (zero currency symbols in UI; labeled وحدات الاستهلاك).
Hard constraints — Arabic-only, RTL, no visible LaTeX — PASS across teacher and admin UIs.

"Provisional" not "validated" because of: **F4** (a real operator would misread 9069 "teachers"),
F1 (unbounded payload), and two **untested empty-system boundaries** (examsWithKpis=0 /
totalTeachers=0 divide-by-zero — not exercisable without wiping the live DB). None falsifies a
locked claim; all are seed-gaps or advisories.

_Env note: DB carries heavy REVIEW/QA test pollution (267 `admin.probe` admin rows, thousands
of anonymous+decoy rows). These are fixtures, not product defects, but they dominate the KPIs an
operator currently sees — worth a cleanup pass before any real demo._


---

## Resolutions (2026-08-08, after the ledger above)

QA returned **validated-provisional** with no claim falsified. Two of the three advisories
were real and are fixed; the third is a data artifact.

| finding | resolution | pinned by |
|---|---|---|
| **F4 — `totalTeachers` counted every row** (9069) including anonymous sessions and non-confirming-signup decoys, against ~3100 real accounts, so `avgExamsPerTeacher` read **~3× low** | `totalTeachers` now counts **accounts** (rows with an email) and `anonymousSessions` is reported beside it. Live: 3100 / 5969, and the average moved **0.49 → 1.42**. | 2 clauses: an anonymous session moves the anonymous count and never the account count; the average divides by accounts |
| **F1 — `/api/admin/teachers` uncapped** (1.30 MB, 9069 rows) | Capped at 200 like `/exams`, with `total` reported so the console can say it is showing a slice. | 1 clause: capped **and admits it** — a silent truncation is a lie |
| **F2 — the exam list's cost column is all `—`** | **Not a defect.** All 480 KPI-bearing exams predate the newest-200 page. It resolves itself as new exams arrive, and `—` (never `0`) is already the correct rendering for absent KPIs. | — |

**The principle both fixes share, now explicit in the contract:** *every aggregate states
what it was computed over.* `examsWithKpis` already did that for cost and duration; the
teacher metrics did not, which is exactly why an operator would have misread them.

**A knock-on the cap caused, and how it was handled:** one existing clause inserted a
"legacy" row backdated to July and looked for it in the listing. With the newest-200 cap it
fell off the page. What makes that row legacy is its **absent `role` field**, not its date,
so it now uses a current timestamp and the missing field stays the thing under test — rather
than loosening the assertion.

**Left open, stated:**
- `examsWithKpis = 0` / `totalTeachers = 0` divide-by-zero is guarded in code but not
  exercisable without wiping the shared database.
- The shared dev store carries heavy probe pollution from REVIEW and QA (~267 probe admin
  rows, ~5969 anonymous/decoy rows) which dominates the KPIs an operator currently sees.
  Fixtures, not defects — but worth a cleanup before any demo.

**Verdict after resolutions: validated.** Gates at seal time — `be` 93/93, `fe` 32/32,
promoted `be` 131/131, promoted `fe` 210/210.
