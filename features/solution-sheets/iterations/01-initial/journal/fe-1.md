# fe-1 — generate a correction, show it, and never hide that it is stale

**Closed 2026-08-08.** Oracle 45/45 ×2, promoted fe net 144/144, freeze clean, `tsc` clean,
mutation caught by 3 clauses — **after** the first mutation proved the clause was fake.

## Pre-flight

Slot-2 ground truth re-run and reproduced:

```
$ grep -rn "solution\|تصحيح" stacks/teacher-fe/src/ | grep -v node_modules
(no matches)
```

Lane 4 up (`be` :9400 `claude.ok` + `store.ok`, `fe` :10400). The real `be` surfaces were
recorded off the lane before a line of `fe` was written — create a subject, store the
recorded batch, refine `ex2`, re-read. That is where the shapes below come from; none of
them is assumed.

| observed | value |
|---|---|
| `GET …/solutions` empty | `200 {solutions: [], correlationId}` — never 404 |
| `POST …/solutions` | `201`, and it answers with **every** solution the subject has, not just the batch sent |
| after refining `ex2` | `[(ex1,false), (ex2,true), (ex3,false)]` — staleness really is per exercise |
| partial re-store of `ex2` | `201`, `ex2` heals, the others untouched |
| unknown `exerciseId` | `400 invalid_request`, Arabic message |

## The mutation that mattered — a clause that was testing nothing

The first mutation (delete the `generatingSolutions` ref guard, leaving only `disabled`)
**passed 45/45.** The money clause was a lie.

`fireEvent.click` flushes React between calls, so by the second press `disabled` was
already painted and the burst never reached the handler. A real browser dispatches the
second click off the same gesture, *before* React repaints — which is the entire reason
the guard is a ref and not `disabled` in the first place.

Fixed in the oracle, not in the app: the presses now land inside one `act()` (`burst()` in
the suite). Re-run against the same mutant → **3 clauses fail**:

- *DOUBLE-CLICK issues exactly ONE /api/generate*
- *double-clicking REGENERATE also issues exactly one run*
- *the whole-exam generate and a single regeneration cannot run at once*

At $0.756 a run this was the one clause worth this much trouble. Recorded here because any
future concurrency clause written with `fireEvent` in this repo is worthless the same way.

## Two decisions worth the words

- **A regeneration re-stores exactly what it asked for.** The run's output is model output;
  an entry for an exercise that was *not* sent is not a bonus, it is an answer written
  without that exercise's context — and `be`'s per-exercise upsert would let it overwrite a
  correction that is currently right. `fe` filters to the requested id and treats an empty
  result as a failed run. Caught by *"only the stale exercise is re-run, and only it is
  re-saved"*, which is what first surfaced the hole.
- **The rendered correction always comes from a server response, never from the run.**
  `stale` is a server-side rehash and `fe` cannot derive it, so painting the generation's
  own output would put a correction on screen the app has no way to know is current. The
  cost is that a save failure hides a $0.76 result — so `storeSolutions` keeps the drafts in
  the retry closure: *"the retry does NOT regenerate"* pins that the retry re-stores.

## The trap this component exists to avoid

The grading scale's `part` strings carry `$…$` maths of their own
(`"…والحصول على $f(x)=\dfrac{1}{\sqrt{x+3}+2}$"`). Rendering them as text would put
`\dfrac` in front of a teacher — the product's flat prohibition, in the densest-maths
surface it has. Both the answer *and* every scale part go through `Statement`.

Verified in a **real browser**, not only jsdom (lane 4, a subject with a stale `ex2`):
0 LaTeX leaks, 0 Latin words, 240 KaTeX nodes, 0 KaTeX errors, `direction: rtl`, 22 scale
parts, exactly 1 regenerate control on exactly the stale exercise.

## For the reviewer

1. **The correction is unstyled on screen after fe-1.** `App.css` is fe-2's Delta by plan,
   so nothing here could add a rule. In the browser the head row runs together
   (`(6 نقاط` / the stale badge / the button) and each scale part's points wrap to their own
   line. Content and constraints are right; layout is fe-2's.
2. **Printing the exam includes the correction until fe-2 lands.** Same cause — the print
   rules live in `App.css`. fe-2 owns the negative clause that closes it.
3. **`**bold**` renders literally**, in the correction and in the exam alike. That is
   `lib/katex.tsx`'s existing behaviour (the recorded exam statements show it too), and
   `katex.tsx` is in neither Delta. Pre-existing, not introduced here.

## Done-protocol

| check | result |
|---|---|
| oracle ×2 | 45/45, 45/45 |
| promoted fe net vs this code | 144/144 |
| `tsc -b --noEmit` | clean |
| freeze | only `src/lib/api.ts`, `src/App.tsx`, `src/components/SolutionView.tsx` (new) |
| mutation — ref guard removed | **caught, 3 clauses** (only after the clause was repaired) |
| real browser | RTL, KaTeX, no LaTeX, stale marked on exactly one exercise |
| `/api/generate` | untouched — request is `{skill, input}` and nothing else |
