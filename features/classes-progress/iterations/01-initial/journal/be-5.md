# be-5 — journal · the perimeter drill: probes, abuse, and log truth under fire

Implementer: `be` stack agent. Lane slot 8 (`be` :9800, log `/tmp/teacher-backend.s8.log`).
Budget: 10 iterations. **Used: 1.**

**Zero source files changed.** be-5 is a hardening/probe sub-issue over surfaces be-1..be-4
already built and froze; its whole product is one frozen oracle. The Delta permitted
tightening validation inside `routes/classes.ts` · `routes/progress.ts` · `routes/subjects.ts`,
and nothing needed tightening — every probe the sub-issue names already behaves. A defect
would have been a stop-and-ask, not an edit; none was found.

---

## Deviation to record up front — the oracle's filename

The sub-issue's Oracle slot names `perimeter.characterization.test.js`. The implement task
that launched this run named `hardening.characterization.test.js`. Both match the gate's
`**/*.characterization.test.js` and live in the same WF-53 directory, so nothing depends on
the choice — I followed the launching instruction and am recording the divergence rather
than picking silently. Rename it if the plan's name is the one that should survive.

---

## Pre-flight (runtime gate) — PASS

Re-ran be-5's Ground truth against the live lane before writing a line. The sub-issue's
ground truth is *other people's green*, so the pre-flight is the recorded pins made to fire
again rather than a baseline to be broken.

| probe | recorded | observed 2026-08-11 | verdict |
|---|---|---|---|
| be-1..be-4 oracles | 47 · 97 · 48 · 52 green | 244/244 green, unmodified | match |
| malformed body still carries `correlationId` | middleware BEFORE the body parser | `400 invalid_request` + `correlationId` | match |
| `429` is auth-only | limiter on signup/signin/recover only | 11 rapid `POST /api/classes` → **eleven 201s**, no 429 | match |
| `teacher.rejected` logs a prefix | 8 chars | 8 chars — but under key **`teacherIdPrefix`**, not `teacher` | match, see note 2 |
| the 15-cell 404 matrix | contract §6 | **all fifteen byte-identical** | match |
| the five-writer drill | SEED §5 | 1 × `win`, 4 × `cas_loss`, 8-char prefixes, no 32-hex | match |

The probe teachers and their classes were removed by owner after the read. Sub-issue was
loop-ready with no ambiguity to resolve.

---

## Cycle 1 — the oracle, written from the probes

`features/classes-progress/tests/be/hardening.characterization.test.js`, **99 clauses**.
Green ×2 standalone; `tools/ci be --slug classes-progress` from the be worktree reports
**343/343 across five suites** — 47 + 97 + 48 + 52 + 99, every prior suite at its exact
recorded count.

Two bugs surfaced on the first run and both were **in the suite, not the service**: this
jest does not take a second message argument to `expect()`, and I had guessed the
`teacher.rejected` prefix key. Both fixed in the oracle; neither was a product finding.

### The four decisions taken while writing it

1. **Byte-parity is compared on the RAW response text, not on a re-serialised object.**
   `JSON.parse` → `JSON.stringify` normalises key order and whitespace, which is precisely
   the difference a caller would see and the comparison would hide. Every cell masks only
   `"correlationId":"…"` and compares the remaining bytes.

2. **The matrix is anchored to a literal, not only to itself.** Fifteen cells agreeing with
   each other is satisfied by rewording all fifteen at once. One clause asserts the
   canonical body equals the recorded string, so a change to the message, the type, the key
   order or the whitespace turns the matrix red even when it stays internally consistent.

3. **Two clauses exist to stop the matrix passing vacuously.** A service that answered 404
   to *every* id — including real ones — would satisfy all fifteen cells. So: the owned
   class must answer `200`, and the fifteen numeric-abuse `400`s are followed by a re-read
   proving the class is still at week 0 / rev 0. A rejection that nevertheless wrote would
   be a worse defect than the 500 the sub-issue is hunting.

4. **Cleanup is by owner, unconditionally.** Deleting from `classes` · `progress` ·
   `subjects` · `teachers` on `{teacherId: {$in: MINTED_TEACHERS}}`. The tracked-id list
   the earlier suites use only ever learns about the 201s, and — the sharper problem — an
   assertion that fails mid-test aborts *before* the push, so tracking is least reliable
   exactly when the suite left the most behind. Verified: collection counts are identical
   before and after a full run. **Zero orphans.**

---

## The 404 byte-parity matrix — the centre of this sub-issue

Five id shapes × three surfaces. Every cell `404 class_not_found`, and every cell's body
byte-identical to
`{"error":{"message":"القسم غير موجود","type":"class_not_found"},"correlationId":"<CID>"}`.

| id shape | `GET /api/progress/:id` | `PUT /api/progress/:id` | `POST /api/subjects` classId |
|---|---|---|---|
| well-formed but nonexistent | identical | identical | identical |
| malformed non-hex | identical | identical | identical |
| 12-char hex | identical | identical | identical |
| **another teacher's real class** | identical | identical | identical |
| **UPPERCASE of a real owned id** | identical | identical | identical |

The two bold rows are the ones that matter. A foreign class that answered differently would
be an oracle for other teachers' class ids; and the uppercase row holds only because both
route files test `/^[0-9a-f]{24}$/` **before** the store — `ObjectId.isValid` accepts
uppercase, so without that regex an uppercased id would resolve to a real class through a
spelling this product does not use.

Also pinned, because the status codes are half the leak: a malformed id and an unowned one
must not be told apart by **status** either. Contract §6 says so explicitly, and 400 is the
intuitive answer for a bad shape — "400 means never real, 404 means real and not yours" is
a complete existence oracle built out of two status codes.

### The one cell that is NOT class_not_found — recorded, not forced

An **absent** id segment (`GET /api/progress/`) is a **route-level** `404 not_found` from
the service's catch-all (`src/app.ts:209-211`), not `class_not_found`. It never reaches the
class surfaces at all. That is not a parity hole: §6 protects the property that an answer
cannot vary with whether a class exists, and this answer is identical for a teacher who owns
a class and one who does not — pinned as its own clause.

**Recorded, deliberately not fixed:** that catch-all carries **no `correlationId`**. It
predates this whole job (the scaffold commit `fd122fc`), applies to every unknown path in
the service, and is outside be-5's Delta. It is now an executable pin, so closing it is a
deliberate change that turns a clause red on purpose rather than drift.

---

## Abuse inputs — 400/404/413, never a 500

Four NoSQL shapes (`{$ne:null}` · `{$exists:true}` · `{$regex:".*"}` · array-wrapped) × nine
string-bearing fields, one clause per pair (WF-70): `classes.name` · `classes.stream` ·
`subjects.classId` · `progress.rev` · `progress.markedWeek` · `entry.week` · `entry.status` ·
`entry.note` · `teacher/school.school`. Plus the query-string form
(`?classId[$ne]=null`, which Express parses into an object) and an operator-shaped
`x-teacher-id`.

Every probe is asserted on **all** of: status ∈ {400, 404, 413} · a classified `error.type`
from the contract's table · a non-empty `correlationId` · and the raw body matching none of
`MongoError|MongoServerError|E11000|BSONError|\.ts:\d+|at Object\.|node_modules|"stack"`.
Asserting only the status is how a 400 that leaks a Mongo message passes a gate.

Nothing reaches the datastore as an operator. Each field is type-checked at its route
boundary before any query is built, so the injection shapes die as `invalid_request` — and
the `x-teacher-id` case dies at `requireTeacher`'s regex as `401 teacher_required`, which
matters most of all: that header is the join key, and as an object it would match every
teacher's rows at once.

Over-length and oversized: 10 KB name / note / school → `400`; a 2 MB body → `413
payload_too_large`. Both bounds are also pinned **exactly** (80 and 120 accepted, 81 and 121
refused) so a bound that silently moves is caught — the over-length clauses alone would pass
against a service that refused everything.

Malformed JSON on all four new POST/PUT surfaces → `400` **with** a `correlationId`. And one
clause proves the parse-before-route ordering is not itself an oracle: a malformed body
returns a byte-identical answer for an owned class, a nonexistent one and outright garbage.
`NaN` and `Infinity` are pinned as malformed JSON rather than numbers — a `NaN` markedWeek
passes both `> totalWeeks` and `< 0`, so it would sail through the bounds check if it ever
parsed.

---

## The five-writer CAS drill — the log is the oracle

Five concurrent `PUT`s, same class, all claiming `rev: 0`, each asking for a **different**
week so the stored document identifies its own winner. Result: **one 200, four `409
conflict`**, and in `CHAR_BE_LOG`:

```
outcome=win       rev=1 week=2 teacher=97311443 cid=<nonce>-2
outcome=cas_loss  rev=0 week=1 teacher=97311443 cid=<nonce>-1
outcome=cas_loss  rev=0 week=4 teacher=97311443 cid=<nonce>-4
outcome=cas_loss  rev=0 week=3 teacher=97311443 cid=<nonce>-3
outcome=cas_loss  rev=0 week=5 teacher=97311443 cid=<nonce>-5
```

Asserted: exactly five lines · exactly one `win` and four `cas_loss` · five **distinct**
correlationIds equal as a set to the five sent · the winning **line** belongs to the winning
**response** (not merely to one of the five) · each loser logs the rev it *believed in* (0) ·
`teacher` is 8 chars and equals `teacherId.slice(0,8)` · no `teacherId` key · and **zero
32-hex runs of any kind** in any line. The stored document: exactly one, `rev: 1`,
`markedWeek` = the winner's week, and `GET` agrees with the collection.

Five 409s prove only that the callers were refused. The log is the sole thing that
distinguishes "the compare-and-set did its job" from "four writes vanished" — from outside,
those are the same 409. That is why be-1 ran first (SEED §5), and this is the clause that
cashes it.

---

## The no-rate-limit posture, pinned honestly

Three clauses record the **current state**: 11 rapid `POST /api/classes` → all 201; 11 rapid
`GET /api/progress` → all 200; 11 rapid `PUT /api/teacher/school` → all 200. No 429 on any
new surface.

A fourth asserts the limiter **still exists for auth**, read through `/health.authRateLimit`
rather than by draining a bucket — these suites share one service on the lane (WF-84), and a
suite that exhausts the signin bucket breaks a sibling in a way that looks like a product bug
and is not.

So the pin is "auth is limited, these are not", not "nothing is limited". **No rate limiting
was added** — the Delta forbids it and it is a product decision, not a hardening freebie
(contract §6, project/CLAUDE.md ⚠). What the pin buys: the day someone adds a limiter here it
is a deliberate contract change that turns these clauses red, rather than drift nobody
notices until `fe` starts receiving 429s it has no branch to render.

---

## Freeze audit

`git status --short` in the be worktree: **empty**. `git diff --stat HEAD`: **empty**. The
explicit check over every be-1..be-4 file — `store/classes.ts` · `routes/classes.ts` ·
`store/progress.ts` · `routes/progress.ts` · `store/programmes.ts` · `store/subjects.ts` ·
`routes/subjects.ts` · `store/teachers.ts` · `routes/auth.ts` · `mutationlog.ts` · `app.ts` ·
`teacher.ts` · `inflight.ts` · `ratelimit.ts` — all clean. The four prior oracles ran
unmodified at 47 · 97 · 48 · 52.

---

## Exit protocol — MET

- oracle green ×2 — 99/99, twice
- be-1..be-3 (and be-4) oracles green, unmodified — 47 · 97 · 48 · 52
- `tools/ci be --slug classes-progress` from the be worktree — **gate PASS, 343/343**
- freeze paths clean — zero source changes
- budget: 1 of 10 iterations

---

## What be-5 did NOT settle

1. **The catch-all 404 has no `correlationId`.** `src/app.ts:209-211`, present since the
   scaffold commit and true for every unknown path in the service — not just the class
   routes. It is now pinned as current behaviour. Whether an unroutable request deserves a
   traceable answer is a real question this sub-issue had no mandate to decide.

2. **Two key names for one concept in the logs.** `teacher.rejected` writes
   `teacherIdPrefix`; `mutationlog.ts` writes `teacher`. Both are prefix-only, so the bearer
   discipline holds and nothing leaks — but an operator grepping one name will not find the
   other. Both are pinned rather than assumed identical. Worth one convention.

3. **The bearer posture itself is untouched and untestable from here.** `teacherId` is still
   a bearer value with no rotation and no expiry; whoever holds one reads that teacher's
   classes and progress. Every clause above verifies that the *perimeter* leaks nothing to
   someone **without** an id. None of it helps against someone **with** one. That is the
   inherited gap (project/CLAUDE.md ⚠), and a rotating session is a separate job.

4. **`entry` is contractual but has no client.** Slice 1's `fe` only ever sends
   `markedWeek`. Every `entry` clause here — and be-2's — exercises a surface no product
   code calls until the slice-2 tracker lands. Pinned early on purpose; worth re-reading
   against the real tracker rather than assuming the tests defined it correctly.

5. **Standing test pollution from earlier sub-issues, NOT from this one.** The lane database
   carries **2 orphan classes, 1 orphan progress document and ~416 subjects above the SEED's
   recorded 8,423 baseline** — residue from be-1..be-3 runs whose cleanup tracked ids rather
   than owners. This suite adds none (counts verified identical before and after a full
   run), and it did not clean up the earlier residue either: that is not in its Delta, and
   the SEED's `8,423` recording is now stale as a live number. Someone should decide whether
   to purge it before the recorded baseline is quoted again.

## review

**Verdict: approve.** Cross-model review (Fable). This journal's central claim was the
spot-audited one (protocol ⑥): I re-ran the 404 byte-parity matrix live with my own
teachers — foreign class, unknown well-formed id, garbage id, UPPERCASE of an owned id,
on GET and PUT progress and on POST subjects' classId. **All byte-identical modulo
correlationId, all 404, and the owned class still answered 200** (anti-vacuity). The
matrix holds exactly as recorded.

Also re-verified: malformed 2 MB body → Arabic `413 payload_too_large`; malformed JSON →
Arabic 400 with correlationId; no Mongo/stack leakage in any refusal body I provoked.
The timing surface is clean where it matters: foreign-vs-nonexistent both cost one
`findOne` miss; only the malformed shape short-circuits, and it reveals nothing.
