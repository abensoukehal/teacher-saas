# Flows — the core loop

> Sequences across the boundary. Shapes: [`exam.schema.yaml`](exam.schema.yaml).
> Terms: [`fe-be.contract.md`](fe-be.contract.md).

## Flow A — draft an exam

```
teacher            fe                       be                        claude CLI
   │                │                        │                             │
   │─ set controls ─▶│                        │                             │
   │─ توليد الموضوع ─▶│                        │                             │
   │                │─ POST /api/generate ───▶│                             │
   │                │   {skill:"exam-subject" │                             │
   │                │    input:{controls}}    │─ spawn, cwd=agent/ ────────▶│
   │                │                        │   /exam-subject {json}       │
   │                │◀── progress (local) ────│                        reads │
   │                │   elapsed, cancel       │                   curriculum/│
   │                │                        │                     if needed │
   │                │                        │◀──── one JSON object ────────│
   │                │◀── 200 {data,…} ───────│   114–133 s                   │
   │◀─ exam renders ─│  KaTeX per exercise    │                             │
```

**Not a stream.** `be` returns once, after 114–133 s. Progress in `fe` is
therefore **local elapsed time**, not server-reported percentage — do not invent a
progress signal the backend does not send.

**Cancel** is client-side: abort the fetch and drop the result. The CLI run
continues to completion server-side (`runner.ts` has no cancellation path). That
is acceptable for the MVP and must not be described to the teacher as "stopped
the work".

**Reload survival**: the request outlives a page reload only if the draft is
recoverable. No datastore exists (SEED §6), so the client holds it — persist the
in-flight request and the last good draft locally, and reconcile on load.

## Flow B — refine ONE exercise (the product)

```
teacher            fe                                 be              claude CLI
   │                │                                  │                   │
   │─ pick ex2 ─────▶│                                  │                   │
   │─ "صعّبه شوية" ──▶│                                  │                   │
   │                │─ POST /api/generate ────────────▶│                   │
   │                │   {skill:"refine-exercise",       │                   │
   │                │    input:{instruction,            │─ spawn ──────────▶│
   │                │           exercise:<ex2 verbatim>,│  /refine-exercise │
   │                │           examContext:{…,         │                   │
   │                │             otherExercises:[…]}}} │◀── one Exercise ──│
   │                │◀── 200 {data:Exercise} ──────────│   47–48 s          │
   │                │  splice by data.id === "ex2"     │                   │
   │◀─ only ex2 moved│  ex1, ex3 untouched              │                   │
```

**`fe` assembles the request.** `be` is a pass-through — it does not know what an
exam is. `fe` sends the exercise **verbatim** plus `examContext.otherExercises`
(id · topics · difficulty only), which is how the refine avoids duplicating a
technique already used elsewhere in the paper.

**Splice by `id`, never by index.** The returned `id` equals the sent `id`; that is
the join. Reject a response whose `id` differs — it is a contract violation, not a
recoverable state.

**No session.** `sessionId` is not sent. `refine-exercise` carries everything it
needs inline, which is why the loop needs no server-side persistence in this
iteration (SEED kit §6, H4).

**Repeatable.** This is the most-repeated action in the product — a teacher may
refine the same exercise several times. Each call is independent and re-sends the
*current* exercise, so refinements compose naturally.

## Flow C — print

```
teacher ─ اطبع ─▶ fe ─ standalone printable route ─▶ browser print → PDF
```

No backend call. Renders the exam already in hand: title, `meta` (stream, duration,
points), then each exercise with its label, points and KaTeX-rendered statement.
`meta.assumptions` is **not** printed — it is guidance for the teacher, not part of
the paper the students receive.

## Failure paths (all flows)

| condition | fe behaviour |
|---|---|
| `503 claude_auth` | not retryable — say the service needs re-authentication; keep the current draft |
| `504 claude_timeout` | offer retry; keep the draft |
| `502 claude_exit` | offer retry; show `error.detail` and `correlationId` |
| `200` with `data: null` | treat as failure, not an empty exam |
| refine returns a different `id` | reject; do not splice |
| network abort (user cancel) | drop silently, restore prior state |

In **every** failure the existing draft survives. Losing a teacher's exam because
one refine failed would be the worst outcome in the product.
