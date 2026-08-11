# Contract — fe ↔ be · classes + progress (slice 1)

> Locked at PLANNING. Both stacks implement against this; neither may change it alone.
> Derived from `SEED.md` (acting-surface map §1, recordings §2, unknowns §6, solution
> direction) and the handoff (`types/contracts.ts` `ClassRef`/`Progress`,
> `README.md` signup + week-0 copy). Where the handoff and the corpus disagree, the
> corpus wins (`ANALYSIS.md` §1).

## 0 · Decisions the SEED left to PLANNING

**Progress is addressed BY CLASS: `GET/PUT /api/progress/:classId`.** Progress belongs to
a class (product-description §5b rule 4), so the class id is the address, not a body
field. One document per class, unique index `{classId: 1}`.

**The progress document is created lazily, by the first successful PUT.** Class creation
stays a single insert (no cross-collection two-step that can half-fail). A class with no
progress document is a real, normal state — it is what "not started" IS. `GET` on such a
class synthesizes the canonical empty shape (`markedWeek: 0, entries: [], rev: 0`) with
`200`, never an error. The first `PUT` carries `rev: 0` and performs the insert; the
unique index turns a concurrent double-insert into a duplicate-key, which maps to the
same `409 conflict` as a CAS loss.

**A CAS loss is an immediate `409` — no server-side retry.** This deliberately differs
from `replaceExercise` (which re-reads and retries five times): a refine merges ONE
exercise into whatever the latest document is, so a retry preserves intent. A progress
PUT is whole-state intent over what the teacher was LOOKING AT — if `rev` moved, their
view is stale and only the teacher can re-decide. The server must not guess. `fe`
re-reads and re-offers.

**No `schoolYear` field in slice 1.** `types/contracts.ts:30` carries it, but there is no
calendar, no rollover, and no consumer until slice 2 ships the reference calendar. Adding
it later is additive; inventing its semantics now (when does a year roll? who says?)
would be speculation. Recorded so slice 2 inherits it knowingly.

**Duplicate class names are allowed.** Names are teacher-chosen labels (`3ر1`); the
handoff imposes no uniqueness and refusing a duplicate would be the product grading the
teacher's naming. No unique index on `name`.

**No classes = legacy mode, byte-stable.** Every existing teacher (17,049) has zero
classes. For them the app behaves exactly as today: no class selected, no `classId` on
any request, unfiltered subject list. Slice 1 must be invisible until a class is created.

**`school` lands via its own small surface, `PUT /api/teacher/school`.** Sign-up step 3
runs AFTER the account exists (the recovery code at step 2 proves it), so `school` cannot
ride `POST /api/auth/signup`. `createTeacher` gains the optional pass-through for future
callers; the wire path is the PUT.

**Generation does not carry `classId` in slice 1.** `POST /api/exams` and
`/api/generate` are untouched (SEED §7: generation not swept). Newly generated exams are
therefore *legacy* (visible under every class) until slice 3 binds `{format, scope,
classId}` to generation. Slice 1 wires `classId` into `POST /api/subjects` only — the
mechanism exists and is pinned, the binding comes later.

## 1 · `programmeVersion` — one string in the handoff, two axes in reality

The handoff's `Progress.programmeVersion: string` (`contracts.ts:31`) is stored as
**three fields**, and only two of them are identity:

```
programmeDocKey        string   ← identity ("tadarroj-3as-math")
programmeEdition       string   ← identity — THE MINISTRY'S version ("2022-09")
programmeTranscriptionRev int   ← provenance ONLY. Never compared, never identity.
```

**The rule:** a class is pointed at a programme by `docKey + edition`, and nothing may
re-point it silently. `transcriptionRev` is us fixing our own reading of an unchanged
page — comparing on it would collapse the two version axes the data model forbids
collapsing (`programmes.ts:152,167`; project/CLAUDE.md "Two version axes"): a
transcription correction would read as "the syllabus changed" and re-point every class
mid-year over a typo fix.

The server stamps all three at the progress document's insert, from the live resolution
of the class's stream. Subsequent PUTs never change them — re-pointing a class to a new
edition is a future, explicit surface, not a side effect of a write.

## 2 · Streams — validated against the corpus, never a hardcoded union

Six streams, five documents (the lettres document carries two streams in one record). A
stream value is valid iff `getProgrammeForStream(db, stream)` resolves — i.e.
`programmes.findOne({streams: <value>, current: true})` over the existing
`{streams: 1, current: 1}` index (`programmes.ts:805`) returns a document. The corpus
values were verified byte-identical to the handoff union, codepoint-compared (SEED §2,
H4) — but the corpus is the authority at runtime, because it is the thing generation
will actually read.

An unknown stream on class creation → `400 invalid_request`. Storing a class whose
stream resolves to no programme would make `GET /api/progress/:classId` unanswerable.

## 3 · Classes

### `POST /api/classes` — NEW. Behind `requireTeacher`.

```json
{ "name": "3ر1", "stream": "شعبة الرياضيات" }
```

- `name`: string, trimmed non-empty, ≤ 80 chars. `stream`: per §2.
- → `201`:

```json
{ "class": { "id": "<24 lowercase hex>", "name": "3ر1",
             "stream": "شعبة الرياضيات", "createdAt": "<ISO>" },
  "correlationId": "…" }
```

- The id is the ObjectId hex string — 24 **lowercase** hex, same convention as subject
  ids; no second id convention (SEED risk flag: teacher ids are case-sensitive
  lowercase hex, class ids follow).
- Errors: `401 teacher_required` · `400 invalid_request` (empty/oversized name, unknown
  stream, malformed body) · `503 store_unavailable`.

### `GET /api/classes` — NEW. Behind `requireTeacher`.

→ `200 { "classes": [ <class>, … ], "correlationId": "…" }`, ordered `createdAt`
**ascending** — a switcher's tab order must be stable; newest-first would reorder the
bar every time a class is added. `[]` for a teacher with none (legacy mode, §0).
Ownership scoped inside the query (`{teacherId}`), like every store.

### There is no delete, no update, no archive.

The handoff has no remove affordance (SEED §6, parked). Adding `archivedAt` now would be
speculative. Additive later.

## 4 · Progress

### `GET /api/progress/:classId` — NEW. Behind `requireTeacher`.

→ `200`:

```json
{ "progress": {
    "classId": "<24 hex>", "markedWeek": 0, "entries": [], "rev": 0,
    "programmeDocKey": null, "programmeEdition": null,
    "programmeTranscriptionRev": null, "updatedAt": null },
  "programme": { "docKey": "tadarroj-3as-math", "edition": "2022-09",
                 "totalWeeks": 27 },
  "correlationId": "…" }
```

- The block above is the **synthesized empty state** (no document yet): `markedWeek: 0`,
  `entries: []`, `rev: 0`, identity fields `null`. **`markedWeek: 0` = not started, and
  it renders as an empty state («أين وصل هذا القسم؟»), never as an error** — a week-0
  class shows *no* pacing, not zero pacing.
- `programme` is resolved **live** from the class's stream (§2) on every GET. It is how
  `fe` knows the week picker's upper bound in slice 1, before the programme route exists
  (slice 2). `totalWeeks` comes from that document's `totals.weeks` — never from a
  constant, even though all five documents say 27 today (SEED risk flag).
- A stored document is returned verbatim in `progress` (fields as in §1 plus
  `markedWeek`, `entries`, `rev`, `updatedAt`).
- **The key set is identical in both shapes**, synthesized and stored — including
  `programmeTranscriptionRev`, which is `null` until the first write stamps it. A key that
  appeared only after the first write would make `fe` branch on which of two shapes it
  got, and the branch it forgot would be the empty one. `fe` types it optional-nullable
  and never reads it for a decision (§1: provenance only, never compared).
- If the class's stream resolves to no current programme → `500` (the service's own
  invariant broken: §2 made that unrepresentable at create; reaching it means the corpus
  was mutated underneath us).
- Errors: `401 teacher_required` · `404 class_not_found` (§6) · `503 store_unavailable`.

### `PUT /api/progress/:classId` — NEW. Behind `requireTeacher`. Compare-and-set.

```json
{ "rev": 0,
  "markedWeek": 8,
  "entry": { "week": 8, "status": "done", "note": "أعدنا البرهان" } }
```

- `rev` — REQUIRED, int ≥ 0. Must equal the stored `rev` (0 when no document exists).
  Mismatch → `409 conflict`, immediately, no retry (§0). The winner's response carries
  the new `rev` (stored `rev + 1`; the insert writes `rev: 1`).
- `markedWeek` — REQUIRED, integer, `0 ≤ markedWeek ≤ programme.totals.weeks` of the
  **class's own programme** (resolved per §2 at write time). Not `27`-the-constant.
  Out of range → `400 invalid_request`. Week numbers are integers — unit *durations*
  may be fractional (أسبوع ونصف), week numbers never are.
- `entry` — OPTIONAL, one entry, **upserted by `week`** so a skipped week's note
  survives later writes. `week`: integer `1..totals.weeks`. `status`:
  `"planned" | "done" | "skipped"` (allow-list; anything else `400`). `note`: optional
  string ≤ 500 chars. The server stamps `completedAt` when a `"done"` entry is written.
  `entries` is embedded and bounded by upsert-by-week at `totals.weeks` rows.
- Slice 1's `fe` only ever sends `markedWeek`; `entry` is exercised by `be`'s own tests
  now and consumed by the tracker in slice 2. Both are contractual today.
- → `200 { "progress": { …updated document… }, "correlationId": "…" }`.
- Errors: `401` · `404 class_not_found` · `400 invalid_request` · `409 conflict` ·
  `503 store_unavailable`.

## 5 · `subjects.classId` — optional, with the legacy allow-list

### Storage and read

`subjects` gains an OPTIONAL root field `classId` (string, stored verbatim). It is read
**only** through `classOf(doc)`, an allow-list shaped exactly like `statusOf`
(`subjects.ts:51-54`):

```
classOf(doc): a non-empty string ⇒ that class · undefined | null | non-string ⇒ LEGACY
```

**Legacy is a first-class value, and a legacy subject is NEVER filtered out as "another
class's".** 8,423 stored subjects predate the field; a `??`-default or a bare equality
filter makes every one of them vanish from every teacher's view. This is the same class
of bug as `roleOf` absent→admin, which survived a green gate in `accounts-hardening`
(SEED, the one real hazard).

### `POST /api/subjects` — MODIFIED (additive)

Accepts optional `classId`. Present ⇒ must be a string naming a class **owned by the
caller** — validated by `findOne({_id, teacherId})` on `classes`, ownership inside the
query. Not owned or nonexistent → `404 class_not_found` (§6). Non-string → `400
invalid_request`. Absent → the subject is legacy, exactly as every subject today.

### `GET /api/subjects?classId=<id>` — MODIFIED (additive)

- Without the param: byte-identical to today.
- With it: returns subjects where `classOf(doc) === <id>` **OR** `classOf(doc)` is
  legacy — a class's list is "its documents plus everything from before classes
  existed", never a strict partition that hides history.
- The param is NOT ownership-validated: the `{teacherId}` scope already bounds every
  result, so a foreign or unknown `classId` simply yields the caller's legacy-only
  list. No error, nothing probeable.
- Stays on the `{teacherId: 1, updatedAt: -1}` index (the filter narrows in-memory or
  via the same scan; the recorded IXSCAN must not degrade — SEED §2).

**The two degenerate values, pinned — they resolve OPPOSITE ways on read and write, and
`fe` must know it (verifier finding, be-3/be-4 audit):**

| value | `GET ?classId=` | `POST` body `classId` |
|---|---|---|
| `""` (empty) | **no filter** — the whole list | **`404 class_not_found`** |
| repeated (`?classId=a&classId=b`) or array-shaped (`classId[]=`) | **`400 invalid_request`** | n/a |

Empty reads as "no class selected" and writes as "a class was named and it does not
exist" — fail-open on the read that must never lose a subject, fail-closed on the write
that would otherwise store a meaningless tag. **`fe` must never serialise an unselected
class as `""` in a POST body — omit the key entirely.**

The repeated-param `400` is the **only new way `GET /api/subjects` can fail**, on the
product's most-loaded read. It is accepted deliberately: a repeated param is ambiguous
*intent* that only a client bug can produce, and degrading it to "no filter" would hide
that bug behind a plausible-looking full list. **`fe` must never emit a repeated or
array-shaped `classId`.** Recorded dissent: the be-3 verifier argued for degrading to
no-filter on the "the reading that cannot lose a subject wins" principle, since a `400`
renders as «تعذّر تحميل مواضيعك». Revisit if a real client ever produces one.

### Projections

`toRecord` and `toSummary` (`subjects.ts:172-202`) each gain **one** explicit key:
`classId: <string> | null` (`null` = legacy, surfaced deliberately through `classOf`,
never passthrough). They remain field-explicit whitelists — the planted-field recording
(SEED §2) is the proof this lands invisibly until the key is added.

### Frozen on this surface

**`getOwned` (`subjects.ts:296-302`) never gains a `classId` filter.** A subject is
fetched by id + owner, whatever class it belongs to — otherwise a legacy subject 404s
out of its own teacher's hands.

## 6 · Errors

Reused, unchanged in shape (callers branch on `error.type`, never the status code):

| type | status | where in this slice |
|---|---|---|
| `teacher_required` | 401 | every new route (all behind `requireTeacher`) |
| `invalid_request` | 400 | bad name/stream/markedWeek/entry/rev shape, malformed body |
| `store_unavailable` | 503 | datastore down — RETRYABLE, `fe` says so in Arabic |
| `conflict` | 409 | progress CAS loss (reuses the existing type, new surface) |
| `payload_too_large` | 413 | oversized bodies, existing middleware |

**One genuinely new type: `class_not_found`, 404.**

```json
{ "error": { "type": "class_not_found", "message": "…" }, "correlationId": "…" }
```

Returned by `GET/PUT /api/progress/:classId` and by `POST /api/subjects` with a
well-formed but unresolvable `classId`. **The body is byte-identical whether the class
never existed, is another teacher's, or the id is a malformed/non-hex string** —
existence must not be probeable, the same rule `getOwned` enforces for subjects. (A
malformed id is not `400`: distinguishing "bad shape" from "not yours" would leak which
ids are real.)

No new 5xx semantics. `rate_limited` stays auth-only — these routes are not rate-limited
in slice 1 (inherited knowingly with the bearer-id posture, project/CLAUDE.md ⚠).

## 7 · Invariants neither stack may break

1. **Progress belongs to a class.** No surface, field, or cache keys progress by teacher
   alone. A teacher with two classes has two independent positions.
2. **`markedWeek: 0` is a state, not an error** — and it renders as the empty state
   («أين وصل هذا القسم؟» + «حدّد أين وصلت»), with no pacing, no bar, no comparison.
3. **Identity is `docKey + edition`; `transcriptionRev` is provenance** and never
   participates in any comparison (§1).
4. **Legacy subjects stay visible everywhere** (§5). `classOf` is an allow-list;
   `getOwned` is frozen.
5. **Ownership is scoped inside the query** on `classes` and `progress` exactly as on
   `subjects` — `teacherId` denormalised into both collections, never a post-hoc check.
6. **The CAS on progress `rev` is the concurrency story** — not `inflight.ts` (that
   guards ~2-minute agent loops; this is a millisecond write), not `updatedAt` (a
   millisecond timestamp is not a version token, proved at `subjects.ts:83-91`).
7. **Nothing is deleted.** No delete route, no delete button, no archive field.
8. **Switching class in `fe` is a TOTAL context switch** — clears `exam`, `subjectId`,
   `refining`, `solutions`, `subjects` — **and must NOT clear `pendingSave`**: an
   unsaved-exam intent dropped on a tab switch is precisely the silent loss the
   persistence work exists to prevent.
9. **Every new UI string is Arabic, RTL; Western digits; no red/green pacing; the word
   "AI" and any LaTeX source appear nowhere.**
10. **Additive throughout.** A `be` deploy without `fe` changes nothing a recorded
    consumer sees until the projection key lands (§5); a teacher with no classes sees
    the app exactly as today (§0).
