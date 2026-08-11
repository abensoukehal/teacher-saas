# fe-4 — sign-up learns steps 3 and 4, and the account gets «أقسامي»

> Implementer journal. Lane slot 8 (fe :10800 → be :9800). `fe-1` (`0e840fe`),
> `fe-2` (`7dc9485`) and `fe-3` (`4aebcf0`) done and verified; `be-1..be-6` done.
> Every freeze check below is **path-scoped to fe-4's own delta** (WF-63).

## Pre-flight — the ground truth reproduces

Two halves: the wire, and the screen.

**The wire**, curl'd against the LIVE `be` on :9800 on a purpose-made account
(`71c5e66d…`), not trusted from be-1/be-4's journals:

| probe | expected (contract §0, §3) | got |
|---|---|---|
| `POST /api/auth/signup` | `{teacherId, recoveryCode}` | `201`, both present |
| `PUT /api/teacher/school` with a name | `200 {ok:true}` | `200` |
| …with `"   "` | trims, blank = CLEAR | `200` |
| …with 121 chars | `400` | `400` |
| `POST /api/classes` × 2 | `201 {class:{id,name,stream,createdAt}}` | `201`, 24-hex lowercase ids |
| `POST /api/classes` with an invented stream | `400 invalid_request` | `400` «الشعبة غير معروفة» |
| **all six corpus streams** | each `201` | **6/6 `201`** |
| `GET /api/classes` | createdAt ASCENDING | ascending |
| `tools/dev status` | lane 8 up | backend 9800 UP · frontend 10800 UP |

**The screen**: signed up in the browser on :10800 and confirmed the flow ends at the
recovery-code screen today — «احتفظ برمز الاسترجاع», the code LTR, «نسخ الرمز» +
«متابعة», and «متابعة» lands straight in the builder. There is no step 3 and no step 4.
Reproduced exactly as the sub-issue states it.

**One fact the sub-issue does not state, and it decided the whole design** — see below.

## The one thing that could not be built where the Delta says

**The Delta says the steps extend the step machine inside `AuthPanel`, off `issued`.
They cannot live there.** The promoted `project/tests/fe` net pins two clauses on that
exact seam (`persistence-gaps/auth.characterization.test.tsx:240-266`):

```
test("continuing stores teacher.id.v1 = the returned id and renders the builder")
  click("متابعة")
  → localStorage teacher.id.v1 === TID
  → screen.getByRole("button", { name: "توليد الموضوع" })
```

Two screens behind «متابعة» break both. The oracle is frozen and it is *right*: the
confirm gate is the last thing between a teacher and the product they just paid attention
to sign up for, and the id has to be stored there or a crash loses the account.

The sub-issue's own text offers the alternative — the steps hang off the `issued` screen
**or off `onAuthenticated`** — so that is where they went:

- `AuthPanel`'s «متابعة» passes one extra argument, `mode === "signup"`. `mode` is not
  reset when `issued` is set, so nothing new is stored and `submit()` is byte-untouched.
- `App.onAuthenticated(id, freshSignup)` stores the id and boots exactly as today, and
  additionally holds `onboarding = id`.
- `SignupClasses` is then what the WORKSPACE renders, with the app already around it —
  the sidebar, the switcher, all of it. Which is also the more honest picture: the
  teacher is inside the product, not still in a form.

Recorded as a Delta extension, not a silent one: `src/App.tsx` (three small hunks) and
`src/App.css` (appended, zero deleted lines) are touched beyond the Delta's list. Both
were forced by a frozen oracle, and the alternative was to break it.

## What was built

| path | what |
|---|---|
| `src/lib/classdraft.ts` (new) | `STREAMS` (the six) + the draft row shape and its two checks |
| `src/components/ClassEditor.tsx` (new) | the shared rows: name + stream + «+ أضف قسمًا — الشعب الست كلها متاحة» |
| `src/components/SignupClasses.tsx` (new) | steps 3 and 4, the step bars, the footer, the per-class SKIP |
| `src/components/MyClasses.tsx` (new) | «أقسامي» — the list with each class's position, and add-a-class |
| `src/components/AuthPanel.tsx` | the second argument on «متابعة»; «أقسامي» mounted for a held id |
| `src/lib/api.ts` | `createClass`, `setTeacherSchool` — both through `request()` |
| `src/App.tsx` | `onboarding` state, the seam in `onAuthenticated`, the pane, the empty state gated |
| `src/App.css` | `.signup*` · `.classedit*` · `.myclasses*` — appended, **zero deleted lines** |

### Decisions worth naming

1. **How the six streams were sourced.** There is NO stream-list route on `be` —
   `app.ts` mounts auth/subjects/exams/classes/progress/admin and nothing else, and
   `classes.ts` validates through `getProgrammeForStream` against the corpus. So the
   honest minimum was taken: the six values are read out of
   `project/data/programmes/*.jsonl` (5 documents, 6 streams — the lettres document
   carries two), placed in `classdraft.ts` as a **mirror**, and every one of them was
   verified accepted by a live `POST /api/classes` while an invented seventh was refused.
   `be` stays the authority: its `400` «الشعبة غير معروفة» renders on the row that caused
   it. `taxonomy.ts:10`'s `STREAM` constant was **not** touched and not extended.
   *A `GET /api/streams` route is the real fix and is recorded as a follow-on.*
2. **Nothing is pre-selected in the stream picker.** A defaulted «شعبة الرياضيات» would
   be the product guessing which programme a class is held to — and being demonstrably
   on-programme is the whole pitch. The picker opens on «اختر الشعبة», and a half-filled
   row is a question to the teacher rather than a request to `be`. It also makes the
   contract's rule free: an unchosen stream is never serialised as `""`.
3. **Skip changes one boolean and nothing else.** No PUT, no queued write, no "record the
   skip as week 0". Proved twice: the oracle pins it negatively, and the live pass ended
   with exactly ONE progress document in Mongo for the two classes created.
4. **Classes are created one at a time, in order.** `GET /api/classes` answers createdAt
   ASCENDING and that is the switcher's tab order; a `Promise.all` would let the tabs come
   out in a different order than the teacher typed them.
5. **A failed create keeps its row, and a succeeded one is dropped.** `be`'s create is
   insert-only, so re-sending a row that landed is a second class, not a retry. Pressing
   «التالي» again after fixing one row issues exactly one more POST.
6. **«أقسامي» reads positions and does not set them.** The setter is fe-3's, on the
   class's own surface where the teacher can see which class they are standing in. A
   second home for the same compare-and-set is a second chance to get the 409 wrong.
7. **A create in «أقسامي» hands the session back to the app** via `onAuthenticated` with
   the same id — the panel closes and the class is in the switcher, where it gets used.
   The alternative (refresh in place, tell `App` later) meant editing the cancel button,
   which is inside the frozen region.
8. **«رجوع» is absent on step 3.** The screen upstream is the recovery code, which is
   shown ONCE and is gone from memory by then — the promoted net pins that it is never
   shown again. A back button that cannot go back is worse than none. From step 4 it
   works normally.
9. **The four step bars start at step 3 with two already filled.** Putting a progress bar
   on the account form and the code screen would have edited two byte-frozen screens for
   decoration.

## Mutation checks — the oracle bites

Eight mutants, each reverted immediately. `signup-classes` has 31 clauses.

| mutant | clauses killed |
|---|---|
| the skip writes `markedWeek: 0` | **3** |
| only one stream offered (the `taxonomy.ts` regression) | **12** |
| the stream picker defaults to the first stream | **4** |
| the school PUT is sent even when empty | **2** |
| a failed create clears the row's typing | **1** |
| the steps sit BETWEEN «متابعة» and the stored id | **22** |
| recovery gets the steps too | **1** |
| «أقسامي» renders «من 27» instead of the class's own ceiling | **1** |

Baseline restored green after each.

## Done-protocol

### 1 · The oracle, twice

| | result |
|---|---|
| `features/classes-progress/tests/fe/signup-classes.characterization.test.tsx` | **31/31**, run 1 and run 2 |
| fe-1 + fe-2 + fe-3 oracles, unedited | **42/42** |
| `tools/ci fe --slug classes-progress` from the fe worktree | **73/73 · gate PASS** |

### 2 · The promoted net

`project/tests/fe` staged under a throwaway slug so it runs through `tools/ci`'s own
entry point against the JOB checkout (`features/_perimeter-fe/`, deleted afterwards) —
the invocation fe-1..fe-3 all used:

| | result |
|---|---|
| `project/tests/fe` — 21 suites, with fe-4's `src/` | **313/313 PASS** |

Unchanged from fe-1's, fe-2's and fe-3's recorded 313/313 — including the
`persistence-gaps` auth suite whose two «متابعة» clauses shaped this whole sub-issue.

### 3 · Freeze audit — path-scoped (WF-63)

```
git status --short -- src/lib/taxonomy.ts src/lib/persist.ts \
  src/components/AdminConsole.tsx src/components/ClassBar.tsx \
  src/components/ClassPosition.tsx src/lib/classes.ts       → empty
git status --short -- features/classes-progress/tests/fe/{class-bar,class-switch,week-zero-position}.characterization.test.tsx → empty
```

`AuthPanel.tsx`'s diff is three hunks and **none of them is in `submit()`** — the signup
and recovery handlers are byte-identical. The recovery-code screen's copy, its `<code
class="num" dir="ltr">` and its two buttons are untouched; the only change on it is the
second argument to the confirm gate's `onClick`, which is the seam the sub-issue asks
for. `npx tsc -b` clean; `npm run lint` clean (a first cut put the constants in
`ClassEditor.tsx` and drew four `only-export-components` warnings against a warning-free
baseline — hence `lib/classdraft.ts`).

### 4 · The live pass — the whole sign-up, end to end

Lane slot 8, a real account (`fe4live1@example.com` → `45963d65…`):

1. sign up → the recovery code screen, unchanged → «متابعة»
2. **step 3** in the app shell: two rows typed («3ر1» شعبة الرياضيات · «3تج2» علوم
   تجريبية), the second added with «+ أضف قسمًا — الشعب الست كلها متاحة» and the first
   row keeping its values, school «ثانوية الأمير عبد القادر — وهران»
3. **step 4**: class 1 positioned at week 8 through fe-3's picker (0..27, from ITS
   programme); class 2 skipped with «تخطَّ الآن — يُضبط لاحقًا», which collapsed its
   setter and stated the skip
4. «ابدأ ←» → the app, class bar showing «3ر1 · أسبوع 8» with a filled rail and «3تج2»
   with none, in creation order, right-to-left
5. «الحساب» → «أقسامي» listing «3ر1 — شعبة الرياضيات · الأسبوع 8 من 27» and
   «3تج2 — علوم تجريبية · لم يبدأ بعد»; added «3ر2 — تقني رياضي», the panel closed and
   the third tab appeared
6. cleared storage, signed IN with the same account → straight to the app, three classes,
   **no steps**

**The wire, recorded from the browser's own network log:** `POST /api/classes` ×2 ·
`PUT /api/teacher/school` ×1 · `GET /api/progress/:id` ×2 · **`PUT /api/progress/:id` ×1**
· then `GET /api/classes` + both progress reads on finish. Every URL relative.

**The obs assertion.** `be`'s log for teacher prefix `45963d65`:

```
class.created  classId 6a7a9a8682d1408f50727a39  cid e9d1af58-1bda-4ebc-a274-c5988316f53a
class.created  classId 6a7a9a8682d1408f50727a3a  cid 2b952c25-7e72-4685-990b-c52e6094dfee
teacher.school cleared:false                     cid f8b5edc0-7ab0-4d72-be33-d74e43c9a2fa
progress.write classId …a39  week 8  rev 1  outcome win
                                                 cid 5bdef2e0-f735-4f51-a5ad-0b885543d428
class.created  classId 6a7a9bed82d1408f50727a3b  cid ad681f40-fa54-4d0a-956b-0cce2b7182de   ← «أقسامي»
```

**No `progress.write` line for the skipped class, anywhere.** And the store agrees:

```
db.progress.find({teacherId:"45963d65…"})  →  [ { classId: …a39, rev: 1, markedWeek: 8 } ]
GET /api/progress/…a3a  →  markedWeek 0, rev 0, identity fields null,
                           programme {docKey:"tadarroj-3as-sciences", totalWeeks: 27}
```

One document for two classes. The skipped one is synthesized on read — which is the
lazy-document contract working, and also the first proof in this job that a class on a
NON-math stream resolves to its own programme document.

## Not settled by the sub-issue

- **Step 4 reuses fe-3's `ClassPosition` at full size, once per class.** That is what
  "drives the fe-3 setter, not a duplicate" costs: the component renders its own eyebrow,
  its own «أين وصل هذا القسم؟» and its own lede for every class, against a step that has
  already asked the question once. `ClassPosition` is fe-1..fe-3's and outside this
  Delta, so the fix here was **styling, not editing** — the host hides the eyebrow and
  the lede (`.signup-class .classpos__eyebrow/.classpos__lede`), leaving the per-class
  question. The real fix is a `compact` prop on `ClassPosition`; it belongs to fe-5 or a
  follow-on, and it would want a different oracle than the one frozen here.
- **The school is write-only, so «أقسامي» cannot show it.** `be` deliberately returns it
  from nothing (be-4: the print sheet reads it in a later slice). An input pre-filled with
  a blank would silently clear a stored value, so the account area has no school field at
  all. The design's account screen shows one; this is a deliberate gap, not an omission.
- **Two strings are ours, not the prototype's:** «أضف» (the confirm in «أقسامي» — the
  design's account screen is a mock with no save action) and «اختر الشعبة» (the picker's
  unchosen state, which the prototype has no picker for). fe-5's language sweep should
  look at both as new copy rather than as design fidelity. Everything else on these
  surfaces is the prototype's, verbatim, except:
- **step 4's lede stops before «يمكن تعديله لاحقًا من «البرنامج».»** — the same omission
  fe-3 made, for the same reason: «البرنامج» is a screen slice 2 builds.
- **A create in «أقسامي» closes the account panel.** It is how the new class reaches the
  switcher without editing the frozen cancel button. Defensible (you land where you will
  use it) but it is a choice, and a teacher adding three classes one at a time will
  reopen the panel three times — the editor's multi-row add is the answer, and it is
  there.
- **`onboarding` is not persisted.** A reload mid-wizard lands the teacher in the app with
  whatever they had already created; «أقسامي» is where they finish. Deliberate — a stored
  flag would be a wizard that reappears after a reload the teacher chose — but it does
  mean the school field's contents are lost on a reload before «التالي».
- **No rate limiting on `POST /api/classes`**, and step 3 will happily create ten classes
  in one press. Inherited knowingly (contract §6: these routes are not rate-limited in
  slice 1).
- **There is no stream-list route.** `classdraft.ts`'s `STREAMS` is a mirror of the corpus
  verified against the running service, and it will drift the day the corpus gains a
  stream. `GET /api/streams` on `be` is the follow-on; until then the drift is caught by
  `be`'s own `400`, on the row that caused it, rather than silently.

## review

**Verdict: approve-with-debt.** Cross-model review (Fable).

The Delta extension (steps off `onAuthenticated`, not inside `AuthPanel`) re-examined:
the frozen promoted clauses at the «متابعة» seam are real, binding, and the extension
was the only shape that satisfies them — legitimate, as the verifier found. The
journal's attribution error (calling the implementer brief "the sub-issue's own text")
is already recorded in known-gaps; the extension itself is sound.

Double-submit on step 3 is guarded (`busy` + sequential creates + succeeded rows
dropped); the skip writes nothing (re-confirmed in the store during my pass). The debt
is the recorded pair: `ClassPosition` at full size styled down by host CSS (a `compact`
prop is the honest fix, next slice), and the write-only school leaving «أقسامي» without
the design's school field. The `STREAMS` mirror stands as the known drift hazard —
`GET /api/streams` deserves the sub-issue known-gaps asks for.
