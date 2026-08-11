---
kind: component
id: cmp-be-mutation-log
title: "Class and progress mutation log"
plane: implementation
part_of: mod-be-progress-store
realizes: [feat-classes-progress]
depends_on: []
repos: [teacher-be@7b13f12]
source: [teacher-be/src/mutationlog.ts]
status: fresh
last_verified: 2026-08-11
tags: [backend, observability]
---

# Class and progress mutation log

> One structured line per class or progress write. It exists because of a blind spot, not
> a preference.

Before it, nothing in this service logged a class or progress write — neither collection
existed — and the first thing built on top of them is a compare-and-set whose whole point
is that one of two concurrent writers **loses**. A loss that emits nothing is invisible: the
loser gets a 409 and an operator has no way to tell "the concurrency control worked" from
"a write vanished". So the line landed with the first mutation, before there was any
concurrency to get wrong.

## The lines

| `msg` / `event` | Written when | Carries |
|---|---|---|
| `class.created` | a class is accepted | `classId`, `correlationId`, `teacherIdPrefix` |
| `progress.write` | **every** position write attempt | `classId`, `week`, `rev`, `outcome: win \| cas_loss`, `correlationId`, `teacherIdPrefix` |

`teacher.school` is written inline by the auth router rather than through this module — its
`MutationEvent` union and required `classId` describe class and progress writes, and a
school write has no class.

## Details that are decisions

- **The teacher id is logged as an 8-character prefix, never whole**, and the caller hands
  over the *whole* id so this module does the slicing. A helper that took a pre-sliced string
  would put the decision back at every call site, which is where it eventually gets forgotten.
  A credential written into a log cannot be rotated out of wherever that log was shipped.
- **The key is `teacherIdPrefix`**, matching the six pre-existing call sites in `teacher.ts`
  and `routes/auth.ts`. It was `teacher` for two sub-issues; two names for one concept means
  an operator greps one and misses the other.
- **`msg` and `event` carry the same value, deliberately.** `msg` is what every other
  structured line here is discriminated by, so `tools/obs logs` and any human grep keep
  working; `event` is the field the fe↔be contract names.
- **Only accepted writes for classes, every attempt for progress.** A line on a rejected
  class create would make the log a record of intentions.

## Where it does not reach

The generic request logger writes URL **path segments**, and `GET /api/admin/teachers/<32hex>/subjects`
puts a full teacher id in the lane log. The mutation lines are clean; the log as a whole is
not, and `teacherId` is a bearer value.

## Realizes
- [[feat-classes-progress]] — the writes it makes visible

## Related
- [[cmp-be-progress-api]] · [[cmp-be-classes-api]] · [[mod-be-progress-store]]
