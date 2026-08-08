---
kind: sub-issue
id: contract-a-b
parent: m1                  # transversal → hangs off the milestone (or a specific issue)
stack: contract
status: todo                # rolls up to its parent
depends_on: []
estimate: S
---

# Contract: <Service A> ↔ <Service B>

> The wire agreement between two stacks. Personal-only (all schema detail stays
> here). It BLOCKS the per-stack implementation sub-issues on both sides — they
> can't proceed until this is agreed. If you want the work visible on the board,
> surface it as a short **foundation issue** ("Implement <A>→<B> contract") and
> keep this file as its sub-issue. Machine-readable schema lives beside this file
> as `a-b.schema.{yaml,json}`.

## Boundary
- **Producer:** <service> (`repo/path`)
- **Consumer:** <service> (`repo/path`)
- **Transport:** REST / SSE / WebSocket / Redis stream / internal HTTP
- **Auth:** e.g. `X-Internal-Auth: API_KEY_TAP`

## Interface
| Method / channel | Path / key | Purpose |
|------------------|-----------|---------|
| `POST` | `/api/...` | |

Request / response / event shapes → see `a-b.schema.yaml`. Summarize here:

```
→ request   { ... }
← response  { ... }
~ events    token | source | done   (for streaming boundaries)
```

### Current shape (recorded, not assumed)
> For an EXISTING surface, paste the real payloads captured by running the code
> headless (see the producer/consumer stack's "Run headless" recipe). The delta
> between this and the target shape above is exactly what the compat checklist guards.

```
→ actual request   { ... }        # captured <date> from <how>
← actual response  { ... }
```

## Error contract
| Code | Meaning | Consumer handling |
|------|---------|-------------------|
| | | |

## Backward-compat checklist (RULE — must pass to ship)
- [ ] Additive only — no field removed or renamed on an existing surface
- [ ] New fields optional with safe defaults; old clients unaffected
- [ ] Breaking change? → new versioned path (`/v2/...`), old kept working
- [ ] Existing consumers flagged in `SEED.md` (risks & backward-compat) verified unaffected
- [ ] Characterization test pins the pre-change shape of this surface

## Open decisions
- [ ]
