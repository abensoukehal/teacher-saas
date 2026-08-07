# Stack spec — teacher-be (Express · TypeScript · ESM · Node 20+)

> Job `persistence`, iteration `01-initial`. Derived from the locked `SEED.md`;
> honours `contracts/fe-be-subjects.contract.md` + `.schema.yaml`.
>
> **This repo is two things:** the application tier, and the Claude Code CLI
> wrapper (`src/claude/`). **This job touches only the application tier.** No
> `SKILL.md` changes, no prompt work, no change to `runner.ts`. A sub-issue here
> that builds a prompt pipeline is scoped wrong.

## Scope recap (from SEED.md + this stack's sub-issues)
- **Modules:** `src/store/` (new) · `src/routes/subjects.ts` (new) · `src/teacher.ts`
  (new) · `src/config.ts` (modify) · `src/app.ts` (modify) · `src/runlog.ts` (modify,
  hardening only)
- **Contracts this stack must honor:** `contracts/fe-be-subjects.contract.md`,
  `contracts/fe-be-subjects.schema.yaml`, `contracts/flows.md` F1–F5
- **Frozen:** `src/claude/runner.ts`, `src/claude/skills.ts`, `src/claude/json.ts`,
  `.claude/skills/**`, and the request/response shape of `POST /api/generate`

## Current behavior baseline

`be` is stateless. `src/` is exactly `app.ts`, `claude/{runner,skills,json}.ts`,
`config.ts`, `index.ts`, `runlog.ts` — there is no store, no model, no migration.

- `src/app.ts:86` — `POST /api/generate` validates the skill against the catalogue,
  spawns the CLI, fires `recordRun(...)`, returns the payload, and **forgets it**.
- `src/app.ts:54` — `GET /health` reports `claude.{ok,detail,active,queued,max}`.
  It knows nothing about a datastore because there isn't one.
- `src/config.ts:19` — the **only** place `process.env` is read. `MONGO_URL` and
  `MONGO_DB` must be added here and nowhere else.
- `src/runlog.ts:24` — appends `{ts,skill,correlationId,durationMs,costUsd,
  exerciseCount,ok}` to `run-log.jsonl`. It is telemetry, **not** a store; its
  own comment says so. It carries no teacher content and must not start to.

Pinned by `features/persistence/tests/be/*.characterization.*` — the WF-53 home,
never inside the repo tree. Run via `tools/ci be --slug persistence`.

### Test harness — settled by probe, not by assumption (read before writing a test)

`be` has **never had a test**; core-loop wrote `fe` suites only. Three constraints
were established by running the gate, and each rules out an obvious approach:

1. **Filename must match `*.characterization.test.js`** — `tools/tests/jest.characterization.config.js`
   sets exactly that `testMatch`, and `tools/ci`'s `has_tests()` additionally
   requires `characterization` in the name. A `.spec.ts` file is silently invisible
   and the gate reports "no tests resolved".
2. **`.js` only, no TypeScript, no transform.** There is no babel/ts-jest in the
   chain.
3. **The built `dist/` cannot be imported.** `dist/` is ESM (`module: ESNext`), and
   a dynamic `import()` from the CJS test fails with
   *"A dynamic import callback was invoked without --experimental-vm-modules"*.
   That flag lives in the **engine** config, which travels between harness clones —
   **out of scope for this job to change.**

**Therefore `be` tests are black-box:** drive the running lane over HTTP
(`localhost:9200`) and assert stored state directly with the `mongodb` driver
(proved reachable from inside the gate). This is what WF-44 asks for anyway — the
runtime that matters, not an in-process client that lies.

**Precondition:** `tools/dev up -d` must be running from the job worktree. A suite
that cannot reach `:9200` must **fail**, never skip — a gate that cannot verify is
red, not green.

### Run headless
```bash
cd project-worktrees/persistence && ../../tools/dev up -d      # lane slot 2 → be :9200
curl -s localhost:9200/health            # claude.ok must be true before anything else
tools/obs logs be                        # /tmp/teacher-backend.s2.log
```
⚠ `POST /api/generate` runs a whole agent loop — **128 s and $0.65 per call**
(SEED kit §2). The payload is already recorded at
`contracts/rec-exam-subject.2026-08-07.json`. **Use the recording**; do not
re-generate inside a loop iteration.

## Observability (PIN co-requisite)

- **Today:** per-request `correlationId` (`app.ts:26–33`), echoed on every response
  and log line; `run-log.jsonl`; `/health` for the CLI.
- **Blind spots (SEED kit §5) — these are why `be-1` is first:**
  - nothing about persistence is observable, because nothing persists;
  - `/health` cannot report a store, so a dead Mongo would look healthy until a
    write failed;
  - `run-log.jsonl` has no `subjectId`, so a run cannot be tied to the subject it
    produced (`be-4`).
- Verify with `tools/obs logs be` and `tools/obs trace <correlationId>`.

## Data model changes

| Model / store | Field | Change | Migration? |
|---|---|---|---|
| **`subjects`** (new collection, DB `teacher_saas`) | `_id`, `teacherId`, `subject`, `controls`, `createdAt`, `updatedAt` | add | no — new collection |
| `subjects` index | `{teacherId:1, updatedAt:-1}` | add | no |
| `run-log.jsonl` | `subjectId?` | add (optional) | no — additive, existing readers unaffected |

★ **The datastore decision, recorded here for the first time (this is the file the
skeleton reserves for it): MongoDB**, database `teacher_saas`. Evidence, not
preference — Mongo already runs as declared shared infra on this machine, and
`project/services.sh:48` already reserved that DB name. `ExamSubject` is a JSON
document with a nested `exercises[]`, so store shape = wire shape and there is no
mapping layer. Alternatives and their killing evidence: SEED → Solution direction.

## Surfaces (Express routes)

| Surface | Implementation path | New/Modify | Contract |
|---|---|---|---|
| `GET /health` | `src/app.ts:54` | Modify (add `store`) | contract § Errors |
| `POST /api/teacher` | `src/routes/subjects.ts` | **New** | § Identity |
| `POST /api/subjects` | `src/routes/subjects.ts` | **New** | § Subject surfaces |
| `GET /api/subjects` | `src/routes/subjects.ts` | **New** | § Subject surfaces |
| `GET /api/subjects/:id` | `src/routes/subjects.ts` | **New** | § Subject surfaces |
| `PUT /api/subjects/:id/exercises/:exerciseId` | `src/routes/subjects.ts` | **New** | § Subject surfaces |
| `POST /api/generate` | `src/app.ts:86` | **FROZEN** | negative oracle in every sub-issue |

## Skills touched (`.claude/skills/`)

**None.** This job adds no capability and changes no prompt. Generation is frozen.

## Gating (concurrency, timeouts)

Unchanged. `CLAUDE_MAX_CONCURRENT=3`, `CLAUDE_TIMEOUT_MS=300000`. Subject routes are
Mongo round-trips (single-digit ms) and do not touch the CLI queue — a store write
must never be placed inside the generation gate.

## Failure classification

Existing: `503 claude_auth` (not retryable) · `503 claude_not_installed` ·
`504 claude_timeout` · `502 claude_exit` · `500` own bug.

**New: `503 store_unavailable` — retryable.** A dropped Mongo must not surface as a
bare `500`; that is exactly the failure this scheme exists to prevent
(`project/CLAUDE.md` → be § "What must not be undone", item 2). `fe` branches on
`error.type`, not on the status code — `claude_auth` and `store_unavailable` are
both 503 and need opposite advice.

---

## Sub-issues (this stack's technical work, grouped by issue)

```yaml
---
kind: sub-issue
id: be-1
parent: i1
stack: be
status: todo
depends_on: []
estimate: M
---
```

### be-1 — make the store visible before anything is stored

1. **Intent:** SEED kit §5 says a loop cannot verify what it cannot see, and today
   nothing about persistence is observable. Connect Mongo, report it on `/health`,
   and give the store its own failure class — **before** any route writes a
   document, so every later sub-issue has something to assert against.

2. **Ground truth (recorded + re-run command):**
   ```
   $ curl -s localhost:9200/health
   {"status":"ok","service":"teacher-be","env":"development",
    "claude":{"ok":true,"detail":"2.1.224 (Claude Code)","active":0,"queued":0,"max":3}}
   ```
   No `store` key exists. Mongo is up and reachable:
   ```
   $ nc -z localhost 27017 && echo open        → open
   ```
   Re-run: both commands above, from the job worktree with `tools/dev up -d` running.

3. **Delta:** `teacher-be/src/config.ts` (add `mongo:{url,db}` — the ONLY place env
   is read) · `teacher-be/src/store/client.ts` (**new**: connect, ping, close) ·
   `teacher-be/src/app.ts:54` (`/health` gains `store`) · `teacher-be/src/app.ts:136`
   (error middleware learns `store_unavailable`) · `teacher-be/.env.example`
   (document `MONGO_URL`, `MONGO_DB`).
   **Everything else frozen.** Freeze check:
   `git status --short -- src/config.ts src/store/ src/app.ts .env.example`

4. **Oracle (two-sided, executable):**
   - *positive:* `curl -s localhost:9200/health` → `.store.ok == true` and
     `.store.db == "teacher_saas"`, with `.claude.ok` still `true`.
   - *positive (degraded):* with `MONGO_URL` pointed at a dead port
     (`mongodb://127.0.0.1:1/`), `/health` returns `.store.ok == false` and the
     overall `status` is **not** `"ok"` — the service must not look healthy while
     the store is down.
   - *positive (classification):* ~~a probe route that touches the store~~ —
     **moved to `be-3`.** Asserting a classified `503` needs a route that touches
     the store, and `be-1`'s Delta deliberately contains no routes. Adding one just
     to test it would have put unreachable code in the product. The `StoreError` →
     `503 store_unavailable` mapping is implemented here (`src/app.ts` error
     middleware) and **pinned by `be-3`'s negative oracle**, where real routes exist.
   - *negative:* `POST /api/generate` is untouched — replay
     `contracts/rec-exam-subject.2026-08-07.json`'s request and assert the response
     envelope keys are exactly `{text,data,sessionId,costUsd,durationMs,correlationId}`.
   - *negative:* `/health`'s existing `claude` sub-object is **bit-stable** — same
     keys, same types (`ok,detail,active,queued,max`).
   - *negative:* `run-log.jsonl` line shape unchanged (no `subjectId` yet — that is `be-4`).
   - *obs assertion:* `tools/obs logs be` shows a `store.connected` line at boot
     carrying the db name, and a `store.error` line on the dead-port run.

5. **Boundaries:** honours contract § Errors and § Storage shape. **No routes, no
   collection, no writes** — this sub-issue only proves the connection is real and
   visible. Additive: nothing existing changes shape. Budget: 8 iterations.

6. **Exit:** done-when = oracle green + freeze respected + `tools/ci be --slug
   persistence` green · ask-when = `/health`'s existing shape would have to change ·
   a driver choice would add a second storage dependency · the error middleware
   cannot classify without touching `runner.ts` (frozen).

```yaml
---
kind: sub-issue
id: be-2
parent: i1
stack: be
status: todo
depends_on: [be-1]
estimate: M
---
```

### be-2 — the `subjects` repository: many per teacher, never overwritten

> **FOLDED INTO `be-3` during IMPLEMENT.** The repository is a pure module with no
> HTTP surface, and the test harness settled above cannot import `be`'s ESM `dist/`
> — so a standalone `be-2` would have shipped **code no gate could verify**, which
> is exactly the failure the six-slot model exists to prevent. It is built and
> gated as one slice with `be-3`.
>
> **Nothing is dropped.** Every oracle clause below is expressible over HTTP plus a
> direct Mongo read, and each is carried verbatim into `be-3`'s suite — including
> the load-bearing one: *create twice → two records*. The clauses are kept here as
> the record of what `be-3` must prove.

1. **Intent:** the defect this whole job exists to fix is single-slot overwrite
   (SEED → Problem). Build the storage layer whose *only* create operation is an
   insert, so "second exam destroys the first" becomes unrepresentable.

2. **Ground truth (recorded + re-run command):** the exact document to store is the
   recorded payload's `data`:
   ```
   $ python3 -c "import json;d=json.load(open('../contracts/rec-exam-subject.2026-08-07.json'));\
     print(list(d['data'].keys()), [e['id'] for e in d['data']['exercises']], len(json.dumps(d['data']).encode()))"
   ['title', 'meta', 'exercises'] ['ex1', 'ex2', 'ex3'] 5056
   ```
   Today's contrast, the behaviour being replaced (in `teacher-fe`):
   ```
   $ git show origin/main:src/lib/persist.ts | grep KEY_EXAM
   const KEY_EXAM = "teacher.draft.v1";      # ONE key — the defect
   ```

3. **Delta:** `teacher-be/src/store/subjects.ts` (**new**: `create`, `listByTeacher`,
   `getOwned`, `replaceExercise`, index creation).
   **Everything else frozen** — no routes yet. Freeze check:
   `git status --short -- src/store/subjects.ts`

4. **Oracle (two-sided, executable):** unit-level against a real Mongo (WF-44 — the
   runtime that matters; no in-memory fake), suite in
   `features/persistence/tests/be/subjects-store.characterization.test.js`:
   - *positive:* `create()` twice for one `teacherId` with the recorded payload →
     `listByTeacher()` returns **2** records, newest first. **This is the regression
     pin for the defect** — an implementation that upserts fails here.
   - *positive:* the stored `subject` round-trips **byte-identical** to
     `rec-exam-subject.2026-08-07.json`'s `data`, Arabic and LaTeX intact
     (`JSON.stringify` equality, not a field-by-field check).
   - *positive:* `getOwned(id, otherTeacherId)` → `null`, never the document.
   - *positive:* `replaceExercise(id, "ex2", next)` replaces **in place** — array
     length unchanged, `exercises[1].id === "ex2"`, `updatedAt` advanced,
     `createdAt` untouched.
   - *positive (each variant, WF-70):* `replaceExercise` for `ex1` (first),
     `ex2` (middle) and `ex3` (last) — positional bugs hide at the ends.
   - *negative:* `replaceExercise(id, "ex99", …)` **throws / returns not-found and
     writes nothing** — the array must not grow. Re-read and assert length 3.
   - *negative:* `create()` never touches an existing document — after two creates,
     the first record's `updatedAt` is unchanged.
   - *obs assertion:* `tools/obs logs be` shows one `store.write` line per create
     carrying the new subject id.

5. **Boundaries:** honours contract § Storage shape exactly (`subject` nests the
   payload **verbatim** — do not spread it). Index `{teacherId:1, updatedAt:-1}`.
   No HTTP in this sub-issue. Budget: 10 iterations.

6. **Exit:** done-when = oracle green + freeze respected + `tools/ci be --slug
   persistence` green · ask-when = the contract's document shape would need to
   change · a test needs a fake Mongo because a real one is unavailable (that is a
   stop, not a workaround) · an index would need to be non-additive.

```yaml
---
kind: sub-issue
id: be-3
parent: i1
stack: be
status: todo
depends_on: [be-1, be-2]
estimate: L
---
```

### be-3 — the subject HTTP surface + opaque teacher identity

1. **Intent:** expose the repository to `fe` under an owner, so a teacher's subjects
   are server-owned, listable and reopenable — with identity that costs no auth UI
   (SEED → Solution direction 2).

2. **Ground truth (recorded + re-run command):** the surfaces do not exist:
   ```
   $ curl -s -o /dev/null -w '%{http_code}\n' localhost:9200/api/subjects      → 404
   $ curl -s localhost:9200/api                                                 → the index, listing only skills/generate
   ```
   Existing error envelope to match exactly:
   ```
   $ curl -s -X POST localhost:9200/api/generate -H 'content-type: application/json' -d '{"skill":"nope","input":"x"}'
   {"error":{"message":"unknown skill \"nope\"","type":"invalid_request"}}
   ```

3. **Delta:** `teacher-be/src/teacher.ts` (**new**: issue + resolve middleware) ·
   `teacher-be/src/routes/subjects.ts` (**new**: the five routes) ·
   `teacher-be/src/app.ts` (mount only — one `app.use` line).
   **Everything else frozen.** Freeze check:
   `git status --short -- src/teacher.ts src/routes/ src/app.ts`

4. **Oracle (two-sided, executable):** suite in
   `features/persistence/tests/be/subjects-api.characterization.test.js`, driven over HTTP against
   the running lane (WF-44), plus live probes:
   - *positive:* `POST /api/teacher` → `201`, `teacherId` matches `^[0-9a-f]{32}$`.
   - *positive:* `POST /api/subjects` with the recorded payload → `201`; then a
     **second** `POST` → `201` with a **different** `id`; `GET /api/subjects`
     returns **2** summaries, newest first, each with
     `{id,title,exerciseCount,totalPoints,createdAt,updatedAt}` and **no
     `statement` anywhere in the body** (assert the serialised list does not contain
     the string `"statement"`).
   - *positive:* `GET /api/subjects/:id` → `200`, `subject` byte-identical to what
     was posted.
   - *positive (each op-variant, WF-70):* `PUT …/exercises/{ex1,ex2,ex3}` → `200`,
     array length still 3, the right slot replaced.
   - *positive (states):* empty list for a fresh teacher → `200 {"subjects":[]}`,
     not `404`.
   - *negative:* every subject route without `x-teacher-id` → `401`,
     `error.type == "teacher_required"`.
   - *negative:* `GET /api/subjects/:id` with a **different** valid teacher id →
     `404 subject_not_found` — identical body to a genuinely absent id (assert the
     two responses are byte-equal; ownership must not be probeable).
   - *negative:* `PUT …/exercises/ex99` → `409 exercise_not_found`, and a follow-up
     `GET` proves the array is still length 3 — **never appended**.
   - *negative:* `PUT …/exercises/ex2` with a body whose `exercise.id` is `ex3` →
     `400 invalid_request`.
   - *negative (FROZEN perimeter):* `POST /api/generate` response envelope keys are
     exactly `{text,data,sessionId,costUsd,durationMs,correlationId}`, and
     `/health`'s `claude` sub-object is bit-stable.
   - *obs assertion:* `tools/obs trace <correlationId>` on a create shows the
     request line and the `store.write` line sharing one correlation id.

5. **Boundaries:** honours `contracts/fe-be-subjects.contract.md` and
   `.schema.yaml` clause for clause, and `flows.md` F1/F2/F3/F4. Strictly additive —
   no existing route changes. **No delete route** (contract § No delete). Budget: 10
   iterations.

6. **Exit:** done-when = oracle green + freeze respected + `tools/ci be --slug
   persistence` green · ask-when = the contract needs a new status or field ·
   identity cannot stay header-only without a session mechanism · an existing route
   must change to mount these.

```yaml
---
kind: sub-issue
id: be-4
parent: i1
stack: be
status: todo
depends_on: [be-3]
tag: hardening
estimate: S
---
```

### be-4 — tie a run to the subject it produced

> **Implemented differently from the Delta, deliberately.** The Delta said "add
> `subjectId` to `RunRecord`, pass it from the routes". That cannot work as
> written: `recordRun` fires inside `POST /api/generate`, and **the subject does
> not exist yet** — `fe` creates it afterwards, in a separate request. Setting
> `subjectId` there would have meant either inventing an id before the store saw
> it, or writing `durationMs: 0` lies into a *run* log.
>
> What shipped instead: a second, clearly-tagged line kind in the same file —
> `{kind:"subject", op:"create"|"replaceExercise", subjectId, correlationId}`
> (`src/runlog.ts` → `recordSubjectLink`). Run lines are untouched. Counting
> `op:"replaceExercise"` per `subjectId` answers kit §5's question — *how many
> refines per exam* — directly, which the original Delta would not have.
>
> **Still open, and not done here:** joining a *subject* back to the **generation
> cost** needs the generate call's `correlationId`, which `generateExam` discards
> (it returns only `data`). `fe` now propagates a correlation id on create
> (`api.ts` → `createSubject(..., correlationId)`), but nothing passes one yet,
> because plumbing it would change a frozen return type. Left for the job that
> needs cost-per-subject — flagged rather than half-built.

1. **Intent:** core-loop wanted "how many refines per exam" and could not answer it
   (its SEED, direction item 6; SEED kit §5 blind spot 3). Now that a subject has an
   id, the run log can carry it — closing the loop for the teacher test at near-zero
   cost.

2. **Ground truth (recorded + re-run command):**
   ```
   $ tail -1 project-worktrees/persistence/stacks/teacher-be/run-log.jsonl
   {"ts":"…","skill":"exam-subject","correlationId":"…","durationMs":127676,
    "costUsd":0.645421,"exerciseCount":3,"ok":true}
   ```
   No `subjectId`. Re-run: any `/api/generate` call, then `tail -1` the file.

3. **Delta:** `teacher-be/src/runlog.ts` (add optional `subjectId` to `RunRecord`) ·
   `teacher-be/src/routes/subjects.ts` (pass it on create + exercise replace).
   **Everything else frozen.** Freeze check:
   `git status --short -- src/runlog.ts src/routes/subjects.ts`

4. **Oracle (two-sided, executable):**
   - *positive:* after a create, the newest `run-log.jsonl` line carries a
     `subjectId` equal to the returned subject id.
   - *negative:* **every pre-existing field keeps its name and type** — parse the
     recorded line above and the new one, and assert the old key set is a subset of
     the new one with matching types. Additive only.
   - *negative:* `runlog.ts`'s guarantee that telemetry **never carries teacher
     content** still holds — assert the written line contains no `statement`,
     `title`, or Arabic text (`/[؀-ۿ]/` must not match).
   - *negative:* a failed write to the log still never fails a teacher's request
     (existing `catch` behaviour, `runlog.ts:29`).
   - *obs assertion:* `tools/obs trace <correlationId>` correlates the HTTP line and
     the run-log entry via the same `correlationId`.

5. **Boundaries:** honours contract § Storage shape (the run log is **not** a store
   and must not become one). Additive field only. Budget: 5 iterations.

6. **Exit:** done-when = oracle green + freeze respected + `tools/ci be --slug
   persistence` green · ask-when = teacher content would have to enter the log to
   make the field useful (it must not) · the record shape cannot stay additive.
