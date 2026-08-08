# be-1 — store the two numbers the operator cannot currently see

**Status:** done · gate `14/14` green · freeze audit clean.

## Pre-flight (slot-2 ground truth, re-run)

```
mongosh teacher_saas --eval 'Object.keys(db.subjects.findOne({},{},{sort:{_id:-1}}))'
→ ["_id","teacherId","subject","controls","genCorrelationId","createdAt","updatedAt","rev"]
  "costUsd" in doc     → false
  "durationMs" in doc  → false        (3074 documents in the collection)
```

Reproduces exactly as recorded. The generate envelope's real numbers
(`costUsd 0.756058`, `durationMs 145467`) are used as the oracle's fixture values.

## Oracle first, RED before code

`features/accounts-hardening/tests/be/kpi-fields.characterization.test.js` +
`fixtures/rec-subject-shape.2026-08-08.json` (the pre-change response shape, recorded
from the live lane before any edit).

First run: **12 failed, 2 passed** — the two passes were the type-rejection cases that
happened to be rejected for an unrelated reason, so they were re-checked after the fix.

## Delta (exactly the sub-issue's, nothing else)

- `src/store/subjects.ts` — `costUsd?`/`durationMs?` on `SubjectDoc`, a `SubjectKpis`
  input type, both fields on `SubjectRecord` and `SubjectSummary`, `?? null` in
  `toRecord`/`toSummary`, and a fifth `kpis` argument on `create` (defaulted, so no
  caller is forced to change).
- `src/routes/subjects.ts` — `POST /api/subjects` accepts both, optional and nullable,
  and rejects a non-number with `400 invalid_request`. Ownership scoping untouched;
  no other handler in the file was read from or written to.

## Decisions worth a reviewer's eye

- **`?? null`, never `|| null`.** 0 is a real measurement. Coercing it to null would
  remove a genuinely-free run from the very denominator these fields exist to feed.
- **`Number.isFinite`, not `typeof === "number"`.** `Infinity` is JSON-representable
  by an over-clever client and averages to `Infinity`, poisoning every KPI derived
  from it.
- **No migration, and reading does not backfill.** A legacy document keeps its keys
  absent and its `updatedAt` byte-identical; the oracle asserts both.
- **`costUsd` is validated as a number, not as currency**, and is described nowhere in
  the code as money. It is the CLI's notional API-equivalent under a subscription — a
  usage signal.

## Clauses written from the start (not after a bug)

- **Second-computation clause:** the numbers arrive on the create request, so a
  handler could echo them without storing them. `GET` and `LIST` are read on
  *separate* requests to tell the two apart.
- **Concurrency clause:** two simultaneous creates with different KPI values are
  re-read independently; a value held in module scope rather than on its own document
  shows up here and nowhere else.
- **Falsy clause:** `costUsd: 0` / `durationMs: 0` round-trip as 0.

## Mutation spot-check

`toRecord`: `doc.costUsd ?? null` → `doc.costUsd || null`, lane restarted.
**Caught by** `positive — both numbers are stored and echoed everywhere ›
zero is a value, not an absence` (1 failed, 13 passed). Reverted; gate green again.

## Freeze audit

```
git -C stacks/teacher-be status --short
 M src/routes/subjects.ts
 M src/store/subjects.ts
```

## review
**approve-with-debt → debt closed.** Live probes confirmed `Number.isFinite` rejects `1e999`.
But the mutation dropping that guard **survived** the gate: the suite tested non-*number*
rejection and never a reachable non-*finite* number. Three clauses added (Infinity via
`1e999`, `-Infinity`, Infinity in `durationMs`), and the mutation now dies.

Worth recording *how* that was proven: running the mutant actually **stored an Infinity**,
and the KPI averages stayed poisoned after the source was reverted — three documents had to
be deleted from Mongo before the gate went green again. The guard's whole purpose,
demonstrated by removing it.
