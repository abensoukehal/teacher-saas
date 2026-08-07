# SEED — persistence gaps (all six, one job)

> **Phase:** DISCOVERY. **Input:** `00-brief.md`. **Output:** this file.
> **Status: DRAFT — NOT LOCKED.** The user gates the lock; scope item #6 in particular
> needs an explicit yes/no before sealing.

## Anchor
- **Job kind:** feature
- **Upstream:** https://github.com/abensoukehal/teacher-saas/issues/3
- **Source of the brief:** `project/handoffs/2026-08-08-what-is-not-persisted.md`, written
  at the close of the `persistence` job.

## Problem (enriched)

The `persistence` job made an exam subject a first-class stored entity. It did not make
the **teacher** one. Everything below follows from that single asymmetry.

The subject document is owned by a 32-hex `teacherId` that exists in exactly one place:
the browser's `localStorage` (`teacher-fe/src/lib/persist.ts:23`). The server issues it
(`teacher-be/src/teacher.ts:20-22`) and never writes it down — verified: the `teacher_saas`
database has exactly one collection, `subjects`. So the id is not a key into a registry;
it *is* the entire credential, and it is held only by the client.

Three consequences, each proven live on the job lane (probes below, §2):

1. **Clearing site data permanently orphans every exam.** There is no delete route, so
   the documents live on forever — unreachable. Mongo currently holds **90 subjects**;
   a large share are already orphaned test documents from the last job, which is the gap
   made visible.
2. **A well-formed id the server never issued is accepted and owns nothing** — `200`, empty
   list. Deliberate (rejecting would make the header an enumeration oracle), but it means
   there is nothing to *recover* against, because there is no record of what was issued.
3. **No cross-device access.** Plan on a laptop, print from a desktop, see an empty list.

Alongside it, the same "the teacher's work is not fully kept" theme in three smaller forms:
refining an exercise destroys the previous version (`store/subjects.ts:168`); the cost of
producing a subject cannot be attributed to it; and a save that fails is offered a retry
that does not survive a reload.

**Who feels it, when.** The next milestone is two teacher friends using this for real. Gap
#1 bites the first time either clears a browser, switches machine, or uses a second device
— and it is silent and total. Gap #2 bites within the first session, because refining is
the product's central act and there is no undo.

## Current reality — the planning kit (observed, not assumed)

### 1 · Acting-surface map (where we'll act)

| Stack | Path (`repo/path:LINE`) | Role | Change |
|---|---|---|---|
| be | `teacher-be/src/teacher.ts:20-22` | `issueTeacherId` — mints, stores nothing | modify |
| be | `teacher-be/src/teacher.ts:41-52` | `requireTeacher` — shape-only check | modify |
| be | `teacher-be/src/store/subjects.ts:65-77` | `collection()` / `ensureIndex` | read-only |
| be | `teacher-be/src/store/subjects.ts:109-120` | `create` — insert-only, no cost field | modify |
| be | `teacher-be/src/store/subjects.ts:150-172` | `replaceExercise` — `$set` in place (gap 2) | modify |
| be | `teacher-be/src/store/` (new) | `teachers` collection + revisions store | new |
| be | `teacher-be/src/routes/subjects.ts:60-62` | `POST /api/teacher` — issues id | modify |
| be | `teacher-be/src/routes/subjects.ts:66-93` | `POST /api/subjects` — where cost would land | modify |
| be | `teacher-be/src/routes/subjects.ts:116-165` | `PUT …/exercises/:exerciseId` — where history would be written | modify |
| be | `teacher-be/src/runlog.ts:56-70` | `SubjectLink` — already carries `correlationId` | read-only |
| be | `teacher-be/src/app.ts:103-147` | `/api/generate` — **frozen**, already returns `costUsd` | read-only |
| fe | `teacher-fe/src/lib/api.ts:93` | `generateExam` — returns `payload.data`, drops envelope (gap 3) | modify |
| fe | `teacher-fe/src/lib/api.ts:218-230` | `createSubject` — `correlationId?` param, **no caller passes it** | modify |
| fe | `teacher-fe/src/lib/persist.ts:23,65-66` | `teacher.id.v1` — sole home of identity | modify |
| fe | `teacher-fe/src/lib/persist.ts:58-60` | paint cache; no pending-save key (gap 4) | modify |
| fe | `teacher-fe/src/App.tsx:48,61,209-217` | `SaveState` — retry closure in memory only (gap 4) | modify |
| fe | `teacher-fe/src/App.tsx:95,196` | the two `createSubject` call sites | modify |
| fe | `teacher-fe/src/` components (unswept) | sign-in / sign-up screens — new Arabic RTL surface | new |
| be | `teacher-be/src/config.ts:55-56` | `MONGO_URL` / `MONGO_DB` — already env-driven | read-only |
| be | `teacher-be/src/claude/runner.ts:138` | `spawn(claude.bin, …, {env: process.env})` — the hosting constraint | read-only |
| be | `teacher-be/package.json` | 9 deps; **no hasher / session / JWT / mail lib** | modify |
| infra | `teacher-be/Dockerfile` (absent) | image must carry the Claude Code CLI + its credentials | new |
| infra | `teacher-fe/Dockerfile` or static host (absent) | Vite static build — the easy half | new |
| infra | `.github/workflows/` (absent in both) | no CI exists to build or deploy from | new |

### 2 · Baseline recordings (surface → re-run command → recorded shape)

Captured **2026-08-08**, job lane slot 3 (`be` :9300, `fe` :10300), Mongo `teacher_saas`
on 127.0.0.1:27017. **No generation was run** — the exam payload is replayed from
`project/features/persistence/iterations/01-initial/contracts/rec-exam-subject.2026-08-07.json`
(`costUsd` 0.645421, `durationMs` 127676), per the last job's trap.

| Surface | Re-run command | Recorded shape | Captured |
|---|---|---|---|
| `GET /health` | `curl -s localhost:9300/health` | `claude.ok:true` (`2.1.224`), `store.ok:true`, `db:teacher_saas`, `max:3` | 2026-08-08 · dev |
| `POST /api/teacher` | `curl -sX POST localhost:9300/api/teacher` | `201 {teacherId:<32hex>, correlationId}` — **nothing persisted** | 2026-08-08 · dev |
| `POST /api/subjects` | see `journal/probe-gaps.py` | `201`; stored doc fields = `_id, teacherId, subject, controls, createdAt, updatedAt` | 2026-08-08 · dev |
| `PUT …/exercises/ex1` | see `journal/probe-gaps.py` | `200`; prior statement **unrecoverable**; doc keys unchanged — no `history`/`revisions` | 2026-08-08 · dev |
| `GET /api/subjects` (unknown id) | `curl -s -H 'x-teacher-id: <fresh 32hex>' localhost:9300/api/subjects` | `200 {subjects:[]}` — unknown id accepted | 2026-08-08 · dev |
| Mongo shape | `mongosh --quiet --eval 'db.getSiblingDB("teacher_saas").subjects.findOne()'` | no `correlationId`, no `costUsd`, no history; indexes `{_id:1}`, `{teacherId:1,updatedAt:-1}`; **90 docs** | 2026-08-08 · dev |
| `run-log.jsonl` | `cat teacher-be/run-log.jsonl` | link lines `{kind:subject, op, subjectId, correlationId}` — **each correlationId is that HTTP request's own** | 2026-08-08 · dev |

### 3 · Perimeter consumers (recorded)

| Consumer | Surface it uses | Recorded shape |
|---|---|---|
| `fe App.tsx:95` (legacy-draft adoption) | `createSubject(id, legacy, null)` | 3 args — no correlationId |
| `fe App.tsx:196` (normal save) | `createSubject(id, subject, controls)` | 3 args — no correlationId |
| `fe api.ts:93` `generateExam` | `POST /api/generate` | returns `ExamSubject` only; envelope (`costUsd`, `sessionId`, `correlationId`) discarded |
| `fe exam.ts:38` | exercise ids | throws on unknown id — server matches with `409 exercise_not_found` |
| promoted regression net | `project/tests/{be,fe}/` | 7 characterization suites from the `persistence` job — these pin current behaviour and **will constrain any shape change** |

**Compat posture:** `/api/generate` is frozen and needs **no change** (see H4). All new
surfaces should be additive, as the last job's were, so `be` and `fe` can merge in either order.

### 4 · End-to-end trace (one real action, correlated)

Replayed create → replace on the lane (`journal/probe-gaps.py` output, saved):

```
POST /api/teacher            → 201  teacherId=33f9094621f711999cc291dc8de5efed   [nothing stored]
POST /api/subjects           → 201  subjectId=6a766ec69d6bd42d577165a4  corr=82e1faf5…
  └ runlog: {kind:subject, op:create, subjectId:6a76…, correlationId:82e1faf5…}
PUT  /subjects/6a76…/exercises/ex1 → 200  ex1 statement overwritten, prior version gone
  └ runlog: {kind:subject, op:replaceExercise, subjectId:6a76…, correlationId:aa9a39f0…}
GET  /api/subjects  (unknown 32hex id) → 200 {subjects: []}
```

**The boundary crossing that matters:** the generation that *produced* this exam ran on a
different HTTP request, with a third correlationId, which never reaches any of the above.

### 5 · Observability baseline

- **Visible today:** `/health` reports `claude.ok`, queue depth and `store.ok`.
  `console.log` `store.write` lines carry `{op, subjectId, correlationId}`.
  `run-log.jsonl` carries run lines (`costUsd`, `durationMs`, `exerciseCount`, `ok`) and
  subject link lines. Revisions-per-exam **is** answerable by counting `op:"replaceExercise"`.
- **Blind spots:** (a) cost-per-subject — no shared key between a run line and a link line;
  (b) orphan rate — no way to tell an orphaned subject from an active one, since there is no
  teacher registry to join against; (c) failed-save loss — a save abandoned at reload leaves
  no trace at all.

### 6 · Unknowns ledger

| Unknown | Disposition | Evidence / note |
|---|---|---|
| Does the brief's premise survive? | **resolved — survives** | All six claims verified at their cited lines; see journal H1–H3. |
| Does fixing cost require changing the frozen `/api/generate`? | **resolved — no** | `app.ts:145` already returns `costUsd`; only `fe`'s internal signature discards it (H4). |
| Can the two run-log line kinds be joined today? | **resolved — no** | correlationId is per-request; recorded two different ids for one subject (§4). |
| Is `fe` `node_modules` complete this time? | **resolved — yes** | 88 packages; `katex`, `vitest`, `@testing-library` present. |
| What is the CI baseline really? | **resolved — RED, honestly** | `no characterization tests resolved` (WF-68). Receipt agrees. `project/CLAUDE.md` still documents the old phantom-green behaviour — **stale, fix in /document**. |
| Are the 90 existing subjects worth migrating? | **resolved — purge (user, 2026-08-08)** | Orphaned test data. Executed in IMPLEMENT behind a `mongodump`, never at discovery time. |
| Which identity mechanism? | **resolved — full email+password (user, 2026-08-08)** | Discovery recommended a recovery code; overruled. Dissent recorded in Scope. |
| **How does a hosted `be` authenticate the Claude Code CLI?** | **PARKED — blocking for #6** (`blocked_on: infra decision`) | No API key exists (verified). Credentials are the CLI's own interactive `/login` store. Needs a persistent home volume or an injected secret, plus a re-auth procedure for expiry. **PLANNING cannot partition #6 until this is answered.** |
| **Does password reset need mail in this job?** | **PARKED — blocking for #1's completeness** (`blocked_on: product decision`) | Mail is ★ PENDING. Without it accounts ship with no self-serve reset, so a forgotten password loses the account — the same class of loss #1 exists to fix. |
| Which host, and managed Mongo or self-hosted? | **parked** | Downstream of the CLI-auth answer above; that decision constrains the host. `MONGO_URL`/`MONGO_DB` already env-driven (`config.ts:55-56`), so the store half needs no code change. |
| Which password-hashing / session library? | **parked → PLANNING** | `be` has 9 deps and none is a hasher, session or JWT lib. All new dependency decisions. |
| Will rejecting unknown teacher ids break the regression net? | **accepted-risk → PLANNING** | `requireTeacher` currently accepts any 32-hex id; accounts make rejection possible. The promoted suites pin today's acceptance. Re-baseline consciously. |
| Revision-history storage shape | **accepted-risk → PLANNING** | Embedded array vs. separate collection; both honour the stated constraints. Decide with the acting-surface map in hand. |

### 7 · Sweep statement

- **Swept:** `be` `src/` in full (11 files); `fe` `src/lib/{api,persist,exam}.ts` and
  `App.tsx`; the live `be` API over HTTP on the job lane; the Mongo schema, indexes and
  document count; `run-log.jsonl` shape; the promoted regression net's file list; both CI gates.
- **Swept (infra plane, added after #6 was kept in scope):** both repos' `package.json`
  (scripts, engines, full dependency list), the absence of Dockerfiles / CI workflows /
  any host config, `config.ts`'s complete env surface, and `runner.ts`'s spawn +
  credential model. Enough to establish *what constrains* a deploy — see H7.
- **Not swept:** `fe` component tree below `App.tsx` (RTL/KaTeX rendering surfaces) — no
  gap points there, but **sign-in and sign-up screens are a substantial new Arabic/RTL UI
  surface**, so PLANNING must treat the component layer as unswept and keep freeze
  boundaries tight. Also not swept: `.claude/skills/` SKILL.md contents (no gap touches
  generation); and **candidate hosting platforms were not evaluated** — that evaluation is
  downstream of the parked CLI-auth decision, and doing it first would be guessing.

## Solution direction (locked, product-level)

**One organising idea: make the teacher as durable as their exams already are, then
finish the three smaller "kept" gaps that hang off the same store.**

**#1 Identity — full email + password accounts, adopting the existing `teacherId`.**
A `teachers` collection keyed by the **existing 32-hex `teacherId`**, carrying email, a
password hash and timestamps. The critical property from the brief is preserved: the
accounts layer *adopts* the opaque id rather than replacing it, so **no subject document
is moved or rewritten** — `subjects.teacherId` keeps pointing at the same value, and the
`{teacherId:1, updatedAt:-1}` index stays valid.

Sign-in exchanges email+password for the `teacherId` the browser then sends as today, so
`requireTeacher` and every subject route keep their current contract. What changes is that
`requireTeacher` can finally *reject* an id that was never issued — closing the accepted-
unknown-id hole (kit §2) — which is a behaviour change the promoted regression net will feel.

- **No auth dependency exists yet.** `be` has 9 dependencies and none of them is a password
  hasher, a session/JWT library, or `helmet`. Every one of those is a new dependency
  decision for PLANNING, not an existing tool to reach for.
- **Password reset is the open edge.** Self-serve reset needs mail. Until mail is
  integrated, accounts ship *without* it — meaning a forgotten password is as unrecoverable
  as a cleared browser is today, which is the very failure this gap exists to fix.
  **PLANNING must resolve this explicitly** (see unknowns).
- *Why not a recovery code (discovery's recommendation):* overruled by the user; recorded
  above.
- *Why not magic links:* same mail dependency, without the password surface.

**#2 Revision history — keep the current exercise where it is, append the old one elsewhere.**
The current sheet must stay a single cheap read (stated constraint), and exercise ids
`ex1…exN` must not move (they are the core loop's join key). So `replaceExercise` keeps its
positional `$set` and additionally records the superseded version. Storage is a non-issue
(~5 KB/subject), and every superseded exercise is on-syllabus material the exercise library
(roadmap 6) will want.
- *Why not versioning the whole subject document:* a teacher opening an exam would pay for
  its entire history on every read.

**#3 Cost attribution — carry the generation's correlationId into the subject.**
The half-laid parameter (`api.ts:222`) is the right seam and needs no API change, because
`/api/generate` already returns the envelope. `fe` stops discarding it, passes it to
`createSubject`, and `be` stores it — making the run-log join real for the first time.
- *Why not denormalising `costUsd` onto the subject:* keeps two sources of cost truth.
  Cheap to add later if direct queryability is wanted — flagged for PLANNING, not blocking.
- *Note:* only new subjects get this. Cost for the existing 90 is not recoverable.

**#4 Queued save — persist the pending save, replay it on load.** Same guarded-`localStorage`
discipline already in `persist.ts`; the exam is already cached there, so this is the pending
*intent*, not new data.

**#5 Controls panel state** — fold into whichever slice touches `persist.ts` (#4). Not its own work.

**#6 Deploy + backups — the hard part is authenticating the CLI, not choosing a host.**
The datastore half is routine: a managed Mongo (Atlas or equivalent) decides backups by
implication, and `config.ts:55-56` already reads `MONGO_URL`/`MONGO_DB` from the
environment, so `be` needs no code change to point at one.

The application half is not routine, and it is the reason this gap is large:

- `be` generates by **spawning the `claude` binary** (`runner.ts:138`,
  `spawn(config.claude.bin, args, { env: process.env })`). A deploy image must therefore
  contain the Claude Code CLI, not just Node.
- **There is no API key in this product** — verified, nothing matches `ANTHROPIC|api_key`
  anywhere in `src/` or `.env.example`. Auth lives in the CLI's own credential store
  (`~/.claude.json` on this machine, mode 0600), created by running `claude` interactively
  and `/login`.
- So a hosted `be` needs those credentials present in the container's home directory,
  surviving redeploys on an otherwise ephemeral filesystem — a persistent volume or an
  injected secret. Neither exists in this codebase.
- And when they expire, `503 claude_auth` takes generation down until **a human
  re-authenticates inside that container**. On a laptop that is a terminal; on a PaaS it is
  an operational procedure that has to be designed.
- **Nothing exists to build from:** neither repo has a Dockerfile, a CI workflow, or any
  host config (`fly`/`render`/`railway`/`vercel`/Procfile all absent). `be` builds with
  `tsc` and runs on Node ≥20; `fe` is a Vite static build, which is the easy half.

*Why this is stated as a finding rather than a plan:* the CLI-auth question has no
precedent in this repo to follow, and its answer determines the host. It is the job's
**blocking unknown** — PLANNING cannot partition #6 into sub-issues until it is decided.

## User value (company-facing framing)

A teacher signs in and their exams are simply there — on any browser, on any machine — and
refining an exercise is safe, because the previous version is kept. Behind it, the product
runs somewhere real, gets backed up, and can finally say what each exam cost to produce.

## Scope & boundaries

- **In — all six, by explicit user decision (2026-08-08):**
  - #1 identity, as **full email + password accounts** (not a recovery code).
  - #2 revision history · #3 cost attribution · #4 queued save · #5 folded into #4.
  - **#6 deploy target and backups.** Kept in against the recommendation below; the
    infra plane was swept as a result (kit §1 infra rows, journal H7).
  - **Purge the orphaned test subjects** from `teacher_saas.subjects` (90 docs today).
    **Behind a `mongodump` first** — there is no delete route, so this is a deliberate
    one-off operation in IMPLEMENT, never a discovery-time action.
- **Out (non-goals):** billing, credits, sharing between teachers, OCR — all downstream.
- **Stacks likely touched:** `be` · `fe` · **infra** (new: images, deploy config, CI).

> **Recorded dissent, so the trade-off is inherited knowingly rather than by drift.**
> Discovery recommended #6 as a separate job and a recovery code over full accounts; the
> user chose all-six and full accounts. Two costs follow, and PLANNING must budget for them:
> (a) this SEED now spans a product track and an infra track with different risk profiles;
> (b) full accounts need a password-reset path, which needs mail, which is not integrated
> (`project/CLAUDE.md` → Integrations, ★ PENDING). See the two unknowns below.

## Risks & backward-compat flags

- **The bearer-value risk does not disappear with accounts — it changes shape.** If sign-in
  returns the same 32-hex `teacherId` and the browser keeps sending it as a header, that id
  is still a bearer credential; accounts just add a way to *re-obtain* it. Making it a real
  session (rotating, expiring, httpOnly) is a further step PLANNING must decide on
  deliberately, or the product will have an auth screen and no auth.
- **Storing passwords raises the stakes of everything else.** Today the store holds exam
  drafts; with accounts it holds credentials. That pulls in hashing choice, transport
  security, and rate-limiting on sign-in — none of which exist (`be` has no `helmet`, no
  rate limiter). This is the cost of choosing full accounts over a recovery code.
- **Sign-in / sign-up is a substantial new teacher-facing UI** — new Arabic strings under
  RTL, and it must never surface anything LaTeX-shaped. The component layer is unswept (§7).
- **The purge is irreversible and there is no delete route.** It must run behind a
  `mongodump`, as a scripted one-off with the document count asserted before and after.
- **#6 has no precedent to copy in this repo** — first Dockerfile, first CI, first deploy.
  Estimation confidence there is low until the CLI-auth unknown is resolved.
- **The promoted regression net pins current behaviour** (7 suites). Any shape change to
  the subject document or the subject routes must keep those green or consciously re-baseline.
- **Additive posture:** as with `persistence`, new fields/routes should be additive so `be`
  and `fe` merge in either order.
- **`/api/generate` stays frozen** — confirmed unnecessary to touch.
- **`claude_auth` vs `store_unavailable`** both 503, opposite meanings — any new error path
  must branch on `error.type`.
- **`run-log.jsonl` must stay free of teacher content** — the join key is an id, never a title.

## Investigation journal

- **H1 — the brief's own framing: are all six gaps real, at the lines cited?**
  → test: read each cited file:line in the job worktree; grep for a `teachers` collection,
  for delete/upsert, and for `createSubject` callers.
  → result: **all six hold.** `teacher.ts:20-22` mints without storing; no `teachers`
  collection exists; `subjects.ts:168` is exactly `$set: {"subject.exercises.$": next}`;
  `create` is insert-only and there is no delete; `createSubject` has exactly two callers
  (`App.tsx:95,196`) and **neither passes `correlationId`**; `SaveState` is `useState` only.
  Sole drift: `requireTeacher` is at `teacher.ts:41`, not `:43`.
  → belief: **kept.** Unlike the last job, the brief was written *by* the job that shipped
  the code, so it is self-accurate. Recorded because "the premise survived" is a result.

- **H2 — cheapest kill attempt: is any of this already half-built?**
  → test: `grep` for `history|revisions|costUsd` in `be/src`; inspect the live Mongo document.
  → result: stored doc fields are exactly `_id, teacherId, subject, controls, createdAt,
  updatedAt`. No history, no cost, no correlationId. Nothing is half-built server-side.
  → belief: **killed** — no scope retires.

- **H3 — could gap #1 be config/state rather than a defect?**
  → test: `POST /api/teacher`, then `GET /api/subjects` with a *fresh* 32-hex id.
  → result: `201` issues an id that is never written down; the fresh unknown id returns
  `200 {subjects:[]}` — accepted, owns nothing. Meanwhile the real teacher still sees their
  subject, so the document is alive and simply unreachable.
  → belief: **kept** — structural, not configuration.

- **H4 — the brief says finishing cost "changes a frozen return type". Does it?**
  → test: read `/api/generate`'s response construction and the recorded envelope.
  → result: `app.ts:145` is `res.json({ ...result, correlationId })`, and `result` already
  carries `costUsd` (0.645421 in the recording) and `durationMs`. The frozen thing — the
  API shape — **already carries cost**. What discards it is `generateExam`'s internal
  TypeScript signature in `fe` (`api.ts:93`, `return payload.data as T`).
  → belief: **refined.** Gap #3 is smaller than written and needs no API change. This is the
  one place the brief's framing was materially off.

- **H5 — do the run-log link lines already permit a cost join?**
  → test: create + replace on the lane, then read `run-log.jsonl`.
  → result: the two link lines carry **different** correlationIds (`82e1faf5…`, `aa9a39f0…`)
  — each is that HTTP request's own id, and the generation's is a third. So the join is
  impossible today even in principle, not merely unpopulated.
  → belief: **refined** — sharpens *why* the unused `createSubject` parameter is the fix.

- **H6 — are the last job's environment traps still live?**
  → test: count `fe/node_modules`; probe for `katex`/`vitest`/`@testing-library`; re-run
  both CI gates from the job worktree.
  → result: `node_modules` complete (88, all three present) — trap cleared. Both gates RED
  for the honest reason (`no characterization tests resolved`, WF-68), matching the receipt.
  → belief: **refined** — `project/CLAUDE.md`'s "receipt reads green when it has no gate"
  note is now stale and should be corrected in `/document`.

- **H7 — gap #6 was kept in scope. What actually constrains a deploy?**
  → test: list deploy/CI config in both repos; read `config.ts`'s env surface; read how
  `runner.ts` spawns the CLI; grep the whole of `src/` and `.env.example` for any API-key path.
  → result: **no** Dockerfile, CI workflow, or host config exists in either repo. `be` is
  Node ≥20 + `tsc`; `fe` is a Vite static build. `MONGO_URL`/`MONGO_DB` are already
  env-driven, so the datastore half is a config change. But `runner.ts:138` spawns the
  `claude` binary with `env: process.env`, and **no API key exists anywhere** — auth is the
  CLI's own interactive `/login` credential store.
  → belief: **refined, and it inverts the shape of #6.** The hard problem is not choosing a
  host or a managed Mongo; it is that a hosted `be` must carry an authenticated Claude Code
  CLI across redeploys on an ephemeral filesystem, and must offer a human a way to
  re-authenticate in-container when credentials expire. Promoted to the job's blocking unknown.

- **H8 — can full accounts adopt the existing `teacherId` without touching subjects?**
  → test: read the subject document shape, its index, and every read path
  (`listByTeacher`, `getOwned`, `replaceExercise` — all filter on `teacherId`).
  → result: every query is `{teacherId}`-scoped and the index is `{teacherId:1,
  updatedAt:-1}`. A `teachers` collection keyed by that same 32-hex value leaves all 90
  documents, every query and the index untouched.
  → belief: **kept** — the brief's "adopt, don't replace" requirement is satisfiable, and
  the migration cost it asks to be stated explicitly is **zero document rewrites**. The
  real behaviour change is `requireTeacher` gaining the ability to reject.

## Ready-for-PLANNING checklist
- [x] the brief's framing was tested, not assumed (journal H1–H5)
- [ ] problem + solution direction agreed and **locked** — *awaiting user*
- [x] acting-surface map present (kit §1); scope in/out stated
- [x] every acting surface has a baseline recording with its re-run command (kit §2)
- [x] perimeter consumers recorded (kit §3); backward-compat posture flagged
- [x] one correlated end-to-end trace saved (kit §4)
- [x] observability baseline stated — blind spots called out (kit §5)
- [ ] **no undispositioned unknowns** (kit §6) — 3 parked, 2 need a user call at lock
- [x] sweep statement present — the unswept edge named (kit §7)
- [ ] **lock re-verification: every §2 recording reproduced at seal time**
