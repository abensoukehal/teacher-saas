---
kind: product
id: prod-exam-builder
title: "Exam builder"
plane: product
composed_of: [svc-teacher-be, svc-teacher-fe]
status: fresh
last_verified: 2026-08-11
tags: [arabic, mathematics]
---

# Exam builder

> The product a teacher opens.

## What it is (product view)
A tool for Algerian lycée mathematics teachers. The teacher describes the exam
they need, gets a full draft in Arabic with the maths properly typeset, reworks
any single exercise by saying what they want changed, and prints the result. The
value is time: an evening's work compressed into minutes.

## Composed of (services)
- [[svc-teacher-fe]] — everything the teacher sees
- [[svc-teacher-be]] — the API and the generation

## Features
- [[feat-exam-generation]] — produce a draft exam from structured choices
- [[feat-exercise-refinement]] — rework one exercise in the teacher's own words
- [[feat-exam-print]] — a printable paper
- [[feat-subject-library]] — every exam is kept and can be reopened
- [[feat-exercise-history]] — every superseded version is kept, and restorable
- [[feat-solution-sheets]] — the model correction and its grading scale
- [[feat-teacher-accounts]] — an account, so the exams follow the teacher
- [[feat-classes-progress]] — the teacher's classes, and where each one has reached
- [[feat-admin-console]] — the operator's view, not a teacher's

## Boundaries
Mathematics only. Six streams can be declared for a class and every one resolves to its
own programme document, but only شعبة الرياضيات has a curriculum reference for generation.
Nothing student-facing. There is billing for nobody. Exams are kept and now belong to an
account, but there is no search, no folders and no deleting — and a generated exam does not
yet know which class it was made for.
