---
kind: component
id: cmp-be-admin-api
title: "Admin surfaces and the privilege guard"
plane: implementation
part_of: mod-be-admin
realizes: [feat-admin-console]
depends_on: [mod-be-teacher-store]
repos: [teacher-be@a3691dd]
source: [teacher-be/src/routes/admin.ts, teacher-be/src/teacher.ts, teacher-be/src/ratelimit.ts]
status: fresh
last_verified: 2026-08-08
tags: [backend, api, auth]
---

# Admin surfaces and the privilege guard

`GET /api/admin/{kpis,teachers,exams}`, behind `requireAdmin` — resolve the teacher, then
check the **stored** role. Nothing in a request can influence it: `createTeacher` takes no
role argument, so sign-up cannot produce an admin however the body is shaped.

## Separate routes, not a relaxed check

`getOwned` scopes ownership **inside the query**, so another teacher's subject is
indistinguishable from one that never existed. Admin does not weaken that; it gets its own
file, its own guard and its own aggregates. A boolean branch inside a teacher handler was
expressly forbidden — that is how an ownership check gets bypassed by accident.

`401` (who are you) and `403` (you are known and refused) stay distinct, because collapsing
them makes the failure unreadable in a log.

## Two things that must not be undone

1. **Projections are allow-lists.** Fields are *never selected* rather than excluded — the
   only version that stays correct when someone adds another secret to the collection. No
   hash has ever left the service; it is asserted by string search over every response.
2. **The absent-role default is `teacher`.** Most rows predate the field. A mutation
   inverting that default once passed the entire gate, because no test sent a null-role id
   through the guard itself — the listing has its own inline ternary that was being tested
   instead. There is now a clause for exactly that path.

## The rate limiter

A fixed window keyed on the socket address (`trust proxy` is off, so a spoofed
`X-Forwarded-For` buys nothing), reserving synchronously and refunding on success so a
correct password is never punished by earlier failures. It bounds guessing against the
~60-bit recovery code, which is the only reason that code length is safe.

**In-process, and that is a milestone decision, not a design.** It is wrong the moment there
are two instances.
