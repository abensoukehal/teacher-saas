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

# The prep platform for Algerian lycée maths teachers

**Makes the day-to-day easier, and keeps the teacher on the official programme.**

*Project document, last updated after the pricing and services discussion.*

> **Title changed 2026-08-10.** It read *"AI Exam Prep Platform for Algerian BAC Math Teachers"*
> for the same reason §2 read as an exam generator — the implementation had narrowed the thesis,
> and the title kept it narrow. Two things are wrong with the old one. **"Exam prep"** names one
> artifact when the product is the whole week's preparation. **"AI"** names the mechanism, not the
> value; the teacher does not want AI, they want their evening back and a paper they can defend to
> an inspector.
>
> The new line carries **two** values, not one. Time was always there. **Staying on the official
> programme is the second, and it is the more defensible** — a faster exam is a convenience, an
> exam that provably matches what the ministry says and what the class has actually reached is
> something no textbook, no Facebook group and no generic chatbot can give them. It is also why
> the programme corpus is the backbone (§6d) rather than a feature.
>
> **The boundary did not move.** "Day-to-day" means the prep work done outside official hours —
> §2's boundary section still binds, and administration is still a different product.

---

## 1. The thesis

An AI platform for jobs that require "home work", the invisible prep work done outside official hours. Someone performs live (in front of students, a client, a judge) and the quality of that performance depends on solo prep done beforehand. That prep is hard to standardize because it needs judgment, not templates.

Other verticals with the same pattern, kept on file for later: lawyers (case prep), doctors (charting, file review), journalists (research), real estate agents (listing prep), consultants (deck building), therapists (session notes), sales (account research), translators (glossary prep).

**First vertical: teachers.** Specifically Algerian BAC math teachers.

---

## 2. The product

> **REPOSITIONED 2026-08-10: from an exam generator to the teacher's prep companion.**
> Note what this is *not* — it is not a change of thesis. §1 has always said "the invisible
> prep work done outside official hours". It was **this section** that narrowed the product to
> one artifact. The repositioning widens it back to the thesis it was always written under.

A companion for a teacher's day-to-day preparation, built on the official programme. It knows
what their stream teaches, in what order, and where they have actually reached — and from that
it produces what they need next: this week's exercises, a devoir over what has been covered, a
trimester composition, the correction that goes with it.

Exam generation is now **one surface of the product, not the product**. It remains the sharpest
one, and it is what ships today.

**Two values — and conformity to the programme is the one we lead with.**

- **Staying on the official programme.** ← **the pitch.** Everything the product makes is grounded in the ministry's own التدرج and in where the class has actually reached: the right unit, the right level, within the stated limits, and never material the class has not been taught. This is the failure a teacher cannot afford — it is discovered in front of the class, or at the BAC — and it is the one claim nothing else in their world makes: not the textbook (which is not the syllabus), not a colleague's old papers, not a Facebook group, and not a generic chatbot, which will produce confident off-syllabus mathematics without knowing it did.
- **Time.** An evening's work compressed into minutes — across the week's prep, not only the three-to-six evenings a trimester when an exam is due. Real, and second: speed is a convenience anyone can eventually copy.

**Conformity is the moat, which is why the programme corpus is the backbone** (§6d) and not a
grounding detail bolted onto a generator. It also sets a standard the product must meet rather
than merely claim: **conformity has to be shown** — the source named on the artifact, the
ministry's own السير المنهجي visible where the teacher works, the covered scope stated *and the
excluded scope stated with it*, and anything we authored or derived marked as ours.

### The boundary — prep, not performance

Widening the product without widening the boundary is how scope becomes infinite. "Helps the
teacher" has no edge; "the prep work done outside official hours" has one, and §1 already
supplies it.

**In scope** — solo preparation that precedes the live performance: planning against the
programme, tracking progress through it, generating exams · series · corrections · remediation,
and the material a teacher prepares in order to teach.

**Out of scope, and each for its own reason:**
- **Anything happening *in* the classroom.** That is the performance, not the prep.
- **Anything student-facing.** Still the separate e-learning project; mixing them muddies both.
- **Administration** — grades, attendance, parent communication, timetabling. Real day-to-day
  work, genuinely burdensome, and *not prep*. It is a different product with different
  competitors, and taking it on would abandon the one thing that makes this defensible: that
  the hard part is judgment, not record-keeping.

If "day-to-day" is ever read as including administration, that is a second product and should
be decided as one — not arrived at because the phrase was loose.

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

> **Largely answered by the 2026-08-10 repositioning (§2).** The frequency problem was a
> symptom of the product being one low-frequency artifact. A prep companion built on the
> programme is opened weekly at minimum — planning the week, tracking what was covered,
> producing what comes next. The items below stop being "additions that raise frequency" and
> become the product's ordinary surface. Read the ranking now as *what to build*, not as *how
> to rescue the habit loop*.

Ranked:

**1. Solution sheets (التصحيح النموذجي)** — same engine, near-zero extra build, more tedious to write by hand than the exam itself. Include the grading scale (السلّم) with points per question. Should arguably be in the MVP.

**2. Multiple versions of the same exam (نماذج متعددة)** — same questions, different numbers, shuffled order. Solves cheating in crowded classrooms, a real daily pain. Technically easy given exercise-level regeneration already works. Nobody else offers this. Best demo moment.

**3. Weekly exercise series (سلاسل التمارين)** — 4 or 5 exercises on one chapter for homework or classwork. Needed **weekly**, not per trimester. This is the fix for the frequency problem. If only one thing gets added, make it this.

**4. Devoirs vs compositions as distinct formats** — a devoir surveillé is one hour and narrow; a composition is two hours across a trimester. Different structures and difficulty curves. Cheap to add, makes the tool feel like it understands their calendar.

**5. Remediation sheets (تمارين الدعم)** — "my class struggled with limits" produces targeted easier exercises. Natural bridge toward OCR grading.

**6. Personal exercise library** — everything generated gets saved, searchable by chapter. Over a year the teacher builds their own bank. Real switching cost, cheap to build, strong retention.

**Later, big build:** OCR auto-correction of submitted student exams.

### Deliberately skipped

- ~~**Course content and lesson summaries**~~ — **EXCLUSION REVERSED 2026-08-10. Courses are
  IN.** Reopened earlier the same day and decided the same day; recorded here in writing because
  §6f.4 required the reversal to be deliberate rather than arrived at by increments. See
  **§6g** for the decision and its terms.
  The original reason was "teachers have the textbook and their own notes", and that reasoning
  was sound *for an exam generator*. Two things changed it. First, the repositioning above puts
  lesson preparation squarely inside the boundary. Second, the official programmes carry a
  **السير المنهجي لتدرج التعلمات** column — per-week teaching guidance from the ministry that is
  in neither the textbook nor a teacher's notes, and that no teacher currently has in a usable
  form.
- Anything student-facing. That's the separate e-learning project; mixing them muddies both
- Slides and presentations. Most Algerian lycée classrooms don't run on projectors — a
  hardware fact, unaffected by the repositioning

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
| **المجموع** | **189 ساعة / 27 أسبوعا** | **162 ساعة / 27 أسبوعا** | **135 ساعة / 27 أسبوعا** |

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

> **Compounds with F.** A weekly series is exactly the artifact a teacher needs *at* a given
> week, so progress alignment scopes it for free — and the frequency argument for C and for F
> is the same argument. If both are built, build the programme storage once and let both read
> it.


**Roadmap item 3, and the brief's own answer to the frequency problem** (§5): exams are needed
3–6 times a trimester, series *weekly*. If only one thing gets added, this is it.

The progressive-generation work made it unusually cheap. A series is the same
plan → fan-out → fill shape with the exam envelope removed: no summing to 20, no duration
budget, one chapter. `exercise-one` needs no change; the plan skill is simpler than the exam's;
the progressive UI, per-exercise retry and one-writer registry are all reusable as-is.

### D · Multiple versions of one exam (نماذج متعددة)

> Unaffected by F, and the only shelf item that is — versions are a transformation of an exam
> that already exists, so progress alignment adds nothing to it.


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

### F · Programme progress tracker — the documents used beyond exams

**The idea.** Guide a teacher through the official programme and let them track where they
are: the ministry's own week-by-week table, rendered as something a teacher works with rather
than a PDF they lose. Later, real prepared course material attaches under
السير المنهجي لتدرج التعلمات.

**Why this may be the most important thing on the shelf.** §5 names the strategic problem:
exam generation is 3–6 uses a trimester, which is a weak habit loop for a subscription. A
progress tracker is touched **weekly or more** — it is the teacher's working calendar. That is
a stronger answer to the frequency problem than the weekly exercise series (item C), and it
does something the series cannot: it gives the product a reason to be open on a day nobody is
setting an exam.

It also makes exam generation **contextual** rather than manual. A teacher at week 12 wants a
devoir on what has actually been taught by week 12. Today they carry that calendar in their
head and pick topics by hand. With the programme stored, the product knows — and knows what it
must *not* include because the class has not reached it yet. That is also what makes roadmap
item 4 (devoirs vs compositions) real: the difference is scope-to-date, not just duration.

**⚠ It reverses a recorded scoping decision, and that should be deliberate.** §7 and the scope
section exclude *"lesson plans, course content, lesson summaries — teachers have the textbook
and their own notes. Explicitly skipped."*

- The **tracker itself does not collide** with that. It is the official programme plus the
  teacher's own position in it — reference data and state, not authored content.
- **"Prepared courses under السير المنهجي" does collide**, squarely. That is course content.
  Reversing the exclusion may well be right — the reasoning behind it was "teachers have their
  own notes", and a course attached to the official progression is a different proposition —
  but it should be reversed **knowingly and in writing**, not arrived at by increments.

### F.1 · What the documents actually contain

Verified across all five archived files. Every stream's document has the same shape:

1. **Cover** — الجمهورية الجزائرية… → وزارة التربية الوطنية → المفتشية العامة للتربية الوطنية →
   مديرية التعليم الثانوي العام والتكنولوجي · المادة · المستوى · الشعبة · سبتمبر 2022
2. **مقدمة** — what التدرجات السنوية are, and that they are revised as needed
3. **الكفاءات المستهدفة في شعبة X** — stream-level competencies, grouped by domain
   (الحساب · التحليل · الهندسة · الإحصاء والاحتمالات · تكنولوجيات الإعلام والاتصال ·
   المنطق والبرهان الرياضياتي)
4. **Summary table** — المحور · عدد الأسابيع · الحجم الساعي, grouped by الفصول
5. **The main table — التدرج السنوي لبناء التعلمات**, one row per week:

   `الأسبوع · المحور · الكفاءات المستهدفة · المحتويات المعرفية · السير المنهجي لتدرج التعلمات · الحجم الساعي`

**The السير المنهجي column is the richest thing in the whole document** and is what makes both
this item and item A worth doing properly. It carries precise level and explicit prohibitions —
real examples from شعبة الرياضيات:

> «الدوال الناطقة (حاصل قسمة كثير حدود من الدرجة 2 أو 3 على كثير حدود من الدرجة 1 أو 2)»
> «الدوال المثلثية: cos(ax+b) ، sin(ax+b) ، tan x»
> «حل معادلات تفاضلية من الشكل: y'=f(x) ، y'=f(x)y»
> «لا تُختار مسألة البحث في إثبات استمرارية دالة»
> «نقتصر على الأمثلة البسيطة سهلة الحساب»

Nothing in the product can currently express any of that.

### F.2 · How to store it — the design, before anyone builds it

**The spine is `(stream, week)`.** Everything hangs off it, the way `ex1…exN` is the join key
the exam loop turns on. A week is the unit a teacher thinks in, the unit the ministry
publishes in, and the unit progress is tracked in.

```
programme                       ← OFFICIAL. Immutable reference data, versioned by document.
  stream        شعبة · level 3AS
  source        { authority, title, date: "2022-09", file }   ← provenance, always
  competencies  [ { domain, statements[] } ]        ← الكفاءات المستهدفة (stream-level)
  totals        { weeks, hours }
  units         [ { id, name, weeks, hours, trimester } ]     ← المحاور (summary table)
  weeks         [ { week, unitId,
                    competencies[],    ← الكفاءات المستهدفة (row level)
                    contents[],        ← المحتويات المعرفية
                    guidance[],        ← السير المنهجي   ← course material attaches HERE
                    hours } ]

teacher_progress                ← THE TEACHER'S. Separate collection, separate lifetime.
  teacherId · stream · schoolYear
  programmeVersion              ← which document their plan was built from
  entries [ { week, status: planned|done|skipped, note, completedAt } ]
```

Four rules that should not be negotiated away later:

1. **Store the official text VERBATIM. Never paraphrased, never summarised.** The same rule
   `subjects.subject` already follows. Paraphrasing السير المنهجي makes us the author of the
   programme, silently — and the whole value of these files is that we are not.
2. **The official programme and the teacher's progress are different collections with
   different lifetimes.** The programme is reference data revised by the ministry; progress is
   per-teacher, per-year. Mixing them means a programme update destroys progress.
3. **`programmeVersion` on the progress record.** The documents state plainly that they are
   revised («يتوجب مراجعتها وتحيينها عند الاقتضاء»). When 2024's arrive, a teacher mid-year
   must not have their plan silently re-pointed.
4. **Anything derived is marked as derived.** Weights inferred from hours, topic mappings onto
   the product's own taxonomy, trimester boundaries — all useful, none of them the ministry's
   words. The existing ✎ discipline extends here.

### F.3 · The hard part is extraction, and it is not a parsing job

The extracted text is faithful to a reader and treacherous to a program: digits reverse
(`2022` renders `2222`), Arabic ligatures drop characters (`الحجم` → `الح�م`), and the
six-column table interleaves so that a row's cells are not adjacent in the text stream.

So transcription needs a model or a person **reading with judgement, then verifying against
the PDF** — not a regex pass. Done badly it is *worse* than the ✎ inference it replaces,
because it would carry official authority while being wrong. Budget it as careful work on
about 19 pages × 3 streams, with a verification pass that is separate from the transcription
pass and does not trust it.

**Do one stream end to end first** (شعبة الرياضيات — the one we serve), prove the shape, then
the other two. The three scientific streams share a structure, so the second and third are
mostly mechanical once the first is right.

### F.4 · The payoff — exams aligned to where the teacher actually is

This is why F is worth more than the sum of a tracker and a topic list. Once the programme is
stored and the teacher's position in it is known, **exam generation stops being a blank form**.

**Today.** The teacher picks topic, difficulty, exercise count and duration from scratch, every
time, carrying the school calendar in their head. The product has no idea what month it is,
what has been taught, or what the class has never seen.

**With F.** The teacher is at week 12. The product knows which محاور weeks 1–12 covered, the
hours spent on each, and which units are still ahead. So it can:

- **Propose the exam instead of asking for it** — «اختبار الفصل الأول» becomes a single choice
  whose scope is derived, not typed.
- **Weight it honestly.** Hours-per-unit to date give a defensible split of the 20 points. A
  unit that took 21 of 181 hours has a claim on roughly 12% of the paper.
- **Exclude what has not been taught yet** — and this is the half that matters most. An exam
  containing material the class has never seen is not a style problem; it is the single most
  damaging thing this product could hand a teacher, because they would only discover it in
  front of the class. Today nothing prevents it. **The programme is the only source that can.**
- **Make devoir vs composition real** (roadmap item 4). The difference is scope-to-date and
  weight, not just a duration label: a devoir covers the recent stretch, a composition the
  trimester.
- **Aim remediation** (roadmap item 5) at units the teacher marked as struggled-through, rather
  than asking them to name the weakness.

**The chain, end to end:**

```
official programme stored verbatim  →  teacher's progress tracked by week
        →  scope-to-date derived    →  exam generated within it, and only within it
```

Each link is useful alone: the programme improves grounding for the exams we already generate
(item A), the tracker earns weekly opens on its own (F). But the chain is what turns a
generator into something that knows the teacher's year — and it is the difference between
"write me an exam about logarithms" and "write my first-trimester composition".

**One constraint this inherits, stated so it is not lost:** scope-to-date is *derived* from the
teacher's own tracked progress, never assumed from the calendar. Classes fall behind, schools
lose weeks, teachers reorder units. A product that assumes week 12 means the week-12 syllabus
would be confidently wrong for most real classrooms — the same class of error as deriving a
correction's staleness from the subject's `rev` instead of the statement it answers. The
teacher's marked position is the truth; the calendar is at best a default.

## 6d · DECIDED — the programme is the backbone

**Decision, 2026-08-10.** Everything grounds in the official documents. Not as a reference the
exam skill consults, but as the structure the product is built on: which streams exist, what
each teaches, in what order, and where a given teacher currently is.

Two consequences the decision names explicitly:

- **The teacher profile carries a stream, and all six streams are offered** — the five archived
  documents cover them (آداب وفلسفة and لغات أجنبية share one).
- **The weekly exercise series is scoped by the teacher's tracked progress**, so it knows what
  *this week* may contain — not merely which chapter, but where the class has actually reached.

### The corpus we are committing to

| stream(s) | hours/year | units | pages |
|---|---|---|---|
| رياضيات | 181 | 11 | 19 |
| تقني رياضي | 162 | 11 | 19 |
| علوم تجريبية | 135 | 11 | 17 |
| تسيير واقتصاد | **108** | 12 | 10 |
| آداب وفلسفة + لغات أجنبية (one document) | **54** | 10 | 8 |

**73 pages, 5 documents, 6 streams.**

Two corrections to earlier entries in this brief, from actually reading all five:

- **The literary streams are cheap, not expensive.** §6b called them "probably never" on
  value-per-teacher. Commercially that stands — 44 hours a year at 2 h/week is a thin
  programme. But at 8 pages and 4 units they are the *cheapest* thing in the corpus, so
  excluding them saves almost nothing while leaving two of six streams unserved.
- **تسيير واقتصاد is smaller than assumed** — 9 units, 10 pages, and it carries no
  الأعداد المركبة, no هندسة في الفضاء, no أعداد وحساب. Its shape is closer to the literary
  document than to the scientific ones.

### The documents do NOT share one schema — 2026-08-10

The brief asserted every document had the same sections. Checked, and it is false in ways that
change the data model:

| | math | techmath | sciences | gestion | lettres |
|---|---|---|---|---|---|
| **الكفاءات المستهدفة** | ✓ 6 domains | ✓ 6 | ✓ **5** | **absent** | **absent** |
| ملامح التخرج | ✓ | ✓ | ✓ | ✓ | **absent** |
| **مذكرة منهجية** | ✓ | ✓ | ✓ | ✓ | ✓ ← *not in the brief at all* |

- **تسيير واقتصاد and آداب وفلسفة carry no competencies section.** `competencies` must be
  nullable — absent and empty mean different things.
- **Domain sets differ per document.** علوم تجريبية drops الحساب entirely. Domains are data,
  never an enum.
- **There is no trimester grouping in any document.** `الفصول` is one merged cell spanning
  every row. The `trimester` field in §F.2 has **no source** and is dropped — inferring it from
  معالجة positions would be invention.
- **Weeks are not integers** — `أسبوع ونصف`, `أسبوعان ونصف`, `3 أسابيع ونصف` appear.
- **Units repeat and are non-contiguous** — علوم تجريبية lists المتتاليات العددية twice;
  لغات أجنبية splits الحساب / الحساب تابع. A `unitId` cannot be derived from a name or a position.
- **Column headers differ** — lettres heads its weeks column `الحجم الأسبوعي` where the others
  use `عدد الأسابيع`; gestion drops the hamza. Store headers verbatim, do not normalise.

### ⚠ RED TEXT IS SEMANTIC, in all five documents

The most consequential finding, and it was in none of our reading until the pages were rendered.

تسيير واقتصاد and آداب وفلسفة carry an on-page legend:
**«تم إدراج العناصر الملونة بالأحمر لعدم تناولها في السنة الدراسية 2021-2022»** — post-COVID
catch-up content, marked in red because it was *not covered* the previous year.

**The mathematics document also contains red blocks with no legend on the page where they
appear.**

A plain-text transcription silently destroys a distinction the ministry made deliberately.
Emphasis must be a **required field on every row**, never a default — so "I forgot the colour"
becomes a hard error instead of a silent loss. And the maths document's unlegended red needs its
meaning found or its absence recorded, never guessed.

### Verified from the pages — 2026-08-10, and two more figures were wrong

Every summary table re-read from PNGs and re-summed. **Two of the five hours figures published
in this brief were wrong**, both from text extraction:

| stream | weeks | hours | was published as |
|---|---|---|---|
| شعبة الرياضيات | 27 | **189** | ~~181~~ |
| تقني رياضي | 27 | **162** | 162 ✓ |
| علوم تجريبية | 27 | **135** | 135 ✓ |
| تسيير واقتصاد | 27 | **108** | ~~128~~ |
| آداب وفلسفة + لغات أجنبية | 27 | **54** | ~~44~~ |

**A free oracle nobody had used: every total is exactly `weekly hours × 27`.**
189 = 7×27 · 162 = 6×27 · 135 = 5×27 · 108 = 4×27 · 54 = 2×27. All three errors were
detectable by arithmetic alone — 181/27, 128/27 and 44/27 are not integers. Every stream's
figure is now gated on this.

**Note the shape of the errors: each was off by one digit** (181/189, 128/108, 44/54). That is
the dangerous kind — it reads as plausible and no reviewer would blink at it.

### Currency check — verified 2026-08-10, before committing

**September 2022 is still the current official version.** Searched for a newer ministry
تدرجات for 3AS mathematics and found none; sources continue to reference the Sept 2022 set as
what is in force. The corpus we archived is not stale.

**But "2025–2026" documents do circulate, and they are a different kind of document.** The
education-onec-dz postings advertised as 2025–2026 are **التوزيع السنوي** prepared by an
individual teacher (الأستاذ مساهل بلال), not by المفتشية. They are not a newer programme —
they are the same programme mapped onto this year's calendar.

| | issued by | how often it changes | what it carries |
|---|---|---|---|
| **التدرجات السنوية** | المفتشية العامة للتربية الوطنية | rarely — Sept 2022 still current | المحاور · الكفاءات · المحتويات · السير المنهجي · الحجم الساعي |
| **التوزيع السنوي** | a teacher or inspector | **every school year** | the same content against this year's dates, holidays and exam windows |

**This splits the schema in §F.2, and the split is load-bearing:**

```
programme        ← التدرجات. Content, order, scope. Versioned by ministry document (2022-09).
                   Changes rarely. Shared by every teacher of that stream.
school_year      ← التوزيع. week 1..N → real dates, holidays, exam windows, trimester bounds.
                   Changes EVERY YEAR. Not authored by the ministry.
teacher_progress ← where THIS teacher actually is. Changes weekly.
```

Conflating the first two would mean re-transcribing the whole programme every September to
change some dates — and would make a ministry revision indistinguishable from a calendar
shift. Keep them separate and the annual work is a small calendar file, not a 73-page
re-transcription.

**A real example is archived** at `docs/reference/curriculum/EXAMPLE-tawzi3-3as-math-2024-2025.pdf`
(3 pages, شعبة الرياضيات, by الأستاذ مساهل بلال). Its columns are:

`الأشهر · الأسبوع · رقم الأسبوع · المحور · المحتويات · الحجم الساعي`

The content is the ministry's, unchanged. What the distribution adds is the **calendar**, and
it carries more than dates:

```
ديسمبر  أسبوع 3   ← الأسبوع 11 · معالجة بيداغوجية
ديسمبر  أسبوع 4   ← اختبارات الفصل الأول      ⟵ the composition is DUE here
ديسمبر  أسبوع 5   ← عطلة الشتاء
جانفي   أسبوع 1   ← (عطلة)
جانفي   أسبوع 2   ← الأسبوع 12 resumes
…
مارس    أسبوع 3   ← اختبارات الفصل الثاني     ⟵ and here
مارس    أسبوع 4   ← عطلة الربيع
```

**The assessment windows and the holidays are in the document.** That is the piece that turns
the tracker from a passive checklist into something that acts: in early December the product
knows اختبارات الفصل الأول is two weeks away and that the exam may cover weeks 1–11 and nothing
after — because the class will not have reached it. It can offer the composition before the
teacher goes looking for it. Holidays matter for the same reason: they are why week 11 and
week 12 are five calendar weeks apart, so any naive date arithmetic would be wrong.

**Which is more detailed? Measured, because the impression misleads.** التوزيع *looks* richer
— it is dense, every line is signal, and it adds months, holidays and exam windows. But:

| | pages | extracted text | الكفاءات | السير المنهجي |
|---|---|---|---|---|
| التدرجات السنوية | 19 | 113,178 chars | ✓ | ✓ |
| التوزيع السنوي | 3 | 27,554 chars | **absent** | **absent** |

**التوزيع drops two whole columns.** It keeps `المحور · المحتويات · الحجم الساعي` and discards
the competencies and the methodological guidance — so it carries **none of the prohibitions and
none of the level constraints**. «لا تُختار مسألة البحث في إثبات استمرارية دالة» and «الدوال
الناطقة: حاصل قسمة كثير حدود من الدرجة 2 أو 3 على كثير حدود من الدرجة 1 أو 2» exist only in the
تدرجات.

It reads as more detailed for three reasons, none of them content: it is **denser** (27 weeks in
3 pages), it is **finer on scheduling** (hours per content line rather than per week-block), and
it **adds a dimension the تدرجات lacks entirely** (the calendar).

**So: التوزيع is more detailed about *when*; التدرجات is four times richer about *what and how*
— and the part التوزيع drops is precisely what keeps generation on-syllabus.** Transcribing the
distribution instead of the progression would look like a shortcut and would silently discard
the most valuable column in the corpus.

⚠ **Caution on these documents.** The blog post advertises this file as 2025–2026; the file's
own header reads **السنة الدراسية 2024–2025**. They are teacher-made, informally published, and
not always labelled accurately. Treat a distribution as a *calendar suggestion to confirm*,
never as authority — the authority is the ministry's تدرجات, and the teacher's own marked
position beats both.

**Consequence for the tracker:** we can build on the 2022 programme with confidence, and the
per-year calendar is a small, separate artifact we may not even need for v1 — a teacher who
marks their own position needs no calendar at all. The calendar is what makes *defaults* good
("you're probably around week 12"), not what makes the tracker correct.

### Sequencing — this is four jobs, and the order is forced

Nothing here is optional-order: each step is unusable without the one before it.

**1 · The programme corpus — التدرجات only.** Transcribe all five **progressions** into the
structure in §F.2, and fix شعبة الرياضيات's missing quarter (item A) as the same pass through
the same document. Delivers item A, proves the schema on the stream we already serve, and is
the foundation for everything after. *Nothing else can start until this exists.*

> **Decided 2026-08-10: التوزيع السنوي is deferred to its own job**, after the tracker. The
> two documents have different sources, different authority and different lifecycles — the
> progression is the ministry's and changes rarely; the distribution is teacher-made and
> changes every September. Bundling them would tie a stable transcription to an annual chore,
> and the calendar earns nothing until there is a tracker to put it in: a teacher who marks
> their own position needs no calendar at all. The calendar improves *defaults*, not
> correctness.

**2 · Teacher profile + all six streams** (item B). Sign-up learns what a teacher teaches; the
topic taxonomy per stream comes from the corpus rather than a hardcoded constant; the printed
sheet carries the school. Needs 1.

**3 · Progress tracking + progress-aligned exams** (item F). The teacher marks where they are;
exam scope is derived from it. Needs 1 and 2 — progress is meaningless without knowing which
programme the teacher is following.

**4 · Weekly exercise series, scoped by progress** (item C). Needs 3 for "this week's scope" to
mean anything. Without it the series is just a smaller exam.

**Do step 1 on شعبة الرياضيات end to end first**, before the other four documents. It is the
stream we serve, it is the largest and most complex document, and if the structure survives it
the rest are mostly mechanical. A schema proven on the easy documents would be a schema proven
on the wrong thing.

### Not on the shelf, and why

**تسيير واقتصاد and the two literary streams** — different textbooks, genuinely different
content, and the literary streams have a reduced programme with a low coefficient. Weakest
value-per-teacher against the build cost.

**Anything student-facing, lesson plans, slides, other subjects** — see §7; still out.

---

## 6f · DECIDED — all streams, deep OCR, structured corpus

**Decision, 2026-08-10.** Three things settled together; each changes the job map above.

### 1 · All six streams, not one

The product serves **every 3AS stream that studies mathematics** — رياضيات · تقني رياضي ·
علوم تجريبية · تسيير واقتصاد · آداب وفلسفة · لغات أجنبية. Five documents, six streams.

Note this is not a widening of the brief; it is the implementation catching up to it. §1 has
always said *"Algerian lycée BAC mathematics teachers"* — all of them. `taxonomy.ts` hardcoding
`STREAM = "شعبة الرياضيات"` is what narrowed it, the same way §2 narrowed the thesis to one
artifact.

> **Worth verifying before it drives priority:** شعبة الرياضيات is the specialist maths stream
> and probably the **smallest** of the six by teacher population; علوم تجريبية is typically far
> larger. If that holds, the product has been optimising for the narrowest slice of its own
> audience, and علوم تجريبية is the bigger commercial prize. Enrolment figures not yet checked.

### 2 · Deep OCR page-by-page, mathematics as LaTeX

Text extraction is **rejected as a method**, on evidence: `pdftotext` reported شعبة الرياضيات's
annual total as **181 ساعة**; the rendered page reads **189**, and the column sums confirm it
(7+14+14+7+14+14+7+21+21+14+7+21+21+7 = 189 over 27 weeks). That figure had already been
published in this brief and in `project/CLAUDE.md` before the page was ever looked at.

**Method:** `pdftoppm` → PNG, read page by page. Reading the PDF directly comes out
letter-reversed; PNG renders clean and correctly ordered. Arabic prose stays **verbatim**;
mathematics is transcribed as **LaTeX** in `$…$`, which is what the product already renders
through KaTeX — the corpus becomes directly usable rather than needing a second conversion.
Converting `f ( x) � k` to `$f(x) = k$` recovers what the page says; rewriting a sentence does
not, and is still forbidden.

**Free verification oracle:** every summary table has a total. If the column does not sum, the
page needs a closer read. علوم تجريبية checks out independently (135 = 5 h × 27 weeks); the
other four figures in §6b came from text extraction and are **untrusted until re-verified**.

### 3 · The corpus is a structured database, and the skills stop reading files

The corpus is stored structured, with mathematics in LaTeX. That breaks how generation is
grounded today: four skills (`exam-subject`, `refine-exercise`, `solution-one`,
`solution-sheet`) read `curriculum/` off disk, because the CLI is a subprocess with
`<repo>/agent` as its working directory and cannot reach a database.

**Resolved in favour of injection:** `be` queries the corpus and passes the relevant slice into
the prompt; the skills stop reading curriculum files. The alternative — keeping a file
projection generated from the DB — means two artifacts that must not drift, which is the exact
failure class this project keeps hitting. Injection is also strictly better later: `be` knows
the teacher's stream, and after J3 their week, so it can pass *exactly* what is in scope
instead of a skill guessing which file to open.

Cost discipline still binds. `agent/CLAUDE.md` records that context is charged on every
invocation and refine is the most-repeated action, so the injected slice must be scoped —
never the whole programme.

### 4 · Consequences for the job map

- **J1 roughly doubles**: deep OCR of 73 pages, LaTeX conversion, the structured store, and
  rewiring how four skills receive curriculum.
- **J2 becomes mandatory, not optional** — six streams cannot be served without asking which
  one a teacher teaches.
- **J3 is the product's spine**, not a feature on the side.
- **The course layer was DEFERRED here, and TAKEN UP later the same day — see §6g.** What this
  entry got right and §6g does not relax: **the accuracy bar remains the central risk**, and it
  is still unsettled. Transcription is bounded and verifiable against a source; authoring is
  neither, which makes "is this correct and on-syllabus" the central question rather than a side
  concern. Deciding to build the layer did not answer it.
  **What the corpus must still do:** leave room. The structure hangs course material off
  `guidance` (السير المنهجي) per week, so the layer attaches rather than reshapes.

**Sequencing note:** شعبة الرياضيات is transcribed and checked **first** — as a method proof,
not a scope limit. It is the hardest document (19 pages, 11 units, densest table, most
mathematics). If the method survives it, the remaining four are largely mechanical; if it does
not, we learn that after one document rather than five.

## 6g · DECIDED — the domain model, courses in, progress per class

**Decision, 2026-08-10**, taken while aligning the model for UX work. Three things settled
together. The full design-facing version is `docs/product-description.md` §5b; this is the
record of what was decided and why.

### 1 · The course layer is IN — §5's exclusion is reversed

Each **content item** (محتوى معرفي) inside a week gets an authored **course**, and each course
gets a **sheet**: high-level explanation, demonstration, equations. Contents beyond that are not
yet specified.

§6f.4 required this reversal to be knowing and in writing rather than arrived at by increments.
This is it. What it does **not** settle, and what must be settled before the sheet is designed:

⚠ **The accuracy bar, and who verifies it.** Transcription is checkable against a page; authoring
is not. **A wrong course is worse than no course**, because it carries our implied authority into
a classroom — the same failure class as an off-syllabus exercise, but larger and harder to spot.

Three terms the layer inherits and cannot negotiate away:

- **Authored material is stored separately from transcribed material, and looks it.** Everything in `programme` is the ministry's words, verbatim, with provenance — that is the entire basis for claiming a paper is on-syllabus. A course is ours. Mixing the two destroys the one distinction that lets the product tell a teacher which text carries official authority.
- **The week's السير المنهجي is binding on the course.** It states the level and the explicit prohibitions. A sheet that exceeds them is wrong.
- **A sheet is the teacher's prep, never a student handout.** That is the line separating this from the student-facing e-learning project (§7). A sheet designed to be given to students means this product has quietly become that one.

### 2 · Progress belongs to a CLASS, not to a teacher

The schema in §F.2 keys `teacher_progress` by `(teacherId, stream, schoolYear)`. **That is wrong**,
and the error is the same class as deriving a correction's staleness from the subject's `rev`: it
merges two things that move independently.

A teacher with two 3AS classes has **two positions in the same programme** — one class fell
behind. A teacher covering رياضيات and علوم تجريبية runs two programmes at once. Keyed per
teacher-stream, two classes three weeks apart silently collapse into one position, and the teacher
discovers it when an exam covers material one class has never seen — which is precisely the damage
J4 exists to prevent.

**So: `progress` is keyed `(class, schoolYear)`, and a class carries a stream.** Consequences:
sign-up collects classes rather than only streams; every generation answers "for which class?";
the tracker shows one class at a time; home needs a class switcher.

**This also retires an open question.** §6c item B asked whether a teacher teaches one stream or
several. It no longer needs an answer as posed — a teacher has classes, each with a stream, and
one-or-many falls out. Still open, and *not* settled by this: whether the school belongs to the
teacher or to the exam.

### 3 · One generator, four scopes

Exercises for a course, for a week, for a unit, and an exam from progress-to-date are **not four
features**. They are one scope selector feeding one generator, with format (سلسلة · فرض ·
اختبار · دعم) as a second, independent input.

```
scope = course ⊂ week ⊂ unit ⊂ programme-to-date
```

The scope also decides which slice of the corpus `be` injects into the prompt — which matters for
the cost discipline §6f.3 already records, and means **narrower scope produces tighter grounding**.
Per-course exercises should therefore be the most reliably on-syllabus output the product makes.

### 4 · Three corrections to the model as previously written

Found while aligning; each had a plausible-looking design resting on it.

- **The week is the spine; the unit is a label on the row.** `unit → weeks` is a back-reference, never containment. Units repeat and are non-contiguous, and weeks are not integers (`أسبوع ونصف`). Already recorded in §6d; restated because a unit-first hierarchy keeps being drawn.
- **A programme serves streams, plural** — five documents, six streams. Not 1:1.
- **`competencies` is nullable, and domains are data** — two documents carry no competencies section at all, and علوم تجريبية has five domains where the others have six.

## 6h · Pacing — «هل أنا متأخر؟»

**Added 2026-08-10.** A teacher wants to know whether they are **behind or ahead of the
programme**. Stated plainly, unprompted, which makes it worth recording as a named feature rather
than a chart on the tracker.

### Why it is more than a subtraction

It is the first thing the product would say that the teacher **cannot easily work out themselves**.
Position is something they already know; *pacing* requires holding the official week budget, the
real calendar, the holidays and their own drift in their head at once. That is exactly the kind of
arithmetic a teacher does badly at 9pm and worries about all trimester.

It is also what converts the tracker from a record into an advisor. «متأخرون بأسبوعين» is a fact
with consequences: the composition is in three weeks, two units are unfinished, and the exam scope
has to reflect that. **Pacing is the input to every recommendation the product makes.**

### What it needs — and the cheap version that ships earlier

Pacing = *marked position* compared against *where the schedule says you'd be*. The second half is
a reference schedule, which is J6.

| version | needs | quality |
|---|---|---|
| **crude** — ships with J3 | school-year start date + holiday list | good enough to say ±N weeks |
| **proper** — J6 | the التوزيع السنوي: weeks → real dates, holidays, assessment windows | knows *why* week 11 and 12 are five calendar weeks apart, and what is due next |

Naive date arithmetic is wrong: holidays are why consecutive programme weeks can be far apart on
the calendar. Any crude version must hold at least the holiday list or it will report drift that
does not exist.

### Three rules, and they are not stylistic

1. **The comparison is informational; the teacher's marked position stays the truth.** §6d already
   binds this: scope-to-date is derived from marked progress, never assumed from the calendar.
   Pacing must never quietly re-point a class to where the schedule says it should be.
2. **The reference is not authoritative.** التوزيع السنوي is **teacher-made**, informally published,
   and sometimes mislabelled — the archived example is advertised as 2025–2026 and its own header
   reads 2024–2025. It is a calendar suggestion to confirm. Being "behind" it is a comparison
   against one teacher's plan, not against the ministry.
3. **Never nag.** Falling behind is the normal condition of Algerian lycée teaching — lost weeks,
   crowded programmes, real life. A product that scolds gets closed. State it neutrally, then be
   useful: adjust the exam scope, propose what to compress, show which units are still ahead.

**Ahead matters too, and is easy to forget.** A teacher running early wants the next unit's
material now — pacing should offer that as readily as it flags a delay.

## 6e · The job map

§6c is the *reasoning* shelf — why each thing matters. This is the *delivery* view: the same
material clustered into jobs, with what each needs before it can start. Ordered by dependency,
not by preference.

```
J1 programme-corpus ─┬─→ J2 profile+classes ─→ J3 progress-tracker ─┬─→ J4 aligned-exams ─→ J5 weekly-series
                     │                                              ├─→ J6 school-year-calendar
                     │                                              │      └─ carries PACING (§6h)
                     │                                              └─→ J8 course-layer ─→ per-course exercises
                     └─→ (J7 exam-versions — independent, any time)
```

**Revised 2026-08-10 by §6g and §6h.** J2 collects **classes** (each with a stream), not streams
alone. **J8** is new — the course layer, gated on its accuracy bar being settled, not on J3
finishing. **J6 is no longer a deferred nicety**: pacing (§6h) is the teacher's own question and
the calendar is what answers it properly.

### J1 · `programme-corpus` — the backbone  ·  **provisioned 2026-08-10**

Covers shelf items **A** and the storage half of **F**.

- The `programme` schema from §F.2 — official text stored **verbatim**, provenance on every record
- Transcribe the five **تدرجات** into it: **شعبة الرياضيات end to end first** as the
  schema proof, then the remaining four, which are largely mechanical once the first is right
- A **verification pass that is separate from the transcription pass and does not trust it**
- Fix شعبة الرياضيات's missing quarter: الحساب التكاملي · الأعداد والحساب · التحويلات النقطية
- `exam-subject` grounds in the corpus rather than the hand-written curriculum file

**Out:** التوزيع السنوي (→ J6), profile, tracker, any UI beyond the topic list.
**Why first:** nothing else can start. Also delivers item A, which is the only thing on the
shelf that fixes something for teachers we already have.

### J2 · `teacher-profile` — who the teacher is  ·  needs J1

Shelf item **B**. **Revised by §6g: it collects CLASSES, each carrying a stream** — not streams
alone. Progress is per class, so classes are what the rest of the product hangs off.

- Sign-up collects the teacher's **classes** (each with its stream, all six available from the five documents) and **school name**
- Per-stream topic list read from the corpus — the taxonomy stops being one global constant
- Generation uses the teacher's stream instead of the hardcoded `STREAM`
- The printed sheet carries the school
- The ~4,000 existing accounts keep working: absent profile must mean something sane, read
  through one helper, never `?? default` at call sites

**Not collected, deliberately:** تقني رياضي speciality (all four share one maths programme),
wilaya, years teaching, class size — nothing acts on them, and each sits behind a `teacherId`
that never expires and cannot be revoked.
**Open, verify don't assume:** does a teacher teach one stream or several?

### J3 · `progress-tracker` — where the teacher is  ·  needs J1 + J2

Shelf item **F**, product half.

- `teacher_progress`, separate collection and separate lifetime from `programme`
- `programmeVersion` on the record, so a ministry revision cannot silently re-point a
  teacher mid-year
- The guided programme view: الأسبوع · المحور · الكفاءات · المحتويات · السير المنهجي · الحجم
- The teacher marks where they are — **their marked position is the truth**, never the calendar

**Why it matters most commercially:** this is the weekly habit loop. §5's frequency problem is
a symptom of the product being one low-frequency artifact; this is the fix.

### J4 · `progress-aligned-exams` — the payoff  ·  needs J3

Shelf item **F.4**, and it makes roadmap item 4 real.

- Exam scope derived from tracked position — «اختبار الفصل الأول» becomes one choice
- Weighting from hours actually spent
- **Material not yet taught is excluded** — the half that matters most, and the one thing
  nothing in the product can currently prevent
- Devoir vs composition become distinct by scope-to-date, not just duration

### J5 · `weekly-series` — سلاسل التمارين  ·  needs J4

Shelf item **C**, roadmap item 3. Reuses the fan-out engine; the plan skill is simpler than the
exam's (one chapter, no summing to 20, no duration budget). Scoped to *this week* by J3/J4, which
is what distinguishes it from a small exam.

### J6 · `school-year-calendar` — التوزيع السنوي  ·  needs J3

Weeks → real dates, holidays, and the **assessment windows** that let the product act rather than
record: *the composition is due in two weeks and may cover weeks 1–11*. Annual, teacher-made,
confirm-don't-trust.

> **Re-prioritised 2026-08-10.** §6d deferred this on the grounds that "the calendar improves
> *defaults*, not correctness" — which is still true, and no longer the whole story. **Pacing
> (§6h) is a question the teacher asks unprompted**, and answering it needs a reference schedule
> to compare the marked position against. A crude version ships with J3 (start date + holidays);
> the good version is this job.

### J8 · `course-layer` — الدروس  ·  needs J1, and an accuracy bar

New with §6g, which reversed §5's exclusion. Each content item in a week gets an authored course
with a sheet — explanation, demonstration, equations. Per-course exercise generation is the
narrowest and best-grounded scope in the product.

**Gated on a decision, not on a dependency:** ⚠ *what is the accuracy bar, and who verifies it?*
A wrong course carries our implied authority into a classroom. Do not start this job before that
is answered.

**Structurally cheap because the corpus already left room** — courses hang off `guidance` per week
(§6f.4). **Structurally strict:** authored material is stored separately from transcribed
material and is visibly ours, the week's السير المنهجي is binding on it, and a sheet is the
teacher's prep, never a student handout.

### J7 · `exam-versions` — نماذج متعددة  ·  independent

Shelf item **D**, roadmap item 2. Same questions, different numbers, shuffled. Nearly free since
per-exercise regeneration shipped, and it depends on nothing here — droppable into any gap.

### Not yet jobs

- **Course material under السير المنهجي** — reverses a recorded scoping decision (§5
  *Deliberately skipped*). Needs a deliberate yes or no before it becomes a job.
- **Remediation sheets** (roadmap 5) — much stronger after J3, since "which chapter went badly"
  becomes something the teacher has already recorded rather than something we ask them.
- **Personal exercise library** (roadmap 6) — the raw material accumulates from day one:
  insert-only storage, no delete route, and every superseded exercise already kept.

## 7. Scoping decisions

- **Standalone product.** Not merged with the separate student-facing BAC e-learning idea. May share curriculum-grounding thinking, built independently.
- **First track: Math.** Other subjects later.
- **Export: keep it simple.** Print-to-PDF via a standalone printable page.
