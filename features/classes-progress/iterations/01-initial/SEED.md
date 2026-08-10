# SEED — classes + progress (slice 1 of 7)

> **Phase:** DISCOVERY. **Input:** `00-brief.md`. **Output:** this file. **Consumed by:** PLANNING.
> Locked 2026-08-11 after EXPLORE fan-out to the `be` and `fe` stack agents against the
> running lane (slot 8: be :9800 · fe :10800).

## Anchor
- **Job kind:** feature
- **Upstream:** `artefacts/design_handoff_prep_companion/ANALYSIS.md#slice-1` (design handoff, no tracker item — personal project)

## Problem (enriched)

A teacher teaches several 3AS classes and each has its own position in the programme. The
product cannot represent that. `grep -rc "classId" src` in `teacher-be` returns **none**;
`GET /api/classes`, `/api/progress` and `/api/programmes` all **404** on the live lane. A
teacher is one opaque id (`src/teacher.ts:19`), and progress does not exist anywhere.

The cost is not cosmetic. Every remaining slice reads a class's marked week: the tracker
(slice 2), scope derivation and the exclusion list (slice 3), the library's per-class filter
(slice 5). Product-description §5b rule 4 states the failure directly — modelling progress per
teacher "silently merges two classes that are three weeks apart, and the teacher discovers it
when an exam covers material one class has never seen." That is the one failure the product
exists to prevent, so the spine has to land before anything hangs off it.

Confirmed against the real store: **8,423 subjects, 0 with `classId`, 0 with `scope`**;
**17,049 teachers**, 11,808 anonymous, 6,092 with no `role` field at all.

## Current reality — the planning kit

### 1 · Acting-surface map

| Stack | Path (`repo/path:LINE`) | Role | Change |
|---|---|---|---|
| be | `src/store/classes.ts` | the `classes` collection | **new** |
| be | `src/store/progress.ts` | the `progress` collection | **new** |
| be | `src/routes/classes.ts` | `/api/classes` CRUD-minus-delete | **new** |
| be | `src/routes/progress.ts` | `/api/progress` read + CAS write | **new** |
| be | `src/store/programmes.ts:1019` | `getProgramme(db, docKey, {edition})` — keyed by docKey, **no stream reader exists** | modify (add `getProgrammeForStream`) |
| be | `src/store/programmes.ts:805` | index `{streams:1, current:1}` — already there, unused | read-only |
| be | `src/store/teachers.ts:336-367` | `createTeacher` — `role` hardcoded, no `school` | modify (optional `school`) |
| be | `src/store/teachers.ts:146-148` | `roleOf` — the absent-is-safe precedent to copy | read-only |
| be | `src/store/subjects.ts:51-54` | `statusOf` — the allow-list precedent for `classOf` | read-only |
| be | `src/store/subjects.ts:172-202` | `toRecord` / `toSummary` — field-explicit whitelists | modify (surface `classId`) |
| be | `src/store/subjects.ts:296-302` | `getOwned` — ownership in the query; **must never gain a classId filter** | read-only (freeze) |
| be | `src/routes/subjects.ts:102-154` | `POST /api/subjects` — where optional `classId` is validated | modify |
| be | `src/app.ts:114-132` | router mounting | modify |
| be | `src/teacher.ts:62-87` | `requireTeacher` — every new route sits behind it | read-only (freeze) |
| fe | `src/App.tsx:96-197` | the ~18-`useState` block; no context, no store | modify |
| fe | `src/App.tsx:890,906,919` | the three top-level early returns — **the only "routing" there is** | modify |
| fe | `src/App.css:10-15` | `.app` grid, 2 columns; RTL warning at `:1-8` | modify (add a row) |
| fe | `src/components/ClassBar.tsx` | the class switcher | **new** |
| fe | `src/lib/classes.ts` | class/progress types + fetchers | **new** |
| fe | `src/lib/persist.ts:20-34` | seven localStorage keys | modify (add `teacher.class.v1`) |
| fe | `src/App.tsx:317-324` | `dropRejectedIdentity` — **must clear the new key** | modify |
| fe | `src/App.tsx:479-495` | `onOpenSubject` — the total-context-switch precedent to reuse | read-only |
| fe | `src/components/AuthPanel.tsx:23,115-254` | `Mode` + 2 screens; no step machine | modify (steps 3–4) |
| fe | `src/lib/api.ts:274-296` | `request()` — the single place `x-teacher-id` is set | read-only (freeze) |

### 2 · Baseline recordings

Captured 2026-08-11 against lane slot 8 (be :9800). Re-run from the be worktree.

| Surface | Re-run command | Recorded shape | Captured |
|---|---|---|---|
| routes that exist | `curl -s localhost:9800/api` | `/health /api/skills /api/generate /api/teacher /api/subjects /api/exams /api/auth/{signup,signin,recover}` | 2026-08-11 · s8 |
| classes absent | `curl -s -o /dev/null -w '%{http_code}' localhost:9800/api/classes` | `404` | 2026-08-11 · s8 |
| progress absent | `curl -s -o /dev/null -w '%{http_code}' localhost:9800/api/progress` | `404` | 2026-08-11 · s8 |
| mint identity | `curl -sX POST localhost:9800/api/teacher` | `201 {teacherId:<32hex>, correlationId}` | 2026-08-11 · s8 |
| gate: no header | `curl -s localhost:9800/api/subjects` | `401 {error:{type:"teacher_required"}}` | 2026-08-11 · s8 |
| gate: unissued 32-hex | `curl -s -H 'x-teacher-id: <32 hex, unissued>' localhost:9800/api/subjects` | `401 teacher_required` | 2026-08-11 · s8 |
| gate: uppercase hex | `curl -s -H 'x-teacher-id: <UPPERCASE of a valid id>' localhost:9800/api/subjects` | `401` — **case-sensitive** (`teacher.ts:19`) | 2026-08-11 · s8 |
| streams in corpus | `mongosh teacher_saas --quiet --eval 'db.programmes.distinct("streams")'` | the six, **byte-identical** to the handoff union (codepoint-compared) | 2026-08-11 |
| week range | `mongosh … aggregate over weeks.week` | every doc: weeks 1..27, exactly 27 | 2026-08-11 |
| subjects shape | `mongosh … countDocuments({classId:{$exists:true}})` | `0` of `8423` | 2026-08-11 |
| projection is a whitelist | plant `classId` in Mongo, then `curl -s localhost:9800/api/subjects/:id` | field **does not appear** — `toRecord` builds key-by-key | 2026-08-11 · s8 |
| index unaffected | `explain("executionStats")` on `{teacherId}` sort `updatedAt:-1` | `IXSCAN teacherId_1_updatedAt_-1`, keys 1 / docs 1 | 2026-08-11 |
| 429 body | 11th signin in a window | `{error:{type:"rate_limited", retryAfterSeconds:5}}` | 2026-08-11 · s8 |
| fe: no nav | `document.querySelectorAll('nav').length` in the running app | `0` | 2026-08-11 · s8 |
| fe: RTL + KaTeX | inject a `.math > .katex` island into an RTL paragraph | para `rtl`, math `ltr`, bidi `isolate`, `inline-block` | 2026-08-11 · s8 |
| ci gate, be | `tools/ci be --slug classes-progress` (from the be worktree) | `FAIL: no characterization tests resolved` → **RED, correct** | 2026-08-11 |

### 3 · Perimeter consumers

| Consumer | Surface it uses | Recorded shape |
|---|---|---|
| `GET /api/subjects` (list) | `toSummary` (`subjects.ts:189-202`) | `{subjects:[{id,title,exerciseCount,…}]}` — no `classId` |
| `GET /api/subjects/:id` | `toRecord` (`subjects.ts:172-187`) | `{id,createdAt,subject,genCorrelationId,costUsd,durationMs,…}` |
| five more `getOwned` call sites | `routes/subjects.ts:193,217,306,376,473` | all must keep reaching legacy (classId-less) subjects |
| `routes/admin.ts` | aggregates over `subjects` | unaffected by an added field |
| `fe` `buildExamRequest` | `src/lib/taxonomy.ts:10,78-91` | sends `STREAM = "شعبة الرياضيات"`, hardcoded — the only stream fe knows |
| `fe` `request()` | `src/lib/api.ts:290` | `x-teacher-id` header, set in exactly one place |

**Compat posture: additive throughout.** `toRecord`/`toSummary` are field-explicit
whitelists, proven by planting a field and watching it not appear — so `be` can land before
`fe` with zero wire change until the projection is deliberately extended.

### 4 · End-to-end trace

One real action, `POST /api/teacher` → `GET /api/subjects`, correlated by `correlationId`:
mint returns `201 {teacherId}` (`routes/auth.ts` path, `teachers.ts:336-367` writes the row
with `email:null`), the id then passes `requireTeacher`'s registry check
(`teacher.ts:62-87` → `isKnownTeacher` `countDocuments`), and `listByTeacher`
(`subjects.ts:284-289`) returns `200 {subjects:[]}` over `IXSCAN teacherId_1_updatedAt_-1`.

**The boundary crossings this slice adds** are all inside that same envelope: browser holds
the id in `teacher.id.v1` → `request()` attaches `x-teacher-id` → `requireTeacher` →
a store call scoped `{classId, teacherId}` or `{teacherId}`. No new transport, no new auth.

### 5 · Observability baseline

- **Visible today:** correlation id on every response (middleware runs *before* the body
  parser, deliberately); `teacher.rejected` logged with an 8-char id prefix (`teacher.ts`);
  `/health` reports store + CLI + queue depth; `run-log.jsonl` for generation only.
- **Blind spots:** nothing logs a class or progress mutation, because neither exists. A
  progress CAS loss would be invisible. **First sub-issue must add a structured log line for
  every progress write (win and CAS-loss), or the loop cannot verify its own concurrency
  behaviour.**

### 6 · Unknowns ledger

| Unknown | Disposition | Evidence / note |
|---|---|---|
| `programmeVersion` is one string in the handoff, 2–3 fields in reality | **resolved** | Store `programmeDocKey` + `programmeEdition` as identity, `programmeTranscriptionRev` as provenance only. Comparing on transcriptionRev would collapse the two version axes the data model forbids collapsing (`programmes.ts:152,167`; project/CLAUDE.md "Two version axes"). |
| No stream→programme reader exists | **resolved** | `getProgrammeForStream(db, stream)` lands **in this slice** over the existing unused `{streams:1,current:1}` index (`programmes.ts:805`). Slice 2 reuses it. |
| Where `school` lives | **resolved** | Optional field on `teachers` — it is per-teacher and prints on the sheet. Absent-reads-as-null, same discipline as `role`. |
| "Remove a class" shape | **parked** | The handoff has no remove affordance on any screen. No field, no route in slice 1 — adding `archivedAt` now would be speculative. Additive later. |
| Tailwind v3 vs v4 | **resolved — deferred to slice 5** | The handoff theme is v3-shaped (`@tailwind` directives, a `themeExtend` object); the only Vite-8-compatible path is v4 (`@tailwindcss/vite` peer-deps `vite ^8`). **Slice 1 installs no CSS framework** and works in the existing `App.css` idiom. Migrating the framework inside the foundation slice would bloat it. |
| Dark mode | **parked to slice 5** | fe ships a full `prefers-color-scheme: dark` palette (`tokens.css:55-71`); the handoff is light-only. Dropping it is a visible regression and a product call, not an implementer's. |
| Six streams offered vs one curriculum file | **accepted risk** | Classes are storable for all six and every one resolves to a current programme. Generation quality differs (only `شعبة الرياضيات` has `agent/curriculum/`). Slice 1 offers six and makes **no claim about generation** — that is slice 3's honesty problem. |
| Class bar on `#/admin` | **resolved** | `#/admin` returns before the shell (`App.tsx:906`); the console gets no class bar. |
| Anonymous claim on sign-in | **parked (out of scope)** | ANALYSIS §3.1. Verified this slice makes it neither easier nor harder: `classes`/`progress` denormalise `teacherId` exactly as `subjects` does, so a future claim faces the identical re-pointing problem. |

**Three contract drifts found and recorded, none in this slice's path:**

1. **`409 email_taken` is documented and dead.** `routes/auth.ts:129-181` catches `EmailTaken`
   and answers **201** with a freshly minted id and a decoy recovery code — anti-enumeration by
   design. Two signups on one address both returned 201 with different ids; signin returned the
   first. `project/CLAUDE.md`'s error table is stale. Fix in `/document`.
2. **The handoff README says an anonymous teacherId is minted on first load** (`README.md:80`).
   Not true of what ships — the gate is mandatory (`App.tsx:406-412`). The landing's
   «جرّب أول موضوع دون إنشاء حساب» rests on the same false premise.
3. **Correction staleness**: the handoff says `correction.baseRev ≠ exercise.rev`
   (`contracts.ts:70`), but shipped derives it from `answersHash` (`solutions.ts:29-38`) and
   the stored `Exercise` **has no `rev` field** — `rev` is on the subject. Slice 5/6 problem.

### 7 · Sweep statement

- **Swept:** `be` identity/auth/teacher store, the subjects store and all six `getOwned` call
  sites, the programmes store and the live corpus (5 docs, 6 streams, weeks/rows per doc), the
  error contract and rate limiter, the ci gate and both test harnesses; `fe`'s whole App
  structure, persistence, api transport, AuthPanel, the CSS/token layer, RTL+KaTeX.
- **Not swept (why):** generation (`routes/exams.ts`, `claude/`) — slice 1 changes no
  generation path; `routes/admin.ts` beyond confirming an added field does not disturb it;
  the print sheet — it reads `school`, which slice 1 only *stores*; solutions/revisions — no
  class relationship until slice 5.

## Solution direction (locked)

**Two new collections, not a subdocument.** `classes` and `progress` each denormalise
`teacherId` and scope ownership **inside the query**, matching every existing store
(`subjects.ts:296-302`, `revisions.ts:93-103`, `solutions.ts:111-118`). Two reasons decide it
against nesting classes in `teachers`:

1. The join key must be a first-class document id. `subjects.classId` and `progress.classId`
   both point at it, and validating "is this classId mine?" against an array element would mean
   reading the credential row and scanning in application code — exactly the post-hoc ownership
   check `getOwned`'s comment forbids.
2. `teachers` holds `passwordHash`/`recoveryHash` and is the row `requireAdmin` reads to make a
   privilege decision. Weekly class edits must not be writes against that document.

*Why not a subdocument:* zero extra reads and a smaller diff — killed by (1); the id would be
unvalidatable by `findOne`.

**Progress is compare-and-set on `rev`, not `inflight`.** `inflight.ts:18-21` exists to stop
waste on ~2-minute agent loops; a progress PUT is a millisecond write. The precedent is
`subjects.ts:83-91` — a millisecond timestamp is not a version token, and it failed ~50% under
ten concurrent writes. CAS loser gets the existing `409 conflict`.

**`entries` is embedded, not its own collection.** Unlike `exercise_revisions` (unbounded,
kept off the hot read), `entries` is bounded at 27 rows and is read on every page load
*together with* `markedWeek`. Embedding is the cheap read here. An entry is upserted by `week`
so a skipped week's note survives.

**`classOf(doc)` is an allow-list**, shaped exactly like `statusOf` (`subjects.ts:51-54`):
`undefined | null | non-string ⇒ legacy`, and **legacy is never filtered out of a class's list
as "another class's"** — 8,423 subjects would vanish from every teacher's view.

**`fe` gets a class bar as a new grid row, and no CSS framework.** The switcher is a fourth
render branch placed after the auth gate and after `#/admin`. Switching class reuses the
existing total-context-switch shape (`App.tsx:479-495`) — clears `exam`, `subjectId`,
`refining`, `solutions`, `subjects`; **does not clear `pendingSave`**, which is an unsaved-exam
intent and dropping it on a tab switch is precisely the silent loss the persistence work exists
to prevent.

## User value

A teacher can tell the product which classes they teach and where each one has actually
reached — so everything the product later produces is aimed at one real class, not at an
average of all of them.

## Scope & boundaries

- **In:** `classes` + `progress` collections, indexes, and their routes; `getProgrammeForStream`;
  stream validation against the corpus; optional `school` on `teachers`; optional `classId` on
  `subjects` with `classOf` legacy tolerance; fe class bar + total context switch; sign-up
  steps 3 and 4 (classes+school, per-class position, skippable); the account screen's «أقسامي»;
  the week-0 empty state («أين وصل هذا القسم؟»).
- **Out:** the pacing bar's expected-week marker and the school-year calendar (slice 2); the
  tracker's week rows (needs the programme route — slice 2); scope-driven generation (slice 3);
  Tailwind/shadcn and the visual redesign (slice 5); anonymous-session claim; any delete or
  archive; multi-stream *generation* parity.
- **Stacks touched:** be · fe

## Risks & backward-compat flags

- **Additive everywhere.** Field-explicit projections mean `be` lands invisibly to `fe`.
- **The one real hazard is `classOf` degrading the wrong way.** Same class of bug as
  `roleOf` absent→admin, which survived a green gate in `accounts-hardening`. It must be an
  allow-list, and the characterization suite must pin a legacy (classId-less) subject staying
  visible under a class filter.
- **`getOwned` must not gain a `classId` filter** — a legacy subject would 404.
- **`markedWeek` upper bound comes from the class's own programme `totals.weeks`**, not from
  the `WEEKS_PER_YEAR = 27` constant, even though all five docs are 27 today.
- **Case-sensitivity:** teacher ids are lowercase-hex only; class ids should follow the same
  rule rather than inventing a second convention.

## Investigation journal

- **H1 (the brief's own framing): "the product cannot represent classes."** → test:
  `grep -rc "classId" src` in be; `curl` `/api/classes`, `/api/progress`, `/api/programmes` on
  the live lane; read `App.tsx` for any class notion → result: no matches, three 404s, no fe
  concept. → belief: **kept**, and sharper — it is not "no class UI", it is no class anywhere,
  including no programme read route at all despite the corpus being loaded.
- **H2: "classes should nest in `teachers`, since the fixture nests them."** → test: read how
  every other store scopes ownership; ask what validates `subjects.classId` → result: an array
  element id cannot be validated by `findOne`; `teachers` is the credential row `requireAdmin`
  reads → belief: **killed**. Own collection.
- **H3: "adding `classId` to `subjects` will leak on the wire / disturb the index."** → test:
  plant `classId` + `scope` directly in Mongo, re-read through both routes; `explain()` the
  product query → result: neither field appeared (whitelist projections); `IXSCAN` unchanged,
  1 key / 1 doc → belief: **killed** — the change is safely additive and `be` can land first.
- **H4: "the handoff's `Stream` union is probably drifted, like its programme contract."** →
  test: `db.programmes.distinct("streams")` compared codepoint-by-codepoint against
  `contracts.ts:4` → result: **six for six, byte-identical** — no presentation forms, no
  tatweel, `آ` is U+0622 → belief: **killed**, but the *lesson* holds: validate against the
  corpus at runtime rather than hardcoding the union, because 6 streams map onto 5 documents.
- **H5: "progress needs `inflight` like the generation surfaces do."** → test: read
  `inflight.ts:18-21`'s stated purpose against what a progress PUT costs → result: inflight
  guards ~2-minute agent loops from duplicate work; a progress write is milliseconds →
  belief: **killed**. CAS on `rev`, reusing `409 conflict`.
- **H6: "slice 1 should adopt Tailwind, since we decided to adopt it."** → test: check
  `@tailwindcss/vite` peer-deps against Vite 8, and the handoff theme's directives → result:
  v4 is the only compatible path but the theme is v3-shaped, so "drop it in" is really
  "translate it"; and fe has 890 lines of `App.css` plus a dark palette the handoff lacks →
  belief: **refined** — the decision stands, the *timing* moves to slice 5. Slice 1 ships in
  the existing idiom.

## Ready-for-PLANNING checklist
- [x] the brief's framing was tested, not assumed (H1)
- [x] problem + solution direction agreed and locked; why-nots cite killing evidence
- [x] acting-surface map present; scope in/out stated
- [x] every acting surface has a baseline recording with its re-run command
- [x] perimeter consumers recorded; compat posture flagged (additive)
- [x] one correlated end-to-end trace saved
- [x] observability baseline stated — the progress-write blind spot is the first sub-issue
- [x] no undispositioned unknowns (two explicitly parked)
- [x] sweep statement present
- [x] lock re-verification: §2 recordings re-run at seal time
