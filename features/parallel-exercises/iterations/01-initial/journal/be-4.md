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

## review

**Verdict: approve-with-debt** — the route's own oracle surface held completely; the one
real hit is a seam this sub-issue shares with be-2's fan-out. (Cross-model REVIEW, 2026-08-09.)

**Held under attack (live probes on a replay boot):**
- Byte-identical 404s for other-teacher / ghost-subject / unknown-exercise (compared with
  correlation ids stripped — identical to the byte). No header → 401. Existence not probeable.
- The whole be-4 journey (`trunc-ex1-first2`: fan-out fails ex1 twice → teacher
  regenerates → ready in attempt 3) was ALSO walked end-to-end through the real browser
  UI — see fe-2's review. The engine composes.
- Mutation "onGiveUp always mark" and "drop the in-flight guard" both red (per journal);
  the guard's release was implicitly re-proved by back-to-back regenerates in probes.

**The hit — regenerating a slot that is still PENDING mid-fan-out is accepted (200):**
the in-flight guard only tracks *regenerates*, not the fan-out's own fills, and
`statusOf(exercise) === "pending"` maps to `onGiveUp: "mark"`, so the route happily
spawns a second writer for a slot the fan-out is actively writing. Verified by execution:
fan-out at 2.5 s delay, immediate regenerate of ex1 → both spawns ran (fake counted 2
attempts), both landed, and **one `exercise_revisions` row exists for content the teacher
never saw** — the loser's ready version was archived as "superseded teacher-visible
work" (contract §5.4's spirit broken), and the final content is whichever writer landed
last. fe never offers this (retry renders only for settled `failed`), so it is API-only
today, but the contract explicitly blesses regenerating "pending-and-abandoned", and
"abandoned" is indistinguishable from "in flight" server-side.

**Suggested patch (not applied):** register the fan-out's own fills in the same
`regenerating` set (add the `${subjectId}:${exerciseId}` key in `generateSlot` when
invoked from `fanOut`, release in a finally). A live pending slot then answers the
existing 409; an orphaned one (process restarted, set empty) stays regenerable — which
is exactly the contract's "pending-and-abandoned" without the race.

**Minor asymmetry, recorded:** a failed→failed regenerate answers **200** with the slot
unchanged, while ready→failed answers 502 on the argument "a 200 there is the product
pretending it did the work". The teacher who pressed retry on a failed slot and got
nothing also asked for something that did not happen; the visible still-failed state
softens it, but the two rationales disagree. Worth one line in a future contract rev.

---

## Review follow-up (2026-08-09)

**Finding 1 — the guard covered only one of two writers.** `regenerating` lived in the
route and guarded regenerates against each other; the **fan-out** wrote the same slots and
was not in it. So a regenerate against a slot the fan-out was still filling was accepted:
two spawns for one exercise, two writers racing the CAS, a phantom `exercise_revisions`
row archiving a placeholder-shaped pre-image no teacher ever saw, and non-deterministic
final content. That `fe` hides the control while a slot is pending made it unreachable
from the UI — a coincidence of today's rendering, not an invariant of this service.

Fixed by moving the registry into `exams.ts` as `writing`, and claiming **inside
`generateSlot`** — the one place either writer passes through. `generateSlot` is now a
claim wrapper around `attemptSlot`; a slot already held returns `status: "busy"`, which
the route maps to the existing `409 conflict`. Four clauses: the 409 against a filling
slot, **no phantom revision row and exactly one spawn per exercise** (`rev === 3`, not 4),
and the slot regenerating normally once the fan-out has released it.

**Finding 2 — "pending-and-abandoned" is now genuinely reachable.** A `be` restart
mid-fan-out leaves an exam saying «جارٍ كتابة هذا التمرين…» with nothing in flight. be-2
recorded "be-4 is the recovery", which only became true once the guard could tell "someone
is writing this" from "nobody is" — which is finding 1, and why it had to land first. An
orphaned `pending` slot now regenerates to `ready`, keeps its points, and writes no
revision. No `be` change was needed beyond finding 1; the clause is the deliverable.

### What `fe` needs (not changed here, per instruction)

`fe` hides the regenerate control while a slot is `pending`, which is what makes the
recovery unreachable. The cheapest correct change needs **no new `be` field and no timer**:

- **Show the regenerate affordance for `pending` slots too**, not only `failed`.
- **Treat `409 conflict` as the "still being written" answer** — it now means exactly
  that, and its Arabic message already says so («جارٍ تعديل هذا التمرين، أعد المحاولة»).

So the teacher can always ask; a live fan-out politely refuses, and an abandoned slot
repairs. `be` needs nothing further — deliberately, since "has this slot got a live
writer" is process-local and would be a lie in any field a restart could outlive.
