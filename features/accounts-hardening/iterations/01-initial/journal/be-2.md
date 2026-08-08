# be-2 — a real role, and an admin that cannot be self-registered

**Status:** done · gate `32/32` green (14 be-1 + 18 be-2) · freeze audit clean.

## Pre-flight (slot-2 ground truth, re-run)

```
grep -rniE '\brole\b|isAdmin' stacks/teacher-be/src/   → no output
```

Reproduces: there is no role concept at all. (The recorded "every hit is an ARIA
attribute" was about `fe`; `be`'s source has no hits whatsoever.)

## Oracle first, RED before code

`features/accounts-hardening/tests/be/roles-admin.characterization.test.js` —
first run **15 failed, 17 passed** (the 17 being be-1's 14 plus the three be-2 clauses
that were already true of the unchanged service).

**The suite contains no password.** It generates a random secret per run, hands it to
the script through the environment, and greps the whole tree for that generated value
expecting zero hits. That is strictly stronger than grepping for one known literal: it
proves the property (the script writes its input nowhere) rather than the absence of
one string — and it keeps the real credential out of the project repo, which is where
this suite is versioned.

## Delta (exactly the sub-issue's)

- `src/store/teachers.ts` — `Role`, `role?` on `TeacherDoc`, `roleOf()`, and
  `findByTeacherId()` for the guard. `createTeacher`, `claimAnonymous` and
  `ensureAnonymous` all write `"teacher"` explicitly.
- `src/teacher.ts` — `requireAdmin`.
- `scripts/seed-admin.mjs` — new.

`src/routes/subjects.ts`: **untouched.** `src/routes/auth.ts`: untouched — sign-up
needed no change, which is the point below.

## Decisions worth a reviewer's eye

- **`createTeacher` takes no role argument.** There is no parameter for a caller to
  pass, so there is no request field that can reach it. Sign-up creating a teacher is
  not a check that could be forgotten; it is the only thing the function can do. This
  is why `routes/auth.ts` needed no edit at all.
- **`roleOf()` is one-way.** Only the exact string `"admin"` grants. Absent, unknown,
  or junk degrades to teacher. A missing field must never read as privilege.
- **`requireAdmin` does ONE read**, not `isKnownTeacher` then fetch. Two reads can
  disagree, and the window between them is where a privilege decision gets made
  against the wrong answer.
- **401 and 403 stay distinct**, with the 401 body byte-identical to the teacher
  surfaces' — an admin route must not become an oracle for which ids exist.
- **The seed script is idempotent and deliberately NOT a reset.** A re-seed that
  silently rotated the credential would lock the operator out of their own console.
  Rotating means deleting the row and seeding again — a decision, not a side effect of
  running a script twice.
- **`ADMIN_EMAIL` defaults to `admin@app.com`** and is overridable. That default is
  what makes the dry run assertable without writing, and the override is what lets the
  suite exercise the script hermetically against throwaway addresses instead of
  colliding with the operator's real account.
- **The scrypt encoding is duplicated in the script** (a `.mjs` file cannot import the
  TypeScript source). That duplication is the one real risk here, and it is closed the
  only honest way: the oracle seeds an account and then **signs in through the running
  service**. A drift in either direction turns the gate red.
- **No recovery code for the admin.** Issuing one means printing a second secret to a
  terminal; an operator who loses this password has database access by definition.

## Clauses written from the start

- **Concurrency:** two simultaneous sign-ups racing one anonymous id — one claims, one
  mints — must *both* land as teachers. Two different write paths, and the one nobody
  describes in prose is the one that gets the role wrong.
- **Adoption:** claiming a legacy anonymous row (written by the backfill, with no
  `role` field at all) must produce an explicit `"teacher"`, not a blank.
- **No-rewrite:** a legacy teacher row keeps no `role` key and an unchanged
  `updatedAt`, and still works on the teacher surfaces.
- **Not a super-teacher:** the seeded admin gets the same 404 body a stranger gets for
  another teacher's subject, and that subject is absent from the admin's own list.

## Deferred, deliberately — read this

`requireAdmin`'s 401 / 403 / pass behaviour is black-box-observable only once a route
uses it, and the first admin route arrives in **be-3**. Those three clauses are
written in `admin-surfaces.characterization.test.js`, not omitted. This suite proves
everything that *is* observable without a route: the stored role, the write paths, the
seed script, and the negative that an admin is not privileged on teacher paths.

## Mutation spot-check (two, both caught)

1. Script echoes the password to stdout (`console.log(\`password: ${password}\`)`).
   **Caught by** `positive — the seed script › THE SECRET NEVER TOUCHES A FILE —
   zero hits anywhere in the tree`.
2. Idempotence guard removed, so a re-seed rewrites `passwordHash`.
   **Caught by** `positive — the seed script › re-running does not duplicate, and does
   NOT reset the password` (both the stored-hash assertion and the observable half —
   the original password still signs in, the new one does not).

Both reverted; gate green again.

## Local verification

`ADMIN_PASSWORD=… node scripts/seed-admin.mjs --yes` created `admin@app.com` with
`role: admin`, and `POST /api/auth/signin` returned its teacherId. The password was
passed on the command line as an environment variable and appears in no file.

## Freeze audit

```
git -C stacks/teacher-be status --short
 M src/store/teachers.ts
 M src/teacher.ts
?? scripts/seed-admin.mjs
```

## review
**approve-with-debt → debt closed.** No privilege hole found: no request field reaches
`createTeacher`, `roleOf` is one-way, admin is not a super-teacher on the teacher routes
(404 live), 401 and 403 stay distinct, and the seeded admin password appears nowhere in either repo.

**The finding that mattered:** inverting `roleOf` so an absent role means *admin* **survived
the entire gate**. The two legacy-row tests exercised the listing's own inline ternary and a
teacher route — **neither sent a null-role id through `requireAdmin`**, which is the guard's
sole privilege decision. 68% of teacher rows carry no `role` field, so an inverted default
would have silently made thousands of accounts admin with everything green.

Two clauses added: a null-role id is refused `403` on all three admin routes, and is still a
working teacher. The mutation now fails 5 clauses.
