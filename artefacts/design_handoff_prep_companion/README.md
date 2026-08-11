# Handoff: تحضير — Prep Companion (Algerian 3AS maths teachers)

## Overview
Full teacher-facing product: landing → sign-up (classes + school + positions) → weekly home with pacing → programme tracker → one generator (5 scopes × 4 formats) → progressive document view with refine/history → corrections (+ grading scale for exams) → versions أ/ب/ج → course sheets → library → account → A4 print sheets.

Product rules that bind the implementation (from docs/product-description.md in the main repo):
- Arabic ONLY, RTL throughout. Western digits (3, 20, 120). No English string anywhere, including errors.
- The word "AI" appears NOWHERE in the UI.
- LaTeX is fully hidden — teachers see typeset math (KaTeX), never source. Refinement is plain Arabic.
- The teacher's marked position is the truth; the calendar is a default. Pacing never nags, never red/green.
- Ministry text is shown verbatim; everything we author/derive is marked ✎.
- Nothing is ever deleted; no delete buttons. Every refine keeps history; restore is itself a new version.
- Generation takes 60–150s: skeleton first, per-exercise progressive arrival, everything usable as it lands, leaving is safe.

## About the Design Files
`Prototype v2.dc.html` is a **design reference built in HTML** — a working prototype showing intended look and behavior, NOT production code. Recreate it in the target stack: **React + Tailwind CSS + shadcn/ui (Radix primitives)**. Open it in a browser to click through every flow; this README + `data/` + `types/` isolate what the backend must supply.

## Fidelity
**High-fidelity.** Colors, type, spacing, radii, copy and states are final design intent. Recreate pixel-faithfully with Tailwind utilities + the shadcn theme in `theme/`. The Arabic copy is deliberate — do not machine-rewrite it.

## Dynamic data — isolated in `data/`
Everything the backend supplies is extracted to JSON fixtures matching `types/contracts.ts`. The prototype inlines the same values in its logic class; the fixtures are the contract.

| Fixture | Feeds | Backend source |
|---|---|---|
| `data/programme.json` | tracker rows, week card, bar segments, topic taxonomy, guidance quotes | programme corpus (J1) — ministry التدرجات, verbatim + provenance |
| `data/teacher.json` | nav class switcher, account, sign-up review | teacher profile + classes (J2). Progress is keyed per CLASS. |
| `data/school_year.json` | pacing expected-week marker, «قادم» card | التوزيع reference calendar (J6). teacher-made ⇒ never authoritative; absent ⇒ hide marker entirely |
| `data/subject.exam.json` | document view, print sheet | `ExamSubject` — matches teacher-fe/src/lib/exam.ts. status absent ⇒ ready (6k legacy exams) |
| `data/correction.json` | correction view + print | solution sheet per exercise; scale sums to exercise points; staleness = correction.baseRev ≠ exercise.rev |
| `data/versions.json` | نماذج أ/ب/ج | per-exercise regeneration (J7) |
| `data/library.json` | مكتبتي list + filters + search | subjects store, insert-only |

Derivations the FRONTEND computes (do not ask backend): pacing diff = markedWeek − expectedWeek; bar segment widths = unit hours / total hours; point weights from hours-to-date (marked ✎ in UI).

## Screens (routes in the prototype's logic class)
| Route | Name | Key spec |
|---|---|---|
| landing | Landing | Single centered column, brand «تحضير.», H1 38px Amiri, 3 accent-dash value marks, CTAs «ابدأ الآن» (primary) / «لدي حساب» (outline). Try-before-account line. |
| signup 1–4 | Sign-up | 4 steps + progress bars: email/password → recovery code (one-time, full weight, copy/download, confirm checkbox) → classes (name + stream each, add-another is normal) + school («سيظهر على الموضوع المطبوع») → per-class position (skippable). |
| signin | Sign-in + recovery | States: form, wrong password, rate-limited (say wait time), recovery-code entry, used-code error, NEW code moment (old code dead — same weight as sign-up), anonymous-session claim («لديك مواضيع محفوظة في جلسة سابقة» — claim or continue; NEVER auto-merge). Demo-state chips in prototype are prototype-only. |
| home | «هذا الأسبوع» | Class switcher (per-class thin progress rail); segmented-by-hours progress bar filling RIGHT→LEFT, fill = marked, single accent marker = expected (hide if no reference), pacing sentence neutral, tooltip per segment; week card: unit, contents (each opens a course), السير المنهجي verbatim block with source line; actions «سلسلة تمارين هذا الأسبوع» / «أنهيت هذا الأسبوع ✓»; «قادم» proposal card; recent strip. Week-0 class: empty state «أين وصل هذا القسم؟» + «حدّد أين وصلت», NO invented pacing. |
| tracker | «البرنامج» | Pinned bar; rows = ministry columns (week، محور + per-unit hour bar، محتويات + سير منهجي + teacher note، حجم، حالة). Current row: تمّ ✓ / تخطٍّ ↷ / سلسلة الأسبوع. Done rows: «تمارين دعم على هذا المحور». Week-0: «وصلنا هنا» per row. Footer: verbatim + ✎ rules. |
| generate | «إعداد موضوع» | Format first (سلسلة/فرض/اختبار/دعم — shadcn Tabs), then scope (محتوى/أسبوع/محور/المقطع الأخير/ما تمّ إنجازه). Weights (hours-derived, ✎) for exam/devoir only. Free note + 4 append-only suggestion chips. Side panel: derived scope line, EXCLUDED list («لن يتضمّن — لم يُدرَّس بعد»), provenance «وفق التدرجات السنوية الرسمية», honest duration copy. |
| doc | Document view | Header sums points visibly (5+7+8=20 ✓). Per exercise: pending dashed box (honest copy), failed box + «أعد المحاولة» (others usable), ready body typeset. Actions: حسّن (chips: صغّر الأرقام/أصعب قليلًا/بدّله) + free Arabic input; refining keeps old text visible at 45% opacity; النسخ السابقة with restore. Whole-doc: طباعة, التصحيح (+ السلّم exams only), نماذج أ/ب/ج (exams only). Busy strip while pending; save-failed banner state (queued save, never silent duplicate). |
| correction | التصحيح النموذجي | Per exercise: worked answer (KaTeX), scale rows summing to points (exams; no scale for point-less formats — and title drops «والسلّم»), progressive arrival, STALE banner «هذا التصحيح يخص نسخة سابقة من التمرين» + one redo; restore heals automatically. Printable. |
| versions | نماذج متعددة | 3 cards (أ الأصل، ب، ج) same questions different numbers; ب/ج build progressively; each printable with version suffix. |
| course | Course sheet | Badge «✎ من إعدادنا — ليس نصًّا رسميًّا»; binding guidance quote box; تعريف/مبرهنة/برهان/مثال; «تمارين على هذا الدرس» → course-scoped generation; footer: teacher prep, never a student handout. |
| library | مكتبتي | Search (title/unit), filter chips (الكل/اختبارات/سلاسل/دروس/تصحيحات), rows: title/unit/class/date + فتح / نسخة كنقطة انطلاق. «لا شيء يُحذف». |
| account | حسابي | Email, password change, recovery-code reissue (warns old code dies), school, classes with positions, credits framed as value («مواضيع متبقية: 3», refinement never counted, local rails — mechanism deliberately open, DO NOT build checkout). Sign-out with honest anonymous-session note. |
| print | A4 sheet | 794px page: official header (الجمهورية… وزارة التربية…، مديرية/ثانوية، المستوى/المدة/المعامل strip — nowrap), title, exercises (break-inside avoid), «بالتوفيق», footer provenance + page number. Print-to-PDF via browser. |

## Component map (shadcn/ui)
- Buttons → `Button` (default = primary green; outline; ghost links use underline spans)
- Format/scope selectors + class switcher → `Tabs` (muted track, white active pill, radius 9–10px)
- Chips (suggestions, library filters, demo states) → `Badge`/`Toggle` pill variants
- Refine panel → inline `Card` + `Input`; conflicts/reassurance → `Alert`
- Banners (pacing, busy, save-failed, stale) → `Alert` (neutral tones — never red/green for pacing)
- History/versions → `Collapsible` or `Accordion`; restore confirm → `AlertDialog`
- Tooltip on bar segments → `Tooltip` (Radix) with unit name + hours
- Inputs → `Input`, `Checkbox`, `Label`; recovery code → styled `Input` readOnly + copy button
- Tables (tracker, library) → CSS grid rows (not `Table`) to keep the row-band layout
- Progress bar → custom div composition (see Interactions) — NOT Radix Progress (needs segments + marker)

## Interactions & Behavior
- Progressive generation: render skeleton from plan (labels/points/difficulty final), poll or stream per-exercise; `statusOf`: absent/unknown ⇒ ready, whitelist pending/failed (see teacher-fe/src/lib/exam.ts — load-bearing for 6k legacy exams). Stop polling when none pending.
- Refine: full generation (~tens of seconds); old statement stays visible (opacity .45) until replacement; same id/points/label; two concurrent refines on one exercise ⇒ refuse with reassurance «التمرين قيد الكتابة الآن».
- Staleness: exercise.rev vs correction.baseRev per exercise; redo rewrites correction; restoring the old exercise heals without a call.
- Pacing: fill from marked progress only; marker only when a reference schedule exists; label «متأخرون بأسبوعين…» + «(−2 أسابيع)»; NO color coding; RTL fill direction is load-bearing.
- Leaving is safe: everything persisted server-side as it lands; say so in the busy strip.
- Datastore down: queue the save, offer on next load, never silently replay (would duplicate).
- Transitions: 150ms background/border on interactive elements; no entrance animations required.
- Responsive: ≤820px single column; nav wraps; tracker rows condense to week/content/status; phone-usable, not phone-first.

## State Management
- Route/current class (per-class context switch is total — nothing carries over)
- Per-exercise: status (pending/ready/failed), rev, history[], refineOpen/historyOpen
- Correction: per-exercise status + baseRev snapshot (persists across visits)
- Generate: format, scope (defaults follow format: series→week, devoir→recent, exam→to-date)
- Auth: anonymous teacherId minted on first load; sign-in does NOT merge anonymous work (claim flow)
- Data fetching: GET programme (per stream), GET/PUT progress (per class), POST subject (plan→fan-out), POST refine, POST solution, POST versions, GET library

## Design Tokens
See `theme/globals.css` (shadcn CSS variables) + `theme/tailwind.config.snippet.ts`.
- background #faf7f0 · card #fffefb · foreground #292524 · border #e7e0d2
- primary #2f6f5e (hover #285f50, deep #235245/#1d443a, tints #e9f1ec/#d5e5dd)
- muted ramp (warm sand): #f8f5ec #f2edde #e9e2cf #dcd3bd #b3a88e #857b66 #665d4b #44402f
- radius: cards 12–14px, controls 8–10px, pills 999px
- shadow: cards 0 1px 2px rgba(41,37,36,.05); tooltip 0 2px 6px rgba(41,37,36,.18)
- type: body «Noto Naskh Arabic» (400–700), headings «Amiri» 700; UI 12–15px, H1 24–40px; math ~1.05em
- focus: 2px primary outline, offset 2px (Radix focus-visible)

## RTL + math (do not skip)
- `<html dir="rtl" lang="ar">`; use logical CSS (inset-inline-start, border-s) / Tailwind RTL-safe utilities
- Progress bars, tabs order, breadcrumbs, back arrows all flow RTL; bar fills right→left
- KaTeX inside RTL text MUST be isolated: `.katex { direction: ltr; unicode-bidi: isolate; display: inline-block; }` — without it math renders scrambled
- Western digits everywhere; Arabic-Indic digits are an unmade decision
- Print: A4, RTL, exercise blocks `break-inside: avoid`, header strip `white-space: nowrap`

## Assets
No images. Icons: Lucide if needed (prototype uses text marks — ✓ ↷ ← ✎ are literal characters). Fonts via Google Fonts: Noto Naskh Arabic, Amiri. KaTeX 0.16.x CSS+JS.

## Screenshots
\`screenshots/\` — 22 captures of every screen and key state, numbered in flow order (landing → sign-in states → home → tracker → generate → progressive doc → refine → correction → versions → course → library → print → account → sign-up). Reference for layout; the HTML prototype remains the source of truth for spacing and behavior.

## Files
- `Prototype v2.dc.html` — the clickable reference (open in a browser; needs `support.js` + `_ds/` alongside)
- `support.js`, `_ds/modernist-…/styles.css`, `_ds/…/_ds_bundle.js` — prototype runtime deps only; NOT part of the implementation
- `data/*.json` — backend data contracts (fixtures)
- `types/contracts.ts` — TypeScript contracts for the fixtures
- `theme/globals.css`, `theme/tailwind.config.snippet.ts` — shadcn theme

Prototype-only affordances to EXCLUDE from production: «حالات العرض» demo chips (sign-in, document view), instant simulated timers, the hardcoded week-9 skipped note.
