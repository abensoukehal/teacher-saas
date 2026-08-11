# fe-2 — switching class is total, and the list follows

> Implementer journal. Lane slot 8 (fe :10800 → be :9800). `fe-1` done and committed
> (`0e840fe`); `be-1..be-5` done. A verifier is auditing fe-1 in this same worktree, so
> every freeze check below is PATH-SCOPED to fe-2's own delta (WF-63) — never a
> repo-wide clean check.

## Pre-flight — the ground truth reproduces

The sub-issue's ground truth is two facts: the total-context-switch shape to reuse, and
that the list call is param-less today. Both were re-read at the RECORDED line numbers
(`HEAD~1`, the pre-fe-1 base) as well as where they sit now.

| probe | expected | got |
|---|---|---|
| `git show HEAD~1:src/App.tsx \| sed -n '479,495p'` | `onOpenSubject`, the clearing shape | verbatim — `setRefining(null)`, `setSolutions([])`, `setSolutionsRun(null)` under «Belongs to the subject, not to the session» |
| `git show HEAD~1:src/App.tsx \| sed -n '550,559p'` | `onGenerate`'s copy of the same shape | verbatim |
| the same two, on this branch | moved by fe-1's additions | `onOpenSubject` at `:585-601`, `onGenerate`'s clears at `:656-665` |
| `listSubjects` | param-less | `request("GET", "/api/subjects", { teacherId })` — one URL literal, no query |
| `tools/dev status` | lane 8 up | backend 9800 UP · frontend 10800 UP |

The two pinned degenerate values and the legacy rule were re-probed against the LIVE `be`
on :9800 rather than trusted from be-3's journal — they are fe-2's binding clauses:

```
teacher aec1a75661cc6d7c65025d518147ef42
  POST /api/subjects (no classId)        → 6a7a82a95877e8523b8b05fe   ← a LEGACY subject
  POST /api/classes  3ر1                 → 6a7a82a95877e8523b8b05ff
  GET  /api/subjects?classId=<class>     → 200, count 1, the LEGACY subject, classId=None
  GET  /api/subjects?classId=a&classId=b → 400
  GET  /api/subjects?classId=            → 200   (no filter)
  POST /api/subjects {classId:""}        → 404 {"type":"class_not_found"}
```

So a brand-new class's list is *already* its legacy history, `be`-side. The client's only
job is not to undo it. And `""` really does resolve opposite ways on the two verbs, which
is why the fetcher below omits the key rather than sending an empty one.

## What was built

| path | what |
|---|---|
| `src/lib/api.ts` | `listSubjects(teacherId, classId?)` — one param or none, appended exactly once; `SubjectSummary.classId` typed and deliberately never read |
| `src/App.tsx` | `onSelectClass` becomes the switch (no-op guard + the total clear + the scoped refetch); `refreshList(id, classId = currentClassId)`; `loadClasses` re-reads the list unscoped when it drops a stale selection |
| `features/classes-progress/tests/fe/class-switch.characterization.test.tsx` | the oracle, 11 clauses |

`ClassBar.tsx` was NOT touched, though the sub-issue allows it. The tap was already wired
(`onSelect(c.id)`), and the no-op guard belongs with the state it compares against — in
the component it would make a presentational element the authority on what a switch is.

Three decisions worth naming:

1. **`pendingSave` is not in the clear list, and that is load-bearing enough to be a
   comment in the source**, not only a test. Every other per-subject state is nulled in
   the seven lines above it; the next person tidying that block is exactly who the
   comment is written for.
2. **`error` and `busy` are also left alone.** Neither is the classroom's property: an
   unread failure is still unread, and a generation in flight lands as a *legacy* exam
   (contract §0 — generation carries no `classId` in slice 1), so it is visible from
   whichever class the teacher is standing in. Recorded as unsettled below rather than
   decided silently.
3. **A dropped stale selection re-reads the list unscoped.** fe-1 already discarded a
   persisted class id no longer in the teacher's list — but by then `boot` had ALREADY
   fetched the list scoped to it, and an unknown `classId` yields the legacy-only list
   with no error at all (contract §5). Without the re-read, a teacher whose stored
   selection went stale would silently see none of the exams they do have.

## Loop

### Iteration 1 — oracle first, red for the right reason

`class-switch.characterization.test.tsx`, 11 clauses, written before a line of source
moved. `tools/ci fe --slug classes-progress` → **7 failed | 18 passed**: every switch
clause red on `expected '/api/subjects' to be '/api/subjects?classId=…'` and on the
un-cleared exam, and fe-1's 14 still green. The four negatives (no selection, the
same-class no-op, the write body, the stale selection) passed already — they are the
two-sided half of the file, and they had to keep holding rather than start holding.

### Iteration 2 — green, and one clause that was wrong about fake timers

`onSelectClass`, `refreshList`'s optional scope, the fetcher's param and the
`loadClasses` re-read landed together. **24 passed | 1 failed.**

The one failure was the poller clause, and it was the test's fault rather than the
code's: `vi.useFakeTimers()` was installed AFTER the render, so the poll's first
`sleep(3000)` had already been scheduled on the REAL clock — advancing the fake one could
never reach it, and the loop looked dead. That would have made the clause pass for the
wrong reason forever afterwards. Fixed by installing the fake clock before `render`, and
the test now asserts liveness *first* (one interval in, the subject HAS been re-read)
before asserting silence after the switch. **25/25, gate PASS.**

### Iteration 3 — mutation checks, because a green negative proves nothing on its own

Four of these clauses are negatives, and a negative that cannot fail is decoration. Each
was killed deliberately and the source restored:

| mutant | clause that caught it |
|---|---|
| `setSubjectId(null)` removed from the switch | the context-switch clause (the poller clause did NOT fire — `setExam(null)` alone still stops the loop through `awaiting`) |
| `setExam` + `setSubjectId` + `setRefining` all removed | context-switch **and** the poller clause |
| `clearPendingSave(); setPendingSave(null)` added to the switch | the `pendingSave` clause |
| `refreshList` re-filters on `s.classId` | the legacy-visibility clause |
| the fetcher always appends `classId=` (empty when unselected) | **four** clauses — two of mine and two of fe-1's |

The first row is the useful one: it says the poller clause is a pin on the *context*
being gone, not specifically on `subjectId`, and it is honest to record that rather than
claim a sharper guarantee than the test buys.

## Done-protocol

### 1 · Oracle green ×2

`tools/ci fe --slug classes-progress`, from the fe worktree, twice: **25/25, gate PASS**
both times (14 fe-1 + 11 fe-2). fe-1's oracle is byte-untouched —
`git status --short -- features/classes-progress/tests/fe/class-bar.characterization.test.tsx`
empty.

### 2 · Perimeter differential — the promoted net

The promoted `project/tests/fe` net staged under a throwaway slug so it runs through
`tools/ci`'s own entry point against the JOB checkout (`features/_perimeter-fe/`, deleted
afterwards) — the invocation fe-1's journal describes, and the one that caught fe-1's
banner bug:

| | result |
|---|---|
| `project/tests/fe` — 21 suites, with fe-2's `src/` | **313/313 PASS** |

Unchanged from fe-1's recorded 313/313.

### 3 · Freeze audit — path-scoped (WF-63)

```
git status --short -- src/lib/persist.ts src/components/ClassBar.tsx \
                      src/components/ExamView.tsx src/components/RefinePanel.tsx \
                      src/components/SolutionView.tsx src/lib/poll.ts \
                      src/lib/taxonomy.ts src/components/AdminConsole.tsx src/App.css
  → empty
git diff -- src/lib/api.ts | grep '^-'   → 2 lines: listSubjects' own signature + its one call line
git diff -- src/App.tsx    | grep '^-'   → 4 lines, all inside loadClasses / onSelectClass / refreshList
```

`teacher.pending.v1` and its queue logic are untouched — `persist.ts` has no diff at all,
and `createOnce`/`persist` are byte-identical. `npm run build` (tsc -b + vite) and
`npm run lint` (oxlint) both clean.

### 4 · `tools/ci fe --slug classes-progress`

`gate PASS (1 ran, 0 skipped)` — 25/25, run from
`project-worktrees/classes-progress/stacks/teacher-fe`.

### 5 · The live pass (:10800, real `be` on :9800)

Two classes (`3ر1` positioned at week 8, `3ع2` at week 0), one exam per class and one
LEGACY exam with no `classId` at all. Driven in a real browser, one tab.

| step | measured |
|---|---|
| boot, `teacher.class.v1` = 3ر1 | selection restored · list `[موضوع القسم الأول, موضوع قديم]` — **the legacy exam is there** · pending banner up |
| boot, nothing selected | list `[…الثاني, …الأول, قديم]` — all three, and the request is `GET /api/subjects`, **no param** |
| open the exam, open the refine panel | `.exam` + `.refine` both present, `teacher.current.v1` set, `teacher.cache.v1` written |
| **switch to 3ع2** | `.exam` `.refine` `.solutions-pane` all gone · no stale statement text on the page · empty state «ابدأ بتوليد موضوعك الأول» · `teacher.current.v1` and `teacher.cache.v1` **removed** · list `[موضوع القسم الثاني, موضوع قديم]` |
| **`teacher.pending.v1` across that switch** | **byte-identical**, and the «حفظ الآن» banner still on screen |
| switch back, then re-tap the same tab | back to 3ر1's list; the re-tap fired **zero** requests, the switch fired **exactly one** |
| every scoped read | `GET /api/subjects?classId=<id>` — one `classId=`, never repeated, never empty |
| geometry at 1280×800 | bar `l 0 → r 1280`, `top 0`, h 65 · sidebar `l 900 → r 1280` at `top 65` — **still the rightmost track** · tabs at `1150–1256` then `1091–1142`, right-to-left. Identical to fe-1's recording; the row change is fe-1's and nothing regressed it |
| obs | the scoped list read's `correlationId` `a39e8189-dd82-4f3c-97a9-ca996d933f2f` → `tools/obs trace` returns the be line `GET /subjects 200 3.3ms` |

> **A false alarm worth recording.** A first pass showed `teacher.pending.v1` gone after
> switching back to 3ر1, which would have been the one unacceptable failure. It was the
> harness: three browser tabs were open on `localhost:10800`, sharing one `localStorage`
> — and one of them had also left `#/admin` in the URL, which is why the console kept
> appearing. Closed down to a single tab and the whole sequence above is clean. Nothing
> in `src/` was changed on account of it; the suspicion was investigated, not assumed
> away.

### 6 · Journal sealed

## Not settled by the sub-issue

- **`error` and `busy` are not cleared by a switch**, and the sub-issue names neither.
  Leaving a stale alert about an exam that is no longer on screen is arguably wrong; so
  is silently swallowing a failure the teacher has not read. Left as-is deliberately.
  A generation still running across a switch is safe *only because* slice 1's generation
  carries no `classId` — when slice 3 binds it, "which class does an in-flight generation
  belong to" becomes a real question and this decision has to be revisited there.
- **The poller clause pins the context, not `subjectId` specifically.** Clearing `exam`
  alone already stops the subject poll (through `awaiting`), so the test cannot tell the
  two apart. Recorded rather than overclaimed.
- **fe-1's «nothing is selected on first load» still stands**, and fe-2 did not change
  it: a teacher with classes who has picked none is in legacy mode and gets the whole
  unfiltered list. fe-3 is where "which class am I looking at" becomes load-bearing.
- **`POST /api/subjects` still sends no `classId`.** The oracle pins that no write body
  carries the key at all — which is the strongest form of "never serialise `""`" — but it
  is a characterization of slice 1, not a rule for slice 3, which is where generation
  gets bound to a class.
- **The class layer still has no error state of its own** (fe-1's open note). fe-2 added
  no surface that can fail visibly, so nothing was decided here either.

## review

**Verdict: reopen-implement.** Cross-model review (Fable). One finding, micro-loop sized.

**The switch's list refetch has no stale-response guard.** `onSelectClass(A)` fires
`refreshList(teacherId, A)`; a fast second tap on B fires `refreshList(teacherId, B)`.
Both are un-tokened `fetch`es and the last **resolution** wins, not the last intent — on
parallel connections nothing orders them, so A's response landing after B's leaves
**class A's subject list rendered under class B's selected tab** (and `listLoading`
false, so it looks settled). Before this sub-issue the race was harmless: `refreshList`
had one shape and out-of-order responses answered the same query. The `classId` param is
what made ordering meaningful, and it arrived here. The failure scenario is the
product's own nightmare shape — a class-A-tagged exam shown under class B — and the
audience is on mobile networks where multi-second reorderings are routine. Nothing in
any suite pins response ordering (verified: no clause fails under a delayed-first-response
mock).

Suggested patch (not applied): a monotonically increasing token in `App` —
`refreshList` captures `++listSeq` before the await and discards its result if
`listSeq` moved; one jsdom clause with two mocked fetches resolving out of order.

Everything else held: `pendingSave` survival, the no-op re-tap, the unscoped re-read
after a dropped stale selection (re-driven live via a cross-account localStorage probe —
boot self-heals in the same pass, storage cleared). Mutants MF1 (selection not
persisted), MF2 (stale held id kept), MF9 (refetch uses the stale closure default) all
killed — 3, 2 and 5 clauses.

### Reopen — the last resolution was winning, not the last intent

> Micro IMPLEMENT loop, same lane (fe :10800 → be :9800). Path-scoped freeze checks
> (WF-63). The finding is upheld: it reproduces on the first try and the harm is the one
> the reviewer named.

**Pre-flight — reproduced before a line of source moved.**

Two clauses written first, with the list responses held open and released BY HAND, so the
order they resolve in is chosen rather than raced. Seeded with no class selected, so
boot's own param-less read settles first and the screen starts clean; then tap C1, tap C2
before C1's answer is back, and release C2 then C1.

```
tools/ci fe --slug classes-progress
  × A resolving after B leaves B's subjects on screen, not A's
      expected [ 'موضوع القسم الأول', 'موضوع قديم' ]
      to deeply equal [ 'موضوع القسم الثاني', …(2) ]
  × a stale response landing while the newest is still in flight neither paints nor settles
      expected [ 'موضوع القسم الأول', 'موضوع قديم' ] to not include 'موضوع القسم الأول'
```

That first line is the finding, printed: **class C1's list, rendered under class C2's
selected tab.** `selected()` says C2, storage says C2, the subjects say C1. The second
clause is the worse half — the stale answer arriving while the current one is still coming
— and it also drops `listLoading`, so the wrong screen additionally looks finished.

**The fix.** A monotonic ticket, taken before the await and checked after it:
`const seq = ++listSeq.current`, and every write in `refreshList` gated on still holding
it — `setSubjects`, `setListError`, **and `setListLoading(false)`**. The third is not
bookkeeping: a superseded read clearing the flag while the newest is still in flight is
precisely how a wrong screen stops looking busy.

A `useRef` and not state, for the same reason `creating` is one: the ticket has to be
readable by a resolution that started before the next render.

**One thing deliberately NOT gated: `teacher_required`.** A refused identity is refused
whichever request found out, and discarding a stale one would leave the session running on
an id `be` has rejected. It returns before the ticket is consulted, and that is written
into the source rather than left to be rediscovered.

**The other reads, checked rather than assumed.**

- **`getProgress` inside `loadClasses`** — every per-class rail read is awaited in one
  `Promise.all` inside a single `loadClasses` call, so they share that call's ordering and
  cannot interleave with each other.
- **`ClassPosition`'s own `getProgress` / `saveProgress`** — the component is keyed by
  class id and unmounts on a switch, so a late resolution can only reach a still-mounted
  instance, which is by construction the right class. `onUpdated` writes
  `classProgress[currentClass.id]` from that render's closure, so there is no path by which
  one class's position lands on another's key.
- **`loadClasses` itself — examined, and NOT given a ticket.** Three call sites: `boot`,
  sign-up's `onDone`, and `ClassPosition`'s `onClassGone`. The third cannot start before
  the first has finished (the component only mounts once a snapshot exists) and the second
  is dismissed with `setOnboarding(null)`, so no two can be in flight together today.
  And its one ordering-sensitive write is self-correcting by construction: `setCurrentClassId`
  is derived from `loadCurrentClassId()` read AFTER the awaits — from storage, which the
  tap already updated — not from the response. Adding a guard for an interleave that
  cannot occur, on a function whose sensitive write reads current state anyway, is the
  speculative kind of hardening the hard-constraints table rules out. **Recorded so the
  next person who makes `loadClasses` concurrently reachable knows this was a judgement
  and not an oversight.**

**Pinned.** Two new clauses in fe-2's own oracle, in their own describe block. fe-1's,
fe-4's and fe-5's are byte-untouched (`git status --short` on all three: empty). The
`class-switch` diff is **purely additive** — `git diff | grep '^-'` returns nothing at all,
so no existing clause was weakened to make room. The mock gained one option, `holdLists`,
and one control, `release(classId)`.

**Revert-check.** Drop the three `if (current())` guards and both new clauses go red on
the same two assertions as the pre-flight — 95 passed, 2 failed. Neither clause can pass
without the fix.

**Live (:10800, real `be` on :9800), two classes.** Forced reordering is not reproducible
against a real lane without a proxy in the path, so what was measured live is the genuine
concurrency and the regression risk this fix actually carries — that the ticket breaks
ordinary switching:

| | measured |
|---|---|
| tap 3ع2, then 3ر1 immediately | devtools shows the two scoped reads issued **1 ms apart** — `?classId=…c430` at `60214.414` and `?classId=…12c3` at `60214.415`, genuinely both in flight |
| what settled | the tab actually selected (3ر1) with its own list, `aria-pressed=true` on it alone, `teacher.class.v1` agreeing, and no stuck spinner |
| the position surface across the same switches | unaffected — «موقعكم المسجَّل: الأسبوع 8 من 27» and the rail on «3ر1 · أسبوع 8» |

The ordering property itself is pinned in jsdom, where the release order can be chosen,
and revert-checked. Recorded as such rather than claimed as a live result.

## qa

**Finding K1 — the boot banner spoke English.** The subject-list error
(`SubjectList`'s `.subjects__error`, chosen at `App.tsx`'s `refreshList` catch) rendered
`err.message` raw. On a datastore outage `be` forwards `StoreError`'s own words, so the
first thing a teacher saw was **«datastore unavailable»**, in Latin script, in the
sidebar. Same defect the review loop already fixed in `ClassPosition`, `SignupClasses`
and `MyClasses` with the `teacherMessage(e, fallback)` seam — this is the fourth site and
the most visible one.

### Reopen — the outage's first sentence

> Micro IMPLEMENT loop, same lane (fe :10800 → be :9800). Path-scoped freeze checks
> (WF-63).

**Reproduced live before a line of source moved.** Lane 8's backend restarted with
`MONGO_URL=mongodb://127.0.0.1:59999` — a dead port, not the shared Mongo, which other
work is using. `/health` went `degraded` with `store.ok:false`, and the list read
answered exactly what the fixture now carries:

```
GET /api/subjects → 503
{"error":{"message":"datastore unavailable","type":"store_unavailable",
          "detail":"MongoServerSelectionError: connect ECONNREFUSED 127.0.0.1:59999"}}
```

and the sidebar, under «مواضيعي»:

```html
<div class="subjects__error" role="alert"><span>datastore unavailable</span>
  <button class="btn btn--ghost">إعادة المحاولة</button></div>
```

A scan of the whole rendered page found **exactly one** Latin run on it — that sentence.
So the banner was not one English string among many; on the outage screen it was the only
thing a teacher could not read.

**The fix.** `teacherMessage(e, "تعذّر تحميل المواضيع.")` at the point the message is
chosen, keeping the existing deny-list design: `be`'s route handlers write Arabic that
names the real problem («الأسبوع خارج المجال», «القسم غير موجود») and those still reach
the teacher; only the pass-through families are substituted, and an unknown `type` falls
to the caller's own sentence. The **raw `e`** is handed over, not `asError(e)` — that
wrapper turns a non-`GenerateError` into `String(e)`, which is a JS error string and just
as foreign; the original lets the seam fall to the Arabic fallback.

**One more site fixed, and why.** `AuthPanel`'s alert (`AuthPanel.tsx:275`) is byte-identically
the same shape — `<strong>{error.message}</strong>` plus a `retryable`-gated retry, no
`detail`, no correlation id — and it is the FIRST screen a signed-out teacher sees. Driven
live against the same dead store: signing in printed «datastore unavailable» on the gate.
Fixed at the render site, the object kept whole so `retryable` still decides the affordance.

**The sweep — what was left, and why it is not arbitrary.**

| site | verdict |
|---|---|
| `App.tsx` list banner | **FIXED.** Teacher-reachable, most visible, reproduced live. |
| `AuthPanel.tsx:275` | **FIXED.** Teacher-reachable, reproduced live, identical shape. |
| `AdminConsole.tsx:174` | **Operator-only** — behind `requireAdmin`, reachable only by an admin account. English from a forwarded upstream failure is diagnostic there, not a constraint breach. Not touched. |
| `RefinePanel.tsx:164` | Teacher-reachable and the same shape — **but it cannot be fixed here.** The promoted net pins it: `tests/fe/persistence-gaps/revisions.characterization.test.tsx:207` asserts the alert contains «الخدمة غير متاحة مؤقتًا» under a `store_unavailable` fixture. That is a message `be` never sends (the same fixture-fiat the K1 fix exists to end), but the oracle is frozen against this loop, and substituting our sentence would turn it red. **Stop-and-ask, not an edit.** |
| `App.tsx:1308` (workspace alert) | Teacher-reachable and genuinely English today, but **not the same shape**: it also renders `error.detail` raw, which is always English (`MongoServerSelectionError: …`), and its `claude_*` messages are the CLI's own words. `teacherMessage` on `message` alone would leave English on screen one line below. That is the larger error-mapping job, out of scope as briefed. |

**Pinned.** One clause in fe-2's own `class-switch` oracle, in its own describe block. The
mock gained one option, `listFails`, carrying **`be`'s English verbatim** — mocking an
Arabic message for this type is what made the earlier clause certify nothing, and the
comment on the fixture says so. The clause asserts the Arabic sentence, that the word
`datastore` never reaches the surface, that no Latin run of any kind does, and that the
retry still re-issues the read and the substitution survives a second failure.

**Revert-check.** Stash the two source files and the clause goes red on exactly the defect:

```
× the banner says it in Arabic, with no Latin run, and the retry still re-reads
    expected 'datastore unavailableإعادة المحاولة'
    to contain 'تعذّر الوصول إلى قاعدة البيانات'
```

97 passed, 1 failed. Pop, and 98/98.

### Done-protocol (K1)

| rung | outcome |
|---|---|
| oracle green ×2 | `98 passed (98)` · `gate PASS` both runs |
| promoted net | `project/tests/fe` staged under a throwaway slug against this checkout's `src/` — **21 suites, 313/313 PASS**, unchanged |
| freeze audit (path-scoped) | `git status --short` empty for `persist.ts` · `ClassBar` · `ExamView` · `RefinePanel` · `SolutionView` · `poll.ts` · `taxonomy.ts` · `AdminConsole` · `App.css` · `api.ts` · `ClassPosition` · `MyClasses` · `SignupClasses` · `SubjectList`. fe-1's, fe-4's and fe-5's oracles byte-untouched. `class-switch`'s diff is **purely additive** — `git diff \| grep '^-'` returns nothing |
| source diff | three removed lines total: the one `setListError`, `AuthPanel`'s import, `AuthPanel`'s `<strong>` |
| `tools/ci fe --slug classes-progress` | `gate PASS (1 ran, 0 skipped)`, from the fe worktree |
| build + lint | `tsc -b` + `vite` clean · `oxlint` exit 0 |
| live, before | «datastore unavailable» in `.subjects__error`; the gate's alert the same |
| live, after | «تعذّر الوصول إلى قاعدة البيانات. حاول مرة أخرى.» in both, retry affordance intact, **zero** Latin runs on the page |
| lane restored | `MONGO_URL` unset, `be` restarted — `/health` `ok`, `store.ok:true`; `obs status` both services UP; the app boots to the empty state with no banner |
