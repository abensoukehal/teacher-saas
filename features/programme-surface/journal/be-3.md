# be-3 — main's promoted gate is not red, it is non-deterministic

**Stack:** be · **tag:** hardening · **depends_on:** be-1
**Lane:** slot 9 — be `http://localhost:9900`
**Host while measuring:** 8 cores, load average **2.0–4.2** throughout. Run alone; no other
loop was scheduled. Every number below was taken at that load, and where load mattered it
is called out.

---

## 1 · The root cause, and it is not what be-2 guessed

**`tools/tests/jest.characterization.config.js` lost `maxWorkers: 1`.** The promoted net has
been running on jest's default worker pool (cores−1 = 7) since 2026-08-11 06:00.

be-2's hypothesis was that the three `programme-corpus` suites contend over the shared
scratch database. That is *a* mechanism — but it is a symptom. The suites contend because
they run **at the same time**, and they run at the same time because the one-worker rule
WF-89 installed for exactly this class of failure was silently reverted.

### The archaeology

```
3b20e8c  ci: one worker for black-box suites — they share the lane's service   ← WF-89 adds maxWorkers: 1
6964a26  engine: pull from lablabee                                            ← REMOVES it
```

`git show 6964a26 -- tools/tests/jest.characterization.config.js` is a pure deletion of the
eight-line WF-89 block. The other clone's copy of the engine file predated the fix, and
`tools/harness pull` is path-scoped but not three-way: it took the older file wholesale.
The CHANGELOG entry for WF-89 still stands in `workflow/CHANGELOG.md:108` describing a rule
the code no longer carries — which is why the sub-issue could quote `maxWorkers: 1` as a
fact and be wrong.

### The measurement that proves it

Same tree, same minute, same lane, load ~2.0:

| invocation | workers | result | wall |
|---|---|---|---|
| `tools/ci be` (clone root, as shipped) | default (7) | **30 failed** / 479 passed / 509 | 30 s, 194 % cpu |
| same jest, same env, `--maxWorkers=1` | 1 | **6 failed** / 503 passed / 509 | 151 s, 37 % cpu |
| repeat of the serial run | 1 | **6 failed** / 503 passed / 509 | — |

Twenty-four of the thirty failures were manufactured by the worker pool. The two clearest:

- `loader › run-log.jsonl is neither written nor created` — expected 797 643 bytes, received
  800 532. A *black-box* suite on another worker was driving the live service, which appends
  to the same `run-log.jsonl` the loader suite snapshots. Exactly WF-89's shared-state case.
- `accounts-hardening › roles-admin` — 5 s jest timeout. Seven scrypt-hashing workers on
  8 cores.

And the corpus contention be-2 suspected is real underneath it: all three suites use scratch
db `programme_corpus_ci` (not `programme_corpus`), and `loader.characterization.test.js`
runs `await db.dropDatabase()` in **`beforeEach`** — a sibling suite's loader child process
can have its database dropped mid-run.

### Why this is a stop-and-ask, not a fix

The file is **engine** (`tools/`), travels between clones on `tools/harness push`, and is
outside this sub-issue's Delta. The sub-issue names this case explicitly: *"the right answer
might be a serialisation rule in `tools/ci`, which is engine and out of this Delta."* Not
fixed here. The one-line restore is quoted in the report.

Every measurement below was therefore taken with `--maxWorkers=1` forced on the command line
by a scratch harness that reproduces `tools/ci`'s environment exactly — no file was edited to
obtain it.

---

## 2 · The re-measured baseline — five consecutive runs

With serialisation forced and the amendment (§3) in place, against the **feature branch's**
copy of the promoted net:

```
run 2   3 failed / 506 passed / 509 total   load 4.11
run 3   3 failed / 506 passed / 509 total   load 2.29
run 4   3 failed / 506 passed / 509 total   load 2.83
run 5   3 failed / 506 passed / 509 total   load 3.19
run 6   3 failed / 506 passed / 509 total   load 2.44
```

Five consecutive runs, byte-identical failure sets. The baseline is now subtractable: it is
**3**, and the three are always the same three clauses. (An earlier five-run block against
the byte-identical main-checkout copy gave the same 3/506/509 five times over.)

**One outlier, and it is environmental.** Branch run 1, started at load 4.11, added a fourth
failure: `persistence-gaps/auth-recover › the code resets the password and returns the SAME
teacherId` — a **5 s jest timeout**, not an assertion. That clause does a sign-up plus a
recovery, i.e. several scrypt hashes, against jest's default 5 s budget. It is load-sensitive
by construction and appeared once in nine serialised runs. Reported, not touched: it is not
in this Delta and it is not the non-determinism this sub-issue was opened for.

---

## 3 · WF-65 declared supersession of a promoted oracle

**Which clauses.** Exactly three, one per file:

```
tests/be/programme-corpus/loader.characterization.test.js
    be-2 · perimeter › "teacher_saas is untouched by this suite"
tests/be/programme-corpus/programmes-store.characterization.test.js
    be-1 · perimeter › "teacher_saas holds the same collections before and after this suite"
tests/be/programme-corpus/verifier.characterization.test.js
    be-3 · CLI surface + perimeter › "teacher_saas is untouched by this suite"
```

**Why.** Each enumerated the database's collections against a hardcoded literal, recorded
before `classes-progress` added `classes` and `progress`. They had already been re-baselined
once (be-9, to admit the corpus collections). A clause that every collection-adding job must
hand-edit is a clause that reads red for reasons that have nothing to do with the perimeter
it guards. Proven pre-existing: be-1's verifier ran these suites against base `7c18729` and
got byte-identical results on both sides.

**What replaced it — the stronger form, not a widened list.** The hardcoded enumeration is
**deleted**, not extended. Each file's top-level `beforeAll` now snapshots
`realCollectionsBefore`, and the clause asserts

```js
expect(names).toEqual(realCollectionsBefore);
```

— **exact set equality against a measurement taken inside the same run.** This is what each
clause's own *name* always claimed to be checking ("untouched **by this suite**"), it is
strictly the sub-issue's preferred option, and it is immune to the next collection anyone
adds. `loader.characterization.test.js:401-414` already used this before/after idiom for the
forgotten-`--db` case, with the comment *"before/after IS the assertion"* — this generalises
it to the perimeter clauses.

**What did NOT change.**

- Not weakened to a subset check. It is `toEqual` on two sorted arrays.
- The `PRODUCT` containment line is kept **verbatim**, as a non-vacuity floor: without it, a
  Mongo answering an empty list both times would pass having verified nothing. `PRODUCT` was
  not widened either — it is the same four names, guarding the same thing.
- No other clause in the three files. No other file in the promoted tree.
- The suites' scratch db, fixtures, ordering and cleanup are untouched.

**Freeze audit** — every non-comment line the promoted tree gained or lost:

```
+let realCollectionsBefore;                                    ×3
+  realCollectionsBefore = (await mongo.db(REAL_DB)…).sort();  ×3
-    const CORPUS = ["programme_revisions", "programmes"];     ×3
-    expect(names.filter(…)).toEqual([]);                      ×3
+    expect(names).toEqual(realCollectionsBefore);             ×3
```

Three files, three clauses, nothing else.

### The negative — the clauses still fire

A collection really created in `teacher_saas` by each suite, planted temporarily
(`be3_planted_probe` / `_store` / `_verifier`) and run once:

```
Tests: 6 failed, 142 passed, 148 total
  ● be-2 · perimeter › teacher_saas is untouched by this suite                       ← loader
  ● be-1 · perimeter — the real database is not touched › …same collections…         ← store
  ● be-3 · CLI surface + perimeter › teacher_saas is untouched by this suite         ← verifier
```

All three fired, and the diff names the offender:

```
    - Expected  - 0
    + Received  + 1
      Array [
    +   "be3_planted_probe",
        "classes",
        "exercise_revisions",
        …
```

Note what that diff also shows: `classes` and `progress` sit in the baseline now and are
tolerated, which is the staleness this supersession removes. Plants and collections were
removed afterwards; `grep -rn 'PLANTED\|be3_planted'` over the promoted tree is clean and
`teacher_saas` is back to its eight collections.

**A property worth recording.** Under before/after semantics, a collection planted by suite A
is *tolerated* by suite B if B runs later — B's `before` already contains it. That is correct
and intended: the clause asserts "untouched **by this suite**". The perimeter is per-suite, as
its name always said.

---

## 4 · The two small ones

**`src/routes/programme.ts:20-26`** claimed *"Express's default ETag already answers a repeat
visit with a zero-byte 304"* — which the two comments ~100 lines below disprove twice: the
envelope's per-request `correlationId` makes the default body-hash a nonce that can never
match, and `fetch` forces `cache-control: no-cache`, which makes Express's `fresh` decline to
revalidate. The header now says the 304 is this route's own, states both reasons in one
sentence each, and points at where they are argued in full. Comment only — no statement
changed, `npm run build` clean, job gate 65/65.

**`features/programme-surface/tests/be/programme.characterization.test.js`** described a
corpus that no longer exists. `\square` was a transcription placeholder for double-struck set
symbols the source PDFs fail to embed; all **61** occurrences across 3 documents were restored
through the loader with `--correct` (`transcriptionRev` 4→5, 3→4, 4→5 · `edition` unchanged ·
`programme_revisions` 9→12 · A1–A8 green on each). Verified live:

```
docs still containing \square: 0
tadarroj-3as-math      transcriptionRev 5
tadarroj-3as-techmath  transcriptionRev 5
tadarroj-3as-sciences  transcriptionRev 4
programme_revisions: 12
```

**No assertion expected `\square`** — `grep -n square` finds it in two comments only, and the
clauses are byte-compares against the store, so they survived the correction untouched. So
this is prose, not a stale pin, and no supersession is declared for it. Both comments now say
so, and the second one turns it into the argument for byte-compares over fixtures: a fixture
would have gone red for a change that was right.

---

## 5 · Left open — three things, none of them mine to close

1. **The engine one-liner.** `maxWorkers: 1` must go back into
   `tools/tests/jest.characterization.config.js`. Until it does, `tools/ci be` from the clone
   root stays non-deterministic no matter what the suites say. Engine, out of Delta.
2. **Three deterministic reds this sub-issue did not know about.**
   `programmes-store.characterization.test.js:618` resolves its seed as
   `__dirname/../../../../data/programmes/…`. That was right where the suite was authored
   (`features/<slug>/tests/be/`) and is one `..` too many where `tools/promote-tests` put it
   (`tests/be/<slug>/`), so it reads `<clone-root>/data/programmes/` and gets ENOENT. A
   promotion-time path bug, unrelated to slice 1 or 2, and the reason the gate cannot reach
   green×5 today. Ask-when: *a promoted clause is red for a reason unrelated to slice 1.*
3. **One load-sensitive clause.** `persistence-gaps/auth-recover` at jest's 5 s default over
   two scrypt hashes. §2.

Nothing in `src/` other than one comment block. `git status --short` in `stacks/teacher-fe`
empty; in `stacks/teacher-be`, `src/routes/programme.ts` only.
