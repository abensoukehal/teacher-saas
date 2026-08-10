# Handoff analysis — what to build, what to fix first

Read this before `/discovery` on any slice below. It is the delta between
`design_handoff_prep_companion/` (the design intent) and what `be`/`fe` ship today.

The **HTML prototype is the source of truth** for layout and behaviour. The README is the
source of truth for copy and rules. `types/contracts.ts` is **not** trustworthy for the
programme — see below.

---

## 1 · The programme contract is wrong. The corpus wins.

`types/contracts.ts` flattens the ministry's shape. The corpus already loaded in Mongo
(`project/data/programmes/*.jsonl` → `programmes`) is the binding one.

| handoff `ProgrammeWeek` | real `Week` |
|---|---|
| one `contents[]`, one `guidance[]`, one `hours`, one `emphasis[]` per week | a week has **`rows[]`**; each row carries its own `competencies[] contents[] guidance[] hours emphasis` |
| implies one row per week | math stream: 27 weeks, **103 rows**. distribution 1×4, 2×1, 3×6, 4×8, 5×3, 6×3, 7×2 |
| `emphasis: "normal" \| "red" \| "unknown"` | `"normal" \| "added-2022" \| "red-unlegended"` (`store/programmes.ts`) |
| `competencies` nullable on the week | per **row**, `[]` on most rows |

Consequences the design has not absorbed:

- **The tracker's one-grid-row-per-week layout cannot render real data.** Week 10 alone has
  3+ rows at 3h/1h/…. This screen must be re-derived, not ported.
- **Ministry `guidance` contains LaTeX** (`$n$`, `$+\infty$`) and runs to full paragraphs.
  Verbatim text needs KaTeX too — not only exercise statements. The prototype shows guidance
  as one short quoted clause; that is not what the corpus holds.
- **`data/programme.json` is invented.** Its unit list collapses the three separate «معالجة»
  units into one `معالجة بيداغوجية (×3)` and renames others (`الاشتقاقية والاستمرارية` vs the
  corpus's `الدوال العددية (الاشتقاقية والاستمرارية)`). Its week 10 unit is wrong. Treat every
  fixture as illustrative only.
- Units **repeat and are non-contiguous** (§5b rule 1). The segmented bar must emit a segment
  per unit *occurrence* in week order, never one per unique unit name.
- `emphasis` is required by the contract and rendered **nowhere** in the UI. The
  "not covered in 2021-2022" signal is currently dropped.

The rest of the contract is sound: `Exercise` / `ExamSubject` line up with
`fe/src/lib/exam.ts`, absent-status-means-ready included.

## 2 · What `be` does not have

Today: subjects · corrections · exams · auth · admin. Missing, all of it:

- **classes** — no concept anywhere. Sign-up does not ask.
- **progress per class** (`markedWeek`, `entries`) — no collection, no route. Everything reads it.
- **a programme route** — `getProgramme` exists in `store/programmes.ts`; **nothing is mounted
  in `app.ts`**. Zero API on the thing the product is built on.
- **school-year calendar** — no collection. `expectedWeekNow: null ⇒ hide the marker` is the
  right rule; the prototype hardcodes `expected = 12` and gates on `marked > 0`, conflating
  "class has a position" with "a reference calendar exists". Do not copy that.
- **scope-driven generation** — the request is topic/difficulty/count/duration today. Needs
  `{format, scope, classId}` plus a derived **exclusion list** («لن يتضمّن — لم يُدرَّس بعد»),
  which means computing untaught material from progress × corpus.
- **point-less formats** — a سلسلة has no duration, no total, no scale, and its correction title
  drops «والسلّم». `exam-plan` and `solution-one` are points-shaped.
- **versions أ/ب/ج** — no skill, no route, no store.
- **courses** — no collection, no skill, no route.
- **library** metadata — `kind` / `unit` / `classId` + search. Subjects carry none.
  Same for «نسخة كنقطة انطلاق».

**Migration rule:** `scope` and `classId` are required in the contract, but every stored
exam predates them. Absent must read as *legacy*, never as *wrong class* — same shape as the
`status` absent-means-ready bug.

## 3 · Three contradictions with settled decisions

1. **«اربطها بحسابي»** (sign-in claim). Recorded decision: signing in does **not** merge an
   anonymous session, because adopting re-points subject documents. The README's "NEVER
   auto-merge" is consistent, but an explicit claim is still an unbuilt feature that was
   previously ruled out. **Open — needs a decision before the auth slice.**
2. **«مواضيع متبقية: 3»** with ذهبية/CIB/بريد موب named. §8/§11: billing is open, do not draw a
   settled checkout. **Decision: render nothing until a backend supplies it.**
3. **The course sheet ships a definition, a theorem and a proof.** §11's open question — what is
   the accuracy bar and who verifies it — is unanswered. **Gate stays shut; slice 7 is last.**

## 4 · Smaller findings

- **5 of 22 screenshots are the same image, mislabeled**: `17-doc-from-library`, `19-account`,
  `20-landing-signed-out`, `21-signup-step1`, `22-signup-step2` are all one series-document
  view. `09`/`10`/`12` are identical too, so there is no refine-open capture. Use the HTML.
- Print sheet hardcodes «المعامل: 7» and «صفحة 1 من 1»; a 3-exercise composition will not fit
  one A4. Coefficient and wilaya are in no contract; §11 already flags the header as unverified.
- `fe` is on KaTeX 0.18, the prototype on 0.16. Fine — but the RTL isolation rule
  (`.katex { direction: ltr; unicode-bidi: isolate }`) must survive the port.
- The prototype's unit list **includes** الحساب التكاملي and الأعداد والحساب — the two units the
  shipped UI is missing. That known gap closes for free.
- Prototype-only, exclude: «حالات العرض» demo chips, simulated timers, the hardcoded week-9
  skipped note, and the refine free-text input (wired to the same stub as the chips).

## 5 · Decisions taken 2026-08-10

- **Job pipeline, one job per slice.**
- **Tailwind yes, shadcn selectively** — adopt `theme/globals.css` + the tailwind snippet as
  given; pull in Radix only where it earns it (Tooltip, Tabs, AlertDialog, Collapsible).
  Everything else stays plain. Avoids RTL-auditing the whole shadcn surface.

## 6 · Slices, in dependency order

| # | slug | what | blocks |
|---|---|---|---|
| 1 | `classes-progress` | classes on the teacher, progress per class, GET/PUT; class switcher, sign-up steps 3–4, mark done/skip | everything |
| 2 | `programme-surface` | mount a programme read route; tracker + week card **re-derived against `rows[]`**; segmented bar, pacing | 3, 4 |
| 3 | `scope-generation` | `{format, scope, classId}`, exclusion derivation, generate screen | 4, 6 |
| 4 | `pointless-formats` | series + remediation through plan → exercise → solution with no points | — |
| 5 | `prep-shell` | nav, theme, document/correction/library/print in the new visual language | — |
| 6 | `exam-versions` | نماذج أ/ب/ج — skill, route, cards | — |
| 7 | `course-layer` | **gated** on the accuracy question | — |
