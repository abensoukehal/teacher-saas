---
kind: component
id: cmp-be-auth-api
title: "Account endpoints"
plane: implementation
part_of: mod-be-teacher-store
realizes: [feat-teacher-accounts]
depends_on: [mod-be-teacher-store]
repos: [teacher-be@f6cf955]
source: [teacher-be/src/routes/auth.ts]
status: fresh
last_verified: 2026-08-08
tags: [backend, api, auth]
---

# Account endpoints

`POST /api/auth/signup` · `POST /api/auth/signin` · `POST /api/auth/recover`, mounted
under `/api` **before** the subject router — subjects sit behind `requireTeacher`, and
these routes are how a caller obtains that header in the first place.

Strictly additive: no existing surface changed shape, which is what let `be` and `fe` merge
in either order.

## The rules

- **Sign-up adopts an unclaimed `x-teacher-id`** when the browser presents one. Without it a
  teacher who used the product anonymously and then signed up would get a new id and lose
  every exam they had made — the same failure accounts exist to end.
- **`invalid_credentials` covers an unknown address and a wrong password**, with identical
  bodies and matched timing. Distinguishing them turns sign-in into an enumeration oracle.
- **The recovery code is returned exactly once**, at sign-up, and again only as a fresh code
  when one is spent. Only hashes are stored.
- **Messages are Arabic; `type` is the stable machine key.** `claude_auth` and
  `store_unavailable` are both 503 and mean opposite things, so callers branch on `type`.
- **A bearer id is never logged whole** — auth lines carry an 8-character prefix, matching
  the discipline `requireTeacher` already followed.
