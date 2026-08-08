# be-2 — recovery, and teaching `requireTeacher` to reject

**Closed 2026-08-08.** Oracle 28/28 ×2, promoted net 44/44, freeze clean, mutations caught.

> Same protocol deviation as `be-1`: no subagents, so implementation and verification
> shared one context. Everything is mechanically verified; the double-blind property is
> absent.

## Pre-flight

```
$ curl -s -H "x-teacher-id: <fresh 32hex>" localhost:9300/api/subjects
{"subjects":[],"correlationId":"…"}      # 200 — an id we never issued is ACCEPTED
```
Reproduced. That is the behaviour this sub-issue supersedes.

## The stop-and-ask

Implementation immediately hit a contract ambiguity the plan had not resolved.

"Reject an id that was never issued" sounded simple. But **`POST /api/teacher` issues ids
without recording them**, so the strict reading meant:

- **159** distinct teacherIds own subjects; only 42 had rows. ~117 would be locked out —
  including every real one. Gap #1 again, caused by its own fix.
- the promoted regression net gets a teacher via `POST /api/teacher` → every test 401s
- `fe` still calls `issueTeacher()` (`App.tsx:86,138`) until `fe-1` ships

Stopped and asked. Decisions taken (recorded in the contract's "anonymous teachers"
amendment):

1. **"Issued" means minted AND recorded.** `POST /api/teacher` writes an anonymous row;
   a one-time backfill covers the pre-existing ids.
2. **Sign-up adopts an unclaimed `x-teacher-id`**, so anonymous work follows a teacher
   into their account instead of being orphaned.

## Cycles

- **C1 — oracle first.** 16 clauses including the amendment's. Red before code.
- **C2 — store.** `ensureAnonymous` (idempotent `$setOnInsert` — an upsert with `$set`
  would reset `passwordHash` and silently disable a real account), `claimAnonymous`
  (filters on `email: null`, so two concurrent signups against one anonymous id cannot
  both win), `consumeRecovery` (one atomic update: verify → new password → new code).
- **C3 — the partial index.** `{email:1}` unique permits exactly ONE null, so the second
  anonymous row collided with E11000. Rebuilt as partial over `{email: {$type:"string"}}`,
  with a code-85 catch to replace the older non-partial definition in place.
- **C4 — backfill.** First `--yes` run died on that same E11000, because the script
  connects straight to Mongo and never runs the app's index path. Fixed by making the
  script reconcile the index itself: **a migration must not depend on the app having
  started first** — that ordering is invisible and fails in production at the worst
  moment. Then: 146 inserted, verified, and a re-run inserts 0.
- **C5 — reject.** `requireTeacher` looks the id up. A dead store returns
  `503 store_unavailable` via the existing error middleware, never 401 — telling a
  teacher to sign in again over a database blip would be a lie. The rejection log carries
  an **8-char prefix**, never the whole id: it is a bearer credential.

## Two declared supersessions (WF-65)

1. **`be-1`'s own pin.** It asserted "an unknown well-formed id is STILL accepted —
   rejection arrives in be-2". Its job was to stop `be-1` quietly changing
   `requireTeacher`, and it did: `be-1`'s diff never touched `src/teacher.ts`. Flipped
   here, in `be-2`'s declared scope.

2. **A promoted pin: "identity still works with the store down — it needs no database".**
   Found by running the promoted net against this lane, not by the job gate.
   `POST /api/teacher` used to return `201` with Mongo dead. Recording the id needs the
   store, and returning an *unrecorded* id would hand back a credential `requireTeacher`
   rejects on the next request. Now `503 store_unavailable`.
   **This one is product-visible and deserves review attention** — the invariant kept is
   "degrade honestly, never a bare 500", but a teacher genuinely can no longer obtain an
   identity while the store is down. Practically nothing is lost: the old 201 handed back
   an id that could not create or list a single subject.

## Done-protocol

| check | result |
|---|---|
| oracle ×2 | 28/28, 28/28 |
| promoted net vs this lane | **44/44** (needed `npm run build` first — the dead-store suite spawns `dist/index.js`) |
| freeze audit | only the widened Delta paths; `scripts/` holds `backfill-teachers.mjs` alone |
| mutation — requireTeacher accepts again | **caught**, 3 clauses |
| mutation — sign-up never adopts | **caught**, the adoption clause |
| backfill | 146 inserted · every subject owner now has a row · re-run inserts 0 |

## For the next slices

- **`be-5`'s orphan definition changed** and its spec is updated: after the backfill,
  "no `teachers` row" matches nothing. An orphan is now a subject owned by an **anonymous,
  never-claimed** row **and** older than an explicit `--before <ISO>` cutoff. Omitting the
  cutoff must delete nothing.
- **`fe-1` must send `x-teacher-id` on sign-up** when the browser already has one, or
  adoption never fires and existing anonymous teachers lose their exams at sign-up.
- `dist/` is now built in this worktree; keep it fresh if a suite spawns the server.

---

## Correction, 2026-08-08 — the atomicity claim above was WRONG

An independent verification pass refuted it. This section supersedes the "one atomic
update" wording earlier in this file.

**`consumeRecovery` was not atomic and the code was not single-use.** It filtered on
`{recoveryUsedAt: null}` while setting that same field to `null` in the same update, so
the guard guarded nothing. Four concurrent recoveries with one code all returned `200`;
three teachers were handed a fresh code that was already dead. `recoveryUsedAt` had never
been written in 1214 rows, and the branch reading it was unreachable.

Why the oracle missed it: it only replayed a consumed code **sequentially**. Single-use is
a concurrency property and was never tested as one.

**Fixed** with a real compare-and-set on `recoveryHash` — the hash rotates on every
successful consume, so exactly one concurrent writer can match it. `recoveryUsedAt` now
records *when* the last code was consumed and is explicitly not the guard. The contract
was corrected to say so.

**Now covered** by three clauses in `auth-recover.characterization.test.js`: four
simultaneous recoveries yield exactly one `200`; the winner's code actually works; and
`recoveryUsedAt` is written. Verified to have teeth — restoring the old guard fails 2 of
them.

Also fixed from the same pass: `findByTeacherId` was a dead export (removed), and
`GET /api` advertised signup and signin but not recover.
