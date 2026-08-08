# be-4 — give a subject a join key to its generation

**Closed 2026-08-08.** Oracle 49/49 ×2, promoted net 44/44, freeze clean, mutation caught.

> Same protocol deviation: no subagents, so no double-blind verifier.

## Pre-flight

Reproduced both halves of the gap:
- the run log's link lines each carry a DIFFERENT `correlationId` (one per HTTP request),
  and the generation's is a third — so no join existed even in principle
- the stored document had no cost or generation field at all

## What made this small

DISCOVERY had already established (journal H4) that **`/api/generate` needs no change** —
`app.ts:145` returns `costUsd`, `durationMs` and the generation's `correlationId` in its
envelope. The brief thought finishing this meant touching a frozen return type; it did
not. Only the subject was missing the key, so the `be` side is one nullable field.

## Decisions

- **`genCorrelationId`, not `costUsd`.** Denormalising the cost onto the subject would
  create a second source of cost truth, and the run log already carries the number. The
  join key is the part that is hard to add retroactively; the number is not.
- **Nullable is the contract, not a compromise.** A subject adopted from the legacy
  localStorage draft genuinely has no generation to point at, and every pre-existing
  document must read back `null` without being rewritten. `toRecord`/`toSummary` use
  `?? null` so absent reads as null — no migration.
- **A wrong TYPE is rejected (400).** Optional means omittable, not "anything goes":
  silently storing a non-string produces a join key that never joins, which is worse
  than no key.

## A narrowed pin (WF-65)

`be-3`'s "the stored subject document grows no history key" asserted the document's
EXACT key set, so it failed the moment this sub-issue added a field. Over-specification:
the invariant it protects is that **history is never embedded** — the subject-open path
must stay one cheap read — and that is unchanged. Narrowed to assert exactly that, plus
that no embedded variant text appears. Additive fields are now explicitly allowed; a
history key is still forbidden.

## Done-protocol

| check | result |
|---|---|
| oracle ×2 | 49/49, 49/49 |
| promoted net vs this lane | 44/44 |
| freeze | only `src/store/subjects.ts`, `src/routes/subjects.ts` — `/api/generate` untouched |
| mutation — store the request's own correlationId instead of the generation's | **caught**, 5 clauses |
| pre-existing docs | read back `null`, `updatedAt` unchanged — not rewritten |
| run log | link-line keys unchanged, still no Arabic or statement text |

## For fe-2

`fe` must send `genCorrelationId` in the **request body** (not a header), taking it from
`/api/generate`'s envelope — which `generateExam` currently discards at `api.ts:93`. The
legacy-draft path (`App.tsx:95`) must send `null`, never invent one.
