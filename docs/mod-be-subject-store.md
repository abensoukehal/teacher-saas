---
kind: module
id: mod-be-subject-store
title: "Subject store"
plane: implementation
part_of: svc-teacher-be
repos: [teacher-be@7b13f12]
source: [teacher-be/src/store/client.ts, teacher-be/src/store/subjects.ts, teacher-be/src/store/revisions.ts]
status: fresh
last_verified: 2026-08-11
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
{ _id, teacherId, subject, controls, classId?, rev?, genCorrelationId, costUsd,
  durationMs, createdAt, updatedAt }
```

`subject` nests the generated payload **verbatim** — title, meta, and the
`exercises[]` array with its stable `ex1…exN` ids. The stored shape and the wire
shape are the same object, so there is no mapping layer that can drift, and Arabic
and LaTeX round-trip byte-identically.

One index, `{ teacherId: 1, updatedAt: -1 }`, because the product makes exactly one
query: this teacher's subjects, newest first.

## A subject may name a class, and absent means *all of them*

A subject can carry an optional root-level `classId` — the 24-hex id of one of the
teacher's classes. It sits at the root and not inside `subject`, because that field nests
the generated payload verbatim and a routing fact this service invented has no business
riding inside it. `create` **spreads it in**, so a subject made without one has the same
on-disk shape as the thousands that predate classes.

It is read only through **`classOf`, an allow-list**, never `?? null`. Only a non-empty
string is a class; absent, null, a number, an object, an array, a boolean and `""` all
degrade to **legacy**.

**Legacy does not mean "belongs to no class". It means "belongs to all of them"**, because
it was written before the question existed. So a class's list is its own documents *plus*
everything from before classes existed — never a strict partition. The failure this shape
exists to make unrepresentable is a bare equality filter dropping every legacy subject out
of every teacher's view the moment they select a class: the key sets stay perfect and the
list comes back empty. Checked against the heaviest real teacher in the store — twelve
subjects, none tagged — where an unfiltered list and a bogus-class-filtered one both returned
all twelve. Same discipline as `statusOf`, and for the same reason — this is the
`roleOf` absent-reads-as-admin bug class, which once survived a green gate.

**The filter runs in memory, through `classOf`.** The stored query is unchanged —
`find({teacherId}).sort({updatedAt: -1})`, still one `IXSCAN` on the same index — and the
definition of "legacy" exists in exactly one place, so it cannot drift between a Mongo
predicate and a projection.

A subject's `classId` cannot be changed after creation: there is no route for it. `classOf`
does not verify that the stored class still exists.

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
- [[mod-be-class-store]] — what a `classId` points at
- [[svc-teacher-be]]
