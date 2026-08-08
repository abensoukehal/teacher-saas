# fe-2 — stop throwing the envelope away

**Closed 2026-08-08.** Oracle green (11/11, suite total 37/37), freeze clean, mutation
caught. Same single-context caveat as `fe-1`: no double-blind verifier.

## Pre-flight

```
$ sed -n '90p' stacks/teacher-fe/src/lib/api.ts
  return payload.data as T;                       # ← the envelope died here
$ grep -rn "createSubject(" stacks/teacher-fe/src | grep -v lib/api.ts
src/App.tsx:95:   const rec = await createSubject(id, legacy, null);
src/App.tsx:196:  const rec = await createSubject(id, subject, controls);
```

Reproduced: the 4th parameter existed and **neither caller passed it**. (Line drift only —
the `return payload.data` line is 90, recorded as 93. Content identical.)

## Cycles

- **C1 — oracle first, proven RED.** 11 clauses; **5 failed, 6 passed**. The 5 were exactly
  the join-key clauses; the 6 passing were the negatives, which *should* already hold. A red
  for the right reason.

- **C2 — the envelope, and where to unwrap it.** `post()` is shared by generation and
  refinement, so returning the envelope from it forces a decision at both call sites:
  `generateExam` now resolves `{subject, correlationId, costUsd}`, `refineExercise` unwraps
  to the bare `Exercise`. Refinement's cost is not attributed to a subject (Part B is about
  the generation), and giving it an envelope would have rippled into `onRefine` for nothing.
  Pinned both ways.

- **C3 — omit vs. null, the one non-obvious call.** `createSubject`'s 4th argument is
  `string | null | undefined`, and the body carries `genCorrelationId` **only when the
  caller passed something** — including an explicit `null`. Three things fall out:
  - the legacy adoption sends `genCorrelationId: null` (contract: nullable *is* the
    contract — that draft genuinely has no generation to point at);
  - a caller that never had a generation sends a byte-identical request to before, which is
    why the promoted `api-subjects` pin `toEqual({subject, controls})` **stays green**;
  - `be` stores `null` for both, so nothing depends on the distinction downstream.

- **C4 — the retry, written as a repeat case from the start.** The `be` lesson. The join key
  is threaded through `onGenerateSave(subject, genCorrelationId)` and captured by the retry
  closure, rather than read back from component state. A retry that lost it would store an
  exam whose cost is unanswerable — the gap being closed — and one that re-read a *fresh*
  id would answer it **wrong**, which is worse. Pinned: two creates, same key.

- **C5 — the dead header removed.** `request()` had a `correlationId` option that set
  `x-correlation-id`; the contract puts the field in the body, so the option had no caller
  left. Removed rather than left as a second, silent way to say the same thing. The oracle
  asserts no `x-correlation-id` header and no query param.

## `costUsd` is deliberately not persisted

It is on the envelope and `fe` deliberately drops it at the save boundary — pinned
negatively. Two sources of cost truth drift; the run log already carries the number and
`genCorrelationId` is what makes it reachable. Adding `costUsd` later is a one-liner; the
join key is the part that cannot be added retroactively.

## Mutation spot-check

Replaced `next.correlationId` with `null` at the save call site — the shape a plausible
"just pass null for now" would have.
→ **3 clauses failed**: `generate → save carries genCorrelationId = the GENERATION's id`,
`the two correlation ids stay distinct`, `A RETRIED save keeps the SAME join key`.
Reverted; 37/37.

## Perimeter

Promoted net unchanged from the post-`fe-1` state — **15 failures, all `fe-1`'s declared
supersession**, none added here. `api-subjects` (15) and `subject-list` (11) stayed green,
which is the check that C3's omit-when-undefined choice actually held.

## What I'd tell the next slice

- Two correlation ids are now in play on one save. `genCorrelationId` = the generation's;
  `correlationId` on the response = that HTTP request's. Anything that starts reading
  `rec.correlationId` and calling it the cost key has reintroduced the bug this slice fixed.
- `generateExam` no longer resolves an `ExamSubject`. Any new caller must destructure
  `.subject` — TypeScript will say so, once the pre-existing `tsc` break (see `fe-1`'s
  journal) is fixed and the build runs again.

## review
**approve.** No status-code branching anywhere (all `error.type`), no absolute URLs, the
envelope change is invisible to the UI, and the join key survives a retry. Mutation-killed.
