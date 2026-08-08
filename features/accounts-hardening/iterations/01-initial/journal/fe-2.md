# fe-2 — the admin console

**Status:** done · gate `32/32` green (both fe suites) · freeze audit clean · verified
against the live lane in Chrome, which found two defects no jsdom test could see.

## Pre-flight (ground truth, re-run)

```
grep -rniE '\brole\b|isAdmin' stacks/teacher-fe/src/   → ARIA attributes only
no admin UI; signing in as any account lands on the builder            (confirmed)
```

Live shapes recorded from `:9500` before writing a line of UI:

```
GET /api/admin/kpis      → totalExams 3761 · totalTeachers 7385 · examsWithKpis 330
                           avgCostUsdPerExam 0.5571… · avgDurationMsPerExam 85918.8…
GET /api/admin/teachers  → 7385 rows, UNCAPPED
GET /api/admin/exams     → 200 rows (be's cap), 92 of them carrying KPIs
teacher id → 403 forbidden · no id → 401 teacher_required
```

## The decision the sub-issue could not make for me

The Delta says "route to it when the signed-in account is an admin". **`be` exposes a
role on no teacher-facing surface** — `POST /api/auth/signin` returns
`{teacherId, correlationId}` and nothing else, and be-2's exit clause is explicit that
privilege is never inferred from anything but the stored role. So `fe` cannot *know* an
account is an admin without asking an admin route — and the oracle forbids exactly that
("a teacher never sees it — assert the teacher UI renders and **no admin call is made**").

Resolved by making the console an **address, not an inference**: `#/admin`.
`requireAdmin` stays the single authority on who may be there, `fe` decides nothing, and
a teacher using the product issues no privileged request at all. A client-side role flag
would have been a second source of privilege truth, and a spoofable one.

**Reviewer's call to make:** an admin reaches the console by URL. There is no link,
because any link a teacher can see is an invitation to fire a refused admin request.
The alternative — `be` echoing `role` on sign-in — is a contract change and was not
taken unilaterally.

## Oracle first, RED before code

`features/accounts-hardening/tests/fe/admin-console.characterization.test.tsx`,
20 clauses on the live shapes. First run: **18 failed, 14 passed** across the two fe
suites — the 2 passes in this file are the ones asserting today's teacher-only
behaviour, which must hold before *and* after.

## Delta

- `src/components/AdminConsole.tsx` (new) — the console, all four states.
- `src/lib/api.ts` — `AdminKpis`/`AdminTeacher`/`AdminExam` + the three GETs, and a new
  `forbidden` **FailureKind**. Without it a 403 fell to the default
  `{backend, retryable: true}` and would have offered a teacher a retry button for a
  settled fact about their account.
- `src/App.tsx` — the `#/admin` route, after the auth gate.
- `src/App.css` — `.admin*`, logical properties only.

**Frozen and untouched:** `ExamView`, `RefinePanel`, `SolutionView`, `SubjectList`,
`Controls`, `AuthPanel`, `exam.ts`, `taxonomy.ts`, the print paths. The diff is
**+268 / −0** — purely additive.

## Decisions worth a reviewer's eye

- **Two independent allow-lists, not one.** `be` projects an allow-list and no hash can
  arrive; the console still picks every field by name and never spreads or stringifies
  a row. A leaked hash cannot be rotated out of a screenshot, so the redundancy is the
  point. The oracle feeds it a payload that *does* carry `passwordHash`/`recoveryHash`
  and asserts on `innerHTML` — attributes leak as thoroughly as text.
- **The guard is asked ONCE.** KPIs load first; the two lists only on success. A refused
  teacher therefore issues exactly one admin request, not three.
- **The denominator lives inside the KPI block**, spanning every column, so it cannot be
  read away from the averages it describes. Today that is 330 of 3761 — the two averages
  describe under a tenth of the system.
- **No currency anywhere**, in a label, a value or a class name. The Arabic label is
  «متوسط وحدات الاستهلاك لكل موضوع» — units of usage, which is what it is.
- **A teacherId is never rendered in full.** It is still a bearer credential; a screen of
  7385 live credentials is a worse artefact than a slightly harder correlation task. An
  8-hex prefix is unambiguous at this scale.
- **`teachers` is capped at 200 rendered rows and says so** («معروض أول 200 من أصل 7385»).
  A truncation nobody is told about is worse than a long page. The real fix is a cap or
  cursor on `be` — recorded below, not smuggled in here.
- **Dates are `iso.slice(0,10)`, not `toLocaleDateString`.** The latter resolves against
  whatever ICU the runtime carries, so jsdom and Chrome disagree, and an Arabic locale
  can emit Arabic-Indic digits this app deliberately does not use.

## Clauses written from the start (not after a bug)

- **Race, one `act()`** — two retry presses dispatched inside a single `act()` so React
  cannot re-render between them; `fireEvent` would only have proved `disabled` works.
  `/api/admin/teachers` aggregates the whole `subjects` collection per call.
- **Both halves of the boundary** — the teacher UI renders *and* zero admin calls fire.
- **403 ≠ 401** — a refusal renders with no retry; an unknown id drops the identity and
  hands over to the sign-in gate. Branching on the status code conflates them.
- **Every state, including the ones nobody demos** — loading, empty system (zeroes and
  empty lists, asserted free of `NaN`/`Infinity`/`undefined`), 403, retryable
  `store_unavailable`, success.
- **Read-only** — no non-GET request, and the only buttons in the console are «إعادة
  المحاولة» and «العودة إلى المولّد».

## Mutation spot-check

| mutation | caught by |
|---|---|
| leak the row into an attribute (`title={JSON.stringify(t)}`) | `NO HASH EVER REACHES THE DOM…` **and** `a teacherId is never rendered in full` |
| relabel the KPI «متوسط التكلفة لكل موضوع (USD)» | `COST IS NOT MONEY…` **and** `every string is Arabic…` |
| load all three surfaces in `Promise.all` | `a teacher who goes looking is REFUSED, and the lists are never requested` **and** `403 and 401 render DIFFERENTLY` |
| hide the denominator | `THE DENOMINATOR — the averages state what they were computed over` |

All reverted; gate green again.

## What the browser found and jsdom could not

Verified on the real lane (`:10500` → `:9500`), as the admin and as a teacher.

1. **The truncated id rendered backwards.** `a45e660a…` displayed as `…a45e660a` —
   `…` is a bidi-**neutral**, so inside this RTL page it resolved to the paragraph
   direction and painted to the *left* of the Latin run, reading as "truncated at the
   start" and pointing an operator at the wrong end of the id. Measured in Chrome: two
   client rects with the ellipsis first at x=0. Fixed with an `<span dir="ltr">`
   isolate (one correctly-ordered rect). **`textContent` is byte-identical either way**,
   so no assertion could have caught it — the oracle now pins the isolation attribute,
   which is the part jsdom *can* see.
2. **The back button stretched the full page width** in the loading and failure states:
   `.admin` is a flex column, so a bare `<button>` is a flex item under the default
   `align-items: stretch`. Wrapped in `.admin__state`, held to the same 820px measure
   as `.alert`. jsdom lays nothing out, so again invisible to the suite.

Live confirmations, against the real backend and real data:

```
teacher session  → apiCalls ["/api/subjects"] · adminCalls 0 · console absent
                 · the word «مشرف» absent from the whole teacher UI
teacher #/admin  → adminCalls ["/api/admin/kpis"] only · «هذه الصفحة مخصَّصة للمشرف»
                 · buttons ["العودة إلى المولّد"]  (no retry)
admin  #/admin   → one call each to kpis/teachers/exams
                 · leaks ["scrypt$","passwordHash","recoveryHash","$","USD","دج"] → none
                 · teacherRows 200 (of 7385) · examRows 200
                 · horizontal page overflow: false · console errors: none
back to builder  → sidebar on the right, builder intact
```

> The admin session was reached by reading `teachers.teacherId` for `admin@app.com`
> out of the local Mongo — the id **is** the bearer credential. `ADMIN_PASSWORD` was
> never read, never needed, and appears in no file, test or fixture here.

## Freeze audit

```
git -C stacks/teacher-fe diff --stat        (fe-2 only)
 src/App.css    | 142 ++++++++++++++++++++
 src/App.tsx    |  43 ++++++++
 src/lib/api.ts |  83 +++++++++++++
 + src/components/AdminConsole.tsx (new)
 268 insertions(+), 0 deletions(-)
```

## Follow-ons a reviewer must decide on

1. **`GET /api/admin/teachers` is uncapped** and already answers with 7385 rows. `fe`
   caps what it draws and states the total; `be` should grow a cap or a cursor. Not
   done here — it is a contract change and fe-2's Delta freezes `be`.
2. **`rate_limited` (429) is unmapped in `fe`'s `KIND` table.** It falls to the default
   `{backend, retryable: true}`, which is *correct* — but accidentally so, and it will
   stop being correct the first time the default changes. One line, deliberately not
   taken: it is the auth surface, not this Delta.
3. **An admin has no link to the console.** See the decision above; if `be` echoes
   `role` on sign-in in a later job, the route can become a rendered affordance.

## review
**approve.** Server-gated by `requireAdmin`; `fe` decides nothing. A teacher session issues
**zero** admin calls and the word «مشرف» appears nowhere in the teacher UI. No hash, no
currency symbol, all Arabic, RTL intact. Four of four mutations caught.

The `#/admin` decision was verified and judged sound: `be` exposes role on no teacher-facing
surface, so auto-detection would fire a privileged request from every teacher session. An
address, not an inference.
