# be-3 — keep every superseded exercise

**Closed 2026-08-08.** Oracle 40/40 ×2, promoted net 44/44, freeze clean, mutation caught.

> Same protocol deviation as be-1/be-2: no subagents, so no double-blind verifier.

## Pre-flight

Replaced `ex1` on a real subject: the prior statement was unrecoverable and the document
had no history key (`correlationId, createdAt, id, subject, updatedAt`).
`GET …/revisions` → 404, route absent. Reproduced.

## Cycles

- **C1 — oracle first**, red before code.
- **C2 — the fixture path.** First run: the whole suite failed to load. It reached the
  recording via `CHAR_ROOTDIR/../../../project/features/…`, which resolved outside the
  worktree. That is exactly the fault `94106ed` fixed in the promoted net, so I applied
  the same answer: the recording now sits **beside the test**, in
  `tests/be/fixtures/`, read with `__dirname`. A suite that walks out of its own
  directory breaks the moment it is promoted.
- **C3 — the store.** `exercise_revisions`, its own collection. Two constraints forced
  that: the subject-open path must stay one cheap read, and exercise ids must not move.
  Embedding history would have put every discarded variant on the hottest read.
  `teacherId` is denormalised onto each revision so every read filters
  `{subjectId, teacherId}` in one query — ownership scoped IN the query, same rule
  `getOwned` follows.
- **C4 — append BEFORE the `$set`.** After it the outgoing version is already gone. The
  first replacement therefore stores the *generated original* — the material the exercise
  library (roadmap 6) is built from.
- **C5 — the read route.** Empty list is `200 []`, never 404; an unknown `exerciseId` is
  also `200 []`, because READING a history that does not exist is not an error. Only
  WRITING to an unknown exercise is, and that stays `409`.

## Restore is not a new surface

`fe` restores by PUTting the old exercise back, which is itself a supersession — so
history GROWS to 3 rather than rewinding. Both the count and the sheet are asserted.
Nothing is ever destroyed, which is the whole point.

## Done-protocol

| check | result |
|---|---|
| oracle ×2 | 40/40, 40/40 |
| promoted net vs this lane | 44/44 |
| freeze | only `src/store/revisions.ts`, `src/store/subjects.ts`, `src/routes/subjects.ts` |
| mutation — append AFTER the `$set` | **caught**, 3 clauses (it stores the new version, not the superseded one) |
| subject read path | keys, array length, ids and positions all unchanged; stored doc grows no history key |
| run log | still exactly one `replaceExercise` link line per replace, and no Arabic/statement text in it |
