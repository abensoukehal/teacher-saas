# qa-3 — a body we cannot parse is the caller's fault, and it must say so in Arabic

**Closed 2026-08-08.** Filed by QA as BUG-3; review had tracked the same thing as debt.

A malformed JSON body fell through `express.json` to the generic handler: `500
internal_error`, an **English** message on a product whose first hard constraint is
Arabic-only, and the wrong class besides. The auth contract's error table already said
malformed body → `400 invalid_request`.

Now `entity.parse.failed` → `400 invalid_request` and `entity.too.large` → `413
payload_too_large`, both Arabic.

**Found while fixing it:** the correlation-id middleware ran *after* the body parser, so a
parse failure produced a response with no `correlationId` at all — the one response a
caller most needs to trace was the one that could not be traced. It now runs first.

## review
**approve.** Two clauses (malformed → Arabic 400 with a correlationId; oversized → 413).
Mutation — stop classifying the parse failure — **caught**.
