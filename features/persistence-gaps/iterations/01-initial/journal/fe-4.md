# fe-4 — a failed save survives the tab closing *(hardening)*

**Closed 2026-08-08.** Oracle green (17/17, suite total 69/69), freeze clean, mutation
caught. Same single-context caveat as `fe-1`.

## Pre-flight

```
$ grep -n "SaveState\|setSaveState" stacks/teacher-fe/src/App.tsx | head
48:type SaveState = { kind: "idle"|"saving"|"saved" } | { kind: "error"; retry: () => void };
61:const [saveState, setSaveState] = useState<SaveState>({ kind: "idle" });
217:setSaveState(err.retryable ? { kind: "error", retry } : { kind: "idle" });
$ grep -c "pending" stacks/teacher-fe/src/lib/persist.ts
0
```

Both reproduced: the retry was a closure in memory — exactly as durable as the tab — and
no pending key existed.

## Cycles

- **C1 — oracle first, proven RED.** 17 clauses; **8 failed, 9 passed**. The 9 were the
  storage-discipline and gap-#5 negatives, which should already hold.

- **C2 — ONE create path.** `createOnce(PendingSave)` replaced `onGenerateSave`, and every
  affordance that can insert a subject now goes through it: the generation, the in-session
  retry, and the replay of a queued save. The reason is `be`'s create being **insert-only**
  — two concurrent creates are not one save twice, they are two exams, in a product with no
  delete route. The whole intent (exam + controls + `genCorrelationId`) travels as one
  value, so a replay after a reload stores exactly what failed, with the same join key,
  rather than a near-copy reassembled from whatever the panel holds by then.

- **C3 — queue on retryable only.** `persist` gained an `onRetryable` hook. A `claude_auth`
  needs a human; queueing it would build a retry loop against a wall.

- **C4 — offered, never silent.** The pending banner is rendered from state read once at
  mount and **nothing fires on its own**. Pinned: remount with a pending key → the offer is
  on screen and `creates()` is 0. The SEED's observability note is explicit that a silent
  background write is indistinguishable from data loss.

## The finding worth more than the feature

**Two of the three race clauses I had written were unfalsifiable, and I only found out by
mutating.** With the in-flight guard deleted:

| clause | via `fireEvent` | via one `act` + `dispatchEvent` |
|---|---|---|
| `fe-4` double-clicked replay | **passed** (green with the bug) | fails, 3 creates |
| `fe-4` queue + retry together | **passed** | fails, 3 creates |
| `fe-3` double-clicked restore | **passed** | fails, 2 restores |
| `fe-1` double submit | fails | (already fired at the form) |

`fireEvent` flushes React between events, so the button is `disabled` by the time the
second click lands and the clause proves only that React honours the attribute. `fe-1`'s
survived because it fires at the **form**, which `disabled` does not gate — the same reason
Enter-in-a-field is a real bypass in the product.

All three were rewritten to dispatch inside a single `act`, so React cannot re-render
between them, and **`fe-3`'s oracle was amended** (declared here; it was committed one
commit earlier in this same loop). A clause that cannot fail is not an oracle, and this is
the precise shape of the `be` lesson: the sequential version of a race clause passes.

## Mutation spot-check

Deleted `if (creating.current) return;` from `createOnce`.
→ **2 clauses failed**: `A DOUBLE-CLICKED REPLAY CREATES ONE EXAM, NOT TWO` and `THE QUEUE
AND THE RETRY ARE THE SAME WRITE`. Reverted; 69/69.

Before the rewrite the same mutation produced a flaky single failure in an unrelated clause
and passed clean on re-run — recorded because "the mutation was caught" was nearly the
wrong conclusion.

## Live check (not in any suite)

Ran the real UI on the lane (`fe :10300 → be :9300`, no generation, no cost): empty browser
→ gate → sign-up → the recovery code `6AD8-UHZ8-VXWS` rendered LTR with its groups in the
right order → continue → the builder. This is the only end-to-end proof in the job that
`fe`'s auth calls match the shipped `be`; every suite mocks `fetch`.

It also caught a defect **no jsdom assertion could see**: `AuthPanel` was wrapping itself in
`.app`, the two-pane grid, so the panel rendered inside the 380 px sidebar track jammed
against the right edge — in RTL the first track is the rightmost, exactly the trap
`App.css`'s own header warns about. Fixed by dropping the `.app` wrapper (`fe-1`'s file,
amended in this slice's commit).

## Perimeter

Promoted net unchanged from the post-`fe-1` state — 15 failures, all `fe-1`'s declared
supersession, **none added by `fe-2`, `fe-3` or `fe-4`**.

## What I'd tell the next slice

- `createOnce` is the only place a subject may be inserted. A second call site
  reintroduces the duplicate-exam bug the guard exists to prevent, and no jsdom test using
  `fireEvent` will notice.
- A queued save survives storage being unavailable *poorly and on purpose*: `savePendingSave`
  is guarded, so in private mode the queue silently does not persist. The in-session retry
  still works. Pinned, so the trade is visible rather than assumed.
- There is deliberately **no discard affordance** on the pending banner. Throwing away a
  teacher's generated exam on a click is the opposite of this job.

## review
**approve-with-debt.** Triple-clicked replay against the real insert-only backend created
**exactly one** subject. Queue/replay/clear/never-silent all hold, and the previously
toothless race clauses are mutation-verified.
**F2, found by review and FIXED:** a `teacher_required` failure dropped the pending intent
before queueing it, so a teacher whose identity was rejected mid-session lost an exam that
had already cost real money — the exact silent-loss class this slice exists to end. The
queue now happens **before** handing over to the gate.
**F3, remaining debt:** `createOnce` silently drops a *second, different* intent while one is
in flight (correct for a double-fire, wrong for two distinct saves). Narrow trigger; the next
hardening pass should queue it rather than return.
