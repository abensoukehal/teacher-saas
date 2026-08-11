# QA ledger — classes + progress (slice 1 of 7)

> Black-box QA against the running lane (slot 8: fe :10800 · be :9800, Mongo `teacher_saas`),
> cross-model from the Opus implementers, on top of REVIEW's attack logs. No product code read.
> Expected values from SEED §2 recordings and `contracts/fe-be-classes-progress.contract.md`.
> Executed 2026-08-11. Rung column: **lane** = verified here; **staging** = no rung exists —
> both repos are single-branch (`main`, empty integration field), `/merge-back` skips them.
>
> Store baseline at start: 9,097 subjects (2 with `classId` — pre-QA implement litter, left
> in place), 18,395 teachers, 21 classes, 8 progress docs. **Restored byte-exact at the end**
> (same four counts, same 2 classId carriers). Every planted document deleted; the lane's be
> re-handed to `tools/dev` supervision; the browser session restored to its pre-QA identity.

## 1 · Classes API

| # | SEED/contract claim | probe | observed vs expected | rung |
|---|---|---|---|---|
| A1 | fresh teacher lists `[]` (§3 GET) | mint via `POST /api/teacher`, `GET /api/classes` | `{classes:[],correlationId}` — as contracted | lane |
| A2 | create → 201, 24-lowercase-hex id, verbatim name/stream (§3 POST) | `{"name":"3ر1","stream":"شعبة الرياضيات"}` | 201, id `6a7ab750…` lowercase hex, ISO createdAt — ✓ | lane |
| A3 | list ordered createdAt **ascending** (§3) | create 3 classes, list | `['3ر1','3تج2','3تق1']` in creation order — ✓ | lane |
| A4 | no header → 401 `teacher_required` (§6) | bare GET | 401 Arabic «مطلوب تسجيل الدخول» — ✓ | lane |
| A5 | unissued 32-hex → 401 (SEED §2 gate recording) | all-zeros id | 401 `teacher_required` — ✓ | lane |
| A6 | unknown stream → 400 (§2: corpus is the authority) | invented stream «شعبة الفيزياء» | 400 «الشعبة غير معروفة» — ✓ | lane |
| A7 | whitespace-only name → 400 (§3) | three spaces | 400 «اسم القسم مطلوب» — ✓ | lane |
| A8 | name > 80 chars → 400 (§3) | 81 × «ق» | 400 «اسم القسم طويل جدًا» — ✓ | lane |
| A9 | 80 chars is legal (boundary) | 80 × «ق» | 201, stored at 80 — ✓ | lane |
| A10 | malformed body → 400 `invalid_request` (§6) | truncated JSON | 400 «الطلب غير صالح» + correlationId — ✓ | lane |
| A11 | duplicate names allowed (§0: refusing = grading the teacher) | same name twice | 201 — ✓ | lane |
| A12 | **known debt be-1**: invisible-only name passes `trim()` | name = U+200F+U+200B | **201 — reproduced.** Confirms the graded debt (permanently blank immortal tab). Not re-filed | lane |

## 2 · Progress API

| # | claim | probe | observed vs expected | rung |
|---|---|---|---|---|
| P1 | no doc → synthesized empty, **same key set as stored**, live `programme` block (§4 GET) | GET on fresh class | `markedWeek:0, entries:[], rev:0`, identity fields `null`, `programme{docKey,edition,totalWeeks:27}` — byte-shape per contract | lane |
| P2 | first PUT `rev:0` inserts, stamps identity, `rev:1`, entry `completedAt` on done (§4) | PUT week 8 + done-entry | doc verbatim back: `rev:1`, `programmeDocKey/Edition/TranscriptionRev` stamped, `completedAt` on entry — ✓ | lane |
| P3 | stale rev → immediate 409, no server retry (§0/§4) | resend `rev:0` | 409 «تغيّر تقدّم القسم أثناء الحفظ» — ✓ | lane |
| P4 | bound is the class's own `totals.weeks`; integers only | weeks 27 / 28 / −1 / 27.5 / "8" at rev 1 | 27→200; 28,−1→400 «الأسبوع خارج المجال»; 27.5,"8"→400 «الأسبوع غير صالح» — ✓ | lane |
| P5 | entry validation: week 1..27, status allow-list, note ≤ 500 | entry week 0; `DONE`; 501-char note; entry week 28 | all 400, distinct Arabic messages — ✓ (uppercase `DONE` refused → allow-list, not case-folding) | lane |
| P6 | `rev` required int ≥ 0 | PUT without rev | 400 «رقم النسخة غير صالح» — ✓ | lane |
| P7 | entry **upserted by week**; skipped week's note survives (§4) | week-3 note → markedWeek-only write → week-3 rewrite | note survived the middle write; rewrite replaced in place (no duplicate row); week-8 entry untouched — ✓ | lane |
| P8 | concurrent same-rev PUTs → exactly one winner | 2 parallel PUTs, same rev | one 200 one 409; final = whole winner value, rev +1 once. Log: one `win`, one `cas_loss` | lane |

## 3 · 404 parity / ownership (the not-probeable rule)

| # | claim | probe | observed vs expected | rung |
|---|---|---|---|---|
| N1 | `class_not_found` byte-identical: foreign / nonexistent / garbage / UPPERCASE-of-real, GET+PUT (§6) | T2 probing T1's class + 3 variants | **all 8 bodies byte-identical** modulo correlationId («القسم غير موجود») — ✓ | lane |
| N2 | anti-vacuity | owner on same class | 200 — ✓ | lane |
| I1 | subjects: foreign id ≡ nonexistent id | T2 reads T1's subject vs all-zeros | byte-identical «الموضوع غير موجود»; owner still 200 — ✓ | lane |
| X4 | non-admin → 403 distinct from 401 | teacher on `/api/admin/kpis` | 403 «هذه الصفحة مخصَّصة للمشرف» — ✓ | lane |
| X5 | cross-collection confusion | a *subject* id fed to `/api/progress/:classId` | same `class_not_found` body — nothing distinguishable — ✓ | lane |

## 4 · `subjects.classId` — the partition and the catastrophic negative

| # | claim | probe | observed vs expected | rung |
|---|---|---|---|---|
| S1 | POST with owned classId stores it; projections surface it (§5) | tagged create + GET | record `classId:"<id>"`, summary same — ✓ | lane |
| S2 | POST foreign classId → 404 `class_not_found` (§5) | T2 posts with T1's class | 404, body identical to progress routes' — ✓ | lane |
| S3 | POST `classId:""` → 404 (degenerate table, write side) | empty string | 404 `class_not_found` — ✓ fail-closed | lane |
| S4 | POST non-string classId → 400 | `classId:42` | 400 «قيمة غير صالحة» — ✓ | lane |
| S5 | GET `?classId=<own>` = tagged + **legacy**, never the other class's (§5) | 3 subjects: legacy, C1-tagged, C2-tagged | filter C1 → C1-tagged + legacy; C2-tagged absent — ✓ | lane |
| S6 | GET `?classId=` (empty) = **no filter** (degenerate table, read side) | empty param | full list — ✓ fail-open | lane |
| S7 | foreign/unknown classId param → caller's legacy-only list, **no error** (§5 not-probeable) | T2 with T1's class id | `{subjects:[]}` 200 — ✓ | lane |
| S8 | repeated param → 400 (the one new failure mode) | `?classId=a&classId=b` and `a&a` and `classId[]=` | all 400 «قيمة غير صالحة» — ✓ (same-value repetition included) | lane |
| S9 | legacy record surfaces `classId: null` deliberately (§5 projections) | GET legacy record | `classId:null` present — ✓ | lane |
| L1 | **8,839+ legacy subjects must never vanish** (SEED's one real hazard) | heaviest teacher in store (12 subjects, 0 tagged): unfiltered vs bogus-class-filtered | **12 = 12** — the filter lost nothing; plus S5/S7 above | lane |
| G1 | generation carries **no** classId in slice 1 (§0) | exam generated in UI with 3ر1 selected, then Mongo read | stored subject has **no `classId` field** — legacy, exactly as §0 declares. Teacher-facing consequence (new exam appears under every class) is the accepted slice-3 boundary, re-confirmed here | lane |

## 5 · `school`

| # | claim | probe | observed | rung |
|---|---|---|---|---|
| L2 | `PUT /api/teacher/school` stores; **no read surface leaks it** | set, then sweep classes/progress/subjects responses | stored (Mongo: «ثانوية القدس»), zero occurrences on any read — ✓ (write-only remains the recorded gap: «أقسامي» shows no school) | lane |
| L3 | length bound | 121 chars | 400 «اسم المؤسسة طويل جدًا» — ✓ | lane |

## 6 · Observability (SEED §5 blind spot closed)

| # | claim | probe | observed | rung |
|---|---|---|---|---|
| O1 | every progress write logged, win **and** CAS-loss, ids prefix-only | grep lane log across all QA writes | one `progress.write` line per attempt: `outcome:"win"/"cas_loss"`, week, rev, correlationId, `teacherIdPrefix` (8 chars). Zero full 32-hex ids from my traffic (the known admin-path leak is separate, already graded) | lane |
| O2 | correlation traces vertically | CAS-loss correlationId → log | write line + request line joined on the id; UI claim (409) matches wire matches log | lane |

## 7 · Persona journeys (browser, real UI)

| # | journey | observed vs expected | rung |
|---|---|---|---|
| J1 | brand-new teacher, **double-tap** «إنشاء الحساب» | exactly **one** teacher row minted (guard held; no decoy-id stranding); recovery-code step 2 shown, Arabic | lane |
| J2 | **reload mid-wizard** (step 3, draft typed, not submitted) | no orphan class written; lands in app in clean legacy mode; no crash, no resume ghost | lane |
| J3 | add class via «أقسامي», name «␣␣3ر1␣␣» (spaces) | stored **trimmed** «3ر1»; account screen lists «3ر1 — شعبة الرياضيات / الأسبوع 5 من 27» after positioning | lane |
| J4 | **week-0 class** on home | «قسم جديد — 3ر1» / «أين وصل هذا القسم؟» + «حدّد أين وصلت» + «نبدأ من الأسبوع 1»; bar tab shows name only — **no rail, no %, no «أسبوع 0»** | lane |
| J5 | «وصلنا هنا» **double-tap** | ONE write (log: single `win`, rev 1); no 409 surfaced; settled at «موقعكم المسجَّل: الأسبوع 5 من 27» | lane |
| J6 | teacher B full wizard: 3 classes (3 streams incl. لغات أجنبية), school, step 4 = set 8 / **skip** / «نبدأ من الأسبوع 1» | 3 classes stored; progress docs only for the two positioned (skip wrote **nothing** — lazy creation verified in Mongo); per-stream programme identity stamped (`tadarroj-3as-math` and `tadarroj-3as-lettres`) | lane |
| J7 | back button mid-wizard | SPA pushes no history → Back exits the site; simulated return-after-abandon (reload at step 4): all classes + both positions intact, no selection forced | lane |
| J8 | the three-position teacher switches classes | tabs «3ر1 · أسبوع 8» (29.6% rail) / «3تج2» (bare) / «3ل1 · أسبوع 1»; each switch swaps the subject list (tagged+legacy per class) and the position card — total context switch | lane |
| J9 | switch while list loading (two taps 1 render apart) | settled state = **last intent**: 3ل1 selected in aria + storage, its list, no stuck spinner (fe-2 ticket holds live) | lane |
| J10 | **two tabs racing one position** (stale rev submit) | loser got 409 → UI re-read, shows the winner's value + «تغيّر موقع هذا القسم في مكان آخر. هذا هو الموقع المسجَّل الآن — أعد الاختيار.» Wire: win(12)→409(10)→GET, never a resent PUT. Zero Latin | lane |
| J11 | returning teacher, clean browser (storage wiped), sign in | same 32-hex teacherId back; all 3 classes with positions (8 / — / 12); full subject list; no class auto-selected (selection is browser-local — honest) | lane |
| J12 | displaced-session notice on switching accounts | «كانت لديك مواضيع محفوظة على هذا المتصفّح قبل تسجيل الدخول. لم تُنقَل إلى هذا الحساب، ولم تُحذَف.» + «فهمت» — the known-open gap surfaced visibly, in Arabic | lane |

## 8 · Induced failures

| # | case | observed vs expected | rung |
|---|---|---|---|
| F1 | be repointed at dead Mongo (`MONGO_URL=…:59999`, **shared Mongo untouched**): all four class/progress surfaces via API | 503 `store_unavailable` on classes GET/POST, progress GET/PUT; `/health` `degraded` with `store.ok:false` | lane |
| F2 | same, position write in UI | fe refuses to repeat the server's English: card shows its own Arabic sentence + «إعادة المحاولة», week retained (fe-3 fix holds) | lane |
| F3 | same, **boot** | class bar silent (no banner — fe-5's pinned silence), app shell intact; **but the subjects sidebar shows raw `datastore unavailable`** in `.subjects__error` — the **known-gaps App.tsx `setListError(err.message)` site, confirmed live**. Pre-existing (byte-identical pre-slice), graded, NOT re-filed — but see finding K1 below for weight | lane |
| F4 | store restored, «إعادة المحاولة» on the list | list heals in place; bar returns on next reload (failed class read has no retry by design — pinned) | lane |
| F5 | **pre-slice be** (main checkout, classes routes 404) against the new fe, teacher WITH classes + stale selected-class in storage | app boots clean: no bar, no alert, no crash, all subjects served (tagged ones stay visible — old be has no filter), zero Latin. The 404 degrades to silence exactly as recorded | lane |
| F6 | **kill be mid-write** («وصلنا هنا» against a dead port) | «فشل الطلب (502).» + «إعادة المحاولة», chosen week retained; restart + retry → write lands (week 9), bar updates. No double write in log | lane |

## 9 · Hard-constraint sweeps (all real screens driven this session)

| # | constraint | probe | observed | rung |
|---|---|---|---|---|
| H1 | Arabic only / RTL | full-page Latin scan on: gate, wizard steps 2–4, home (0-class, week-0, positioned), account, refine panel, error states | zero Latin prose anywhere. Only Latin: recovery codes (tokens, by design) and KaTeX math operators (`lim`, `e^x`) inside rendered math | lane |
| H2 | LaTeX fully hidden | regex `\\frac|\\sqrt|\$…\$` over generated exam + refine surfaces | zero raw LaTeX; 48 KaTeX islands rendered | lane |
| H3 | Western digits only | `[٠-٩]` scan, every screen incl. generated exam | zero Arabic-Indic digits | lane |
| H4 | never grade the teacher | rail color measured `rgb(168,176,169)` = `--ink-soft`; no red/green on any position surface; week-0 = no bar at all; behind-ness never colored or scored | lane |
| H5 | «AI» nowhere | text scan | absent («ملاحظات المولّد» is the voice) | lane |
| H6 | `costUsd` never rendered as currency | teacher surfaces scanned for `$`/دولار | absent from every teacher surface (admin console not in this slice's scope) | lane |

## 10 · Regression sweep (SEED §3 perimeter)

| # | consumer | observed vs recording | rung |
|---|---|---|---|
| R1 | zero-class teacher, API | `GET /api/subjects` → `{subjects:[],correlationId}`; `GET /api/classes` → `[]` | lane |
| R2 | zero-class teacher, DOM | `nav` count **0** (matches SEED §2 recording), zero classtab elements, `className="app"`, no alerts, no `teacher.class.v1`; request set = `/api/subjects` + the **one** added `/api/classes` (the recorded N+1 delta, accepted) | lane |
| R3 | exam flow E2E | real generation from the UI (2 ex / 60 min, class selected): «فرض محروس في مادة الرياضيات» stored + rendered, KaTeX, generator notes; appears in «مواضيعي» | lane |
| R4 | refine (core-loop step 4) | «تعديل هذا التمرين» → chip «غيّر الأرقام» → «طبّق التعديل» → exercise replaced in place, **one `exercise_revisions` row** (superseded version archived), history offered | lane |
| R5 | print | «طباعة الموضوع» reaches the OS print dialog (print-to-PDF path live). Side-effect: the native dialog freezes browser automation — environment note, not a product defect | lane |
| R6 | auth perimeter | 11th signin → 429 «محاولات كثيرة، الرجاء المحاولة بعد قليل» (+`retryAfterSeconds`); bad recovery → 401-family «رمز الاسترجاع غير صحيح أو مستعمَل»; 413 «الطلب كبير جدًا» — all Arabic, all classified | lane |
| R7 | admin aggregates | not driven (admin credentials out of slice scope; contract says unaffected by an added field — untested here, recorded honestly) | — |

## Findings

**No new SEED violation found. Nothing to file.** Confirmed-live known gaps, with grading notes:

- **K1 · The boot-time English banner under a dead store** (`.subjects__error` renders raw
  `datastore unavailable`). Already in known-gaps as the pre-existing `App.tsx`
  `setListError(err.message)` site, "reported, not fixed — outside this slice", and I verified
  it is byte-pre-existing. QA's addition: **it is the first thing a teacher sees during an
  outage** — same defect class fe-3 fixed on three slice-1 surfaces, one seam over. It should
  ride the same `teacherMessage()` seam the moment any job touches that file. Weight: high for
  a two-line fix; still correctly *not* a slice-1 reopen.
- **K2 · Invisible-only class name** (A12) — reproduced exactly as graded (be-1 debt).
- **K3 · `school` write-only** — reproduced; «أقسامي» shows no school field (fe-4 debt).
- **K4 · Generated exams are legacy** (G1) — contract-conformant (§0), but the visible
  consequence (a 3ر1-generated exam appears under 3تج2) is the sharpest teacher-facing
  surprise this slice ships. Slice 3 must close it; recorded so it is inherited knowingly.

**SEED-silent observations (not violations, for slice-2 planning):**

- **SG1 · A newly created class is not auto-selected.** After «أقسامي»-add or an abandoned
  step-4, the app sits in no-selection legacy view with the new tab unselected. The spec and
  contract never say which class (if any) becomes current after creation; the wizard's «ابدأ»
  path may differ from the أقسامي path. Harmless today; worth one line in slice 2's SEED.
- **SG2 · The wizard pushes no history entries**, so the browser Back button exits the app
  mid-wizard (state survives — J7 — but the ejection is abrupt). Spec is silent on history
  semantics.

## Verdict

**`validated-provisional`** — every lane rung green: all contract claims re-verified black-box
(A/P/N/S/L/O tables), all seven persona journeys including the sloppy variants, all induced
failures recover, hard constraints hold on every screen driven, and the perimeter matches its
recordings. Provisional **only** because the staging rungs cannot exist: both stack repos are
single-branch (empty integration field in `repos.sh`), so `/merge-back` skips them and there
is no staging deploy to re-run the journeys against.

**Three things I tried hardest to break, that held:**
1. **Legacy visibility** — 9,097 stored subjects behind every filter shape I could invent
   (foreign, unknown, empty, repeated, uppercase, cross-collection, old-be) and the heaviest
   real teacher in the store: not one subject ever vanished.
2. **The progress CAS** — parallel writes, two-tab UI race, double-taps, kill-mid-write:
   exactly one winner every time, the loser always re-read and re-asked in Arabic, and the
   log carried one line per attempt.
3. **Ownership opacity** — eight-way byte-parity on `class_not_found`, subject parity,
   admin 403, list scoping: existence was never probeable from any angle tried.

**Cleanup:** all 5 planted teachers and their 10 classes / 4 progress docs / 7 subjects /
1 revision deleted; store back to the exact session-start counts (9,097 / 18,395 / 21 / 8,
2 classId carriers); lane be restarted under `tools/dev` from the job worktree
(`feature/classes-progress`, :9800, store ok); browser session restored to the pre-QA
teacher (`c79d7af8…`, two classes).
