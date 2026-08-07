---
kind: module
id: mod-be-subject-store
title: "Subject store"
plane: implementation
part_of: svc-teacher-be
repos: [teacher-be@2c56bef]
source: [teacher-be/src/store/client.ts, teacher-be/src/store/subjects.ts]
status: fresh
last_verified: 2026-08-08
tags: [backend, mongodb, persistence]
---

# Subject store

> Where a teacher's exams live. One collection, and one rule that shapes it.

## The rule

**Creating a subject inserts. There is no upsert and no fixed key.** Before this
existed the frontend held every exam under one `localStorage` key, so a teacher's
second exam destroyed their first — silently, with no history. Making the store
insert-only is what makes that unrepresentable rather than merely guarded against.

There is also **no delete**. Nothing generated is thrown away; that is what makes a
searchable exercise library cheap to add later.

## Shape

Database `teacher_saas` (the name is reserved in `project/services.sh` because this
machine shares its MongoDB with another product). One collection, `subjects`:

```
{ _id, teacherId, subject, controls, createdAt, updatedAt }
```

`subject` nests the generated payload **verbatim** — title, meta, and the
`exercises[]` array with its stable `ex1…exN` ids. The stored shape and the wire
shape are the same object, so there is no mapping layer that can drift, and Arabic
and LaTeX round-trip byte-identically.

One index, `{ teacherId: 1, updatedAt: -1 }`, because the product makes exactly one
query: this teacher's subjects, newest first.

## Behaviour worth knowing

- **Ownership is scoped inside the query**, not checked after the fetch. Another
  teacher's subject returns the same not-found result as one that never existed, so
  existence is not probeable.
- **An exercise is replaced in place, by id.** An unknown id raises rather than
  appending — the frontend it took over from already threw instead of merging, and
  the server must not be laxer than the client it replaced.
- **A failed connection is not cached.** The connect is lazy and single-flight, but a
  rejected attempt is discarded so one blip cannot leave the process permanently
  unable to reach a database that has since recovered.

## Related
- [[cmp-be-subjects-api]] — the HTTP surface over this module
- [[svc-teacher-be]]
