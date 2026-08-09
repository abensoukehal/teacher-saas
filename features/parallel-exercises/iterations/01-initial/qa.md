# QA — parallel-exercises · iteration 01

> Black-box reality gate, run 2026-08-09 on lane 6 (`fe` :10600 · `be` :9600), real browser,
> real generations. No product code read. Inputs: SEED §5 exit criteria, the fe↔be
> progressive contract, and the journals' `## review` sections (started where the
> prosecution stopped). Store watched throughout for the `teacherId: null` orphan mode.
>
> **Verdict: `bugs-filed`** — four of five exit criteria hold under real attack, one
> (criterion 3, corrections streaming) is not implemented; one secondary bug (no in-flight
> guard on solutions generation). Both below, with repros. Rung: lane only — no staging
> branch exists for either repo, so there is no staging rung to climb.
>
> Real spend, chosen deliberately: 3 full exams (one of them from an empty body), 2
> solution-sheet runs (one of them the duplicate-tab race), 2 orphan regenerations, 1
> refine. ~13 agent loops.

## Ledger

| # | case | SEED claim | how | observed | verdict |
|---|---|---|---|---|---|
| 1 | Auth negation on `POST /api/exams` | contract §2 | curl: no header · bogus 32-hex · junk | `401 teacher_required`, Arabic message, correlationId present | held |
| 2 | Malformed bodies pre-spawn | be-2 review follow-up | `exerciseCount` 0/99/"three", bad JSON, `totalPoints` 0/−5 | all `400 invalid_request` in Arabic; **gate untouched** (`claude.active` stayed 0 for these) | held |
| 3 | Empty body `{}` | — (boundary) | curl `{}` with valid teacher | **Accepted.** Real plan spawned, full 3-exercise exam generated, defaults documented in Arabic `meta.assumptions` (mixed topics, 3AS, 120 min) | note ① |
| 4 | Client vanishes during plan wait | — (laptop-closed journey) | curl aborted at 10 s, before the ~28 s plan response | Exam completed server-side, correctly owned, appears in the teacher's list. No orphan row | held |
| 5 | Mixed-topic plan (SEED §7 parked) | §9.6 "no oracle may assume" | side effect of case 3 | plan spread 3 distinct topic sets (متتاليات / أعداد مركبة / دوال أسية), points 6+7+7=20, ids in order | first data point, good |
| 6 | **Criterion 1 — time to first exercise** | §5.1 | 2 real browser runs, 3-ex/120-min composition, 1 s poller on the store | run 1: skeleton +33 s, **first ready +91 s**, all +189 s. run 2: skeleton +27 s, **first ready +68.5 s**. Each further exercise appeared as it landed (95.7/100.2/193.0 s in run 1) | **holds as mechanism**; band note ② |
| 7 | Double-click generate | — (sloppy teacher) | second click on the busy button | button flips to «جارٍ التوليد…»; exactly **one** subject created (store check by createdAt) | held |
| 8 | Retry while writer is live | be-4 finding 1 seam | pressed «لم يظهر بعد؟ اطلبه من جديد» on a pending slot mid-fan-out | `POST …/regenerate → 409`; slot shows «التمرين قيد الكتابة فعلاً. سيظهر بعد قليل دون أي تدخّل.» — no error banner, no English, no code | held |
| 9 | Refresh mid-fill | — (sloppy teacher) | hard reload while ex3 pending | partial exam re-rendered from store, poll resumed, exam completed on screen; poll **stopped** after settle (network log went quiet) | held |
| 10 | **Criterion 2 — one failure costs one exercise** | §5.2 | **induced for real**: `tools/dev restart be` ~42 s into run 2's fan-out | ex1 (already landed) stayed ready; ex2/ex3 orphaned `pending`; UI kept the honest placeholder + retry affordance; poll survived the outage | held |
| 11 | Orphan recovery through the UI | contract §2 "pending-and-abandoned"; fe-2 review debt | pressed retry on ex2 then ex3 after the restart | both `200`, real regenerations, both `ready`; sum still 20; ids ordered; **0 phantom `exercise_revisions` rows** | held — fe-2's Cycle-6 fix independently confirmed with an organic failure |
| 12 | Print while pending | — (sloppy teacher) | print button mid-fill; print CSS inspected (native dialog wedges the automated pane) | printing is `window.print()` over the live view; print CSS hides sidebar/retry/refine; pending placeholder text (honest Arabic) would print. Button not disabled while pending | held, partial ③ |
| 13 | **Criterion 3 — corrections stream per exercise** | §5.3 | clicked توليد التصحيح النموذجي on the settled run-1 exam; 1.5 s poller on `GET /solutions` | **`[]` on every poll for 230 s, then all three at once.** run-log: a single `solution-sheet` spawn (206 s), bulk upsert at the end. No per-exercise solution runs exist | **FAIL → bug A** |
| 14 | Same exam in two tabs | — (sloppy teacher) | tab B opened the same exam while tab A generated corrections; clicked generate there too | tab B showed no busy state and an enabled button; click spawned a **second full solution-sheet run** (`claude.active` 1→2; two 206 s/233 s run-log lines). Data benign (upsert, unique index → 3 solutions), quota doubled | **bug B** |
| 15 | Cross-teacher probes on new surfaces | data-model ownership rule | GET subject / POST regenerate / GET solutions with another teacher's id + ghost id | all `404 subject_not_found`, indistinguishable from never-existed | held |
| 16 | **Criterion 4 — downstream indistinguishability** | §5.4 | solution-sheet consumed the assembled exam (13); admin `GET /api/admin/exams` joins costUsd 2.098947 / durationMs 188431 for the fan-out exam (the §9.3 perimeter concern); refine on a fan-out exam wrote its `exercise_revisions` row, id/points unchanged | all consumers worked unmodified; refined exercise comes back status-absent (= `ready` by the allow-list) | held |
| 17 | **Criterion 5 — no speed claim** | §5.5 | copy sweep of every rendered surface + programmatic text search (أسرع/بسرعة/faster/…) | zero hits; waiting copy quotes honest estimates («عادةً حوالي 25 ثانية» plan, «حوالي 145 ثانية» corrections, «التوليد يستغرق دقائق») | held |
| 18 | Hard constraints on every surface seen | product table | DOM checks each stage | `dir=rtl`; 0 `.katex-error`; 0 raw `\latex` or `$…$` in visible text (88 KaTeX islands); all copy Arabic incl. every error path exercised | held ④ |
| 19 | `teacherId: null` orphan watch | brief | mongo count before / after disconnect run / after restart+recovery / final | **0 at every checkpoint**; `bad status values` 0; every touched exam sums to 20 | held |

## Bugs to file

**A — Corrections do not stream per exercise (SEED §5 criterion 3 not implemented).**
The initial correction is still one monolithic `solution-sheet` run (~145–235 s) with all
solutions upserted at completion; the teacher watches a single long progress bar and gets
everything at once. No journal implemented streaming and the contract never specified a
transport for it — the criterion was silently dropped between SEED and contract. fe-2 only
added the blank-exercise filter (correct, but orthogonal). Repro: generate corrections on
any exam; poll `GET /api/subjects/:id/solutions` at 1.5 s — it is `[]` until one bulk
appearance. Fix direction is the SEED's own: the `solutions` collection is already keyed
per `exerciseId`; fan corrections per exercise like `exercise-one`, upsert each as it
lands, let the existing poll paint them. (Per-exercise *re*generation of a correction
already exists as a follow-up surface, which makes the gap look intentional to a reader —
it is not what §5.3 says.)

**B — No in-flight guard on solutions generation.** `POST /api/subjects/:id/solutions` has
no equivalent of refine's 409 or regenerate's `writing` registry, and fe's busy state is
per-tab. Same exam in two tabs → two enabled buttons → two full agent loops for one
correction (measured: 206 s + 233 s, both completed, benign last-writer-wins upsert).
Quota-only damage today; becomes teacher-visible waste the day corrections stream. Repro:
open the same settled exam in two tabs, click توليد التصحيح النموذجي in both, watch
`/health` `claude.active` go to 2.

## Notes (recorded, not bugs)

① `POST /api/exams {}` is a valid request: every control defaults and the defaults are
   honestly documented in Arabic `meta.assumptions`. Consistent with `exam-subject`'s
   contract, but an authenticated caller can start full exams with empty bodies — worth
   remembering when rate limiting reaches non-auth routes.
② Criterion 1's "roughly 70–80 s" is a point estimate. Three real samples now exist:
   74 s (SEED), 68.5 s and 91 s (this QA). §10.2's 2.7× spread means a teacher will
   sometimes wait ~90+ s for first content. The load-bearing halves — first content far
   ahead of the assembled exam (91 s vs 189 s in the same run), and per-exercise arrival —
   both held in both runs. Read the criterion as "min of N draws lands well before the
   whole", not as a guaranteed band.
③ The native print dialog cannot be driven from the automated pane (it wedged one tab,
   recovered by closing it). Print behaviour verified by stubbing `window.print` +
   inspecting `@media print` rules, not by rendering a sheet. A human print-to-PDF pass
   on a mid-fill exam is the residue — cheap to do at the two-teacher demo.
④ API-level `subject_not_found` carries an English `message` ("subject not found") while
   sibling errors are Arabic. fe branches on `type` and renders its own copy, so nothing
   leaked; recorded as contract-consistency debt.
⑤ Lane-infra, not product: KaTeX font files 403 on job lanes — the worktree symlinks
   `node_modules` into the main checkout, outside the job Vite's `@fs` allow; math falls
   back to system fonts on job lanes only (main lane serves the same font 200). Harness
   debt; a deployed build bundles fonts.
⑥ Not verified, said plainly: an **organic** malformed-output failure rendering (the ~8%
   truncation mode — 11 exercise-one spawns here, zero truncations; all failure rendering
   evidence remains replay-driven), MAX_POLLS exhaustion UI (the retry affordance now
   exists, so the trap fe-2 described is defanged, but I did not wait out the budget),
   multi-teacher concurrent fan-out load (§9.7's freeze), and the back button (SPA — back
   leaves the site; reopen is covered by case 9).

## Exit criteria scorecard

| criterion | status |
|---|---|
| 1 · first exercise ~70–80 s, others as they land | **confirmed as mechanism** (68.5 s / 91 s samples; band is honest-ish, see ②) |
| 2 · one failure costs one exercise, retryable alone | **confirmed with an induced real failure** |
| 3 · corrections stream per exercise | **not implemented — bug A** |
| 4 · sum 20, ids ordered, downstream indistinguishable | **confirmed** (solution-sheet, refine+history, admin KPI join) |
| 5 · no speed claim anywhere | **confirmed** |
