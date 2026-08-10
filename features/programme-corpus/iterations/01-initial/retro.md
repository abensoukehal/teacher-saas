# Retro — programme-corpus · iteration 01-initial

## What shipped

73 pages of the ministry's التدرجات السنوية, read page by page and landed in MongoDB:
**5 documents · 6 streams · 135 weeks · 379 rows · 648 hours.** No consumer — the job's
correctness was its whole deliverable.

## The decision that made everything else possible

**Text extraction was disqualified on evidence, in the first ten minutes.** `pdftotext`
reported شعبة الرياضيات's annual total as 181 where the page reads 189. That wrong figure had
already been published in the product brief *and* in `project/CLAUDE.md`.

Re-reading all five summary tables from rendered pages then found **two more wrong** — 128
where the page says 108, 44 where it says 54. **Every error was off by exactly one digit.**
That is the shape that survives review: it reads as plausible.

> **The oracle nobody had noticed: every total is `weeklyHours × 27`.** 189=7×27 · 162=6×27 ·
> 135=5×27 · 108=4×27 · 54=2×27. All three published errors were detectable by arithmetic
> alone. **Look for the invariant the document already contains before inventing a check.**

## What the design got right, proven rather than argued

**`unitId` assigned, never derived.** علوم تجريبية lists `المتتاليات العددية` twice,
non-contiguously. Had the id come from the name they would have merged into one unit — **and
A1 and A2 would still have passed.** The corpus would have misstated the ministry with every
gate green. This is the single strongest vindication in the job.

**The week as the verifiable unit.** Chosen because it is the only level with a built-in
oracle (rows sum to `weeklyHours`). Vindicated hard: the week column *lies* — تقني رياضي draws
five boundaries where no week starts and prints one number on its second row; another document
prints "23" in two adjacent cells. Only the hours invariant resolves any of it.

**Commit only closed weeks, per pass.** Three agents died or stalled mid-run (two network
errors, one watchdog) and **lost zero work**. The protocol deleted the hand-off problem rather
than solving it: a week still open at a pass boundary is simply re-read.

**Two version axes.** `edition` vs `transcriptionRev`. QA proved why: `current` had been
following the *last load*, so a one-word transcription fix to an old edition silently handed
`current` back to it — a correction to our own reading rewinding the syllabus.

## The five failures, and what each taught

**1 · A green gate covered a wrong corpus, three times.**
- `week.hours: 999` passed the loader, all eight assertions and `--compare`.
- A hollow layer-2 file made `--compare` print `0 discrepancies`, exit 0 — the WF-82 pattern
  reappearing *inside this job's own tooling*.
- A mutation harness raced itself, restored an already-mutated CLI, and **the gate stayed
  green at 145/145**. Caught by reading the diff before committing.

> Every one was caught by a human-shaped act — reading a diff, a page, a list. Never by a gate.

**2 · The count was noise; the list was the evidence.** `--compare` reported 111 discrepancies
on the maths document and nobody read past the number. Triaging all **233** across five
documents found **204 were two honest encodings of the same page**, **26 were the independent
reader being wrong**, and **3 were real defects** — sitting unread the whole time. One of them
had already been silently fixed by another route, taking the count 112→111 with nobody
noticing.

**3 · Verification found what arithmetic structurally cannot.** The independent re-read caught
week 25's `contents` picking up «ليست على» from the *adjacent guidance cell*, inverting
"belonging to a plane" into "not lying on" it. It passed all eight assertions. **No arithmetic
oracle can ever catch that class.**

**4 · The cross-document defects came from transcribers, not the verifier.** Both the reversed
`sin ، cos` and the en-dash-for-tatweels were raised by agents transcribing *other* documents.
A reader who has seen the same sentence elsewhere notices what a single-document verifier
cannot. Neither was found by the layer that exists to find defects.

**5 · I normalised across instances while applying a fix that warned against exactly that.**
The triage said shadda placement **varies by instance** and had adjudicated 14 such disputes
*in the seed's favour*. My first patch replaced every match in the week. Reverted; applied to
the named cell only.

> The instinct to make a document self-consistent is the single most dangerous instinct in
> transcription work, and it fires in reviewers and appliers as much as in transcribers. The
> layer-2 verifier silently "corrected" `لهده` to `لهذه` before catching itself.

## Carried forward, knowingly

- **A green certifies structure, never fidelity.** Page fidelity rests on the human re-read
  plus sampling. Recorded in `project/CLAUDE.md`; must travel with any claim about the corpus.
- **The deep-in-cell error class has no mechanical net.** A negation injected past the anchor
  window is invisible to all three layers. Inherent to the method; widening the window trades
  one blind spot for hundreds of false flags.
- **~60 main-table pages were read twice by machines-as-readers but never sampled by a third.**
- **A shared normalisation can hide in agreement** — math w25's `لمستوٍ.` matches in seed and
  l2, so `--compare` is silent, while the crops suggest neither tanwin nor period. Recorded,
  unverdicted.
- **Four legends, four different wordings**, one never naming the colour. A legend hunt must
  match on meaning, never on a string.
- **The user gate after the maths document was never evidenced in any artifact.** It happened
  in conversation; nothing recorded it. QA flagged this and it is fair.

## Workflow findings

- **A job whose deliverable is data needs a triage step, not just a gate.** `--compare` produced
  the evidence on day one and it went unread for the whole job because nothing in the pipeline
  says "read the list".
- **`tools/profile.sh` and `tools/lanes.sh` are bash**; sourcing them from zsh silently resolves
  the clone root to `/`. Run under `bash -c`.
- **The promoted net needs the lane env** (`CHAR_BE_URL`, `CHAR_BE_LOG`) and `-w 1` — without
  them you get failures that read exactly like product regressions.
- **Perimeter clauses pinned to a fixed collection list** broke the moment this job added a
  collection, which was its deliverable. Re-baselined to assert what their names always claimed.
