# be-1 — the `solution-sheet` capability

**Closed 2026-08-08.** The skill exists, registers by directory alone, and its one recorded
run satisfies every checkable property.

> Protocol note: no subagents, so implementation and verification shared one context. All
> claims below are command output, not opinion.

## Pre-flight

```
GET /api/skills            → ['exam-subject','refine-exercise']
POST /api/generate         → 400 unknown skill "solution-sheet"
```
Both reproduced.

## What the sub-issue proved about the architecture

**Registration is the directory existing.** Adding `agent/.claude/skills/solution-sheet/SKILL.md`
and restarting took `/api/skills` from two entries to three with **zero `src/` changes**,
because `skills.ts:19` lists `config.claude.cwd + /.claude/skills`. The brief's "near-zero
extra build" is true *for the capability*; the build is in storage, staleness and print.

## The one paid run

**$0.756 / 145 s**, recorded to `tests/be/fixtures/rec-solution-sheet.2026-08-08.json`.
Everything downstream replays it; no further generation is needed by this job.

Worth recording for the pricing conversation: a correction costs **more than the exam it
corrects** ($0.756 vs $0.645). A finished exam-plus-correction is ~$1.40 against a price
point under consideration of ~$15/month — about **11 exams to break even, down from ~23**.
The SEED records this and deliberately does not meter it.

## Checkable properties, on the real output

| property | result |
|---|---|
| one entry per exercise, ids `ex1..ex3`, none invented | ✅ |
| each `scale[]` sums exactly to that exercise's points | ✅ 6.0/6, 6.0/6, 8.0/8 |
| half-marks used where marking needs them | ✅ `[1,1,0.5,1,1.5,1]` etc. |
| Arabic prose, no Latin **outside** math spans | ✅ none |
| **no Arabic inside a math span** (the KaTeX glyph trap) | ✅ 0 of 200 spans |
| JSON only — no fence, no prose around it | ✅ |

## The verification bug worth remembering

My first three property checks reported FAIL on output that was correct. All three were the
*checker*, not the skill:

1. LaTeX commands (`\dfrac`, `\sqrt`, `\infty`) were counted as "Latin prose". They are the
   renderer's language and the teacher never sees them — the rule is no Latin *prose*.
2. Splitting on `$` to find math breaks on `$$…$$`: display math lands on an even index and
   is counted as prose.
3. The same parity bug made the span matcher report 174 Arabic-inside-math violations that
   do not exist.

**Strip display math first, then inline** — anything else misreads the document. Written any
of those ways, the oracle would have failed forever on correct output, and the natural
response to a red oracle is to "fix" the code. That is how a good skill gets edited into a
worse one.

## Exit

Delta held: `git status` in the be repo shows only `agent/.claude/skills/solution-sheet/`.

## review
**approve** (Fable 5, cross-model). The reviewer independently re-verified the recording with
its own checker — 240 spans, 0 Latin prose, 0 Arabic-in-math, balanced `$`, scales 6/6/8 —
and confirmed that a naive `$`-split checker misfires exactly as this journal describes.
Judged the property set itself: the right properties, none vacuous, with one honest limit —
they pin **one** recording, so they prove that generation was well-shaped, not that the skill
reliably is.
