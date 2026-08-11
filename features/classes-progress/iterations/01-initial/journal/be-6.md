# be-6 — journal · the catch-all speaks Arabic, and one name for the teacher prefix

Implementer: `be` stack agent. Lane slot 8 (`be` :9800, log `/tmp/teacher-backend.s8.log`).
Budget: 6 iterations. **Used: 1.**

Two source lines moved, in the two files the Delta names. No route file, no store file,
no `src/teacher.ts`, no `src/routes/auth.ts`, no skill, no generation path.

---

## Pre-flight (runtime gate) — PASS

Both defects reproduced against the live lane before anything was written.

| probe | recorded in the sub-issue | observed 2026-08-11, lane s8 | verdict |
|---|---|---|---|
| `curl -i localhost:9800/api/nope` | `404 {"error":{"message":"not found","type":"not_found"}}` | byte-identical | match |
| the header vs the body | `x-correlation-id` present, body has none | header `daf272a1-…` present, body has no `correlationId` | match |
| `grep -c teacherIdPrefix src/teacher.ts src/routes/auth.ts` | 2, 4 → six sites | 2, 4 — `teacher.ts:76,128`, `auth.ts:128,222,254,316` | match |
| the odd one out | `src/mutationlog.ts` calls it `teacher` | `src/mutationlog.ts:47` — `teacher: teacherId.slice(0, 8)` | match |

**One nit in a recorded command, not in the fact.** The sub-issue writes the last probe as
`grep -c '"teacher"' src/mutationlog.ts → 1`. That command returns **0**: the file writes an
unquoted object key (`teacher:`), so the quoted form never matched. `grep -c 'teacher:'`
returns 1. The *fact* the row asserts — one call site, under the name `teacher` — is exactly
right, so this is a typo in the probe, not a wrong pin, and it is recorded here rather than
silently corrected in the plan.

Worth noting where the inconsistency came from: **be-5's own journal caught it and let it
stand.** Its pre-flight table reads "8 chars — but under key `teacherIdPrefix`, not
`teacher`", filed as a suite bug ("I had guessed the prefix key") because renaming the
service's field was outside be-5's Delta. That was the right call then. be-6 is the Delta
that closes it.

---

## THE SUPERSESSION DECLARATION (WF-65)

be-6's declared scope is to change behaviour three earlier suites had already pinned. Those
pins were **true** — they recorded the service as it actually was — so amending them is only
legitimate as a *declared* supersession, and this is that declaration. Four clauses were
amended, no more.

| # | pin | suite · clause | why it is superseded | what did NOT change |
|---|---|---|---|---|
| 1 | the catch-all body has **no `correlationId`** | `hardening` (be-5) · "the catch-all 404 carries NO correlationId — recorded, not fixed here" | be-5 pinned this as a pre-existing gap inherited knowingly, and said in as many words that closing it "is a deliberate change that turns this clause red on purpose". be-6 is that change. Its consumer is the reason: `fe` reads `payload.correlationId` from the **body**, never the header (`fe/src/lib/api.ts:145,309`), so the one response a caller most needs to trace was the one its own client could not trace. | The clause was not deleted — it was **inverted and strengthened**: the id is now asserted present, non-empty, Arabic-messaged, and `type === "not_found"`. |
| 2 | the catch-all message is **English** (`"not found"`) | same suite, same region (the body was pinned by the `raw` comparisons around it) | The product's first hard constraint is Arabic-only, and `fe` renders `error.message` **raw to the teacher**. The sibling handler ten lines below was fixed for exactly this reason (QA BUG-3, malformed body → «الطلب غير صالح»); the catch-all was missed. | **`error.type` did not move.** `not_found` stays `not_found` — callers branch on the type, and renaming it while translating the message would have been a silent breaking change dressed up as a translation. |
| 3 | the two catch-all responses are **raw-identical** | `hardening` (be-5) · "an absent id segment is a ROUTE-level 404, and is class-independent" — `expect(withClass.raw).toBe(withoutClass.raw)` | Collateral, and it *had* to move: that comparison was byte-identity only because the body carried no per-request field. Adding `correlationId` makes two requests legitimately differ by exactly that one field. | **The invariant is unchanged and still exact.** The fix is `mask()` — the same normalisation every other parity clause in that file already applies, and the reason `RECORDED_CLASS_404` is written with `"<CID>"`. Byte-identical modulo the per-request correlation id, which is what "byte-identical" has meant everywhere else in the suite from the start. Nothing was weakened from set equality to containment, or from a literal to a shape. |
| 4 | the mutation log's key is **`teacher`** | `classes` (be-1) · "class.created carries … an 8-char teacher PREFIX" · `progress` (be-2) · "every progress line carries an 8-char teacher PREFIX …" · `hardening` (be-5) · "every line carries an 8-char teacher prefix …" | One field, two names, six-to-one against: `teacher.ts` and `routes/auth.ts` already logged this exact concept as `teacherIdPrefix` at six call sites. An operator greps one name and misses the other, and the miss is silent — worse on the correlation an operator actually makes, `teacher.rejected` ↔ `class.created`. | The **value** and its 8-char slice are untouched; only the key is renamed. Each amended clause additionally **gained** `expect(line.teacher).toBeUndefined()`, so the rename is asserted complete rather than doubled — and every existing "no full 32-hex id" clause was left exactly as it was. |

**Nothing outside those four was touched in a frozen suite.** No assertion was loosened: three
of the four amendments changed only an expected *value* and added a clause; the fourth (#3)
applied the file's own existing normalisation to keep an exact comparison exact.

---

## Cycle 1 — the change, and the oracle

### The two lines

`src/app.ts` — the catch-all, matching the sibling handler's body shape exactly, so this
service has **one** shape for an error body:

```
{"error":{"message":"الصفحة غير موجودة","type":"not_found"},"correlationId":"…"}
```

`_req` became `req` because the handler now needs `req.correlationId`. `tsc --noEmit` clean.

**On the wording.** «الصفحة غير موجودة» rather than a literal translation of "not found" or
a path-flavoured «المسار غير موجود». The deciding fact is *who reads it*: `fe` renders this
string raw to a teacher, and a teacher has no concept of a route or a path. This is the
standard Arabic 404 phrasing and is immediately legible to a lay reader. Recorded as a
choice, not a default — a reword is a product decision and the oracle pins the literal so
it stays one.

`src/mutationlog.ts` — `teacher:` → `teacherIdPrefix:`. The value expression is the same
`teacherId.slice(0, 8)` character for character.

### The oracle

New suite: `features/classes-progress/tests/be/catchall-and-log-naming.characterization.test.js`
— **22 clauses**, in three sections mirroring the sub-issue's Oracle slot:

1. *No English string reaches the client on ANY unrouted path.* Five path shapes (bare
   unknown, outside `/api`, unknown segment under a real prefix, missing id segment, deep
   path under a real prefix) × the recorded literal; the four HTTP methods a client actually
   sends, all one body; the body id **is** the header id and echoes a caller-supplied one;
   identical with and without a teacher header; identical for a teacher who owns a class and
   one who does not.
2. *Negative — the type did not move.* `not_found` exactly, `!== class_not_found`, exact key
   sets on both `error` and the envelope. Plus the anti-vacuity clause: a **real** route still
   answers 200, so a service that 404'd everything could not pass section 1.
3. *One name for the prefix.* Exact key-set equality on both mutation lines; `teacher` and
   `teacherId` asserted absent; the payload (`outcome`/`week`/`rev`/`classId`) re-pinned so
   the rename cannot have moved anything else; a whole-log sweep for the old key; and **the
   defect itself** — one predicate finds both `class.created` and `teacher.rejected`, which
   is the correlation the two names used to break.

Plus four **perimeter-differential** clauses comparing every other error body against a
recorded literal, and two on the `/api` index and `/health`.

**Green on the first run.** No service defect surfaced; no clause needed relaxing.

### The revert-check — the oracle actually discriminates

A suite that passes before and after proves nothing, so the two source files were stashed,
the lane restarted on the old code, and the gate re-run:

```
gate FAIL   17 failed, 348 passed, 365 total
```

All 17 are clauses about the two changed behaviours — 13 in the new suite, 4 the amended
pins — and **not one** unrelated clause moved. In particular every perimeter-differential
clause (the 401 gate, `class_not_found`, `invalid_request`, `conflict`, the `/api` index)
passed against **both** the old and the new code, which is the evidence that be-6 changed one
body and only that one. Stash popped, lane restarted, green again.

---

## Done-protocol

| rung | outcome |
|---|---|
| all six be suites green ×2 | **PASS** — `6 passed, 365 passed` on both runs. Per suite: classes 47 · progress 97 · subjects-classid 48 · teacher-school 52 · hardening 99 · **catchall-and-log-naming 22**. |
| perimeter differential | **PASS** — 401 gate, `class_not_found`, `invalid_request` (malformed body), `conflict` (stale rev) each compared to a recorded literal byte for byte; `/api` index by exact set equality both directions; `/health` still answers. All five passed against the OLD code too, which is what makes them a differential rather than a restatement. |
| freeze audit | **PASS** — `git status` in the be worktree is exactly `src/app.ts` + `src/mutationlog.ts`, +16/−3. Every file the Delta freezes is untouched: all of `src/routes/`, all of `src/store/`, `src/teacher.ts`, `src/routes/auth.ts`, `src/inflight.ts`, `src/claude/`. In the project repo, only this journal, the new suite and the three declared amendments. |
| `tools/ci be --slug classes-progress` from the be worktree | **PASS** ×2 — `gate PASS (1 ran, 0 skipped)`. |
| the supersession declared | **this file, above.** |

---

## Reported, NOT fixed — the rest of the English on the wire

The sub-issue asked whether anything else in `be` emits an English user-facing `message`.
It does. **None of it is in be-6's Delta, so none of it was touched** — each is on a frozen
file and would be a scope error to fix here. Recorded so the next job inherits it knowingly.

| where | message | reached by |
|---|---|---|
| `src/routes/subjects.ts:50` | `"subject not found"` | **every** `GET`/`PUT` on a subject id a teacher does not own or that does not exist — the most reachable of these by a wide margin |
| `src/routes/subjects.ts:473` | `"exercise is required"` | `PUT …/exercises/:id` with no body |
| `src/routes/subjects.ts:479` | `"exercise.id must match the path segment"` | the same route, mismatched id |
| `src/routes/subjects.ts:524` | `err.message` (`exercise_not_found`) | replace by an unknown exercise id |
| `src/app.ts:176` | `"input is required (string or object)"` | `POST /api/generate` with an empty input |
| `src/app.ts:183` | `` `unknown skill …` `` | `POST /api/generate` with a bad skill name |
| `src/app.ts:272` | `"internal server error"` | any unclassified 500 |
| `src/app.ts:254` / `:265` | `err.message` from `ClaudeError` / `StoreError` — e.g. `"datastore unavailable"`, `"claude did not return JSON"`, `` `claude exited N` `` | `503 claude_auth` · `503 store_unavailable` · `502 claude_exit` · `504 claude_timeout` |

Two observations for whoever picks this up:

- **`subjects.ts:50` is the one that matters.** It is a teacher-reachable 404 on the product's
  hottest surface, and it is the exact same defect be-6 just fixed one file over.
- **The `err.message` pass-throughs are a different problem from the literals.** Those strings
  come out of the Claude CLI and the Mongo driver; translating them means *mapping* them to
  Arabic per `error.type`, not editing a string. That is a design decision, not a typo fix,
  and it is why grouping them with the literals under one "translate the messages" ticket
  would understate the work.

Everything the new routes emit (`classes.ts`, `progress.ts`, the `classId` paths in
`subjects.ts`, `auth.ts`'s school surface) is already Arabic — checked, no gaps.

---

## Open — what be-6 did not settle

1. **The English list above.** Reported, not scheduled. `subjects.ts:50` deserves a
   sub-issue of its own; the `err.message` pass-throughs deserve a decision before a ticket.
2. **The wording is a product call.** «الصفحة غير موجودة» is my choice against a stated
   constraint, not a spec'd string. If the product has a house voice for a 404, the oracle
   pins the literal in one place and a reword is a one-line change plus one test edit.
3. **`fe` still renders `error.message` raw.** be-6 made the string safe to render; it did
   not make rendering-raw safe as a *policy*. Any future English message on any route lands
   straight in front of a teacher, which is the standing hazard the two items above sit on.
4. **The `msg`/`event` duplicate key in `mutationlog.ts` was left alone.** Two keys, one
   value, deliberately — its own comment explains why, it was not in the Delta, and it is a
   different question from this rename.

## review

**Verdict: approve.** Cross-model review (Fable).

The WF-65 supersession is legitimate on all four counts: each amended pin was true,
each was superseded by a declared Delta, none was weakened (one inverted-and-
strengthened, one applied the file's own mask, two renames asserted complete with a
negative). The revert-check — 17 red, all the right clauses, nothing else moved — is the
strongest evidence in the slice that an oracle discriminates. The catch-all now carries
an Arabic message and a body correlationId, re-verified live on an unknown path.

One note forward: be-6's open item 3 ("fe still renders `error.message` raw") is not
theoretical — see the fe-3 review below, where it composes into a live English string on
a slice-1 surface.
