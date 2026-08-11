---
kind: component
id: cmp-fe-auth-panel
title: "The sign-in gate"
plane: implementation
part_of: mod-fe-exam-builder
realizes: [feat-teacher-accounts]
depends_on: [cmp-be-auth-api]
repos: [teacher-fe@eadc55e]
source: [teacher-fe/src/components/AuthPanel.tsx, teacher-fe/src/lib/persist.ts]
status: fresh
last_verified: 2026-08-11
tags: [frontend, arabic, rtl, auth]
---

# The sign-in gate

Sign-up, sign-in and recovery in one panel. A browser with no identity sees it instead of
the builder; the anonymous boot-time mint that used to live here is gone, because an id
nobody can re-obtain is exactly the loss accounts exist to end.

## Two details that are not cosmetic

- **The recovery code renders `dir="ltr"`** inside an otherwise RTL page. Everything else
  is Arabic and right-to-left, but an RTL-flipped code is a code the teacher copies down
  wrong — and they copy it onto paper.
- **The form is `noValidate`.** With native validation on, a malformed email is blocked by
  the browser and the only feedback is its own bubble, rendered in the *browser's* locale —
  an English or French sentence on the auth mainline of an Arabic-only product, which no
  jsdom test can see. The server validates and answers in Arabic, so every word the teacher
  reads is ours.

## Displacing an identity

Signing in on a browser that was being used anonymously replaces the held id. Those earlier
exams are not moved into the account — the server adopts only on sign-up, because adopting
on sign-in would re-point subject documents. So the displaced id is kept in
`teacher.previous.v1` and the teacher is told, in Arabic, that the exams were neither moved
nor deleted. The loss stops being silent and irreversible.

## What happens after «متابعة»

The panel stores the id and hands the session to the app exactly as it always did — and it
now says whether this was a sign-**up**. That one extra argument is what puts the class
steps ([[cmp-fe-signup-classes]]) in front of a new teacher, without moving them behind the
confirm gate: a promoted regression test pins «متابعة» as the moment the id is stored *and*
the builder is on screen.

The account panel also carries [[cmp-fe-my-classes]] — «أقسامي» — which is the only way a
teacher with an existing account makes a class.
