---
kind: module
id: mod-be-admin
title: "Admin and the auth boundary"
plane: implementation
part_of: svc-teacher-be
repos: [teacher-be@a3691dd]
source: [teacher-be/src/routes/admin.ts, teacher-be/src/ratelimit.ts, teacher-be/scripts/seed-admin.mjs]
status: fresh
last_verified: 2026-08-08
tags: [backend, auth, admin]
---

# Admin and the auth boundary

The privilege layer: the admin read surfaces, the guard that gates them, and the limiter that
bounds the auth routes underneath.

## The seeded admin

`scripts/seed-admin.mjs` creates the admin account, taking its password from
**`ADMIN_PASSWORD` in the environment**. The value is never written to a file — a credential
in git history cannot be rotated, and this repo stores password hashes. A test greps the
whole tree to keep it that way.

Admin is **not self-registerable**: sign-up always produces a teacher, whatever the request
body says, because `createTeacher` takes no role argument at all.

## What is bounded here, and what is not

**Bounded:** guessing against sign-in and recovery, and the one-request enumeration oracle
that sign-up used to be.

**NOT bounded:** the `teacherId` is still a **bearer credential** — it does not expire and
cannot be revoked. Replacing it with a real session touches 7 backend files, 11 promoted
suites and the frontend's whole storage layer, and doing that in the same change that
introduces a privilege level would mean altering the authentication mechanism and adding
privilege at once, each masking the other's mistakes. It is **fenced, not fixed**, and the
follow-on job is where it is replaced.

One residual channel is disclosed rather than claimed closed: sign-up followed by a recovery
attempt still distinguishes an existing address. That costs two rate-limited requests and an
ambiguous answer, against the single clean `409` it replaced.
