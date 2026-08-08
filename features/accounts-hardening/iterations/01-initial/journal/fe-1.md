# fe-1 — stop discarding the two numbers

**Status:** done · gate `12/12` green · freeze audit clean (+1 file, stated below).

## Pre-flight (ground truth, re-run)

```
grep -n "costUsd\|durationMs" stacks/teacher-fe/src/lib/api.ts
→ 98,99   GenerateEnvelope declares both          ← RECEIVED
→ 155,163 GeneratedExam carries costUsd only, and generateExam returns it
→ 472,494 the solutions path, same shape
grep -n "costUsd\|durationMs" stacks/teacher-fe/src/App.tsx
→ (no hit)                                        ← NEVER SENT ON
```

Reproduces exactly as recorded: `fe` receives both and threads neither. `durationMs`
was not even carried past the transport.

## Oracle first, RED before code

`features/accounts-hardening/tests/fe/kpis-thread.characterization.test.tsx`, with the
recorded envelope (`costUsd 0.645421`, `durationMs 127676`, a real 3-exercise run)
copied **beside the suite** as `fixtures/rec-exam-subject.2026-08-07.json` and read with
`__dirname`. `/api/generate` is never called.

First run: **7 failed, 5 passed** — the 5 passes are the negative clauses, which must
hold before *and* after.

## Delta

- `src/lib/api.ts` — `SubjectKpis` (`costUsd`/`durationMs`, both `number | null`); a
  fifth `kpis` argument on `createSubject`, defaulted, that **always emits both keys**;
  `GeneratedExam` gains `durationMs` and both fields normalise to `null` at the
  transport boundary.
- `src/App.tsx` — the three create call sites: generation passes the run's pair, legacy
  adoption passes an explicit `{null, null}`, the pending-save replay passes what the
  stored intent carries.
- `src/lib/persist.ts` — **outside the sub-issue's literal Delta list.** `PendingSave`
  is the stored shape of a create intent and it lives here; the two fields had to be
  added to the interface or the replay could not carry them. Type + comment only, no
  behaviour. Flagged rather than quietly folded in.

## Decisions worth a reviewer's eye

- **Both keys are always sent, never conditionally omitted.** `genCorrelationId` is
  emitted only when the caller supplies one (to keep old requests byte-identical);
  the KPI pair is not, because `be` reads an absent field as `null` anyway and a
  subject read back later could not tell "nothing to measure" from "a caller that
  forgot". The pair is cheap; the ambiguity is not.
- **`?? null` at the transport boundary, so `undefined` never travels.** It vanishes
  through `JSON.stringify`, which would turn "the run did not report" into a missing
  field rather than a stated absence.
- **The replay normalises with `?? null` even though the type says non-null.** A
  `PendingSave` written by the *previous* build is already sitting in real browsers'
  storage without these keys. Trusting the type there would silently drop the pair on
  exactly the path that exists to survive a reload.
- **fe-1 stores; it does not render.** `costUsd` is a usage signal under a
  subscription, not money, and the teacher-facing surface carries no operator metric
  at all — asserted negatively (no `$`, no `USD`, neither figure in the DOM).

## Clauses written from the start (not after a bug)

- **Race clause, one `act()`.** Two retry presses dispatched inside a single `act()`
  so React cannot re-render between them — the only version that exercises the
  `creating` ref rather than proving `disabled` works. `create` is insert-only, so a
  second create is a second exam *and* a double count in every KPI average.
- **Invention clauses, from both sides.** A legacy draft (no generation) and an
  envelope that omits the numbers both send `null`, explicitly `not 0` — a zero says
  the run was free and instant and would sit in the global average forever.
- **Retry clause.** Both creates of a failed-then-retried save carry the same pair and
  the same join key: never dropped, never re-measured.
- **Queued-save clause.** A pending intent restored from `localStorage` replays with
  the numbers still attached; they are not re-derivable once the envelope is gone.

## Mutation spot-check

1. `api.ts` `costUsd: kpis.costUsd` → `?? 0` (the invent-a-zero mutation).
   **Caught by** `legacy-draft adoption sends null for BOTH` *and* `an envelope WITHOUT
   the numbers sends null, never zero and never a guess` (2 failed, 10 passed).
2. `App.tsx` — dropped `durationMs: next.durationMs` from the generation call site.
   **Caught by** `generate → the create body carries costUsd and durationMs from THAT
   run` *and* `a RETRIED save re-sends the SAME pair` (2 failed, 10 passed).

Both reverted; gate green again. `npm run build` (tsc -b) and `oxlint` clean.

## Freeze audit

```
git -C stacks/teacher-fe diff --stat
 src/App.tsx        | 28 +++++++++++++++++++++++-----
 src/lib/api.ts     | 47 ++++++++++++++++++++++++++++++++++++++++++++---
 src/lib/persist.ts | 13 +++++++++++++
```

`ExamView`, `RefinePanel`, `SolutionView`, the print paths, the solutions API and
`/api/generate`'s request shape: untouched, and pinned by the negative clauses.

## Inherited breakage a reviewer must decide on

The **promoted** suite `tests/fe/persistence-gaps/cost-join.characterization.test.tsx`
asserts the opposite of this sub-issue — that job deliberately did *not* persist
`costUsd`, on the reasoning that the run log was the single source of cost truth:

- `costUsd is NOT persisted from fe — the join key is the deliverable`
- `it travels in the BODY …` → `Object.keys(body)` must equal
  `["controls","genCorrelationId","subject"]`

be-1 moved that truth onto the subject, so both clauses are now **wrong, not broken**.
They do not run in this job's gate (job mode reads `features/<slug>/tests/`), but they
will fire on the mainline regression net after merge. They need updating as part of
this job's promotion, not silently deleting.

## review
**approve-with-debt → debt closed.** Code correct: the pair is always sent, `null` never
`0` — a zero would corrupt every average.

The debt was real and would have gone red on the mainline: **two promoted clauses asserted
the opposite of what shipped** (`costUsd is NOT persisted from fe`, and an exact create-body
key set). Both superseded here rather than at promotion, with the reasoning recorded — the
earlier pin was about avoiding two sources of cost truth, and this job resolves that the
other way, moving cost onto the subject so KPIs are a query. Two further exact-shape pins in
other suites were narrowed for the same reason: an exact key set turns every additive field
into a false failure.
