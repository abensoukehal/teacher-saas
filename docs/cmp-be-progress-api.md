---
kind: component
id: cmp-be-progress-api
title: "Progress endpoints"
plane: implementation
part_of: mod-be-progress-store
realizes: [feat-classes-progress]
depends_on: [mod-be-progress-store, mod-be-class-store, cmp-be-mutation-log]
repos: [teacher-be@7b13f12]
source: [teacher-be/src/routes/progress.ts]
status: fresh
last_verified: 2026-08-11
tags: [backend, api, programme, concurrency]
---

# Progress endpoints

> One asymmetry, stated up front: the read answers for a class nobody has written to, and
> the write refuses the moment its view is stale.

## Surface

`GET /api/progress/:classId` → `200`

```
{ progress: { classId, markedWeek, entries[], rev,
              programmeDocKey, programmeEdition, programmeTranscriptionRev, updatedAt },
  programme: { docKey, edition, totalWeeks },
  correlationId }
```

`progress` is the stored document or the synthesized empty one — the same eight keys either
way. `programme` is resolved **live from that class's own stream on every read**, and is
deliberately not the same thing as the document's stamped identity: this says what the class
is studying now (and is where the week picker's ceiling comes from), that says which
programme the position was recorded against.

`PUT /api/progress/:classId` with `{rev, markedWeek, entry?}` → `200 {progress, correlationId}`.
**The response carries no `programme` key**, so a client has to keep the ceiling it read.

## What it refuses

| | |
|---|---|
| `409 conflict` «تغيّر تقدّم القسم أثناء الحفظ» | the compare-and-set lost. Immediate, no server retry |
| `400` «رقم النسخة غير صالح» | `rev` missing, negative or not an integer |
| `400` «الأسبوع غير صالح» | `markedWeek` not an integer (`27.5`, `"8"`) |
| `400` «الأسبوع خارج المجال» | outside `0..totalWeeks`, or an entry week outside `1..totalWeeks` |
| `400` «الحالة غير معروفة» | a status outside the `planned·done·skipped` allow-list — uppercase `DONE` included, because it is an allow-list and not a case fold |
| `400` «الملاحظة طويلة جدًا» / «بيانات الأسبوع غير صالحة» | note over 500 characters / an unknown key on `entry` |
| `404 class_not_found` «القسم غير موجود» | see below |
| `500` | a stored class whose stream stops resolving to a programme — our invariant, not the caller's mistake. Implemented, and untested: making it executable would mean mutating the corpus |

**Both required, both whole-state.** A progress write is intent, not a patch: an absent
`markedWeek` would have to mean "leave it", which is indistinguishable from a client that
forgot the field.

**Entries are 1-based while `markedWeek` is 0-based**, and that is not an inconsistency —
0 is "not started", and there is no week 0 to write a note about.

`completedAt` is accepted on `entry` and its value is **discarded**: it is a key the client
just read, so echoing it back must not be refused, but when something was finished is a fact
about this service's clock.

## One 404, byte for byte

Absent, another teacher's, malformed, twelve hex characters, or the uppercase spelling of the
caller's own class id — all answer the identical body. Distinguishing "bad shape" from "not
yours" would leak which ids are real, so a malformed id is a 404 here rather than the 400 it
looks like. The id shape is checked with `/^[0-9a-f]{24}$/` **before** the store, because
`ObjectId.isValid` accepts uppercase and would otherwise resolve a real class through a
spelling this product does not use.

The same body, same words and same status come from `POST /api/subjects` when its `classId`
does not resolve. Fifteen cells of that matrix (five id shapes × three surfaces) are pinned
byte-identical, masking only the correlation id.

## What a lost race leaves behind

Every attempt logs, win or loss — see [[cmp-be-mutation-log]]. A loss records the rev the
**caller** believed in, which is the useful half. Rejected writes (400/404) and every GET log
nothing, so the log is a record of what happened and not of what was attempted.

## Realizes
- [[feat-classes-progress]] — where each class has reached

## Depends on
- [[mod-be-progress-store]] — the CAS, the lazy insert and the stream reader
- [[mod-be-class-store]] — `getOwned`, which is what makes the 404 the same everywhere
- [[cmp-be-mutation-log]] — `progress.write`, one line per attempt

## Related
- [[cmp-be-classes-api]] · [[cmp-be-subjects-api]] · [[svc-teacher-be]]
