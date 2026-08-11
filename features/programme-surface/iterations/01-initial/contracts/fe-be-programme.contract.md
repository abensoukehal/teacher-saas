# Contract — fe ↔ be · the programme surface (slice 2)

> Locked at PLANNING. Both stacks implement against this; neither may change it alone.
> Derived from `SEED.md` (recordings §2, unknowns §6, solution direction — every number
> below was measured there) and slice 1's `fe-be-classes-progress.contract.md`, which
> stays in force untouched. Where the handoff and the corpus disagree, the corpus wins
> (`ANALYSIS.md` §1) — this slice exists because they disagree about the week's shape.

## 0 · Decisions the SEED left to PLANNING

**The envelope is `{ programme: {…}, correlationId }`** — the slice-1 idiom (`{class:…}`,
`{progress:…, programme:…}`): one named key, wire shape built key by key.

**The projection's sub-shapes, keyed exactly** (the SEED named the fields; these are the
key sets inside them, read off the stored document):
- `totals: { weeks, hours }` — numbers only. The stored `weeksText`/`hoursText` are
  excluded: they are the PDF's label strings for the same two numbers, and the UI
  composes its own Arabic label. Nothing verbatim is lost — the numbers ARE the
  ministry's numbers.
- `source: { authority, title }` — verbatim. The stored `file`/`pages`/`renderedAt` are
  transcription plumbing, not ministry text.
- `emphasisLegend: { text, pdfPage }` — verbatim, both keys. The page number is the
  provenance half of the legend.
- `weeks[].pdfPages` is flattened from the stored `weeks[].source.pdfPages`
  (`docPages` excluded — it indexes our render, not the ministry's print).

**404 parity is enforced by byte-compare, not by code sharing.** `resolve()` and
`notFound()` live in `src/routes/progress.ts`, which the SEED marks read-only. The
programme route replicates the same three-step guard (lowercase-hex shape check →
`getOwned(classId, teacherId)` → the one body) and the oracle pins the bodies
byte-identical **across routes** — an executable clause, so the duplication cannot
drift silently.

**The `/api` index gains exactly one entry: `"/api/classes/:classId/programme"`.**
Perimeter flag: slice 1's *unpromoted* suite (`progress.characterization.test.js:1074-1079`)
pins the index at `RECORDED_ROUTES.length + 1`. It is not in this slice's gate, so it
fires **at promotion**, not here. Amending that pin is a promotion-time decision for the
`classes-progress` net (declared supersession, WF-65) — recorded so nobody is surprised.

**No cache, no compression, and Express's default ETag is the whole caching story.**
Recorded: 1.06 ms p50 to serve, 38,775 B payload, and `If-None-Match` → `304` zero-byte
already works with no middleware (SEED §6: an in-process memo would serve a stale corpus
across a re-transcription; gzip is parked until a deploy target exists). The oracle pins
the 304 so no later middleware breaks it unnoticed.

**Nav: four items — «الرئيسية» (the builder, still the landing view) · «هذا الأسبوع»
(the week card) · «البرنامج» (the tracker) · «الحساب» (the existing account overlay,
same `setAuthOpen(true)` the sidebar button calls — the button stays).**
«إعداد موضوع» (the slice-3 generate screen) and «مكتبتي» are **absent, not disabled** —
a greyed item is a promise with a date (SEED §6, locked). The nav row renders **only
when the teacher has classes** (the `withClasses` gate the class bar already uses):
slice 1's §0 legacy-mode guarantee — a class-less teacher's shell is byte-identical to
today — carries forward unweakened. «هذا الأسبوع» and «البرنامج» are offered only once
a class is **selected**; each screen still has an explicit "اختر قسمًا" state pointing
at the bar, for the hash deep-link that arrives without a selection.

**Hash mirroring is write-on-change, and the view FOLLOWS the hash.** View changes write
`#/week` / `#/programme` (the builder clears the hash); mount derives the initial view
from the hash so refresh and deep links land right; and the **existing** `hashchange`
listener (`App.tsx:250-256`, already there for `#/admin`) also drives the view, so the
browser's Back and Forward move the screen.

> **Amended at seal (PLANNING).** The first draft read the locked SEED wording
> "read-only at mount" literally and subscribed to nothing — so Back would change the URL
> while the screen stayed put. **That is worse than not mirroring at all**: the address bar
> would state a view the app is not showing, and the teacher's next refresh would jump them
> somewhere they did not ask for. The SEED's intent was "no router, no second early-return",
> not "let the URL lie". Following the hash costs one line in a listener that already exists
> and already handles `#/admin`.

`#/admin` keeps its early return (the console has no class bar, deliberately). Still not a
router and still not a second early-return: one listener, one `view` state, one shell.

**The week card's «أنهيت هذا الأسبوع ✓» IS the tracker's «تمّ ✓»** — one write shape
(§5), one shared builder function, two hosts.

**Notes are display-only this slice.** The prototype renders «ملاحظتك: …» and draws no
input; `entry.note` stays contractual on the wire (slice 1 §4) and no surface authors
one yet. Rendering rule in §6.

**Status vocabulary** (labels are a PLANNING copy decision — the prototype carries them
as data, not literals): a week `< markedWeek` with no entry reads **«منجز»**; an entry
`done` reads «منجز» (+ server `completedAt` exists but is not rendered); `skipped` reads
**«مُتخطّى»**; `week === markedWeek` reads **«الأسبوع الحالي»**; `> markedWeek` reads
**«قادم»**. `planned` entries render as their week's derived state (the entry's note
still shows). Never red/green — status is ink, not hue.

**«وصلنا هنا» (re-position) shows on every non-current row** — at week 0 that is every
row (the prototype's `showSetHere`), and «يمكنك دائمًا تعديله من «البرنامج»» makes
re-positioning a promise the tracker must keep. It sends `{rev, markedWeek: N}` with
**no entry** — it is slice 1's setter write, reused.

**Absent by design, shipped as absence** (not disabled, not stubbed):
«سلسلة تمارين هذا الأسبوع» / «سلسلة الأسبوع» (generation — slice 3),
«تمارين دعم على هذا المحور» (roadmap 5), the «قادم» proposal card (calendar-dependent —
there is no calendar, SEED §6), course links on content items (slice 7 — contents render
as **inert plain strings**; the corpus has no stable content id to address, SEED §6).

**A class switch keeps the current view.** Switching class on the tracker shows the new
class's tracker (the bar and rail follow — `flows.md` Flow 2). The slice-1
total-context-switch set (`exam`, `subjectId`, `refining`, `solutions`, `subjects`) is
unchanged; the per-class programme document is fetched for the new class (cached per
`classId` in session state — the 304 makes a refetch near-free). `pendingSave` survives,
as ever.

## 1 · `GET /api/classes/:classId/programme` — NEW. Behind `requireTeacher`.

The whole projected document for **the class's own** current programme, resolved live
from the class's stream (`getProgrammeForStream`, the `{streams:1, current:1}` index).
Class-scoped on purpose: `fe` never holds a stream→programme mapping — the exact drift
hazard slice 1's `known-gaps.md` records for the hardcoded stream list. Splitting
per-week was rejected: it saves 36 KB on home only, costs a second contract, and the
tracker pulls everything anyway (SEED §6).

→ `200`:

```json
{ "programme": {
    "docKey": "tadarroj-3as-math",
    "edition": "2022-09",
    "weeklyHours": 7,
    "totals": { "weeks": 27, "hours": 189 },
    "source": { "authority": "وزارة التربية الوطنية — المفتشية العامة للتربية الوطنية",
                "title": "…" },
    "emphasisLegend": { "text": "تم ادراج ما هو ملّون …", "pdfPage": 18 },
    "units": [ { "id": "u01", "name": "…" }, … ],
    "weeks": [ { "week": 1, "unitId": "u01", "hours": 7, "pdfPages": [6],
                 "rows": [ { "competencies": ["…"], "contents": ["…"],
                             "guidance": ["…"], "hours": 7,
                             "emphasis": "normal" } ] }, … ] },
  "correlationId": "…" }
```

- Errors: `401 teacher_required` · `404 class_not_found` (§7 — byte-identical to the
  progress routes' body, all probe variants) · `503 store_unavailable` · `500` if the
  class's stream resolves to no current programme (the invariant class creation makes
  unreachable; reaching it means the corpus moved underneath a stored class — same rule
  as `GET /api/progress/:classId`).
- A programme **read logs nothing** beyond the generic request line — deliberate
  (SEED §5): it is a cache-friendly read of a public document, and a mutation-style
  line would be noise.

## 2 · The projection — a field-explicit whitelist, both lists reasoned

`toProgrammeRecord(doc)` in `src/store/programmes.ts` (append-only). Anything unnamed
is excluded by construction; the oracle asserts **key-set equality**, so an added field
is a contract change, never a leak.

**Included, and why:**

| field | why it is on the wire |
|---|---|
| `docKey`, `edition` | a tracker draws a position against a *document*; only these say whether the class was marked against another edition (identity, slice 1 contract §1) |
| `weeklyHours` | the per-week oracle; the header line |
| `totals {weeks, hours}` | the ministry's own summary numbers — the tracker header. See §3 for what it is NOT |
| `source {authority, title}` | the provenance line. The prototype hardcodes it as a UI literal; the conformity pitch requires it be data |
| `emphasisLegend {text, pdfPage}` | the ministry's own explanation of its red marking — the ONLY legal caption for an `emphasis` tag (§6) |
| `units[] {id, name}` | segment tooltips and week headings. `id` is assigned, never derived from the name — units repeat |
| `weeks[] {week, unitId, hours, pdfPages, rows[]}` | the whole surface. `pdfPages` = the printed page each week came from, the ✎/verbatim boundary's receipt |
| `rows[] {competencies, contents, guidance, hours, emphasis}` | the ministry's columns, verbatim. **`competencies` is IN — this overrides the be agent** (SEED H2, killed): it is the densest field, 76/103 maths rows against contents 63 and guidance 55; real week 20 has a competency on all 7 rows and contents on 3. Excluding it renders four of seven ministry rows blank. The byte cost (~19%) is real; a blank tracker is worse |

**Excluded, and why — carried in full (SEED, locked):**

| field | why it must NOT be on the wire |
|---|---|
| `contentHash` | a validator that would silently stop validating — it hashes the *stored* doc and we emit a projection |
| `transcriptionRev` | shipping it gives `fe` one obvious thing to do — diff it against the class's stamp — which is the two-version-axes collapse the data model forbids (a typo fix would read as "the syllabus changed") |
| document-level `competencies` | nullable, rendered nowhere |
| `frontMatter` | transcription apparatus |
| `units[].weeks` / `units[].hours` | **a correctness exclusion**: they are the summary table's numbers and they disagree with the week rows (the 111% bug, §4). Withholding them makes the correct computation the only available one |
| `nameText`, `weeksText`, `hoursText` | PDF tatweel stretching / label strings for numbers already carried — not the ministry's words |
| `source.file/pages/renderedAt`, `weeks[].source.docPages` | our plumbing, not their print |
| `weekNumberPrinted` | equal to `week` in all 135 rows — it records a disagreement that does not exist |
| `streams`, `level`, `current`, `createdAt/updatedAt`, `_id` | storage bookkeeping; the class already knows its stream |

## 3 · Two reports of the week total — same number, different question

- **`progress.programme.totalWeeks`** (slice 1, `GET /api/progress/:classId`) stays the
  **picker's bound** — the single source for "what week may be written". The slice-1
  suite explicitly refused two sources for one bound.
- **`programme.totals.weeks`** (this route) is the **ministry's summary table** — a
  fact about the document, rendered in the tracker header.

Same number today (27 everywhere), **named differently on purpose**: `fe` must never
bound the picker or a write off `totals.weeks`, and never render the header off
`totalWeeks`. Collapsing them recreates the vacuous-pin conditions this slice closes
(be-2).

## 4 · The segmented bar — one segment per unit RUN, sized by run-summed week hours

**The rule (SEED, locked):** walk `weeks[]` in order; a **run** is a maximal stretch of
consecutive weeks sharing one `unitId`. One segment per run, in week order.

```
run.hours    = Σ week.hours              over the run's weeks
track total  = Σ run.hours               (≡ Σ weeks[].hours — self-consistent by construction)
segment w    = run.hours / track total
segment fill = Σ week.hours where week.week ≤ markedWeek, within the run ÷ run.hours
```

- Maths → **15 segments from 14 units** (`u12` splits: week 20, then `u11` at 21, then
  22–23). A bar with 14 segments on maths is wrong by construction.
- **Why not the prototype's version** (`segH = u.hours`, one segment per unique unit):
  it sums to **210 of 189 hours = 111%** on maths and techmath and overflows its own
  track — and the bug is invisible on the three streams that happen to have no
  non-contiguous unit. Run-summing `weeks[].hours` is exact on all five documents
  (SEED H3, killed).
- The **denominator is Σ `weeks[].hours`**, never `totals.hours` and never
  `units[].hours` (which are excluded — §2). `totals.hours` is header copy only.
- Fill direction is RTL — the document's own direction, no physical side pinned
  (the `ClassBar` rail precedent, `ClassBar.tsx:56-62`).
- `markedWeek: 0` → **zero fill and no invented pacing** (slice 1 §7.2 carries over).
- **No accent marker, no expected week, no pacing sentence — ship the absence** (§6).

## 5 · The write — «تمّ ✓» / «تخطٍّ ↷» over slice 1's PUT, unchanged on the wire

`be` changes nothing here. The tracker and week card drive the existing
`PUT /api/progress/:classId` (slice 1 contract §4), and the recorded facts force the
shape: **`markedWeek` is required on every PUT** — an entry-only write is
`400 invalid_request` (measured, SEED §2) — so marking a week always re-states the
position; the decision is forced, not optional.

With current position `W` (`markedWeek ≥ 1`) and bound `T = progress.programme.totalWeeks`:

```
«تمّ ✓»    → PUT { rev, markedWeek: min(W + 1, T), entry: { week: W, status: "done"    } }
«تخطٍّ ↷»  → PUT { rev, markedWeek: min(W + 1, T), entry: { week: W, status: "skipped" } }
«وصلنا هنا» (row N, any non-current row; every row at W = 0)
           → PUT { rev, markedWeek: N }            — no entry; slice 1's setter reused
```

- Done and skipped **differ only in the entry's `status`** — both advance the position
  identically. This matches the prototype, where both buttons call the same
  `markWeekDone`.
- At `W = T` the position stays `T`; the entry still records (upsert by week — a
  re-press replaces, never duplicates).
- The server stamps `completedAt` on `done`; the client never sends it.
- `rev` is the value from the **last read** of this class's progress. A `409 conflict`
  is a CAS loss: re-read, re-render, **re-ask at the row** — see §7.
- The PUT's 200 carries `progress` and **no `programme`** (slice 1, unchanged): the
  bar re-derives fill from the new `markedWeek` against the already-held programme.

## 6 · Rendering rules — verbatim, provenance, and the two text channels

1. **Ministry strings go through `Statement`** (KaTeX): `guidance`, `contents`,
   `competencies`, unit names in headings. Measured safe: 36/103 maths rows carry
   LaTeX (219 `$…$` spans in guidance), the 432-char worst case renders as 12 islands,
   0 errors, no overflow, RTL order intact (SEED H5) — and **zero corpus strings have
   an odd `$` count**.
2. **Teacher-authored text renders as PLAIN TEXT, never through `Statement`.**
   `Statement` pairs two `$` and silently corrupts: «من 5 $ إلى 9 $ دينار» renders with
   both `$` gone and the amounts fused (recorded, SEED §6). Notes (`entry.note`) are
   teacher-authored. One channel per author — this is a hard rule, pinned negatively.
3. **`emphasis` renders as provenance, never as status.** `added-2022` rows get a muted
   inline tag whose caption quotes `emphasisLegend.text` (the ministry's own words, from
   the wire — never a UI literal) — **ink, never hue**. Red is ruled out twice:
   `--destructive` is reserved for true errors, and the product never grades. The
   allow-list is `"added-2022"` only: `normal` renders nothing, and any other value
   (incl. `red-unlegended` — zero instances in all five documents) renders as normal.
   Keep the type; build no branch (SEED §6, accepted risk).
4. **No pacing marker, no pacing sentence, no calendar** — the corpus carries no date
   of any kind; the prototype's `hasReference` is `expected = 12` hardcoded; a
   `progress` field is forbidden by §5b rule 5. The absence IS the ship (SEED, locked).
5. **The `\square` defect ships visibly and untouched.** 61 occurrences across 48
   strings (26 maths) render as literal empty boxes where the ministry printed ℤ/ℂ/ℝ.
   It is a **corpus fix behind a human page-check** (SEED escalation, `blocked_on`).
   No stack may remap, hide, or "fix" a `\square` — choosing which set each one means
   is precisely the derivation the verbatim rule forbids.
6. Hard constraints as ever: Arabic only, RTL, Western digits, no red/green on any
   position surface, no LaTeX source visible, the word "AI" nowhere.

## 7 · Errors

Reused, unchanged in shape (callers branch on `error.type`, never the status code):

| type | status | where in this slice |
|---|---|---|
| `teacher_required` | 401 | the programme route (behind `requireTeacher`) |
| `class_not_found` | 404 | the programme route — **body byte-identical to `GET/PUT /api/progress/:classId`'s**, across all probe variants (absent / another teacher's / malformed / uppercase). Slice 1's not-probeable rule, inherited byte for byte |
| `conflict` | 409 | a lost progress CAS — now **frequent by design**: the tracker makes many small PUTs where slice 1 made one per session. **The re-ask happens AT THE ROW** — the row that lost shows the fresh state and re-asks; no global banner, no auto-resubmit, and other rows are untouched |
| `invalid_request` | 400 | out-of-bound week (against the class's OWN `totalWeeks`), bad entry shape |
| `store_unavailable` | 503 | retryable, said so in Arabic |

No new error type. No new 5xx semantics. The programme route is read-only — it can
never 409.

## 8 · Invariants neither stack may break

1. **The projection is a whitelist and the oracle owns its key set.** A field appears
   on the wire by contract amendment, never by passthrough.
2. **`totalWeeks` bounds writes; `totals.weeks` labels headers** (§3). Never swapped,
   never collapsed.
3. **Segments come from runs; the denominator is Σ `weeks[].hours`** (§4). One segment
   per unit *occurrence*, never per unique unit.
4. **Every ministry string is verbatim through KaTeX; every teacher string is plain
   text** (§6.1–6.2). One channel per author.
5. **`markedWeek` rides every PUT; done vs skipped differ only in `entry.status`** (§5).
6. **The 409 re-ask is row-local** (§7). A CAS loss re-reads and re-asks; it never
   resubmits and never takes over the screen.
7. **A teacher with no classes sees the app byte-identical to today** — no nav row, no
   programme fetch, nothing (slice 1 §0, §7.10 carried forward).
8. **`markedWeek: 0` renders no pacing anywhere** — bar unfilled, no marker, and the
   tracker offers «وصلنا هنا» instead of a current row (slice 1 §7.2).
9. **Nothing this slice ships may quote a verifier green as page fidelity** — the
   `\square` escalation is the standing counterexample (§6.5).
10. **Additive throughout.** One new route; no existing response changes; a `be` deploy
    without `fe` changes nothing any recorded consumer sees.
