---
kind: product
id: prod-exam-builder
title: "Exam builder"
plane: product
composed_of: [svc-teacher-be, svc-teacher-fe]
status: fresh
last_verified: 2026-08-07
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

## Boundaries
Mathematics only, and one stream's programme so far. Nothing student-facing.
No sign-in and no billing. Exams are kept, but they are tied to the browser they
were made in, and there is no search, no folders and no deleting.
