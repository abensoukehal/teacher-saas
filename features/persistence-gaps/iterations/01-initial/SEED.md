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
| Are the 90 existing subjects worth migrating? | **parked** | Mostly last-job test data. Needs a user call at lock: backfill vs. leave. Cost is unknowable retroactively either way. |
| Which identity-recovery mechanism? | **parked → decide at lock** | Three options in Solution direction; mail is not integrated, which rules out magic links without a prior job. |
| Deploy target (gap #6) | **parked — recommended out of scope** | See Scope. |
| Revision-history storage shape | **accepted-risk → PLANNING** | Embedded array vs. separate collection; both honour the stated constraints. Decide with the acting-surface map in hand. |

### 7 · Sweep statement

- **Swept:** `be` `src/` in full (11 files); `fe` `src/lib/{api,persist,exam}.ts` and
  `App.tsx`; the live `be` API over HTTP on the job lane; the Mongo schema, indexes and
  document count; `run-log.jsonl` shape; the promoted regression net's file list; both CI gates.
- **Not swept:** `fe` component tree below `App.tsx` (RTL/KaTeX rendering surfaces) — no
  gap in the brief points there, but a recovery-code UI *will* add Arabic strings, so
  PLANNING must treat the component layer as unswept and keep freeze boundaries tight.
  Also not swept: `.claude/skills/` SKILL.md contents (no gap touches generation), and
  deployment/infra (gap #6, recommended out).

## Solution direction (locked, product-level)

**One organising idea: make the teacher as durable as their exams already are, then
finish the three smaller "kept" gaps that hang off the same store.**

**#1 Identity — a `teachers` collection plus a recovery path, not accounts.**
Write the issued id down (server-side record: id, createdAt, lastSeenAt) and give the
teacher one short, human-transcribable **recovery code** they can use to re-attach a
browser to their existing id. `teacherId` values never change, so the later accounts job
adopts them by attaching an identity to the existing record — no document is moved or
rewritten.
- *Why not full email+password auth:* violates "don't over-engineer" at a two-teacher
  milestone, and needs a password-reset path that needs mail.
- *Why not magic links:* mail is not integrated (`project/CLAUDE.md` → Integrations,
  ★ PENDING); it would be a prerequisite job, not a detail.
- *Why not leave it:* it is the only gap that still loses work, silently and totally.

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

## User value (company-facing framing)

A teacher never loses their exams — they can get back to them from another browser or
another machine — and refining an exercise is safe, because the previous version is kept.

## Scope & boundaries

- **In:** gaps #1 (identity + recovery), #2 (revision history), #3 (cost attribution),
  #4 (queued save), #5 (folded into #4).
- **Out (non-goals) — needs your explicit yes:**
  - **Gap #6, deploy target and backups.** The debrief itself calls it "large, and not
    really a persistence job". It is an infrastructure decision (managed Mongo vs. self-hosted,
    which decides backups by implication) with no product surface, and bundling it would make
    this job's SEED span two unrelated risk profiles. **Recommend a separate job**; it should
    happen before real teachers depend on any of this.
  - Email/password accounts, billing, credits, sharing — downstream of #1, not it.
  - Backfilling the 90 existing subjects (parked; decide at lock).
- **Stacks likely touched:** `be` · `fe`.

## Risks & backward-compat flags

- **The bearer-value risk persists.** A recovery code makes the id *recoverable*, not
  *secret*. Whoever holds an id still reads that teacher's exams. Acceptable at this
  milestone for exam drafts; must be stated in the SEED so the accounts job inherits it
  knowingly rather than by drift.
- **A recovery code is new teacher-facing UI** — therefore new Arabic strings under RTL,
  and it must never surface anything LaTeX-shaped. The component layer is unswept (§7).
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
