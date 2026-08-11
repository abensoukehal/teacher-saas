# Flows — the programme surface (slice 2)

> How a user action travels across the stacks. Aligned with
> `fe-be-programme.contract.md` (§ refs below); slice 1's contract stays in force for
> the progress writes. All calls are relative `/api/...` through the Vite proxy; every
> request carries `x-teacher-id` (`api.ts:345`, the single place it is set) and every
> response echoes `correlationId`.

## Flow 1: open the tracker («البرنامج»)

```
Teacher → FE       has a class selected; taps «البرنامج» in the nav row
FE                 view state → tracker; location.hash → #/programme (contract §0)
FE      → BE       GET /api/classes/:classId/programme        (contract §1 — once per
                                                               class per session; 304
                                                               via default ETag after)
FE      → BE       GET /api/progress/:classId                 (slice 1 §4 — the position,
                                                               entries, rev, and the
                                                               picker's bound totalWeeks)
BE                 requireTeacher → resolve ownership (getOwned inside the query) →
                   getProgrammeForStream({streams: class.stream, current: true}) →
                   toProgrammeRecord (the §2 whitelist). No mutation log — a read (§1)
BE      → FE       200 {programme: {…38 KB…}, correlationId}
FE                 derives unit RUNS from weeks[] (§4) → the pinned segmented bar;
                   renders 27 week bands — non-current weeks COLLAPSED to one summary
                   line, the current week expanded; scrolls the marked week into view
                   on mount (the full tracker is ~8,060 px ≈ 9 screens — collapse and
                   scroll are load-bearing, not polish)
```

Failure paths:
- programme GET fails retryably (`store_unavailable`) → Arabic retry state for the
  screen; the nav selection stands.
- `404 class_not_found` → this class is gone from this session: refetch the class
  list, drop the selection (slice 1's idiom).
- no class selected (hash deep-link) → the explicit «اختر قسمًا» state pointing at the
  class bar — never an error, never an auto-selection (contract §0).

## Flow 2: mark a week done — the bar and the rail follow

Current position W, read `rev` in hand. Same flow for «أنهيت هذا الأسبوع ✓» on the
week card — one write shape (contract §0, §5).

```
Teacher → FE       taps «تمّ ✓» on the current row (or «تخطٍّ ↷» — same flow,
                   entry.status "skipped")
FE                 the row's controls disable for the beat
FE      → BE       PUT /api/progress/:classId
                     {rev, markedWeek: min(W+1, totalWeeks), entry: {week: W, status: "done"}}
BE                 CAS on rev — one atomic update; entry upserted BY WEEK; completedAt
                   stamped server-side (slice 1 §4)
BE                 log progress.write {outcome: "win", classId, week, rev, correlationId}
BE      → FE       200 {progress: {…, markedWeek: W+1, rev: rev+1}}   (no programme —
                   the ceiling belongs to the read, not the write)
FE                 the row W re-renders «منجز»; the band at W+1 becomes the current
                   row (expands, gains the actions); the pinned bar's fill advances —
                   re-derived from the held programme, no refetch (§4, §5);
                   the class bar rail follows (markedWeek/totalWeeks, slice 1);
                   the week card, if visited next, shows week W+1
```

Failure paths:
- **`409 conflict`** — the position moved in another tab/device. BE logs
  `outcome: "cas_loss"`. FE re-runs the GET and **re-asks AT THE ROW** (contract §7):
  the losing row shows the fresh position in Arabic and offers the action again; no
  global banner, no auto-resubmit, other rows untouched. The tracker makes many small
  PUTs where slice 1 made one — this path is normal operation, not an edge.
- `503 store_unavailable` → retryable Arabic message at the row; the tap is not lost
  silently.
- `400 invalid_request` — unreachable from a bounded UI; if it arrives, Arabic error
  at the row, nothing advances.

## Flow 3: re-position — «وصلنا هنا» on any row

At `markedWeek: 0` every row offers it (there is no current row yet); positioned, every
non-current row does (contract §0).

```
Teacher → FE       taps «وصلنا هنا» on row N
FE      → BE       PUT /api/progress/:classId {rev, markedWeek: N}   — no entry;
                   slice 1's setter write, byte-identical
BE      → FE       200 {progress: {…, markedWeek: N, rev: rev+1}}
FE                 row N becomes the current band; bar fill re-derives; rail follows.
                   Entries are UNTOUCHED — a skipped week's note survives (slice 1 §4)
```

Failure paths: as Flow 2 (409 at the row; the first-ever write carries `rev: 0`).

## Backward-compat rails (every flow)

- A teacher with **no classes** never enters any flow here: no nav row, no programme
  fetch, shell byte-identical to today (contract §8.7).
- `#/admin` is untouched — early return before the shell, no nav, no bar.
- `teacher_required` on any call → the existing rejected-identity path
  (`dropRejectedIdentity`), unchanged.
- `pendingSave` survives everything, as ever (slice 1 §7.8).
