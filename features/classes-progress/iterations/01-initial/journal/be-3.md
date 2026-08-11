# be-3 — journal · subjects adopt `classId` without losing the past

Implementer: `be` stack agent. Lane slot 8 (`be` :9800, log `/tmp/teacher-backend.s8.log`).
Budget: 10 iterations. **Used: —** (in progress)

---

## Pre-flight (runtime gate) — PASS

Re-ran the sub-issue's Ground-truth commands against the live lane before writing a line.

| probe | recorded | observed 2026-08-11 | verdict |
|---|---|---|---|
| `db.subjects.countDocuments({classId:{$exists:true}})` | `0` of `8423` | `0` of `8423` | match |
| plant `classId` in Mongo → `GET /api/subjects/:id` | field does not appear | keys `correlationId costUsd createdAt durationMs genCorrelationId id subject updatedAt` — **no `classId`** | match |
| same plant → `GET /api/subjects` (list) | field does not appear | keys `costUsd createdAt durationMs exerciseCount genCorrelationId id title totalPoints updatedAt` — **no `classId`** | match |
| `explain("executionStats")` on `{teacherId}` sort `updatedAt:-1` | `IXSCAN teacherId_1_updatedAt_-1`, keys 1 / docs 1 | `FETCH ← IXSCAN teacherId_1_updatedAt_-1`, keys 1 / docs 1 / returned 1 | match |
| `/api` index | grew by be-1 and be-2 | `/health /api/skills /api/generate /api/teacher /api/subjects /api/exams /api/classes /api/progress /api/auth/{signup,signin,recover}` | nothing vanished |

The planted subject and its minted teacher were removed after the read; the collection is
back to `0` of `8423`.

The plant/read probe is the whole reason this sub-issue is safe to land before `fe`: the
projections are field-explicit whitelists, so a stored `classId` is invisible on the wire
until the key is deliberately added. That is the compat proof, and it is also the thing
that makes the *first* wire change auditable — exactly one key appears, and the perimeter
differential below can be a set difference rather than an argument.

Sub-issue is loop-ready. Proceeding.
