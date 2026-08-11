# QA ledger — programme-surface (slice 2), iteration 01

> Black-box, cross-model from the Opus implementers. Inputs: SEED.md (incl. its two
> self-corrections), the contract as amended, the six `## review` attack logs,
> known-gaps.md. System under test: lane slot 9 (fe :10900 · be :9900), db `teacher_saas`.
> Date: 2026-08-11. **Rung: lane only — both stack repos are single-branch, so no staging
> rung exists to climb.**
>
> Method note: QA drove the real UI as a teacher. One synthetic throwaway account was
> created through the sign-up form (`qa-slice2@example.dz`, invented password) because the
> app has no anonymous door — recorded here; the account and every row it created were
> deleted at the end (see Cleanup). Vertical verification used `curl`, the s9 backend log
> (`/tmp/teacher-backend.s9.log` — `tools/obs trace` reads another lane's stem, so the log
> was read directly), and mongosh reads.

## A · Wire: the projection and the read route

| # | Case | SEED/contract claim | How | Observed | Verdict |
|---|---|---|---|---|---|
| A1 | Projection whitelist, three streams (math/sciences/lettres) | contract §2 key sets exactly | GET programme for 3 classes, recursive key-set diff | Top keys exactly `docKey edition weeklyHours totals source emphasisLegend units weeks`; `totals {weeks,hours}`, `source {authority,title}`, `legend {text,pdfPage}`, units `{id,name}`, weeks `{week,unitId,hours,pdfPages,rows}`, rows `{competencies,contents,guidance,hours,emphasis}`. Zero leaks (no `contentHash`, no `transcriptionRev`, no `units[].hours/weeks`, no `weeksText/hoursText`, no `_id`) | PASS |
| A2 | Envelope | `{programme, correlationId}` | same | exact | PASS |
| A3 | Wire is verbatim to store | §6.1 | byte-compare longest guidance string (432 chars, week 7) Mongo vs route | identical | PASS |
| A4 | 401 unauthenticated / unknown well-formed id | §7 | curl no header + `x-teacher-id: 000…0` | both `401 teacher_required`, Arabic, correlationId; `teacher.rejected` in log | PASS |
| A5 | 404 parity across all four probe variants | §7 byte-identical to progress routes | absent / other teacher's / malformed (`zzzz`) / uppercase hex | all four `404 {"error":{"message":"القسم غير موجود","type":"class_not_found"}}` — byte-identical to `GET /api/progress/:id` body (correlationId differs per request, as designed) | PASS |
| A6 | ETag/304 | contract §0 | If-None-Match round-trip, repeated after progress writes | `304`, zero-byte body, ETag stable | PASS |
| A7 | `/api` index gains exactly one entry | contract §0 | GET /api | 12 entries, `/api/classes/:classId/programme` present | PASS (the slice-1 route-count pin still fires at promotion — planning already flagged) |
| A8 | Read logs nothing beyond the request line | SEED §5 | grep s9 log | zero mutation-style lines for programme reads | PASS |

## B · The corpus through the wire

| # | Case | Claim | Observed | Verdict |
|---|---|---|---|---|
| B1 | Maths runs | 15 segments from 14 units, u12 split | 15 runs, split = `u12` only; Σ run hours 189 = Σ weeks[].hours = totals.hours | PASS |
| B2 | Sciences / lettres runs | exact on all documents | sciences 14/14 (no split), lettres 10/10; sums 135 and 54 exact | PASS |
| B3 | `\square` | 0 remain corpus-wide (SEED correction) | 0 in all five documents (techmath/gestion checked in Mongo); mathbb 26/25/10/0/0 | PASS |
| B4 | Odd `$` counts | zero strings | zero, all three served documents | PASS |
| B5 | emphasis distribution | allow-list values only | `normal`/`added-2022` only; maths 99/4, sciences 74/7, lettres 34/5 | PASS |
| B6 | Arabic-Indic digits on the wire | none | 0 in all three payloads | PASS |

## C · Progress writes (the tracker's write shape, server side)

| # | Case | Claim | Observed | Verdict |
|---|---|---|---|---|
| C1 | Setter write rev 0 | lazy insert, rev 1, identity stamped once | exact; `programmeDocKey/Edition/TranscriptionRev` stamped | PASS |
| C2 | done with forged `completedAt: 1999` | server stamps; client value discarded | stored completedAt = server now (2026-08-11T21:32Z) | PASS |
| C3 | skipped | no completedAt | exact | PASS |
| C4 | entry-only (no markedWeek) | 400 «الأسبوع غير صالح» | exact | PASS |
| C5 | markedWeek 28 (T=27) | 400 «الأسبوع خارج المجال» | exact | PASS |
| C6 | stale rev | immediate 409, no retry | `409 conflict` «تغيّر تقدّم القسم أثناء الحفظ»; `cas_loss` logged with correlationId + 8-char teacherIdPrefix | PASS |
| C7 | `status:"DONE"` | refused, not folded | 400 «الحالة غير معروفة» | PASS |
| C8 | entry week 0 | refused (1-based) | 400 | PASS |
| C9 | rev≥1 on doc-less class | no conjured doc; reads as CAS loss | 409, no document created | PASS |
| C10 | done at W=T=27 | position stays T, entry records | markedWeek stays 27, entry (27,done) | PASS |
| C11 | re-press same week | upsert replaces, never duplicates | (27,done)→(27,skipped), one entry; completedAt removed with the status | PASS |
| C12 | PUT 200 body | carries `progress`, **no** `programme` | exact | PASS |

## D · Persona journeys (real UI, verified vertically)

| # | Journey | Observed | Verdict |
|---|---|---|---|
| D1 | Zero-class teacher, deep-linked `#/programme` | shell = `[sidebar, workspace]`, 0 `<nav>`, boot requests exactly `GET /api/subjects` + `GET /api/classes`, no programme fetch | PASS (invariant 7) |
| D2 | Sign-up wizard → 3 classes on 3 streams (math, sciences, آداب وفلسفة), all «تخطَّ الآن» | classes created in order; tab order = creation order; nav appears with only «الرئيسية»+«الحساب» until a class is selected; «إعداد موضوع»/«مكتبتي» absent, not disabled | PASS |
| D3 | First open of «البرنامج» on a week-0 class | header/provenance line from wire data (ministry authority · 27 أسبوعًا · 189 ساعة · 7 سا); segmented bar rendered, **zero fill nodes**; every row «قادم» + «وصلنا هنا»; no current row, no pacing, no percentage | PASS (invariant 8) |
| D4 | «وصلنا هنا» week 1 → walk: done, done, skip, done | each step: tag flips (منجز/مُتخطّى/الأسبوع الحالي), bar fill per run (100%, 50%→100%, …), rail 3.7→18.5%, hours line 7→35/189 — screen, bar, rail and hours agree at every step; server entries exactly (1 done)(2 done)(3 skipped)(4 done), rev 5, five `win` log lines | PASS |
| D5 | Double-tap «تمّ ✓» | first wins (advance ×1), second → 409 → **one row-local notice** «تغيّر موقع هذا القسم في مكان آخر…», wire shows exactly PUT 200 + PUT 409 + one GET, no auto-resubmit | PASS (invariant 6) |
| D6 | Stale tab race (class moved behind the tab via API, then «تمّ ✓») | 409 → notice at the row, fresh position (week 10) re-rendered across bands/bar/rail, no resubmit, server rev untouched by the loser | PASS |
| D7 | Three classes, three streams switching | maths 15 seg/189h/7h·w, sciences 14/135/5, lettres 10/54/2 with **both** stream names in the header («شعبتا: آداب وفلسفة + لغات أجنبية»); view survives the switch; each class its own position | PASS |
| D8 | Browser Back mid-flow (week ⇄ programme) | hash and **screen** both move; aria-current follows | PASS |
| D9 | Reload while a band is expanded | session + selected class restored (localStorage), `#/programme` honored, tracker scrolled to the marked week on mount (scrollTop ≈1160px) | PASS |
| D10 | Deep link `#/programme`, classes but no selection | «اختر قسمًا من الشريط أعلاه لعرض تدرّجه السنوي.» chooser; no error, no auto-selection; per-class nav items hidden | PASS |
| D11 | Week-0 «هذا الأسبوع» | «أين وصل هذا القسم؟» invitation replaces the card; its CTA lands on the tracker | PASS |
| D12 | Jump to week 27 via «وصلنا هنا», then «تمّ ✓» | 135/135h, weeks < 27 read «منجز», position stays 27, entry recorded | PASS (fe-4's noted copy question about backward re-position stands, unchanged) |
| D13 | Week card «أنهيت هذا الأسبوع ✓» | card week 6 → 7; server entry (6, done); same write shape as the tracker | PASS |

## E · Rendering constraints (live page)

| # | Case | Observed | Verdict |
|---|---|---|---|
| E1 | Week 15 (the ℤ restorations) | 12 `.mathbb` glyphs, 0 `.katex-error`, 62 KaTeX islands | PASS — but see F3 |
| E2 | LaTeX source anywhere | 0 `$`, 0 `\` in innerText; 0 in any attribute (incl. `title`) — current-data certificate only; the latent title-channel debt stays as recorded in known-gaps | PASS |
| E3 | Ministry words verbatim | all 7 prose segments of the 432-char week-7 guidance appear character-identical around the KaTeX islands | PASS |
| E4 | `emphasis` as provenance | week 24: muted grey `✱` (rgb 138,144,138 — ink, not `--destructive`), `title` quotes `emphasisLegend.text` verbatim from the wire | PASS |
| E5 | Densest-field weeks | week 20: all 7 rows render — 7 competency blocks, 3 contents; rows without contents still render | PASS (H2 kill holds live) |
| E6 | Grading/pacing language | none — no red/green, no score, no "behind", no expected week, no calendar | PASS (invariant, and §6.4) |
| E7 | Arabic-Indic digits / English / "AI" | 0 / only math identifiers inside KaTeX (PGCD, variables) / absent | PASS |
| E8 | Collapse | non-current weeks one summary line; current expanded; teacher-opened bands expand | PASS |

## F · Induced failures

| # | Case | Observed | Verdict |
|---|---|---|---|
| F1 | be → dead Mongo port (store down; shared mongod untouched) | `/health` degraded; programme + progress routes `503 store_unavailable` (English on the wire — the known foreign family); **UI**: tracker error state in Arabic «تعذّر الوصول إلى قاعدة البيانات. حاول مرة أخرى.» + retry; recovery on retry after restore, no reload needed. First failed fetch showed the generic «حدث خطأ غير متوقع» once before the typed message appeared on retry (transient classification of a connection-level failure — observation, not filed) | PASS |
| F2 | be killed before a write («تمّ ✓» with be down) | «فشل الطلب (502).» **inside the losing band**, position not advanced, no phantom local state; after restore the same tap succeeds and the notice clears | PASS |
| F3 | Pre-slice be (main checkout, no programme route) behind the new fe | tracker and week card show «الصفحة غير موجودة» + retry — degrade, never crash; builder, position card and progress writes fully functional; recovery after swapping the real be back | PASS |
| F4 | Mid-session renderer wedge (view stopped following hash after an interrupted print dialog under automation) | investigated and bisected post-reload: exam open + switch, refine panel open + switch, print + dismiss + switch — all behave. Not reproducible through any user-reachable path; consistent with the automation pane freezing the React root while the native print dialog was interrupted. Environment artifact, recorded not filed | INFO |

## G · Regression sweep (the loop around which the nav was added)

| # | Case | Observed | Verdict |
|---|---|---|---|
| G1 | Builder → generate (2 ex / 60 min, real run) | progressive UI («جارٍ تحضير هيكل الموضوع…» → exercises fill), exam renders with KaTeX, «تم الحفظ», builder clears the hash | PASS |
| G2 | Refine one exercise («غيّر الأرقام») | numbers changed (u₀=2,½,+3 → u₀=15,⅓,+4), id/points/label unchanged, revision written (verified via revisions endpoint growth) | PASS |
| G3 | Print | «طباعة الموضوع» opens the native print dialog | PASS |
| G4 | Generated exam's class binding | `classId: null` — every exam still appears under every class | known gap (already graded; slice 3 binds it) |

## Findings routed

1. **Lane infra (not slice code): every KaTeX font 403s in every job lane.**
   `tools/provision` symlinks the worktree fe's `node_modules` → the main checkout's;
   Vite resolves KaTeX font URLs through the symlink to the real path
   (`/@fs/…/project/stacks/teacher-fe/node_modules/katex/dist/fonts/…`) and `server.fs`
   denies it → 403, `document.fonts` reports every `KaTeX_*` family failed, and all maths
   in a job lane renders in browser-fallback typefaces. Glyphs, structure and error counts
   are unaffected (every recorded oracle still means what it said), but **no lane-based
   visual check of maths typography — including the ℤ/ℝ/ℂ restorations this slice ships —
   shows the type a production build would show.** Main-checkout fe (:10000) unaffected.
   Harness/provision fix, not a slice-2 sub-issue.
2. **For the standing human page-check queue (SEED §"what is still true"):** week 15's
   division-theorem string reads «من أجل $a \in \mathbb{Z}$ و $a \in \mathbb{Z}_{+}^{*}$ …
   حيث $a = bq + r$» — the second bound variable is almost certainly $b$ on the printed
   page (the theorem needs $b > 0$). The letter predates the `\square` restoration (which
   chose only the set); it is exactly the class of string the SEED says a human must read
   first. Recorded for that read, not filed as a slice bug — the slice renders the corpus
   verbatim, which is its contract.
3. **Observation (not filed):** the first store-down fetch renders the generic
   «حدث خطأ غير متوقع» once; the typed «تعذّر الوصول إلى قاعدة البيانات» appears from the
   first retry on. Transient, Arabic, retry offered — behavior conforms; noted for
   whoever next touches the error mapping.

**No SEED violation found. No bug filed. All ten contract invariants held under attack.**

## Cleanup receipt

- Planted and deleted (scoped to the three QA teacher ids): 3 `teachers` (2 anonymous +
  `qa-slice2@example.dz`), 6 `classes`, 3 `progress`, 1 `subjects`, 1 `exercise_revisions`,
  0 `solutions`. Browser localStorage cleared.
- Corpus verified after: 5 programmes · 12 programme_revisions · 0 `\square` ·
  transcriptionRev 5/1/5/4/2 · contentHash present on all five. Untouched (QA never wrote it).
- Lane restored: be :9900 healthy (`store.ok: true`, programme route present), fe :10900
  200, main :9000 untouched. `run-log.jsonl` retains the two QA generation entries
  (append-only operational log, no teacher content).

## Verdict

**validated-provisional** — every SEED claim tested held on the lane rung; both stack
repos are single-branch, so there is no staging rung to certify and `validated` cannot be
claimed above the lane.
