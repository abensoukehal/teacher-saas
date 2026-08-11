# teacher-saas — full product description (for UX)

> **Purpose.** A single self-contained brief a designer can work from: who the user is,
> what they need across a whole school year, every surface the product needs, every state
> each surface can be in, and what is decided versus still open.
>
> **Written 2026-08-10, against the repositioned product** (`docs/product-brief.md` §2 and
> §6d/§6f). The brief is the source of record; this file is the design-facing projection of
> it. Where the brief and `project/CLAUDE.md` disagree, the brief wins.
>
> **Reading key**
> — **SHIPS** · exists today, working, you can look at it
> — **DECIDED** · agreed, not built. Safe to design.
> — **OPEN** · genuinely undecided. Do *not* design it as settled; draw the fork if you draw it at all.
> — **OUT** · deliberately excluded. Designing it is scope error, not initiative.

---

## 1 · The product in one paragraph

**The prep platform for Algerian lycée maths teachers: it makes the day-to-day easier and keeps
them on the official programme.**

Built on the ministry's own التدرج السنوي. It knows what each class's stream teaches, in what
order, and where that class has actually reached — and from that it produces what the teacher
needs next: this week's exercise series, the course sheet for what they're teaching Tuesday, a
devoir over what has been covered, a trimester composition, the model correction with its grading
scale. The teacher refines anything they don't like in plain Arabic, then prints it.

### The value we lead with: **conformity to the official programme**

This is the pitch, not a supporting feature. Everything the product makes is grounded in the
ministry's own documents and in where the class has actually reached — the right unit, at the
right level, within the ministry's own stated limits, and **never material the class has not yet
been taught**.

Why it leads: it is the failure a teacher cannot afford. An off-syllabus exercise is discovered
in front of the class, or worse, at the BAC. And it is the one claim nothing else in their world
makes — not the textbook (which is not the syllabus), not a colleague's old papers, not a Facebook
group, and emphatically not a generic chatbot, which will produce confident French-curriculum
mathematics without ever knowing it did.

**Time is the second value**, and it is real: an evening's work compressed into minutes, across
the whole week's prep rather than the three-to-six evenings a trimester when an exam is due. But
speed is a convenience that anyone can eventually copy. **Being demonstrably on-programme is the
moat**, and it is why the corpus is the backbone rather than a grounding detail.

**What this means for design — the product must *show its work*, not assert it.** Conformity is
only worth something if the teacher can see it:

- Name the source. «وفق التدرج السنوي — سبتمبر 2022» on the artifact, not in a settings page.
- Show the ministry's own words. The week's السير المنهجي, verbatim, where the teacher is working — including its prohibitions.
- State the scope out loud. «يغطي الأسابيع 1 إلى 11» **and** «لن يتضمّن: الهندسة في الفضاء (لم تُدرَّس بعد)». The exclusion line is the product proving the claim.
- Mark what is ours. Anything derived or authored is visibly not the ministry's.
- Never say "AI" anywhere in the UI. It names the mechanism and undercuts the claim — the teacher does not want a clever machine, they want a paper they can defend to an inspector.

**The boundary is "prep, not performance."** Everything the teacher does alone, before they stand
in front of the class, is in scope. Anything happening *in* the classroom, anything student-facing,
and all administration (grades, attendance, parents, timetables) is out — see §14. "Day-to-day"
means the prep, not the paperwork.

---

## 2 · Who is using it

| | |
|---|---|
| **Who** | A lycée mathematics teacher, 3AS (final year, BAC year). Teaches 1–4 classes, likely across more than one stream. |
| **Language** | Arabic. Not "Arabic first" — Arabic **only**. There is no second locale and no English fallback anywhere, including error text. |
| **Device** | Assume a laptop at home in the evening for the real work, and a phone in a staff room for glancing. Print happens from the laptop. Design phone-usable, not phone-first. |
| **Tech comfort** | Uses Word, Facebook groups, a phone. Does **not** know what LaTeX is, what a token is, or what "regenerate" means as jargon. |
| **When they use it** | Evenings and weekends. Around assessment windows the load spikes hard; between them it is weekly at most — which is exactly the frequency problem the programme tracker exists to fix. |
| **What they already own** | The textbook, their own notes, years of accumulated exam papers on paper or in Word. The product is not competing with those — it is competing with the blank page at 9pm. |

**The emotional truth to design around:** this teacher is tired, is doing this after a full day,
and has been burned by tools that produced confident nonsense. Every screen should be legible in
three seconds and every claim the product makes should be one it can back.

---

## 3 · Hard constraints — check any design against these before drawing it

Each one invalidates a plausible-looking screen.

| Constraint | What it rules out |
|---|---|
| **Arabic only, RTL throughout** | Any LTR-first layout. Any English string, even a placeholder. Any component that breaks under `dir="rtl"` — sliders, breadcrumbs, progress bars, drawers, back arrows, number inputs all have a direction. Numerals: use Western digits (3, 20, 120) as the codebase does; Arabic-Indic digits are a decision nobody has taken. |
| **Mathematics renders as real typeset math (KaTeX)** | Plain-text math (`x^2`), math as an image, math in a screenshot. Fractions, integrals, matrices and piecewise arrays must render properly, inline and display. Design has to leave vertical room: a display equation is 2–3 line-heights tall and an array can be six. |
| **LaTeX is fully hidden — always** | No LaTeX in any input, any editable field, any error message, any export, any tooltip. A teacher must never see `\frac{}{}`. Refinement is natural language only: «صغّر الأرقام», never a formula editor. There is no "edit the source" escape hatch, by design. |
| **Everything stays inside the official programme** | Off-syllabus content is a correctness bug, not a style issue. The teacher only finds out in front of the class. This is why the programme corpus is the backbone and not a nicety. |
| **A generation takes 60–150 seconds** | This is the single biggest UX constraint in the product. No spinner-and-wait screen is acceptable. See §9. |
| **Don't over-engineer** | The next milestone is two teacher friends reacting to a working product. Ship lean. |

---

## 4 · The teacher's year — what they actually need, month by month

This is the spine. The product is not a tool that is opened when an exam is due; it is meant to
be the teacher's working calendar. The official programme runs **27 teaching weeks**; the year
runs September to June around three trimesters.

| Period | What the teacher is doing | What the product owes them | Status |
|---|---|---|---|
| **Late August / September** | Being assigned classes and streams. Getting oriented for the year. | Sign-up, pick stream(s) and school, see the whole official programme laid out as a plan rather than a lost PDF. Mark a starting position. | Sign-up SHIPS · profile + programme **DECIDED** |
| **Weeks 1–2, September** | Diagnostic assessment (تقويم تشخيصي — the programme's own first week). | A short diagnostic series over last year's prerequisites. | **DECIDED** (J5, series) |
| **Every week, all year** | Teaching a unit; preparing what to say; needing homework and classwork. | The week's content items as course sheets to prepare from, this week's exercise series (سلسلة تمارين) scoped to what has actually been taught, and **where the class stands against the schedule**. Mark the week done. | tracker + series **DECIDED** (J3/J5) · courses **DECIDED** (J8) · pacing **DECIDED** (§6h) |
| **Every 3–4 weeks** | Setting a devoir surveillé (~1h, narrow, recent material). | A devoir whose scope is derived from the last few weeks, not typed from memory. | Generation SHIPS · scope-from-progress **DECIDED** (J4) |
| **December · March · May** | Trimester composition (~2h, everything so far). Highest-stakes prep of the trimester. | «اختبار الفصل الأول» as one choice: scope = weeks 1..N, weighting derived from hours actually spent, and **nothing the class has not reached**. Plus the model correction and the grading scale. | Generation + correction SHIP · derived scope **DECIDED** (J4) |
| **Exam day** | Copying, invigilating a crowded room. | Multiple versions of the same paper — same questions, different numbers, shuffled order. | **DECIDED** (J7, independent) |
| **After marking** | "Half the class failed on limits." | A remediation sheet (تمارين الدعم) aimed at the unit that went badly — which the tracker already knows, because they recorded it. | **DECIDED**, not yet a job |
| **Second/third trimester** | Same rhythm, more material in scope, less time. | Same loop; the library is now large enough to reuse from. | Library grows from day one (nothing is ever deleted) |
| **April–June** | BAC revision. Every past unit at once, BAC-pattern papers. | Whole-programme revision series and BAC-style papers. Highest-value moment of the year and the least designed-for today. | **OPEN** — no job, no decision |
| **End of year** | Nothing to prepare; reflecting on what to change next year. | Their year's archive, searchable by unit. Their own bank. | Raw material exists; the library UI is **not built** |

**Design consequence:** the home screen must answer *"what do I need this week?"* — not
*"what would you like to generate?"*. A blank form is the right screen for month one and the
wrong screen for the other eight.

---

## 5 · Information architecture

```
                 ┌────────────────────────────────────────────────┐
                 │  FIRST RUN                                     │
                 │  landing → sign up → classes (stream each)     │
                 │  → school → where each class has reached       │
                 └─────────────────────┬──────────────────────────┘
                                       ▼
   ┌───────────────────────── HOME · «هذا الأسبوع» ─────────────────────────────┐
   │  [class switcher]  where this class is · this week's contents · guidance   │
   │  what is coming · what I made recently                                     │
   └───┬───────────────┬───────────────┬───────────────┬───────────────┬────────┘
       ▼               ▼               ▼               ▼               ▼
  ┌─────────┐   ┌────────────┐   ┌───────────┐   ┌──────────┐   ┌───────────┐
  │ البرنامج │   │ امتحان جديد │   │ سلسلة     │   │ مكتبتي   │   │ حسابي     │
  │ tracker │   │ new exam   │   │ series    │   │ library  │   │ account   │
  └────┬────┘   └─────┬──────┘   └─────┬─────┘   └────┬─────┘   └─────┬─────┘
       │              │                │              │          classes · school
       ▼              │                │              │          plan · profile
  ┌──────────┐        │                │              │
  │ الدرس     │       │                │              │
  │ course   │───┐    │                │              │
  │ + sheet  │   │    │                │              │
  └──────────┘   ▼    ▼                ▼              │
            ┌──────────────────────────────┐          │
            │  SCOPE + FORMAT → GENERATING │          │
            │  course·week·unit·to-date    │          │
            │  progressive, never blocking │          │
            └──────────────┬───────────────┘          │
                           ▼                          │
                 ┌──────────────────┐                 │
                 │  THE DOCUMENT    │◀────────────────┘
                 │  read · refine   │
                 └──┬───┬───┬───┬───┘
                    ▼   ▼   ▼   ▼
               refine  history  correction  print
                                 + سلّم      + versions
```

Five destinations, one working surface. **The document view — exam, series or sheet — is where the
teacher spends their time**; everything else is a route into or out of it. Note the generator is
one box, not four: scope and format are its two inputs (§5b).

---

## 5b · The domain model

Agreed 2026-08-10. This is the spine every surface hangs off, so it is worth reading before
drawing anything. The shape is intuitive; three places it does **not** behave like a clean tree,
and each one has bitten a plausible design already.

```
teacher ──teaches──▶ class(es) ──has a──▶ stream
   │                    │
   │                    └──has──▶ progress ──against──▶ programme(version)
   │
   └── profile: school, streams taught

programme                    ← OFFICIAL · verbatim · versioned by ministry document (2022-09)
  serves 1..n streams              ⚠ NOT 1:1 — five documents cover six streams
  competencies?                    ⚠ nullable — absent in two of the five documents
  units[]      ← from the summary table: name, week budget, hour budget
  weeks[]      ← THE SPINE. One row per week, the ministry's own six columns:
                 الأسبوع · المحور · الكفاءات المستهدفة · المحتويات المعرفية ·
                 السير المنهجي لتدرج التعلمات · الحجم الساعي

        unit ──▶ weeks   is a BACK-REFERENCE (the weeks carrying that unitId),
                         never containment — see rule 1 below

  week ──▶ contents[] ──▶ course ──▶ sheet     ⚠ AUTHORED BY US — see rule 3
                 ▲
           guidance (السير المنهجي) CONSTRAINS the course and its exercises;
           it is not their parent

school_year                  ← التوزيع السنوي · teacher-made · changes every September
  week 1..N → real dates, holidays, assessment windows

scope  =  course ⊂ week ⊂ unit ⊂ programme-to-date
          └──── one selector, one generator, four scopes ────▶ series · exercises · exam
```

### The five rules this model turns on

**1 · The week is the spine; the unit is a label on it.** The ministry publishes one row per
week, naming the unit on the row. A unit's weeks are the set of week-rows carrying its id — and
that set **repeats and is non-contiguous** (علوم تجريبية lists المتتاليات العددية twice;
لغات أجنبية splits الحساب / الحساب تابع). A `unitId` cannot be derived from a name or a position,
and **weeks are not integers** — `أسبوع ونصف`, `أسبوعان ونصف`, `3 أسابيع ونصف` all appear. Do not
draw a clean 1..27 stepper and assume the data fits inside it.

**2 · A programme serves streams, plural.** Five documents, six streams — آداب وفلسفة and
لغات أجنبية share one. The documents also do not share a schema: تسيير واقتصاد and آداب وفلسفة
carry **no competencies section at all** (absent ≠ empty), علوم تجريبية has five competency
domains where the others have six, and column headers differ between documents. Domains are data,
never an enum. Store headers verbatim; do not normalise them.

**3 · The course layer is ours, and must be stored where that is obvious.** Everything in
`programme` is the ministry's words, verbatim, with provenance — that is the entire basis for
claiming a generated paper is on-syllabus. A course is **authored by this product**. It lives in
its own collection, keyed to `(week, content item)`, marked authored-not-official, with the
week's guidance as its binding constraint. Mixing authored material into the transcribed store
would destroy the one distinction that lets the product tell a teacher which parts are the
ministry's and which are ours.

**4 · Progress belongs to a class, not to a teacher.** A teacher with two 3AS classes has **two
positions in the same programme** — one class fell behind. A teacher covering رياضيات and
علوم تجريبية is running two programmes at once. So progress is keyed `(class, schoolYear)`, and a
class carries a stream. Modelling it per teacher-stream silently merges two classes that are
three weeks apart, and the teacher discovers it when an exam covers material one class has never
seen. **UX consequences:** sign-up asks about classes, not only streams; home needs a class
switcher; every generation answers "for which class?"; the tracker shows one class's position at
a time.

**5 · Three lifetimes, three stores, never merged.** `programme` is the ministry's and changes
rarely. `school_year` is teacher-made and changes every September. `progress` is the class's and
changes weekly. Conflating the first two means re-transcribing 73 pages to change some dates, and
makes a ministry revision indistinguishable from a calendar shift. Every progress record carries
the `programmeVersion` it was built against, so a ministry revision cannot silently re-point a
class mid-year.

### One generator, four scopes

Course, week, unit and progress-to-date are **not four features**. They are one scope selector
feeding one generator, and the format is a second, independent choice:

| scope | what it means | typical format |
|---|---|---|
| **course** | one content item inside a week | a few targeted exercises |
| **week** | this week's row | سلسلة أسبوعية — homework or classwork |
| **unit** | every week carrying that unitId | end-of-chapter series · تمارين الدعم |
| **progress-to-date** | weeks 1..*marked position* | فرض · اختبار الفصل |

Build the selector once. The scope also decides which slice of the corpus is passed to the
generator — the narrower the scope, the tighter the grounding, which is why per-course exercises
should be the most on-syllabus output the product produces.

**The rule that never bends, at every scope:** material the class has not reached is excluded.
The teacher's marked position is the truth; the calendar is at best a default.

---

## 6 · Screen by screen

Each screen below carries: what it is for, what is on it, every state it can be in, and its
status. Arabic strings are given where they are load-bearing; treat them as intent, and have a
teacher check the wording before launch.

### 6.1 Landing / first run — **SHIPS (bare)**

The teacher arrives from a Facebook group link or a colleague's message. They have never heard
of this and will decide in about eight seconds.

- One line of what it is, in a teacher's own words — not «منصة ذكاء اصطناعي», but «اصنع اختبارك في دقائق بدل سهرة كاملة».
- **One example they can see without signing up.** A real generated exam, typeset, printable-looking. The product's whole credibility is in the artifact; hiding it behind sign-up wastes the strongest asset.
- Two paths: «ابدأ الآن» (sign up) and «لدي حساب» (sign in).

**Today** an anonymous teacher id is minted silently on first load and everything works without
an account. That is good for trial and must survive any redesign: **let them generate one exam
before asking for anything.** The sign-up ask lands after the first real artifact exists.

**States:** first visit · returning-with-account · returning-anonymous-with-exams (offer to
claim them) · service down (see §10).

### 6.2 Sign-up — **SHIPS, all four steps**

Today: email + password → an account, plus a **one-time recovery code** shown once (there is no
email sending, so this code *is* the reset path) — and then two more screens, the classes and
the school, and where each class has reached. Steps 3 and 4 shipped 2026-08-11.

Screen order that respects the eight-second rule:

1. **Email + password.** Nothing else. (Signing up for an address that already has an account no longer says so: it answers exactly like a first sign-up, with a working teacher id and a **decoy** recovery code, to close a one-request way to test whether a colleague has an account. The consequence to design for: a teacher who reuses their own address is left holding a code that cannot be redeemed and nothing tells them why.)
2. **The recovery code**, full screen, once. This is the most under-designed moment in the product today and the most expensive to get wrong: if they lose it and clear their browser, their year is gone. Give it weight — large, copyable, «احتفظ بهذا الرمز» — with a download/print affordance and a confirm-you-saved-it step.
3. **Your classes** — not "your stream". **SHIPS.** Per §5b rule 4, progress belongs to a class, so classes are the unit sign-up collects: a name the teacher already uses («3ر1», «3ع2») and a stream each, from all six (شعبة الرياضيات · تقني رياضي · علوم تجريبية · تسيير واقتصاد · آداب وفلسفة · لغات أجنبية), nothing pre-selected. Add-another is the default expectation, not an edge case — most teachers have several, and two classes in the same stream are still two classes.
   > This is what retires the old "one stream or several?" question: a teacher has classes, each with a stream, and multi-stream falls out for free.
   >
   > As built: no «رجوع» on this step (the screen upstream is the recovery code, shown once and gone). Classes are created one at a time in the order typed, because that order is the switcher's tab order. A row the server refuses keeps its text and gets its own Arabic reason; a row that succeeded is dropped, because creating is insert-only and re-sending is a second class. **A reload here loses what was typed** — the wizard is not persisted — and the browser Back button exits the app, because the wizard pushes no history.
4. **School name**, optional-but-encouraged, because it goes on the printed header. Explain that: «سيظهر على الموضوع المطبوع». **Collected and stored — and read by nothing yet**, so it appears nowhere, including the account screen. Design the read before promising it back to the teacher.
   > **OPEN:** does the school belong to the *teacher* or to the *exam*? A teacher who moves schools, or writes for two, breaks the first model. The class model does not settle this. As built it is on the teacher.
5. **Where has each class reached?** **SHIPS.** Per class, since they differ. Skippable per class, and settable later from the class's own surface on home — the tracker (§6.5) is not built. Asked here it makes the first home screen useful instead of empty, and it is the single most valuable thing a new teacher can do in their first minute.
   > As built: **skipping writes nothing at all.** A class nobody positioned simply has no stored position and reads back as week 0. Recording the skip as "week 0" would make "not started" and "started at zero" the same fact. And this step reuses the home surface at full size, so its heading and lede repeat once per class — the host hides them with styling; it wants a compact variant.

**Deliberately not collected:** تقني رياضي speciality (all four share one maths programme),
wilaya, years teaching, class size. Nothing acts on them, and every personal field sits behind a
teacher id that never expires and cannot be revoked.

### 6.3 Sign-in and recovery — **SHIPS**

- Sign in: email + password. Returns the teacher to everything they have.
- Recover: email + the one-time recovery code → set a new password. **The code is consumed and a fresh one is issued** — the new code must be shown with the same weight as at sign-up, because the old one is now dead.
- **The sharp edge, currently handled and worth keeping visible:** signing in *does not merge* an anonymous session. If the teacher generated exams anonymously and then signs into a different account, those exams belong to the anonymous identity. The product keeps that displaced id and tells the teacher in Arabic. Design this as a real, recoverable moment — «لديك اختبارات محفوظة في جلسة سابقة» with a way back — not a toast.

**States:** wrong password · unknown email · rate-limited (`429`, retryable — say when to try again) · recovery code already used · service down.

### 6.4 Home — «هذا الأسبوع» — **today: a class switcher, a position, and a list. DECIDED: the week.**

Today home is: a class switcher across the top, the selected class's position, the controls form
and a list of saved exams. The switcher and the position ship; **the week card and the pacing
line do not.** That is still the right screen for a generator and the wrong one for a companion,
and **this is the anchor screen of the redesign** — the one that decides whether the product is
opened weekly or three times a trimester.

**The class selector sits above everything — SHIPS.** Per §5b rule 4, a teacher has classes and
each has its own position. Home shows one class, named the way the teacher names it («3ر1»,
«3ع2»), with a switcher across the top. Nothing on this screen is meaningful without it.

As built:

- **A tab reads «3ع2 · أسبوع 8» with a thin rail** filled `markedWeek / totalWeeks` — the
  position only, never the pacing — the pacing section below needs a reference schedule that
  does not exist yet. The rail is ink, not colour: the product does not grade the teacher.
- **A class with no position shows its name alone.** No rail, no «أسبوع 0» — the product will
  not assert a position nobody set. Selecting it puts the whole question on screen instead:
  «أين وصل هذا القسم؟», a week picker running from 0 to that class's own last week (27 in
  every corpus document today, and read per class rather than assumed), and 0 labelled
  «لم نبدأ بعد».
- **Switching is a full context change**, exactly as §6.5 requires: the open exam, the refine
  panel and the corrections all go, and the saved-exams list re-reads scoped to the new class.
  One thing survives — an exam that failed to save and is waiting to be retried.
- **A teacher with no classes sees the pre-class home, unchanged.** No switcher, no empty row.
  Every teacher who predates this is in that state, and so is anyone whose class list fails to
  load — which is deliberate, and is the honest cost: **in the switcher, a class whose position
  could not be read looks identical to a class genuinely at week 0.**
- **Nothing is auto-selected.** A returning teacher gets their classes back with no tab
  selected, and a class they just created does not become the current one. Both are undesigned,
  not decided.
- **The saved-exams list under a class shows that class's exams plus every exam made before
  classes existed** — never a strict partition, or thousands of exams would vanish the moment a
  teacher picked a tab. And **a newly generated exam is stored with no class at all**, so it
  appears under every tab. That is the first thing a teacher trying the switcher will notice,
  and closing it is a later slice.

**The week card — the largest thing on the screen.** Not a list item, not a stat tile: a card that
reads like a page from their own planner.

- **Where the class is** — «الأسبوع 12 من 27», the unit («المحور: الدوال الأصلية والحساب التكاملي»), and a progress bar **over the programme, not over the calendar**. Position is what the teacher marked, never what the date implies.
- **What this week contains** — the week's المحتويات المعرفية, listed. Each line is a content item, so each is a course, so each is one tap from targeted exercises. This is where the course layer earns its place on the home screen rather than in a menu.
- **The السير المنهجي note for this week**, readable — the ministry's own guidance on how far to go and what not to ask. It is the most reassuring thing the product can put in front of a teacher, and it is currently nowhere in the UI.
- **Two actions, in the teacher's language:** «سلسلة هذا الأسبوع» and «أنهيت هذا الأسبوع» (which advances the position and offers the next one).

**Pacing — «هل أنا متأخر؟» — the second-largest thing on the screen.**

A teacher wants to know whether they are **behind or ahead of the programme**. It is the first
thing the product says that they cannot easily work out themselves: position they already know,
but pacing means holding the official week budget, the real calendar, the holidays and their own
drift in their head at once — arithmetic nobody does well at 9pm and everybody worries about all
trimester.

- **The line itself:** «متأخرون بأسبوعين عن التوزيع» / «في الموعد» / «متقدّمون بأسبوع». Neutral, factual, no colour-coding that reads as a grade.
- **And the bar** — see below. The gap between two markers on one bar *is* the pacing; the sentence names it, the bar shows it.

#### The progress bar — one bar, two markers

The primary instrument on home and along the top of the tracker. It carries both facts at once:
how far through the programme this class is, and how that compares to the schedule.

```
    ← RTL: the programme starts at the RIGHT and fills leftward →

        ▼ متوقع (week 14)
    ┌───────────┬────────────────────────────────────────────┐
    │           │████████████████████████████████████████████│   الأسبوع 12 من 27
    └───────────┴──────────────▲─────────────────────────────┘
     ↑ remaining                └ marked position (week 12)
                     └──┬──┘
                    the gap IS the pacing → «متأخرون بأسبوعين»
```

**Rules:**

- **Fill = what the teacher marked done.** Never what the date implies. The fill edge is the class's real position.
- **A second marker = where the reference schedule says they'd be.** A tick or line, visually distinct from the fill, never a second fill — two fills read as two competing truths, and only one of them is true.
- **The gap between them is the whole point.** Label it numerically («−2 أسابيع» / «+1 أسبوع»); the visual carries the feel, the number carries the fact.
- **Ahead renders as the fill passing the marker.** Same instrument, no special case, no celebration animation.
- **Segment the bar by unit, and size segments by HOURS, not week count.** Weeks come in halves (`أسبوع ونصف`) and units repeat non-contiguously, so a uniform 27-cell bar is a lie about the data. Hours are the ministry's own budget and make الأعداد والحساب (21 h) visibly weightier than a 7 h unit — which is exactly the intuition a teacher needs when deciding what to compress.
- **RTL is load-bearing.** The bar fills right-to-left. A progress bar is one of the components most likely to be built LTR by accident and it will be immediately, obviously wrong to the user.
- **No red/green.** Behind is not a failure and ahead is not a reward — colour-coding pacing turns a working tool into a report card. One neutral fill, one clear marker, the number in text. Never colour alone: the state must be readable in monochrome and by a screen reader.
- **No reference schedule → no marker.** Show the fill alone. An invented "on track" is worse than an honest absence.

**Where it appears, at three densities:**

| place | form |
|---|---|
| **Home** | Full bar, unit-segmented, both markers, the pacing sentence beneath it. The second-largest thing on the screen. |
| **Tracker** | The same bar pinned along the top as the spine of the week list, so a row's position in the year is always visible while scrolling. |
| **Class switcher** | One thin bar per class, no segments — so a teacher sees at a glance that 3ر1 is fine and 3ع2 is three weeks behind. This is the strongest argument for the whole class model being visible in the UI. |

**Per-unit bars, in the tracker:** each unit also gets its own small bar — hours done against the
ministry's budget for it. That is where «متأخرون» becomes actionable: it names *which* unit ran
long.
- **Then be useful, immediately.** Behind → what to compress, and an exam scope that already reflects reality. Ahead → the next unit's material, offered now. **Ahead is easy to forget and just as real.**
- **It feeds everything else.** Pacing is the input to every recommendation: what the composition can cover, whether this week's series should be lighter, which units are at risk.

**Three rules, and they are not stylistic:**

1. **The comparison is informational. The teacher's marked position stays the truth.** Pacing must never quietly re-point the class to where the schedule says it should be.
2. **The reference is not authoritative.** The year distribution (التوزيع السنوي) is teacher-made, informally published and sometimes mislabelled — the archived example is advertised as 2025–2026 and its own header reads 2024–2025. Being "behind" means behind *one teacher's plan*, not behind the ministry. Say it that way.
3. **Never nag.** Falling behind is the normal condition of Algerian lycée teaching — lost weeks, crowded programmes, real life. A product that scolds gets closed.

**Cheap version ships first:** with a school-year start date and a holiday list you can already say
±N weeks. The good version needs the calendar (J6). Note that naive date arithmetic is wrong —
holidays are why consecutive programme weeks can sit five calendar weeks apart.

**What is coming.** «اختبارات الفصل الأول بعد أسبوعين — تغطي الأسابيع 1 إلى 11» once the calendar
is known (J6), with the one-tap offer to prepare it. Before the calendar exists, this slot holds
whatever is derivable from the position alone.

**What I made recently.** The last few artifacts — exams, series, corrections, courses — reopenable
in one tap. This is a strip, not the page.

**States**
- **Brand-new teacher, nothing marked:** never an empty list. Show the programme from week 1, and one action: «حدّد أين وصلت» — the single most valuable thing they can do in their first minute.
- **No reference schedule yet:** pacing is simply absent. Show position alone rather than a guess — an invented "you're on track" is worse than nothing.
- **Between trimesters, holidays:** the calendar knows; say so rather than showing a stale week.
- **Multiple classes at different positions:** each switch is a full context change. Nothing carries over.
- **End of programme (week 27):** the year's archive and a revision entry point — the one moment §11 admits is undesigned.

**Design note:** everything else in the product is reachable from a menu. The position line is the
only thing that earns a weekly open, so it gets the weight.

### 6.5 The programme tracker — «البرنامج» — **DECIDED (J3), not built**

The ministry's own week-by-week table, rendered as something a teacher works with instead of a
PDF they lose. This is the surface that earns weekly opens and it does not exist yet.

**Structure per row (the ministry's own columns — keep the names):**

`الأسبوع · المحور · الكفاءات المستهدفة · المحتويات المعرفية · السير المنهجي لتدرج التعلمات · الحجم الساعي`

**السير المنهجي is the richest column in the corpus** and nothing in the product can currently
express any of it. It carries precise level and explicit prohibitions, e.g.
«الدوال الناطقة (حاصل قسمة كثير حدود من الدرجة 2 أو 3 على كثير حدود من الدرجة 1 أو 2)» and
«لا تُختار مسألة البحث في إثبات استمرارية دالة». Design it as readable guidance, not a
collapsed detail nobody opens — it is the reason a teacher trusts the generated paper.

**What the teacher does here:**

- Sees the units, their week budgets and hours, grouped as the ministry groups them.
- **Marks where they are.** Per week: `planned · done · skipped`, plus a free note («الصف تأخر أسبوعا», «فصل صعب»). Marking is per class — the tracker shows one class at a time and switching is a full context change.
- **Sees the pacing along the spine** — where the reference schedule says they'd be versus where they marked, rendered along the weeks rather than as a separate chart. §6.4 carries the rules; they apply identically here.
- From any week: open a content item's course, generate that week's series, or start an exam scoped to weeks 1..here.

**Four rules that are load-bearing and must survive the design:**

1. **The teacher's marked position is the truth — never the calendar.** Classes fall behind, schools lose weeks, teachers reorder units. A product that assumes "it's December, so week 12" is confidently wrong for most real classrooms. The calendar produces a *default*, never a fact.
2. **The official text is shown verbatim.** Never paraphrased, never summarised. The product's value here is precisely that it is not the author of the programme.
3. **Anything derived is visibly marked as derived** — inferred weights, mappings onto the product's own topic names, trimester boundaries. The corpus itself has no trimester grouping; inventing one is invention.
4. **⚠ Red text in the ministry documents is semantic.** In at least two streams a legend says red marks content not covered in 2021–2022 (post-COVID catch-up). The maths document has red blocks with no legend on the page. Whatever the design does with emphasis, it must **carry it, not flatten it** — and unlegended red must be marked unknown, never guessed.

**Weeks are not integers** — `أسبوع ونصف`, `أسبوعان ونصف`, `3 أسابيع ونصف` all appear. Units repeat
and are non-contiguous. Do not draw a clean 1..27 stepper and assume the data fits it.

### 6.5b The course sheet — **DECIDED 2026-08-10, nothing built, contents undefined**

Newest layer, and the one that most changes what the product *is*: each content item inside a week
gets a course, and each course has a sheet.

**High level, the sheet carries:** explanation in prose, the demonstration, and the equations.
Everything past that is open (§11) — length, how many worked examples, whether it prints, whether
it is one scrolling document or sectioned.

**What is already fixed about it:**

- **It is the teacher's prep, not a student handout.** See §14. This is the boundary the whole layer sits on.
- **It is authored by us and must look it.** The programme's words are the ministry's and are shown verbatim; a sheet is ours. The distinction has to be visible on the page, not buried in a data model — a teacher must be able to tell at a glance which text carries official authority.
- **Its guidance is binding.** The week's السير المنهجي states the level and the prohibitions. A sheet that exceeds them is wrong in the same way an off-syllabus exercise is wrong.
- **It is the tightest generation scope in the product**, so it should also be the most reliably on-syllabus output — one content item, one week's constraints, nothing else in view.
- **From any sheet: generate exercises for that course.** That is the shortest path in the product between "I am teaching this on Tuesday" and "here is what I will hand them."

**Design it as a document,** like the exam — typeset math, real hierarchy, room for a display
equation to breathe. Same refinement affordance as an exercise: plain Arabic, no source view.

**Do not design the sheet in detail yet.** The accuracy bar is unresolved and it governs the shape:
a sheet that must be verifiable line by line looks different from one presented as a first draft
the teacher edits.

### 6.6 New exam — the controls — **SHIPS**

Today, five controls and a generate button:

| control | today | Arabic label |
|---|---|---|
| Topic | 8-entry dropdown, one hardcoded stream | «الموضوع الدراسي» |
| Difficulty | 3-way segmented: سهل · متوسط · صعب | «مستوى الصعوبة» |
| Exercise count | number, default 3 | «عدد التمارين» |
| Duration | minutes, default 90 · ≥120 makes it a composition | «مدة الاختبار» |
| Free-text note | optional, plus four suggestion chips that **append**, never replace | «ملاحظات» |

**The known defect to design out (item A):** the eight-topic list is **missing about a quarter of
the year** for the one stream it serves — الدوال الأصلية والحساب التكاملي (3 weeks), الأعداد والحساب
(3 weeks) and التحويلات النقطية. That is 6 of 27 teaching weeks a teacher literally cannot ask
for, and a practising teacher notices immediately. The fix comes with the corpus: **the topic
list is read per-stream from the programme, never a hardcoded constant.**

**What this screen becomes (DECIDED):**

- **Format first, not duration.** «ما الذي تحضّره؟» → سلسلة أسبوعية · فرض · اختبار فصلي · دعم · مراجعة. Format then implies duration and scope, instead of duration implying format via a 120-minute threshold nobody can see.
- **Scope is proposed, not typed.** «اختبار الفصل الأول — يغطي الأسابيع 1 إلى 11» derived from the tracked position, with the units listed and editable. The teacher confirms or narrows; they don't reconstruct their own year from memory.
- **Weighting shown honestly.** The 20 points split by hours actually spent per unit — a unit that took 21 of 189 hours has a claim on ~12% of the paper. Show the split; let them drag it.
- **Excluded material is visible.** «لن يتضمّن: الهندسة في الفضاء (لم تُدرَّس بعد)». This is the half that matters most — an exam containing material the class has never seen is the single most damaging thing this product could hand a teacher.

**Keep the suggestion chips.** They are a cheap signal: if teachers tap chips rather than type,
the free-text box is intimidating and structured shortcuts are the real interface.

### 6.7 Generating — **SHIPS, and it is the hardest screen in the product**

A generation is a **whole agent loop**, not an API call. Measured: **~68–93 s** for a 2-exercise
devoir, **~128 s** for a 3-exercise / 2-hour composition. Under load the p95 goes past 110 s.
Corrections take about **145 s**. There is no version of this that finishes in three seconds, and
no honest design that pretends otherwise.

**How the product answers this today, and why it matters more than speed:** generation is
**progressive**. The system plans the exam first, immediately stores the whole skeleton — every
exercise with its label, points and difficulty, marked pending — then fills each exercise
concurrently. The teacher sees the *shape* of their exam within seconds and the first real
exercise at ~70–90 s, while the rest are still being written.

**It is not faster.** Measured end-to-end it is fractionally slower than generating the whole
thing at once. What it buys is two things, and both are UX:

1. The teacher has something real to read long before the paper is done.
2. One bad exercise costs **one exercise**, not the whole exam.

**So the generating screen is not a loading screen — it is the exam, arriving.** Design it as the
final layout, populated progressively:

- The header, title, total points and duration appear first and do not move.
- Each exercise card shows its real label («التمرين الأول»), its points and its difficulty from the start.
- A pending body says what is true: «جارٍ كتابة هذا التمرين… سيظهر نصّه هنا بمجرّد اكتماله.» — **never an empty box**, which reads as lost work, and never a percentage the product cannot honestly compute.
- Arrived exercises are immediately readable and refinable. Do not block the whole page on the last one.
- A failed exercise says so and offers one action: «تعذّرت كتابة هذا التمرين. بقيّة التمارين جاهزة ويمكنك استعمالها.» + «أعد المحاولة».

**The teacher can leave.** Everything is stored server-side as it lands. Closing the tab must not
lose the exam, and coming back must show whatever arrived. Say so on the screen — it converts a
two-minute wait from anxiety into permission to go make tea.

**One real failure mode to design for:** occasionally a run produces prose instead of a usable
exam. Seen once in ~200 generations, and only under heavy load — but it is a real user-facing
outcome, not a theoretical branch. Copy: honest, one retry, no error code.

### 6.8 The exam view — **SHIPS**

The working surface. It must read like the paper it will become.

- **Header:** title, level and stream, duration, total points. Points must visibly sum to 20 — that is what a teacher checks first, every time.
- **Exercises:** «التمرين الأول / الثاني / الثالث», each with its points («05 نقاط») and its parts numbered as an Algerian paper numbers them. Typeset math throughout.
- **Per exercise, four affordances:** refine · regenerate · history · (once corrections exist) show the correction.
- **Whole-exam actions:** print · generate the correction · make versions (J7) · save/rename.

**Density matters.** This is a document, not a dashboard. Generous line height, real typographic
hierarchy, math that breathes. The closer the on-screen exam looks to the printed sheet, the less
the teacher has to imagine.

### 6.9 Refine — «حسّن هذا التمرين» — **SHIPS. This is the product.**

Step 4 of the loop is the whole reason the thing exists. Everything else is scaffolding for this
moment: the teacher reads exercise 2, doesn't like it, says why in plain Arabic, and gets a better
one — with the same id, the same points, the same label.

- **Input is natural language only.** «صغّر الأرقام» · «اجعله أصعب قليلا» · «غيّره بتمرين آخر في نفس المحور». Suggestion chips for the three edits the brief names explicitly: change the values, change *this* exercise's difficulty, swap for a different exercise on the same topic.
- **Never expose the underlying markup.** No formula editor, no source view, no "advanced mode".
- **A refine is a full generation** — tens of seconds. Show the exercise being replaced in place, with the old one still readable until the new one lands. Do not clear the card.
- **Iterating must feel free.** The brief is explicit that metering refinement is a business-model landmine: teachers stop refining, accept worse exams, and conclude the tool is mediocre. Whatever billing lands, **the UI must never make a teacher count refinements.**
- **Conflict is possible and handled:** two refines on the same exercise at once are refused rather than silently losing one. The copy should read as reassurance, not error: the work is still happening.

### 6.10 History and restore — **SHIPS, barely surfaced**

Every superseded version of every exercise is kept, forever. Nothing generated is ever thrown
away and **there is no delete anywhere in the product.**

This is currently a stored capability with almost no UI, and it is a cheap, high-trust win:

- Per exercise: «النسخ السابقة» — a list of what this exercise was before, each readable and typeset.
- Restore is one tap, and is itself just another version — so restoring is never destructive either.
- Design consequence: the teacher can refine fearlessly. Say that somewhere, once: «لا شيء يُحذف. يمكنك دائما العودة.»

### 6.11 The correction — «التصحيح النموذجي» + «السلّم» — **SHIPS**

The teacher asks for the model answer to an exam they already have. Per exercise: a **worked**
answer (not a final result) plus the **grading scale**, whose parts sum exactly to that exercise's
points.

- Generated per exercise, arriving progressively like the exam does (~145 s for the batch).
- Printed separately from the exam — a teacher hands out the paper and keeps the correction.
- **Staleness is real and must be shown.** If the teacher refines an exercise after its correction was written, that correction now answers a statement that no longer exists. The product detects this per exercise. The UI must say so plainly — «هذا التصحيح يخص نسخة سابقة من التمرين» — with one action to redo it. Silently showing a wrong correction is the worst failure in the product: a teacher would hand it to a class.
- Restoring an old exercise *heals* its correction automatically. That is a nice moment; let it be visible.
- If a correction couldn't be produced, nothing is stored — the UI shows absence, never a blank answer.

### 6.12 Print — **SHIPS (print-to-PDF from a standalone page)**

Export is deliberately simple: a clean printable page, print-to-PDF from the browser. No PDF
engine, no Word export, no template gallery.

**What the sheet must carry.** ✎ *Proposed shape — the brief flags this as unverified; confirm
with a real teacher, and if they rewrite it by hand, the header design is wrong:*

```
              الجمهورية الجزائرية الديمقراطية الشعبية
                    وزارة التربية الوطنية
   مديرية التربية لولاية …            ثانوية …
   المستوى: 3 ثانوي — شعبة الرياضيات      السنة الدراسية: 2025/2026
   المدة: ساعتان                          المعامل: 7

              اختبار الفصل الأول في مادة الرياضيات

   التمرين الأول  (05 نقاط)
   …
```

Design requirements: A4, RTL, correct page breaks (**an exercise must not split across pages
mid-array**), math that survives print rendering, and a footer with page numbers. The school and
stream come from the profile so the teacher is not filling blanks by hand.

Separate printables: **the exam**, **the correction + scale**, and (J7) **each version**.

### 6.13 Library — «مكتبتي» — **raw material exists, UI does not**

Everything ever generated is kept, per teacher, insert-only. Over a year this becomes the
teacher's own bank — the roadmap's item 6 and the product's real switching cost.

- Filter by unit, format, difficulty, date, stream, class.
- Reopen anything; duplicate it as the starting point for a new one.
- Search inside statements would be valuable and is not yet designed.

**Today** this is a flat reverse-chronological list of exams. It works and it will not scale past
one trimester.

### 6.14 Weekly exercise series — «سلاسل التمارين» — **DECIDED (J5), not built**

Roadmap item 3, and the brief's own answer to the frequency problem: exams are needed 3–6 times a
trimester, series **weekly**.

Same engine with the exam envelope removed — no summing to 20, no duration budget, one chapter.
Scoped to *this week* by the tracker, which is what makes it different from a small exam. UI is
the exam view with a lighter header: 4–5 exercises, one unit, homework or classwork.

### 6.15 Multiple versions — «نماذج متعددة» — **DECIDED (J7), independent**

Same questions, different numbers, shuffled order. Anti-cheating in a crowded room, and per the
brief the best demo moment the product has — nobody else offers it.

UX: from a finished exam, «أنشئ نماذج» → 2–4 versions (نموذج أ / ب / ج), each printable, each with
its own correction. Cheap to build because per-exercise regeneration already exists. Does not
depend on the programme work, so it can drop into any gap.

### 6.16 Remediation — «تمارين الدعم» — **DECIDED, not yet a job**

"My class struggled with limits" → targeted easier exercises on that unit. Much stronger after the
tracker, because the weak unit is something the teacher **already recorded** rather than something
the product has to ask about. Entry point: from the tracker row, or from a finished exam.

### 6.17 Account and settings — **partially SHIPS**

- Email, password, a fresh recovery code on demand.
- **«أقسامي» — SHIPS.** Each class as «<name> — <stream> · الأسبوع N من M», or «لم يبدأ بعد»,
  with the ceiling read from that class's own programme. Plus add-a-class, using the same rows
  as sign-up step 3. **This is the only way an existing account makes a class**, so it is not
  decoration: every teacher who predates the class layer reaches classes here.
  - It **reads** positions and does not set them. The setter lives on home, where the teacher
    can see which class they are standing in; one compare-and-set must not have two homes.
  - Creating a class here closes the panel and hands the teacher back to the workspace.
- **Profile: school name — NOT built.** The school is collected at sign-up and stored, and
  nothing reads it back, so this screen shows no school field. A blank input would silently
  clear what they typed. Designing the read is what unblocks it, along with what appears on
  the printed header.
- **Stream(s)** are not a profile field and should not be drawn as one — a stream belongs to a
  class, not to a teacher.
- **Plan/credits** — see §8, and read the OPEN warning before drawing a checkout.
- Sign out. Note the sign-out warning: an anonymous session's work is tied to a device-held id, and the copy must be honest about what leaving costs.
- **No rename, no delete, no archive for a class**, on this screen or anywhere. A class made by
  mistake is permanent today, and a name made only of invisible characters is accepted and
  renders as a blank tab.

### 6.18 Admin console — **SHIPS · operator-facing, not teacher-facing**

An internal console behind an admin role: teacher counts, exam counts, per-exam KPIs, usage.

**One rule that must not be broken:** the product records a per-run `costUsd`, and **it is not
money.** The product runs on a subscription, not per-call billing; that number is a usage signal
only. Never render it as currency to anyone, teacher or operator — a KPI labelled in dollars would
be the product lying to its own operator. Label it as usage.

---

## 7 · Every state, in one place

Design each of these; they are all reachable.

**Empty**
- No exams yet · no series yet · no correction yet · no progress marked yet · library empty · no versions yet.

**In progress**
- Exam skeleton arriving · exercises filling one by one · one exercise refining (others usable) · correction batch running · a version set building.

**Partial — the state this product has more of than most**
- Some exercises ready, some pending, some failed — **all on the same page, all usable.**
- A correction that exists for some exercises and not others.
- An exam whose correction is stale for exercise 2 only.

**Errors, with their real meanings** (the backend distinguishes these deliberately; the UI must too)

| What happened | What the teacher must understand | Retryable? |
|---|---|---|
| The AI service needs re-authentication | Something on our side needs a human. Nothing they can do; nothing they did wrong. | **No** — do not offer retry |
| Timeout | It took too long. Try again, maybe a smaller exam. | Yes |
| The generation failed | This one attempt failed. | Yes |
| The datastore is down | Their work is safe but can't be saved right now. | Yes — and the product **queues the save and offers it on next load**, never replays it silently (a silent replay would create two exams) |
| Not signed in / unknown id | Sign in, or recover with the code. | — |
| Wrong password / bad recovery code | Say which, without revealing whether the account exists more than the product already does. | — |
| Too many attempts | Wait, and say roughly how long. | Yes, later |
| Same exercise being refined twice | Not an error — reassurance. «التمرين قيد الكتابة الآن.» | — |
| The same class's position moved somewhere else while they were choosing | Their view is stale, and only they can decide again. **Ships:** the surface re-reads and re-asks — «تغيّر موقع هذا القسم في مكان آخر… أعد الاختيار.» The write is never silently resent. | Re-choose, not retry |
| The class no longer resolves (gone, or never theirs) | Generic and identical either way — existence must not be probeable. | No |
| Request too large / malformed | Rare, developer-facing. Generic, apologetic, no code. | — |

**Copy rules for all of the above:** Arabic, no error codes, no `pending`/`failed`/`409` leaking
into view, no exercise ids («ex2» means nothing to a teacher), and never blame the teacher.

---

## 8 · Business model — **OPEN. Do not draw a settled checkout.**

Direct-to-teacher; the teacher pays, not the school. Price point under consideration:
**2,000 DZD/month**. Beyond that, genuinely undecided, and the brief says explicitly:
*don't lock this in before the teacher test.*

Three positions on the table:

| | Fits | Breaks |
|---|---|---|
| **A · Flat monthly subscription** | Predictable, no purchase anxiety, teachers use it freely | Recurring card-on-file is painful on Algerian rails (CIB, Edahabia, BaridiMob). A "subscription" needing manual monthly re-payment is a repeated purchase with friction. |
| **B · Credits per generation/refinement** | One payment, no stored card, fits seasonality | **Taxes the core interaction.** Iterate-until-right is the product; metering refinement makes teachers accept worse exams. |
| **C · One credit = one finished exam, unlimited iteration inside it** ← current recommendation | A unit teachers can reason about ("I need 4 exams this trimester"), caps exposure per unit, doesn't punish refinement | Doesn't obviously price the *weekly* surfaces — a series is not an exam, and the tracker is not a generation at all. |

**What C means for the repositioned product is itself unresolved:** pricing an "exam" made sense
when the product was an exam generator. If the tracker and the weekly series are the habit loop,
the unit may have to change again.

**Design guidance:** draw the *value* surfaces (what you get, what a pack contains, what is
running out) and leave the *mechanism* swappable. If you must show a paywall, show it after the
first exam is finished and beautiful — never before.

**Payment rails to design for:** local Algerian methods, not Stripe-shaped card forms.

---

## 9 · The latency problem, stated once as a design brief

The single hardest thing to design here. Every meaningful action costs 60–150 seconds.

**Do not:** full-screen spinner · fake progress bars · "this usually takes 30 seconds" when it
takes 130 · blocking the whole page on the slowest part.

**Do:**
- **Show the structure first.** The skeleton arrives in seconds; it is real information — how many exercises, what each is worth, which unit each covers.
- **Let arrived content be used immediately.** Refine exercise 1 while exercise 3 is still being written.
- **Make leaving safe and say so.** Everything is stored server-side as it lands.
- **Be honest about size.** A 3-exercise 2-hour composition genuinely takes twice a short devoir. If the controls imply a long wait, say so *before* they press go, not after.
- **Consider notifying.** A teacher who closes the tab has no way back in today. Even a "your exam is ready" on return is a real improvement.

**A number worth designing around:** nine teachers can generate simultaneously while holding a
~100-second bar on the current single host; twelve breaks it, and beyond that the machine is the
bottleneck, not the AI. Under load, waits get longer, not more failure-prone. Queue copy should
tell the truth about waiting rather than invent an error.

---

## 10 · Constraints from the data model that show up in the UI

The designer needs these because they are visible, not internal:

- **Nothing is ever deleted.** No delete button anywhere. Every superseded exercise is kept. This should be reassurance in the copy, not a hidden implementation detail.
- **An exam is created, never overwritten.** Generating twice makes two exams. The UI must not imply "save over".
- **One writer per thing.** Two simultaneous refines of the same exercise → the second is refused with reassurance. Two simultaneous generations of the same exam → same.
- **Ownership is invisible and absolute.** Another teacher's exam looks exactly like one that never existed. There is no sharing, no visibility, no collaboration surface today.
- **⚠ The teacher's identity is a bearer value.** Whoever holds it reads that teacher's exams. It never expires and cannot be revoked. This is accepted for the two-teacher milestone and recorded so it is inherited knowingly — but it means **every personal field added to the profile sits behind it.** Do not design anything that puts sensitive personal data on this account until sessions are real.
- **Older exams predate newer fields.** Anything designed around a per-exercise status must render an old exam that has none as perfectly finished — never as half-written.

---

## 11 · What is decided vs open — the fork sheet

**DECIDED — safe to design against**

1. The programme (التدرجات السنوية, ministry, Sept 2022) is the **backbone**, stored verbatim, with provenance. Not a reference the generator consults — the structure the product is built on.
2. **All six 3AS streams** are served (five documents; the two literary streams share one). The product being شعبة الرياضيات-only is an implementation limit, not the intent.
3. The topic list is **read per-stream from the corpus**, never a hardcoded constant.
4. The teacher profile carries **stream(s) + school**; the printed sheet carries the school.
5. **Progress tracking**, with the teacher's marked position as truth and the calendar as a default only.
6. **Exam scope derived from tracked progress**, with untaught material excluded — and devoir vs composition made real by scope-to-date, not just duration.
7. **Weekly series** scoped by tracked progress.
8. Exam **versions** (نماذج متعددة), independent of everything above.
9. Export stays **print-to-PDF from a printable page.**
10. **The course layer is IN** (decided 2026-08-10, reversing the recorded exclusion). Each content item in a week gets an authored course with a sheet — high-level explanation, demonstration, equations. Stored separately from the ministry corpus and visibly marked as ours. Sheet contents are still to be detailed.
11. **Progress is per class**, not per teacher — §5b rule 4. Sign-up collects classes; every generation is for a class.
12. **One scope selector, four scopes** — course · week · unit · progress-to-date — feeding one generator, with format as an independent choice.
13. **Pacing is a named feature**, not a chart: the teacher is told whether they are behind or ahead, shown as one bar with two markers (§6.4). Informational only — the marked position stays the truth, the reference calendar is teacher-made and never authoritative, and the product never grades.
14. **Conformity to the official programme is the lead value**, and it must be *shown* — source named on the artifact, ministry wording visible, scope and exclusions stated, authored material marked as ours. The word "AI" appears nowhere in the UI.

**OPEN — do not draw as settled**

| Question | Why it changes the UX |
|---|---|
| **Billing model and unit** | §8. Changes onboarding, the paywall's position, and whether anything is ever counted in front of the teacher. |
| **What is the accuracy bar for an authored course, and who verifies it?** | The course layer is decided; this is not. Transcription is bounded and checkable against a page; authoring is neither. A wrong course is worse than no course — it carries our implied authority into a classroom. **Settle this before designing the sheet.** |
| **What a course sheet actually contains** | High-level: explanation, demonstration, equations. Beyond that, undefined. Length, worked-example count, and whether it is printable are all open. |
| **Does the school belong to the teacher or the exam?** | Breaks on teachers who move or write for two schools. Note the class model does **not** settle this. |
| **What a real Algerian exam header carries** | §6.12 is inference. A five-minute question to a real teacher. |
| **Is the 2022 programme what is examinable this year?** | The documents say they are revised as needed; nobody has confirmed with a practising teacher. |
| **BAC revision season (April–June)** | The highest-value moment of the year, and there is no job, no decision, and no design for it. |
| **Notification when a long generation finishes** | Nothing exists. Probably the cheapest large improvement to the waiting problem. |

---

## 12 · The five questions the teacher test must answer

These come from the validation plan and each one moves a design decision:

1. **How many exams do you make per trimester?** → pack sizes and price point. Currently a guess.
2. **What do you spend on teaching materials per month?** (Not "would you pay 2,000 DZD" — people are polite.) → whether the whole ARPU assumption holds.
3. **Would you pay personally, or expect the school to?** → the model is scoped direct-to-teacher; if both say "my school should pay", that is a different product.
4. **Does the printed header match what your school expects?** → if they rewrite it by hand, §6.12 is wrong and a saved-school-details screen is mandatory.
5. **Do you tap the suggestion chips or type your own note?** → chips winning means the free-text box is intimidating and structured shortcuts are the real interface.

---

## 13 · Design principles for this product specifically

1. **Show the conformity, don't claim it.** The lead value is that everything is on the official programme — and a claim the teacher can't see is worth nothing. Name the source on the artifact, show the ministry's own words where they work, state what is covered *and* what is excluded, mark what is ours. Never say "AI": it names the mechanism and undercuts the claim.
2. **The artifact is the hero.** Every screen should get out of the way of a typeset exam that looks like a real paper. If a screen competes with the document, the screen loses.
3. **Never make the teacher wait on nothing.** Structure first, content as it arrives, everything usable the moment it exists.
4. **Say true things.** No fake progress, no invented percentages, no error codes, no blank boxes standing in for missing work.
5. **Refinement must feel free.** The moment a teacher hesitates before improving an exercise, the product has failed at the thing it is for.
6. **The programme is the authority, and we are not.** Show the ministry's words verbatim; mark everything we derived as derived — and never let a comparison against a teacher-made calendar wear the ministry's authority.
7. **Nothing is lost, ever.** No delete, full history, restore always available — and say so, because fearlessness is the behaviour we need.
8. **Never grade the teacher.** Behind is not a failure, ahead is not a reward, and a class that fell behind is the normal case. Report, then be useful.
9. **Arabic and RTL are the design, not a layer.** Typography, numerals, iconography direction, print layout, and *the direction a progress bar fills* — all of it, from the first frame.
10. **Eight seconds, tired, at 9pm.** That is the test for every screen.

---

## 14 · Do not design these

Each is excluded for its own reason, and building it is scope error:

- **Anything happening inside the classroom.** That is the performance, not the prep.
- **Anything student-facing.** A separate e-learning project; mixing them muddies both.
  > ⚠ **The course sheet sits right on this line and must not cross it.** A sheet is the teacher's
  > own preparation for teaching a content item — what they read before class. It is not a handout,
  > not a student worksheet, and not a revision guide for a learner. The moment a sheet is designed
  > to be given to students, this product has quietly become the e-learning one.
- **Administration** — grades, attendance, parent communication, timetabling. Real work, genuinely burdensome, and *not prep*. Different product, different competitors, and taking it on abandons the one thing that makes this defensible: that the hard part is judgment, not record-keeping.
- **Slides and presentations.** Most Algerian lycée classrooms have no projector. A hardware fact, unaffected by any repositioning.
- **Subjects other than mathematics.** Later, if ever.
- **A LaTeX or formula editor**, in any form, anywhere.
- **Sharing, collaboration, teams, school accounts.** No model, no decision, no demand yet.

**Later and large, not now:** OCR auto-correction of submitted student papers.

---

## 15 · Where this came from

- `docs/product-brief.md` — the source of record: thesis, repositioning (§2), business model (§4), roadmap (§5), curriculum ground truth (§6b), the decisions of 2026-08-10 (§6d, §6f) and the job map (§6e).
- `docs/reference/curriculum/` — the five archived ministry التدرجات السنوية (Sept 2022, 73 pages, six streams), plus one example التوزيع السنوي.
- `project/CLAUDE.md` — engineering-facing state of what ships today. **Note it still describes the pre-repositioning product**; where it and the brief disagree, the brief wins.
- The running code: `teacher-fe/src/components/`, `teacher-be/agent/.claude/skills/`.
