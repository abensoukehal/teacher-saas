# be-4 — journal · the school lands on the teacher row

Implementer: `be` stack agent. Lane slot 8 (`be` :9800, log `/tmp/teacher-backend.s8.log`).
Budget: 8 iterations. **Used: 2.**

---

## Pre-flight (runtime gate) — PASS

Re-ran the sub-issue's Ground-truth commands against the live lane before writing a line.

| probe | recorded | observed 2026-08-11 | verdict |
|---|---|---|---|
| `PUT $CHAR_BE_URL/api/teacher/school` | the surface does not exist | `404 {"error":{"message":"not found","type":"not_found"}}` | match |
| `curl -sX POST $CHAR_BE_URL/api/teacher` | `201 {teacherId: <32hex>, correlationId}` | same | match |
| the minted row's on-disk keys | `createTeacher`/`ensureAnonymous` write no `school` | `_id createdAt email passwordHash recoveryHash recoveryUsedAt role teacherId updatedAt` — **no `school`** | match |
| `db.teachers.countDocuments({school:{$exists:true}})` | — | **0 of 17,862** | recorded |
| `db.teachers.countDocuments({role:{$exists:false}})` | the absent-is-safe precedent | **6,164** rows with no `role` field at all | recorded |
| `POST /api/auth/signup` → keys | — | `correlationId, recoveryCode, teacherId` | recorded |
| `POST /api/auth/signin` → keys | — | `correlationId, teacherId` | recorded |

The minted and signed-up rows were removed after the read. Sub-issue is loop-ready.

The two counts are the whole risk in one line: **6,164 rows have no `role` and 17,862 have
no `school`**, and this sub-issue adds a field to the collection that holds both scrypt
hashes. Nothing may change for a row that has neither field, and the write must reach one
key of one document.

---

## Cycle 1 — the oracle, then the two files

**Oracle first, then frozen.**
`features/classes-progress/tests/be/teacher-school.characterization.test.js`, **52
clauses**, written and run RED before a line of source existed: **25 failed, 218 passed**
(the 218 are be-1's 47, be-2's 97, be-3's 48 and the 26 of mine that already pass against a
service where nothing has changed). Lane from `CHAR_BE_URL`; no port appears in the file.

Four decisions were taken while writing the suite, because a frozen oracle has to state
them before an implementation can be judged against them.

1. **The credential row is compared WHOLE, not field by field.** The clause signs a teacher
   up, records the entire document, writes a school, re-reads, and asserts that the set of
   changed keys contains `school` and nothing outside `{school, updatedAt}` — then asserts
   the key set is exactly the recorded nine plus `school`. A handler that rebuilt the
   document to change one label would pass every happy-path clause and silently disable an
   account. Its executable counterweight is the next clause: the account still signs in with
   the same password afterwards.
2. **Blank clears; absent is a 400.** The contract states `{school: null}` clears and is
   silent on `""`. Decided in the direction a text input actually behaves: `""` and
   whitespace-only trim to `null`, so blanking is removal. A body with **no `school` key at
   all** is a `400` — reading a missing field as a clear would let a malformed request
   destroy a stored value. The pair keeps the stored value set at `{absent, null, non-empty
   string}`, which is what lets a future reader have two cases instead of three.
3. **"Stored, not surfaced" is pinned per surface, one probe each (WF-70).** Sign-in,
   `GET /api/subjects`, `GET /api/classes`, `GET /api/progress/:classId`, `/health` — and
   `GET /api/admin/teachers`, which is the only route in the service that projects out of
   `teachers`. It is an allow-list on purpose (a new field is excluded by default rather
   than leaking until someone redacts it) and be-4 is the first field added to that
   collection since that rule was written, so the clause makes the guarantee executable.
4. **The identity gate is asked the same five ways the other guarded surfaces are asked**,
   including the UPPERCASE of a real owned id, and the 401 body is compared byte-for-byte
   against `GET /api/classes`'s. A route with its own wording is a route that can be told
   apart from the others, which is a probe by another name.

**The implementation is two files and about sixty lines.**

- `src/store/teachers.ts` — `school?: string | null` on `TeacherDoc`, a `setSchool` that is
  `$set: {school, updatedAt}` and nothing else, and the optional `school` pass-through on
  `createTeacher` guarded by `if (school !== undefined)`. That guard is the whole reason a
  fresh mint's on-disk shape is unchanged: writing `school: null` unconditionally would
  redefine what "absent" means for every row created after this deploy, invisibly.
- `src/routes/auth.ts` — `PUT /teacher/school`, the one route in that file behind
  `requireTeacher`. It lives there because that is where the teacher-account surfaces live
  and because the sub-issue's Delta names it (see the deviation below). No rate limit: the
  limiter guards the secret-guessing surfaces, and adding one here would be a product
  decision, not a hardening freebie (be-5's Delta forbids it outright).

`roleOf`, the scrypt paths and the recovery paths are untouched — `git diff` shows no hunk
inside the signup, signin or recover handler bodies.

---

## Cycle 2 — a frozen pin says the `/api` index does not grow

The first green run was not green: **two frozen oracles went red**, both on the same fact.

```
be-2 › /api grew by exactly one entry            Expected: 11  Received: 12
be-3 › /api still lists every recorded route and grew by nothing
                                                 +   "/api/teacher/school",
```

Cycle 1 had added `/api/teacher/school` to the `/api` index in `src/app.ts`, following
be-1's precedent of listing each new surface. be-2 pins the index at exactly
`RECORDED_ROUTES.length + 1` entries and be-3 pins it as an exact set. **Both are frozen
against this implementer**, and the done-protocol requires all three prior suites green and
unmodified. So the index line was reverted, and the mistake was mine, in my own suite.

It is also the right answer on its merits, which is why this is a correction rather than a
concession. **The index is PREFIX-level**: `/api/subjects` stands for eight routes including
`/api/subjects/:id/exercises/:exerciseId/regenerate`, and `/api/teacher` already names the
surface this route sits on. Listing `/api/teacher/school` would have put the only sub-route
in the list. `src/app.ts` ends the sub-issue **unmodified**.

My own suite's perimeter clause was corrected to match the frozen net — the differential is
now "empty in both directions" — and given the counterweight that the weaker version
lacked: **the route is reachable even though it is not indexed.** An unguarded probe must
reach the *guard* and answer `401`, not the `404` that path answered at pre-flight. Without
that clause, "the index did not change" would be satisfiable by the route not existing.

---

## Done-protocol

### 1 · Oracle green ×2

`tools/ci be --slug classes-progress`, from the be worktree, twice: **244/244, gate PASS**
both times. be-4 contributes **52** clauses.

### 2 · Perimeter differential

| probe | before | after | verdict |
|---|---|---|---|
| `GET /api` routes | the recorded 11 | the recorded 11, byte-identical | unchanged |
| `POST /api/auth/signup` → keys | `correlationId, recoveryCode, teacherId` | identical, `201` | unchanged |
| `POST /api/auth/signin` → keys | `correlationId, teacherId` | identical, `200` | unchanged |
| a signed-up row's on-disk keys | the recorded 9 | the recorded 9 — **no `school`** | unchanged |
| a `POST /api/teacher` row's keys | the recorded 9 | the recorded 9 — **no `school`** | unchanged |
| the four existing suites | be-1 47 · be-2 97 · be-3 48 | **192 passed, 192 total**, files unmodified | green |
| `db.teachers` rows carrying `school` | 0 of 17,862 | 0 of 17,862 (after cleanup) | invisible until written |

A real write, end to end, against the lane — the row after `PUT /api/teacher/school`:

```
{ _id, teacherId, createdAt, email: null, passwordHash: null, recoveryHash: null,
  recoveryUsedAt: null, role: 'teacher', updatedAt: <advanced>,
  school: 'ثانوية الأمير عبد القادر' }
```

One key added, one timestamp advanced, the two hash fields and `role` untouched.

**Observability.** One line per accepted write, in this file's own idiom:
`{"msg":"teacher.school","correlationId":…,"teacherIdPrefix":"2605cce0","cleared":false}`.
The whole 32-hex bearer value appears in **no** `teacher.school` line (`grep -cE
'[0-9a-f]{32}'` → 0), and the school NAME is not logged either — it is teacher content, and
`cleared` is the only thing an operator needs. `src/mutationlog.ts` was deliberately NOT
extended: its `MutationEvent` union and its required `classId` describe class/progress
writes, and be-5's concurrency drill counts those lines as its oracle. Widening that type
for a teacher-profile write would have put a frozen module's shape at risk for no gain.

### 3 · Freeze audit

```
git status --short                       → M src/routes/auth.ts · M src/store/teachers.ts
git status --short -- src/teacher.ts src/inflight.ts src/routes/subjects.ts \
    src/store/subjects.ts src/store/classes.ts src/routes/classes.ts \
    src/store/progress.ts src/routes/progress.ts src/store/programmes.ts \
    src/mutationlog.ts                   → (empty)
git diff -U0 -- src/routes/auth.ts | grep '^@@'
    → @@ -11,0 +12 @@   (import)
      @@ -16 +17 @@     (import)
      @@ -25,2 +26,4 @@ (file header comment)
      @@ -34,0 +38,3 @@ (SCHOOL_MAX)
      @@ -261,0 +268,59 @@ (the new route, appended AFTER the recover handler closes)
```

No hunk falls inside the signup (`99–185`), signin (`187–224`) or recover (`226–260`)
handler bodies. `roleOf` and the scrypt/recovery code paths are byte-identical.
`src/app.ts` is unmodified.

### 4 · `tools/ci be --slug classes-progress`

`gate PASS (1 ran, 0 skipped)` · `244/244` · run from
`project-worktrees/classes-progress/stacks/teacher-be`. `npx tsc --noEmit` clean.

### 5 · Journal sealed

Budget 8, **used 2**. No stop condition met — the sub-issue's ask-when is "any surface
seems to need to RETURN school", and none does.

---

## What this sub-issue did not settle

1. **`PUT /api/teacher/school` lives in `src/routes/auth.ts`, not next to `POST
   /api/teacher`.** The Delta said "the file declaring `POST /api/teacher` (routes/auth.ts
   path per SEED §4)" — and those are two different files: that route is actually declared
   in `src/routes/subjects.ts:127`, which is frozen for this implementer as be-3's file.
   The named path was taken. It is the better home anyway (the account surfaces live there;
   `POST /api/teacher` sits in `subjects.ts` for historical reasons), but the plan's
   parenthetical was wrong about the codebase and a later slice tidying the teacher routes
   into their own router should know that.
2. **`school` is stored and nothing reads it.** Write-only is the contract for slice 1
   (§0), so the value's only consumer today is a mongosh query. The print sheet is the
   intended reader; until it lands, no product behaviour changes when a teacher sets one,
   which will look like the feature not working to anyone trying it end to end.
3. **The 120-character bound is this sub-issue's invention.** The oracle's clause named
   "121-char → 400"; the contract names no length. 120 was chosen to match that clause and
   is in the same family as the class-name bound of 80. If a real Algerian school name
   overruns it, this is the number to move, and it lives in one place
   (`SCHOOL_MAX`, `src/routes/auth.ts`).
4. **Blank-clears is a decision, not a contract clause.** `{school: ""}` and whitespace-only
   both clear. `fe` may want a confirm step before a blur silently removes a stored value —
   the server cannot tell an intentional blank from an accidental one.
5. **`createTeacher`'s `school` pass-through has no caller.** It exists because the Delta
   asked for it and because the future sign-up-with-school shape is cheaper to allow than
   to retrofit. Until something passes it, it is one `if` guarding a parameter nobody
   supplies — worth deleting if slice 2 decides sign-up will never carry a school.
6. **No read route, and therefore no `schoolOf` allow-list.** The absent-reads-as-null
   discipline is carried by the write path normalising at the boundary (only `null` or a
   non-empty trimmed string is ever stored) and by the doc comment on `TeacherDoc.school`.
   The slice that adds the reader owes the codebase the `roleOf`-shaped function; adding a
   caller-less one here would have been dead code.

## review

**Verdict: approve.** Cross-model review (Fable), by execution against lane 8.

Attack log:
- `PUT /api/teacher/school`: set, blank-clears, 121-char refusal re-verified. The
  credential row's key-set discipline is pinned whole-document in the oracle; no leak of
  `school` on any read surface (probed sign-in, subjects, classes, progress, /health).
- The `/api`-index correction (cycle 2) is the right call and the frozen pins that forced
  it did their job — a good example of the freeze working as designed.
- Standing debt (already recorded, agreed): write-only `school` will read as "the feature
  does not work" to anyone testing end to end; the caller-less `createTeacher`
  pass-through should be deleted if slice 2 decides sign-up never carries a school.
