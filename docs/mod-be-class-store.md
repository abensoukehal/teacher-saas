---
kind: module
id: mod-be-class-store
title: "Class store"
plane: implementation
part_of: svc-teacher-be
repos: [teacher-be@7b13f12]
source: [teacher-be/src/store/classes.ts]
status: fresh
last_verified: 2026-08-11
tags: [backend, mongodb, classes]
---

# Class store

> The `classes` collection — the spine every later class-scoped surface hangs off.

## Shape

```
classes
  _id        ObjectId          ← the class id, 24 lowercase hex on the wire
  teacherId  string · 32 hex   ← the owner, denormalised
  name       string            ← trimmed, 1..80 characters
  stream     string            ← must resolve to a current programme document
  createdAt · updatedAt  Date

index: { teacherId: 1, createdAt: 1 }
```

Four keys go on the wire — `id`, `name`, `stream`, `createdAt` — built key by key by a
field-explicit `toRecord`, the same discipline the subject store keeps. `teacherId` never
leaves: it is a bearer credential, and the holder has already presented it.

## Its own collection, not an array on `teachers`

Both `progress.classId` and `subjects.classId` point at a class, and both have to answer
"is this class mine?" with a single `findOne({_id, teacherId})`. An array element has no
id a query can match, so validating one would mean reading the credential row and scanning
in application code — the post-hoc ownership check every store here refuses. The second
reason: `teachers` holds both scrypt hashes and is the row `requireAdmin` reads, and a
weekly class edit must not be a write against that document.

## Things that must not be undone

1. **`createdAt` ASCENDING is the read order, and it is a UI contract.** The tab order in
   the class bar is this order. Newest-first would reorder the bar under a teacher's finger
   every time they add a class.
2. **`getOwned` scopes ownership inside the query and returns `null` for a malformed id**
   rather than throwing. That is what lets three surfaces answer one byte-identical 404 to
   "absent", "not yours" and "not even an id".
3. **`create` refuses a class with no 32-hex owner.** The driver serialises `undefined` as
   `null`, so a route that ever forgot `requireTeacher` would insert a class owned by
   nobody — unreachable by its author and invisible to every scoped read.
4. **There is no delete, no update and no archive**, so there is no store function for one.
   The design has no remove affordance on any screen; inventing `archivedAt` would be
   speculation.

## Components
- [[cmp-be-classes-api]] — the HTTP surface over this module

## Features it serves
- [[feat-classes-progress]] — a teacher's classes

## Related
- [[mod-be-progress-store]] · [[svc-teacher-be]]
