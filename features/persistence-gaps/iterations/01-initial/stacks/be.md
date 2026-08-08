# Stack spec — teacher-be (Express · TypeScript · ESM · Node 20+)

> Filled by `/planning` 2026-08-08 from the locked SEED. Implemented by the `be` stack agent.

## Scope recap (from SEED.md + this stack's sub-issues)

- **Modules:** `src/store/teachers.ts` (new) · `src/store/revisions.ts` (new) ·
  `src/routes/auth.ts` (new) · `src/store/subjects.ts` (modify) ·
  `src/routes/subjects.ts` (modify) · `src/teacher.ts` (modify) · `src/app.ts` (mount only)
- **Contracts this stack must honor:** `contracts/fe-be-auth.contract.md` ·
  `contracts/fe-be-subjects-v2.contract.md`
- **Not in scope:** deploy/backup (#6, split to teacher-saas#4) · rate limiting ·
  rotating sessions · mail.

## Current behavior baseline

Recorded 2026-08-08 on the job lane (`be` :9300) — SEED kit §2. Pinned by
`features/persistence-gaps/tests/be/*.characterization.test.js`, run via
`tools/ci be --slug persistence-gaps` **from the job worktree**.

| Surface | Today |
|---|---|
| `POST /api/teacher` | `201 {teacherId}` — minted by `randomBytes(16)`, **never stored** (`src/teacher.ts:20-22`) |
| `requireTeacher` | accepts **any** 32-hex id; unknown id owns nothing (`src/teacher.ts:41-52`) |
| `POST /api/subjects` | insert-only; stored doc = `_id, teacherId, subject, controls, createdAt, updatedAt` |
| `PUT …/exercises/:exerciseId` | `$set: {"subject.exercises.$": next}` — prior version **destroyed** (`src/store/subjects.ts:168`) |
| `teacher_saas` collections | **one**: `subjects` |
| `/api/generate` | already returns `costUsd` + `durationMs` in the envelope (`src/app.ts:145`) — **frozen, not touched by this job** |

### Test harness — settled by probe, read before writing a test

Carried from the `persistence` job's `stacks/be.md`, and it is why the sub-issues below are
shaped the way they are:

- **Black-box over HTTP, by necessity.** `dist/` is ESM and jest's CJS runner cannot import
  it. Drive the running lane with `fetch`, assert with the `mongodb` driver directly.
- **Filename must match `*.characterization.test.js`** — there is no TypeScript transform.
- **A `be` sub-issue with no HTTP surface cannot be gated.** `persistence`'s `be-2` was a
  pure store module and had to be folded into `be-3` mid-implement, because it would
  otherwise have shipped code no gate could verify. **Every sub-issue below therefore
  carries its own route.** Do not re-split them into store-only slices.
- **Use the engine's lane helpers. Do not hand-roll a guard or a port** (WF-82, shipped
  2026-08-08 — this supersedes the earlier guidance in this file):
  ```js
  const { describeIfLane } = require("guard");
  const BE  = process.env.CHAR_BE_URL || "http://localhost:9000";  // tools/ci derives it
  const LOG = process.env.CHAR_BE_LOG || "/tmp/teacher-backend.log";
  describeIfLane(BE, "…", () => { … });
  ```
  `tools/ci` computes `CHAR_BE_URL` and `CHAR_BE_LOG` from **this checkout's own lane**, so
  the server you drive is the one `CHAR_ROOTDIR` resolves `dist/` and `run-log.jsonl`
  against. Hardcoding either pins the suite to one slot, where it skips forever — and a
  skip that looks like a pass is the failure WF-82 exists to stop.
- **A hollow gate is now RED in job mode.** If every test in the layer skips because no lane
  is up, `tools/ci be --slug persistence-gaps` FAILS. So `tools/dev up -d` before gating —
  a green here means tests actually ran.
- **`dist/` must be built** for any suite that spawns the server itself (`npm run build` in
  the checkout). The dead-store suite in the promoted net does this.

### Run headless

```bash
cd project-worktrees/persistence-gaps && ../../tools/dev up -d     # be :9300 · fe :10300
curl -s localhost:9300/health          # claude.ok, store.ok, queue depth
tools/obs logs be
```

> ⚠ `POST /api/generate` runs a whole agent loop — ~128 s, ~$0.65. **Never call it in a loop
> iteration.** Replay `project/features/persistence/iterations/01-initial/contracts/rec-exam-subject.2026-08-07.json`
> (also at `project/tests/be/persistence/fixtures/`, byte-identical).

## Observability (PIN co-requisite)

- **Visible today:** `store.write` structured log lines `{op, subjectId, correlationId}`;
  `run-log.jsonl` run lines (`costUsd`, `durationMs`) + subject link lines; `/health`
  reporting `claude.ok` and `store.ok`.
- **Blind spots this job closes:** cost-per-subject (no join key — `be-4`); orphan rate (no
  teacher registry to join against — `be-1`).
- **Blind spot NOT closed:** auth attempt volume. No rate limiting exists, so a failed-signin
  log line is the only signal. Accepted for this milestone; stated so it is not a surprise.

## Data model changes

| Model / store | Field | Change | Migration? |
|---|---|---|---|
| `teachers` (**new**) | `teacherId, email, passwordHash, recoveryHash, recoveryUsedAt, createdAt, updatedAt` | add collection | no — new |
| `exercise_revisions` (**new**) | `subjectId, teacherId, exerciseId, exercise, supersededAt, correlationId` | add collection | no — new |
| `subjects` | `genCorrelationId` | add, **nullable** | **no rewrite** — absent reads as `null` |

**Zero document rewrites** (SEED journal H8): every existing query is `{teacherId}`-scoped
and the `{teacherId:1, updatedAt:-1}` index stays valid. The ~90 existing documents are
untouched by every sub-issue except `be-5`, which deletes orphans deliberately.

## Surfaces (Express routes)

| Surface | Implementation path | New/Modify | Contract |
|---|---|---|---|
| `POST /api/auth/signup` | `src/routes/auth.ts` | new | auth |
| `POST /api/auth/signin` | `src/routes/auth.ts` | new | auth |
| `POST /api/auth/recover` | `src/routes/auth.ts` | new | auth |
| `requireTeacher` | `src/teacher.ts:41` | modify | auth |
| `GET /api/subjects/:id/exercises/:exerciseId/revisions` | `src/routes/subjects.ts` | new | subjects-v2 |
| `PUT /api/subjects/:id/exercises/:exerciseId` | `src/routes/subjects.ts:116` | modify (side effect only) | subjects-v2 |
| `POST /api/subjects` | `src/routes/subjects.ts:66` | modify (additive field) | subjects-v2 |

## Skills touched (`.claude/skills/`)

**None.** No sub-issue changes generation. If one starts building a prompt pipeline in
TypeScript, it is scoped wrong.

## Gating (concurrency, timeouts)

Unchanged. No sub-issue touches `runner.ts`; `CLAUDE_MAX_CONCURRENT` and `CLAUDE_TIMEOUT_MS`
keep their meaning. Auth routes never spawn the CLI, so they are unaffected by queue depth.

## Failure classification

Existing buckets unchanged. New paths land as: `400 invalid_request` ·
`401 invalid_credentials` / `invalid_recovery` / `teacher_required` · `409 email_taken` ·
`503 store_unavailable`. **`claude_auth` and `store_unavailable` are both 503 and mean
opposite things** — callers branch on `error.type`.

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
estimate: L
---
```

### be-1 — write the teacher down: `teachers` collection + sign-up/sign-in

1. **Intent:** gap #1's root cause is that the issued id is never recorded, so a cleared
   browser orphans every exam forever. Give the id a home and two ways to obtain it.

2. **Ground truth (recorded + re-run command):**
   ```bash
   $ curl -sX POST localhost:9300/api/teacher
   {"teacherId":"33f9094621f711999cc291dc8de5efed","correlationId":"…"}   # 201, nothing stored

   $ mongosh --quiet --eval 'db.getSiblingDB("teacher_saas").getCollectionNames()'
   [ 'subjects' ]                                                          # ← no teachers collection
   ```
   Pre-flight must reproduce both: one collection, and an id that is minted and forgotten.

3. **Delta:**
   - `teacher-be/src/store/teachers.ts` — **new**: `createTeacher`, `findByEmail`,
     `findByTeacherId`, `ensureIndex`; scrypt hash/verify helper.
   - `teacher-be/src/routes/auth.ts` — **new**: `POST /api/auth/signup`, `POST /api/auth/signin`.
   - `teacher-be/src/app.ts` — mount `authRouter()` under `/api` (one line, beside
     `subjectsRouter()` at `:86`).
   **Everything else frozen** — `requireTeacher` is **not** touched here (that is `be-2`);
   `POST /api/teacher` keeps working unchanged.
   Freeze check: `git status --short -- src/store/teachers.ts src/routes/auth.ts src/app.ts`

4. **Oracle (two-sided, executable)** — `features/persistence-gaps/tests/be/auth-signup.characterization.test.js`:
   - *positive:* signup → `201` with a 32-hex `teacherId` **and** a `recoveryCode` matching
     `/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}-[…]{4}-[…]{4}$/`; the Mongo doc has
     `passwordHash` and `recoveryHash` both starting `scrypt$`, and **neither the password
     nor the recovery code appears anywhere in the document** (assert by substring search
     over `JSON.stringify(doc)`).
   - *positive:* signin with the right password → `200` returning **the same `teacherId`**
     the signup returned. This is the load-bearing clause: it is what makes an exam
     reachable from a second browser.
   - *positive:* a subject created with that `teacherId` before signin is listed after
     signin — proving adoption of the existing id, not a new one.
   - *positive (WF-70, each variant):* signin failure for (a) unknown email, (b) known email
     + wrong password → **both `401 invalid_credentials`, byte-identical bodies**. An
     implementation that distinguishes them fails here.
   - *positive:* duplicate signup → `409 email_taken`.
   - *positive:* email is normalised — signup `Prof@Example.DZ`, signin `prof@example.dz` succeeds.
   - *negative:* `POST /api/teacher` response shape **bit-stable** vs. the slot-2 recording.
   - *negative:* all four subject routes unchanged — re-run the promoted persistence suite
     shapes against the lane; `GET /api/subjects` for an unknown id still `200 {subjects:[]}`
     (rejection arrives in `be-2`, not here).
   - *obs assertion:* `tools/obs logs be` shows a structured line per signup/signin carrying
     `correlationId` and **no password and no recovery code**.

5. **Boundaries:** honours `fe-be-auth.contract.md` § Storage, § Hashing, § Surfaces,
   § Error contract exactly. `scrypt` from `node:crypto` — **adding a hashing dependency is a
   stop, not a judgment call.** Additive only. Budget: 10 iterations.

6. **Exit:** done-when = oracle green + freeze respected + `tools/ci be --slug persistence-gaps`
   green · ask-when = the contract's hash format or error types would need to change · a
   password/recovery value would have to be stored or logged in plaintext · `requireTeacher`
   seems to need touching (that is `be-2` — stop) · budget blown.

```yaml
---
kind: sub-issue
id: be-2
parent: i1
stack: be
status: done
depends_on: [be-1]
estimate: M
---
```

### be-2 — recovery, and teach `requireTeacher` to reject

1. **Intent:** an account a teacher can be locked out of just relocates gap #1; and until an
   unknown id is rejected, the registry from `be-1` is decorative.

2. **Ground truth (recorded + re-run command):**
   ```bash
   $ curl -s -H "x-teacher-id: $(python3 -c 'import secrets;print(secrets.token_hex(16))')" \
       localhost:9300/api/subjects
   {"subjects":[],"correlationId":"…"}      # 200 — an id we never issued is ACCEPTED today
   ```
   Pre-flight must reproduce this `200`. It is the behaviour this sub-issue supersedes.

3. **Delta** (widened 2026-08-08 by the anonymous-teachers amendment — see the contract):
   - `teacher-be/src/routes/auth.ts` — add `POST /api/auth/recover`; sign-up **adopts** an
     unclaimed `x-teacher-id` when one is presented.
   - `teacher-be/src/store/teachers.ts` — add `consumeRecovery` (verify → set
     `recoveryUsedAt` → set new `passwordHash` + new `recoveryHash`, **one atomic update**);
     `ensureAnonymous`; partial unique index on `email`.
   - `teacher-be/src/routes/subjects.ts:60-62` — `POST /api/teacher` **records** the row it
     already mints. Response shape unchanged.
   - `teacher-be/src/teacher.ts:41-52` — `requireTeacher` looks the id up and rejects unknown.
   - `teacher-be/scripts/backfill-teachers.mjs` — **new.** One anonymous row per distinct
     `subjects.teacherId` that has none. Without it, rejection locks out all 159 existing
     teacherIds. Inserts into `teachers` ONLY — no subject document is touched.
   **Everything else frozen.**
   Freeze check: `git status --short -- src/routes/auth.ts src/store/teachers.ts src/teacher.ts src/routes/subjects.ts scripts/backfill-teachers.mjs`

4. **Oracle (two-sided, executable)** — `features/persistence-gaps/tests/be/auth-recover.characterization.test.js`:
   - *positive:* recover with the signup code + a new password → `200`, returns the **same
     `teacherId`**, and signin with the **new** password succeeds.
   - *positive:* the response carries a **fresh** recovery code, different from the consumed
     one, and that fresh code works on a second recovery. A teacher must never be left
     without a recovery path.
   - *positive:* the consumed code is **single-use** — replaying it → `401 invalid_recovery`.
   - *positive:* signin with the **old** password after recovery → `401 invalid_credentials`.
   - *positive (input normalisation):* `k7m2 p9qr 4xta` (lowercase, spaces) and
     `K7M2-P9QR-4XTA` both recover — same code, transcription-tolerant.
   - *positive:* unknown id is now **rejected** — `GET /api/subjects` with a fresh 32-hex id
     → `401 teacher_required` (existing type; error envelope unchanged).
   - *positive:* a **registered** teacher's id still reaches their subjects — the whole
     point; assert the list is non-empty for a signed-up teacher who created one.
   - *negative:* the error envelope is byte-stable — `{error:{message,type},correlationId}`,
     `type` still `teacher_required`, `message` in Arabic.
   - *negative:* `POST /api/auth/*` and `POST /api/teacher` do **not** require the header.
   - *obs assertion:* a rejected request logs one line with `correlationId` and the rejection
     reason, and **never** the offered id in full.

5. **Boundaries:** honours `fe-be-auth.contract.md` § Recovery code and § What changes on an
   existing surface. **Declared supersession (WF-65):** this sub-issue's scope is exactly to
   change the unknown-id acceptance that `persistence`'s promoted suites pin. Amending those
   pins is permitted **only** inside this Delta, must be declared in the journal (which pin,
   why), and the invariant "a valid teacher reaches only their own subjects" must remain
   true. Budget: 10 iterations.

6. **Exit:** done-when = oracle green + freeze respected + `tools/ci be --slug persistence-gaps`
   green · ask-when = a promoted pin outside this Delta goes red · recovery cannot be made
   atomic · the supersession looks like regression-masking rather than declared change ·
   `POST /api/teacher` would need removing (it must keep working — `fe` still uses it until
   `fe-1` lands) · budget blown.

```yaml
---
kind: sub-issue
id: be-3
parent: i1
stack: be
status: done
depends_on: []
estimate: M
---
```

### be-3 — keep every superseded exercise

1. **Intent:** refining is the product's central act, and today it destroys the previous
   version — so the one interaction the product exists for is the one with no undo.

2. **Ground truth (recorded + re-run command):**
   ```bash
   $ python3 features/persistence-gaps/iterations/01-initial/journal/probe-gaps.py
   ### P3  GAP 2 — replace ex1, then look for the previous version
       before: ex1 = "**الجزء الأول**\n\nنعتبر الدالة $f$ المعرّفة على …
       PUT 200  after: ex1 = "REPLACED — probe v2"
       EXPECT: prior version unrecoverable; no history key →
               ['correlationId','createdAt','id','subject','updatedAt']
   ```
   Pre-flight must reproduce: the replace succeeds and the prior statement is gone.

3. **Delta:**
   - `teacher-be/src/store/revisions.ts` — **new**: `append`, `listFor`, `ensureIndex`.
   - `teacher-be/src/store/subjects.ts:150-172` — `replaceExercise` appends the outgoing
     version **before** the `$set`.
   - `teacher-be/src/routes/subjects.ts` — add
     `GET /subjects/:id/exercises/:exerciseId/revisions`.
   **Everything else frozen** — the exercise array, its ids and its ordering do not change.
   Freeze check: `git status --short -- src/store/revisions.ts src/store/subjects.ts src/routes/subjects.ts`

4. **Oracle (two-sided, executable)** — `features/persistence-gaps/tests/be/revisions.characterization.test.js`:
   - *positive:* replace `ex1` once → revisions list has **1** entry whose `exercise` is the
     **original generated** version, byte-identical to the recording's `data.exercises[0]`
     (`JSON.stringify` equality — Arabic and LaTeX intact).
   - *positive:* replace `ex1` three times → **3** entries, newest `supersededAt` first.
   - *positive (WF-70, each variant):* history is recorded for `ex1` (first), `ex2` (middle)
     and `ex3` (last) — positional bugs hide at the ends.
   - *positive (restore is not a new surface):* `PUT` the revision's `exercise` body back →
     `200`, the sheet shows the old version again, **and** the count grows to 4 — restoring
     is itself a supersession, never destructive.
   - *positive (empty/degenerate):* a subject never refined → `200 {revisions: []}`, **not**
     404. Unknown `exerciseId` on an existing subject → `200 {revisions: []}`.
   - *positive:* another teacher's subject → `404 subject_not_found`, identical body to a
     subject that does not exist — ownership stays non-probeable.
   - *negative:* **the subject read path is unchanged** — `GET /api/subjects/:id` returns the
     same top-level keys as the slot-2 recording, with **no** history field, and the
     exercises array length and ids are unchanged after any number of replacements.
   - *negative:* `PUT`'s own request/response shapes bit-stable vs. the recording; unknown
     exercise id still `409 exercise_not_found` **and writes no revision** (assert count
     unchanged).
   - *obs assertion:* `run-log.jsonl` still gets exactly one `op:"replaceExercise"` link line
     per replace — no new line kind, and **no teacher content** enters the log.

5. **Boundaries:** honours `fe-be-subjects-v2.contract.md` Part A exactly — history lives in
   `exercise_revisions`, **never inside the subject document** (a teacher opening an exam
   must not pay for its history). Additive only. Budget: 10 iterations.

6. **Exit:** done-when = oracle green + freeze respected + `tools/ci be --slug persistence-gaps`
   green · ask-when = history cannot be appended without changing the subject's read shape ·
   the append cannot be made to happen before the `$set` without a race · exercise ids would
   have to move · budget blown.

```yaml
---
kind: sub-issue
id: be-4
parent: i1
stack: be
status: done
depends_on: []
estimate: S
---
```

### be-4 — give a subject a join key to its generation

1. **Intent:** cost per exam is the number the billing model turns on, and today it is
   unanswerable because nothing ties a stored subject to the run that produced it.

2. **Ground truth (recorded + re-run command):**
   ```bash
   $ cat stacks/teacher-be/run-log.jsonl        # after one create + one replace
     kind=subject op=create          corr=82e1faf5-…  subjectId=6a76…
     kind=subject op=replaceExercise corr=aa9a39f0-…  subjectId=6a76…
   ```
   **Two different correlationIds for one subject** — each is that HTTP request's own, and
   the generation's is a third. Pre-flight must reproduce this: the ids differ.

3. **Delta:**
   - `teacher-be/src/store/subjects.ts:109-120` — `create` accepts and stores
     `genCorrelationId` (nullable).
   - `teacher-be/src/routes/subjects.ts:66-93` — read optional `genCorrelationId` from the
     body; include it in the create/get/list responses.
   **Everything else frozen** — `/api/generate` is **not** touched (`app.ts:145` already
   returns `costUsd`; SEED journal H4).
   Freeze check: `git status --short -- src/store/subjects.ts src/routes/subjects.ts`

4. **Oracle (two-sided, executable)** — `features/persistence-gaps/tests/be/cost-join.characterization.test.js`:
   - *positive:* create with `genCorrelationId: "<uuid>"` → stored on the doc and echoed on
     `GET /api/subjects/:id` and in the `GET /api/subjects` summary.
   - *positive (the join actually works):* using the recorded envelope's
     `correlationId` `43e41235-f59a-44ad-9b2b-e91cff1f8610` and its `costUsd` `0.645421`,
     a `grep` of `run-log.jsonl` by the subject's `genCorrelationId` yields that run line.
     This is the clause that proves the gap closed.
   - *positive (omitted — keeps it additive):* create **without** the field → `201`, stored
     `null`. A `be` deployed before `fe` must keep working.
   - *positive:* explicit `null` → `201`, stored `null`.
   - *positive:* the two ids stay distinct — the response's `correlationId` (this request's)
     differs from `genCorrelationId`.
   - *negative:* the ~90 pre-existing documents read back with `genCorrelationId: null` and
     are **not rewritten** (assert `updatedAt` unchanged for a doc created before the change).
   - *negative:* `POST /api/subjects` response keys are a **superset** of the slot-2
     recording — nothing removed, nothing renamed.
   - *obs assertion:* `run-log.jsonl` gains **no** new field and **no** teacher content; the
     subject link lines are unchanged.

5. **Boundaries:** honours `fe-be-subjects-v2.contract.md` Part B. **`costUsd` is deliberately
   not denormalised onto the subject** — denormalising it is a stop, not an improvement.
   Additive only. Budget: 10 iterations.

6. **Exit:** done-when = oracle green + freeze respected + `tools/ci be --slug persistence-gaps`
   green · ask-when = `/api/generate` appears to need changing (it does not — stop) ·
   the field cannot be made optional · existing documents would need a migration · budget blown.

```yaml
---
kind: sub-issue
id: be-5
parent: i1
stack: be
status: done
depends_on: [be-1, be-2]
estimate: S
---
```

### be-5 — purge the orphaned test subjects  *(hardening)*

1. **Intent:** the collection is mostly last-job test data, which makes orphan-rate
   observability meaningless — but this is the one irreversible act in the job, so it is
   scripted, counted and backed up rather than typed at a prompt.

2. **Ground truth (recorded + re-run command):**
   ```bash
   $ mongosh --quiet --eval 'db.getSiblingDB("teacher_saas").subjects.countDocuments({})'
   92        # 90 at first capture; each probe-gaps.py run adds 2 — NEVER trust a stale count
   ```
   Pre-flight re-runs this and records the count **at that moment**.

3. **Delta:**
   - `features/persistence-gaps/tests/be/` — no product code.
   - `teacher-be/scripts/purge-orphans.mjs` — **new**, a standalone script. Not wired into
     the app, not imported by `src/`.
   **Everything else frozen.** Freeze check: `git status --short -- scripts/purge-orphans.mjs`

4. **Oracle (two-sided, executable)** — `features/persistence-gaps/tests/be/purge.characterization.test.js`:
   - *positive:* **`mongodump` runs first and its output file exists and is non-empty** — the
     script refuses to delete if the dump failed. Assert by deleting nothing when the dump
     path is unwritable.
   - *positive:* `--dry-run` (the default) prints the count it *would* delete and deletes
     **zero**. Deleting requires an explicit `--yes`.
   - *positive:* **the orphan definition changed** — `be-2`'s backfill gives every existing
     `teacherId` a row, so "no `teachers` row" now matches nothing. An orphan is a subject
     owned by an **anonymous (never-claimed, `email: null`) row** and created **before a
     `--before <ISO>` cutoff** the operator passes explicitly. Seed one signed-up teacher
     with a subject and one anonymous teacher with an old subject, run with `--yes`, assert
     the signed-up teacher's subject **survives** and the anonymous one is gone.
   - *positive:* omitting `--before` deletes **nothing** and exits non-zero. There is no
     implicit cutoff — a purge with an unstated boundary is how live data dies.
   - *positive:* counts are asserted before and after, and the script fails loudly if the
     before-count does not match what it re-measured at start (no stale-count deletes).
   - *negative:* **a registered teacher never loses a subject** — this is the clause that
     matters; re-run the full `GET /api/subjects` for the registered teacher and compare
     byte-for-byte with the pre-purge response.
   - *negative:* `exercise_revisions` rows for surviving subjects are untouched.
   - *obs assertion:* the script prints dump path, before-count, matched-count, after-count.

5. **Boundaries:** depends on `be-1` **and `be-2`** — before the backfill "orphan" means one
   thing, after it another, and running this against the pre-backfill definition would delete
   every real teacher's work. **Irreversible**: no delete route exists in the product, and this script must not
   become one. Budget: 10 iterations.

6. **Exit:** done-when = oracle green + a real `mongodump` artifact exists + `tools/ci be
   --slug persistence-gaps` green · ask-when = the orphan definition would delete anything
   belonging to a registered teacher · the dump cannot be verified before deleting · the
   count changed between measurement and delete · budget blown.
