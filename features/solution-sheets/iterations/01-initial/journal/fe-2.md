# fe-2 — a printable correction sheet, separate from the exam

**Closed 2026-08-08.** Oracle 61/61 ×2, promoted fe net 144/144, freeze clean, `tsc` clean,
mutation caught by 2 clauses.

## Pre-flight

Slot-2 ground truth re-run and reproduced — one print path, and `ExamView` already takes
`printable`:

```
$ grep -n "window.print" stacks/teacher-fe/src/App.tsx
592:  <button … onClick={() => window.print()}>طباعة الموضوع</button>     ← was :482; fe-1 drift
$ grep -n "printable" stacks/teacher-fe/src/components/ExamView.tsx
10:  printable?: boolean;
```

**One thing had changed, and it is the thing this sub-issue exists to fix.** The print rules
are a blacklist (`.sidebar, .progress, .refine, .alert, .notice, .ex__refine`) naming no
correction selector, so after fe-1 the exam's print output *would* have carried the answer
key. `App.css` is this Delta by plan and fe-1 could not touch it; recorded in `fe-1.md` as a
known transient, closed here.

## The baseline is real

`fixtures/exam-print-baseline.html` and `exam-screen-baseline.html` were dumped from the
**frozen** `ExamView` before this sub-issue changed anything, and are compared verbatim
(`toBe`, not a snapshot matcher that can be auto-updated). That is the load-bearing negative:
the sheet the students receive is byte-identical.

## Where the scoping lives, and why it is pinned twice

`window.print()` prints the live DOM, so the two sheets are separated by a marker the shell
carries (`.app[data-print]`) and a rule in `@media print` that reads it. jsdom applies no
print media, so **either half alone is untestable and either half alone is a leak**:

- the app half — the marker's value **at the moment `window.print()` is called**, captured
  inside the stubbed `print`;
- the CSS half — the rule parsed out of `App.css`, and required to be *inside* the
  `@media print` block, so a rule that happens to sit outside cannot satisfy it.

**`exam` is the default**, deliberately: a teacher who hits Ctrl+P without touching either
button gets the students' paper. Defaulting the other way would be a silent way to hand out
an answer key.

## The mutation

Print straight from the click handler instead of from the effect (`setPrintJob(m);
window.print()`). It reads as an obvious simplification and it is the bug: React has not
re-rendered, so the marker still holds the *previous* mode — the teacher asks for the
correction and the printer produces the exam, and the press after that produces the
correction on the paper. **Caught by 2 clauses:**

- *printing the correction marks the page `solutions` AT print time* (got `exam`)
- *after printing the correction the page returns to `exam`*

## What only a real browser showed

The oracle was green and the print block still had a defect. Materialising the real
`@media print` rules through the real cascade on lane 4 (read the `CSSMediaRule` off
`document.styleSheets`, re-insert its rules, then read computed styles) gave:

| mode | `.exam` | `.solutions-pane` | `.sol__regen` | `.sidebar` |
|---|---|---|---|---|
| `exam` | block | **none** | none | none |
| `solutions` | **none** | block | none | none |

…and also `background-color: rgb(30,35,32)` on `.solutions`. The surfaces are token-driven
and go **dark** under a dark colour scheme, while the print block forces `color: #000` on
`body` — so whenever a printer is told to keep backgrounds, the sheet comes out black on
black. `.solutions` and `.sol__scale` now reset `background` explicitly.

`.exam` has the identical latent issue and was left alone: fixing it would change the exam's
printed rendering, which is exactly what this sub-issue's negative clause forbids. **Flagged
for the reviewer**, not fixed here.

Also confirmed on the lane: stale badge *and* the full stale sentence survive into the print
sheet in black, the dimming of a stale answer is lifted for paper, 3 blocks, 22 scale parts,
`direction: rtl`, no LaTeX, no Latin words.

## For the reviewer

1. **`.exam` keeps a token background under print** (above). Pre-existing, out of this
   Delta, worth a follow-up.
2. **`**bold**` still renders literally** — `lib/katex.tsx`'s existing behaviour, in neither
   sub-issue's Delta. Visible in the exam today as well.
3. The correction's `printable` prop mirrors `ExamView`'s: it is what the tests drive, while
   the live print path hides affordances through CSS (`.sol__regen` beside `.ex__refine`) —
   the pattern already established in this repo, not a second mechanism.

## Done-protocol

| check | result |
|---|---|
| oracle ×2 | 61/61, 61/61 |
| promoted fe net vs this code | 144/144 |
| `tsc -b --noEmit` | clean |
| freeze | only `src/App.tsx`, `src/App.css` |
| mutation — print before the marker commits | **caught, 2 clauses** |
| exam print output | byte-identical to the recorded baseline, screen render too |
| real browser, print rules materialised | exam-mode hides the correction; solutions-mode hides the exam |

## review
**approve.** The two sheets provably never merge; the exam's print output is byte-identical
against a baseline the reviewer confirmed is legitimate (nothing in `ExamView` changed, so
there is nothing a re-dump could hide). The print-scoping mutation is caught. The three
follow-ups reported here were judged genuinely out of scope, not dodged.
