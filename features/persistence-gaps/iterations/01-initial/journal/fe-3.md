# fe-3 — let a teacher go back to a previous version

**Closed 2026-08-08.** Oracle green (15/15, suite total 52/52), mutation caught. Same
single-context caveat as `fe-1`.

## Pre-flight

```
$ grep -n "refine\|onRefine\|replaceExercise" stacks/teacher-fe/src/components/RefinePanel.tsx | head
43:    <div className="refine" ref={box}>
44:      <div className="refine__head">
46:      <button ... className="refine__close" ...
```

Reproduced: the panel had shortcuts, an instruction box and a submit — **and nothing that
offered an earlier version**. Refinement replaced the exercise in place with no way back.

## Cycles

- **C1 — oracle first, proven RED.** 15 clauses; **13 failed, 2 passed**. The two that
  already passed are worth naming: *"the refine panel's own contract is unchanged"* (it was,
  nothing had been touched yet) and *"409 conflict is surfaced as RETRYABLE"* — which passed
  **by accident**, through `KIND`'s unknown-type fallback of `{backend, retryable:true}`. An
  accidental pass is not a guarantee, so `conflict` was given an explicit row anyway; the
  behaviour is now intended rather than lucky.

- **C2 — a stateful mock, because a stateless one cannot express the clause that matters.**
  The harness models `exercise_revisions`: `PUT` appends the OUTGOING version and the `GET`
  returns newest-first. Without that, *"restoring GROWS the list to 3"* — the clause proving
  restore is not destructive — could not be written at all.

- **C3 — restore reuses the existing PUT, through App's existing write path.** The panel
  does **not** call the API itself. It hands the chosen version up to `applyExercise`, the
  same function refinement uses, so restore inherits the save-state banner, the retry and the
  honest failure reporting rather than growing a second, quieter write path. The oracle pins
  that no `restore|undo|revert` URL exists anywhere in the traffic.

- **C4 — the double-click, written as a race from the start.** `disabled` re-renders a tick
  late, so restore is guarded by a `useRef` as well. A second write would push a spurious
  version into the very list the teacher is reading to decide what to keep.

- **C5 — one fetch per opened exercise.** `loadHistory` is a `useCallback` keyed on
  `[teacherId, subjectId, exercise.id]`, and the effect depends on it — so typing in the
  instruction box does not re-fetch. Pinned by firing three keystrokes and asserting the
  request count is still 1. Restoring re-fetches deliberately: the history it just read is
  stale, and a teacher who cannot see the list grow would think the old version was consumed.

## Delta note — App.tsx was touched (declare it)

Slot 3 names `api.ts` and `RefinePanel.tsx`, and freezes *"App.tsx's **save flow**"* rather
than App.tsx entirely. App.tsx was edited, twice, and both edits are outside that save flow:

1. `<RefinePanel>` gains three props (`teacherId`, `subjectId`, `onRestore`) — pure wiring;
   without it the panel cannot know which subject's history to read and the sub-issue is
   unbuildable as specified.
2. The exercise-write half of `onRefine` was **extracted verbatim** into `applyExercise` so
   restore can share it. Splice → `setExam` → `persist(replaceStoredExercise)` in the same
   order, with the same retry closure. `onRefine` still calls `setRefining(null)` before
   applying (the panel closes on refine); restore does not (the panel stays open).

Behaviour-identical, and the reviewer should verify that by reading the two side by side.

## Mutation spot-check

Made `restore` skip its `loadHistory()` re-read — the shape of a plausible "the list will
refresh next time it opens" shortcut.
→ **`restoring GROWS the list to 3 — it supersedes, it never destroys`** failed, 51/52.
Reverted; 52/52.

## Perimeter

Promoted net unchanged from the post-`fe-1` state — 15 failures, all `fe-1`'s declared
supersession, **none added here**. `core-loop/print` and `core-loop/exam-render` stayed
green, which is the check that history never leaked into the sheet.

## What the reviewer must look at

- **The history renders with no CSS.** `App.css` is not in any fe sub-issue's Delta, so the
  new `.history*` classes have no rules and the list falls back to a default `<ol>`. Nothing
  *breaks* under RTL (markers flip correctly) but it is plainly unstyled. Deliberate freeze
  compliance, not an oversight — styling is its own change, and it applies to `AuthPanel`
  from `fe-1` too.
- `Statement` is the only renderer allowed to interpret `$…$`. The history uses it. If a
  future change ever renders `r.exercise.statement` as text, LaTeX reaches a teacher.

## What I'd tell the next slice

- `applyExercise` is now the single exercise-write path. Anything new that changes one
  exercise should go through it rather than calling `replaceStoredExercise` directly, or it
  will silently lose the save-state banner and the retry.
- `be` returns `409 conflict` on a genuine concurrent replace. It is mapped retryable and
  surfaces the Arabic message `be` sends — do not add a second message for it in `fe`.
