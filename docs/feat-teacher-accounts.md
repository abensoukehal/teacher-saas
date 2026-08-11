---
kind: feature
id: feat-teacher-accounts
title: "A teacher's exams follow them"
plane: product
part_of: prod-exam-builder
realized_by: [cmp-be-auth-api, mod-be-teacher-store, cmp-fe-auth-panel, flow-sign-in-and-recover]
demonstrated_by: [features/persistence-gaps/iterations/01-initial/qa.md]
status: fresh
last_verified: 2026-08-11
tags: [arabic, rtl]
---

# A teacher's exams follow them

## Product behavior (what the user gets)

A teacher signs up with an email and a password, and from then on their exams are
theirs. Clearing the browser no longer matters. Working from a second machine no
longer matters. They sign in and everything is there.

At sign-up they are shown a **recovery code** once — twelve characters in three
groups, `XXXX-XXXX-XXXX`, drawn from an alphabet with no `I`, `O`, `0` or `1` in it
because a teacher writes it on paper. It is the way back in if the password is
forgotten, and it is why the product needs no email delivery to be complete. Using it
sets a new password and hands out a **fresh** code in the same breath, so nobody is
ever left holding a code they have already spent.

Typing it back is forgiving: case does not matter and neither do the dashes, so
`abcd efgh ijkl` works as well as `ABCD-EFGH-IJKL`.

After the code, sign-up continues into two more screens — the teacher's classes and school,
then where each class has reached. See [[feat-classes-progress]].

Before this, identity was invisible — the product minted a hidden id and kept it in
the browser. It worked until the browser was cleared, and then every exam that teacher
had ever made became unreachable. The documents survived; nothing could find them.
That is the failure this closes.

## What it deliberately does not do

- **Signing in does not merge an anonymous session.** If a browser was used without an
  account and then someone signs in, those earlier exams stay where they are — they are
  not moved into the account. The teacher is told so, in Arabic, and the previous
  identity is kept rather than discarded. Signing **up** from that browser *does* carry
  the exams across.
- **There is no sign-out**, and no "signed in as" indicator. Nobody has asked for one yet.

## Honest limits

The id behind an account is still a **bearer value**: whoever holds it can read that
teacher's exams — and now their classes and where each one has reached. Accounts made it
recoverable, not secret. It is accepted at the current milestone — two teacher friends
trying the product — and should not survive contact with real users at scale.

**Signing up for an address that already has an account no longer says so.** It answers
exactly like a first sign-up: `201`, a working teacher id, and a recovery code that is a
decoy. Nothing about the real account changes, and the duplicate simply creates no second
one. The cost is that a teacher who types an address they already used is left holding a
recovery code that cannot be redeemed, with nothing telling them why — and, if the browser
was not already carrying a known id, a fresh empty workspace. Traded for closing a
one-request way to test whether a colleague has an account.

The auth routes are rate limited (`429`, with a retry-after); the class routes are not.
