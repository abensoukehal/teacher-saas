---
kind: component
id: cmp-be-auth-api
title: "Account endpoints"
plane: implementation
part_of: mod-be-teacher-store
realizes: [feat-teacher-accounts]
depends_on: [mod-be-teacher-store]
repos: [teacher-be@7b13f12]
source: [teacher-be/src/routes/auth.ts]
status: fresh
last_verified: 2026-08-11
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
- **Sign-up no longer confirms that an address exists.** A duplicate answers `201` like any
  other sign-up, with a **working, freshly minted teacher id** and a **decoy recovery code**.
  `409 email_taken` was a one-request enumeration oracle — one call per address, unambiguous —
  and it undid all the care taken to make sign-*in* indistinguishable. Three details make the
  replacement hold: the id must be a *working* one, because returning a random value would
  reopen the oracle one step away (`requireTeacher` rejects an id it never recorded, so a
  caller could read the answer off a 401); the duplicate path spends comparable hashing work,
  so the clock does not answer what the status code no longer does; and the recovery code
  cannot be anything but a decoy, since recovery looks an account up by email and the row it
  belongs to has none. The real account is not touched in any way. An operator still sees it:
  `auth.signup.duplicate`, with no address and no id.
- **The recovery code is returned exactly once**, at sign-up, and again only as a fresh code
  when one is spent. Only hashes are stored.
- **Messages are Arabic; `type` is the stable machine key.** `claude_auth` and
  `store_unavailable` are both 503 and mean opposite things, so callers branch on `type`.
- **A bearer id is never logged whole** — auth lines carry an 8-character prefix, matching
  the discipline `requireTeacher` already followed.

## One route here is not an auth route

`PUT /api/teacher/school` shares this file and nothing else: it is the only route here behind
`requireTeacher`, because it writes onto a row that must already exist. See
[[cmp-be-teacher-school]].
