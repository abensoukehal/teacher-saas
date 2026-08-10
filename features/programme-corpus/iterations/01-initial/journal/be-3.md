# be-3 — `scripts/verify-programmes.mjs`: layer 1, the pass gate, and the L2 compare

## pre-flight · 2026-08-10

Slot-2 recordings reproduced:

```
$ ls stacks/teacher-be/scripts/
backfill-teachers.mjs capacity.mjs purge-orphans.mjs seed-admin.mjs load-programmes.mjs
                                                      # no verifier (load-programmes is be-2's)
```

And the arithmetic the script must encode, from SEED §2.1 — the three figures that reached
the product brief and the divisor that catches all three:

```
181 / 27 = 6.703…    128 / 27 = 4.740…    44 / 27 = 1.629…     none an integer
189 / 27 = 7 ✓       162 / 27 = 6 ✓       135 / 27 = 5 ✓       108 / 27 = 4 ✓   54 / 27 = 2 ✓
```

## it 1 · the script

**Diagnosis.** One design question decides the whole shape: does the verifier read a seed
file through be-1's `assembleDoc`?

**No — and this is the sub-issue's one real decision.** `assembleDoc` *refuses* a malformed
file. But `--partial` runs on a file with fewer than 27 weeks **by design**, and A5's entire
job is to *diagnose* a gap or a repeat rather than bounce the file. A verifier that could
only read valid files would never report the failure it exists to find. So the verifier
parses leniently (valid JSON per line, `type` recognised, exactly one programme line) and
evaluates A1–A7 itself.

That is not a second definition of the shape: the enum, the week count and the canonical
hash still come from `dist/store/programmes.js`. What differs is the *posture* — the loader
refuses to store a bad file, the verifier explains why it is bad. Those are different jobs
and both are needed.

**Action.** `scripts/verify-programmes.mjs`, three modes per the contract. Decisions:

- **A1–A3 run in `--partial` too.** The contract's partial list is A4, A6-left, A7 and
  contiguity, but the pass protocol says pass 0's gate is "A1–A3 already computable from
  this one line and must be green before any week is transcribed" — and pass 0's file has
  *zero* weeks. Running the document-level assertions in every mode is what makes
  `--partial` usable as that gate. Nothing in the contract forbids it and the protocol
  requires it.
- **A6 splits in partial mode.** Left-hand side (every `unitId` is declared) is checkable at
  any point; right-hand side (every unit is used by some week) cannot be true until the
  document is complete, so partial mode says so in the assertion's own message rather than
  passing silently.
- **`near()` everywhere, never `===`.** `weeks` may be `1.5` (`أسبوع ونصف`) and floats do not
  sum exactly.
- **The resume state names the unit by id AND prints its verbatim `nameText`.** The next
  pass has to match a rotated محور cell against the units table; the id alone is not enough
  to recognise it on a page.
- **A completed unit is reported as complete, not as open.** Weeks 1..8 finish `u05`
  exactly; saying "open unit u05 (2 of 2)" would tell the next pass to keep filling a unit
  that is done.

**Result.** The oracle went green on its first run — 38 new clauses, 91 total.

## it 2 · one honesty fix in the summary line

**Diagnosis.** `--db` mode printed its metadata (db, docKey, transcriptionRev) by filing it
as a `SKIP`ped assertion, so the summary read `… 0 failed, 1 skipped` when nothing had been
skipped. Small, but this is a script whose entire job is to report exactly what was and was
not verified, and a gate that misreports its own coverage is the failure class the whole
harness is built against (WF-82).

**Action.** Print it as a `subject:` line of its own; delete the now-dead `skip()` helper and
the skipped counter from the summary.

**Result.** 91/91 still green, twice. V13 (`finish()` always exits 0) and V14 (skip the
contentHash recompute) were re-run against the edited reporting path and **both still
KILLED**, so the change did not soften the two mutants that touch it.

## the `--compare` subset, and what it deliberately does not compare

Layer 1 catches **no** attribution error. The `--compare` mode diffs the contract's
comparable subset and nothing else:

week · `weekNumberPrinted` · the unit label (seed's `unitId` → its `nameText`) · `rowCount` ·
per-row `hours` · per-row `emphasis` · per-cell first-six-words anchors.

Three deliberate non-comparisons, each with a reason:

1. **Full text.** Two honest verbatim reads of dense Arabic differ in whitespace without
   either being wrong. Pinned by a test: an anchor with the same first six words but extra
   spacing and a different tail is **not** a discrepancy.
2. **`source.pdfPages`.** The l2 line carries it and it was tempting. The contract fixes the
   subset, and an l2 reader may legitimately cite only the page where a week's number is
   printed while the seed cites both pages of a straddling week. Comparing it would
   manufacture discrepancies in be-5/be-10 that are not errors. Left out on purpose.
3. **A `unitLabelSeen` of `null`.** Where the محور cell is rotated and merged across pages
   the reader genuinely sees no label. "I saw nothing" is not "I saw something different".

A `rowCount` disagreement stops per-row comparison for that week — once the indices no
longer line up, every subsequent row diff is noise, and a wall of noise is how a real
discrepancy gets skimmed past.

## done-protocol

| rung | result |
|---|---|
| oracle green ×2 | `tools/ci be --slug programme-corpus` → `gate PASS`, 91/91, twice |
| perimeter differential | `teacher_saas` unchanged (asserted in the suite) · every file the verifier reads is byte-identical afterwards in all three modes (asserted: size + mtime) · `--db` on an empty database creates **no** collection and **no** index (asserted) |
| freeze audit | be repo dirt: `src/store/programmes.ts`, `scripts/load-programmes.mjs`, `scripts/verify-programmes.mjs`. Nothing under `agent/`, `src/routes/`, `src/app.ts`. `teacher-fe` clean. `docs/reference/curriculum/` clean |
| promoted `be` net | unchanged — nothing imports these scripts |
| mutation spot-check | see the table below |

### Mutation spot-check — be-2 and be-3 together

Both scripts are `.mjs`, so mutants need no rebuild; 25 mutants in one pass, each restored
after.

| # | mutant | verdict |
|---|---|---|
| L1 | an invalid seed file exits 0 instead of 1 | KILLED |
| L2 | a changed file without `--correct` exits 0 instead of 3 | KILLED |
| L3 | a hand-edited DB exits 0 instead of 2 | KILLED |
| L4 | `correct: true` always — every load overwrites | KILLED |
| L5 | `--dry-run` writes anyway | KILLED |
| L6 | the report line is never printed | KILLED |
| L7 | the failing lines are not named | KILLED |
| L8 | `--db` ignored — writes to the default database | KILLED |
| V1 | A3 always passes (`totals.hours == weeklyHours × 27`) | KILLED |
| V2 | A1 always passes | KILLED |
| V3 | A2 always passes | KILLED |
| V4 | A4 always passes (per-week hours) | KILLED |
| V5 | A5 always passes in full mode | KILLED |
| V6 | A6 drops the orphan-`unitId` half | KILLED |
| V7 | A6 drops the unreferenced-unit half | KILLED |
| V8 | A7 always passes (emphasis enum, guards, pdfPages) | KILLED |
| V9 | the resume state prints `next week k` instead of `k+1` | KILLED |
| V10 | `--compare` ignores emphasis disagreements | KILLED |
| V11 | `--compare` ignores anchor disagreements | KILLED |
| V12 | `--compare` ignores per-row hours disagreements | KILLED |
| V13 | `finish()` always exits 0 | KILLED |
| V14 | `--db` mode skips the contentHash recompute (A8) | KILLED |
| V15 | `--compare` always exits 0 | KILLED |
| V16 | `--compare` ignores a rowCount disagreement | KILLED |
| V17 | `--partial` stops checking week contiguity | KILLED |

**Kill rate 25/25**, on top of be-1's 15/15 — **40 mutants, 40 killed, 0 survived** across
the three sub-issues.

**L8 is worth its own paragraph.** It made the loader ignore `--db` and write to the default
database, and the perimeter clause caught it — but only *after* the write had happened, so
the mutant left the fixture document in `teacher_saas`. Two new collections
(`programmes`, `programme_revisions`), one fixture document, one revision row; the four
frozen collections were never referenced by any code path and their counts were untouched
(subjects 7471 · teachers 15184 · exercise_revisions 3391 · solutions 1917). Both new
collections were dropped and the recorded perimeter — `exercise_revisions, solutions,
subjects, teachers` — reproduces exactly. Recorded rather than quietly cleaned up, because
it is a real finding: **nothing in the CLI stops a forgotten `--db` from writing test data
to the real database.** The suites all pass `--db programme_corpus_ci` and the perimeter
clause is the backstop, but that is a convention, not a guard. See the report.

## contract notes

- **The contentHash recompute in `--db` mode has no assertion id in the contract.** It names
  A1–A7 and then says `--db` "additionally recomputes `contentHash`". Reported here as
  **A8** so it appears by name like every other assertion; if a later reader expects the
  list to stop at A7, this is why it does not.
- **`--partial` runs more than the contract's list** (A1–A3 as well). Reasoning above; it is
  strictly stronger, and the pass protocol depends on it.
- Nothing in the contract proved wrong or unbuildable.

**Status: done.**

## review

**Verdict: approve-with-debt.**

The 40/40 code-mutant claim could not be re-derived literally (REVIEW may not modify product
code), so it was re-derived behaviourally: for every L/V mutant class I constructed a data
mutant or CLI scenario exercising the guarded behaviour. 21/21 killed where a defence
exists — A1/A2/A3 (totals 44), A4 (row-hours drift), A5 full and `--partial` (gap at week
5, duplicate week), A6 both halves (orphan id at load time, unreferenced unit at verify
time), A7 (all emphasis variants), A8 (hand-edit red in `--db` mode), resume state (`next
week 10 · open unit u03 (1 of 2)` on a truncated file), `--compare` on hours, emphasis,
anchors and rowCount. The `--partial` gate and resume derivation are correct as claimed.

Debt, ranked:

1. **A4 never reads `week.hours`.** The schema.yaml assigns that field to A4; the
   implementation sums `rows[].hours` only. `week.hours: 999` passes `--file` and `--db`
   modes entirely (demonstrated). One-line fix; the stored corpus is currently correct.
2. **`--compare` has no coverage accounting.** An l2 file stripped of `rowEmphasis`,
   `anchors` and `unitLabelSeen` compares only structure and hours, and reports
   `0 discrepancy(ies)`, exit 0 — a hollow L2 read produces a perfect green with no signal
   that almost nothing was compared. This is the WF-82 failure class (a gate that verified
   nothing reading as a pass) inside this job's own tooling. The real l2 files are full, so
   the hole is latent; it matters the day someone regenerates an l2 file lazily.
3. **The `--db`/`--db-name` asymmetry is not just a wart — it fails green.**
   `verify-programmes.mjs --db <scratch> --docKey …` silently ignores the scratch name,
   verifies the LIVE `teacher_saas`, and can return a green verdict about the wrong
   database (demonstrated). be-2's journal flagged the asymmetry; this is its harm mode.
4. Anchor windows make `--compare` exit 0 unreachable on real documents (112/34/33/19
   irreducible artifact flags), so the contract's "exit 0 after disposition" oracle was
   quietly abandoned in favour of bulk prose adjudication — see be-5/be-10 reviews.

### debt closed (micro-loop) — 1, 2 and 3

Three of the four are fixed here; item 4 is left as recorded knowledge, for the reason at the
bottom. **The gate went 97 → 116 clauses**, and every mutant of the new code is killed
(19/19, listed at the end).

**1 · A4 now has two clauses.** The week line states its hours twice — the `hours` field and
the rows that sum to it — and A4 read only the rows. It now checks both against
`weeklyHours`:

```
A4  FAIL  1 week-hours problem(s) against weeklyHours 7
      week 7: the week line declares hours 999, but weeklyHours is 7 and its rows sum to 7
```

Two clauses and not three: with the rows pinned to `weeklyHours` and the field pinned to
`weeklyHours`, the field equals the row sum by transitivity, so checking it against its own
rows as well would report one fact twice. **It stays in the verifier, not the loader** —
that is the existing seam (loader = shape, verifier = arithmetic), the same seam that leaves
A3's `totals.hours` unchecked at load time, and be-2's review already accepted it as
contract-conformant. Moving arithmetic into the loader is a bigger decision than a debt fix.

All 135 stored weeks were already correct, so nothing in the corpus moved; the five documents
are still A1–A8 green from `--db`.

**2 · `--compare` has a coverage floor.** It now reports what it compared, every run:

```
compare coverage: weekNumberPrinted 27 weeks · unitLabel 0 weeks (27 not seen) ·
                  rowCount 27 weeks · rowHours 97 rows · rowEmphasis 97 rows ·
                  anchors 274 cells (17 not seen)
verify-programmes: --compare … — 27 seed week(s), 27 l2 week(s), 32 discrepancy(ies),
                   0 coverage gap(s)
```

and REVIEW's hollow file — `rowEmphasis`, `anchors` and `unitLabelSeen` stripped — is now
**81 coverage gaps and exit 1** instead of `0 discrepancies` and exit 0.

The line the design turns on is **absent is not null**. A null is a recorded reading — "the
rotated محور cell showed no label", "that cell is empty" — and the real sciences and techmath
files carry 27 null labels and 12–17 null anchors each; failing those would fail the corpus
for being honest. An absent key is a field the l2 pass never produced. So nulls are counted
and printed as `not seen`, and absences are gaps.

Two layers, because either alone is escapable. Per line kills the strip. Per file — a class
that compared **zero** cells across the whole file — kills the same attack respelled as
all-null or empty-arrays. `unitLabel` is deliberately exempt from the per-file floor: two of
the five documents legitimately show no label on any of 27 weeks.

All five real l2 files pass the floor with **0 gaps**, which is the check that the floor is a
floor and not a fence.

**3 · `--db <name>` means one thing.** Both CLIs now share `scripts/lib/db-arg.mjs`:

```
verify --db programme_corpus_nonexistent --docKey tadarroj-3as-math
  before   8 passed, 0 failed          ← about teacher_saas, which nobody asked for
  after    no current document for docKey tadarroj-3as-math in db programme_corpus_nonexistent
```

`--db <a> --db-name <b>` is refused rather than resolved (guessing here is the bug wearing a
different spelling), `--db` followed by a flag is refused rather than used as the name, and
both scripts print `db-from=` so a default is never invisible. The bare `--db --db-name X`
form still works — it is the verifier's documented mode selector.

That last refusal also closes **be-2's debt 2** for free, and the mutation run proved that
one was not cosmetic: with the old parse restored, `load --file … --db --correct` created a
real MongoDB database named `--correct` holding `programmes` and `programme_revisions`. It
was dropped afterwards.

**4 · not closed, and not a defect.** The anchor window makes exit 0 unreachable on real
documents, and widening it would trade one blind spot for hundreds of false flags — full-text
equality is deliberately not compared because two honest verbatim reads of dense Arabic differ
in whitespace. The protection against a word changed deep inside a cell is the human eye-pass
layer 2 performs, not the tool. That is inherent to the method; recorded, not papered over.
What the coverage floor adds is narrower and real: the tool can no longer claim agreement it
never attempted.

**Mutation run — 19/19 killed** (each mutant applied to the real script, whole gate re-run,
script restored):

| group | mutants | all killed by |
|---|---|---|
| A4 | drop the declared clause · check the field against its own rows · default an absent field to `weeklyHours` · check only the first week | the four new A4 clauses |
| coverage floor | no audit · absent-reads-as-null · null-reads-as-absent · no per-file floor · gaps but exit 0 · no coverage line · accept short `rowHours` · accept short `anchors` · accept an empty anchor object | the eight new floor clauses |
| `--db` | verifier ignores `--db`'s value · resolve ambiguity by preferring `--db` · loader accepts a bare `--db` · a flag token is a fine name · drop `db-from` from either report | the six new `--db` clauses |

The two that matter most are the pure reversions — "the pre-fix code" for A4 and for the
coverage audit — because they are the defects themselves, and both are red now.
