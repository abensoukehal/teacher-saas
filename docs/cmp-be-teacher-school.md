---
kind: component
id: cmp-be-teacher-school
title: "The teacher's school"
plane: implementation
part_of: mod-be-teacher-store
realizes: [feat-classes-progress]
depends_on: [mod-be-teacher-store]
repos: [teacher-be@7b13f12]
source: [teacher-be/src/routes/auth.ts, teacher-be/src/store/teachers.ts]
status: fresh
last_verified: 2026-08-11
tags: [backend, api, accounts]
---

# The teacher's school

`PUT /api/teacher/school` with `{school}` → `200 {ok: true, correlationId}`.

## Why it is its own surface

Sign-up step 3 collects the school — «سيظهر على الموضوع المطبوع» — **after** the account
exists; the recovery code at step 2 is what proves it. So it cannot ride `POST /api/auth/signup`,
whose request and response shapes are frozen. It lives in the auth router because that is
where the teacher-account surfaces live, and it is the only route there behind
`requireTeacher`: it writes onto a row that must already exist.

## The rules

- **Absent is not null.** A `PUT` that names no value is a caller bug (`400` «اسم المؤسسة مطلوب»);
  reading it as a clear would let a malformed request destroy a stored value silently.
- **Blank clears.** `""` and whitespace-only trim to `null`, because blanking a text field is
  how a teacher removes something they typed. The stored set is therefore `{null, non-empty
  string}` and a reader never has to decide what `""` means.
- **120 characters, after trimming** (`400` «اسم المؤسسة طويل جدًا»). The bound is this
  service's invention — no contract names one.
- **`$set` on exactly two fields**, never a document rewrite. This row holds both scrypt
  hashes and is what `requireAdmin` reads; a handler that rebuilt it to change one label is
  one refactor away from disabling an account.
- **Absent reads as null** on the row, the same discipline `role` keeps. Every teacher row
  predating this has no such field and none may change behaviour.
- **No rate limit**, deliberately: the limiter guards the secret-guessing surfaces, and this
  one is behind `requireTeacher` and reveals nothing.
- **The log line carries the event, never the value** — `teacher.school` with a
  `teacherIdPrefix` and `cleared: true|false`. A school name is teacher content.

## Write-only, and that is the gap

Nothing returns it. No read route, no field on sign-in, nothing on `GET /api/subjects`,
`/api/classes`, `/api/progress/:classId`, `/health` or the admin surfaces — pinned per
surface. The print sheet is what will read it, in a later slice, and until that slice decides
what the read looks like an echo here would be a read route arriving by accident for the
frontend to depend on. The consequence a teacher meets today: «أقسامي» cannot show the school
they typed, so end to end the setting reads as not working.

`createTeacher` gained an optional `school` pass-through with **no caller** — sign-up runs
before step 3. Delete it if a later slice decides sign-up never carries one.

## Realizes
- [[feat-classes-progress]] — the school is collected on the same sign-up step as the classes

## Depends on
- [[mod-be-teacher-store]] — the row it writes

## Related
- [[cmp-be-auth-api]] · [[cmp-fe-signup-classes]]
