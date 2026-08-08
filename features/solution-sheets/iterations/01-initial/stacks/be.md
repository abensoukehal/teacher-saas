# Stack spec — teacher-be

> Filled by `/planning` 2026-08-08 from the locked SEED.

## Scope recap
- **Modules:** `agent/.claude/skills/solution-sheet/SKILL.md` (**new — this is the
  capability**) · `src/store/solutions.ts` (new) · `src/routes/subjects.ts` (modify)
- **Contract:** `contracts/fe-be-solutions.contract.md`
- **Not in scope:** generating from `be` (the contract puts the spawn in `/api/generate`,
  where it already is) · refining a solution by instruction · a history of corrections.

## Current behavior baseline

| Surface | Today |
|---|---|
| `GET /api/skills` | exactly two: `exam-subject`, `refine-exercise` — a **directory listing** of `config.claude.cwd + /.claude/skills` (`skills.ts:19`) |
| `POST /api/generate` skill=`solution-sheet` | `400 invalid_request`, `unknown skill` — rejected before the CLI is spawned |
| skills location | `teacher-be/agent/.claude/skills/`. **NOT the repo root** — `config.ts:39` points the CLI at `<repo>/agent` |
| cost | `exam-subject` measured **$0.6454 / 128 s**; ~**$0.20 per-invocation overhead** before any work (`agent/CLAUDE.md`) |

### Test harness — read before writing a test
Carried forward, and every line of it was earned:
- **Black-box over HTTP.** `dist/` is ESM; jest's CJS runner cannot import it.
- Filename must match `*.characterization.test.js`.
- **Every sub-issue owns an HTTP surface** or it cannot be gated.
- **Use the engine helpers, never hardcode a lane:**
  `const { describeIfLane } = require("guard"); const BE = process.env.CHAR_BE_URL || "http://localhost:9000";`
- **Keep fixtures BESIDE the suite** (`tests/be/fixtures/`), read with `__dirname`. Reaching
  out of the suite's own directory has broken promotion three times now.
- **A hollow gate is RED in job mode** (WF-82) — `tools/dev up -d` before gating.
- **NEVER call `POST /api/generate` in a test.** ~$0.65, ~128 s. Replay a recording.

## Observability
- Visible: `run-log.jsonl` run lines (`skill`, `costUsd`, `durationMs`, `ok`) — a solution
  run appears here automatically with `skill:"solution-sheet"`, so cost stays answerable.
- Blind spot this job must not create: **staleness must be visible**. A correction that
  silently describes an exercise the teacher no longer has is worse than none.

## Data model changes

| Store | Change |
|---|---|
| `solutions` (**new**) | `subjectId, teacherId, exerciseId, answer, scale[], answersHash, genCorrelationId, createdAt, updatedAt`; unique `{subjectId:1, exerciseId:1}` |

Nothing existing is migrated. `subjects` is untouched.

## Surfaces

| Surface | Path | New/Modify |
|---|---|---|
| `POST /api/subjects/:id/solutions` | `src/routes/subjects.ts` | new |
| `GET /api/subjects/:id/solutions` | `src/routes/subjects.ts` | new |
| `solution-sheet` skill | `agent/.claude/skills/solution-sheet/SKILL.md` | new |

## Skills touched

| Skill | New/Modify | Produces | Judged on |
|---|---|---|---|
| `solution-sheet` | **new** | `{solutions:[{exerciseId, answer, scale[]}]}` | scale sums to the exercise's `points` · one entry per exercise, no invented ids · Arabic only, maths in `$…$`, no LaTeX visible · answers are *worked*, not bare results |

> A skill's oracle is not a string match. "Is the mathematics right" is not mechanically
> decidable — the teacher is the reviewer, and the product must never claim otherwise.
> What IS checkable is the list above, and that is what gets pinned.

---

## Sub-issues

```yaml
---
kind: sub-issue
id: be-1
parent: i1
stack: be
status: done
depends_on: []
estimate: M
---
```

### be-1 — the `solution-sheet` capability

1. **Intent:** the product's unit of capability is a SKILL.md; a correction is a new kind
   of generated material, so it is a new skill and not new orchestration code.

2. **Ground truth (recorded + re-run):**
   ```bash
   $ curl -s localhost:9400/api/skills | python3 -c "import json,sys;print([s['name'] for s in json.load(sys.stdin)['skills']])"
   ['exam-subject', 'refine-exercise']
   $ curl -sX POST -H 'content-type: application/json' -d '{"skill":"solution-sheet","input":{}}' localhost:9400/api/generate
   {"error":{"message":"unknown skill \"solution-sheet\"","type":"invalid_request"}}
   ```
   Pre-flight must reproduce both.

3. **Delta:** `teacher-be/agent/.claude/skills/solution-sheet/SKILL.md` — **new**, and the
   ONLY file. No `src/` change: `skills.ts` reads the directory, so registration is the
   directory existing. **Everything else frozen.**
   Freeze: `git status --short -- agent/.claude/skills/solution-sheet/`

4. **Oracle (two-sided, executable):**
   - *positive:* `GET /api/skills` now lists **three**, including `solution-sheet` with a
     non-empty Arabic-aware description. No code changed — this proves the catalogue is a
     directory listing.
   - *positive:* `POST /api/generate {skill:"solution-sheet"}` is **no longer rejected** as
     unknown (it may fail for other reasons; it must not 400 on the name).
   - *positive — ONE REAL RUN, recorded once:* run the skill against the recorded exam and
     save the envelope to `features/solution-sheets/tests/be/fixtures/rec-solution-sheet.<date>.json`.
     **This is the job's single paid generation** (~$0.65+). Every downstream sub-issue
     replays it. Assert on the recording:
       - one entry per exercise in the input, ids exactly `ex1..exN`, **none invented**
       - each `scale[]` sums to that exercise's `points` (6, 6, 8)
       - `answer` and every `scale[].part` contain Arabic and **no Latin-alphabet sentences**
       - no ``` fence and no prose around the JSON
   - *negative:* the other two skills' entries in `/api/skills` are byte-stable.
   - *obs:* the run appears in `run-log.jsonl` with `skill:"solution-sheet"` and a `costUsd`.

5. **Boundaries:** honours the contract's § The skill. Bulk reference belongs in
   `curriculum/`, never in the SKILL.md body — every invocation is charged ~$0.20 of context
   before any work. Budget: 10 iterations.

6. **Exit:** done-when = oracle green + freeze respected + `tools/ci be --slug solution-sheets`
   green · ask-when = the skill would need `src/` changes to register (it must not) · a
   second paid run seems necessary · the recorded output cannot satisfy the checkable
   properties even after prompt work (that is a real finding, not a retry).

```yaml
---
kind: sub-issue
id: be-2
parent: i1
stack: be
status: done
depends_on: [be-1]
estimate: L
---
```

### be-2 — store a correction, and tell the truth about staleness

1. **Intent:** a correction must survive, attach to the exercise it answers, and be shown
   as stale the moment that exercise changes — a stale correction reaches a class.

2. **Ground truth (recorded + re-run):**
   ```bash
   $ mongosh --quiet --eval 'print(db.getSiblingDB("teacher_saas").getCollectionNames().sort().join(", "))'
   exercise_revisions, subjects, teachers          # no `solutions`
   $ curl -s -H "x-teacher-id: <id>" localhost:9400/api/subjects/<sid>/solutions
   404 / not found — the route does not exist
   ```

3. **Delta:**
   - `teacher-be/src/store/solutions.ts` — **new**: `upsertMany`, `listFor`, `ensureIndex`,
     and the statement hash.
   - `teacher-be/src/routes/subjects.ts` — add `POST` and `GET /subjects/:id/solutions`.
   **Everything else frozen** — `replaceExercise` is NOT touched: staleness is derived on
   read, so there is nothing to update when an exercise changes.
   Freeze: `git status --short -- src/store/solutions.ts src/routes/subjects.ts`

4. **Oracle (two-sided, executable)** — replays `rec-solution-sheet` and the exam fixture:
   - *positive:* POST stores one row per solution; GET returns them with `stale: false`.
   - *positive — THE LOAD-BEARING CLAUSE:* refine `ex2` via the existing `PUT`, then GET —
     **`ex2` is `stale: true` and `ex1`/`ex3` are still `stale: false`.** A design that keyed
     staleness off the subject's `rev` fails here, because `rev` advances for the whole
     document.
   - *positive:* re-POSTing a solution for `ex2` clears its staleness (upsert, one current
     correction per exercise).
   - *positive (each variant, WF-70):* staleness behaves the same for `ex1` (first), `ex2`
     (middle) and `ex3` (last).
   - *positive:* no solutions → `200 {solutions: []}`, never 404.
   - *negative:* an `exerciseId` not in the exam → `400 invalid_request`, **nothing stored**.
   - *negative:* a `scale[]` that does not sum to the exercise's `points` → `400`, nothing
     stored. This is the checkable property the SEED makes the standard.
   - *negative:* another teacher's subject → `404 subject_not_found`, body identical to a
     subject that never existed.
   - *negative:* the subject read path is **byte-stable** — `GET /api/subjects/:id` gains no
     key, and the stored subject document is unchanged.
   - *negative (concurrency, from the start):* two simultaneous POSTs for the same exercise
     leave exactly **one** row (the unique index), and neither is a 500.

5. **Boundaries:** honours the contract exactly — separate collection, ownership scoped in
   the query, staleness derived not stored. Additive only. Budget: 10 iterations.

6. **Exit:** done-when = oracle green + freeze + `tools/ci be --slug solution-sheets` green ·
   ask-when = staleness cannot be derived without touching `replaceExercise` · the unique
   index cannot hold under concurrent upsert · the contract's 400 rules would need relaxing.
