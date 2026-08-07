# QA — job `persistence`, iteration `01-initial`

Adversarial pass against the locked SEED, run on the live lane (be :9200, fe :10200)
with a **real** generation, not fixtures.

## Acceptance — the SEED's "done when"

> *A teacher generates a subject, refines an exercise, closes the tab, comes back,
> and finds it — with every exercise intact and refinable exactly as before.*

Executed end to end against the running stack, 2026-08-08:

| step | evidence |
|---|---|
| real generation | `POST /api/generate` → **HTTP 200 in 125.4 s**, 2 exercises `ex1,ex2`, envelope `{text,data,sessionId,costUsd,durationMs,correlationId}` |
| persist it | `POST /api/subjects` → `201`, id `6a7664b39c8cef081b94ede3` |
| **generate a second** | `201`, id `…ede4` — **a different record** |
| **the first still exists** | `GET /api/subjects/…ede3` → `200`, title + 2 exercises intact |
| refine in place | `PUT …/exercises/ex1` → `200`, array still length 2, `ex1` replaced |
| list | `200`, **2** subjects, ordered by `updatedAt` desc, `"statement"` absent from the body |

**Verdict: the SEED's acceptance holds.** The defect it was written against — a
second exam destroying the first — cannot be reproduced.

## Bugs found and fixed in this pass

**QA-1 · A failed identity bootstrap silently discarded every save. (fixed)**

`onGenerate` read `if (!teacherId) return;`. Identity is issued by one request at
boot; if that request fails — a network blip is enough — `teacherId` stays `null`
for the whole session, and from then on **every** generation returns, renders, and
is never stored. No error, no indicator, nothing in the UI to notice.

That is the same silent-loss failure this job exists to remove, reintroduced one
layer up, and it defeats `fe-4` (the save indicator never fires because the write
is never attempted). Severity: high — it costs a teacher a 125-second, $0.65 exam
and tells them nothing.

Fix: `ensureTeacher()` recovers identity lazily at write time instead of assuming
boot succeeded. Pinned by
`tests/fe/save-state.characterization.test.tsx` → *"if boot identity fails,
generating still saves"*, which fails against the previous code.

**QA-2 · `503 store_unavailable` was implemented but never asserted on a real
route. (fixed)**

`be-1` deferred that assertion to `be-3` (the Delta at `be-1` contains no routes),
and `be-3`'s suite never picked it up — a promise made in the spec and dropped.
Probed live against an instance pointed at a dead Mongo: all four store-touching
routes return `503` with `type: "store_unavailable"`, not a bare `500`, and
`POST /api/teacher` still works (identity needs no database). Now pinned by three
tests in `tests/be/subjects-api.characterization.test.js`, including that a failed
connection is **not** cached — one blip must not leave the process permanently
unable to reach a recovered database.

## Probed and found correct (no bug)

- **List ordering.** The list appeared to show an older subject first; it is
  ordered by `updatedAt`, and refining the first subject legitimately bumped it.
  Correct, not a regression.
- **Ownership is not probeable.** A foreign subject and an absent one return
  byte-identical bodies (modulo `correlationId`), while the document demonstrably
  still exists for its owner.
- **`replaceExercise` never appends.** Unknown id → `409`, and a follow-up read
  proves the array length is unchanged. Exercised for `ex1`/`ex2`/`ex3` — the ends
  of the array are where positional bugs hide.
- **Arabic + LaTeX survive the round trip byte-identically** (`JSON.stringify`
  equality against the recorded payload, not a field walk).
- **The run log still carries no teacher content** — no Arabic, no `statement`, no
  `title`, no `$`, on any line written by this job.
- **Frozen perimeter intact.** A real generation after all changes returns the
  unchanged envelope; `/api/skills` still lists exactly the two capabilities;
  `spliceExercise` still throws on an unknown id.
- **Storage failures are still swallowed client-side** — the app renders even when
  `localStorage` throws on `getItem`/`setItem`/`removeItem`.

## Known limitations — deliberate, recorded, NOT bugs

- **The teacher id is a bearer value.** Whoever holds it can read that teacher's
  subjects. Accepted in SEED → Risks for a two-teacher test on exam drafts (not
  student records). It must not silently become the auth model.
- **`error.detail` leaks the connection target** on a store failure (e.g.
  `connect ECONNREFUSED 127.0.0.1:1`). Mirrors the existing `ClaudeError.detail`
  behaviour, so it is consistent rather than new — but it is a disclosure to close
  before any public deploy.
- **Cost-per-subject is still unjoinable.** `recordSubjectLink` answers *refines
  per exam*, but tying a subject to the generation's cost needs the generate
  `correlationId`, which `generateExam` discards. Flagged in `stacks/be.md` → be-4
  rather than half-built.
- **Concurrent edits from two tabs** are last-write-wins. Parked in SEED kit §6
  pending evidence that teachers do this.
- **No offline queue.** A failed save offers retry; it does not persist the attempt
  across a reload. The exam remains in the local paint cache.

## Gates at seal

```
tools/ci be --slug persistence   → 44 passed, 3 suites
tools/ci fe --slug persistence   → 46 passed, 4 suites
```

Both were RED at provision (WF-68 no-op gate, correctly — the job had no suite).
