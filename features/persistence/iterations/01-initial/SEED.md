# SEED — enriched product blueprint (DISCOVERY output)

> **Phase:** DISCOVERY. **Input:** `00-brief.md` (your raw, vague brief). **Output:**
> this file. **Consumed by:** PLANNING (it turns SEED into the specs tree).
>
> Locked = the problem/solution/scope below are agreed and stop moving. PLANNING
> and everything downstream derive from this; changing it means re-running DISCOVERY.

## Anchor
- **Job kind:** feature
- **Upstream:** [abensoukehal/teacher-saas#2](https://github.com/abensoukehal/teacher-saas/issues/2)
- **Lock note:** the brief was authored by me and ratified with "go ahead" (see
  `00-brief.md` → provenance caveat). DISCOVERY **falsified its central claim** — see
  journal H1. What is locked below is materially *not* what the brief proposed.

## Problem (enriched)

**The brief was wrong about the symptom, and the real one is worse.**

The brief said: `be` is stateless, so a page refresh loses the teacher's evening.
Half of that is true — `be` holds nothing (`teacher-be/src/` is `app.ts`,
`claude/*`, `config.ts`, `index.ts`, `runlog.ts`; no store). But the conclusion is
false: **`fe` already persists the draft**, in `teacher-fe/src/lib/persist.ts`,
written on every change by `App.tsx:30` (`useEffect(() => saveDraft(exam), [exam])`)
and rehydrated at `App.tsx:23` (`useState(() => loadDraft())`). A refresh does not
lose anything. The brief's own "Done when" — *close the tab, come back, find it* —
**already passes on `main` today.**

The real defect is one line, `teacher-fe/src/lib/persist.ts:10`:

```ts
const KEY_EXAM = "teacher.draft.v1";
```

**One key. One slot.** The draft is stored under a single fixed key, so generating a
second exam overwrites the first — silently, irreversibly, with no history, no
warning and no undo. There is no code path that can recover it.

Who feels it, and when: a lycée teacher produces **3–6 real exams per trimester**
(`project/CLAUDE.md` → Roadmap). So the *second* exam a teacher ever makes destroys
the first. Each destroyed subject cost **127.7 s of generation and $0.645** of model
spend (measured, kit §2) plus however many refinement rounds the teacher invested —
and refinement is the product (core loop step 4). This is strictly worse than the
refresh case the brief imagined, because a refresh is visible and recoverable by
regenerating, whereas this is silent and the teacher does not learn the first exam is
gone until they go looking for it weeks later.

Three roadmap items are also blocked on the same missing thing, all confirmed:
- **Personal exercise library** (roadmap 6, the retention play) — needs many subjects,
  queryable by chapter. A single JSON blob under one localStorage key cannot back it.
- **Billing** — the favoured model is one credit = one finished subject
  (`docs/product-brief.md` §4). A subject that exists only in a browser cannot be
  counted, and a teacher clearing site data would erase what they paid for.
- **Cross-device** — `localStorage` is origin+device scoped. A teacher who plans on a
  laptop and prints from a desktop has nothing on the second machine.

And the durability that *does* exist is unguaranteed by design: every access in
`persist.ts` is wrapped in `try/catch {}` (lines 15–34) and fails **silently** on
private mode, disabled storage or quota. That was the right call for core-loop (its
own comment: *never break the app over it*), but it means the product currently
promises a teacher nothing at all.

**Cost of leaving it:** the product destroys teacher work as a matter of routine
operation, and the two-teacher validation test (`docs/product-brief.md` §6) will run
on a product where making a second exam deletes the first.

## Current reality — the planning kit (observed, not assumed)

### 1 · Acting-surface map (where we'll act)

| Stack | Path (`repo/path:LINE`) | Role | Change |
|---|---|---|---|
| be | `teacher-be/src/app.ts:86` | `POST /api/generate` — the only write path today; returns the subject and forgets it | modify |
| be | `teacher-be/src/app.ts:21` | app assembly / middleware — where subject routes mount | modify |
| be | `teacher-be/src/config.ts:19` | the **only** place env is read; needs `MONGO_URL`, `MONGO_DB` | modify |
| be | `teacher-be/src/store/` | Mongo client + `subjects` repository | **new** |
| be | `teacher-be/src/routes/subjects.ts` | subject CRUD + exercise replace | **new** |
| be | `teacher-be/src/teacher.ts` | opaque teacher-id issue/resolve middleware | **new** |
| be | `teacher-be/src/claude/runner.ts:90` | `sessionId` → `--resume`; **frozen**, see H4 | read-only |
| be | `teacher-be/src/runlog.ts:24` | JSONL telemetry; **frozen**, not a store | read-only |
| fe | `teacher-fe/src/lib/persist.ts:10` | `KEY_EXAM` single slot — the defect | modify |
| fe | `teacher-fe/src/lib/api.ts` | the `be` client; gains subject calls | modify |
| fe | `teacher-fe/src/App.tsx:23,29,30` | rehydrate + save effects — source of truth moves to server | modify |
| fe | `teacher-fe/src/components/SubjectList.tsx` | minimal Arabic/RTL "my subjects" list | **new** |
| fe | `teacher-fe/src/lib/exam.ts:26` | `ExamSubject` type — the persisted shape | read-only |

### 2 · Baseline recordings (surface → re-run command → recorded shape)

| Surface | Re-run command | Recorded shape (or pointer) | Captured (date · env) |
|---|---|---|---|
| `GET /health` | `curl -s localhost:9200/health` | `{"status":"ok","service":"teacher-be","env":"development","claude":{"ok":true,"detail":"2.1.224 (Claude Code)","active":0,"queued":0,"max":3}}` | 2026-08-07 · lane slot 2 |
| `GET /api/skills` | `curl -s localhost:9200/api/skills` | `{"skills":[{"name":"exam-subject",…},{"name":"refine-exercise",…}]}` — 2 entries | 2026-08-07 · lane slot 2 |
| `POST /api/generate` (`exam-subject`) | `curl -s -X POST localhost:9200/api/generate -H 'content-type: application/json' -d '{"skill":"exam-subject","input":{"topic":"الدوال العددية","difficulty":"متوسط","exerciseCount":3,"durationMinutes":120,"stream":"شعبة الرياضيات"}}'` | **`contracts/rec-exam-subject.2026-08-07.json`** (full body). Envelope `{text,data,sessionId,costUsd,durationMs,correlationId}`; `data = {title, meta, exercises[3]}`; ids `ex1,ex2,ex3`; `data` serialises to **5 056 bytes**; **HTTP 200 in 127.7 s**, `costUsd 0.645421` | 2026-08-07 · lane slot 2 |
| fe client persistence | `git show origin/main:src/lib/persist.ts` (in `teacher-fe`) | keys `teacher.draft.v1` (single) + `teacher.controls.v1`; all access `try/catch` silent | 2026-08-07 · `main` @ `2ed05c5` |
| `tools/ci` gate | `tools/ci be --slug persistence` · `tools/ci fe --slug persistence` | **both FAIL** — "no characterization tests resolved" (WF-68 no-op gate). Correct behaviour; suite does not exist yet | 2026-08-07 · job worktree |

### 3 · Perimeter consumers (recorded)

| Consumer | Surface it uses | Recorded shape (or pointer) |
|---|---|---|
| `teacher-fe` `App.tsx:59` | `POST /api/generate` (`exam-subject`) → `setExam(next)` | consumes `data` as `ExamSubject`; envelope fields other than `data` unused except error type |
| `teacher-fe` `App.tsx:72` | `POST /api/generate` (`refine-exercise`) → `spliceExercise` | splices **by `id`**; `exam.ts:38` *throws* on an unknown id — a contract violation is rejected, not merged |
| `teacher-fe` `App.tsx:23` | `loadDraft()` | rehydrates `ExamSubject | null` from `teacher.draft.v1` |
| `teacher-fe` `App.tsx:19` | `loadControls()` | rehydrates `Controls`, falls back to `DEFAULT_CONTROLS` |
| `be` `app.ts:118` | `recordRun(...)` → `run-log.jsonl` | `{ts,skill,correlationId,durationMs,costUsd,exerciseCount,ok}` — must stay bit-stable |

**Compat posture: strictly additive.** `POST /api/generate`'s request and response
shapes do not change. Subject storage arrives as *new* routes, so an unmodified `fe`
keeps working against a new `be`. That is what lets `be` and `fe` merge in any order
(`build.md` → `depends_on` stays empty).

### 4 · End-to-end trace (one real action, correlated)

One real generation, lane slot 2, 2026-08-07:

```
fe (not attached at trace time)
  └─ POST /api/generate {skill:"exam-subject", input:{topic:"الدوال العددية",…}}
       └─ app.ts:86  validates skill against catalogue (isKnownSkill)  ✓
            └─ runner.ts:90  buildArgs → --session-id <uuid> (no --resume; fresh)
                 └─ spawn: claude -p --output-format json --setting-sources project
                      └─ 127 676 ms, cost $0.645421, exit ok
                 └─ runner parses stdout BEFORE exit code (the load-bearing order)
            └─ app.ts:118  recordRun{durationMs,costUsd,exerciseCount:3,ok:true} → run-log.jsonl
       └─ 200 {text,data,sessionId,costUsd,durationMs,correlationId}
  └─ [WHERE THE JOB ACTS] ── nothing writes `data` anywhere durable, server-side.
     The only durable copy is the browser's `teacher.draft.v1`, overwritten next time.
```

Boundary crossings the job adds: `fe ⇄ be /api/subjects*` (new contract), and
`be ⇄ mongo` (new). No new AI boundary — generation is untouched.

### 5 · Observability baseline

- **Visible today:**
  - `GET /health` reports `claude.ok`, CLI version, `active`/`queued`/`max` — proven live.
  - Per-request `correlationId` stamped in `app.ts:26–33` and echoed in the response.
  - `run-log.jsonl` accumulates `{durationMs, costUsd, exerciseCount, ok}` per run.
  - Lane logs at `/tmp/teacher-backend.s2.log` (`tools/obs logs`).
- **Blind spots (become the first sub-issues — a loop can't verify what it can't see):**
  - **No visibility into persistence at all** — nothing logs a write, and there is no
    store to query. Until a subject is fetchable by id, IMPLEMENT cannot prove a save.
  - `/health` does not report the datastore. A dead Mongo would be indistinguishable
    from a healthy service until the first write fails.
  - `run-log.jsonl` has no `subjectId`, so a run cannot be tied to the subject it
    produced — the "how many refines per exam" question core-loop wanted answered
    (its SEED, direction item 6) is still unanswerable.

### 6 · Unknowns ledger (no naked unknowns)

| Unknown | Disposition | Evidence / note |
|---|---|---|
| Is durability actually missing? | **resolved — no, it exists but is single-slot** | `persist.ts:10` one key; `App.tsx:30` overwrite-on-change. Brief's premise falsified (H1) |
| Which store? | **resolved — MongoDB** | Already running on this machine (`nc localhost 27017` → open, shared infra); `services.sh:48` **already reserves DB name `teacher_saas`**; `services.sh:64` lists mongo as the shared-infra candidate. `ExamSubject` is a JSON document with a nested `exercises[]` — store shape = wire shape, so no mapping layer (H3) |
| Who owns a subject? | **resolved — opaque server-issued teacher id, no auth UI** | core-loop's SEED deferred persistence as *"the next job, with accounts"*, but full auth contradicts "don't over-engineer" for a two-teacher test. Upgrade path preserved (H5) |
| Does `sessionId` get replaced? | **resolved — no, untouched** | `runner.ts:106` uses it only for `--resume`. `refine-exercise` takes `examContext` inline, needs no session (core-loop SEED kit §6). Orthogonal to product data (H4) |
| Does `fe` have to change? | **resolved — yes; `fe` attached mid-DISCOVERY** | `fe` owns the current source of truth. `tools/provision persistence extend fe:main` ran 2026-08-07 |
| Does the store choice pick a deploy target? | **accepted-risk** | Deploy is ★ PENDING for both repos. Mongo implies managed (Atlas) or self-hosted later. Recorded, not resolved — no deploy decision is being made in this job |
| Storage volume at scale | **resolved — non-issue** | Measured 5 056 bytes/subject. 1 000 teachers × 50 subjects ≈ 250 MB |
| Model cost per subject | **accepted-risk, out of scope** | Measured $0.645/generation vs 2 000 DZD/mo (~$15) ⇒ ~23 subjects/mo breaks even before infra. Real, but it is a billing question and billing is out (`docs/product-brief.md` §4 says don't lock the model in yet) |
| Migration of existing localStorage drafts | **resolved — one-shot adopt on first load** | Only ever one draft exists per browser; adopt it into the store on first authenticated load, then clear the key |
| Concurrent edits to one subject from two tabs | **parked** (`blocked_on: real usage`) | No evidence teachers do this; last-write-wins is acceptable for the teacher test. Revisit if observed |

### 7 · Sweep statement (the edge of the evidence)

- **Swept:** `teacher-be` `src/` in full (`app.ts`, `config.ts`, `claude/runner.ts`,
  `claude/skills.ts`, `runlog.ts`); `teacher-fe` `src/lib/` (`persist.ts`, `exam.ts`,
  `api.ts` surface) and `App.tsx`'s state/effect wiring; `project/services.sh` infra
  declarations; live `be` on lane slot 2 (`/health`, `/api/skills`, one real
  `/api/generate`); `tools/ci` gate for both keys; core-loop's SEED and its persistence
  decision; the `claude` CLI auth path (proven live).
- **Not swept (why):**
  - **`fe` component internals** (`ExamView`, `RefinePanel`, `Controls`, `Progress`,
    `katex.tsx`, `styles/`) — the job changes *where state comes from*, not how it
    renders. If a sub-issue needs to touch rendering, that is outside this evidence and
    must stop-and-ask.
  - **The `.claude/skills/*/SKILL.md` prompts** — generation is explicitly frozen.
  - **The printable/export path** — untouched by storage; but note "finished = exported"
    is a *billing* notion and billing is out, so no lifecycle is being built on it.
  - **Redis** (running on 6379) — not investigated; no caching need identified at this
    volume.
  - **Any deploy/staging plane** — both repos are single-branch with empty integration
    fields, so there is no staging axis to sweep.

## Solution direction (locked, product-level)

**Move the source of truth for an exam subject from the browser to the server, and
give a teacher more than one of them.**

1. **`be` owns subjects.** A MongoDB collection in DB `teacher_saas` (the name
   `services.sh:48` already reserved), storing the `ExamSubject` document as-is plus
   `{_id, teacherId, createdAt, updatedAt}`. Store shape = wire shape; no ORM, no
   mapping layer.
2. **A teacher is an opaque id, not an account.** `be` issues a random `teacherId` on
   first contact; `fe` keeps it and sends it. **No login, no password, no email, no
   auth UI** — that is a later job, and this id is designed to be adopted by it.
3. **Subjects are plural and listable.** Generating a new exam creates a *new* subject.
   A minimal Arabic/RTL list lets a teacher reopen an earlier one. This is the whole
   point: the single-slot overwrite is the defect.
4. **Refinement updates the stored exercise.** Core-loop step 4 writes through to the
   store by exercise `id`, preserving the existing splice-by-id contract.
5. **`localStorage` demotes to a cache**, not the source of truth — it keeps the app
   usable if the network is slow, and the existing single draft is adopted once on
   first load, then its key is cleared.
6. **`/health` reports the store**, and `run-log.jsonl` gains `subjectId` so a run can
   finally be tied to the subject it produced.

**Alternatives considered**
- *SQLite / a single JSON file on disk* — **not now**: no server dependency is
  genuinely attractive, but Mongo is already running as declared shared infra and the
  DB name is already reserved (`services.sh:48`), so SQLite would add a second storage
  technology to the machine to save a dependency that is already paid for. Document
  shape also maps 1:1 to `ExamSubject`; SQLite would need JSON columns or flattening.
- *Postgres* — **not now**: nothing here is relational, nothing needs transactions
  across entities, and it is not running locally. It would pick a deploy target
  (kit §6) for no gain at this shape.
- *Keep it client-side but key by subject id* — **killed by the requirements, not by
  taste**: it fixes the overwrite (defect 1) but leaves the library unqueryable, the
  subject uncountable for billing, and everything device-bound. Three of the four
  reasons the job exists survive it.
- *Full teacher accounts (email + password / magic link)* — **not now**: mail is
  ★ PENDING (no integration exists), auth UI is a job's worth of work in itself, and
  the next milestone is two teacher friends. The opaque id is explicitly upgradeable.
- *Replace CLI `sessionId` with product-owned sessions* — **killed**: `refine-exercise`
  takes `examContext` inline and needs no session (core-loop SEED kit §6), so there is
  nothing to replace (H4).

## User value (company-facing framing)

A teacher's exams stop disappearing. Every subject they generate is kept, reopenable
and refinable later — instead of each new exam silently destroying the one before it.

## Scope & boundaries

- **In:**
  - `be`: Mongo connection + config, `subjects` collection, opaque `teacherId`
    issue/resolve, subject create/list/get/update-exercise routes, `/health` store
    reporting, `subjectId` in the run log.
  - `fe`: `api.ts` subject calls, `App.tsx` source-of-truth switch, `persist.ts`
    demoted to cache + one-shot adoption of the existing draft, a minimal Arabic/RTL
    subject list.
- **Out (non-goals):**
  - Teacher accounts, login, email, password reset, any auth UI.
  - Billing, credits, payment rails, any metering or quota.
  - The exercise **library UI** and search (roadmap 6) — the store must not preclude
    it; the surface is a later job.
  - Solution sheets, multiple versions, exercise series (roadmap 1–5).
  - Any change to generation: the two `SKILL.md`s, `runner.ts`, and the
    `/api/generate` request/response shape are **frozen**.
  - Deploy targets and staging (both repos single-branch; ★ PENDING).
  - Multi-tab conflict resolution (parked, kit §6).
- **Stacks likely touched:** `be` · `fe` (both attached; `fe` added mid-DISCOVERY)

## Risks & backward-compat flags

- **Additive-only at the HTTP perimeter.** `/api/generate` keeps its exact request and
  response shape (kit §3), so an old `fe` works against a new `be`. `depends_on` stays
  empty and the repos merge in any order.
- **`run-log.jsonl` shape change is additive** — `subjectId` is a new optional field;
  existing readers must not break. Pin it with a characterization test.
- **A new hard dependency.** `be` currently boots with no external service. After this
  it needs Mongo. `/health` must degrade honestly rather than let the service look
  healthy while writes fail — this is a *new failure class* and belongs in the existing
  classification scheme (`503 store_unavailable`), not as a bare 500.
- **The teacher id is a bearer token in disguise.** Anyone holding it reads that
  teacher's subjects. Acceptable for a two-teacher test with no sensitive data (exam
  drafts, not student records), but it must be stated in the docs and **must not**
  silently become the auth model. Flag for the accounts job.
- **Silent-failure regression risk.** `persist.ts` deliberately swallows storage
  errors. Once the server is the source of truth, a swallowed *network* failure would
  mean a teacher believes work is saved when it is not. Save state must be visible.
- **Deploy is undecided** (kit §6, accepted-risk) — Mongo implies managed or
  self-hosted later; this job does not choose.

## Investigation journal (hypotheses, not a reading list)

- **H1 — the brief's own framing: "`be` is stateless, so a refresh loses the teacher's
  evening; the job is to make it survive a reload"**
  → test: before reading any `be` code, grep the *frontend* for storage APIs —
  the cheapest thing that could retire the job
  (`git grep -nE "localStorage|sessionStorage|indexedDB|persist" origin/main -- src`)
  → result: `src/lib/persist.ts` exists and is wired in `App.tsx:9,23,29,30`. Drafts
  and controls are already persisted and rehydrated. A refresh loses **nothing**.
  → belief: **killed.** The brief's premise and its "Done when" describe behaviour that
  already ships. Had I planned from the brief, the job's headline deliverable would
  have been a feature that already exists.

- **H2 — refined: "then there is no real problem; persistence is purely a
  billing/library enabler"** (the competing model to H2′ below)
  → test: read what `persist.ts` actually stores — how many subjects can coexist?
  → result: `const KEY_EXAM = "teacher.draft.v1"` — one fixed key, written by
  `useEffect(() => saveDraft(exam), [exam])`. A second exam overwrites the first with
  no history and no recovery path.
  → belief: **killed.** There is a severe user-facing defect, it is just not the one
  the brief named — and it is worse, because it is silent.

- **H2′ — competing model: "the defect is a data-loss bug, and it is the job's real
  driver; library and billing are consequences"**
  → test: quantify what a lost subject costs — one real generation on the lane
  → result: 127.7 s, $0.645, 5 056 bytes, 3 exercises with stable ids
  (`contracts/rec-exam-subject.2026-08-07.json`); teachers make 3–6 exams per trimester,
  so the *second* exam destroys the first
  → belief: **kept.** This is the model the SEED is built on. H2 dies on the evidence.

- **H3 — "the store choice is open, and picking one is the hard part"**
  → test: read `project/services.sh` for declared infra; probe what is actually running
  (`nc -z localhost 27017`, `6379`)
  → result: Mongo **and** Redis are up as shared infra, and `services.sh:48` already
  reserves DB name `teacher_saas` for this product
  → belief: **refined.** The choice was substantially pre-made by the profile. Mongo is
  the evidence-led answer, not a preference; and `ExamSubject`'s nested `exercises[]`
  maps to a document with no translation layer. What is genuinely open is *deploy*,
  which this job does not decide (kit §6).

- **H4 — "a persisted subject must replace the CLI's `sessionId` continuity"**
  → test: read `runner.ts` for how `sessionId` is used, and check whether the core loop
  depends on it
  → result: `runner.ts:106` uses it solely for `--resume`; `refine-exercise` takes the
  exercise inline via `examContext` and requires no session (core-loop SEED kit §6)
  → belief: **killed.** Orthogonal. `runner.ts` stays frozen — a fork the brief raised
  and the evidence closes.

- **H5 — "ownership must mean real teacher accounts"**
  → test: read core-loop's SEED on why it deferred persistence, and weigh it against
  the product's hard constraints
  → result: core-loop deferred it as *"the next job, with accounts"* — but
  `project/CLAUDE.md` makes "don't over-engineer" a hard constraint and sets the next
  milestone at two teacher friends; mail is ★ PENDING so magic-link is unbuildable today
  → belief: **refined.** Ownership is required; *accounts* are not. An opaque
  server-issued id delivers every downstream property (server-owned, countable,
  queryable, cross-session) at near-zero surface, and is explicitly upgradeable. The
  security cost is real and is flagged in Risks, not hidden.

- **H6 — "the CI baseline is green, so the workspace is sound"** (from the provision
  receipt)
  → test: run the gate properly from the job worktree —
  `tools/ci be --slug persistence`, `tools/ci fe --slug persistence`
  → result: **both FAIL** — "no characterization tests resolved" (WF-68: a no-op gate
  must be red). The receipt's `green` for `be` was a misread.
  → belief: **killed.** Corrected in `build.md`. Not a defect in either repo — the job
  has no suite yet, and the first sub-issue creates it.

- **H7 — "generation is blocked by an expired CLI login"** (inherited blocker from the
  brief and from core-loop)
  → test: `claude -p --output-format json --setting-sources project 'reply … ok'`
  → result: `is_error:false`, real run, then a full 127.7 s exam generation over HTTP
  → belief: **killed.** The blocker is retired for this job; end-to-end verification of
  generate → persist → reload is available to IMPLEMENT and QA.

## Ready-for-PLANNING checklist
- [x] the brief's framing was tested, not assumed (journal H1 — **falsified**)
- [x] problem + solution direction agreed and **locked**; why-nots cite killing evidence
- [x] acting-surface map present (kit §1); scope in/out stated
- [x] every acting surface has a baseline recording with its re-run command (kit §2)
- [x] perimeter consumers recorded (kit §3); backward-compat posture flagged (additive)
- [x] one correlated end-to-end trace saved (kit §4)
- [x] observability baseline stated — blind spots called out (kit §5)
- [x] **no undispositioned unknowns** (kit §6 — 1 parked, 2 accepted-risk, rest resolved)
- [x] sweep statement present — the unswept edge named (kit §7)
- [x] **lock re-verification: every §2 recording reproduced at seal time** — see below

### Seal re-verification (2026-08-07)
Re-ran every kit §2 command at seal time; all reproduced:
- `/health` → `status:ok`, `claude.ok:true` ✓
- `/api/skills` → 2 skills ✓
- `POST /api/generate` → the recorded run is the seal recording itself
  (`contracts/rec-exam-subject.2026-08-07.json`, HTTP 200, 127.7 s) ✓
- `persist.ts` at `main` @ `2ed05c5` → single `teacher.draft.v1` key ✓
- `tools/ci` both keys → both RED (WF-68 no-op gate) ✓
