# be-4 — regenerate one exercise on demand

**status:** done · **tag:** hardening · **cycles used:** 3 of 8

## What changed

`stacks/teacher-be`, commit `e25bd29`:

| file | change |
|---|---|
| `src/routes/subjects.ts` | `POST /subjects/:id/exercises/:exerciseId/regenerate`, plus the in-flight guard |
| `src/routes/exams.ts` | `generateSlot` gains `onGiveUp: "mark" \| "keep"`; `regenerateOne` passes it through |

The route lives in `subjects.ts` because ownership must be scoped by the same guard and
answered with the same not-found body as every sibling route; the generation itself is
be-3's engine, unchanged.

**The assignment is reconstructed, not stored.** The exercise already carries `id`,
`label`, `points`, `difficulty` and its topic, and `avoid` is derived from the *sibling*
exercises' topics — which is fresher than a stored plan would be after a few refines, and
keeps the `subjects` document shape frozen apart from `status`.

## What the oracle asserts

`features/parallel-exercises/tests/be/regenerate.characterization.test.js` — 16 clauses.

**A `failed` exercise** fills the same slot in place and in order, `ready` with a real
statement, `id`/`label`/`points` unchanged, the exam still summing to 20, the other
exercises untouched, and **no** revision row.

**A `ready` exercise** DOES write a revision — the deliberate contrast — and the archived
pre-image is the exact statement that was there. Slot refreshed, assignment preserved.

**The negative surface.** An unknown `exerciseId`, another teacher's subject and a ghost
id all return the **identical** 404 body; another teacher's attempt leaves `rev` absent
(nothing was written); no header is `401 teacher_required`; a malformed subject id is the
same 404, never a 500.

**Two concurrent regenerates** of one exercise: one 200, one `409 conflict` with an Arabic
message, exactly one revision, `rev === 1`. Two *different* exercises in the same exam both
succeed (`rev === 2`) — the guard is per exercise, not per exam. And the guard releases: a
second regenerate afterwards still works, so a leaked key cannot lock an exercise until
restart.

**The whole journey**, end to end on `trunc-ex1-first2`: a fan-out lands
`["failed","ready","ready"]`, the teacher regenerates the hole, it repairs to all-`ready`
summing to 20 with no revision written, in exactly one more attempt than the fan-out had
already spent (3 total).

### Mutation spot-checks

| mutation | result |
|---|---|
| `onGiveUp` always `"mark"` | **2 clauses red** — the ready exercise gets blanked |
| drop the in-flight guard | **1 clause red** — both regenerates land, no 409 |

## Decisions the contract did not cover

1. **A failed regeneration must not destroy a `ready` exercise.** This is the one thing I
   added beyond the sub-issue, and it is the clause I would defend hardest. Reusing be-3's
   engine unmodified would have marked the slot `failed` — blanking real, teacher-visible
   work because one draw went wrong. The revision makes it *recoverable*, but only if the
   teacher notices and knows where to look. So `onGiveUp: "keep"` when the outgoing
   exercise is `ready`, and the request answers **`502 claude_bad_output`** rather than a
   200 with the same exercise back: the teacher asked for something that did not happen,
   and a 200 there is the product pretending it did the work. Contract §3's "a malformed
   generation is not an error response" is about an exam whose *other* exercises succeeded,
   which is not this case.

2. **The 409 comes from an in-flight guard, not from the CAS.** With only two writers the
   CAS never exhausts its five attempts — the loser re-reads and wins — so both
   regenerations would land, one immediately superseding the other: two full agent loops,
   ~2 minutes, for a result the teacher never sees. Refusing the second *before it spawns*
   is cheaper and more truthful, and `409 conflict` already means exactly this ("جارٍ تعديل
   هذا التمرين"). It is in-process and additional; the CAS is still the correctness
   mechanism underneath.

3. **The 404 bodies are identical** for "no such exercise", "not yours" and "no such
   subject". The sub-issue asked for "the same 404". A distinguishable body would leak
   nothing (you already own the subject to see it), but identical is the conservative
   direction and it is what the oracle text asked for.

4. **No new error types.** `502 claude_bad_output`, `409 conflict`, `404
   subject_not_found`, `401 teacher_required` — all pre-existing, per contract §3.

5. **Synchronous.** Contract §2 says it returns the updated subject, so the request blocks
   for the generation (~60 s). Unlike `POST /api/exams` there is nothing to show in the
   meantime — the teacher is waiting on this one exercise.

## Exit protocol

- oracle green ×2 — 105/105, twice
- the 409 path exercised, and the guard's release proved
- journal sealed
