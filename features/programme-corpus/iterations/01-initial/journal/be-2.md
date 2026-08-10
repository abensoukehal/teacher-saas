# be-2 — `scripts/load-programmes.mjs`: the only writer, idempotent, guarded

## pre-flight · 2026-08-10

Both slot-2 recordings reproduced, from the job worktree:

```
$ ls stacks/teacher-be/scripts/
backfill-teachers.mjs capacity.mjs purge-orphans.mjs seed-admin.mjs   # no loader
$ mongosh --quiet --eval 'print(db.getSiblingDB("teacher_saas").getCollectionNames().sort().join(", "))'
exercise_revisions, solutions, subjects, teachers                     # no programmes
```

be-1 is done and frozen: `dist/store/programmes.js` exists and its suite is green.

## it 1 · the script

**Diagnosis.** The store module already holds the entire state table (be-1 decided that
`dryRun` belongs there for exactly this reason). So this script has three jobs and no
fourth: parse arguments, parse the JSONL, translate an action into an exit code and a
report line. Anything else here would be a second copy of the shape.

**Action.** `scripts/load-programmes.mjs` — the only file. It follows the four existing
scripts' conventions (`.mjs`, `MONGO_URL`/`MONGO_DB`, argv scanned by flag name).

Decisions worth recording:

- **`--db` wins over `MONGO_DB`, which wins over `teacher_saas`.** The real database is
  never a default that a flag has to fight; a test points at a scratch db by passing one
  argument and exporting nothing.
- **Parse before validate, and never skip a blank line.** A blank line mid-file is a
  reject, not a shrug — skipping it silently would shift every line number the error
  messages quote, and those line numbers are the only thing that makes a 28-line file
  fixable.
- **The report line is unconditional.** One line, whatever happened, on every path
  including every refusal: `file= db= lines-read= weeks= rows= rejected= action=`. On any
  refusal it reads `weeks=0 rows=0` — whole-file-or-nothing means a nonzero written count
  beside a nonzero rejected count is unrepresentable, and the report says so rather than
  leaving it implied.
- **The exit code is computed, then the pool is closed, then the process exits.** A
  `process.exit()` inside the `try` would skip the `finally` and leave the connection
  dangling. Caught while writing, not by a test.

**Result.** The oracle went green on its first run — 21 new clauses, 53 total with be-1's.

**Belief update.** be-1's decision to put `dryRun` and the difference report in the store
module was right: this script has no branch of its own that could drift from the contract's
state table.

## done-protocol

| rung | result |
|---|---|
| oracle green ×2 | `tools/ci be --slug programme-corpus` → `gate PASS`, twice |
| perimeter differential | `teacher_saas` collection listing unchanged (also asserted **inside** the suite) · `run-log.jsonl` size and mtime unchanged across the whole suite (asserted) |
| freeze audit | be repo dirt is `scripts/load-programmes.mjs` + be-1's `src/store/programmes.ts`; nothing under `agent/`, `src/routes/`, `src/app.ts`; `teacher-fe` clean; `docs/reference/curriculum/` clean |
| promoted `be` net | unchanged from be-1's run — this sub-issue adds a file nothing imports |
| mutation spot-check | 8 loader mutants, **8 killed, 0 survived** (table in `be-3.md`, which ran both scripts' mutants in one pass) |

### What the oracle actually pins

The three refusals, each with its own exit code and its own fixture:

- **exit 1 — the file is invalid.** Seven fixtures (missing `emphasis`, out-of-enum
  `emphasis`, `added-2022` with no legend, a second `programme` line, 26 weeks, empty
  `source.pdfPages`, a `trimester` key) plus a malformed-JSON line and a multi-problem file.
  Every one asserts **zero documents written** — not "the 26 good weeks landed".
- **exit 2 — Mongo was hand-edited.** `db.programmes.updateOne({}, {$set:{"totals.hours":181}})`,
  the exact edit somebody would make to "fix" a total, then a reload. The suite asserts the
  edit is **still there** afterwards: the loader refused, it did not repair. And that
  `--correct` does not paper over it either.
- **exit 3 — the file changed without `--correct`.** Asserts the stored `contentHash` and
  `transcriptionRev` are untouched and `programme_revisions` is still empty.

Plus the two shapes that make the projection trustworthy over time: loading the same file
twice is a no-op (`action=unchanged`, still one document), and `--correct` writes exactly
one `programme_revisions` row holding the **superseded** document verbatim before replacing
it.

## contract notes

- **`--db` means different things in the two CLIs.** The contract gives the loader
  `--db <name>` (a value) and the verifier `--db [--db-name <name>]` (a boolean plus a
  separate name). Both are implemented exactly as written, because the contract is binding
  — but it is a wart worth flagging: the same flag spelled the same way takes a value in one
  script and not in the other. Harmonising it is a contract change, not an implementation
  choice.
- **`--note <text>` is not in the contract.** `programme_revisions.note` is, and nothing else
  could fill it. Added as an optional flag; a revision with no note stores `null`.
- The state table needed nothing the store module could not express.

**Status: done.**

## review

**Verdict: approve-with-debt.**

Every row of the state table re-derived by execution: insert / `unchanged` on re-run /
exit 1 whole-file reject (zero docs written) / exit 2 on a hand-edit, with `--correct`
refusing to paper over it / exit 3 without `--correct` / `--dry-run` writes nothing / blank
line mid-file rejected naming its line. The `--allow-live-db` guard (added in `bbdf7cc`)
survived every bypass I tried: forgotten `--db` → exit 4; `MONGO_DB=teacher_saas` → exit 4;
guard still fires under `--dry-run`; a db name smuggled into `MONGO_URL`'s path is ignored
by `client.db(name)`; a scratch db that merely *contains* a `subjects` collection is
refused, confirming the guard is a property of the target database, not of the arguments.
This is the thing I most expected to break and could not.

Debt:

1. **The loader does no arithmetic.** `totals.hours: 44` loads clean (exit 0); corpus trust
   depends on the verifier being run, and nothing couples the two. Contract-conformant
   (arithmetic is layer 1's job) but worth one sentence wherever the loader is documented as
   "what makes the projection trustworthy".
2. `--db` followed by another flag consumes it as the db name (`--db --correct` targets a
   database literally named `--correct`). Mild — `--db --dry-run` can never write because
   the same token still sets dryRun — but it is a silent misparse.
3. Exit 1 is overloaded: invalid seed, missing file, and any unexpected error (Mongo down)
   all exit 1. The contract's "exit 1 = fix the file" is not always true.
