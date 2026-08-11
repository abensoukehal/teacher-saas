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
