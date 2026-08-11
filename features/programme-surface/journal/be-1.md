# journal — be-1 · the programme route

Lane slot 9 (be :9900, `CHAR_BE_URL=http://localhost:9900`, log `/tmp/teacher-backend.s9.log`).
Budget 10 iterations · **used 3**.

## Pre-flight (re-run, not trusted)

| command | expected | got |
|---|---|---|
| `curl -s -o /dev/null -w '%{http_code}' $CHAR_BE_URL/api/programmes` | `404` | **404** ✓ |
| `curl -s $CHAR_BE_URL/api \| jq '.routes \| length'` | 11 | **11** ✓ |
| `mongosh … tadarroj-3as-math` totals/units/weeks | `27 189 14 27` | **27 189 14 27** ✓ |

> **The sub-issue's Ground truth and SEED §2 both say the index holds 9 entries. It holds 11.**
> That recording predates slice 1's merge, which added `/api/classes` and `/api/progress`.
> Not a perimeter break — a stale number. The suite records **11** as its own slice-1
> baseline and asserts exactly one more.

Corpus facts re-measured before a line of the oracle was written, all confirmed:
row counts `103/97/81/59/39` · maths density `competencies 76 · contents 63 · guidance 55` ·
week 20 `7 rows / 7 competencies / 3 contents` · `weekNumberPrinted === week` in all 135
weeks · `unitId` null in 0 weeks · `emphasisLegend` present on all five documents ·
document-level `competencies` null on 2 (so the projection must be null-preserving).

## Oracle

`features/programme-surface/tests/be/programme.characterization.test.js` — 49 clauses,
black-box over `CHAR_BE_URL`, `describeIfLane` from `guard`, cleanup **by owner** in
`afterAll` (planted classes, their progress docs, minted teachers). Written and run BEFORE
any product code: **26 failed / 23 passed** — correct for a route that does not exist.
Frozen from that moment; never edited.

## Loop

### iteration 1 — build the slice → 48 / 49

- `toProgrammeRecord` **appended** to `src/store/programmes.ts` after `getProgrammeForStream`
  (`@@ -1058,0 +1059,122 @@` — the whole diff is one hunk past the end of the file, so
  nothing between `:396-750` and no existing function was touched).
- new `src/routes/programme.ts` — lowercase-hex check → `getOwned` → `getProgrammeForStream`
  → `toProgrammeRecord`, `requireTeacher` on the **prefix**, the 404 body replicated from
  `progress.ts` verbatim.
- `src/app.ts` — one index entry, one mount after `progressRouter()`.

Operational note: the lane runs `npx tsx src/index.ts` with **no `--watch`**
(`recipes.sh:55-62`), so a code edit is invisible to the suite until `tools/dev restart be`.
The first re-run of the suite after an edit is meaningless without it.

### iterations 2–3 — the ETag clause, which found two real defects

The only red was `If-None-Match` → `200` instead of `304`. It had **two independent
causes**, and neither was the oracle being wrong.

**Cause 1 — the validator was computed over a nonce.** Express's default ETag hashes the
response BODY, and the body is the envelope `{programme, correlationId}` with a fresh uuid
per request. Measured:

```
GET …/programme   ETag: W/"c24e-j1LfFSMilAtLrDUhZ89wyGH3Tk4"
GET …/programme   ETag: W/"c24e-8RG5dGcSyD0CNN3458aeFCKcBPk"   ← same length, different hash
GET /api/skills   ETag: W/"740-WhhpP2KkGsAmq1Hg1F/Bh0hgF7Y"    ← stable: no envelope
GET /api/skills   ETag: W/"740-WhhpP2KkGsAmq1Hg1F/Bh0hgF7Y"
```

SEED §2 recorded the 304 against **`/api/skills`**, whose body carries no correlationId;
contract §0 generalised that to a route shape it was never measured on. So no
envelope-carrying route in this service — including slice 1's `GET /api/progress/:classId` —
could ever have answered 304.

Fix: set the ETag explicitly over the **entity** (the projection), not the envelope. That is
the semantically right tag — the representation being cached is the programme; a correlation
id describes the delivery. A validator computed over a nonce is a validator that cannot
validate, the same defect `contentHash` is excluded from the projection for (§2). Tags went
stable, and **curl** started getting 304.

**Cause 2 — and the suite still failed, because `fetch` is not curl.** Isolated:

```
curl,           If-None-Match: <tag>                      → 304
node fetch,     If-None-Match: <tag>                      → 200
node fetch,     If-None-Match: <tag> + cache-control: ""   → 304   ← the discriminator
```

Per the **Fetch standard**, setting `If-None-Match` by hand forces the request's cache mode
to `no-store`, which appends `Pragma: no-cache` and `Cache-Control: no-cache`. Express's
`fresh` refuses to revalidate whenever the request carries that header. So **every** fetch
client — Node's and the browser's alike — defeats the default ETag path by construction, and
`fe` is a browser fetch client. Contract §0's «the 304 makes a refetch near-free», which the
per-`classId` cache in §0's class-switch rule leans on, was true of nothing `fe` could
actually do.

Fix: evaluate the precondition at the origin — `ifNoneMatch()` doing the weak, list-aware
comparison RFC 9110 §13.1.2 specifies, then `304 .end()`. That is what the spec asks of an
ORIGIN server: a matching `If-None-Match` on a GET MUST answer 304, and request-side
`no-cache` (RFC 9111 §5.2.1.4) is a directive to intermediary **caches** — it asks for
validation against the origin, and a 304 from the origin *is* that validation.

What both fixes deliberately are **not**: no middleware, no dependency, **no cache**. The
`findOne` still runs on every request, so a re-transcription changes the projection, changes
the tag and invalidates every client — which is exactly the staleness hazard SEED §6
rejected an in-process memo over.

**49 / 49.**

## Done-protocol

| rung | outcome |
|---|---|
| oracle green ×2 | ✔ `gate PASS 49/49 ran` twice, consecutive |
| perimeter differential | ✔ slice-1 net, same lane: **406 / 411**. All 5 reds are ONE fact — see below |
| freeze audit | ✔ `git status --short` empty across all seven frozen paths; changed set is exactly `src/app.ts`, `src/store/programmes.ts`, `src/routes/programme.ts` |
| `tools/ci be --slug programme-surface` | ✔ `gate PASS (1 ran, 0 skipped)` from the be worktree |

**The perimeter differential, in full.** Every one of the 5 reds is the same diff — one
array element, `"/api/classes/:classId/programme"` — and nothing else in 411 clauses moved:

```
be-2 progress.characterization.test.js:1078   /api grew by exactly one entry
be-3 subjects-classid…                        /api still lists every recorded route and grew by nothing
be-4 teacher-school…                          the differential is empty both ways
be-6 catchall-and-log-naming…                 the index gained nothing and lost nothing
be-7 arabic-messages…                         the index gained nothing and lost nothing
```

This is Perimeter 1 — the declared supersession (WF-65), which fires at **promotion** of
`classes-progress`, not in this slice's gate. **But it is five clauses across five suites,
not the one at `progress.characterization.test.js:1074-1079` the sub-issue and contract §0
name.** Recorded so the promotion-time amendment is scoped right.

Corpus guard checked after cleanup: `distinct("streams")` back to exactly **6**.

## Ask-when — did not fire

No field outside the whitelist was needed · the 404 was made byte-identical without touching
`progress.ts` · no frozen file moved · 3 iterations of 10.

## Carried out of this sub-issue (for /review)

1. **Contract §0's ETag sentence is measured on the wrong route and is wrong twice over.**
   "Express's default ETag is the whole caching story" is false for any envelope route
   (correlationId nonce) and false for any fetch client (spec-mandated `no-cache`). The
   behaviour the contract wants now holds — via an entity tag plus origin-side precondition
   evaluation — but the sentence should be amended, because `fe`'s per-`classId` cache rests
   on it.
2. **`GET /api/progress/:classId` still cannot 304**, same two causes. Out of scope —
   `progress.ts` is frozen this slice — and recorded so it is a decision, not a discovery.
3. **SEED §2's payload figure is stale by the contract's own decision.** It reads
   *projection 38,775 B*; the shipped projection is **49,673 B** for maths. 38,775 measured
   the projection **without** `competencies` — the be agent's original recommendation, which
   contract §2 then overrode. Reproduced exactly: the same projection minus `competencies`
   measures 38,706 B today. The whole-document figure (62,883 B) matches, so the unit is
   bytes and only that one row is stale. The real cost of including competencies is
   **+28%**, not the «~19%» §2 quotes.
4. **SEED §2 / Ground truth say the `/api` index holds 9 entries; it holds 11** — stale
   since slice 1 merged.
5. **The promotion-time pin is 5 clauses, not 1** (see the differential above).
6. **Oracle filename.** The task brief named `programme-route.characterization.test.js`; the
   sub-issue's Oracle slot names `programme.characterization.test.js`. The six slots govern,
   so that is the file.

## Measured — the shipped projection, per stream

| stream | docKey | projection | envelope | rows | serve |
|---|---|---|---|---|---|
| شعبة الرياضيات | `tadarroj-3as-math` | **49,673 B** | 49,742 B | 103 | 7.7 ms |
| تقني رياضي | `tadarroj-3as-techmath` | 47,608 B | 47,677 B | 97 | 3.8 ms |
| علوم تجريبية | `tadarroj-3as-sciences` | 43,554 B | 43,623 B | 81 | 9.7 ms |
| تسيير واقتصاد | `tadarroj-3as-gestion` | 25,204 B | 25,273 B | 59 | 4.0 ms |
| آداب وفلسفة | `tadarroj-3as-lettres` | 14,969 B | 15,038 B | 39 | 4.8 ms |
| لغات أجنبية | `tadarroj-3as-lettres` | 14,969 B | 15,038 B | 39 | 3.0 ms |

UTF-8 bytes. Two streams, one document, byte-identical answers — the multikey match working.
Timings are end-to-end from a Node client on the same host and include process scheduling;
they are not the 1.06 ms `findOne`+stringify figure SEED §2 measured in isolation.

## review

**Verdict: approve.**

Attack log (cross-model, prosecution):
- 404 parity re-probed live across all four variants (absent / uppercase / short / non-hex) on BOTH routes: byte-identical bodies, 404 every time. A one-byte mutant in `notFound()`'s message was planted and the gate went RED — the byte-compare discriminates.
- Whitelist prosecuted: a `transcriptionRev` passthrough planted in `toProgrammeRecord` → gate RED (key-set equality fires). Envelope, programme, units/weeks/rows key sets re-verified live: exactly the contract §2 sets.
- ETag re-verified live: stable across requests, `304` + zero bytes for **both** curl and node fetch — the two-cause fix holds for the client class that matters.
- One **equivalent mutant** found: deleting this route's own `requireTeacher` changes nothing observable, because `classesRouter`'s prefix guard (`classes.ts:31`) already covers `/api/classes/:classId/programme`. Verified live (still 401 with the guard commented out). The belt-and-braces line is fine as defense against mount reordering, but no oracle can ever kill it — do not mistake its survival for coverage.
- **Stale prose**: `store/programmes.ts:1141`'s projection comment still describes `\square` as "escalated and parked". The corpus was corrected under this slice; the code is right, the paragraph is wrong. One-line prose fix for /document.
- The carried-out items (contract §0's ETag sentence wrong twice over; the promotion pin being 5 clauses not 1; SEED's stale 38,775 B) are accurate and belong at seal.
