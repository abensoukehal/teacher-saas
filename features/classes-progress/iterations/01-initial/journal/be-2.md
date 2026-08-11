# be-2 — journal · progress: the read synthesizes, the write compare-and-sets

Implementer: `be` stack agent. Lane slot 8 (`be` :9800, log `/tmp/teacher-backend.s8.log`).
Budget: 12 iterations. **Used: 2.**

---

## Pre-flight (runtime gate) — PASS

Re-ran the sub-issue's Ground-truth commands against the live lane before writing a line.

| probe | recorded | observed 2026-08-11 | verdict |
|---|---|---|---|
| `curl -o /dev/null -w '%{http_code}' $CHAR_BE_URL/api/progress` | `404` | `404` | match |
| `curl $CHAR_BE_URL/api/progress/<24hex>` | — | `404 {"type":"not_found"}` (the app's own catch-all) | no route exists |
| `db.getCollectionNames()` | no `progress` | `teachers solutions subjects programme_revisions classes exercise_revisions programmes` | match |
| `db.progress.countDocuments()` | — | `0` | nothing to inherit |
| every stream resolves to a CURRENT programme | be-1's `getProgrammeForStream` | all six resolve; `totals.weeks: 27` on every one | match |
| baseline gate | be-1 green | `gate PASS`, 47/47 | match |

The six resolutions were recorded whole rather than counted, because the identity fields
this sub-issue stamps come out of them:

```
آداب وفلسفة    -> tadarroj-3as-lettres  2022-09  weeks 27  transcriptionRev 1
لغات أجنبية    -> tadarroj-3as-lettres  2022-09  weeks 27  transcriptionRev 1   ← one document, two streams
تسيير واقتصاد  -> tadarroj-3as-gestion  2022-09  weeks 27  transcriptionRev 2
تقني رياضي     -> tadarroj-3as-techmath 2022-09  weeks 27  transcriptionRev 4
شعبة الرياضيات -> tadarroj-3as-math     2022-09  weeks 27  transcriptionRev 4
علوم تجريبية   -> tadarroj-3as-sciences 2022-09  weeks 27  transcriptionRev 3
```

Note the two `transcriptionRev` values that differ between documents on the same
`edition`. That is the contract §1 distinction made visible: same ministry version,
different corrections to our own reading. Nothing may compare on it.

Sub-issue is loop-ready. Proceeding.

---

## Cycle 1 — the oracle, then the two surfaces

**Oracle first, then frozen.** `features/classes-progress/tests/be/progress.characterization.test.js`,
**97 clauses / 144 test cases**, committed at `55144d2` BEFORE any source existed. Red as
written: **78 failed, 66 passed** (the 66 are be-1's 47 plus the gate and perimeter clauses
that pass without a route existing). Lane and log come from `CHAR_BE_URL` / `CHAR_BE_LOG`;
no port appears in the file.

Three decisions were made while writing the suite, because a frozen oracle has to state
them before the implementation can be judged against them:

1. **The bounds clauses read `programme.totalWeeks` off the response under test**, never
   the constant. `RECORDED_TOTAL_WEEKS = 27` appears exactly once, in a guard clause that
   compares it to `db.programmes.distinct("totals.weeks")`. The SEED flagged the hazard of
   a service hardcoding 27; a suite that hardcoded it too would have certified the bug.
2. **The re-stamp clause moves the class's own stream underneath the document** —
   `db.classes.updateOne({_id}, {$set: {stream: "علوم تجريبية"}})` after the first write —
   and then asserts the stamped identity is unchanged while the GET's live `programme`
   block follows the new stream. Without that mutation, "identity is written once" is
   unfalsifiable: every write would resolve the same document anyway.
3. **The 404 probe matrix uses the caller's OWN class id, uppercased.** Hex is
   case-insensitive to `ObjectId`, so that is the one cell that can only pass if the route
   refuses a non-canonical id itself.

**Built:**

- `src/store/progress.ts` — NEW. `get` / `write` / `emptyRecord`, field-explicit
  `toRecord`, indexes `{classId:1}` UNIQUE and `{teacherId:1}`.
- `src/routes/progress.ts` — NEW. `GET` + `PUT /api/progress/:classId` behind
  `requireTeacher` on the prefix.
- `src/app.ts` — mount + one entry in the `/api` index. Three hunks, nothing else.

`tsc --noEmit` clean. `tools/dev restart be` → healthy on :9800.

**Result: 143 passed, 1 failed, 144 total.**

### The design question the CAS actually turned on

The sub-issue's stop-condition was "if CAS-without-retry cannot be made atomic with the
entry upsert in one update". It can, and the shape is worth recording because the obvious
implementation is wrong twice over.

A read-modify-write — read `rev`, compare, write `rev + 1` — opens a window between the
read and the write in which a second writer lands. That is precisely the interleaving the
compare-and-set exists to refuse, so the comparison has to BE the filter of the write.
That much is `replaceExercise`'s lesson already.

What is new here is that the write is not a scalar `$set`: `entries` has to be upserted by
week, which classic update operators cannot express conditionally (there is no "replace the
element with this key, else push"). An **aggregation-pipeline update** buys it —
`$concatArrays[$filter(entries, week != w), [entry]]` — and in the same operation carries
the `$ifNull` identity stamp and the lazy insert. One round trip, one atomic operation,
four jobs.

Then `rev: 0` had to be split out, and this is the part that would have shipped as a hole:

- **`rev === 0`** means "I believe there is no document". No stored document ever carries
  rev 0 (the insert writes 1), so the filter cannot match and `upsert: true` always fires —
  inserting when the class has no position, and hitting the unique `{classId: 1}` index
  when it does. `MongoServerError 11000` is caught and mapped to the same `RevConflict` a
  CAS loss raises.
- **`rev >= 1`** compares with **`upsert: false`**. With upsert on, a caller naming
  `rev: 7` against a class with no document would have that 7 seeded into the inserted
  document from the filter's equality fields, and then `$inc`-ed — conjuring a position at
  a version of the caller's own choosing. Off, matched-zero is a conflict, full stop. The
  suite pins it: `rev > 0 against a class with NO document -> 409, and creates nothing`.

**No retry**, per contract §0, and the reason is not laziness: `replaceExercise` retries
five times because a refine merges ONE exercise into whatever the latest document is, so
the intent survives a rebase. A progress write is whole-state intent over what the teacher
was LOOKING AT. If `rev` moved, that view is gone and a retry would silently overwrite
someone else's position with a decision made about a different one.

### The one failure was a real design correction, not a mechanical fix

```
● a client-supplied completedAt is IGNORED — the server stamps it
  TypeError: Cannot read properties of undefined (reading 'entries')
```

The route validated `entry`'s keys against an allow-list of `{week, status, note}` and
answered `400` to anything else — so an entry carrying `completedAt` was refused, and the
clause asserting the value is *ignored* never got a `progress` object to read.

The oracle was right and the implementation was wrong. `completedAt` is a key of the entry
a client just READ; refusing a client that echoes back our own shape is hostile, and it
would have made "load a week, edit the note, save it" fail for `fe` in slice 2. Fixed in
the route, not the suite: `completedAt` joins `ENTRY_KEYS` and its **value is still
discarded** — the server stamps it, and only for a `done` entry. The neighbouring clause
(`an entry carrying an unknown key -> 400`, probed with `teacherId`) still holds, so the
allow-list is still an allow-list.

**Result: 144 passed, 144 total. `gate PASS`.**

---

## The concurrency evidence

The sub-issue's heart, and a CAS suite that never actually races proves nothing — so the
suite dispatches every request before awaiting any of them, and the drill was also run by
hand at a width the suite does not use, to check the shape holds beyond N=5.

**By hand, 8 concurrent writers, twice** (`scratchpad/race.mjs`, against lane 8):

```
== 8 concurrent FIRST writes (rev 0) ==
200/7ms 409/8ms 409/7ms 409/7ms 409/8ms 409/13ms 409/13ms 409/12ms
200s: 1  409s: 7

== 8 concurrent writes at rev 1 ==
200/4ms 409/7ms 409/6ms 409/6ms 409/7ms 409/6ms 409/7ms 409/8ms
200s: 1  409s: 7
winner markedWeek: 9  rev: 2
stored: {"markedWeek":9,"rev":2,"programmeDocKey":"tadarroj-3as-math",
         "programmeEdition":"2022-09","programmeTranscriptionRev":4}
```

Exactly one winner per round in both the **insert** race (unique-index tiebreak) and the
**CAS** race (filter tiebreak); `rev` advanced exactly once per round; the stored
`markedWeek` is one writer's value whole, never a blend. **4–13 ms** — a five-attempt
retry loop would not look like that, which is the closest thing to an executable proof
that no retry is happening.

**And the log told the truth about all sixteen:**

```
total: 16   Counter({'cas_loss': 14, 'win': 2})   distinct correlationIds: 16
{"msg":"progress.write","event":"progress.write","classId":"6a7a…c096","week":1,"rev":1,
 "outcome":"win","correlationId":"a4542dda-…","teacher":"6c1e0639"}
{"msg":"progress.write","event":"progress.write","classId":"6a7a…c096","week":4,"rev":0,
 "outcome":"cas_loss","correlationId":"fdd9405d-…","teacher":"6c1e0639"}
…
any full 32-hex teacher? False
```

One line per request, sixteen distinct correlation ids, two wins and fourteen losses. This
is why be-1 ran first: from outside, "the compare-and-set did its job" and "a write
vanished" are the same 409, and without the line an operator cannot tell them apart. On a
loss the logged `rev` is the version the CALLER believed in — the useful half.

In the suite the same drill runs at N=5 and asserts the win line's `correlationId` equals
the 200's, and the four `cas_loss` ids equal the four 409s' ids as a set. Rejected writes
(`400`, `404`) and every `GET` log nothing: the line means a write was DECIDED.

Test data was removed from `progress`, `classes` and `teachers` afterwards
(`progress left: 0`, `classes left: 0`).

---

## Done-protocol

| rung | outcome |
|---|---|
| oracle green ×2 | **PASS** — `144/144` twice, `gate PASS`, no flake |
| perimeter differential vs SEED §2 | **PASS** — see below |
| freeze audit | **PASS** — `git status --short --` on every frozen path is empty |
| `tools/ci be --slug classes-progress` from the be worktree, all suites | **PASS** — `2 passed, 2 total`, 144 ran, 0 skipped |
| journal sealed | this file |

**Perimeter differential**, measured against the SEED §2 recordings:

| recorded | now | verdict |
|---|---|---|
| `/api` lists 10 routes (9 recorded + be-1's `/api/classes`) | 11 — the same 10 plus `/api/progress` | grew by exactly one, lost nothing |
| `401` body on `/api/subjects` | `{"message":"مطلوب تسجيل الدخول","type":"teacher_required"}` | unchanged, and byte-identical on `/api/classes` and `/api/progress/:id` |
| `toSummary` keys | `costUsd createdAt durationMs exerciseCount genCorrelationId id title topic totalPoints updatedAt` | unchanged — **no `classId`**, which is be-3's |
| `toRecord` keys | `correlationId costUsd createdAt durationMs genCorrelationId id subject updatedAt` | unchanged — **no `classId`** |
| `/health` | `status: ok`, keys `authRateLimit claude env fanout service status store` | unchanged |
| be-1's oracle | 47/47 | green, file untouched |

**Freeze audit**, verbatim:

```
$ git status --short -- src/store/classes.ts src/routes/classes.ts \
      src/store/programmes.ts src/inflight.ts src/store/subjects.ts \
      src/teacher.ts src/routes/subjects.ts
[empty]

$ git status --short
 M src/app.ts          ← mount + one /api index entry, 3 hunks
?? src/routes/progress.ts
?? src/store/progress.ts
```

`src/inflight.ts` was never opened. A progress PUT measured 4–13 ms; the thing `inflight`
guards is a ~110 s agent loop, and the sub-issue named reaching for it a stop condition
rather than a variation.

---

## Decisions this sub-issue did not settle

Recorded rather than smuggled, because each one is now pinned by a frozen oracle and the
next slice inherits it.

1. **`programmeTranscriptionRev` is on the wire, and the synthesized shape carries it as
   `null`.** Contract §4's example block lists six progress keys and omits it; §4's prose
   says a stored document returns "fields as in §1", and §1 names three. The sub-issue
   requires it stamped and read back verbatim, so it had to be on the wire somewhere. It
   is carried in BOTH shapes so the key set never changes: a key that appeared only after
   the first write would make `fe` branch on which of two shapes it received, and the
   branch it forgot would be the empty one — the state every class starts in. `fe`'s
   declared `Progress` type (fe.md:65) omits it, which is fine: it is an extra key on a
   fetched object, and provenance is not something the UI has any business comparing.
2. **A non-canonical class id is refused at the route, not at the store.**
   `ObjectId.isValid` accepts uppercase hex, so `getOwned` — frozen, be-1's — would resolve
   an uppercased id to the same class through a spelling this product does not use. The
   route requires `/^[0-9a-f]{24}$/` before the store sees anything, which keeps
   `teacher.ts:19`'s case-sensitivity discipline whole and pre-satisfies be-5's uppercase
   probe cell without touching a frozen file.
3. **`entries` are returned week-ASCENDING.** The upsert appends, so insertion order is
   whatever order the teacher happened to click in. Sorting on the way out means `fe` never
   sorts and two clients never disagree about the order of the same data. Not contractual;
   now pinned.
4. **Validation order is: body shape → class → programme → bounds.** Bounds cannot be
   checked before the class resolves (the limit is that class's own `totals.weeks`), so the
   404 probes in the suite all carry a VALID body — the clause is about the address, not
   the payload. be-5's probe matrix should keep that discipline for the same reason.
5. **`completedAt` is accepted and discarded** (see cycle 1). The alternative — refusing
   it — breaks any client that round-trips an entry it just read.
6. **Not tested: the `500` for a class whose stream stops resolving** (contract §4). It is
   implemented and commented, but making it executable means mutating the `programmes`
   corpus, and the corpus drifting is this sub-issue's ask-when rather than a fixture.
