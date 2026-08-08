# fe-1 — sign up, sign in, recover

**Closed 2026-08-08.** Oracle green (26/26), freeze clean, mutation caught.

> **Deviation from the loop protocol, stated up front.** Implementation and verification
> ran in one context (no fresh-context verifier subagent), so the **double-blind property
> is absent**. Everything below is mechanically verified — commands and their output, not
> opinion — but a third model re-running pre-flight + oracle + freeze would restore it.

## Pre-flight

Slot 2 reproduced exactly:

```
$ grep -n "KEY_TEACHER\|loadTeacherId" stacks/teacher-fe/src/lib/persist.ts
23:const KEY_TEACHER = "teacher.id.v1";
65:export const loadTeacherId = () => read<string>(KEY_TEACHER);
```

And the behaviour it stands for: with `localStorage` cleared, `App` minted a fresh id via
`issueTeacher()` on boot and rendered an empty list. Proceeded.

Promoted-net baseline recorded **before** touching anything: 8 files, **69 passed**.

## Cycles

- **C1 — oracle first, proven RED.** `tests/fe/auth.characterization.test.tsx`, 23 clauses,
  all failing for the right reason (no auth surface exists; the builder renders instead).

- **C2 — the shape of the gate.** The decision that drove everything else, recorded because
  it is the one a reviewer should challenge first. Slot 3 says *"gate the app on a
  teacherId; render AuthPanel when absent"*, and the oracle's "after sign-up … **renders**
  the exam builder" is only assertable if the builder is *not* rendered beforehand. So the
  anonymous mint at boot is **gone**: identity now comes from an account, which is what
  makes an exam reachable from a second machine at all. See the supersession below — this
  is what breaks 15 promoted pins.

- **C3 — adoption.** `signup(email, password, heldTeacherId)` sends `x-teacher-id` when the
  browser holds one; `signin` never does. Sign-in adoption would re-point an anonymous id
  at an account and rewrite subject documents, which the contract's zero-rewrite property
  forbids. This is also why the sidebar carries an **«الحساب»** affordance: without a way to
  reach sign-up *while holding an id*, the adoption path could never fire in the real app,
  and every anonymous teacher would lose their exams the moment they made an account.

- **C4 — the race clause, written from the start.** The `be` lesson applied. The first
  version of the double-submit clause fired the *button* twice and proved only that React
  honours `disabled`: the second `getByRole` could not even find it, because the label had
  already flipped to «جارٍ المعالجة…». Rewritten to fire `submit` at the **form** twice —
  which is what Enter-in-a-field does, and what walks straight past a disabled button. That
  is the clause the `useRef` in-flight guard exists for; the `disabled` attribute is only
  its visible half. Two sign-ups would create two accounts and strand the teacher's exams
  under whichever id lost.

- **C5 — `error.type`, not the status code.** `GenerateError` now carries `be`'s `type`
  verbatim (new trailing optional ctor arg — the existing `kind` mapping is untouched, and
  the promoted table pinning `teacher_required → bad_request` stays green). Two things need
  the type itself rather than the coarse `kind`:
  - `teacher_required` means *this browser's id is not known any more*. `be` can now reject
    an id it never recorded, and without this branch the teacher sits on a permanent error
    with **no route to a sign-in form** — the id is dropped and the gate takes over.
  - `claude_auth` and `store_unavailable` are both 503 and get opposite affordances. Pinned
    both ways in the oracle.

## Declared supersession (WF-65) — READ THIS

Removing the anonymous mint supersedes pins in the **promoted** net:

| suite | before | after |
|---|---|---|
| `tests/fe/persistence/app-persistence` | 13 pass | **9 fail** |
| `tests/fe/persistence/save-state` | 7 pass | **6 fail** |
| the other 6 promoted suites | 49 pass | **49 pass** |

Every failure is the same shape: the suite mounts `App` with an empty `localStorage` and
waits for `teacher.id.v1` to appear from `POST /api/teacher`. That mint is precisely the
behaviour this sub-issue declares it is changing, and the SEED anticipated it — *"any shape
change … must keep those green **or consciously re-baseline**"*.

**It is supersession, not regression-masking.** The invariants those suites protect are
unchanged and still pinned:

- *a second exam must not destroy the first* — `createSubject` is still insert-only, still
  one create per generation; re-pinned for a signed-in teacher in this job's oracle.
- *a failed adoption must not clear the legacy draft* — the clear still happens only after
  the create resolves (`App.tsx`, `boot`).
- *save-state honesty* — untouched; `persist` still distinguishes retryable from hard.
- *storage failures are swallowed* — re-pinned here (`storage-resilience` also still green).

The suites were **not edited**: they are outside this sub-issue's Delta. They need
re-baselining when this job's tests are promoted.

## What the reviewer must look at

1. The gate decision (C2) and the supersession table above.
2. **`npm run build` was already broken on `main`** — `tsc -b` fails with 4 × TS1294
   (`erasableSyntaxOnly` rejects the parameter properties in `GenerateError`). Verified by
   stashing: baseline red, same errors. My new `readonly type?` param adds a 5th instance of
   the identical pre-existing pattern. **Not fixed on purpose** — it is a pre-existing build
   defect, out of this Delta, and rewriting that constructor would disturb a class the
   promoted net pins. `oxlint` is clean; the vitest gate does not typecheck.
3. `<input dir="ltr" placeholder="XXXX-XXXX-XXXX">` on the recovery-code field. Latin, but
   a format mask rather than English copy, and it sits **inside** the `dir="ltr"` exception
   the contract grants the code itself.

## Mutation spot-check

Deleted the `x-teacher-id` spread from `signup()` (the adoption header).
→ **`THE ADOPTION CLAUSE — a held teacher id is sent as x-teacher-id`** failed, 25/26.
Reverted; 26/26.

## What I'd tell the next slice

- `report(e)` in `App.tsx` is the single place a failure becomes either a message or a
  state change. Route new failures through it or `teacher_required` will silently become an
  error banner again.
- The panel reuses existing CSS classes only (`.empty`, `.field`, `.btn`, `.chip`,
  `.alert`) — `App.css` is not in any fe sub-issue's Delta, so it stayed frozen. If the
  auth surface is ever restyled, that is its own change.
- `AuthPanel` holds the recovery code in component state and nothing else ever sees it. Any
  future "show me my code again" feature is a contract violation, not a missing feature.
