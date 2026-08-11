# Known gaps at the end of IMPLEMENT — input to /qa and /document

Every item was found by an independent verifier or an implementer's sweep, and each is
recorded rather than fixed because it fell outside the sub-issue's Delta. Nothing here is
speculative; each has a reproduction.

## Reachable English on an Arabic-only product (the hard constraint)

be-6 and be-7 closed seven literals. **Six remain reachable**, and one was misfiled:

| where | string | note |
|---|---|---|
| `src/routes/subjects.ts:103-116` `invalidSubject` | five literals (`"subject is required"`, `"subject.title must be a string"`, `"subject.exercises must be a non-empty array"`, `"every exercise needs a non-empty id"`, `"exercise ids must be unique"`) | on the **save** path. be-7 pinned them RED on purpose, so closing them is a declared supersession with a test to point at. |
| `src/store/subjects.ts:193` | `exercise "ex9" is not in this subject` (409) | **be-7 misfiled this as a third-party pass-through.** It is written in this repo — a one-line literal fix, not an `error.type` mapping job. |

**be-7's source sweep is blind to `src/store/*`** — its `FILES` list is `app.ts` plus five
route files. The sweep exists to catch the *next* English literal, and the literal it
missed lives in exactly the directory it does not read. Widen it.

**Genuinely different, do not group:** `src/app.ts:254,265` pass `err.message` through from
`ClaudeError`/`StoreError`, so the strings come from the Claude CLI and the Mongo driver —
those need mapping by `error.type`. But `src/routes/exams.ts:154,160,166,174,180,183,198`
only *look* like pass-throughs: this repo writes them, they reach a teacher as a `502` on
`POST /api/exams` (`"the plan's points sum to 18, not 20"`), and they could ship as literals
ahead of the mapping work.

## `fe` cannot map three error types `be` can emit

`fe/src/lib/api.ts`'s `KIND` table has no key for `rate_limited` (429), `payload_too_large`
(413) or `claude_bad_output` (502) — all three fall to the default
`{kind:"backend", retryable:true}`. For `payload_too_large` that is **actively wrong
advice**: a too-large body never succeeds on retry. Pre-existing (KIND gained only
`class_not_found` this whole job), reproduced live on 429 and 413.

## Bearer ids reach the log

Three full 32-hex teacher ids appear in the lane log via the generic request logger, as URL
**path segments** on `GET /api/admin/teachers/<32hex>/subjects`. The mutation log is clean
and be-6's clauses are correctly scoped, but "zero full 32-hex ids anywhere in the log" is
not true of the log as a whole. `teacherId` is a bearer value (`project/CLAUDE.md`), so this
is a real leak into an operator surface.

## `409 email_taken` is documented and dead

A duplicate-email sign-up returns **201 with a brand-new `teacherId`** and a decoy recovery
code — anti-enumeration by design. `be` has no `email_taken` emission left (only a comment
at `routes/auth.ts:140`), `fe` carries a dead `KIND` key, and **`project/CLAUDE.md`'s
failure-classification list still documents `409 email_taken`.** Fix the doc in `/document`.

## `/api/generate`'s two 400s carry no `correlationId` in the body

The last error family in the service without one. `fe` reads the id from the body, never the
header, so these are the two errors a caller most needs to trace and cannot.

## The stream list is a hardcoded mirror

`fe/src/lib/classdraft.ts` mirrors the six streams read out of
`project/data/programmes/*.jsonl`. The corpus is the authority and the client cannot see it —
**proven a live drift hazard**: with a synthetic 7th-stream programme in the corpus, `be`
accepted a class on it while the UI picker still offered six. Defensible only because `be`
refuses an unknown value on the row that caused it, so drift fails loudly. **`GET /api/streams`
is the real fix and deserves a sub-issue, not a journal note.**

## Smaller, recorded

- **A failed progress *read* degrades to silence** — no panel, no rail, and a failed read
  looks identical to a real week-0 class in the bar. fe-5 judged the silence correct (an
  error surface would put a class banner in front of every teacher who has none, on any `be`
  predating this slice) and pinned it. The load-bearing half is that a failed read gets **no
  setter**, so nobody is asked to re-answer at `rev` 0.
- **Step 4 renders `ClassPosition` at full size per class**, so its eyebrow and lede repeat
  under a step that already asked once. fe-4 fixed it with host styling because
  `ClassPosition` was outside its Delta; a `compact` prop is the real answer.
- **`school` is write-only on `be`**, so «أقسامي» shows no school field — a blank input would
  silently clear a stored value. The design's account screen has one.
- **`POST /api/classes` is unrate-limited** and step 3 will create ten classes in one press.
- **Every zero-class teacher now fires one extra `GET /api/classes` per boot** (~17,861 × one
  round trip). Inherent to the feature; the DOM and `/api/subjects` are byte-stable, the
  request *set* is not.
- **`entry` (per-week status/note) is contractual but has no client** — slice 1 writes
  `markedWeek` only. Re-read it against the real tracker in slice 2 rather than assuming the
  tests defined it.
- **Journal accuracy, fe-4:** it justified its Delta extension by citing `onAuthenticated` as
  "the sub-issue's own text". It is not in `stacks/fe.md`, `contracts/` or `SEED.md` — it came
  from the implementer's task brief. The extension itself is sound and the verifier accepted
  it; the attribution was wrong. It also called the `AuthPanel` diff three hunks; it is four.
