---
kind: feature
id: feat-classes-progress
title: "A teacher's classes, and where each one has reached"
plane: product
part_of: prod-exam-builder
realized_by: [cmp-be-classes-api, cmp-be-progress-api, cmp-be-teacher-school, cmp-be-mutation-log, cmp-fe-class-bar, cmp-fe-class-position, cmp-fe-signup-classes, cmp-fe-my-classes, flow-class-position-and-switch]
demonstrated_by: [features/classes-progress/iterations/01-initial/qa.md]
status: fresh
last_verified: 2026-08-11
tags: [arabic, rtl, classes, programme]
---

# A teacher's classes, and where each one has reached

## Product behavior (what the user gets)

A teacher tells the product which classes they teach — a name they already use
(«3ر1», «3ع2») and a stream for each — and then, per class, **where that class has
actually reached in the official programme**. A bar of tabs sits across the top of the
app, one tab per class, and the selected tab is the class everything else is about.

A class with no position says only its name. Selecting it puts one question on screen —
«أين وصل هذا القسم؟» — and a week picker running from 0 to that class's own last week.
Once a week is marked, the tab carries it («3ع2 · أسبوع 8») with a thin rail showing how
far through the programme that is.

Switching class empties the desk: the open exam, the refine panel and the corrections all
go, and the saved-exams list re-reads scoped to the new class. One thing deliberately
survives a switch — an exam that failed to save and is waiting to be retried. Dropping
that on a tab click would be exactly the silent loss the save queue exists to prevent.

New teachers meet classes during sign-up: after the recovery code, step 3 asks for the
classes and the school, step 4 asks where each one has reached, and every class on step 4
can be skipped. Everyone else — including every teacher who had an account before this
existed — adds classes from «أقسامي» in the account panel.

**Why per class and not per teacher.** A teacher with two classes three weeks apart has
two positions. Modelling them as one merges them silently, and the merge is discovered
when an exam covers material one class has never been taught, in front of that class.

## Implementation parallel

| Node | Stack | Role |
|---|---|---|
| [[cmp-be-classes-api]] | be | `POST`/`GET /api/classes` — create and list, stream validated against the corpus |
| [[cmp-be-progress-api]] | be | `GET`/`PUT /api/progress/:classId` — the read synthesizes, the write compare-and-sets |
| [[cmp-be-teacher-school]] | be | `PUT /api/teacher/school` — collected on the same sign-up step |
| [[cmp-be-mutation-log]] | be | one structured line per class or progress write, including the losses |
| [[cmp-fe-class-bar]] | fe | the switcher row and its rails |
| [[cmp-fe-class-position]] | fe | the week-0 invitation, the picker, and the 409 |
| [[cmp-fe-signup-classes]] | fe | sign-up steps 3 and 4 |
| [[cmp-fe-my-classes]] | fe | «أقسامي» — the only path to a class for an existing account |
| [[flow-class-position-and-switch]] | — | end-to-end: create → position → switch → re-scope |

The class layer also reaches into two nodes it does not own: [[mod-be-subject-store]] and
[[cmp-be-subjects-api]], where a subject may carry a `classId` and a list may be filtered
by one, and [[mod-be-teacher-store]], which now holds the school.

## States & edges

- **No classes.** Every teacher who predates this is here. No bar, no position surface,
  no extra row in the shell — the app is byte-for-byte what it was. Verified against a
  recording of the pre-slice DOM.
- **Week 0.** Not an error and not a position. The tab shows the name alone; the surface
  asks the question.
- **A class whose position could not be read** looks the same as a genuine week-0 class in
  the bar, and gets **no** position surface. That is deliberate: a backend predating this
  slice answers 404 to every class call, and an error banner would greet every teacher on
  an older backend with a failure about a feature they are not using. The cost is a real
  ambiguity in the bar, recorded rather than papered over.
- **Two people writing one class's position at once.** One wins, the other gets a 409, is
  told «تغيّر موقع هذا القسم في مكان آخر… أعد الاختيار.», and the picker re-reads and
  re-asks. The write is never resent for them.
- **Datastore down.** The position write says so in Arabic and offers a retry, keeping the
  week the teacher chose. The class bar simply does not appear.

## Honest limits

- **A generated exam carries no `classId`.** It is stored as legacy, so an exam made while
  3ر1 was selected also appears under 3ت2. Deliberate — tagging generation is a later
  slice — and it is the first thing a teacher trying the switcher will notice.
- **The school is write-only.** It is stored and nothing reads it back, so «أقسامي» shows
  no school field. End to end it reads as "the setting does not work".
- **There is no delete, rename or archive** for a class, on any surface. A class made by
  mistake is permanent. A name made only of invisible characters (a pasted RLM or ZWSP)
  passes both stacks' `trim()` and produces a permanently blank tab — reproduced live.
- **`POST /api/classes` is not rate limited**, unlike the auth routes.
- **Per-week entries** (`planned · done · skipped` + a note) are stored and validated, but
  nothing in the UI writes one yet — only the marked week.
- **Nothing is auto-selected.** A teacher returning on a wiped browser gets their classes
  back with no tab selected, and a newly created class does not become the current one.

## Related
- [[feat-teacher-accounts]] — the account these hang off; sign-up steps 3 and 4 run after it
- [[feat-subject-library]] — the list a class switch re-scopes
- [[feat-exam-generation]] — does not yet know about classes
