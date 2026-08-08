# QA — persistence-gaps · iteration 01

> **Phase:** QA (reality gate). **Inputs:** SEED.md + contracts/, the running lanes
> (`be` :9300, `fe` :10300, Mongo `teacher_saas`), review's attack logs. **No product
> source code was read.** No `POST /api/generate` was called; the recorded fixture
> (`tests/be/fixtures/rec-exam-subject.2026-08-07.json`, `.data`) was replayed instead.
> Date: 2026-08-08. QA teachers created: `qa.teacher1@`, `qa.ui1@`, `qa.eight@` (all
> `@example.dz`), plus one anonymous id `f57a009f…` — all disposable test rows.

## What review already covered (not repeated here)

- be-1/be-2: enumeration timing (burnVerify), adopt-race CAS, 8 concurrent recoveries
  → 1×200, 2 concurrent signups → 1 adopts, bearer-id log truncation (fixed in review).
- be-3: 12 concurrent PUTs → 8×200+4×409, zero lost/duplicate revisions; cross-tenant
  revisions probe → identical 404.
- be-4: run-log join clause de-tautologized; be-5: purge guards mutation-tested.
- fe-1: signup adoption against real backend; `noValidate` Arabic-error fix (F1).
- fe-3: restore = exactly one PUT, no `/restore` URL; KaTeX history, no LaTeX leak.
- fe-4: triple-click replay → exactly one subject; F2 (queue-before-gate) fixed.
- Debts review left open, chased below: (a) sign-in orphaning → **BUG-1, confirmed**;
  (b) `createOnce` second-intent drop → not reachable from outside without generating
  (needs two *distinct* saves in flight), stays open as declared debt F3; (c) unstyled
  UI → **observed styled and coherent** in every screen exercised (auth, code screen,
  exam, refine/history panel, saved list) — debt appears retired; (d) malformed JSON
  English 500 → **BUG-3, confirmed and broadened** (oversized body too).

## Ledger

| # | Case | SEED claim | Command / journey | Expected | Observed | Verdict |
|---|---|---|---|---|---|---|
| 1 | Sign-up, fresh teacher (API) | #1 | `POST /api/auth/signup {qa.teacher1@example.dz}` | 201, teacherId, one-time code | 201, 32-hex id, `GCB4-D89J-GAZH`, correlationId | pass |
| 2 | Duplicate sign-up | #1 ¬X | same email again | 409 `email_taken`, Arabic | 409 «هذا البريد الإلكتروني مسجَّل بالفعل» | pass |
| 3 | Sign-in wrong pw vs unknown email | #1 ¬X | two `POST /api/auth/signin` | same 401 `invalid_credentials`, same Arabic message | identical body both ways | pass |
| 4 | Sloppy email (trailing space, case) | #1 boundary | `" qa.teacher1@… "` / `QA.Teacher1@…` | accepted | 200 both, same teacherId | pass |
| 5 | Recover with lowercase+spaces code | #1 boundary | `recoveryCode:"gcb4 d89j gazh"` | 200, fresh code | 200, new code issued | pass |
| 6 | Recover twice with same code | #1 X-twice | replay `GCB4-…` | 401 `invalid_recovery` | 401 «رمز الاسترجاع غير صحيح أو مستعمَل» | pass |
| 7 | Old pw dead, new pw works after recover | #1 | 2× signin | 401 then 200 | as expected | pass |
| 8 | Recover with unknown email | #1 ¬X | `ghost@example.dz` | not an enumeration oracle | 401 `invalid_recovery` — same as wrong code | pass |
| 9 | Password 7 chars / bad email / empty body | boundary | 3× signup | 400 `invalid_request`, Arabic | 400, Arabic messages | pass |
| 10 | **Malformed JSON body** | induced failure | `-d '{"email": broken'` | 400 `invalid_request`, Arabic | **500 `internal_error`, "internal server error" (English), no correlationId** | **BUG-3** |
| 11 | **Huge payload (2 MB)** | induced failure | POST /api/subjects, 2 MB body | 4xx, Arabic, true | **same English 500** | **BUG-3** |
| 12 | Unknown/malformed teacher id | #1 (supersession) | fresh 32-hex; `zzzz` | 401 `teacher_required` | 401 «مطلوب تسجيل الدخول» both | pass |
| 13 | Anonymous mint still works | compat | `POST /api/teacher` → `GET /api/subjects` | id accepted, row recorded | 201 then 200 `[]`; Mongo row `email:null` | pass |
| 14 | Create with `genCorrelationId` | #3 | POST subjects from fixture | stored + returned; list carries it | 201; field on record and list summary | pass |
| 15 | **Cost join is real** | #3 | run-line correlationId ∈ `subjects.genCorrelationId`, grep run-log | join answers cost | subject `6a7689f7…` joins run line `verify-1786153463056-…` carrying `costUsd` | pass |
| 16 | Exercise refined 30× (sequential) | #2 | 30× PUT ex1 | 30×200; 30 revisions, newest-first, oldest = generated original | exactly that | pass |
| 17 | Revisions of unknown exerciseId | #2 ¬X | GET `…/ex99/revisions` | 200 `{revisions:[]}`, never 404 | 200 `[]` | pass |
| 18 | PUT to unknown exerciseId | #2 ¬X | PUT `…/ex99` | 409 `exercise_not_found` | 409 — but message is **English** ("exercise \"ex99\" is not in this subject") | note → BUG-4 |
| 19 | One-exercise subject: refine → restore | #2 boundary | create, PUT, PUT(original) | history linear, count 2, current = original | as expected | pass |
| 20 | UI: gate → sign-up, malformed email | #1 + Arabic | type `qa.ui1-no-at`, submit | Arabic error, no browser bubble | «البريد الإلكتروني غير صالح» in-page alert | pass |
| 21 | UI: recovery code screen | #1 + RTL | sign-up ` QA.UI1@Example.dz ` | code shown once, `dir="ltr"` in `rtl` doc, copy affordance | `BMQB-QJAG-7M7B`, dir ltr, doc rtl, نسخ الرمز | pass |
| 22 | UI: reload at code screen (abandon mid-flow) | #1 stale | reload before متابعة | account still complete; gate returns | gate shown; later sign-in returns same teacherId | pass |
| 23 | UI: controls round-trip | #5 | set topic/صعب/4/120/Arabic note → reload | all restored | all restored (`teacher.controls.v1`) | pass |
| 24 | UI: exams listed incl. long Arabic title | #1 | seed 2 via API, reload | both in «مواضيعي», title intact | listed, RTL, no truncation loss | pass |
| 25 | UI: exam renders KaTeX, no LaTeX | constraints | open exam | math rendered, no `\frac`/`$…$` | KaTeX-rendered; no raw LaTeX anywhere (regex sweep clean) | pass |
| 26 | **UI: reload repaints stale exam** | #1/#2 stale | replace ex1 via API (other "device"), reload fe | current version shown, or revalidated | **no `GET /api/subjects/:id` on reload; pane renders `teacher.cache.v1` verbatim — superseded ex1 shown as current** | **BUG-2** |
| 27 | UI: selecting exam from list refetches | #1 | click list item | fresh GET, current version | GET fired, x+15 version shown | pass |
| 28 | UI: history panel | #2 | تعديل هذا التمرين | Arabic, newest-first, restore per entry, KaTeX | «النسخ السابقة», timestamps Arabic, KaTeX, no LaTeX | pass |
| 29 | UI: restore via panel | #2 | استرجاع هذه النسخة (oldest) | one PUT, history grows, «تم الحفظ» | exactly one PUT + list/revisions refresh; count 2→3 | pass |
| 30 | UI: print | core loop | طباعة الموضوع | print sheet, sidebar hidden | `window.print` + `@media print` rule hiding chrome | pass |
| 31 | UI: identity rejected mid-session | #4 (F2 class) | plant unknown 32-hex id + `teacher.draft.v1`, reload | work not lost | gate shown, id cleared, **draft key preserved**; adopted (one POST 201) after sign-in | pass |
| 32 | Garbage `teacher.pending.v1` | #4 ¬X | plant `{broken json`, reload | no crash, no silent fire | app loads clean; garbage ignored (left in place — harmless) | pass |
| 33 | Queued save survives reload; replay offered | #4 | plant pending (product shape), reload | offer, never silent | «لديك موضوع لم يُحفظ بعد» + «حفظ الآن»; nothing auto-fired | pass |
| 34 | Double-click «حفظ الآن» | #4 X-twice | 2 rapid clicks | exactly one create | one POST 201; pending cleared; offer gone | pass |
| 35 | Cleared browser → recover → everything back | #1+#3 journey | `localStorage.clear()` → نسيت كلمة المرور → sloppy code | same teacherId, all exams | fresh code `E8UZ-…` shown once; **all 5 exams present** | pass |
| 36 | Recovery-code input affordance | RTL | forgot-password form | code field LTR | `dir="ltr"`, placeholder `XXXX-XXXX-XXXX`; other fields RTL | pass |
| 37 | **Sign-IN while anonymous exams exist** | #1 ¬X | anon id owns 1 exam → الحساب → sign in qa.ui1 | teacher must not lose exams (or at least be told) | **id silently replaced; anon exam vanishes from list; still owned server-side by an id no browser holds — permanently orphaned; zero warning** | **BUG-1** |
| 38 | Signed-in account panel | #1 gap | click الحساب while signed in | account status / sign-out | **same sign-in gate again — no "signed in as", no sign-out** | seed-gap note |
| 39 | Latin-string sweep | constraints | auth screens + app + history | Arabic only (code + `XXXX` placeholder exempt) | UI strings all Arabic; only Latin in *generated content* («3AS», «composition» — pre-existing generation output, plus literal `**…**` markdown asterisks in fixture statements) | pass (notes) |

## Bugs filed

### BUG-1 — signing in orphans this browser's anonymous exams, silently (SEED claim #1)
- **Intent:** "a teacher never loses their exams" — the claim this whole job exists for.
- **Ground truth:** `ANON=$(curl -sX POST :9300/api/teacher | jq -r .teacherId)`; create one
  subject under `$ANON`; in fe set `teacher.id.v1="$ANON"`, reload (exam listed); open
  «الحساب» → sign in to any account. Observed: `teacher.id.v1` overwritten with the
  account's id, list now shows only the account's exams; Mongo still holds the anon
  subject under `f57a009ff1566aeb31d42d437f27297d` (email null) — unreachable forever.
  No warning, no confirmation, at any point.
- **Oracle:** signing in on a browser whose anonymous id owns ≥1 subject MUST NOT drop
  that id without telling the teacher. Expected: an Arabic warning naming the count of
  exams that will become unreachable, with a way out (sign up instead — sign-UP adopts).
  Observed: silent replacement. (Contract forbids adoption-on-sign-in — zero-rewrite —
  but explicitly does not forbid a warning; review fe-1 flagged exactly this debt.)

### BUG-2 — reload renders a stale cached exam as current, without revalidation (claims #1/#2)
- **Intent:** cross-device truth — "exams are simply there, on any machine"; refining is
  safe. Accounts make multi-device access first-class; the paint cache predates that.
- **Ground truth:** open exam `6a76a9ff…63` in fe; from "another device"
  `PUT /api/subjects/6a76a9ff…63/exercises/ex1` (200, new statement `x+15`); reload fe.
  Observed: network shows `GET /api/subjects` only — **no `GET /api/subjects/:id`** —
  and the pane shows the superseded `x+3` version from `teacher.cache.v1` with no
  staleness signal, indefinitely. Selecting the same exam from «مواضيعي» refetches and
  shows the current version, proving the data is fine and only the reload path lies.
- **Oracle:** a reload that repaints from cache MUST revalidate against
  `GET /api/subjects/:id` (paint fast, then reconcile), or must not auto-reopen from
  cache at all. Expected: current `x+15` statement after reload; observed: `x+3`.
  Risk beyond display: refining from the stale pane submits the old body, which the
  rev-CAS will happily land, superseding the newer version (kept in history, but the
  teacher is silently editing yesterday's exam).

### BUG-3 — body-layer failures answer in English with a 500 (auth contract, hard constraint)
- **Intent:** contract error table: malformed body → `400 invalid_request`, `message`
  Arabic; every error keeps the `{error:{message,type},correlationId}` envelope.
- **Ground truth:** `curl -sX POST :9300/api/auth/signin -H 'content-type: application/json' -d '{"email": broken'`
  → `500 {"error":{"message":"internal server error","type":"internal_error"}}` — English,
  no `correlationId`. Same for a 2 MB `POST /api/subjects` body (express.json limit).
- **Oracle:** expected `400 invalid_request` (or `413`), Arabic message, correlationId
  present; observed 500/English/none. Pre-existing and product-wide (review be-2 tracked
  it); fe never emits such bodies itself, so teachers only meet it via proxies/tools —
  but it is a standing contract violation on the product's front door, now on auth
  surfaces that face the open internet in the deploy job's future.

### BUG-4 (minor) — subject-route error messages are English (hard constraint: Arabic only)
- **Intent:** "message is Arabic (teacher-facing, per the hard constraints)" — restated
  in the auth contract; `teacher_required` was correctly localized by this job.
- **Ground truth:** `PUT …/exercises/ex99` → 409 `{"message":"exercise \"ex99\" is not in this subject"}`;
  `GET /api/subjects/ffffffffffffffffffffffff/…/revisions` → 404 `{"message":"subject not found"}`.
- **Oracle:** expected Arabic messages on every teacher-reachable error; observed English
  on the pre-existing subject-route family (this job's new/changed types — `teacher_required`,
  `invalid_*`, `email_taken`, `invalid_recovery` — are all Arabic). fe maps `type` to its
  own Arabic strings, so exposure is low today; becomes real the day any surface echoes
  `message`.

## Observations (not filed)

- **No sign-out and no signed-in indicator** («الحساب» always shows the sign-in form,
  even when signed in). The SEED is silent — on a shared staff-room machine this means
  the next teacher sees your exams and there is no in-product way to leave. Seed-gap:
  needs a product decision, not an invented fix.
- Generated content carries literal markdown (`**الجزء الأول**` shown with asterisks)
  and Latin asides («3AS», «composition») — pre-existing generation/rendering behavior
  from the core-loop job, not this job's surfaces.
- A garbage `teacher.pending.v1` is tolerated but never cleaned up. Harmless.
- Recovery-code UX detail: a teacher who reloads past the code screen without writing
  the code down keeps their account but has no reset path until they recover (which
  itself requires the code). Spec-consistent ("shown once"); worth a future nudge.
- fe-4's F3 (`createOnce` drops a second *distinct* intent in flight) could not be
  exercised from outside without paying for a generation; remains open as declared debt.

## Verdict: **bugs-filed**

The feature's spine holds under hostile use: accounts round-trip identity across a
cleared browser and a second machine (sign-in and recovery paths both proven end-to-end
through the real UI); the recovery code is single-use, rotating, sloppy-input-tolerant,
LTR-in-RTL; revision history is linear, restorable, KaTeX-rendered, and survived 30
sequential refines; the cost join is real against live run-log lines; a queued save
survives reload, is offered never fired, and double-click creates exactly one subject;
controls state round-trips. Hard constraints hold on every surface this job added.

But SEED claim #1 — "a teacher never loses their exams" — is still violated on one path
this job itself created (BUG-1: sign-in silently orphans a browser's anonymous exams),
and the reload path lies about what an exam currently says (BUG-2), which accounts-era
multi-device use turns from a corner case into a workflow. BUG-3/BUG-4 are contract and
constraint violations at the API boundary, real but low-exposure today. BUG-1 must be
resolved (warn, or block with guidance — adoption-on-sign-in stays forbidden) before
the two-teacher milestone; BUG-2 should be.

---

## Resolutions (2026-08-08, after the ledger above)

QA returned **bugs-filed**. Three were in scope and are fixed with pinning clauses; the
fourth is pre-existing and accepted as tracked debt.

| bug | SEED claim | resolution | pinned by |
|---|---|---|---|
| **BUG-1** signing in silently orphans this browser's anonymous exams | #1 | `teacher.previous.v1` keeps the displaced id, and an Arabic notice tells the teacher those exams were not moved and not deleted. `be` still adopts only on sign-**up** — adopting on sign-in would re-point subject documents, which the zero-rewrite property forbids — so the fix removes the *silence*, not the separation. | 2 clauses in `tests/fe/auth.characterization.test.tsx` (displaced id kept + notice shown; no notice when nothing was displaced) |
| **BUG-2** reload repainted the cache and never reconciled | #1 (multi-device) | boot now refetches the open subject with `GET /api/subjects/:id` and prefers the server's version. A version refined on another device used to render as current indefinitely — and refining from that stale pane would have pushed an old body through the CAS. | 1 clause: boot issues the refetch and the server's title wins over the cached one |
| **BUG-3** malformed / oversized body → English `500`, no correlationId | hard constraint (Arabic-only) + the auth contract's error table | `entity.parse.failed` → `400 invalid_request`, `entity.too.large` → `413 payload_too_large`, both Arabic. **And the correlation-id middleware moved ahead of the body parser** — the one response a caller most needs to trace was the one response that could not be traced. | 2 clauses in `tests/be/auth-signup.characterization.test.js` |
| **BUG-4** pre-existing English messages on the subject routes | hard constraint | **Accepted debt, not fixed.** `subject not found` / `exercise "x" is not in this subject` predate this job and are pinned by the promoted regression net; changing them is its own change with its own re-baseline. Every error type this job *added* is Arabic. | — |

**Also fixed during QA, found while breaking BUG-3:** the correlation-id middleware ran
*after* `express.json`, so any body-parse failure produced a response with no
`correlationId` at all.

**Left open, stated rather than hidden:**
- **F3** (`createOnce` drops a second *distinct* in-flight intent) — cannot be triggered
  from outside without paying for a real generation. Declared debt, carried from review.
- **No sign-out or signed-in-as indicator.** QA calls this a **seed-gap**: the SEED is
  silent on it, and inventing correctness is not QA's job. It needs a product decision.

**Verdict after resolutions: validated.** Gates at seal time — `be` 65/65, `fe` 74/74,
promoted nets `be` 44/44 and `fe` 69/69.
