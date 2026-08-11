# be-3 — journal · subjects adopt `classId` without losing the past

Implementer: `be` stack agent. Lane slot 8 (`be` :9800, log `/tmp/teacher-backend.s8.log`).
Budget: 10 iterations. **Used: 1.**

---

## Pre-flight (runtime gate) — PASS

Re-ran the sub-issue's Ground-truth commands against the live lane before writing a line.

| probe | recorded | observed 2026-08-11 | verdict |
|---|---|---|---|
| `db.subjects.countDocuments({classId:{$exists:true}})` | `0` of `8423` | `0` of `8423` | match |
| plant `classId` in Mongo → `GET /api/subjects/:id` | field does not appear | keys `correlationId costUsd createdAt durationMs genCorrelationId id subject updatedAt` — **no `classId`** | match |
| same plant → `GET /api/subjects` (list) | field does not appear | keys `costUsd createdAt durationMs exerciseCount genCorrelationId id title totalPoints updatedAt` — **no `classId`** | match |
| `explain("executionStats")` on `{teacherId}` sort `updatedAt:-1` | `IXSCAN teacherId_1_updatedAt_-1`, keys 1 / docs 1 | `FETCH ← IXSCAN teacherId_1_updatedAt_-1`, keys 1 / docs 1 / returned 1 | match |
| `/api` index | grew by be-1 and be-2 | `/health /api/skills /api/generate /api/teacher /api/subjects /api/exams /api/classes /api/progress /api/auth/{signup,signin,recover}` | nothing vanished |

The planted subject and its minted teacher were removed after the read; the collection is
back to `0` of `8423`.

The plant/read probe is the whole reason this sub-issue is safe to land before `fe`: the
projections are field-explicit whitelists, so a stored `classId` is invisible on the wire
until the key is deliberately added. That is the compat proof, and it is also the thing
that makes the *first* wire change auditable — exactly one key appears, and the perimeter
differential below can be a set difference rather than an argument.

Sub-issue is loop-ready. Proceeding.

---

## Cycle 1 — the oracle, then the four lines of source

**Oracle first, then frozen.**
`features/classes-progress/tests/be/subjects-classid.characterization.test.js`,
**48 clauses**, committed at `3e3ed8d` BEFORE a line of source existed. Red as written:
**30 failed, 162 passed** (the 162 are be-1's 47, be-2's 97 and the 18 of mine that pass
against a service where nothing has changed yet). Lane and store come from `CHAR_BE_URL`
and the standard Mongo URI; no port appears in the file.

Four decisions were made while writing the suite, because a frozen oracle has to state
them before an implementation can be judged against them:

1. **The legacy pin is asked four ways, and it has a counterweight.** The failure it
   defends against is invisible to shape assertions — a legacy subject filtered out as
   "another class's" leaves every key set perfect and every list empty. So: legacy under
   `?classId=<class A>`, legacy under `?classId=<class B>`, legacy unfiltered, and legacy
   still opening by id through the frozen `getOwned`. And because all four could be
   satisfied by simply never filtering, the counterweight is pinned too: a class-A subject
   must NOT appear under `?classId=<class B>`.
2. **Six degenerate values are planted straight into Mongo** — `42`, `{}`, `[]`, `true`,
   `""`, explicit `null` — one probe per variant (WF-70), each asserted twice: legacy in
   both projections, and still present in a filtered list. A `doc.classId ?? null`
   passthrough fails twelve clauses. The empty string is the sharp one: it passes a bare
   `typeof === "string"` check and would then be a class id that matches nothing while
   still excluding its subject from every legacy-inclusive list.
3. **`classOf` returns the stored string VERBATIM and does not re-check ownership.** A
   subject carrying another teacher's class id is that class's, not legacy. Pinned
   explicitly, because the tempting "fix" — validating ownership inside a projection —
   is the post-hoc check every store in this service refuses, and the `{teacherId}` scope
   is what already makes it harmless.
4. **The UPPERCASE of a real owned class id must be a 404.** `ObjectId.isValid` accepts
   uppercase hex, so without a guard an uppercased id resolves to a real class through a
   spelling this product does not use — a second id convention arriving by accident. be-2
   put the same guard on `/api/progress/:classId`; this pins it on `POST /api/subjects`
   and on the list filter before be-5's probe matrix reaches them.

**The implementation, in one pass.** `classOf` next to `statusOf` (`store/subjects.ts`),
the explicit `classId` key on `toRecord` and `toSummary`, an optional 6th argument on
`create`, an optional second argument on `listByTeacher`, and on the route side one
validation branch on POST plus one query param on the list. All 48 clauses green on the
first run after the lane restart.

### Two decisions worth reading back

**The filter runs in memory, through `classOf`, and that is the design — not a shortcut.**
A Mongo predicate would have to re-state "absent, null, non-string, or empty" as a query
expression, so the definition of legacy would exist twice and could drift; the half that
drifted would be the half nothing renders, so nobody would see it. Filtering through the
same function that drives the projection makes them incapable of disagreeing. It also
means the recorded query `find({teacherId}).sort({updatedAt: -1})` does not move at all,
so the `IXSCAN teacherId_1_updatedAt_-1` (keys 1 / docs 1, SEED §2) cannot degrade under
a planner deciding differently about an `$or`. The cost is nothing: this query already
returns a teacher's whole list unpaginated.

**Absent stays absent on the document.** `create` spreads `classId` in rather than writing
`classId: null`, so a subject created without one has the same shape on disk as the 8,423
that predate the field. `classOf` reads both as legacy anyway, and the wire shape is
decided by the projection, not by what is on disk — writing an explicit null would give
new legacy subjects a second shape for no gain.

---

## Declared supersession (WF-65) — one clause, in be-2's suite

**Amended:** `RECORDED_SUMMARY_KEYS` in
`features/classes-progress/tests/be/progress.characterization.test.js:98`, and the title
of the clause that reads it (`:1086`).

**Why it is legitimate, not regression-masking.** be-2 pinned `toSummary`'s key set with
an explicit note — *"`classId` on a subject is be-3's, not this sub-issue's. A key
appearing here would mean this slice leaked into a surface it was frozen out of."* It was
a TEMPORAL guard, and be-3 is the sub-issue it was waiting for: adding exactly that one
key to `toRecord` and `toSummary` is be-3's declared Delta and contract §5's
"Projections" paragraph.

**What was amended, and what was not.** The expected SET gained `"classId"`. The
assertion did not change: it is still exact set equality, so a second key, a leaked
`teacherId` or a dropped `topic` is as red as it ever was. And the invariant is now held
in two places rather than relaxed in one — be-3's own suite pins the same key set
independently, from a different fixture. The verifier's job is to check that this is the
only prior pin touched; it is (`git diff` on the be-2 suite is one constant and one
comment, nothing else).

**Also amended, in be-3's OWN suite (transport, not clauses):** `afterAll` now sweeps
subjects **by owner** as well as by tracked id. Half this suite POSTs subjects it expects
to be refused, and a tracked-id list only learns about the ones that came back `201` — so
on a red run, where a refusal wrongly succeeds, the litter is exactly the documents
nothing knows to remove. That is not hypothetical: the two red baseline runs left 12
orphan subjects in the dev store (`مرفوض` ×4, `نوع خاطئ` ×8), which were swept by hand
before the done-protocol ran. No clause changed.

Incidentally that litter is itself evidence: every one of those 12 was written at 00:19
and 00:22, **before** the code landed. After it, three green runs stored nothing —
which is what the "a refused create stores NOTHING" clause asserts, confirmed three more
times against the real store.

---

## Done-protocol

### 1 · Oracle green ×2 — PASS

```
tools/ci be --slug classes-progress   (from stacks/teacher-be)
  run 1 → gate PASS  192/192 ran
  run 2 → gate PASS  192/192 ran
```

All three suites, no regression: **be-1 47 · be-2 97 · be-3 48 = 192.**

The store is byte-clean after both runs — `subjects=8423 · withClassId=0 · classes=0`,
identical to the pre-flight recording. A suite that leaves residue is a suite whose next
run measures its own leftovers.

### 2 · Perimeter differential — PASS, exactly one key

Live, against the lane, after the change:

| surface | recorded (pre-flight) | observed | delta |
|---|---|---|---|
| `GET /api/subjects/:id` | `correlationId costUsd createdAt durationMs genCorrelationId id subject updatedAt` | the same **+ `classId`** | **+1** |
| `GET /api/subjects` item | `costUsd createdAt durationMs exerciseCount genCorrelationId id title topic totalPoints updatedAt` | the same **+ `classId`** | **+1** |
| `GET /api/subjects` envelope | `subjects correlationId` | unchanged | 0 |
| `/api` index | 11 routes | 11 routes | 0 — be-3 adds no route |
| `GET /api/classes` item | `createdAt id name stream` | unchanged | 0 |
| `GET /api/progress/:id` `progress` | 8 keys | unchanged | 0 |
| `POST /api/exams` (frozen) | — | still calls `create` with five arguments, so a generated exam is **legacy** | contract §0 holds |

Both projections are asserted as exact set equality in the suite, so this is executable,
not a snapshot in a document.

### 3 · Freeze audit — PASS

`getOwned` (`store/subjects.ts:296-302` pre-change) is **hunk-free**. Mechanically, not
by eye — every hunk's old-line range compared against 296–302:

```
git diff -U0 -- src/store/subjects.ts | grep '^@@' → old ranges
  55 104 122 135 185 200 225 251 284 288      ← highest old line touched: 288
```

Its five call sites (`routes/subjects.ts:193,217,306,376,473`) are untouched, and two of
them are pinned executably against a legacy subject (revisions and solutions both answer
`200`-with-empty, not `404`).

Path freeze, `git status --short` on every file this sub-issue was frozen out of —
`src/teacher.ts`, `src/inflight.ts`, be-1's and be-2's stores and routes,
`src/mutationlog.ts`, `src/store/programmes.ts`, `src/routes/exams.ts`, `src/claude/` —
**empty.** The only modified files are `src/store/subjects.ts` and
`src/routes/subjects.ts`.

### 4 · `tools/ci be --slug classes-progress` — PASS, and the promoted net too

Job gate: **192/192, three suites, twice.**

Promoted regression net (`project/tests/be`, 22 suites / 509 tests) run against the JOB
checkout on lane 8: **503 passed, 6 failed.** The same net run against the **untouched
main checkout** on lane 0: **503 passed, 6 failed — the identical six**, all in
`programme-corpus` (`teacher_saas holds the same collections before and after this suite`
×3, and the maths-legend transcription clauses ×3). Pre-existing dev-environment drift,
outside this sub-issue's blast radius; zero occurrences of `classId` anywhere in either
failure log.

⚠ One precondition worth recording for whoever gates next: the promoted net needs
`npm run build` in the checkout first — three of its suites import the BUILT
`dist/store/programmes.js` and hard-fail without it. Unbuilt, the net reads 150 failed
and looks like carnage. Built, it reads 6.

### 5 · Legacy visibility — the evidence, specifically

Against **real stored data**, not fixtures. The teacher with the most stored subjects in
this dev store (12, every one of them written before classes existed):

```
GET /api/subjects                                   → 12 subjects, 12 with classId: null
GET /api/subjects?classId=<a class that is not theirs> → 12 subjects
```

Twelve of twelve survive a filter naming a class they have never heard of. That is the
whole sub-issue in one probe: had the filter been a bare equality or a `??` default, the
number on the second line would have been `0`, every key set would still have been
perfect, and the gate would have been green.

Corpus-wide after all runs: `subjects=8423 · withClassId=0 · nonStringClassId=0` — the
change is invisible to every stored document until a teacher deliberately tags one.

### 6 · Journal sealed

Budget 10, **used 1**. No stop condition met. Commits: oracle `3e3ed8d` (project),
implementation `cbf9c3e` (be).

---

## What this sub-issue did not settle

1. **`?classId=` with an EMPTY value.** The contract covers "foreign or unknown", not
   "empty". Decided here, in the direction that cannot lose a subject: an empty value is
   **no filter at all**, so a client that serialises an unset selection as `?classId=`
   gets its whole list rather than a silently-narrowed one. Pinned in the suite so it is a
   decision rather than an accident, but it is `fe`'s to contradict if the class bar wants
   the opposite.
2. **A REPEATED `?classId=` is a `400`.** Express parses it into an array, which matches
   no stored class and would look exactly like "you have no subjects". This is the only
   new way `GET /api/subjects` can fail, and it is a new failure on a surface that
   previously had none — flagged for the verifier as a judgement call, not a contract
   clause.
3. **A subject's `classId` cannot be changed after creation.** No route sets it, there is
   no `PUT`, and this slice did not need one. Moving a subject between classes, and
   tagging the 8,423 retroactively, are both unbuilt and unspecified.
4. **Generation still carries no `classId`** (contract §0), so every exam produced by
   `POST /api/exams` or `/api/generate` is legacy and shows under every class. That is
   correct for slice 1 and will look like a bug to anyone who tries the class bar before
   slice 3 binds `{format, scope, classId}` to generation.
5. **`classOf` does not verify that a stored class id still exists.** There is no delete
   route for classes, so it cannot dangle today. When one is added, a subject pointing at
   a removed class becomes invisible under every filter while remaining legacy to nothing
   — worth deciding then, not now.
