# SEED — enriched product blueprint (DISCOVERY output)

> **Phase:** DISCOVERY. **Input:** `00-brief.md`. **Output:** this file.
> **Consumed by:** PLANNING (it turns SEED into the specs tree).
>
> Locked = the problem/solution/scope below are agreed and stop moving.

## Anchor
- **Job kind:** feature
- **Upstream:** https://github.com/abensoukehal/teacher-saas/issues/1
- **Iteration:** `01-initial`

## Problem (enriched)

An Algerian lycée maths teacher spends an evening building one exam. The product
compresses that to minutes. **The engine that does it already works; there is no
way to use it.**

- `be` generates and refines correctly today — four real runs recorded in kit §2.
- `fe` has **no product UI at all**: `stacks/teacher-fe/src/App.tsx:7` is the
  122-line Vite starter demo. Nothing in it is reusable.

So the gap is not the AI. It is that the loop from brief §2 — controls → draft →
**refine one exercise** → print — exists only as an HTTP API a teacher cannot
reach. Until it is reachable, the two teacher-friend testers (brief §6) have
nothing to react to, and every open product question stays a guess.

**The brief's own timing claim is false, and it changes the job.** Brief §2
promises "a full draft in seconds". Measured: **114–131 s** for a draft, **47 s**
for a single refine (kit §2). That is not a slow spinner — it is a different
interaction. Progress, cancel, and surviving a mid-run reload are MVP concerns,
not polish. This is the single largest correction DISCOVERY makes to the brief.

## Current reality — the planning kit (observed, not assumed)

### 1 · Acting-surface map (where we'll act)

| Stack | Path (`repo/path:LINE`) | Role | Change |
|---|---|---|---|
| fe | `teacher-fe/src/App.tsx:7` | Vite starter demo | **replace** |
| fe | `teacher-fe/src/main.tsx:1` | React entry | modify |
| fe | `teacher-fe/src/index.css` · `App.css` | starter styles (295 lines) | replace |
| fe | `teacher-fe/vite.config.ts:26` | `/api` → be proxy, `strictPort` | read-only (already correct) |
| fe | *(new)* controls form · exam view · refine · print page | the loop | **new** |
| fe | *(new)* KaTeX render layer | math in RTL | **new** — see risk R1 |
| be | `teacher-be/src/app.ts:85` | `POST /api/generate` | modify (obs; shape already fits) |
| be | `teacher-be/src/app.ts:71` | `GET /api/skills` | read-only |
| be | `teacher-be/src/app.ts:53` | `GET /health` (reports `claude.ok`, queue) | read-only |
| be | `teacher-be/src/claude/runner.ts:99` | `runClaude` — spawn, gate, timeout | modify (obs only) |
| be | `teacher-be/agent/.claude/skills/exam-subject/SKILL.md` | the generator | modify (R1 rule) |
| be | `teacher-be/agent/.claude/skills/refine-exercise/SKILL.md` | the core loop | modify (R1 rule) |
| be | `teacher-be/agent/curriculum/3as-mathematiques.md` | the programme | modify (gaps) |

### 2 · Baseline recordings

All captured **2026-08-07**, lane slot 1 (`be :9100`), against the real `claude`
CLI on this machine. Raw payloads: `recordings/` next to this file.

| Surface | Re-run command | Recorded shape | Captured |
|---|---|---|---|
| `POST /api/generate` · `exam-subject` (4 ex, 120 min, علوم تجريبية) | `curl -s -X POST localhost:9100/api/generate -H 'content-type: application/json' -d @recordings/gen1.request.json` | `recordings/gen1.json` — `{title, meta, exercises[4]}`, ids `ex1…ex4`, points 4+4+5+7 = **20**, difficulty سهل→صعب | 2026-08-07 · lane 1 · **130.6 s · $0.486** |
| `POST /api/generate` · `exam-subject` (3 ex, 90 min, شعبة الرياضيات) | same, `-d @recordings/gen2.request.json` | `recordings/gen2.json` — 3 exercises, 6+6+8 = **20**, all on الأعداد المركبة | 2026-08-07 · **114.5 s · $0.440** |
| `POST /api/generate` · `exam-subject` · **curriculum-gap probe** (`topic: الحسابيات`) | same, `-d @recordings/gen3.request.json` | `recordings/gen3-curriculum-gap.json` — **refused the topic**, said so in `meta.assumptions`, degraded to confirmed topics | 2026-08-07 · **121.7 s · $0.522** |
| `POST /api/generate` · `refine-exercise` (`صعّبه شوية` on `ex2`) | `curl -s -X POST localhost:9100/api/generate -H 'content-type: application/json' -d @recordings/refine1.request.json` | `recordings/refine1.json` — `id`/`points`/`label` **unchanged**, `متوسط`→`صعب`, statement 512→734 chars | 2026-08-07 · **47.2 s · $0.313** |
| `GET /api/skills` | `curl -s localhost:9100/api/skills` | `{"skills":[{"name":"exam-subject",…},{"name":"refine-exercise",…}]}` | 2026-08-07 |
| `GET /health` | `curl -s localhost:9100/health` | `{status:"ok", claude:{ok:true, detail:"2.1.220 (Claude Code)", active:0, queued:0, max:3}}` | 2026-08-07 |
| KaTeX parse of every math span | `node check.mjs <recording>` (kit §7) | gen1 **77/77**, gen2 **60/60**, refine1 **26/26**, gen3 **59/59** — 0 parse failures; gen3 emits a **glyph warning**, see R1 | 2026-08-07 |

> **Cost note carried into risks:** ~**$0.20 fixed overhead per invocation** (a
> one-word run costs $0.195), so a refine is ~2/3 overhead. See R3.

### 3 · Perimeter consumers (recorded)

**None.** Nothing consumes `be`'s API today — `fe` is the untouched Vite starter
and makes no calls to it (`teacher-fe/src/App.tsx:7`).

Consequence, and it is a real freedom: **there is no backward-compatibility
constraint on `/api/generate` or on the skills' JSON shape in this job.** The
negative oracle for this iteration is not "existing consumers stay bit-stable" —
there are none. It is "the recorded shapes in §2 keep reproducing".

### 4 · End-to-end trace (one real action, correlated)

```
$ tools/obs trace b792d6b9-1f17-4275-8579-52da9ebbf068
[BE] {"level":"info","msg":"request","method":"POST","path":"/api/generate",
      "status":200,"ms":114461.8,"correlationId":"b792d6b9-…"}
```

Boundary crossings for PLANNING: **`fe → be` does not exist yet** (to build);
`be → claude` is a subprocess spawn (`runner.ts:99`), not a network hop, so there
is no wire contract to version there — the contract is the **skill's JSON
output**, recorded in §2.

**The trace is one line for a 114-second request.** See §5.

### 5 · Observability baseline

**Visible today**
- One JSON line per request on `be` stdout — method, path, status, ms,
  `correlationId` — written at completion (`teacher-be/src/app.ts`).
- Correlation id accepted inbound (`x-correlation-id`) and echoed on the response.
- `GET /health` reports CLI version, whether it authenticates, and live queue
  depth (`active`/`queued`/`max`).
- `runClaude` returns `costUsd` and `durationMs` per call.

**Blind spots** — these become the FIRST sub-issues (a loop cannot verify what it
cannot see):
1. **114 seconds of silence.** Nothing is logged between accepting the request and
   completing it. No "spawned", no "queued behind N", no progress. For the
   product's slowest and most-repeated action this is the critical gap.
2. **Cost and duration are returned but never recorded.** They exist only in the
   HTTP response. Nothing accumulates them, so the teacher test cannot answer
   "how many refines per exam" or "what did this cost" — both of which the brief
   needs (§4 pricing, §6 validation).
3. **`fe` has no logging or error reporting at all.**
4. **No `stderr` capture from the CLI** on the success path — a run that warns
   (e.g. the KaTeX glyph warning in R1) leaves no trace.

### 6 · Unknowns ledger

| Unknown | Disposition | Evidence / note |
|---|---|---|
| Does the engine actually work? | **resolved** | 4 real runs, kit §2. Yes. |
| Real `exam-subject` payload shape | **resolved** | `recordings/gen1–3`; matches the SKILL.md contract exactly |
| Does a refine preserve `id`/`points`/`label`? | **resolved** | `recordings/refine1.json` — all three identical |
| Does the `agent/` workspace + on-demand curriculum actually work? | **resolved** | Discriminating test: asked for `الحسابيات`, which `curriculum/` marks "do not generate until confirmed". It **refused, explained in `meta.assumptions`, and degraded to confirmed topics** (`gen3`). |
| Can KaTeX render what the skills emit? | **resolved, with a caveat** | 222/222 spans parse across 4 recordings. **But** Arabic inside `\text{}` has no glyph metrics → R1 |
| Latency of draft / refine | **resolved** | 114–131 s / 47 s |
| Does the loop need persistence? | **resolved — no** | `refine-exercise` takes the exercise inline via `examContext`; no `sessionId` in its contract. The client can hold the draft for this iteration. |
| RTL **visual** layout (not parse) | **parked** `blocked_on: fe UI exists` | Nothing to look at yet; the browser pane blocked a localhost probe. First fe sub-issue must screenshot real output. |
| Print target — paper size, school header | **parked** `blocked_on: teacher test` | Brief §6 lists it as a question for the testers. Build the simplest printable page; do not guess a header. |
| Which account runs production generation (subscription vs metered API key) | **parked** `blocked_on: product decision` | Decides whether the §2 costs are real money. Out of this job's control; it does not block building the loop. |
| Is the credit model viable at measured cost? | **parked** `blocked_on: the above` | Brief §4. Belongs in the brief, not this SEED. Job's contribution: **instrument**, so the teacher test produces real numbers. |
| Curriculum accuracy beyond the topic list | **accepted risk** | `curriculum/3as-mathematiques.md` records provenance and gaps; unconfirmed items degrade safely — **proven** by gen3. |
| Prompt-injection surface now the agent can read files | **parked** — user decision, 2026-08-07 | Explicitly deferred: "leave security concerns for later". Recorded so it is not forgotten. |

### 7 · Sweep statement

**Swept:** `be`'s HTTP surface and Claude wrapper (`app.ts`, `runner.ts`,
`skills.ts`, `json.ts`, `config.ts`); the `agent/` workspace end to end including
a discriminating curriculum probe; the skills' real output across 3 topics, 2
streams and 2 exam formats; KaTeX **parse** compatibility over every span of 4
recordings; `fe`'s scaffold and its Vite lane wiring; the obs surface via
`tools/obs trace`.

**Not swept, and why:**
- **RTL visual rendering in a browser** — nothing renders yet, and a localhost
  probe was blocked by browser policy. This is R1's residual risk; it must be
  closed with a screenshot in the first fe sub-issue, not assumed.
- **Print/PDF output** — no page exists to print.
- **Persistence, accounts, billing** — out of scope (below).
- **Deployment** — no target exists. `agent/` ships inside `be`, so there is no
  version-skew question, but nothing was verified outside this machine.
- **Streams other than شعبة الرياضيات and علوم تجريبية** — no curriculum file.
- **Security / prompt injection** — deferred by the user.

## Solution direction (locked, product-level)

**Build the loop's UI against the API that already works. Change no engine
behaviour** except where evidence above demands it (R1's skill rule, and the
observability blind spots).

1. **A single-page Arabic RTL workspace** shaped like the agreed design: controls
   on one side (topic from the fixed taxonomy, difficulty, exercise count,
   duration, optional free-text note with suggestion chips), the exam on the other.
2. **The draft renders as exercises, not a document** — each carries its `id`,
   because that is what makes step 4 possible.
3. **Per-exercise refine** — the teacher acts on one exercise, in plain Arabic,
   with the three shortcuts the brief names (change values · change difficulty ·
   swap) plus free instruction. The rest of the exam does not move.
4. **Built for minutes, not seconds** — progress, cancel, and the run surviving a
   reload. Non-negotiable given §2.
5. **Print via a standalone printable page**, print-to-PDF. Simplest thing.
6. **Instrument every run** — persist duration, cost and refine-count per exam so
   the teacher test yields data instead of impressions.

**Alternatives considered**
- *Stream partial exercises as they generate* — **not now**: the SDK path is
  `--output-format json` (one result), so this is an engine change, and the
  measured 114 s is survivable with honest progress. Revisit if testers stall.
- *Persist drafts server-side* — **not now**: refine needs no session (kit §6), so
  persistence buys durability, not function. It is the next job, with accounts.
- *Fix cost before building* — **not now**: cost levers (model tier, `--bare`,
  tools off) are engine work that would delay the teacher test, and the test is
  what tells us whether the product is worth optimising. Instrument instead.

## User value (company-facing framing)

A teacher describes the exam they need and gets a ready-to-print Arabic maths
subject in minutes, refining any single exercise in their own words until it
matches the class they are actually teaching.

## Scope & boundaries

**In**
- The full loop: controls → draft → per-exercise refine → printable page
- Arabic RTL UI, KaTeX rendering, LaTeX never surfaced
- Progress / cancel / reload-survival for long runs
- Run instrumentation (duration, cost, refine count)
- The R1 skill rule + curriculum gap corrections

**Out (non-goals)**
- Teacher accounts, auth, persistence to a datastore, billing or credits
- Solution sheets, multiple versions, exercise library, remediation (roadmap)
- Streaming partial results
- Any subject other than mathematics; any stream without a curriculum file
- Security hardening of the agent's tool access (deferred by the user)
- Deployment

**Stacks likely touched:** `fe` (majority) · `be` (observability + the `agent/`
workspace's skills and curriculum). No `infra`.

## Risks & backward-compat flags

- **R1 — Arabic inside math renders wrong, silently.** `gen3` produced
  `$u_0 = 1 \quad \text{و} \quad u_{n+1} = …$`. KaTeX **parses it without error**
  but has no glyph metrics for `و` in its fonts, so it renders as a missing or
  misplaced glyph. Correct LaTeX, wrong output, no exception — the dangerous
  combination. **Mitigation:** a skill rule forbidding Arabic inside math (split
  the span and put the Arabic in prose between two math spans), plus a render-time
  check. Must be closed with a real screenshot.
- **R2 — RTL visual layout is unverified.** Parse ≠ layout. Bidirectional text
  with embedded LTR math is where RTL breaks. First fe sub-issue verifies visually.
- **R3 — Unit economics.** ~$0.49/draft + ~$0.31/refine, of which ~$0.20 per call
  is fixed overhead. At ~10 refines/exam this exceeds a 2,000 DZD subscription per
  teacher. **Not this job's to solve**, but the job must not make it worse and must
  measure it.
- **R4 — Curriculum is unverified beyond the topic list.** Degrades safely (proven,
  gen3) but will produce conservative exams for unconfirmed areas. Needs a real
  programme document and a teacher's confirmation.
- **Backward compatibility: not applicable this iteration.** Kit §3 — no consumers
  exist. Freely shape the API; the constraint is only that §2's recordings keep
  reproducing.

## Investigation journal

- **H1 (the brief's own framing) — "a rough prompt gives a full draft in seconds"**
  → test: run `exam-subject` through the real API three times, timed
  → result: **114.5 s, 121.7 s, 130.6 s**; a single refine 47.2 s
  → belief: **killed.** The product is minute-scale. Progress/cancel/reload become
  MVP scope, and this is the largest correction to the brief.

- **H2 — "the generation engine works and produces usable exams"** (untestable at
  provision; the CLI login had expired)
  → test: after login, 4 real runs across 2 streams, 3 topics, 2 formats
  → result: contract holds exactly — stable `ex1…exN` ids, points summing to 20
  every time, progressive difficulty, Arabic-only (0 Latin runs outside math),
  `meta.assumptions` populated
  → belief: **kept, now evidenced.**

- **H3 — "the core loop's hardest invariant (refine preserves the slot) holds"**
  → test: `صعّبه شوية` on `ex2` of a recorded exam
  → result: `id`, `points`, `label` byte-identical; `متوسط`→`صعب`; statement rewritten
  → belief: **kept.** Step 4 is buildable against the current engine.

- **H4 — "the loop needs server-side persistence"**
  → test: read `refine-exercise`'s input contract; check whether `sessionId` is required
  → result: it takes the exercise inline via `examContext`; no session
  → belief: **killed.** The client can hold the draft; persistence is the next job.

- **H5 — "an `agent/` workspace with on-demand curriculum actually changes behaviour"**
  (rather than being organisational tidiness)
  → test: **discriminating** — request `topic: الحسابيات`, which `curriculum/`
  explicitly marks "absent … do not generate until confirmed"
  → result: it **refused**, wrote the reason into `meta.assumptions` in Arabic, and
  substituted the nearest confirmed topics; `meta.topic` changed to
  `مواضيع مختلطة من البرنامج` to reflect what it actually did
  → belief: **kept, strongly.** Progressive disclosure and safe degradation are real,
  not aspirational. *(First attempt at this test was invalid — I had restarted a
  backend that did not contain `agent/`; re-run after correcting the branch.)*

- **H6 — "KaTeX can render whatever the skills emit"**
  → test: parse every math span of all 4 recordings through `katex.renderToString`
  with `throwOnError: true`
  → result: **222/222 parse, 0 failures** — including `\begin{cases}`, `\mathbb{}`,
  `pmatrix`, `\displaystyle\lim`, `\int`. **But** gen3 warned
  `No character metrics for 'و'` — Arabic inside `\text{}` parses and renders wrong
  → belief: **refined.** Parse risk retired; a *silent glyph* risk found and
  recorded as R1. Visual layout (R2) remains unswept.

## Ready-for-PLANNING checklist
- [x] the brief's framing was tested, not assumed (journal H1 — killed)
- [x] problem + solution direction agreed and locked; why-nots cite killing evidence
- [x] acting-surface map present (kit §1); scope in/out stated
- [x] every acting surface has a baseline recording with its re-run command (kit §2)
- [x] perimeter consumers recorded (kit §3 — none; back-compat N/A, stated)
- [x] one correlated end-to-end trace saved (kit §4)
- [x] observability baseline stated — blind spots called out (kit §5)
- [x] no undispositioned unknowns (kit §6)
- [x] sweep statement present — the unswept edge named (kit §7)
- [ ] **lock re-verification: every §2 recording reproduced at seal time** — pending
      the user's approval to seal (§2 re-run costs ~$1.76 and ~7 min of generation)
