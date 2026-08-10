# Flows — end-to-end sequence(s)

> How a user action travels across the stacks. One sequence per user-facing flow.
> Keep it aligned with the per-boundary contract files.

## Flow: <name>

```
User → FE            <action>
FE   → BE            POST /api/...            (contract: fe-be)
BE   → SVC-C         POST /api/v1/...         (contract: be-svcc)
SVC-C → stream       <async channel>
BE   ← Redis (SSE)   progress events
BE   → SVC-AI        POST /api/v2/...         (contract: be-ai)
BE   → FE            SSE: token | source | done
FE                   render
```

### Notes / failure paths
- Timeout at <hop>: <behavior>
- Cancellation: <how it propagates>
- Backward-compat: this flow must keep working for existing <consumer> with no client change.
