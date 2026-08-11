---
kind: component
id: cmp-fe-class-position
title: "Where this class has reached"
plane: implementation
part_of: mod-fe-exam-builder
realizes: [feat-classes-progress]
depends_on: [cmp-be-progress-api]
repos: [teacher-fe@eadc55e]
source: [teacher-fe/src/components/ClassPosition.tsx, teacher-fe/src/lib/api.ts]
status: fresh
last_verified: 2026-08-11
tags: [frontend, rtl, arabic, programme]
---

# Where this class has reached

> The selected class's own surface: the week-0 invitation, the position line, the picker,
> and the compare-and-set.

Mounted for the selected class and **keyed by class id**, so switching class remounts it
rather than carrying a stale snapshot across.

## What is on it

- **Week 0** — «قسم جديد — <name>», the question «أين وصل هذا القسم؟», a lede, and two
  affordances: «حدّد أين وصلت» and «نبدأ من الأسبوع 1».
- **Positioned** — «موقعكم المسجَّل: الأسبوع N من M».
- **The picker** — `0 .. programme.totalWeeks`, with 0 labelled «لم نبدأ بعد». Twenty-eight
  options against the live corpus. The ceiling is **that class's own** programme, never the
  constant 27, and it has to be carried over from the read: the write's 200 body has
  `progress` and `correlationId` and **no `programme`**.
- The picker shows the recorded position while the teacher is choosing.

**No colour on this surface at all.** The affirmative action is filled with `--ink`, not the
accent — the product does not grade a teacher's pacing, and green on a position is a grade.

## The three ways a write ends

| | What the teacher gets |
|---|---|
| `200` | the new position, and the tab updates |
| `409` | «تغيّر موقع هذا القسم في مكان آخر… أعد الاختيار.» — the surface **re-reads** and re-asks. The write is never resent with `rev + 1`; verified live against a second writer, and the next line in the backend log is a GET |
| retryable failure | one neutral notice **plus** a retry button, and the chosen week is kept |
| hard failure | the same neutral notice, no retry — pressing again would be a lie |

## Every word the teacher reads is ours

The notice used to render the backend's `err.message` raw, and on a datastore outage that
message is the store's own words — «datastore unavailable», two Latin words rendered LTR
inside an RTL card, on a product whose first constraint is Arabic-only. Messages now pass
through `teacherMessage()`, a **deny-list of exactly two families** (`StoreError`,
`ClaudeError`) that also **fails closed on any error type this client does not know**. Every
message a route handler authors still reaches the teacher unchanged — that is deliberate, and
it is why the fix is a deny-list rather than a blanket replacement.

Two strings on this surface are ours and not the design's: «لم نبدأ بعد» and the conflict
sentence. The prototype's lede ends with a pointer to a «البرنامج» screen that does not
exist yet; that clause is omitted rather than promised.

## Known rough edges

- **A class whose progress read failed gets no position surface at all** — no setter, by
  design, so nobody is asked to re-answer at `rev` 0.
- **Sign-up step 4 renders this at full size, once per class**, so its eyebrow and lede repeat
  under a step that already asked. The host hides them with CSS; a `compact` prop is the real
  answer.
- **The write is not offline-queued**, unlike a failed exam save.
- The `503` and `404` paths are pinned in tests and were **not** exercised live from this
  surface's own oracle; the outage path was later driven end to end by QA.

## Realizes
- [[feat-classes-progress]] — setting and re-reading a class's position

## Depends on
- [[cmp-be-progress-api]] — the read, the ceiling, and the 409

## Related
- [[cmp-fe-class-bar]] · [[cmp-fe-signup-classes]] · [[flow-class-position-and-switch]]
