# QA — solution sheets · 2026-08-08

> **Method:** black-box only — SEED + contracts, the running lanes (`be` :9400, `fe` :10400),
> and review's attack logs. No product source read. `POST /api/generate` never called; the
> recorded fixtures (`rec-exam-subject.2026-08-07.json`, `rec-solution-sheet.2026-08-08.json`)
> drove every store. Refines simulated through the pure-storage
> `PUT /api/subjects/:id/exercises/:exerciseId`, exactly as `fe` uses it.
>
> **Where review stopped, QA started.** Review already found and got fixed: the staleness
> laundering (statement now delivered in the POST body), the sum-only scale rule (labels +
> points > 0 added), the fake double-click clause, the print-marker timing mutation, and the
> byte-identical exam print baseline. None of that is repeated below.

**Setup:** teacher `fbb6db4b…` minted via `POST /api/teacher`; subject S1
(`6a77035b76bf6c00abb05f23`) = the recorded 3-exercise exam; S2 (`6a77041d…f2d`) = a
one-exercise subject; S3 (`6a77041d…f2e`) = full exam with a correction for `ex3` only.

## Ledger

| # | Case | SEED claim | Command / journey | Expected | Observed | Verdict |
|---|---|---|---|---|---|---|
| A0 | Store recorded correction, all current | 1, 2 | POST `…/solutions` with the 3 recorded entries + their statements | 201, `stale:false` ×3 | 201, `[(ex1,F),(ex2,F),(ex3,F)]`; GET returns same, keys `answer,exerciseId,scale,stale` | ✅ |
| A1 | Refine `ex2` (PUT, modified statement) | 3, 4 | PUT `…/exercises/ex2` then GET solutions | only `ex2` stale | `[(ex1,F),(ex2,T),(ex3,F)]` | ✅ |
| A2 | Restore original statement | 3 (derived, not stored) | PUT `ex2` back to the original statement | correction heals | all `stale:false` — staleness really is derived on read | ✅ |
| A4 | Refine `ex2` five times | 4 | 5× PUT with different statements | still only `ex2` stale | `[(ex1,F),(ex2,T),(ex3,F)]` | ✅ |
| A3 | Regenerate ONLY the stale one | 5 | partial POST of `ex2` alone with the live statement + a changed answer | `ex2` heals; `ex1`/`ex3` byte-untouched | 201; `ex2` carries the new answer, `stale:false`; `ex1`/`ex3` answers identical to before | ✅ |
| A5 | Fail-safe hash (review F1 regression) | 3 | POST `ex1` with a statement matching nothing | stored but immediately `stale:true`, never false-current | 201, `(ex1,True)` in the same response | ✅ |
| A6 | Save correction for A while refining B | 3, 4, 5 | concurrent POST solutions(`ex1`) + PUT refine(`ex3`) | both succeed; exactly `ex3` stale | 201 + 200; `[(ex1,F),(ex2,F),(ex3,T)]` | ✅ |
| A7 | Regenerate the SAME exercise twice at once | 5 | two concurrent POSTs for `ex3` | no 500, exactly one row | both 201; 1 row for `ex3`, `stale:false` | ✅ |
| B1 | Scale sums to 5 ≠ 6 | 2 | POST bad scale | 400 `invalid_request`, Arabic | 400, «مجموع السلّم لا يساوي نقاط التمرين» | ✅ |
| B2 | Zero-point padding `[6,0]` | 2 (review F2 regression) | POST | 400 | 400, «كل بند في السلّم يحتاج عنوانًا ونقاطًا موجبة» | ✅ |
| B3 | Negative part `[8,−2]` | 2 (review F2 regression) | POST | 400 | 400, same Arabic message | ✅ |
| B4 | Empty part label | 2 | POST | 400 | 400, same message | ✅ |
| B5 | Missing `statement` | 3 (amendment) | POST entry without it | 400 | 400, «نص التمرين المرجعي مطلوب» | ✅ |
| B6 | Invented `exerciseId` (`ex9`) | contract | POST | 400 | 400, «تمرين غير موجود في هذا الموضوع» | ✅ |
| B17 | `points` as string `"6"` | 2 | POST | 400 | 400, «السلّم غير صالح» | ✅ |
| B18 | `scale` missing entirely | 2 | POST | 400 | 400, «السلّم مطلوب» | ✅ |
| B19 | Empty `answer` | 1 | POST | 400 | 400, «الحل مطلوب» | ✅ |
| B8 | `solutions` not-array / `[]` / absent | contract | 3 POSTs | 400 each | 400 ×3, «المطلوب قائمة حلول غير فارغة» | ✅ |
| B7 | Duplicate `exerciseId` in one batch | contract (silent) | POST `ex1` twice, different answers | undefined by contract | 201, last entry wins, exactly one row — deterministic, no corruption | ✅ note |
| B9 | Malformed JSON body | induced failure | POST `{"solutions": [` | 400, Arabic, correlationId | 400 `invalid_request`, «الطلب غير صالح», correlationId present | ✅ |
| B10 | 6 MB body | induced failure | POST oversized | rejected, true + Arabic | 413 `payload_too_large`, «الطلب كبير جدًا» | ✅ |
| B11 | ~500 KB answer within limit | boundary | POST then GET | stored, round-trips intact | 201; GET returns it byte-complete | ✅ |
| B12 | Float sums: `1.1+2.2+2.7`, quarter marks | 2 boundary | POST | accepted (both are IEEE-exact 6.0) | 201 both; realistic half/quarter marks are binary-exact, no false reject found | ✅ |
| B12d | `[1e308, 6, −1e308]` (sums to 6 in FP) | 2 adversarial | POST | rejected | 400 via the points > 0 rule — the F2 fix also closes the FP-overflow trick | ✅ |
| B13 | Subject id not an ObjectId | induced failure | POST/GET `…/not-an-objectid/solutions` | 404, not 500 | 404 `subject_not_found` both | ✅ (msg: E1) |
| B22 | Valid-but-absent ObjectId | induced failure | GET | 404 | 404 `subject_not_found` | ✅ (msg: E1) |
| B14 | Unknown teacher id mid-session | induced failure | GET with never-issued 32-hex id | 401, Arabic | 401 `teacher_required`, «مطلوب تسجيل الدخول» | ✅ |
| B15 | No teacher header | induced failure | GET bare | 401 | 401, same | ✅ |
| B16 | Another teacher's subject | contract | GET + POST as a second minted teacher | 404, body identical to absent | 404 both; error body byte-identical to B22 (no existence oracle) | ✅ |
| C1 | Cost recorded, not metered | 7 | store with/without `genCorrelationId`; ~20 stores in one session | id persisted when sent; zero gating | `solutions` rows carry `genCorrelationId` (`qa-regen-ex2` etc., `null` when omitted — contract allows); every store accepted, no limit hit | ✅ |
| U1 | Correction pane, real UI | 1, constraints | S1 open at :10400 with `ex2` stale | worked answer + scale per exercise, RTL, Arabic | `.solutions` pane: `direction: rtl`, 240 KaTeX nodes, 0 `.katex-error`, 3 `.sol__scale` blocks | ✅ |
| U2 | LaTeX never visible (screen) | constraints | DOM text of `.solutions` minus KaTeX internals | 0 raw `\cmd` or `$…$`, 0 Latin words | 0 and 0 | ✅ |
| U3 | Stale shown as stale, never current | 3 | S1 with `ex2` refined out-of-band | visible Arabic staleness, only on `ex2` | `sol--stale` on ex2 only: badge «تصحيح غير محدَّث» + sentence «تغيّر هذا التمرين بعد توليد تصحيحه، فالتصحيح أدناه لم يعد مطابقًا له.»; exactly 1 regenerate control, on the stale one | ✅ |
| U4 | Print marker mechanics | 6 | stub `window.print`, click «طباعة التصحيح» then «طباعة الموضوع», then double-click | marker `solutions` / `exam` at print time; returns to `exam` | exactly that; double-click yields one print of the right sheet | ✅ |
| U5 | The two sheets never merge | 6 | materialise the real `@media print` rules through the cascade, probe both marker values | exam mode hides correction; solutions mode hides exam; chrome hidden | exam mode: `.exam` block, `.solutions-pane` **none**; solutions mode: `.exam` **none**, pane block; `.sidebar`/`.sol__regen` none in both | ✅ |
| U6 | Stale survives onto printed correction | 3, 6 | same materialisation | badge + sentence print | `.sol__stale` and `.sol__stale-note` `display:block` in print; `.solutions` background transparent (fe-2's dark-bg fix held) | ✅ |

**E1 — known-issue note (pre-existing, not this job's):** the `subject_not_found` message is
English ("subject not found"). The same English body comes back from the *pre-existing*
routes (`GET /api/subjects/:id`, the revisions route), so the new solutions routes inherited
the envelope rather than introduced it; the fe shows its own Arabic strings for these states.
Logged as an observation for a follow-up, not filed against this job.

**Print-background note (recorded by fe-2, confirmed here):** `.exam` keeps
`rgb(30,35,32)` under print while `.solutions` was reset — the pre-existing black-on-black
risk when a printer keeps backgrounds. Out of this Delta by fe-2's own negative clause;
already flagged for follow-up.

| U7 | KaTeX suspect glyph | constraints | zoomed the ex1 answer's «وبما أنّ x≠1» line — looked like a missing-glyph box | real ≠, not a leak | it is KaTeX's standard `\neq` (rlap-negation `.mrel`), 4 KaTeX spans in that paragraph; the "box" was screenshot resolution. KaTeX runs HTML-only output (no MathML), which also validated the leak-sweep method | ✅ |
| U8 | Correction is a separate sheet on screen too | 6 | DOM containment on S1 | correction never inside the exam pane | `.exam.contains(.solutions)` = false; exam text contains neither «التصحيح النموذجي» nor «سلّم التنقيط» | ✅ |
| U9 | One-exercise subject | boundary | open S2 in the UI | pane renders, no phantom exercises | 1 exercise, 1 solution block, 0 stale, 0 KaTeX errors, print + regen controls present | ✅ |
| U10 | Partial correction (only `ex3` stored) | 1, 5 | open S3 in the UI | missing ones shown truthfully, not blank, not faked | `ex1`/`ex2` show «لا يوجد تصحيح لهذا التمرين بعد.» each with its own per-exercise regenerate control; `ex3` shows its full worked answer | ✅ |
| U11 | Partial correction PRINTS truthfully | 6 | materialise print rules in solutions mode on S3 | the "no correction yet" notice survives to paper; buttons do not | `.sol__empty` `display:block` in print, `.sol__regen` none — a partial printed sheet says it is partial | ✅ |
| U12 | Second-device refine while tab open | 3 | with S1 open and current, PUT-refine `ex1` via curl, then flip subjects in the UI (no reload) | staleness appears on next read | switching back to S1 re-fetches: `ex1` and `ex2` both badged stale on screen | ✅ |
| U13 | Reload mid-flow | journey | F5 on S1 | same subject restored, staleness intact | same subject re-opened from `teacher.current.v1`; 3 blocks, 2 stale, RTL, 0 KaTeX errors | ✅ |
| U14 | Double-click print | journey | double-click «طباعة التصحيح» (stubbed `window.print`) | no wrong-sheet print | one print call, marker `solutions` — coalesced, correct sheet | ✅ |

**Bold-markdown note (pre-existing, both fe journals record it):** `**…**` renders
literally in exam and correction alike (`lib/katex.tsx` behaviour, in neither Delta).
Confirmed still visible on screen; cosmetic, already flagged for follow-up.

## Negation space not exercised, and why

- **A real `POST /api/generate` run** — forbidden by cost rule; the recorded envelopes
  replayed instead. Consequence: this QA pins the pipeline around generation, not the
  skill's live variance — same honest limit be-1's review already stated.
- **Store down (`503 store_unavailable`)** — would require stopping Mongo, which the lane
  rules forbid (shared infra). Not exercised.
- **Clicking the real generate/regenerate buttons** — same cost rule; their concurrency
  guard is pinned by fe-1's repaired mutation clause and was not re-tested from outside.

## Violations

None. No SEED claim was falsified and no hard constraint (Arabic-only, RTL, KaTeX,
LaTeX-hidden) was breached on screen or in the materialised print output. Two
observations, neither a violation of this job:

1. **E1 — English `subject_not_found` message** ("subject not found") — pre-existing
   envelope, inherited not introduced (identical on `GET /api/subjects/:id` and the
   revisions route). The UI shows its own Arabic strings; a teacher only meets the raw
   message via direct API use. Worth a small follow-up job across all routes.
2. **B7 — duplicate `exerciseId` inside one batch** is accepted, last entry wins,
   exactly one row. The contract is silent; behaviour is deterministic and harmless. If
   the contract ever wants strictness, reject duplicates at validation.

## Verdict

**validated.**

Every SEED claim held under attack: the correction exists per exercise with a grading
scale that must sum (claim 1–2, enforced at the door with Arabic errors); staleness is
per-exercise, derived on read, fail-safe against laundering, survives a second device,
heals on restore, and is honest on screen *and on paper* (claim 3–4); regenerating one
stale correction leaves the others byte-untouched, even concurrently (claim 5); the two
printable sheets provably never merge and the correction pane is never inside the exam
(claim 6); cost is recorded when supplied and nothing is metered (claim 7). The induced
failures all produced true, Arabic, correctly-typed answers with correlation ids, and
the boundary shapes (one exercise, partial correction, 500 KB answer, float-exact
fractional marks, FP-overflow scale trick) were all handled without a lie.
