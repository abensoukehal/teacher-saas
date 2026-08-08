---
kind: module
id: mod-be-teacher-store
title: "Teacher accounts store"
plane: implementation
part_of: svc-teacher-be
repos: [teacher-be@f6cf955]
source: [teacher-be/src/store/teachers.ts, teacher-be/src/teacher.ts]
status: fresh
last_verified: 2026-08-08
tags: [backend, mongodb, auth]
---

# Teacher accounts store

The `teachers` collection, keyed by the **existing** 32-hex `teacherId`. That key choice
is the whole design: an account attaches to the id `subjects.teacherId` already holds, so
adding accounts moved and rewrote **zero** subject documents and left the
`{teacherId:1, updatedAt:-1}` index valid.

## Two kinds of row

| kind | `email` | created by |
|---|---|---|
| anonymous | `null` | `POST /api/teacher` — records the id it mints |
| account | a string | `POST /api/auth/signup` |

"Issued" means minted **and recorded**. That definition is what makes rejecting an unknown
id safe: before it, `POST /api/teacher` handed out ids it never wrote down, so a forged id
and a real one were indistinguishable. A one-time backfill
(`scripts/backfill-teachers.mjs`) covered the 159 ids that predated the registry — without
it, turning rejection on would have locked every existing teacher out of their own exams.

## Things that must not be undone

1. **The `email` unique index is PARTIAL** (`{email: {$type: "string"}}`). A plain unique
   index permits exactly one null, so the second anonymous row would collide.
2. **`ensureAnonymous` uses `$setOnInsert`**, never `$set`. An upsert that overwrote would
   reset a real account's `passwordHash` and silently disable it.
3. **Single-use recovery is enforced by rotating `recoveryHash`**, not by `recoveryUsedAt`.
   The first implementation filtered on `recoveryUsedAt: null` while setting that field to
   `null` in the same update — the guard guarded nothing, four concurrent recoveries all
   succeeded, and three teachers were handed a code that was already dead.
4. **The unknown-email path spends the same work as a real one** (`burnVerify`). Returning
   early would leak account existence through the clock even though the bodies match.
5. **Hashing is `node:crypto`'s scrypt** — no dependency was added. The platform ships a
   memory-hard KDF and this service has nine dependencies.
