# Flows — classes + progress (slice 1)

> How a user action travels across the stacks. Aligned with
> `fe-be-classes-progress.contract.md` (section refs below). All calls are relative
> `/api/...` through the Vite proxy; every request carries `x-teacher-id`
> (`api.ts:274-296`, the single place it is set) and every response echoes
> `correlationId`.

## Flow 1: create a class

Sign-up step 3 («أقسامك هذه السنة») or the account screen's «أقسامي» — same call.

```
Teacher → FE       enters name «3ر1» + picks stream, confirms
FE      → BE       POST /api/classes {name, stream}          (contract §3)
BE                 requireTeacher → validate name, resolve stream via
                   getProgrammeForStream ({streams, current:true} — contract §2)
BE      → mongo    insert classes {teacherId, name, stream}  (single insert — no
                   progress doc yet, contract §0 "lazy")
BE                 log class.created {classId, teacher-prefix, correlationId}
BE      → FE       201 {class:{id,name,stream,createdAt}, correlationId}
FE                 append to the class bar (createdAt asc — stable tab order);
                   sign-up step 3 also offers «أضف قسمًا آخر» as a normal action
```

Failure paths:
- unknown stream / empty name → `400 invalid_request` — Arabic inline message, input kept.
- `503 store_unavailable` → retryable, said so in Arabic; nothing was created.
- No partial state is possible: one insert, and progress does not exist until Flow 2.

## Flow 2: set a class's position («حدّد أين وصلت» / sign-up step 4)

```
Teacher → FE       opens the week-0 empty state «أين وصل هذا القسم؟» (or step 4)
FE      → BE       GET /api/progress/:classId                (contract §4)
BE      → mongo    findOne classes {_id, teacherId}  → 404 class_not_found if not owned
                   findOne progress {classId}        → absent
BE      → FE       200 {progress:{markedWeek:0, entries:[], rev:0, …null identity},
                        programme:{docKey, edition, totalWeeks}}
FE                 renders the picker bounded 0..programme.totalWeeks — the empty
                   state, never an error (contract §7.2). Step 4 offers
                   «تخطَّ الآن — يُضبط لاحقًا» per class (skip = no PUT at all).
Teacher → FE       picks week 8, confirms
FE      → BE       PUT /api/progress/:classId {rev:0, markedWeek:8}
BE                 CAS: rev matches (no doc, expected 0) → INSERT {rev:1,
                   markedWeek:8, programmeDocKey+Edition+TranscriptionRev stamped
                   from the live resolution — contract §1}
BE                 log progress.write {outcome:"win", classId, week, rev, correlationId}
BE      → FE       200 {progress:{…, rev:1}}
FE                 home for that class now shows the position; rail on its tab fills
```

Failure paths:
- **CAS loss** (`409 conflict` — another tab/device wrote first): BE logs
  `progress.write {outcome:"cas_loss"}` and does NOT retry (contract §0). FE re-runs
  the GET, shows the fresh position in Arabic, and lets the teacher re-decide. Never
  auto-resubmit.
- `404 class_not_found`: byte-identical body whether absent or another teacher's
  (contract §6). FE treats it as "this class is gone from this session" — refetch the
  class list.
- `400 invalid_request` (week out of the programme's own range): FE cannot normally
  produce it (the picker is bounded by `programme.totalWeeks`); if it arrives, show the
  retryable Arabic error, keep the picker open.
- `503 store_unavailable`: retryable message; the teacher's chosen week stays selected
  locally so retry is one tap.

## Flow 3: switch class in the UI

```
Teacher → FE       taps another class tab in the bar
FE                 TOTAL context switch (App.tsx:479-495 shape — contract §7.8):
                   clear exam, subjectId, refining, solutions, subjects
                   KEEP pendingSave (unsaved-exam intent survives the switch)
                   persist selection → localStorage teacher.class.v1
FE      → BE       GET /api/progress/:classId               (position + rail)
FE      → BE       GET /api/subjects?classId=<id>           (contract §5)
BE      → FE       the class's subjects PLUS every legacy (classId-less) subject —
                   legacy is never hidden as "another class's"
FE                 renders that class's home; week-0 class renders the empty state
```

Failure paths:
- Either GET failing retryably (`store_unavailable`) → Arabic retry state for that
  panel; the switch itself (tab selection, cleared context) stands.
- `teacher_required` on any call → the existing rejected-identity path, which now also
  drops `teacher.class.v1` (`dropRejectedIdentity`, App.tsx:317-324) — a rejected
  teacher must not resurrect a class selection that id owned.
- Backward-compat: a teacher with NO classes never enters this flow — no bar tabs, no
  `?classId=`, requests byte-identical to today (contract §0 legacy mode).
