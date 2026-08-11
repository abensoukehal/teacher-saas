# be-1 — journal · the class spine, observable from its first write

Implementer: `be` stack agent. Lane slot 8 (`be` :9800, log `/tmp/teacher-backend.s8.log`).
Budget: 10 iterations.

---

## Pre-flight (runtime gate) — PASS

Re-ran the sub-issue's Ground-truth commands against the live lane before writing a line.

| probe | recorded | observed 2026-08-11 | verdict |
|---|---|---|---|
| `curl -o /dev/null -w '%{http_code}' $CHAR_BE_URL/api/classes` | `404` | `404` | match |
| `curl -o /dev/null -w '%{http_code}' $CHAR_BE_URL/api/progress` | `404` | `404` | match |
| `curl $CHAR_BE_URL/api` | 9 routes, no classes/progress | `/health /api/skills /api/generate /api/teacher /api/subjects /api/exams /api/auth/{signup,signin,recover}` | match |
| `db.programmes.distinct("streams")` | the six, byte-identical to `contracts.ts:4` | the six | match |
| `grep -rc classId src` | none | none | match |

The stream union was re-checked the hard way rather than by eye: a node one-liner parsed
the `Stream` union out of `artefacts/design_handoff_prep_companion/types/contracts.ts:4`,
sorted both lists and compared the JSON. `identical: true`. That is the sub-issue's
ask-when condition, so it is the one worth doing properly.

Sub-issue is loop-ready. Proceeding.

---

## Cycle 1 — the oracle, then the spine

**Oracle first, then frozen.** `features/classes-progress/tests/be/classes.characterization.test.js`,
47 clauses, committed at `8d318dd` BEFORE any source existed. Red as written: 32 failed,
15 passed, every failure "no such route". A suite that had gone green against no
implementation would have been the thing worth panicking about.

Lane and log come from `CHAR_BE_URL` / `CHAR_BE_LOG`; no port appears in the file.

**Built:**

- `src/store/programmes.ts` — ADDED `getProgrammeForStream(db, stream)`, nothing else
  touched. `findOne({streams, current: true})` over the `{streams:1, current:1}` index
  that had existed unused since the corpus landed. Multikey is the point: six streams
  live in five documents (the lettres record carries two), so the array match resolves
  either of them out of one document.
- `src/mutationlog.ts` — NEW. One structured line per class/progress write. Takes the
  WHOLE teacher id and slices the 8-char prefix itself, so the decision cannot be
  forgotten at a call site.
- `src/store/classes.ts` — NEW. `create` / `listByTeacher` / `getOwned`. Field-explicit
  `toRecord`; index `{teacherId:1, createdAt:1}`.
- `src/routes/classes.ts` — NEW. `POST` + `GET /api/classes` behind `requireTeacher` on
  the prefix.
- `src/app.ts` — mount + one entry in the `/api` index. Nothing else.

`tsc --noEmit` clean. `tools/dev restart be` → healthy on :9800.

**Result: 44 passed, 3 failed, 47 total.**

### The three failures were mine, in the suite, and they were mechanical

```
TypeError: Request with GET/HEAD method cannot have body.
```

Three clauses in the identity-gate table — `GET /api/classes` with no header, with an
unissued id, and with an uppercased id — share a `test.each` table with their `POST`
twins and therefore share the POST's request body. `fetch` refuses a GET carrying one and
throws inside the helper, *before any assertion is reached*. The three clauses did not
fail; they never ran.

**Why this is an amendment and not an edit to a frozen oracle.** The freeze exists so an
implementer cannot soften a clause to make their code pass. This is the opposite
direction: three required clauses currently assert nothing, and the sub-issue's Oracle
slot names one of them explicitly ("no `x-teacher-id` → `401 teacher_required`"). Leaving
it would mean shipping with a bullet unverified. So the fix is scoped to the smallest
possible surface that cannot change a verdict:

- **changed:** the `call` helper stops attaching a body to `GET`/`HEAD`.
- **unchanged:** every `test.each` table, every case, every `expect`. No assertion, no
  status code, no error type, no clause count.

Recorded here in full so a reviewer can check the claim rather than take it. The
`POST` twins of all three clauses were already green before this change, which is the
evidence that the gate itself was never in question — only the transport.

**Result after the amendment: 47 passed, 0 failed. Gate PASS.**

---

## Cycle 2 — done-protocol

All four rungs, each re-run rather than remembered.

1. **Oracle green ×2.** Two consecutive full runs of
   `tools/ci be --slug classes-progress` from the be worktree: `47 passed` both times,
   `gate PASS`. No restart, no edit between them.
2. **Perimeter differential.** SEED §2's recordings for the surfaces that already
   existed, re-run against the running lane:
   - `GET /api` — the 9 recorded routes all still listed; the list GREW by exactly
     `/api/classes` and lost nothing.
   - the 401 gate — no header, unissued 32-hex, and UPPERCASE of a valid id all still
     `401 {error:{type:"teacher_required", message:"مطلوب تسجيل الدخول"}}`, and the
     `/api/classes` refusal body is byte-identical to `/api/subjects`'.
   - `GET /api/subjects` — key set unchanged; a fresh teacher still gets
     `{subjects: [], correlationId}`, a stored subject still projects exactly
     `{id,title,topic,exerciseCount,totalPoints,createdAt,updatedAt,genCorrelationId,costUsd,durationMs}`.
     **No `classId` key** — be-3 adds it, be-1 does not.
3. **Freeze audit.** `git status --short -- src/teacher.ts src/inflight.ts
   src/routes/subjects.ts src/store/subjects.ts src/store/teachers.ts` → **empty**.
4. **`tools/ci be --slug classes-progress`** from the be worktree → `gate PASS`.

---

## Decisions the sub-issue did not settle

1. **`classes.getOwned` ships in be-1 although no be-1 route calls it.** be-2 and be-3
   both have to answer "is this classId mine?", and both freeze `src/store/classes.ts`
   read-only. The reader therefore has to arrive with the collection or it cannot arrive
   at all. It mirrors `subjects.getOwned` exactly, including returning `null` — not
   throwing — on a malformed id, which is what lets a route give one byte-identical 404
   to "absent", "not yours" and "not even an id" (contract §6).
2. **The mutation line carries both `msg` and `event`, same value.** The contract names
   `event`; every other structured line in this service is discriminated by `msg`, which
   is what `tools/obs logs` and any human grep read. One duplicated key buys out making
   an operator learn a second convention to read the newest lines.
3. **`/api/classes` was added to the `/api` index.** The sub-issue says "the index grew,
   nothing vanished", and `app.ts` describes that listing as the teacher-facing
   description of the service. `/api/progress` is deliberately NOT listed yet — it does
   not exist until be-2.
4. **Name length is measured after trimming.** Contract §3 says "trimmed non-empty,
   ≤ 80 chars" without saying which value the 80 applies to. Trimmed, so a name of 80
   characters padded with spaces is accepted rather than refused for length it does not
   have.
5. **Error messages are Arabic.** The contract pins `error.type`, not `message`. The
   product's first hard constraint is Arabic-only and `requireTeacher` already answers in
   Arabic; the new 400s follow.

## Not done here, on purpose

`getProgrammeForStream` is used by be-1 only as a yes/no at create time. Nothing reads
`totals.weeks`, stamps a programme identity, or writes a progress document — that is
be-2, and doing any of it here would have put an unpinned surface in a green slice.

## review

**Verdict: approve-with-debt.** Cross-model review (Fable), by execution against lane 8.

Attack log:
- Re-ran the create/list surface adversarially. Ownership scoping, ascending order, the
  401 gate and the corpus-backed stream validation all held live.
- Mutation: `classOf`'s cousin surfaces (be-3) and the log line (MB4) are covered
  elsewhere; be-1's own store survived nothing it should not have.
- **The debt: the empty-name guard does not meet its own stated rule.** The code comment
  says "a name of three spaces is an empty name wearing a costume" — but `trim()` only
  strips whitespace. A name of U+200F (RLM) or U+200B (ZWSP) alone is accepted
  (`201`, reproduced live), renders as a **permanently blank tab** in the switcher, and
  "nothing is deleted" makes it immortal. `fe`'s `classdraft.ts` validation uses the same
  `trim()`, so the real UI reaches it by paste. Self-inflicted only, and the tab still
  functions — hence debt, not reopen. Suggested micro-patch (not applied): strip
  `[​-‏⁠﻿]` before the emptiness check, in `routes/classes.ts` and
  mirrored in `fe/src/lib/classdraft.ts`, with one clause each.
