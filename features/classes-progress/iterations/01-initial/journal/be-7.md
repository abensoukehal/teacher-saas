# be-7 — journal · the last English strings a teacher can reach

Implementer: `be` stack agent. Lane slot 8 (`be` :9800, log `/tmp/teacher-backend.s8.log`).
Budget: 6 iterations. **Used: 1** (plus one fix-up cycle for two bugs in my own suite).

Six message literals moved, in the two files the Delta names. No `error.type`, no status
code, no route logic, no store file, no skill, no generation path.

---

## Pre-flight (runtime gate) — PASS

All six literals still in the source at the recorded sites, and five of the six reproduced
as live English bodies against the lane before a line was written.

| # | site | recorded literal | observed 2026-08-11, lane s8 | verdict |
|---|---|---|---|---|
| 1 | `src/routes/subjects.ts:50` | `"subject not found"` | `404 {"error":{"message":"subject not found","type":"subject_not_found"},…}` | match |
| 2 | `src/routes/subjects.ts:473` | `"exercise is required"` | `400 {"…":"exercise is required","type":"invalid_request"}` | match |
| 3 | `src/routes/subjects.ts:479` | `"exercise.id must match the path segment"` | `400`, byte-identical | match |
| 4 | `src/app.ts:176` | `"input is required (string or object)"` | `400`, byte-identical | match |
| 5 | `src/app.ts:183` | `` `unknown skill …` `` | `400 {"…":"unknown skill \"no-such-skill\"",…}` | match |
| 6 | `src/app.ts:272` → **now `:281`** | `"internal server error"` | present in source; **not reachable from the wire** | see below |

**Two nits in the recording, in the pin and not in the fact.**

- The sub-issue's Ground truth says "**Seven** literals" and then lists **six**. Six is
  right — its own Delta says "only the message literals at those six sites". Recorded here
  rather than silently corrected.
- `src/app.ts:272` is now `:281`. be-6 added nine lines to the same file. The literal and
  its handler are the ones meant; nothing moved but the line number.

**Site 6 is not reachable from the wire, by design.** `internal_error` is the fallback for
an error that is neither `ClaudeError`, `StoreError`, a `SyntaxError` from the body parser
nor `entity.too.large` — i.e. a bug in this service. Five probes that look like they should
reach it (`/api/subjects/zzz`, `…/solutions`, `…/revisions`, a `PUT` on a malformed id,
`/api/admin/kpis` as a non-admin) all resolve to a *classified* error instead, which is the
classification working. A suite that could trigger it would be triggering a defect, so that
literal is verified where it lives — see the source sweep below.

### The Ask-when conditions were checked, and neither fires

> *"Ask-when: any consumer branches on an English message · a pass-through string turns out
> to be teacher-reachable after all."*

- **No consumer branches on any of the six.** `fe` branches only on `payload.error.type`
  (its `KIND` table, `fe/src/lib/api.ts:83`) and renders `payload.error.message` raw
  (`:145,309`). `grep` for all six strings across `teacher-fe/src` → nothing.
- **No test asserts one either.** The four suites in the promoted net that mention these
  routes (`persistence/subjects-api`, `persistence/health-store`,
  `parallel-exercises/skills-catalogue`, and the six job suites) assert `status` and
  `error.type` only. Three of them were re-run against the changed code — 57 passed.
- The pass-throughs are teacher-reachable, and that was **already** the sub-issue's stated
  reason for excluding them. It is not new information, so it is not a stop condition.
  Reported below.

---

## Cycle 1 — the change

### The six lines

| site | before | after |
|---|---|---|
| `subjects.ts:50` | `subject not found` | **«الموضوع غير موجود»** |
| `subjects.ts:473` | `exercise is required` | **«التمرين مطلوب»** |
| `subjects.ts:479` | `exercise.id must match the path segment` | **«التمرين المُرسَل لا يطابق التمرين المطلوب»** |
| `app.ts:176` | `input is required (string or object)` | **«المُدخل مطلوب»** |
| `app.ts:183` | `` `unknown skill ${JSON.stringify(skill)}` `` | **«القدرة المطلوبة غير معروفة»** |
| `app.ts:281` | `internal server error` | **«حدث خطأ غير متوقع»** |

`tsc --noEmit` clean. Diff is +12/−6 across two files, and six of those twelve are one
comment.

**On the wordings.** Each follows a form already in the codebase rather than inventing one:
«الموضوع» is what `subjects.ts:320` already calls an exam subject; «… مطلوب» is the shape of
«الحل مطلوب» / «السلّم مطلوب» / «اسم المؤسسة مطلوب»; «… غير معروفة» is the shape of «الشعبة
غير معروفة» / «الحالة غير معروفة». The catch-all's «الصفحة غير موجودة» (be-6) and the class
404's «القسم غير موجود» set the pattern for the subject 404. These are choices, not spec'd
strings — but they are choices inside an existing voice.

**Two of them drop information on purpose, and both drops are the point.**

1. `subjects.ts:479` no longer says `exercise.id` or "path segment". Those name the wire to
   someone who never sees it — the same class of leak as showing a teacher LaTeX. The suite
   asserts the words are gone, so putting them back is a deliberate act.
2. `app.ts:183` **no longer echoes the rejected skill name.** The binding reason is
   mechanical: a skill name is Latin (`exam-subject`), so interpolating it puts an English
   run inside the Arabic message and defeats the very constraint the line was changed for.
   The second reason is that it was caller input reflected into a body `fe` renders raw.
   The cost is a diagnostic an operator loses — mitigated by `/api/skills` (the catalogue is
   readable) and the correlation id, but **recorded as a real loss**, not waved away. If it
   matters, the right fix is a structured log line on that branch, which is route logic and
   therefore outside this Delta.

### The oracle

New suite: `features/classes-progress/tests/be/arabic-messages.characterization.test.js`
— **46 clauses** (`it.each` expanded), seven sections.

**It asserts the ABSENCE OF A LATIN WORD, never an Arabic literal**, exactly as the Oracle
slot demands: `expect(message).toMatch(/[؀-ۿ]/)` and
`expect(message).not.toMatch(/[A-Za-z]{4,}/)`. Pinning «الموضوع غير موجود» would make this a
**translation lock** — the next reword, a decision someone is entitled to make, would go red
for the wrong reason, and whoever fixed it would learn to edit the expected string, which is
exactly how a constraint stops being checked. The four-letter floor tolerates an incidental
token while catching any real English word.

1. **`subject not found`, the one that matters.** Four routes funnel through the same
   `notFound` helper (open a subject · read its correction · read an exercise's history ·
   replace an exercise) × three unresolvable shapes (never existed · another teacher's real
   subject · not even an id). One clause per route, WF-70. Each asserts Arabic, `type ===
   "subject_not_found"`, exact key sets, and that all three shapes give one byte-identical
   body — non-probeability re-checked after the message moved. Plus: all four routes answer
   the *same* body (one wording, not four to keep in sync), and the three 404s
   (`subject_not_found` · `class_not_found` · catch-all) are still three distinct bodies.
2. **The refine route's two 400s.** Missing exercise, four degenerate variants
   (`null`/string/number/array), and the id mismatch — plus a clause that the two remain
   *different* messages, so translating both into one generic string would fail.
3. **`/api/generate`.** Five empty-input shapes, seven unknown-skill shapes, and **the
   reflection clause**: the rejected name is not in the body.
4. **`/api/exams`.** Already Arabic; six invalid-control probes pin that it stays so.
5. **The source sweep** — the clause that catches the *next* English literal. Reads the
   seven route/app/teacher files from `CHAR_ROOTDIR` and extracts three shapes:
   `message: "…"`, `bad(res, req, "…")`, and `return "…"`. That third shape is the one
   be-6's recording grep (`grep … | grep -i message`) structurally could not see — and it is
   how the gap in section 6 survived two passes. This is also where `internal_error`'s
   unreachable literal is verified.
6. **RECORDED, NOT FIXED** — see the next section.
7. **The perimeter differential** — see the done-protocol.

**Anti-vacuity is asserted three times**, because two of the sections could otherwise pass
by finding nothing: a real route still answers 200; the sweep can genuinely see strings and
its allow-list entries are still really in the source; and `/api/generate`'s two guards
produce two *different* messages against a non-empty catalogue.

**Nothing in this file calls a real generation.** Every `/api/generate` and `/api/exams`
probe is refused by validation before `runClaude` (`app.ts:174,181`, `exams.ts:573`), and
`POST /api/subjects` is a plain insert. Checking a *known* skill through by running it would
cost a ~110 s agent loop, so the guard's discrimination is asserted the free way instead —
the two guards' messages differ, in the order `app.ts` applies them.

### Two bugs, both mine, both in the suite

First gate run: `7 suites, 2 failed`. Neither was a service defect.

1. `makeSubject` read `body.subject.id`. The record is **flat** — `id` at the root,
   `subject` is the nested payload. It returned `undefined`, so `foreignSubject` was
   `undefined` and the "another teacher's subject" probe was really hitting
   `/api/subjects/undefined`. It *passed* — same 404, same body — which is the dangerous
   kind of green: the clause was true for the wrong reason. Now `makeSubject` throws unless
   it got a string id.
2. The known-skill anti-vacuity clause assumed the skill guard ran first. It runs **second**
   (`app.ts:174` input, `:181` skill), so `{skill:"exam-subject"}` with no input fell to the
   input guard and produced the same message as `{skill:"nope-nope"}` with no input.
   Rewritten as described above.

Fixed, re-run: **7 suites, 411 tests, all green.**

---

## The revert-check — the oracle actually discriminates

A suite that passes before and after proves nothing. The two source files were stashed
(`git stash push -- src/app.ts src/routes/subjects.ts`), the lane restarted on the old code,
and the gate re-run:

```
gate FAIL   15 failed, 396 passed, 411 total
```

**All 15 are in the new suite, and all 15 are about the six changed literals** — 4 subject
404 routes + 3 refine-route 400s + 4 `/api/generate` + 4 source-sweep clauses. Exactly the
right set.

**Not one clause outside them moved.** The six prior suites stayed green. Inside the new
suite, everything that is *not* about the six passed against the old code too:

- every perimeter-differential clause (401 · 403 · `class_not_found` · catch-all ·
  malformed body · `conflict` · the `error.type` table · `/api` index · `/health`),
- the three structural clauses that assert distinctness rather than language (all four
  routes agree · the three 404s differ · the two 400s differ),
- and the whole **KNOWN GAP** section, which is unchanged behaviour and must pass on both.

That is what makes those clauses a differential rather than a restatement of the new
behaviour. Stash popped, lane restarted, green again ×2.

---

## Done-protocol

| rung | outcome |
|---|---|
| **seven be suites green ×2** | **PASS** — `7 passed, 411 passed` on both runs. Per suite: classes 47 · progress 97 · subjects-classid 48 · teacher-school 52 · hardening 99 · catchall-and-log-naming 22 · **arabic-messages 46**. |
| **perimeter differential** | **PASS**, three ways. (a) Every `error.type` byte-identical to its recording — a ten-row table (`subject_not_found` · `invalid_request` ×4 surfaces · `not_found` · `class_not_found` · `teacher_required` · `forbidden`), each asserted with its status code. **No type and no status moved.** (b) Six whole error bodies compared to recorded literals byte for byte. (c) The `/api` index by exact set equality both directions, and `/health` still answers. All of (a)(b)(c) passed against the OLD code as well. |
| **freeze audit** | **PASS** — `git status` in the be worktree is exactly `src/app.ts` + `src/routes/subjects.ts`, +12/−6. Every frozen path clean: all of `src/store/`, `src/teacher.ts`, `src/inflight.ts`, `src/claude/`, `src/config.ts`, `src/mutationlog.ts`, `agent/`, and the four route files be-7 must not touch (`classes.ts`, `progress.ts`, `auth.ts`, `exams.ts`, plus `corrections.ts`/`admin.ts`). **`src/app.ts:254,265` — the explicitly out-of-scope pass-throughs — are untouched**, as is every `error.type` and every status code in the diff. Scoped to be paths (WF-63): an `fe` agent was working fe-4 concurrently. |
| **`tools/ci be --slug classes-progress` from the be worktree** | **PASS ×2** — `gate PASS (1 ran, 0 skipped)`. |
| **revert-check** | **PASS** — 15 red, all of them the right clauses, nothing else moved. Above. |
| **promoted net (spot check)** | The three promoted suites that exercise these surfaces — `persistence/subjects-api`, `persistence/health-store`, `parallel-exercises/skills-catalogue` — re-run against the changed code: **57 passed**. They assert `status` + `error.type` only, never a message, which is why they were unaffected. |

---

## The full sweep — every English string a teacher can still reach

The sub-issue asked for a sweep beyond its six sites, including branches reached only via an
error path. It found **one class the six-site list missed entirely**, plus the pass-through
class the sub-issue already excluded. **Neither was fixed** — the Delta names six sites and
says so twice.

### ① NEW — `invalidSubject`, five English literals on `POST /api/subjects`

`src/routes/subjects.ts:103-116` returns five English strings, handed straight to `bad()` at
`:144`. Reproduced live, all five:

| probe | body |
|---|---|
| `{}` | `400 {"…message":"subject is required","type":"invalid_request"}` |
| `{subject:{title:1}}` | `"subject.title must be a string"` |
| `{subject:{title:"ت",exercises:[]}}` | `"subject.exercises must be a non-empty array"` |
| an exercise with `id:""` | `"every exercise needs a non-empty id"` |
| duplicate exercise ids | `"exercise ids must be unique"` |

**This is the same defect be-7 just fixed, in the same file, on the save path.** It is
teacher-reachable: `POST /api/subjects` is how every exam is stored, and `fe` renders the
message raw.

**Why the six-site list missed it, twice.** be-6's recording command was
`grep -rn '"[A-Za-z]…"' src/routes/ src/app.ts | grep -i message`. These strings are
`return "…"` inside a validator — no `message` on the line — so the grep *could not* see
them. It is a hole in the recording, not a judgement that they are fine.

**Left alone, and pinned rather than skipped.** Section 6 of the new suite asserts these five
bodies are **still English** (`expect(message).toMatch(/[A-Za-z]{4,}/)`), with a comment
naming it a defect. That is be-5's precedent (it pinned the English catch-all as an inherited
gap; be-6 then superseded it) and it means closing this is a **declared supersession with a
red test to point at**, not a silent drive-by. The source sweep's `ALLOWED_ENGLISH` list
holds exactly these five strings, and one clause asserts each is still really in the source —
so a stale exemption cannot quietly widen the sweep.

### ② The pass-throughs — `err.message` reaching the wire (the sub-issue's own exclusion)

`app.ts:254,265` render `ClaudeError.message` and `StoreError.message` verbatim. The strings
originate outside these files, so fixing them means **mapping by `error.type`**, not editing
a literal. Left alone as instructed. The inventory is wider than be-6 recorded:

| origin | example message | reaches a teacher as |
|---|---|---|
| `src/store/client.ts:66` | `"datastore unavailable"` | `503 store_unavailable` |
| `src/claude/runner.ts:~293` | `"claude did not return JSON"` · `` `claude exited N` `` | `502 claude_bad_output` / `claude_exit` |
| `src/claude/runner.ts:~271` | `"install Claude Code, or set CLAUDE_BIN to its path"` (detail) | `503 claude_not_installed` |
| `src/claude/runner.ts:~254` | timeout message | `504 claude_timeout` |
| **`src/routes/exams.ts:154,160,166,174,180,183,198`** | **`"the plan did not return any assignments"`, `` `the plan's points sum to ${sum}, not ${totalPoints}` ``, `` `assignment ex2 has no label` ``, …** | **`502 claude_bad_output` on `POST /api/exams`** |
| `src/routes/subjects.ts:591` | `"could not regenerate this exercise"` + English detail | `502` on regenerate |
| `src/store/subjects.ts:193` (`ExerciseNotFound`) | `` `exercise "ex9" is not in this subject` `` | `409 exercise_not_found` (`subjects.ts:524`) |

**The `exams.ts` rows are new — be-6 did not list them.** They are worth flagging separately
because they are *not* third-party strings: this repo writes them, and they describe plan
verification to a teacher who has no idea what a plan is. They only *look* like
pass-throughs because they travel through `ClaudeError`. Whoever picks up the mapping job
should note that these seven could be fixed as literals; the rest genuinely need a map.

### ③ Everything else is clean

After this change, **every `message:` string literal in `src/` is Arabic** — 16 of them,
verified by the sweep. Every `bad(res, req, "…")` literal is Arabic. `classes.ts`,
`progress.ts`, `auth.ts` (including the school surface), `admin.ts`, `corrections.ts` and
`teacher.ts` have no English message at all.

---

## Open — what be-7 did not settle

1. **The five `invalidSubject` literals (①).** The single most actionable leftover: same
   defect, same file, teacher-reachable, and now pinned by a test that documents it. It is
   an `S` sub-issue with a ready-made oracle — flip section 6's assertions and delete the
   five `ALLOWED_ENGLISH` entries.
2. **The `err.message` mapping job (②).** Needs a decision before a ticket: does a teacher
   see a generic Arabic message per `error.type` (losing the diagnostic), or a generic
   message plus a `detail` that only an operator reads? The `exams.ts` seven can be fixed as
   literals either way and could ship first.
3. **The lost skill name.** `app.ts:183` no longer echoes the rejected name to anyone,
   including an operator, and no log line replaces it. A one-line structured log would close
   it; it is route logic, so it was out of this Delta.
4. **`/api/generate`'s two 400s still have no `correlationId` in the body.** Every other
   error body in the service carries one — be-6 fixed the catch-all for exactly this. These
   two are the last exceptions. `fe` reads `payload.correlationId`, never the header, so a
   teacher who hits one cannot be given a traceable id. Not touched: adding a field is a
   body change, and be-7 changes `message` only. **This is the cleanest remaining
   one-liner in the file.**
5. **`fe` still renders `error.message` raw.** be-7 made six more strings safe to render; it
   did not make rendering-raw safe as a *policy*. Every item above sits on that hazard.
6. **The wordings are product calls.** Six strings chosen against a stated constraint, in
   the codebase's existing voice, by an implementer and not a spec. The oracle deliberately
   does **not** lock them — a reword is a one-line change and no test edit.

## review

**Verdict: approve-with-debt.** Cross-model review (Fable).

The six literals verified live in Arabic; the source sweep's design (assert the absence
of a Latin word, never pin a translation) is the right shape and its anti-vacuity
clauses are real. The revert-check (15 red, exactly the six behaviours) re-read and
accepted. The dropped skill-name echo is a real diagnostic loss, honestly recorded.

The debt is the sweep's blind spot, which known-gaps states and I confirm: the `FILES`
list omits `src/store/*`, and the one English literal be-7 misfiled (`exercise "ex9" is
not in this subject`, `store/subjects.ts` — written in this repo, not a pass-through)
lives exactly there. Widening the sweep is a one-line change to a frozen oracle — a
declared supersession for the next sub-issue that touches this ground. The five
`invalidSubject` literals remain the most actionable leftover, with a ready-made oracle.
