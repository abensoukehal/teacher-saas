# Contract — `fe` ↔ `be`

> **New contract, not a change.** SEED kit §3: nothing consumes `be`'s API today,
> so there is no backward-compatibility constraint and no consumer to keep
> bit-stable. The binding constraint is that `../recordings/` keeps reproducing.
>
> Shapes: [`exam.schema.yaml`](exam.schema.yaml). Sequences: [`flows.md`](flows.md).

## Surfaces

| method | path | owner | consumer |
|---|---|---|---|
| `GET` | `/api/skills` | be | fe |
| `POST` | `/api/generate` | be | fe |
| `GET` | `/health` | be | fe (degraded-mode banner only) |

`fe` calls these **relative** (`/api/…`); the Vite dev server proxies to the
backend **lane** (`teacher-fe/vite.config.ts:26`). An absolute backend URL in
frontend code is a defect — it makes a job lane talk to the main checkout.

## `POST /api/generate` — the only generation surface

Both product actions go through this one route; `skill` selects which.

### Draft an exam — `skill: "exam-subject"`

```jsonc
{ "skill": "exam-subject",
  "input": { "stream": "شعبة الرياضيات", "level": "3AS",
             "topic": "الأعداد المركبة", "difficulty": "متوسط",
             "exerciseCount": 3, "durationMinutes": 90,
             "format": "devoir", "note": "optional free text" } }
```

→ `data` is an **ExamSubject**. Recorded: `../recordings/gen1.json`, `gen2.json`.

### Refine ONE exercise — `skill: "refine-exercise"`

```jsonc
{ "skill": "refine-exercise",
  "input": { "instruction": "صعّبه شوية",
             "exercise": { /* the whole Exercise object, verbatim */ },
             "examContext": { "stream": "…", "level": "…", "topic": "…",
                              "durationMinutes": 90,
                              "otherExercises": [ { "id": "ex1", "topics": [], "difficulty": "سهل" } ] } } }
```

→ `data` is a **single Exercise**. Recorded: `../recordings/refine1.json`.

## The invariants this contract exists to protect

1. **`id` is the join key.** `refine-exercise` returns the same `id`; `fe` swaps
   that exercise back into its slot by id, never by array index.
2. **`id`, `points` and `label` survive a refine, byte-identical.** Points are what
   keep Σ == `meta.totalPoints`; a silent change surfaces only when the teacher
   prints. Verified in `refine1.json`.
3. **The exam is per-exercise, never one blob.** This is what makes the core loop
   possible; a change that flattens `exercises[]` breaks the product, not a feature.
4. **`meta.assumptions` must reach the teacher.** It carries refusals — a topic
   that was off-programme and was substituted (`gen3-curriculum-gap.json`). Dropping
   it silently misleads.
5. **LaTeX never surfaces.** `statement` carries `$…$` for KaTeX. It is rendered
   before display and never appears in an input, placeholder, error or export.

## Timing — this is a contract term, not a quality-of-service note

Measured across 8 runs (SEED kit §2 + seal re-verification):

| action | wall time | 
|---|---|
| `exam-subject` | **114–133 s** |
| `refine-exercise` | **47–48 s** |

`fe` MUST treat a generate call as minute-scale: progress, cancel, and surviving a
reload. A plain spinner is a contract violation in practice.

`be` bounds a run at `CLAUDE_TIMEOUT_MS` (default **300 000**) and queues beyond
`CLAUDE_MAX_CONCURRENT` (default **3**) — so a request may sit queued before it
starts. `GET /health` exposes `claude.active` / `queued` / `max`.

## Errors — `fe` must distinguish these, they need different user actions

| status | `error.type` | what the teacher should be told |
|---|---|---|
| 503 | `claude_auth` | not retryable — the service needs re-authentication |
| 503 | `claude_not_installed` | not retryable — misconfiguration |
| 504 | `claude_timeout` | retryable |
| 502 | `claude_exit` | retryable; surface `error.detail` |
| 400 | `invalid_request` | a bug in `fe` — unknown skill or empty input |

`data` may be `null` on a 200 when the run returned prose instead of JSON. `fe`
must treat that as a failed generation, not an empty exam.

Every response carries `correlationId`, echoed from an inbound `x-correlation-id`
or generated. `fe` should display it on error — it is what `tools/obs trace <id>`
follows.

## `GET /api/skills`

```json
{ "skills": [ { "name": "exam-subject", "description": "…" },
              { "name": "refine-exercise", "description": "…" } ] }
```

Read from `agent/.claude/skills/` at request time. `fe` does not need it for the
MVP loop (both skill names are known); it exists so a new capability becomes
visible without a code change.
