# be-3 — admin read surfaces and the global KPIs

**Status:** done · gate `69/69` green (14 be-1 + 18 be-2 + 37 be-3) · freeze audit clean
apart from one declared be-2 correction (below).

## Pre-flight (slot-2 ground truth, re-run)

```
GET /api/admin/kpis      -> 404 {"error":{"message":"not found","type":"not_found"}}
GET /api/admin/teachers  -> 404  (same)
GET /api/admin/exams     -> 404  (same)
```

Reproduces. Store at the time: `subjects 3196` · `teachers 5450` · exams carrying both
KPI numbers `70`.

## Oracle first, RED before code

`features/accounts-hardening/tests/be/admin-surfaces.characterization.test.js` — first
run **33 failed**, every be-3 clause among them.

That first run also turned **be-2's** dry-run clause red, and it was right to: once
`admin@app.com` genuinely existed as an admin, the script's already-admin branch
printed "nothing to do" without announcing that it was a dry run. A run that writes
nothing must SAY it wrote nothing, or the operator cannot tell a dry run from an apply
that quietly declined. Fixed in the script (4 lines), not in the oracle.

## Delta

- `src/routes/admin.ts` — **new**.
- `src/app.ts` — mounted, 9 lines.
- `scripts/seed-admin.mjs` — the declared be-2 correction above.

`src/routes/subjects.ts`: **untouched**, as required.

## Decisions worth a reviewer's eye

- **Separate file, separate guard, separate queries.** The admin routes never call a
  teacher query and never take a teacherId from a request. There is no `if (isAdmin)`
  anywhere.
- **Read-only, all of it.** No admin write surface exists — an operator console that
  can only look cannot break a teacher's exam.
- **Allow-list projections, never delete-lists.** A secret added to `teachers` later is
  excluded by default rather than leaking until someone remembers to redact it.
- **`examsWithKpis` counts exams carrying BOTH numbers, and both averages are computed
  over exactly that set.** One denominator, reported once, no ambiguity about which
  average it describes. be-1 writes the pair together, so a half-populated document is
  not a shape this service produces.
- **The KPI-bearing set is established by `$match` in the pipeline**, not filtered
  afterwards — the same discipline as scoping ownership in the query. Excluded
  documents never become zeroes that something downstream might average.
- **No rounding.** Rounding a KPI here would invent a precision claim the presentation
  layer is better placed to make. `costUsd` is never labelled, validated or formatted
  as currency anywhere in this file.
- **`0`, never `NaN`, on an empty denominator.** `NaN` serialises to `null` through
  JSON and reads as "no data" rather than as the bug it is.
- **The teacher→exam-count join is done in memory**, from one grouped pass, so a
  teacher with no exams still appears with `0`. A database join that drops the empty
  side would make a brand-new teacher invisible on the day they sign up.
- **The admin paths are deliberately NOT advertised in the public `/api` index.** That
  listing is the teacher-facing description of the service. The guard is the boundary —
  obscurity is not — but there is no reason for a public index to enumerate paths no
  teacher can use.

## Clauses written from the start

- **Not-cached clause** (the other time the same value could be computed): a snapshot
  refreshed on a timer would pass every other KPI clause and still be wrong for the
  operator watching it. A create between two reads must show up in the second.
- **Vacuity guard on the headline clause:** "no hash leaks" is trivially true of an
  empty list, so a companion test signs a teacher up, asserts the stored row really
  does carry a `scrypt$` hash, and then asserts that same teacher's row in the admin
  response does not.
- **The cap must bind:** with thousands of stored exams the list is asserted to be
  exactly 200, not merely `<= 200`. A cap that never binds is not a cap.
- **No teacher content in the exam list** — no `subject`, no `exercises`, no statement
  text. An operator list is a list, not a bulk export of everybody's coursework.
- **The admin's extra knowledge is not a key:** it can see an exam's id on
  `/api/admin/exams` and still gets the same `404 subject_not_found` on the teacher
  route.
- **Guard clauses carried from be-2** (401 unknown / 403 teacher / 200 admin on each of
  the three routes; 401 and 403 never collapsing; the 401 body byte-identical to a
  teacher surface's).

### How the averages clause was made deterministic

The store is shared and a sibling suite runs in parallel, so a before/after equality
would have been flaky. Instead: insert 150 exams carrying `costUsd 4` and 150 carrying
none, then compare against two *predicted* models computed from the run's own "before"
reading. Ignoring nulls predicts ≈2.9; counting them as zero predicts ≈0.18 — the two
are ~16× apart, far outside any drift a parallel suite can cause. `examsWithKpis` is
asserted to rise by ~150 and not by ~300, while `totalExams` rises by all 300.

## Mutation spot-check

1. `$match` on the KPI-bearing set removed and `$ifNull → 0` added (the exact
   "count nulls as zero" bug). **Caught by** `THE CLAUSE THAT MATTERS — null-KPI exams
   are IGNORED, not counted as zero` *and* `examsWithKpis is a real denominator`.
2. Projection removed from the teachers query. **Not caught — an equivalent mutant**,
   and worth knowing: the response is shaped by an explicit field-by-field map, so the
   projection is defence-in-depth rather than the load-bearing control. Reported here
   rather than quietly discarded.
3. The realistic version of the same regression — projection removed *and* the explicit
   map replaced with a `...t` spread ("just return the row"). **Caught by**
   `NO HASH EVER LEAVES THE SERVICE › /api/admin/teachers carries no hash` and by the
   vacuity guard.

All reverted; gate green again.

## Reviewer notes / open observations

- **`/api/admin/teachers` is uncapped**, per the contract, which caps `exams` at 200 and
  says nothing for teachers. The live store already holds **5450** teacher rows (mostly
  anonymous ones minted by `POST /api/teacher`), so that response is large today and
  will only grow. Implemented as contracted rather than silently deviating; flagging it
  as a probable follow-up (a cap, a filter to rows with an account, or paging).
- The fully-empty-system case (zero exams, zero teachers) cannot be exercised against a
  populated shared dev store. It is guarded in code (`examsWithKpis === 0 ? 0 : …`,
  `totalTeachers === 0 ? 0 : …`) and the observable half is asserted: every KPI is a
  finite number, never `NaN`/`null`, and the per-row empty case (a teacher with no
  exams listed as `0`) is covered directly.

## Freeze audit

```
git -C stacks/teacher-be status --short
 M scripts/seed-admin.mjs     ← declared be-2 correction (4 lines)
 M src/app.ts                 ← mount only
?? src/routes/admin.ts        ← new
```

## review
**approve.** Averages verified against Mongo to the digit over exactly `examsWithKpis`; the
3443 null-KPI documents are excluded rather than counted as zero. No hash leaves the service
on any admin route (checked by string search over every response). Ownership never relaxed —
an admin reading another teacher's subject through a teacher route still gets 404.
Note for a later cleanup: role→string logic exists twice (`roleOf` and an inline ternary in
`admin.ts`), so one test cannot cover both.
