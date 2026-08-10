# be-1 — `src/store/programmes.ts`: one definition of the shape

## pre-flight · 2026-08-10

Both slot-2 recordings reproduced exactly, from the job worktree:

```
$ mongosh --quiet --eval 'print(db.getSiblingDB("teacher_saas").getCollectionNames().sort().join(", "))'
exercise_revisions, solutions, subjects, teachers        # no programmes, no programme_revisions
$ ls stacks/teacher-be/src/store/
client.ts revisions.ts solutions.ts subjects.ts teachers.ts   # no programmes.ts
```

Branches: `feature/programme-corpus` in the project worktree and in both stack repos. Both
repos clean.

## it 1 · the module

**Diagnosis.** No oracle exists yet — `features/programme-corpus/tests/be/` did not exist,
so the gate was honestly RED (WF-82). Nothing to diagnose; write the module against the
contract, then the suite.

**Action.** `src/store/programmes.ts`, the only be-repo file. Exports exactly what the
sub-issue's delta names — `validateProgrammeLine`, `validateWeekLine`, `assembleDoc`,
`canonicalContentHash`, `ensureProgrammeIndexes`, `upsertProgramme`, `getProgramme` —
plus `fieldDifferences` (the refusal's field-path summary, which the loader must print and
which has no other home) and the `SeedError` / `HandEditError` classes the state table
needs to be expressible.

Three decisions worth recording:

1. **Whole-file rules live in `assembleDoc`, not in a separate validator.** The 27-week
   count, the 1..27 ordinal sequence, `unitId ∈ units.id`, and the emphasis guards all need
   the programme line and the week lines together. `assembleDoc` is the only function that
   sees both, so it enforces them and throws `SeedError` carrying **every** problem — a
   transcription pass fixes a file once, not once per line.
2. **Unknown keys are rejected everywhere.** The contract enumerates the fields; the seed is
   hand-written across ~13 passes; a mistyped key that merely got dropped would lose a page
   of reading in silence. It also makes the `trimester` ban structural rather than a special
   case — though `trimester` still gets its own message, because it is a decision somebody
   may try to undo on purpose.
3. **`dryRun` is an option on `upsertProgramme`, not logic in the loader.** be-2 needs
   `--dry-run` to exercise the *same* decision path as a real load; a second copy of the
   state table in the CLI is exactly the drift this module exists to prevent.

**Result.** `npm run typecheck` clean under `strict` + `noUncheckedIndexedAccess`.

**Belief update.** The contract is implementable as written. One gap it left open — see
`## contract notes` below.

## it 2 · the oracle, and the ESM/jest wall

**Diagnosis.** The suite has to call the module's functions, but the characterization
harness is **CommonJS jest** and `teacher-be` is `"type": "module"`. Verified by running,
not assumed:

```
$ CHAR_ROOTDIR=… npx jest -c tools/tests/jest.characterization.config.js
SyntaxError: Cannot use import statement outside a module
    at ModuleExecutor.compile (jest-runtime/build/index.js:2104:44)
```

jest 30's CJS runtime cannot `require()` the ESM build, and dynamic `import()` needs
`--experimental-vm-modules`, which the shared config does not set (and which is not mine to
change — the config is engine, shared by every job).

**Action.** Reach the module the way the real callers do: as a **child process**. The stack
spec already prescribes exactly this for be-2/be-3 ("suites spawn `node
stacks/teacher-be/scripts/<x>.mjs` … and assert on exit code + output"); `probe-programmes.mjs`
is the same seam for a library module. Mongo itself is driven from the suite with the
driver directly (that part is plain CJS), so only the module's own functions go through the
probe.

Fixtures: `fixtures/seed-fixtures.js` builds a base document shaped like the real شعبة
الرياضيات summary table — weeklyHours 7, totals 27/189, the actual 14 unit rows including
the three repeated معالجة, one unprinted `weekNumberPrinted`, one red row. Every negative is
a **named mutation of that base** rather than a committed near-duplicate file, so a change
to the base cannot leave a stale negative silently passing.

**Result.** Red twice for harness reasons, both fixed and both worth recording because they
are the two ways this seam breaks:
- `PROBE_MODULE` was not passed into `execFileSync`'s env → the probe refused, loudly, which
  is the behaviour I wanted from it.
- `mongodb` could not be resolved from the probe: the suite lives in the **project** repo
  (WF-53), which has no `node_modules`. Fixed by resolving it from the BE checkout with
  `createRequire`, derived from `PROBE_MODULE`'s path.

Three expected line numbers were off by one (I counted the fixture's array index, not the
file line). The oracle was right and the expectation was wrong — corrected in the test, not
in the module.

**Belief update.** The harness seam is settled for all three sub-issues.

## done-protocol

| rung | result |
|---|---|
| oracle green ×2 | `tools/ci be --slug programme-corpus` → `gate PASS`, 32/32, twice |
| perimeter differential | `teacher_saas` still `exercise_revisions, solutions, subjects, teachers`; `ls src/store/` differs only by the new `programmes.ts`; `ls scripts/` byte-identical |
| freeze audit | be repo: `?? src/store/programmes.ts` only. `git status --short -- agent/ src/routes/ src/app.ts` empty · `teacher-fe` clean · `docs/reference/curriculum/` clean. Project repo: `?? features/programme-corpus/tests/` only |
| promoted `be` net vs the JOB checkout | 363/364. See the note below — it is a load flake, not a regression |
| mutation spot-check | **15 mutants, 15 killed, 0 survived** |

### The one promoted-net failure

`tests/be/persistence-gaps/auth-recover.characterization.test.js` → *"the code resets the
password and returns the SAME teacherId"* — `thrown: "Exceeded timeout of 5000 ms"`. A
timeout, not an assertion. That path does two scrypt hashes plus a sign-up, and the whole
19-suite run took 135 s on a machine that was also rebuilding TypeScript. Re-run in
isolation: **21/21 pass in 3.5 s**. This job touches no auth code (see the freeze audit), so
it is machine load, not this change.

### Mutation spot-check detail

Fifteen mutants, one per guarded behaviour, each applied to `src/store/programmes.ts`,
rebuilt, gated, restored:

| # | mutant | verdict |
|---|---|---|
| M1 | `emphasis` no longer required | KILLED |
| M2 | the `added-2022` ⇒ legend guard dropped | KILLED |
| M3 | the `red-unlegended` ⇒ no-legend guard dropped | KILLED |
| M4 | canonical JSON stops sorting keys | KILLED |
| M5 | the hash stops excluding volatile fields | KILLED |
| M6 | the hand-edit check never fires | KILLED |
| M7 | a changed file is written without `--correct` | KILLED |
| M8 | `source.pdfPages` may be empty | KILLED |
| M9 | unknown keys (incl. `trimester`) accepted | KILLED |
| M10 | `{docKey, edition}` no longer unique | KILLED |
| M11 | other editions are not demoted | KILLED |
| M12 | the 27-week count check dropped | KILLED |
| M13 | the week ordinal sequence unchecked | KILLED |
| M14 | `unitId` referential integrity dropped | KILLED |
| M15 | no revision row written on `--correct` | KILLED |

**Kill rate 15/15.** M6, M7 and M15 were first written as `if (false) { … }` and were
rejected by `tsc` rather than by the oracle — TypeScript treats a literally-unreachable
block as un-narrowed, so `stored` went back to `… | null`. A compile failure is a weak kill,
so those three were re-run with runtime-opaque conditions (`&& contentHash === "never"`) and
killed behaviourally.

## contract notes

Nothing in the contract proved wrong or unbuildable. Two things it did not cover, decided
here and recorded rather than assumed:

1. **Whether `assembleDoc` strips the `type` discriminator.** It does. `type` tells the
   JSONL parser which line it is holding; it is not a fact about the programme, and leaving
   it in would put it inside `contentHash`.
2. **Whether unknown keys are an error.** The contract enumerates fields but does not say
   what happens to an unlisted one. Decided: reject, everywhere, naming the path. This is
   strictly stronger than the contract and makes the `trimester` prohibition structural. If
   a later document genuinely needs a new field, that is a contract change — a stop-and-ask —
   which is the right cost.

**Status: done.**
