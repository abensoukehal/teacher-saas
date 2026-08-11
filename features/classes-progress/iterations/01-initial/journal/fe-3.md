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

## review

**Verdict: reopen-implement.** Cross-model review (Fable). One composed finding; the
surface itself is otherwise the best-defended in the fe half.

**The pinned `503` clause is certified by a fixture `be` never sends.** The oracle's
clause «Arabic, retryable, the chosen week still selected» mocks the 503 as
`message: "تعذّر الوصول إلى قاعدة البيانات…"`. The real `be` maps `StoreError` by
passing `err.message` through verbatim (`app.ts`), and that message is
**`"datastore unavailable"` — English** (`store/client.ts:66`). `ClassPosition` renders
`err?.message ?? fallback` raw into the retry notice. Composed: a datastore blink during
a position write puts an English string on a slice-1 surface, on the exact path the
oracle claims is Arabic — the hard constraint violated where the test says it holds.
Neither per-stack gate can see it: be's suites never render, fe's suite invented the
message. (Same class as the green rail this slice already caught once — fe-5's
precedent.)

Suggested micro-patch (not applied), fe-side so the clause becomes true regardless of
`be`: in `ClassPosition` (or centrally in `api.ts`), do not surface `err.message` for
`kind: "store"` / unknown-kind failures — use the component's own Arabic sentence (the
fixture's «تعذّر الوصول إلى قاعدة البيانات. حاول مرة أخرى.» is already written). Flip
the oracle's mock message to the English string `be` actually sends, so the clause
discriminates. The deeper `err.message`-mapping job on `be` stays the recorded follow-on
(be-7 ②) — this patch just stops slice 1 shipping a surface whose pinned Arabic property
is fixture fiat.

Everything else survived prosecution: the 409 re-read-and-re-ask was re-driven (be log
shows GET, never a resent PUT), the programme carried over from the read, ink not
accent, «لم نبدأ بعد» for 0, western digits, keyed unmount across switches.

### Reopen — the English string, and the oracle that certified it

> Micro IMPLEMENT loop, same lane (fe :10800 → be :9800). Path-scoped freeze checks
> throughout (WF-63). The reviewer's finding is upheld in full, and the fix is wider than
> the one surface: two sibling render sites this slice also added had the same defect.

**Pre-flight — reproduced against the live lane, not argued from the code.**

The store was taken away from lane 8's backend only, by restarting it with
`MONGO_URL=mongodb://127.0.0.1:59999`. Shared Mongo was never touched, and the other
clone's lane never saw it.

| probe | got |
|---|---|
| `GET /health` with the store pointed at a dead host | `"status":"degraded"`, `store: {ok:false, detail:"StoreError: datastore unavailable"}` |
| `PUT /api/progress/:classId` on the wire | `503 {"error":{"message":"datastore unavailable","type":"store_unavailable","detail":"MongoServerSelectionError: connect ECONNREFUSED 127.0.0.1:59999"}}` |
| the same write, in a real browser, week 8 chosen in the picker | the notice reads **`datastore unavailable`** — two Latin words, rendered LTR, next to «إعادة المحاولة» in an RTL card |

So the finding is exactly as written: `message` is the English literal at
`store/client.ts:66`, `app.ts` forwards it verbatim, and `ClassPosition` printed it. The
constraint was broken on the one path a passing clause claimed was Arabic.

**The decision: which kinds may still surface a server message, and why.**

Not "never show `be`'s message" — that would be the opposite mistake. Every message `be`
writes in a route handler is Arabic and names the actual problem: «الأسبوع خارج المجال»,
«الشعبة غير معروفة», «القسم غير موجود», «تغيّر تقدّم القسم أثناء الحفظ». Substituting a
generic sentence for those makes the product less useful, not more correct.

The hazard is narrower and has a name: `be` has exactly two error classes whose message it
does **not** author and forwards from something upstream — `StoreError` (the English
literal above) and `ClaudeError` (English literals plus the CLI's own stdout, which is
arbitrary text out of an agent loop). So the seam is a deny-list of those two families,
plus **fail-closed on any type this client does not know**: a `type` absent from `KIND`
gets the caller's own sentence, so a pass-through `be` grows later cannot leak by default.
A `GenerateError` carrying no `type` at all was authored in `api.ts` — the network
sentence, the `فشل الطلب (…)` fallback, the expired-session throw — and its message is
already ours.

`teacherMessage(e, fallback)` in `lib/api.ts`, next to `KIND`, because the policy is
derived from that table. **Deliberately not applied by rewriting `GenerateError.message`
in the two transports**: that message is also what a correlationId-carrying failure is
traced with, and flattening it there would cost the operator the real reason while telling
the teacher nothing more. The substitution belongs at the render site.

**The sweep — `ClassPosition` was not the only one.**

| site | added by | verdict |
|---|---|---|
| `ClassPosition.tsx` — the retry/hard notice | fe-3 | **fixed** |
| `SignupClasses.tsx:72` — `messageOf`, the step-3 notice | fe-4 | **fixed** — same defect, and sign-up is the worst place in the product to show a word a teacher cannot read. `POST /api/classes` and `PUT /api/teacher/school` both reach it, and both can answer `503 store_unavailable` |
| `MyClasses.tsx:94` — the per-row create error | fe-4 | **fixed**, same route, same reachable 503 |
| `ClassBar.tsx` | fe-1 | clean — renders no error at all |
| `ClassEditor.tsx` | fe-4 | clean — renders `r.error`, which its two callers set; fixing them fixed it |
| `App.tsx:661` — `setListError(err.message ‖ …)` | **PRE-EXISTING** (`HEAD~n:src/App.tsx:455`, byte-identical before this job) | **reported, not fixed** — outside this slice, and the same policy call as `api.ts`'s two adoption sites. Belongs with be-7 ② |
| `App.tsx:1279` · `AuthPanel:275` · `AdminConsole:174` · `RefinePanel:164` | pre-existing | **reported, not fixed** — the exam alert is the one that matters: `claude_*` messages are English and reach it today. Not this loop's job |

**The oracle — a declared supersession (WF-65), mock only.**

`week-zero-position…:470`'s 503 fixture said
`message: "تعذّر الوصول إلى قاعدة البيانات. حاول مرة أخرى."`, a sentence `be` has never
sent. The clause «Arabic, retryable, the chosen week still selected» therefore could not
fail the defect it was written to prevent — fixture fiat, exactly as the review says.

- **Clause superseded:** the 503 fixture's `message`, and only that.
- **Why:** the pin was wrong about reality. The finding is not "the code drifted from the
  oracle", it is "the oracle recorded a shape the server does not produce". That is the
  case a declared supersession exists for.
- **What changed:** `message: "datastore unavailable"` — verbatim from the wire capture
  above — plus a comment telling the next reader not to translate it, because translating
  it *is* the bug.
- **What did NOT change:** every assertion. `git diff` on that file deletes exactly two
  lines, a doc comment and the fixture string; **zero assertions were removed**. Arabic on
  screen, retryable, week 8 still selected, and the retry re-sending `{rev:0, markedWeek:8}`
  all still hold. Two assertions were **added** — no Latin run anywhere on the surface, and
  the server's own word never reaches it — so the clause now discriminates.
- The file header gained the rule this came from: a fixture standing in for `be` sends what
  `be` sends.

**Verification — against the real thing.**

Same procedure as the pre-flight, with the fix in: store pointed at the dead host, week 8
chosen, «وصلنا هنا» pressed on the live lane.

| | measured |
|---|---|
| the notice | «تعذّر الوصول إلى قاعدة البيانات. حاول مرة أخرى.» + «إعادة المحاولة» |
| Latin anywhere on the card | **none** — `.classpos` innerText matched `/[A-Za-z]{2,}/` zero times |
| the chosen week | still `8` |
| store restored, one tap on «إعادة المحاولة» | the write lands: card becomes «موقعكم المسجَّل: الأسبوع 8 من 27», the notice is gone, the tab becomes «3ر1 · أسبوع 8» |
| be log | one `progress.write outcome:"win" week:8 rev:1` — the 503 never reached the route, so it wrote nothing, and the retry is the only write |

**Revert-check.** Restore `message: err?.message ?? "تعذّر حفظ موقع القسم."` and the
amended clause goes red on `expected … to contain 'تعذّر الوصول إلى قاعدة البيانات'` —
96 passed, 1 failed. The clause discriminates the exact defect it used to certify.

**And a mutant on the other side**, because a fix that suppresses everything would also
pass: make `teacherMessage` return the fallback for every kind, and **fe-4's own frozen
clause** fails — «400 → an Arabic inline error…» loses «الشعبة غير معروفة». The seam is on
the right axis, and a frozen oracle I may not edit is what holds it there.

**Not settled by this loop.**

- **`be`'s side is untouched and still owed.** `StoreError`'s message is English at the
  source; `fe` now refuses to repeat it, which makes slice 1 shippable but does not make
  `be`'s error copy Arabic. That is be-7 ② and stays there.
- **The pre-existing raw-render sites are a policy question, not an oversight.** Four of
  them, listed above. The exam alert genuinely shows English today when the CLI fails —
  `claude_*` messages are the CLI's own words. Fixing that means deciding what a teacher
  should be told when a generation dies, which is a copy decision, not a micro-loop.
