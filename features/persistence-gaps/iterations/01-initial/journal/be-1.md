# be-1 — write the teacher down: `teachers` + sign-up/sign-in

**Closed 2026-08-08.** Oracle green ×2, freeze clean, perimeter stable, mutations caught.

> **Deviation from the loop protocol, stated up front.** The skill runs implementation on
> the `be` stack agent and pronounces done via a *fresh-context* verifier that never saw
> the diff. Subagents were not spawned in this session, so implementation and verification
> were both done in one context. Everything below was mechanically verified (commands and
> outputs, not opinion), but the **double-blind property is absent** — a fresh-context
> verifier re-running pre-flight + oracle + perimeter + freeze would restore it.

## Pre-flight

Reproduced the sub-issue's ground truth before writing anything:

```
$ curl -sX POST localhost:9300/api/teacher
{"teacherId":"7d5a06db242b53f32685783e7e194ebc","correlationId":"…"}   # minted, not stored
$ mongosh --quiet --eval 'db.getSiblingDB("teacher_saas").getCollectionNames()'
subjects                                                                # no teachers collection
```

Both matched. Proceeded.

## Cycles

- **C1 — oracle first, and prove it fails.** Wrote
  `tests/be/auth-signup.characterization.test.js` before any product code.
  Result: **9 failed, 2 passed**. The 2 passing were the perimeter clauses
  (`POST /api/teacher` unchanged, unknown id still accepted) — which *should* already
  hold, so the red was for the right reason.

- **C2 — store.** `src/store/teachers.ts`. Two decisions worth recording:
  - **`scrypt` from `node:crypto`, no dependency.** `be` has nine deps and none is a
    hasher; the platform ships a memory-hard KDF. Adding one was not justified, and the
    sub-issue made "a hashing dependency is a stop, not a judgment call" explicit.
  - **`burnVerify` on the unknown-email path.** The contract requires the two 401s to be
    indistinguishable. Returning early when no row matches satisfies that in the *body*
    and breaks it on the *clock* — "wrong password" costs ~100 ms of scrypt, "no such
    account" returns instantly, and sign-in becomes an enumeration oracle by timing. The
    unknown path now spends the same work against a decoy hash.
  - Duplicate email is caught from Mongo's **11000**, not a prior read: check-then-insert
    races two concurrent signups onto one address.

- **C3 — routes + mount.** `src/routes/auth.ts`, mounted in `app.ts` **before**
  `subjectsRouter()` (subjects puts `requireTeacher` on its own prefix; auth has to stay
  reachable without a header, since it is how you get one). Typecheck clean.
  Gate: **11/11 pass**.

- **C4 — surface self-description.** `GET /api` listed every route except the two new
  ones, so the service was describing itself wrongly. `app.ts` is in the Delta, so this
  was in scope rather than creep. Now lists `/api/auth/signup` and `/api/auth/signin`.

## Done-protocol

| check | result |
|---|---|
| oracle ×2 | 11/11, 11/11 — stable across runs (each run uses fresh emails, so re-running does not collide) |
| freeze audit (path-scoped, WF-63) | only `src/app.ts`, `src/routes/auth.ts`, `src/store/teachers.ts`; nothing outside the Delta |
| perimeter differential | `subjects` doc fields unchanged (`_id, teacherId, subject, controls, createdAt, updatedAt`); `POST /api/teacher` shape unchanged; `/health` keys unchanged; unknown id **still accepted** (`be-2`'s job, not this one) |
| mutation — signin reissues instead of adopting | **caught** by "sign in returns the SAME teacherId" + the normalisation test |
| mutation — the two 401s made distinguishable | **caught** by "unknown email and wrong password are INDISTINGUISHABLE" |
| `tools/ci be --slug persistence-gaps` | PASS, `11/11 ran` |

## Notes for the next slices

- **The SEED kit's GT2 recording is now deliberately stale.** `journal/probe-gaps.py` P1
  prints *"EXPECT: no `teachers` collection exists"*. That was true when recorded and
  `be-1` is exactly the change that ends it. The collection list is now
  `subjects, teachers`. **`be-2`'s pre-flight should expect that** — it is not drift.
- **`be-2` inherits the declared supersession.** `requireTeacher` still accepts any
  well-formed id, and this sub-issue deliberately left it that way (the oracle *pins*
  the old behaviour so `be-1` cannot quietly change it). Flipping it is `be-2`'s declared
  scope, under WF-65.
- **`dist/` in this worktree is not built.** The gate drives the running lane, so it
  didn't matter here, but any suite that spawns the server itself needs `npm run build`
  first.

## review
**approve-with-debt** (Fable 5, cross-model, 2026-08-08). Prosecuted by execution on the
lane. Blind-first expectations found no divergence on the enumeration oracle (burnVerify
spends decoy work), the adopt-race (CAS on `email: null`), or dead-store classification.
Mutation kill rate across the be slice: **7/7**.
**Debt found and FIXED during review:** `auth.signup/signin/recover` logged the **whole
teacherId** — a bearer credential — contradicting `requireTeacher`'s own rule that it must
be truncated. Now an 8-char prefix, pinned by a new clause.
