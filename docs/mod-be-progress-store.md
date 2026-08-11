---
kind: module
id: mod-be-progress-store
title: "Progress store"
plane: implementation
part_of: svc-teacher-be
repos: [teacher-be@7b13f12]
source: [teacher-be/src/store/progress.ts, teacher-be/src/store/programmes.ts]
status: fresh
last_verified: 2026-08-11
tags: [backend, mongodb, programme, concurrency]
---

# Progress store

> Where a class has reached in the official programme. One document per class.

## Shape

```
progress
  classId                     string · 24 hex   ← THE key. Progress belongs to a class.
  teacherId                   string · 32 hex   ← denormalised: ownership scoped IN the query
  markedWeek                  int               ← 0 = not started; upper bound is the
                                                  class's OWN programme totals.weeks
  entries                     [ { week, status, note?, completedAt? } ]
                                ↑ week 1-based · status ∈ planned|done|skipped (allow-list)
                                ↑ completedAt stamped by the SERVER, only for `done`
  rev                         int               ← the compare-and-set token; the insert
                                                  writes 1, so no stored doc carries 0
  programmeDocKey             string            ← IDENTITY, stamped once
  programmeEdition            string            ← IDENTITY, stamped once
  programmeTranscriptionRev   int               ← PROVENANCE only, never compared
  createdAt · updatedAt       Date

indexes: { classId: 1 } UNIQUE · { teacherId: 1 }
```

`{classId: 1}` unique is not merely a lookup index — it is the tiebreak that makes two
concurrent *first* writes safe. Both carry `rev: 0`, neither can see the other, and the CAS
filter has nothing to compare against yet; the unique index turns the loser's insert into a
duplicate key, which becomes the same 409 a later CAS loss gets. `{teacherId: 1}` is for
the operator, not the product.

## The document is lazy

A class is created by one insert into `classes` and nothing else — there is no
cross-collection two-step that can half-fail. A class with no progress document is not an
incomplete state, it **is** "not started", which is the state every class is in on the day
it is made. So the read synthesizes `{markedWeek: 0, entries: [], rev: 0}` with the four
identity/`updatedAt` fields null, and the first successful write inserts.

The synthesized record has **the same key set** as a stored one. A shape that gained keys
after the first write would make the client branch on which of two shapes it got, and the
branch it forgot would be the empty one.

## The write is one atomic operation, and there is no retry

The compare-and-set, the entry upsert, the identity stamp and the lazy insert are a single
aggregation-pipeline update. Read-modify-write would open a window between "read rev" and
"write rev + 1" — precisely the interleaving the CAS exists to refuse — so the comparison
has to be the filter of the write itself.

Two shapes, because `rev: 0` means two different things:

| caller says | upsert | why |
|---|---|---|
| `rev === 0` | **on** | "I believe there is no document". No stored doc carries rev 0, so the filter cannot match; it inserts, or hits the unique index and that duplicate key *is* a CAS loss |
| `rev >= 1` | **off** | with upsert on, a caller naming a rev for a class with no document would have that rev seeded into a conjured document. Matched zero is a conflict, full stop |

**And nothing is retried.** `replaceExercise` re-reads and retries five times and is right
to — a refine merges one exercise into whatever the latest document is, so the intent
survives a rebase. A progress write is whole-state intent about what the teacher was
*looking at*: if `rev` moved, the view they decided from is gone and only they can decide
again. A server retrying here would overwrite someone else's position with a decision made
about a different one. Measured cost of a write: 4–13 ms, which is also why `inflight.ts`
is not involved — that guards ~110-second agent loops from duplicate work.

## Things that must not be undone

1. **The programme identity is `$ifNull`-stamped, never rewritten.** A later write can
   never re-point a class at another programme; re-pointing is a future, explicit surface
   and not a side effect of recording a week.
2. **The two version axes stay apart.** `edition` is the ministry revising the programme;
   `transcriptionRev` is us fixing our own reading of an unchanged page. Nothing compares
   on `transcriptionRev`, and it rides the wire only so the key set never changes.
3. **`entries` is upserted BY WEEK** — drop any row for this week, append the new one —
   never rebuilt from the request. A skipped week's note has to survive every later write.
4. **`entries` is embedded, unlike `exercise_revisions`.** It is bounded at one row per
   programme week and every read of a position wants it. Revisions are unbounded and wanted
   by almost nobody. Same reasoning, opposite answer, because the shapes are opposite.
5. **Entries come out week-ASCENDING** whatever order they were written in, so no client
   sorts and two clients never disagree about the order of the same data.

## The stream reader

`getProgrammeForStream(db, stream)` — `findOne({streams, current: true})` over the
`{streams: 1, current: 1}` index that already existed and had no reader. It is what
validates a stream at class creation, what bounds a week at write time, and what tells the
client the picker's range. Six streams resolve onto five documents; the lettres document
carries two.

## Components
- [[cmp-be-progress-api]] — the HTTP surface over this module
- [[cmp-be-mutation-log]] — the line a lost compare-and-set leaves behind

## Features it serves
- [[feat-classes-progress]] — where each class has reached

## Related
- [[mod-be-class-store]] · [[svc-teacher-be]]
