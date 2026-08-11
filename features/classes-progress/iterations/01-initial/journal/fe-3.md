# fe-3 — week 0 is an invitation: «أين وصل هذا القسم؟»

> Implementer journal. Lane slot 8 (fe :10800 → be :9800). `fe-1` (`0e840fe`) and
> `fe-2` (`7dc9485`) done and verified; `be-1..be-5` done. A `be` agent is working on
> be-6 in the be worktree at the same time, so every freeze check below is
> **path-scoped to fe-3's own delta** (WF-63) — never a repo-wide clean check.

## Pre-flight — the ground truth reproduces

The sub-issue's ground truth is contract §4's recorded shapes. Probed with `curl`
against the LIVE `be` on :9800 rather than trusted from be-2's journal, on a class
created for this purpose (`6a7a8a4a5877e8523b8b06e8`, teacher `572d6fdd…`):

| probe | expected (contract §4) | got |
|---|---|---|
| `GET /api/progress/:classId` on a FRESH class | the synthesized empty state | `markedWeek: 0`, `entries: []`, `rev: 0`, all four identity/`updatedAt` keys present and `null`, plus `programme {docKey: "tadarroj-3as-math", edition: "2022-09", totalWeeks: 27}` |
| `PUT {rev:0, markedWeek:8}` | insert, `rev: 1` | `200`, `rev: 1`, identity stamped (`transcriptionRev: 4`) |
| replay the SAME `rev: 0` | `409 conflict`, immediately | `409 {"type":"conflict","message":"تغيّر تقدّم القسم أثناء الحفظ"}` |
| `PUT {rev:1, markedWeek:28}` | `400`, week out of the programme's own range | `400 {"type":"invalid_request","message":"الأسبوع خارج المجال"}` |
| `GET /api/progress/<unknown class>` | `404 class_not_found` | `404 {"type":"class_not_found","message":"القسم غير موجود"}` |
| `tools/dev status` | lane 8 up | backend 9800 UP · frontend 10800 UP |

**One shape fact the sub-issue does not state and the implementation turns on: the
PUT's `200` body carries `progress` and `correlationId` — and NO `programme`.** The
week picker's upper bound therefore has to be carried over from the GET that opened
the surface; re-deriving it from the write would silently reintroduce the constant 27.

The two frozen predecessors were re-read before a line moved: `ClassBar.tsx` (the tab
renders a rail only when `railPercent` returns one, and says the name alone at week 0),
`lib/classes.ts` (`ClassProgress = {progress, programme}`), and `App.tsx`'s class state
+ `onSelectClass` (`:474-499`).

## What was built

| path | what |
|---|---|
| `src/components/ClassPosition.tsx` (new) | the surface: the week-0 empty state, the position line, the week picker, the CAS write and its three outcomes |
| `src/lib/api.ts` | `saveProgress` (PUT, through `request()`), and `class_not_found` added to `KIND` |
| `src/App.tsx` | mounts it for the SELECTED class, keyed by class id; `onUpdated` writes the new snapshot into `classProgress` (which is what fills the tab's rail); `loadClasses`'s catch no longer leaves an invisible scope |
| `src/App.css` | `.classpos*` — appended, **zero deleted lines** |

Four decisions worth naming:

1. **No colour on this surface at all.** Not red, not green, and not the accent — which
   is `#1f6b52` / `#4fae8a`, i.e. green. The prototype fills its primary button with its
   own accent; here the affirmative action is filled with `--ink` instead, so the
   hierarchy comes from contrast rather than hue. Measured live: the button renders
   `rgb(236,239,233)` on `rgb(30,35,32)` while `--accent` is `#4fae8a` — the two are not
   the same value, which is the point. «Never grade the teacher» is easiest to break by
   accident with a token that happens to mean "good" somewhere else.
2. **The programme is carried over from the READ, never rebuilt from the write.** The
   PUT's `200` has no `programme` key (pre-flight). `onUpdated({progress, programme:
   snapshot.programme})` is the whole guard, and dropping it fails eight clauses — the
   picker loses its ceiling and the only obvious thing left to reach for is 27.
3. **The picker shows the recorded position while you choose.** It is the difference
   between "re-ask" and "ask again": after a `409` the teacher is looking at the week
   somebody else actually stored, not at their own memory of it.
4. **One neutral notice serves all three failures.** A position that moved elsewhere and
   a datastore that blinked are both things that happened *to* the teacher. Neither is an
   `.alert`, and only the retryable one gets a retry button — offering one for a `409`
   would be an auto-resubmit with a human's finger on it.

## Loop

### Iteration 1 — oracle first, red for the right reason

`week-zero-position.characterization.test.tsx`, 17 clauses, written before a line of
source moved. `tools/ci fe --slug classes-progress` → **15 failed | 27 passed**: every
positive red on `expected .classpos to be truthy`, and fe-1's 14 + fe-2's 11 still green.
Two of my own passed already — the signed-out/`#/admin` negative and "no selection, no
surface". Those are the two-sided half of the file: they had to keep holding rather than
start holding.

### Iteration 2 — green on the first implementation pass

Component + fetcher + mount + CSS landed together. **42/42, gate PASS.** `npm run build`
(tsc -b + vite) and `npm run lint` (oxlint) clean.

### Iteration 3 — ten mutants, because a green negative proves nothing on its own

Eleven of the seventeen clauses are negatives. Each mutant was applied, the gate run, and
the source restored:

| mutant | clauses that caught it |
|---|---|
| the `409` handler resends the write with `rev + 1` | 2 — «does not re-send» **and** «the next attempt carries the rev the re-read brought back» |
| `totalWeeks` hardcoded to 27 | 1 — the picker's ceiling |
| a `0%` rail rendered in the empty state | 2 — «no pacing» and «no red/green» (the inline width) |
| the CTA takes `.btn--primary` (the accent) | 1 — «nothing here is red or green» |
| every write sends `rev: 0` | 2 — the CAS token clauses, both sides |
| the write's response used as the whole snapshot (programme dropped) | **8** |
| `loadClasses`'s catch reverted to fe-1's | 1 — «no invisible scope» |
| `disabled={writing}` removed everywhere | 1 — the in-flight clause |
| a `503` resets the week to the stored one | 1 — «the chosen week still selected» |
| the empty state renders for a positioned class too | 4 |

The `.btn--primary` row is the one worth keeping: the clause is not decorative taste, it
fails the moment a plausible implementer reaches for the app's own primary button.

## Done-protocol

### 1 · Oracle green ×2

`tools/ci fe --slug classes-progress`, from the fe worktree, twice: **42/42, gate PASS**
both times (14 fe-1 + 11 fe-2 + 17 fe-3).

### 2 · fe-1's and fe-2's oracles — green and byte-untouched

Both run in the same invocation and both pass. Neither file has a diff:

```
git status --short -- features/classes-progress/tests/fe/class-bar.characterization.test.tsx \
                      features/classes-progress/tests/fe/class-switch.characterization.test.tsx
  → empty
```

The one place they constrained this sub-issue is recorded under «Not settled» below:
fe-2 pins that a teacher with classes and no selection issues the param-less list
request, so auto-selecting a first class was not available as a resolution to fe-1's
open note. That is a frozen oracle doing its job.

### 3 · The promoted net

`project/tests/fe` staged under a throwaway slug so it runs through `tools/ci`'s own
entry point against the JOB checkout (`features/_perimeter-fe/`, deleted afterwards) —
the invocation fe-1 and fe-2 both used:

| | result |
|---|---|
| `project/tests/fe` — 21 suites, with fe-3's `src/` | **313/313 PASS** |

Unchanged from fe-1's and fe-2's recorded 313/313.

### 4 · Freeze audit — path-scoped (WF-63)

A `be` agent is working on be-6 in the be worktree concurrently, so nothing here is a
repo-wide clean check.

```
git status --short -- src/components/ClassBar.tsx src/lib/persist.ts src/lib/taxonomy.ts \
                      src/components/AdminConsole.tsx src/components/ExamView.tsx \
                      src/components/RefinePanel.tsx src/components/SolutionView.tsx \
                      src/lib/poll.ts src/components/AuthPanel.tsx src/lib/exam.ts
  → empty
git diff -- src/App.css      | grep '^-'  → no deleted lines
git diff -- src/lib/classes.ts            → no diff at all
git diff -- src/lib/api.ts   | grep '^-'  → ONE line: the type import, which gains `Progress`
git diff -- src/App.tsx      | grep '^-'  → ONE line: the `loadClasses` catch's first line,
                                            which gains an early `return`
```

**`ClassBar.tsx` is byte-identical**, as the sub-issue requires: it "only gains live rail
data", and it gets that through `App`'s `classProgress`, which the write updates. The
`pendingSave` queue, `persist.ts` and every fe-2 frozen flow are untouched.

### 5 · `tools/ci fe --slug classes-progress`

`gate PASS (1 ran, 0 skipped)` — 42/42, run from
`project-worktrees/classes-progress/stacks/teacher-fe`.

### 6 · The live pass (:10800, real `be` on :9800)

One teacher, two classes: `3ر1` positioned at week 8, `3ع2` at week 0. Driven in a real
browser, one tab, real clicks.

| step | measured |
|---|---|
| boot on the week-0 class | the card renders «قسم جديد — 3ع2» · «أين وصل هذا القسم؟» · the «أثمن دقيقة في إعدادك…» paragraph · «حدّد أين وصلت» + «نبدأ من الأسبوع 1» |
| the same card, checked for pacing | **no position line, no rail, zero inline-styled nodes, no «%», no «من 27»** — and the tab still says «3ع2» alone |
| geometry at this width | card `l 32 → r 1058` inside the workspace at `top 65`; sidebar `l 1090 → r 1470` — **still the rightmost track**; the two buttons run right-to-left (`x 908` then `759`), matching DOM order under `dir="rtl"` |
| colour | `.classpos__go` computes `rgb(236,239,233)` on `rgb(30,35,32)`; `--accent` is `#4fae8a`. Nothing on the surface is the accent, and nothing is red |
| the picker | **28 options — 0..27, from the live programme** — first «لم نبدأ بعد», last «الأسبوع 27»; select direction `rtl` |
| choose 8 → «وصلنا هنا» | `PUT /progress/…be58 200` (`026e36d8`, be logs `progress.write outcome:"win" week:8 rev:1`) · card becomes «موقعكم المسجَّل: الأسبوع 8 من 27» · the tab becomes «3ع2 · أسبوع 8» with a `29.6%` rail |
| **the 409, for real**: picker open at 12, another writer PUTs week 20 from `curl`, then «وصلنا هنا» | `409` (`eb2f0de4`, be logs `outcome:"cas_loss"`), and the next line in the be log is a **GET**, not a PUT — the write was not resent. The card shows «موقعكم المسجَّل: الأسبوع 20 من 27», the notice «تغيّر موقع هذا القسم في مكان آخر… أعد الاختيار.», the picker still open with **12 still selected** |
| obs | `tools/obs trace eb2f0de4-…` returns both be lines — the `cas_loss` event and the `PUT … 409` — for the click that produced them |
| switch to `3ر1` | the picker and the notice are GONE (the mount is keyed by class id); the card shows that class's own «الأسبوع 8 من 27» |
| real reload | selection restored, `3ر1 · أسبوع 8` and `3ع2 · أسبوع 20` side by side — two classes, two independent positions |
| language | no Latin run anywhere on the surface, no Arabic-Indic digits, no LaTeX |

Not exercised live and recorded as such: the `503 store_unavailable` path (it needs the
datastore down; it is pinned in jsdom, both the message and the one-tap retry), the
`404 class_not_found` path, and the `@media print { .classpos }` rule — inspected, not
printed, exactly as fe-1 recorded for `.classbar`.

### 7 · Journal sealed

## The two inherited open notes

**«Nothing is selected on a first load» — RESOLVED as: it stays, and the surface names
its class instead.** Auto-selecting the first class was the obvious reading of fe-1's
note, and it is not available: fe-2's oracle pins that a teacher WITH classes who has
selected none issues the byte-identical param-less list request of every teacher today
(contract §0), and that file is frozen against me. It is also the better answer on its
own terms — a returning teacher would be moved into a classroom they never walked into,
and their whole subject list re-scoped, by a default. What made the note urgent was
ambiguity about *which* class a position write would land on; that is answered where it
matters, on the surface itself: the card carries «قسم جديد — 3ع2» / «3ر1» above the
control that is about to change that class's week. Pinned two-sidedly — with classes and
no selection there is no position surface and no PUT is reachable.

**«A stale `teacher.class.v1` survives a failed class read» — REPRODUCED, then FIXED.**
It really did: `boot` reads the subject list scoped to the held id *before* `loadClasses`
runs, and fe-1's reconcile only runs on the success path, so a failed class read left the
session filtered by a class with no bar to show it and no tab to change it. An unknown
`classId` answers with the legacy-only list and no error at all (contract §5) — the
teacher would silently lose every class-tagged exam to a selection they cannot see. The
catch now drops the selection **from memory only** and re-reads the list unscoped;
storage is left alone, because the failure may be a blink and the teacher's own choice is
not this code's to destroy — the next successful read restores it. Pinned, and the mutant
that reverts it fails the clause.

## Not settled by the sub-issue

- **A class whose progress read failed gets no position surface at all.** Same shape as
  fe-1's decision that such a class draws by name alone in the bar: the surface needs a
  `rev` and a `totalWeeks`, and inventing either is worse than not rendering. But it does
  mean the class layer still has no error state of its own (fe-1's open note, now in its
  third sub-issue). fe-3 added a surface that CAN fail visibly — the write does, three
  ways — but the *read* still degrades to silence. fe-5's guard-rail pass is where that
  should be decided rather than inherited again.
- **The prototype's lede ends «يمكنك دائمًا تعديله من «البرنامج».» and that sentence is
  omitted.** «البرنامج» is a screen slice 2 builds; shipping the sentence now would point
  a teacher at something that does not exist. Everything before it is verbatim. Recorded
  as the one deliberate deviation from the handoff copy — restore it when the tracker
  lands.
- **Two strings are ours, not the prototype's:** «لم نبدأ بعد» (the picker's 0, which is
  never spelled «الأسبوع 0») and the conflict sentence «تغيّر موقع هذا القسم في مكان
  آخر… أعد الاختيار.». Neither has a source in the handoff — the prototype has no picker
  and no conflict state — so fe-5's language sweep should look at them as new copy rather
  than as design fidelity.
- **`entry` is contractual and unused.** Contract §4 allows a per-week entry with a note
  and a status; slice 1's `fe` sends `markedWeek` only, as the contract says it will. The
  tracker (slice 2) is what consumes it.
- **The write is not offline-queued.** A failed position write is offered as a retry and
  is lost if the tab closes — unlike `pendingSave`, which outlives it. That asymmetry is
  right for now (a week number costs a tap to re-choose; a generated exam costs minutes)
  but it is a choice, not an oversight.
