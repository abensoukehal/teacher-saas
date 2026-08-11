# Stack spec — teacher-be (Express · TypeScript · ESM · Node 20+)

> The per-job skeleton for the **be** repo (`repos.sh` key `be`).
> Filled at PLANNING for `classes-progress` from the locked SEED. Implemented by the
> `be` stack agent against this feature's `contracts/`.
>
> **This slice touches no generation path and no skill.** It is pure application tier:
> two new collections, their routes, one store reader, and two additive field changes.
> If a sub-issue here spawns the CLI, it is scoped wrong.

## Scope recap (from SEED.md + this stack's sub-issues)
- Modules: `classes` + `progress` collections/stores/routes · `getProgrammeForStream`
  over the existing `{streams:1, current:1}` index · optional `classId` on `subjects`
  (store `classOf` allow-list, POST validation, projections, list filter) · optional
  `school` on `teachers` + `PUT /api/teacher/school` · structured mutation logging for
  every class/progress write (the SEED's blind spot, closed first).
- Contracts this stack must honor: `contracts/fe-be-classes-progress.contract.md`
  (all sections), `contracts/flows.md`.

## Current behavior baseline
> Captured 2026-08-11 against lane slot 8 (be :9800) — SEED §2 is the recording of
> record; re-run commands there. Pinned by
> `features/classes-progress/tests/be/*.characterization.test.js`
> (WF-53 home; run `tools/ci be --slug classes-progress` FROM THE JOB WORKTREE;
> lane from `CHAR_BE_URL`, log from `CHAR_BE_LOG` — never a hardcoded port).

- `GET /api/classes` and `GET /api/progress` → **404** (`curl -s -o /dev/null -w
  '%{http_code}' $CHAR_BE_URL/api/classes`). Nothing class-shaped exists:
  `grep -rc "classId" src` → none.
- `requireTeacher` (`src/teacher.ts:62-87`): no header → `401 teacher_required`;
  unissued 32-hex → `401`; uppercase of a valid id → `401` (case-sensitive,
  `teacher.ts:19`).
- Programmes: `getProgramme(db, docKey, {edition})` at `src/store/programmes.ts:1019`
  is keyed by docKey — **no stream reader exists**; index `{streams:1, current:1}` at
  `programmes.ts:805` is present and unused. Corpus: 5 docs, 6 streams (byte-identical
  to the handoff union), every doc weeks 1..27 exactly
  (`mongosh teacher_saas --quiet --eval 'db.programmes.distinct("streams")'`).
- Subjects: 8,423 documents, 0 with `classId`; `toRecord`/`toSummary`
  (`subjects.ts:172-202`) are field-explicit whitelists — a planted `classId` does
  **not** appear on the wire (SEED §2, the additive-compat proof). List query is
  `IXSCAN teacherId_1_updatedAt_-1`, keys 1 / docs 1.
- `createTeacher` (`teachers.ts:336-367`): no `school`, `role` hardcoded. Absent-is-safe
  precedent: `roleOf` (`teachers.ts:146-148`); allow-list precedent: `statusOf`
  (`subjects.ts:51-54`).
- CAS precedent: `replaceExercise` on `rev` (`subjects.ts:83-91`) — a millisecond
  timestamp is not a version token; it failed ~50% under ten concurrent writes.

## Observability (PIN co-requisite)
- Visible today: correlation id on every response (middleware BEFORE the body parser —
  deliberate, must not regress); `teacher.rejected` logged with an 8-char id prefix;
  `/health` reports store + CLI + queue; `run-log.jsonl` (generation only — class and
  progress data must NOT go there).
- **Blind spot (SEED §5): nothing logs a class or progress mutation — a progress CAS
  loss would be invisible, and the loop could not verify its own concurrency
  behaviour.** Closed by be-1 and carried by every later mutation: one structured line
  per write —
  `{event: "class.created" | "progress.write", classId, teacher: <8-char prefix>,
  week?, rev?, outcome: "win" | "cas_loss", correlationId}` — teacher id always
  prefix-only (the `teacher.rejected` discipline), never the full bearer value.
- Verify: `tools/obs logs be`, `tools/obs trace <correlationId>`; suites read
  `CHAR_BE_LOG`.

## Data model changes
| Model / store | Field | Change | Migration? |
|---------------|-------|--------|-----------|
| `classes` (new) | `_id, teacherId(32hex), name, stream, createdAt, updatedAt` | add collection · index `{teacherId:1, createdAt:1}` | no — new |
| `progress` (new) | `classId(24hex string), teacherId, markedWeek(int), entries[{week,status,note?,completedAt?}], rev(int), programmeDocKey, programmeEdition, programmeTranscriptionRev, createdAt, updatedAt` | add collection · index `{classId:1}` **unique** · `{teacherId:1}` | no — new; created lazily on first PUT (contract §0) |
| `subjects` | `classId` | add OPTIONAL root field, read only via `classOf` allow-list | no — absent = legacy, 8,423 docs untouched |
| `teachers` | `school` | add OPTIONAL field (`string | null`), absent reads as null (`roleOf` discipline) | no |

`entries` is EMBEDDED (bounded at `totals.weeks` by upsert-by-week, read with
`markedWeek` on every load) — deliberately unlike `exercise_revisions`, which is
unbounded and kept off the hot read. SEED "Solution direction", locked.

## Surfaces (Express routes)
> Mounting in `src/app.ts:114-132`. All new routes behind `requireTeacher`.

| Surface | Implementation path | New/Modify | Contract |
|---------|--------------------|-----------|----------|
| `POST /api/classes` | new `src/routes/classes.ts` | new | §3 |
| `GET /api/classes` | new `src/routes/classes.ts` | new | §3 |
| `GET /api/progress/:classId` | new `src/routes/progress.ts` | new | §4 |
| `PUT /api/progress/:classId` | new `src/routes/progress.ts` | new | §4 |
| `POST /api/subjects` (optional `classId`) | `src/routes/subjects.ts:102-154` | modify | §5 |
| `GET /api/subjects?classId=` | `src/routes/subjects.ts` (list) + `subjects.ts:284-289` | modify | §5 |
| `PUT /api/teacher/school` | alongside `POST /api/teacher` (routes/auth.ts path — SEED §4) | new | §0 |
| `getProgrammeForStream(db, stream)` | `src/store/programmes.ts` (near `:1019`) | new (store, no route — the route is slice 2) | §2 |

## Skills touched (`.claude/skills/`)
| Skill | New/Modify | What it produces | How its output is judged |
|-------|-----------|------------------|--------------------------|
| — none — | | this slice generates nothing | |

## Gating (concurrency, timeouts)
Untouched. No new path reaches `src/claude/runner.ts`; queue depth, cap and timeout are
unchanged. Progress writes are millisecond Mongo writes and deliberately do NOT use
`inflight.ts` (SEED H5, killed).

## Failure classification
No new 5xx. New surfaces reuse: `401 teacher_required` · `400 invalid_request` ·
`409 conflict` (progress CAS loss — immediate, no server retry, contract §0) ·
`503 store_unavailable` (retryable) · `413 payload_too_large`. One NEW type:
**`404 class_not_found`** — byte-identical body whether the class is absent, another
teacher's, or the id is malformed (contract §6; existence not probeable). A stream that
stops resolving to a current programme after the class exists → `500` (our own
invariant broken). Callers branch on `error.type`, never the status code.

---

## Sub-issues (this stack's technical work, grouped by issue)

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

### be-1 — the class spine, observable from its first write

**status:** done · **tag:** happy-path

**Intent.** Classes exist — creatable, listable, owner-scoped, stream-validated against
the corpus — and the SEED's observability blind spot closes with the very first
mutation: every class/progress write from here on emits one structured log line, or the
loop cannot verify concurrency it cannot see (SEED §5).

**Ground truth.** SEED §2, lane slot 8:
```
curl -s -o /dev/null -w '%{http_code}' $CHAR_BE_URL/api/classes          → 404
curl -s $CHAR_BE_URL/api                                                 → route list, no classes/progress
mongosh teacher_saas --quiet --eval 'db.programmes.distinct("streams")'  → the six, byte-identical to contracts.ts:4
```
`{streams:1, current:1}` exists unused (`programmes.ts:805`); the only reader is keyed
by docKey (`programmes.ts:1019`). Pre-flight: reproduce the 404 and the six streams
before writing a line.

**Delta (freeze).** May touch: new `src/store/classes.ts`, new `src/routes/classes.ts`,
`src/store/programmes.ts` (ADD `getProgrammeForStream(db, stream)` —
`findOne({streams: stream, current: true})` over the existing index; touch no existing
function), `src/app.ts:114-132` (mount only), plus the log-line helper (new module or
the existing logger — follow the `teacher.rejected` idiom). **Frozen:** `src/teacher.ts`
(every new route sits BEHIND `requireTeacher`, never reimplements it),
`src/inflight.ts`, every existing route and store function. Freeze check:
`git status --short -- src/teacher.ts src/inflight.ts src/routes/subjects.ts src/store/subjects.ts src/store/teachers.ts` empty.

**Oracle.** `features/classes-progress/tests/be/classes.characterization.test.js`
(jest, black-box over `CHAR_BE_URL`, `describeIfLane` from `guard` — model:
`accounts-hardening/tests/be/admin-surfaces.characterization.test.js`)
- mint a teacher → `POST /api/classes {name:"3ر1", stream:"شعبة الرياضيات"}` → `201`,
  `class.id` is 24 **lowercase** hex, `createdAt` ISO (positive)
- a class creates successfully for **each of the six streams** — one probe per corpus
  value, WF-70: the lettres document carries two streams in one record and both must
  resolve (positive)
- `GET /api/classes` returns them **createdAt ascending**, and a second teacher's list
  does not contain them (positive + ownership)
- unknown stream (`"رياضيات"`, empty, Latin junk) → `400 invalid_request`; empty and
  81-char names → `400` (negative)
- no `x-teacher-id` → `401 teacher_required`, same body as the recorded gate (negative)
- `curl $CHAR_BE_URL/api` still lists every previously recorded route — the index grew,
  nothing vanished (negative)
- duplicate name for the same teacher → `201` (contract §0 — names are labels)
- **obs assertion:** after a create, `CHAR_BE_LOG` contains one
  `class.created` line whose `correlationId` equals the response's, whose teacher field
  is an 8-char prefix (never 32 hex) (positive — the blind-spot closure)

**Boundaries.** Contract §§0, 2, 3, 6. Additive only. No delete/update route — contract
§3. Budget 10 iterations.

**Exit protocol.** Done-when: oracle green ×2 · freeze paths clean ·
`tools/ci be --slug classes-progress` green from the job worktree. Ask-when: the
stream union in Mongo stops matching the recording · any need to touch a frozen file ·
budget blown.

---

```yaml
---
kind: sub-issue
id: be-2
parent: i1
stack: be
status: done
depends_on: [be-1]
estimate: L
---
```

### be-2 — progress: the read synthesizes, the write compare-and-sets

**status:** done · **tag:** happy-path

**Intent.** Each class gets its own position: `GET` answers even before anything was
written (week 0 IS a state), `PUT` is a CAS on `rev` whose loser gets an immediate
`409` — the failure §5b rule 4 exists to prevent is two classes silently merged, and
the failure THIS design prevents is two tabs silently overwriting one position.

**Ground truth.** SEED §2: `curl -s -o /dev/null -w '%{http_code}'
$CHAR_BE_URL/api/progress` → `404`; every corpus doc has weeks 1..27 exactly
(`mongosh … aggregate over weeks.week`); the CAS precedent and its measured failure
without one: `subjects.ts:83-91` (~50% loss at ten concurrent writers). Pre-flight:
reproduce the 404; `be-1`'s `getProgrammeForStream` resolves all six streams.

**Delta (freeze).** May touch: new `src/store/progress.ts`, new
`src/routes/progress.ts`, `src/app.ts:114-132` (mount only). **Frozen:** be-1's files
(read-only — call `getProgrammeForStream` and the classes store, change neither),
`src/inflight.ts` (SEED H5: a progress PUT is a millisecond write; using inflight here
is a stop condition, not a variation), `src/store/subjects.ts`. Freeze check:
`git status --short -- src/store/classes.ts src/routes/classes.ts src/store/programmes.ts src/inflight.ts src/store/subjects.ts` empty.

**Oracle.** `features/classes-progress/tests/be/progress.characterization.test.js`
- `GET` on a fresh class → `200` with the synthesized empty shape: `markedWeek: 0`,
  `entries: []`, `rev: 0`, identity fields `null`, and
  `programme: {docKey, edition, totalWeeks: 27}` resolved from THAT class's stream
  (positive — **0 is an empty state, never an error**, contract §7.2)
- first `PUT {rev: 0, markedWeek: 8}` → `200`, `rev: 1`, and
  `programmeDocKey`/`programmeEdition`/`programmeTranscriptionRev` stamped; a second
  read returns them verbatim; a later `PUT` does NOT restamp them (positive —
  contract §1, identity is written once)
- bounds off the class's OWN programme: `markedWeek` 0 and `totalWeeks` accepted;
  `totalWeeks+1`, `-1`, `1.5`, `"8"` → `400 invalid_request` (negative — never the
  constant 27, SEED risk flag)
- `entry` upserts by `week`: write `{week: 5, status: "skipped", note}` then advance
  `markedWeek` past it → the note SURVIVES; re-upserting week 5 replaces that entry
  without duplicating; a `"done"` entry gains a server-stamped `completedAt`; status
  outside `planned|done|skipped` → `400` (positive + negative — one probe per status
  variant, WF-70)
- **CAS:** `PUT` with a stale `rev` → `409 conflict` **immediately** (no hidden retry —
  the response must be fast, and the stored document unchanged); two CONCURRENT first
  writes (`rev: 0` twice) → exactly one `200` and one `409`, one document, `rev: 1`
  (positive — the unique `{classId:1}` index is the tiebreak, contract §0)
- `404 class_not_found` for: a nonexistent id, ANOTHER teacher's real class, a
  malformed non-hex id — **all three bodies byte-identical** (negative — not probeable,
  contract §6)
- **obs assertion:** the concurrent-write drill leaves exactly one
  `progress.write outcome:"win"` and one `outcome:"cas_loss"` line in `CHAR_BE_LOG`,
  correlationIds matching the two responses (positive — SEED §5, the reason be-1 ran
  first)

**Boundaries.** Contract §§0, 1, 4, 6, 7.6. Additive only. Budget 12 iterations.
**Stop and ask** if CAS-without-retry cannot be made atomic with the entry upsert in
one update.

**Exit protocol.** Done-when: oracle green ×2 · freeze paths clean ·
`tools/ci be --slug classes-progress` green. Ask-when: any impulse to reach for
`inflight.ts` or a server-side retry · a frozen file · budget blown.

---

```yaml
---
kind: sub-issue
id: be-3
parent: i1
stack: be
status: done
depends_on: [be-1]
estimate: M
---
```

### be-3 — subjects adopt `classId` without losing the past

**status:** done · **tag:** happy-path

**Intent.** A subject can belong to a class — and the 8,423 that predate classes belong
to ALL of them: `classOf` is an allow-list where absent means legacy, and legacy is
never filtered out, because the alternative is every existing exam vanishing from every
teacher's view (SEED, the one real hazard — the `roleOf` absent→admin class of bug).

**Ground truth.** SEED §2: `countDocuments({classId: {$exists: true}})` → **0 of
8,423**; a `classId` planted directly in Mongo does NOT appear through
`GET /api/subjects/:id` (whitelist projections, `subjects.ts:172-202`) — the proof this
change is invisible until the projection key is deliberately added; list query
`IXSCAN teacherId_1_updatedAt_-1`, keys 1 / docs 1. Pre-flight: re-plant, re-read,
confirm the field still does not leak.

**Delta (freeze).** May touch: `src/store/subjects.ts` — add `classOf` (shaped exactly
like `statusOf` at `:51-54`), add the explicit `classId: string | null` key to
`toRecord` (`:172-187`) and `toSummary` (`:189-202`), extend `listByTeacher`
(`:284-289`) with the optional legacy-inclusive filter; `src/routes/subjects.ts:102-154`
(validate optional `classId` on POST, read the query param on list). **FROZEN:
`getOwned` (`subjects.ts:296-302`) — it must NEVER gain a `classId` filter** (a legacy
subject would 404 out of its own teacher's hands), and its five call sites
(`routes/subjects.ts:193,217,306,376,473`) stay untouched. Freeze check:
`git diff -- src/store/subjects.ts` contains no hunk overlapping `:296-302`.

**Oracle.** `features/classes-progress/tests/be/subjects-classid.characterization.test.js`
- `POST /api/subjects` with an owned `classId` → stored; `toRecord` and `toSummary` both
  surface it verbatim (positive)
- without `classId` → `classId: null` in both projections — surfaced deliberately, not
  leaked (positive)
- plant a NON-STRING `classId` (number, object) directly in Mongo → both projections
  read `null`, list treats it as legacy — the allow-list, one probe per degenerate
  variant (negative — WF-70; `?? null` passthrough fails this)
- **the pin the SEED demanded:** a legacy (classId-less) subject appears in
  `GET /api/subjects?classId=<any owned class>` (positive — legacy is never "another
  class's"); a subject tagged class A does NOT appear under `?classId=<class B>`
  (negative — the filter does filter)
- `POST` with another teacher's classId, a nonexistent one, and a malformed one → `404
  class_not_found`, bodies byte-identical (negative); non-string `classId` in the body →
  `400 invalid_request`
- `?classId=` with a foreign/unknown id → `200`, legacy-only list, no error (negative —
  contract §5: the teacherId scope makes it harmless, nothing probeable)
- `GET /api/subjects` WITHOUT the param → shape identical to the recorded baseline plus
  exactly the one new key (negative — perimeter: `toSummary`'s recorded consumers,
  SEED §3)
- `GET /api/subjects/:id` still returns a legacy subject by id — `getOwned` untouched
  (negative — the freeze, executable)

**Boundaries.** Contract §5, §6. Additive: the ONLY wire change is the one projection
key. Budget 10 iterations.

**Exit protocol.** Done-when: oracle green ×2 · `getOwned` hunk-free ·
`tools/ci be --slug classes-progress` green · the promoted `project/tests/be` net still
green against the job checkout (the five call sites' recorded shapes are its clauses).
Ask-when: the filter cannot stay on the existing index · any frozen line · budget blown.

---

```yaml
---
kind: sub-issue
id: be-4
parent: i1
stack: be
status: todo
depends_on: []
estimate: S
---
```

### be-4 — the school lands on the teacher row

**status:** todo · **tag:** happy-path

**Intent.** Sign-up step 3 collects the school («سيظهر على الموضوع المطبوع») after the
account already exists, so it needs its own small write surface; slice 1 only *stores*
it — the print sheet reads it in a later slice (SEED §7).

**Ground truth.** `createTeacher` (`teachers.ts:336-367`) writes no `school`; the
absent-is-safe read precedent is `roleOf` (`teachers.ts:146-148`). Mint recording (SEED
§2): `curl -sX POST $CHAR_BE_URL/api/teacher` → `201 {teacherId: <32hex>,
correlationId}`. Pre-flight: mint, inspect the row, confirm no `school` field.

**Delta (freeze).** May touch: `src/store/teachers.ts` (optional `school` param on
`createTeacher` + a `setSchool(teacherId, school)`), the file declaring
`POST /api/teacher` (routes/auth.ts path per SEED §4) — add `PUT /api/teacher/school`
behind `requireTeacher`. **Frozen:** the signup/signin/recover handlers' request and
response shapes, `roleOf`, the scrypt/recovery code paths. Freeze check:
`git status --short -- src/teacher.ts` empty and no diff hunk in the auth handlers'
bodies.

**Oracle.** `features/classes-progress/tests/be/teacher-school.characterization.test.js`
- `PUT /api/teacher/school {school: "ثانوية الأمير عبد القادر"}` → `200 {ok: true}`;
  the row holds it (read via mongo in the suite — no read surface exists yet, and that
  is the contract: write-only in slice 1) (positive)
- `{school: null}` clears it → `200` (positive)
- no header → `401 teacher_required`; non-string / 121-char → `400 invalid_request`
  (negative)
- `POST /api/auth/signup` request/response byte-identical to the recorded shape — the
  auth surface is untouched (negative)
- no existing recorded surface starts leaking `school` (negative — it is stored, not
  surfaced)

**Boundaries.** Contract §0 (school decision). Additive only. Budget 8 iterations.

**Exit protocol.** Done-when: oracle green ×2 · freeze respected ·
`tools/ci be --slug classes-progress` green. Ask-when: any surface seems to need to
RETURN school (that is a later slice) · budget blown.

---

```yaml
---
kind: sub-issue
id: be-5
parent: i1
stack: be
status: todo
depends_on: [be-1, be-2, be-3]
estimate: M
---
```

### be-5 — the perimeter drill: probes, abuse, and log truth under fire

**status:** todo · **tag:** hardening

**Intent.** The new surfaces hold credentialed-adjacent data behind a bearer id with no
rate limiting (inherited knowingly) — so what CAN be verified must be: existence is not
probeable from any angle, malformed input never crashes into an untraceable 500, and
the mutation log tells the truth under real concurrency, not just in the two-writer
happy case.

**Ground truth.** be-1..be-3 green. The recorded middleware pin (project/CLAUDE.md): the
correlation-id middleware runs BEFORE the body parser, so even a malformed body carries
`correlationId`. The recorded 429 shape (SEED §2) exists on auth routes ONLY. Rejection
logging precedent: `teacher.rejected`, 8-char prefix.

**Delta (freeze).** May touch: `src/routes/classes.ts`, `src/routes/progress.ts`,
`src/routes/subjects.ts` (hardening within the surfaces be-1..be-3 built — bounds,
error mapping), and the suite itself. **Frozen:** every wire shape locked by the
contract — this sub-issue may tighten validation, never change a happy-path response.
It also must NOT add rate limiting (a product decision recorded as inherited, not a
hardening freebie). Freeze check: be-1..be-3's oracles stay green untouched — they are
frozen against this implementer (WF-65 does not apply: nothing here supersedes a pin).

**Oracle.** `features/classes-progress/tests/be/perimeter.characterization.test.js`
- **probe matrix** (one clause per cell, WF-70): {nonexistent id, another teacher's id,
  non-hex garbage, 12-char hex, UPPERCASE of a real owned id} ×
  {`GET /api/progress/:id`, `PUT /api/progress/:id`, `POST /api/subjects` classId} →
  every cell `404 class_not_found`, all bodies byte-identical within a route (uppercase
  included: ids are case-sensitive lowercase, `teacher.ts:19` discipline)
- malformed JSON to each new POST/PUT → `400` WITH `correlationId` present (the
  middleware-order pin, executable)
- oversized: 10 KB name, 10 KB note, 10 KB school → `400` or `413`, never `500`; a
  markedWeek of `1e9` and `NaN`-shaped input → `400` (negative)
- **the five-writer drill:** 5 concurrent `PUT`s, same class, same `rev` → exactly one
  `200`, four `409`; `CHAR_BE_LOG` shows exactly one `outcome:"win"` and four
  `outcome:"cas_loss"`, five distinct correlationIds each matching a response, and the
  stored document reflects the winner alone (positive — the log is the concurrency
  oracle, SEED §5)
- 11 rapid `POST /api/classes` → all `201`, no `429` — pins the accepted no-rate-limit
  posture so a future limiter is a deliberate contract change, not drift (negative)
- the full teacher id appears NOWHERE in `CHAR_BE_LOG` for any of the above — prefix
  only (negative)

**Boundaries.** Contract §6, §7.5. Budget 10 iterations. Never call a real generation;
nothing here touches `src/claude/`.

**Exit protocol.** Done-when: oracle green ×2 · be-1..be-3 oracles green unmodified ·
`tools/ci be --slug classes-progress` green. Ask-when: a probe cell cannot return the
identical body without touching a frozen shape · budget blown.
