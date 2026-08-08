---
kind: flow
id: flow-sign-in-and-recover
title: "Signing up, signing in, and getting back in"
plane: flow
realizes: [feat-teacher-accounts]
steps: [cmp-fe-auth-panel, cmp-be-auth-api, mod-be-teacher-store, cmp-be-subjects-api]
crosses: [svc-teacher-fe, svc-teacher-be]
status: fresh
last_verified: 2026-08-08
tags: []
---

# Signing up, signing in, and getting back in

## Sequence

1. **A browser with no identity** shows the gate. Nothing is minted silently and no
   request touches any teacher's data.
2. **Sign-up** sends the email and password — and, if this browser was already being
   used without an account, the id it holds. The server attaches the account to *that*
   id when it is unclaimed, so the exams already made here follow the teacher in.
   It answers with the teacher id and the recovery code, which is shown once.
3. **Sign-in** returns the *same* teacher id the account has always had. The browser
   stores it and asks for the teacher's subjects exactly as before — the subject
   routes never learned that accounts exist.
4. **Recovery** takes the email, the code and a new password. The code is spent and a
   fresh one is issued in the same response. Spending it twice fails; so does racing
   it, because the check and the write are one atomic step.

## Why it is shaped this way

The account **adopts** the opaque id rather than replacing it. That is what let the whole
feature ship without moving a single exam document, and it is why the sidebar, the
refine panel and the print sheet needed no change at all.

## What a teacher sees when it goes wrong

Every message is Arabic. A wrong password and an unknown address are answered
identically — the product will not tell a stranger which of their colleagues has an
account. A database outage is told apart from a bad password and offers a retry; a bad
password does not, because pressing the button again would be a lie.
