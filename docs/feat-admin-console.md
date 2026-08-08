---
kind: feature
id: feat-admin-console
title: "Seeing the system you are running"
plane: product
part_of: prod-exam-builder
realized_by: [cmp-be-admin-api, cmp-fe-admin-console, mod-be-teacher-store]
demonstrated_by: [features/accounts-hardening/iterations/01-initial/qa.md]
status: fresh
last_verified: 2026-08-08
tags: [arabic, rtl, admin]
---

# Seeing the system you are running

## Product behavior (what the operator gets)

An **admin** account sees what no teacher can: every teacher, every exam, and four numbers
about the whole system — total exams, average generation time per exam, average exams per
teacher, and average **usage** per exam.

An admin reaches the console at `#/admin`. There is deliberately no link: any link a teacher
can see is an invitation to a request they will be refused, and the refusal is the only thing
they would learn.

## Every number says what it was computed over

This is the console's central discipline, learned the hard way.

- **`examsWithKpis`** — the averages for usage and duration cover only exams that carry those
  numbers. Everything generated before this shipped carries none, so an average without its
  denominator would be a number an operator acts on wrongly.
- **Teachers vs anonymous sessions** — the teacher count is **accounts**. Counting anonymous
  sessions too made *exams per teacher* read about three times low, because most rows in the
  store are sessions rather than people. Both figures are shown.
- **The teacher list is capped at 200 and says so**, reporting the true total. A truncated
  list that does not admit it is truncated is a lie.

## Usage is not money

The product runs on a subscription, so the per-exam figure is a **usage signal**, never a
price. It is labelled as consumption and never rendered with a currency symbol. Presenting
it as money would mislead the one person the console exists to inform.

## What an admin is not

An admin is **not a super-teacher.** On the ordinary teacher routes they see exactly their
own work — another teacher's exam is as invisible to them as it is to anyone. Privilege
lives on separate routes behind a separate guard, so there is no path where an ownership
check is "relaxed" for a role.
