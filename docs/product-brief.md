# Product brief — AI exam prep for Algerian BAC math teachers

> **Source of record for product intent**, as given 2026-08-07. Verbatim below the line.
>
> `project/CLAUDE.md` carries the condensed version — the parts that shape code, in
> every session's context. This file holds the full reasoning, including the parts that
> don't belong in a context window on every turn (pricing options, revenue math, the
> validation script). When the two disagree, **this file is the intent** and CLAUDE.md
> is stale; fix CLAUDE.md.
>
> Not a docs-graph node: the graph (`tools/docs-graph`) maps features to
> implementation and is grown by `/document` from shipped code. This is upstream of
> that — the why, before there is a what.

---

# AI Exam Prep Platform for Algerian BAC Math Teachers

*Project document, last updated after the pricing and services discussion.*

---

## 1. The thesis

An AI platform for jobs that require "home work", the invisible prep work done outside official hours. Someone performs live (in front of students, a client, a judge) and the quality of that performance depends on solo prep done beforehand. That prep is hard to standardize because it needs judgment, not templates.

Other verticals with the same pattern, kept on file for later: lawyers (case prep), doctors (charting, file review), journalists (research), real estate agents (listing prep), consultants (deck building), therapists (session notes), sales (account research), translators (glossary prep).

**First vertical: teachers.** Specifically Algerian BAC math teachers.

---

## 2. The product

A teacher generates an exam subject fast. Start with a rough prompt, get a full draft in seconds, then drill down and refine exercise by exercise until it matches what they'll actually give their class.

The value is time. An evening's work compressed into minutes.

### Core loop

1. Set structured controls: topic, difficulty, exercise count, duration
2. Optionally add a free-text note (with topic-aware suggestion chips)
3. Generate a full draft exam
4. Drill into any exercise and refine it in plain Arabic
5. Export to a printable sheet

### Exercise-level edits the teacher needs

- Change the numbers or values
- Change the difficulty of that one exercise
- Swap it for a different exercise on the same topic

---

## 3. Hard constraints

| Constraint | Detail |
|---|---|
| Language | Arabic only, RTL throughout |
| Math rendering | LaTeX (KaTeX), non-negotiable for equations, fractions, arrays |
| LaTeX visibility | Fully hidden. Teachers don't know what LaTeX is and never should. Editing stays natural-language |
| Grounding | Must stay inside the official Algerian math curriculum. Not locked to exact textbook wording, but no going off-syllabus |
| Engineering | Don't over-engineer. Ship lean, test fast |

---

## 4. Business model

### Current position

Direct-to-teacher. The teacher pays, not schools or tutoring centers. Keeps distribution simple, no institutional sales cycle.

**Price point under consideration: 2,000 DZD/month.**

### The billing question, still open

Two models on the table:

**A. Flat monthly subscription, unlimited access**
- Predictable revenue
- No purchase anxiety, teachers use it freely
- Risk: heaviest users cost the most and pay the same. A teacher generating 40 exams a month could cost more than they pay
- Risk: recurring card-on-file billing is painful on Algerian rails (CIB, Edahabia, BaridiMob). A "subscription" that needs manual re-payment every month is really a repeated purchase with friction

**B. Credit-based, per generation / exercise / adjustment**
- Fits local payment rails: one payment, no renewal, no stored card
- Fits seasonality: demand spikes around compositions and BAC prep, dies in between
- **Serious problem:** the core UX is iterate-until-right. Metering adjustments taxes exactly the behavior the product depends on. Teachers stop refining, accept worse exams, conclude the tool is mediocre

**C. The synthesis, and the current recommendation**

Price the **outcome**, not the effort. One credit = one finished exam subject, with unlimited iteration inside it until export.

- A unit teachers can reason about ("I need 4 exams this trimester")
- Caps token exposure per unit
- Doesn't punish refinement
- Sidesteps recurring-billing friction

Launch with credit packs. Add an unlimited monthly tier later, once power users are visibly burning through packs and would rather stop counting.

**Don't lock this in before the teacher test.**

### Revenue math

| Monthly target | Subscribers needed at 2,000 DZD |
|---|---|
| 1,000,000 DZD | 500 |
| 5,000,000 DZD | 2,500 |

Reality check: if there are roughly 15,000 lycée math teachers in Algeria (needs verification), then 500 subscribers is about 3% penetration, reachable through word of mouth, teacher Facebook groups, and a few well-connected teachers. Could come from Oran and Alger alone.

2,500 subscribers is ~17% of the entire national market. That's category dominance, not a year-one number, and would likely require expanding to other subjects or countries.

Both figures are gross. Subtract payment processing, API costs (material at this scale, especially with unlimited iteration), infrastructure, and eventually salaries.

**Real milestone to watch:** 50 paying users who aren't personal contacts. Getting the first 50 is the hard part. From there to 500 is mostly distribution work.

---

## 5. Service roadmap beyond exam generation

**Strategic problem to solve:** exam generation is low-frequency. A teacher makes 3 to 6 real exams per trimester. That's a weak habit loop for a subscription. Most additions should raise usage frequency, not just add surface area.

Ranked:

**1. Solution sheets (التصحيح النموذجي)** — same engine, near-zero extra build, more tedious to write by hand than the exam itself. Include the grading scale (السلّم) with points per question. Should arguably be in the MVP.

**2. Multiple versions of the same exam (نماذج متعددة)** — same questions, different numbers, shuffled order. Solves cheating in crowded classrooms, a real daily pain. Technically easy given exercise-level regeneration already works. Nobody else offers this. Best demo moment.

**3. Weekly exercise series (سلاسل التمارين)** — 4 or 5 exercises on one chapter for homework or classwork. Needed **weekly**, not per trimester. This is the fix for the frequency problem. If only one thing gets added, make it this.

**4. Devoirs vs compositions as distinct formats** — a devoir surveillé is one hour and narrow; a composition is two hours across a trimester. Different structures and difficulty curves. Cheap to add, makes the tool feel like it understands their calendar.

**5. Remediation sheets (تمارين الدعم)** — "my class struggled with limits" produces targeted easier exercises. Natural bridge toward OCR grading.

**6. Personal exercise library** — everything generated gets saved, searchable by chapter. Over a year the teacher builds their own bank. Real switching cost, cheap to build, strong retention.

**Later, big build:** OCR auto-correction of submitted student exams.

### Deliberately skipped

- Course content and lesson summaries. Teachers have the textbook and their own notes
- Anything student-facing. That's the separate e-learning project; mixing them muddies both
- Slides and presentations. Most Algerian lycée classrooms don't run on projectors

---

## 6. Validation plan

Two math-teacher friends will test it. Their reaction is the go/no-go signal.

Quality bar for what they see: good UX but minimal. Not a throwaway prototype, not a full product. The core loop must work end to end so they're reacting to the real thing.

### What to actually learn from them

Beyond "is this useful":

- **How many exams do you make per trimester?** Decides pack sizes and price point. Currently a guess.
- **What do you spend on teaching materials per month?** Not "would you pay 2,000 DZD", people are polite. If they flinch, the ARPU assumption is wrong and the subscriber math balloons.
- **Would you pay personally, or expect the school to cover it?** The whole model is scoped direct-to-teacher. If both instinctively say "my school should pay", that's worth knowing now.
- **Does the printable header match what your school expects?** If they rewrite it by hand, a saved-school-details screen is needed.
- **Do they tap the suggestion chips or type their own notes?** Chips being used means the free-text box is intimidating and structured shortcuts are the real interface. Cheap signal either way.

---

## 7. Scoping decisions

- **Standalone product.** Not merged with the separate student-facing BAC e-learning idea. May share curriculum-grounding thinking, built independently.
- **First track: Math.** Other subjects later.
- **Export: keep it simple.** Print-to-PDF via a standalone printable page.
