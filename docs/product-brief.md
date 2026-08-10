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

## 6b. The curriculum ground truth — streams, books, and what we actually cover

Researched 2026-08-09. This section exists because two questions kept being answered from
memory and getting answered wrong: *which streams are there*, and *what is actually on the
programme*. It is the market side of the on-syllabus hard constraint.

### The six official 3AS streams, and the three maths textbooks

| شعبة | specialities | maths textbook |
|---|---|---|
| **رياضيات** | — | **A** — scientific |
| **علوم تجريبية** | — | **A** — scientific |
| **تقني رياضي** | هندسة كهربائية · مدنية · ميكانيكية · هندسة الطرائق | **A** — scientific |
| **تسيير واقتصاد** | — | **B** — its own |
| **آداب وفلسفة** | — | **C** — literary |
| **لغات أجنبية** | — | **C** — literary |

Book A is published as one volume for all three scientific streams. Book C serves both
literary streams. **تقني رياضي's four specialities share one maths programme** — they diverge
in their technology subject, not in mathematics, so four specialities cost nothing extra.

**Sharing a book is not sharing a syllabus.** Each stream has its own التدرج السنوي from
المفتشية العامة للبيداغوجيا defining what is examinable and how deeply. That document — not
the textbook — is what a curriculum file must encode.

### Unit-level coverage — from the OFFICIAL programme

> **Superseded 2026-08-10.** This table first came from teaching-resource sites and was ✎
> inference. The official **التدرجات السنوية** (وزارة التربية الوطنية · المفتشية العامة
> للتربية الوطنية · مديرية التعليم الثانوي العام والتكنولوجي · سبتمبر 2022) have since been
> obtained for all five 3AS streams and are archived at
> `docs/reference/curriculum/` with extracted text alongside. **This table is now
> transcription, not inference.**
>
> The inference was mostly right and wrong in one important way: it agreed that تقني رياضي
> matches رياضيات and that علوم تجريبية lacks الأعداد والحساب — but it **missed التحويلات
> النقطية entirely**, a unit no teaching site's lesson index listed. That is exactly the
> failure mode this document existed to rule out.

| المحور (official wording) | رياضيات | تقني رياضي | علوم تجريبية |
|---|:--:|:--:|:--:|
| تقويم تشخيصي لمكتسبات التلاميذ | 1 أسبوع | 1 أسبوع | 1 أسبوع |
| الدوال العددية (الاشتقاقية والاستمرارية) | 2 | 2 | 2 |
| الدالتان الأسية واللوغاريتمية | 2 | 2 | 2 |
| الدوال العددية (النهايات) | 1 | 1 | 3 (مع التزايد المقارن) |
| التزايد المقارن ودراسة الدوال | 2 | 2 | ↑ |
| المتتاليات العددية | 2 | 2 | 2 + 1 |
| **الدوال الأصلية والحساب التكاملي** | 3 | 3 | 2½ |
| **الأعداد والحساب** | 3 | 3 | **—** |
| الإحصاء والاحتمالات | 2 | 2 | 2½ |
| **الأعداد المركبة والتحويلات النقطية** | 3 (مدمجان) | 3 (مدمجان) | 3 + 1½ (منفصلان) |
| الهندسة في الفضاء | 3 | 3 | 3½ |
| معالجة بيداغوجية (×3) | 3 | 3 | 3 |
| **المجموع** | **181 ساعة / 27 أسبوعا** | **162 ساعة / 27 أسبوعا** | **135 ساعة / 31 أسبوعا** |

**تقني رياضي's unit list is identical to رياضيات** — only the hourly budget differs (6 h/week
against 7). **علوم تجريبية** drops الأعداد والحساب entirely, splits الأعداد المركبة from
التحويلات النقطية into two units, and merges النهايات with التزايد المقارن.

### What this says about the product as it stands

The product serves **شعبة الرياضيات only** — `teacher-fe/src/lib/taxonomy.ts` hardcodes it and
there is no stream selector. Against the official programme, its eight-topic dropdown is
**missing roughly a quarter of the year** for the one stream it does serve:

| missing unit | official weight (رياضيات) |
|---|---|
| **الدوال الأصلية والحساب التكاملي** | 3 أسابيع · 21 ساعة |
| **الأعداد والحساب** | 3 أسابيع · 21 ساعة |
| **التحويلات النقطية** | bundled into a 3-week unit with الأعداد المركبة |

That is **6 of 27 teaching weeks a teacher cannot ask for**, plus half of a seventh. Not a
future-stream problem — a gap for the teachers we have today, and the sort a practising
teacher notices immediately because it is where their trimester actually goes.

Two further mismatches worth designing around rather than papering over:

- **Granularity.** The product splits «الدوال العددية والنهايات» from «الاشتقاق ودراسة
  الدوال»; the programme splits الاشتقاقية والاستمرارية / النهايات / التزايد المقارن. Close,
  but not the same cuts. The product's names are the teacher-facing taxonomy and need not
  match word for word — they do need to *cover* the programme.
- **The taxonomy is no longer one global list.** الأعداد والحساب exists for two streams and
  not the third; التحويلات النقطية is bundled in two and standalone in the third. Any stream
  selector must carry a per-stream topic list, not a shared one with a filter bolted on.

### Expansion order this implies

1. **Fix the stream we already sell to** — add the two missing units. Affects teachers today.
2. **تقني رياضي** — nearly free: same book, same unit list as رياضيات.
3. **علوم تجريبية** — same book, one unit fewer.
4. **تسيير واقتصاد** — Book B, genuinely different content. Separate effort.
5. **The literary streams** — Book C, reduced programme, low coefficient. Weakest
   value-per-teacher for the build cost; probably never.

### Provenance — now official

The unit tables above are transcribed from the ministry's own **التدرجات السنوية**, September
2022, archived per stream in `docs/reference/curriculum/` (PDF plus extracted text) for
رياضيات · تقني رياضي · علوم تجريبية · تسيير واقتصاد · الشعب الأدبية. The issuing chain is
printed on each: الجمهورية الجزائرية الديمقراطية الشعبية → وزارة التربية الوطنية → المفتشية
العامة للتربية الوطنية، مديرية التعليم الثانوي العام والتكنولوجي.

**What is still not settled:** these are the 2022 progressions. They are the current
published ones we could obtain, but nobody has confirmed against a practising teacher that
they are what is examinable *this* year, and the ministry revises them ("يتوجب مراجعتها
وتحيينها عند الاقتضاء"). Treat the unit lists as authoritative and the currency as unverified
— a teacher's confirmation is still worth having, and it is now a five-minute question rather
than a research project.

The stream/textbook grouping above remains sourced from ency-education, eddirasa and bacdz.

---

## 6c. Candidate next work — a collection, not a plan

Nothing here is committed or provisioned. This is the shelf: things we know enough about to
scope, kept so the reasoning isn't re-derived each time. Ordered by what they'd change, not by
effort.

### A · The quarter of the programme our own teachers cannot ask for

**Grew after item E.** It was "two missing units"; against the official programme it is
**6 of 27 teaching weeks, plus part of a seventh** — الدوال الأصلية والحساب التكاملي (3
أسابيع), الأعداد والحساب (3 أسابيع), and التحويلات النقطية (bundled with الأعداد المركبة).
All for شعبة الرياضيات, the one stream we serve. A teacher cannot ask for any of them today.

Still no new streams, no profile, no data-model change — but no longer a trivial patch, and
the most defensible thing on this shelf: it is a gap for teachers we already have, measured
against the ministry's own week budget.

Two subtleties recorded so they are not rediscovered: **الأعداد والحساب is stream-specific**
(absent for علوم تجريبية), so a flat entry silently assumes a single stream forever; and the
product's topic *cuts* do not match the programme's — they need to **cover** it, not mirror
its wording.

### B · Teacher profile + the three scientific streams

**The largest, and the one that turns "who is this teacher" into product behaviour.** Sign-up
collects what a teacher teaches and their school; generation uses it; the printed sheet carries
the school name instead of leaving a blank for them to fill in by hand.

**Precondition, not a component: a stream selector without a per-stream curriculum file is a
lie.** `exam-subject` reads `agent/curriculum/<file>.md` and only `3as-mathematiques.md`
exists. Offering a stream with no file generates ungrounded content — silently breaking the
on-syllabus constraint, in a way only a practising teacher catches, months later, in class. So
the curriculum files land with the selector or before it, never after.

What §6b makes cheap: تقني رياضي's unit list is **identical** to رياضيات, and علوم تجريبية is
the same **minus** الأعداد والحساب. Two derivable files, both ✎.

Deliberately excluded, each because it looks helpful and isn't:
- **The تقني رياضي speciality** — all four share one maths programme. A field that means
  nothing today gets mistaken for one that means something later.
- **Wilaya, years teaching, class size** — nothing acts on them, and the `teacherId` is still a
  bearer value that never expires and cannot be revoked. Every personal field sits behind it.
  School name is personal data, not decoration.

Open, and **not** to be assumed: does a teacher teach **one** stream or several? Algerian lycée
teachers commonly cover more than one. One-versus-many changes the data model, the sign-up
form and every default — the cheap answer and the correct one may differ. Also unresolved:
whether the school belongs to the teacher or to the exam (a teacher who moves, or writes for
two schools, breaks the first model), and what a real Algerian exam header actually carries.

### C · Weekly exercise series (سلاسل التمارين)

**Roadmap item 3, and the brief's own answer to the frequency problem** (§5): exams are needed
3–6 times a trimester, series *weekly*. If only one thing gets added, this is it.

The progressive-generation work made it unusually cheap. A series is the same
plan → fan-out → fill shape with the exam envelope removed: no summing to 20, no duration
budget, one chapter. `exercise-one` needs no change; the plan skill is simpler than the exam's;
the progressive UI, per-exercise retry and one-writer registry are all reusable as-is.

### D · Multiple versions of one exam (نماذج متعددة)

Roadmap item 2, and now nearly free: it wanted exercise-level regeneration, which shipped as
`POST /subjects/:id/exercises/:exerciseId/regenerate`. Same questions, different numbers,
shuffled — anti-cheating in crowded rooms. Cheap, but it does not move usage frequency, which
is the number that matters.

### E · Obtain the official programme documents — ✅ DONE 2026-08-10

All five 3AS التدرجات السنوية (September 2022) are archived in
`docs/reference/curriculum/`, PDF plus extracted text: رياضيات · تقني رياضي · علوم تجريبية ·
تسيير واقتصاد · الشعب الأدبية. §6b is now transcription rather than inference.

**It paid for itself immediately.** The inference it replaced had missed **التحويلات النقطية**
— a whole unit that no teaching-site lesson index listed — and had the granularity of the
functions units wrong. Item A's scope grew from two missing units to roughly a quarter of the
teaching year as a direct result.

**One thing remains open, and it is now a five-minute question rather than a research
project:** these are the 2022 progressions, and the documents themselves say they are revised
as needed. Nobody has confirmed with a practising teacher that they are what is examinable
this year. Worth asking one of the two teacher friends at the same time as the core-loop
validation (§6).

### Not on the shelf, and why

**تسيير واقتصاد and the two literary streams** — different textbooks, genuinely different
content, and the literary streams have a reduced programme with a low coefficient. Weakest
value-per-teacher against the build cost.

**Anything student-facing, lesson plans, slides, other subjects** — see §7; still out.

---

## 7. Scoping decisions

- **Standalone product.** Not merged with the separate student-facing BAC e-learning idea. May share curriculum-grounding thinking, built independently.
- **First track: Math.** Other subjects later.
- **Export: keep it simple.** Print-to-PDF via a standalone printable page.
