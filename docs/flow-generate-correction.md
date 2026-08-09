---
kind: flow
id: flow-generate-correction
title: "Generating a correction, and keeping it honest"
plane: flow
realizes: [feat-solution-sheets]
steps: [cmp-fe-solution-view, cmp-be-corrections-endpoint, cmp-be-skill-solution-one, cmp-be-inflight, mod-be-solution-store]
crosses: [svc-teacher-fe, svc-teacher-be]
status: fresh
last_verified: 2026-08-09
tags: []
---

# Generating a correction, and keeping it honest

## Sequence

1. **The teacher asks for the correction.** The frontend posts the stored exam to
   `/api/generate` with the `solution-sheet` skill — the same single spawn point exams use.
   ~145 s.
2. **The answers come back** with a scale per exercise. The frontend stamps each with the
   statement it was generated against, from the exam it just sent.
3. **It stores them** at `POST /api/subjects/:id/solutions`. The backend validates the whole
   batch before writing any of it, rejecting an unknown exercise id or a scale that does not
   sum to that exercise's points.
4. **Reading them back** recomputes staleness per exercise by hashing the exam as it is now.

## Why the backend stores rather than generates

It mirrors exams exactly, and it keeps **one** code path able to invoke the CLI — so the
concurrency cap and the failure classification keep their meaning. It also makes the storage
routes testable without paying for a generation.

## What a teacher sees when it goes wrong

Every message is Arabic. A datastore outage is retryable and says so; an expired CLI login is
not, because pressing the button again would be a lie. A correction answering a superseded
exercise is marked out of date rather than served as current — on screen and on paper.
