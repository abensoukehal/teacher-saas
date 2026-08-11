---
kind: component
id: cmp-be-programme-api
title: "Programme endpoint"
plane: implementation
part_of: mod-be-programme-corpus
realizes: [feat-programme-surface]
depends_on: [mod-be-programme-corpus, mod-be-class-store]
repos: [teacher-be@65603d6]
source: [teacher-be/src/routes/programme.ts, teacher-be/src/store/programmes.ts]
status: fresh
last_verified: 2026-08-11
tags: [backend, api, programme, caching]
---

# Programme endpoint

> One read route, and it is addressed **by class** — never by stream and never by docKey.

## Surface

`GET /api/classes/:classId/programme` → `200 {programme, correlationId}`

`programme` is the whole projected document — the eight-key whitelist
[[mod-be-programme-corpus]] owns. Maths is 49,673 bytes of it; lettres is 14,969.

**Why by class.** The URL carries only the thing the client legitimately has. `fe` never
holds a stream→programme mapping, so it cannot drift from the corpus the way the hardcoded
stream list in `lib/classdraft.ts` demonstrably can. Splitting it per week was rejected: it
saves 36 KB on the week card only, costs a second contract, and the tracker pulls the whole
year anyway.

**Behind `requireTeacher`, on the prefix.** Not to protect the corpus — a public ministry
document — but the **id space**: an unguarded route would answer "is this class real?" to a
caller holding no credential. Recorded honestly: this guard is an *equivalent mutant*.
Deleting it changes nothing observable, because the classes router's own prefix guard
already covers this path. It stays as defence against a mount reordering, but no oracle can
kill it, so its survival is not coverage.

## What it refuses

| | |
|---|---|
| `401 teacher_required` | no id, or an id this server never issued |
| `404 class_not_found` «القسم غير موجود» | absent, another teacher's, malformed, or the uppercase spelling of the caller's own class — one body for all four |
| `503 store_unavailable` | the datastore is down. Retryable, and still English on the wire — the known foreign family |
| `500` | a stored class whose stream resolves to no programme. Our broken invariant, not the caller's mistake — class creation makes it unreachable, so reaching it means the corpus moved under a stored class |

The id shape is checked with `/^[0-9a-f]{24}$/` **before** the store, because
`ObjectId.isValid` accepts uppercase and would otherwise resolve a real class through a
spelling this product does not use.

**The 404 guard is replicated, not imported.** `routes/progress.ts` was read-only in this
slice and its `resolve()` returns a progress-shaped pair this route has no use for. So the
duplication is deliberate — and the cost of a deliberate duplication is that something must
stop it drifting: the oracle compares the raw response **text** of both routes across every
probe variant. A one-byte mutant in the message turns it red.

## The 304 is this route's own

Express's default ETag could never have worked here, for two independent reasons, and both
were found by the clause that asked for a 304.

1. **The default tag is computed over a nonce.** It hashes the response *body*, and the body
   is `{programme, correlationId}` with a fresh uuid per request. Two consecutive reads of an
   unchanged corpus produced two different tags. The baseline recording that promised a 304
   was taken against `/api/skills`, whose body carries no envelope — so it generalised to a
   route shape it was never measured on. **`GET /api/progress/:classId` still cannot 304 for
   the same reason**, and that is recorded as a decision rather than discovered later.
2. **`fetch` defeats it by construction.** Per the Fetch standard, setting `If-None-Match` by
   hand forces the request's cache mode to no-store, which appends `Cache-Control: no-cache`
   — and Express's `fresh` declines to revalidate whenever a request carries it. Measured on
   the lane: curl got 304 and Node's `fetch` got 200 for the same two requests. `fe` is a
   browser fetch client, so "the 304 makes a refetch near-free" was true of nothing it could
   actually do.

So the tag is a weak validator computed over the **projection alone**, and the precondition
is evaluated in the handler — `If-None-Match` is a list and its comparison is weak, so `W/"x"`,
`"x"` and `*` all match. That is what the spec asks of an origin server: a matching
`If-None-Match` on a GET must answer 304, and request-side `no-cache` is a directive to
intermediary *caches*, asking for validation against the origin — which a 304 from the origin
is. Verified live for curl and fetch alike, zero-byte body.

**And it is not a cache.** The `findOne` still runs on every request. An in-process memo would
serve a stale corpus across a re-transcription, because the loader writes out of band with no
signal to a running service. Here a reloaded corpus changes the projection, changes the tag,
and invalidates every client. Compression is parked until a deploy target exists — 39 KB
gzips to 9.5 KB, but the middleware would touch every response including the ~110 s
generation ones.

## It logs nothing

Deliberate, and pinned as an absence. A programme read is a cache-friendly read of a public
document; a mutation-style line here would be noise, and noise in the mutation log is how a
real `cas_loss` stops being noticed. The generic request line and the correlation id are the
whole story.

## The `/api` index grew by exactly one

11 entries to 12. **Five clauses across five suites** in the unpromoted `classes-progress`
net pin that count, not the one the plan named — so the amendment is due at promotion of that
net, and it is five files, not one. This slice's own gate is unaffected.

## Realizes
- [[feat-programme-surface]] — the corpus becomes visible

## Depends on
- [[mod-be-programme-corpus]] — the stream reader and the whitelist projection
- [[mod-be-class-store]] — `getOwned`, which is what makes the 404 the same everywhere

## Related
- [[cmp-be-progress-api]] · [[cmp-be-classes-api]] · [[svc-teacher-be]]
