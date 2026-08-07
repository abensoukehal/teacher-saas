---
kind: feature
                           #   feature        → full arc (feature→milestone→issue→sub-issue)
                           #   bugfix | hotfix → issue-level (issue + sub-issues only)
                           #   exploration | eval → recognized job kinds; scaffold shape TBD
source_url: https://github.com/abensoukehal/teacher-saas/issues/2
                           # (feature) or Issue (bugfix/hotfix). Captured at PROVISION, never back-filled.
company_linear_id: 2        # the upstream id parsed from source_url (project or issue id)
slug: persistence
date: 2026-08-07
---

# 00 — brief (PROVISION)

> **Phase:** PROVISION. **Output:** this brief — your raw, vague, general context
> and details, verbatim. Do NOT enrich here; enrichment happens next, in
> DISCOVERY, whose output is `SEED.md`. This file stays the unfiltered starting point.
>
> **PROVISION rule:** `source_url` + `kind` above are REQUIRED before scaffolding.
> Every job is anchored to something already tracked upstream — a **Project**
> (feature) or a **direct Issue** (bugfix/hotfix). If the URL wasn't given, ask
> for it *before* running `tools/provision`. The URL is the join key back to the
> company tracker and it decides the job's shape.

## What he said (the problem, in his words)

> Verbatim from the anchoring issue,
> [abensoukehal/teacher-saas#2](https://github.com/abensoukehal/teacher-saas/issues/2)
> (no comments on it). Fetched with `gh`, not the Linear MCP — this product is
> tracked in GitHub issues, at his explicit instruction for this job.
>
> **Provenance caveat, recorded on purpose.** He did not hand over an issue body.
> He picked the job off the roadmap ("persistence — pick a datastore"), told me
> *"don't assume, store until you become certain of job goal"*, and I put five
> forks to him — what the job is *for* (durability vs. unblocking billing vs.
> unblocking the library vs. just choosing the store), whether ownership is decided
> inside this job, whether refinements persist, whether `sessionId` continuity gets
> replaced, and whether ★ PENDING deploy blocks the choice. He answered **"go
> ahead"** without picking. So the issue below is **my** framing, ratified by him,
> not his words — and the five forks are live questions for DISCOVERY, not settled
> ones. Treat the "Done when" as provisional.

The first real architectural decision. `be` is stateless: a generated exam subject exists only in the HTTP response and in whatever the browser is holding. Refresh the page and the teacher's evening is gone. Persistence was explicitly out of scope for #1 (core loop) — this job closes that.

Context: `project/CLAUDE.md` → "Data model" (★ PENDING) and `project/docs/product-brief.md` §4 (the billing question), which is the source of record.

## The gap today

Continuity is delegated to the Claude Code CLI's own sessions — a run returns `sessionId`, a caller passes it back. Those sessions belong to the CLI, not to the product: per-process, lost on restart, not queryable, not owned by anyone. The consequence is that the current stack **cannot persist a subject, bill for one, or build a library** — three separate roadmap items all blocked on the same missing thing.

`src/runlog.ts` is not a counter-example. It appends one JSON line per run for cost and duration telemetry, deliberately carries no teacher content, and its own comment says there is no datastore in scope. It stays what it is.

## The shape the store has to honour

The brief fixes these even though the store is unchosen. A design that violates one of them is wrong regardless of which database it picks.

- **The exam subject is the unit of everything.** It is what a teacher reasons about ("I need 4 exams this trimester") and it is the billing unit under the favoured model — one credit = one finished subject. It must be a first-class persisted entity, not a transient response.
- **An exercise is addressable inside its subject.** The core loop refines *one* exercise, so exercises need stable ids (`ex1…exN`, already emitted by `exam-subject`) and independent regeneration — never one blob of exam text.
- **Iteration is unbounded and must not be metered.** Many revisions per exercise, and that count must mean nothing commercially. Storing a revision must not imply charging for it.
- **Everything generated is worth keeping.** The personal exercise library (roadmap 6) is the retention play and is nearly free if nothing is discarded from day one.

## What this job must decide

Ranked by how much else hangs off them:

1. **The store itself.** Which one, and why it suits a single-node Node service with a small write volume and JSON-shaped documents.
2. **Ownership.** A stored subject belongs to someone, but there are no teacher accounts yet (★ PENDING). Either this job introduces identity, or it picks a deliberate placeholder (device- or browser-scoped) that a real account layer can later adopt without a migration. Say which, and say what the migration costs.
3. **What "finished" means.** The billing model turns on export, so the subject needs a lifecycle a credit can later attach to — without building billing now.
4. **Revision storage.** Whether a refined exercise supersedes in place or appends, given that the library wants history and the teacher wants the current sheet.

## Hard constraints

Unchanged, and they still invalidate plausible designs:

- **Arabic only, RTL throughout.** Anything user-visible this job adds (a drafts list, a "restored" notice) is Arabic and correct under `dir="rtl"`.
- **Math renders via KaTeX**, and **LaTeX stays fully hidden** — including in anything read back out of the store.
- **Don't over-engineer.** The next milestone is two teacher friends reacting to a working product, not a platform. Pick the smallest store that honours the shape above. A migration later is cheaper than the wrong abstraction now.

## What already exists

- `be` — `POST /api/generate` takes `{skill, input, sessionId}` and returns `{text, data, …}`; `data` is the parsed JSON. Skills `exam-subject` (whole exam, stable exercise ids) and `refine-exercise` (one exercise, `id`/`points`/`label` preserved). Failure classification (`claude_auth`, `claude_timeout`, …) that new failure modes should extend rather than bypass.
- `fe` — the exam builder from #1: controls, exam view, per-exercise refinement, print.
- No datastore, no accounts, no billing. Node 20+, Express 4, TypeScript ESM.

## Not in scope

- **Billing, credits, payment rails.** This job makes them *possible*; it does not build them. Don't lock the model in before the teacher test.
- **The exercise library UI** (roadmap 6) — the store should not make it hard, but the surface is a later job.
- **Solution sheets, multiple versions, exercise series** — separate roadmap items.

## Known blockers / risks

- **No teacher identity** is the real fork in this job. Getting it wrong means either a migration or a rewrite once accounts land.
- **The `claude` CLI's OAuth session** has been expired on the dev machine before; generation is dead while it is, which makes end-to-end verification of "generate → persist → reload" impossible until someone runs `claude` and `/login`.
- **Deployment is ★ PENDING** for both repos, so a store choice that assumes managed infrastructure is choosing a deploy target by implication. Say so if it does.

## Done when

A teacher generates a subject, refines an exercise, closes the tab, comes back, and finds it — with every exercise intact and refinable exactly as before. The store choice and the ownership decision are written down in `project/CLAUDE.md` → "Data model", replacing the ★ PENDING stub.


## How he thinks we should solve it

**He did not say.** He chose the job and said "go ahead"; no direction on the
store, the ownership model or the write path came from him. Recording that
absence rather than papering over it — DISCOVERY has to derive the direction and
put it back to him, not assume it was pre-approved.

What is *not* his and should be treated as my proposal:

- Framing the job as **durability-first** ("survives a refresh") rather than as
  unblocking billing, unblocking the library, or a pure store-selection spike.
  These are different-sized jobs and he picked none of them.
- Deciding **ownership inside this job** instead of gating on a separate accounts
  job.
- **Persisting refinements**, not just the exported subject — which is the only
  reason revision storage is a question at all.
- Leaving **`sessionId` continuity alone**. If a persisted subject is meant to
  replace it, that is real `src/claude/runner.ts` work nobody has scoped.

**Ship lean** still holds from #1: the bar is two teacher friends reacting to a
working product, not a platform.

## Constraints / deadlines / stakeholders mentioned

- **Hard product constraints** (`project/CLAUDE.md`): Arabic-only RTL as the sole
  locale · KaTeX for all math · LaTeX never surfaced to a teacher in either
  direction · on-syllabus · don't over-engineer. The last one bites hardest here —
  a store is exactly where over-engineering hides.
- **The billing shape is deliberately unsettled.** `docs/product-brief.md` §4 says
  *"don't lock this in before the teacher test"*. So this job must make the
  favoured model (one credit = one finished subject, unlimited iteration inside)
  *possible* without making the others impossible.
- **Stakeholders:** the same two math-teacher friends. Nothing here reaches them
  unless it changes what they see.
- **No deadline stated.**
- **Both repos are single-branch** (`main`, empty integration field), so
  `/merge-back` skips them and there is no staging axis for this job.
- **Only `be` is attached.** `fe` is not — if DISCOVERY finds frontend work
  (a drafts list, restore-on-reload, an Arabic "restored" notice), run
  `tools/provision persistence extend fe:main` rather than improvising.

## Open questions to resolve in DISCOVERY

- [ ] **What is this job actually for?** The five forks above, unanswered. Until
      one is picked, "done when" is a guess. Resolve first — it sizes everything
      else. Durability, billing-enablement, library-enablement and store-selection
      are four different jobs wearing the same name.
- [ ] **Who owns a stored subject?** No accounts exist. Introduce identity, or
      pick a placeholder (device/browser-scoped) and cost the migration honestly.
      Getting this wrong is the expensive mistake in this job.
- [ ] **Which store, and against what evidence?** Single-node Express, low write
      volume, JSON-shaped documents, no chosen deploy target. Write down what was
      rejected and why — a store choice with no rejected alternatives is a default,
      not a decision.
- [ ] **Does the store choice pick a deploy target by implication?** Deployment is
      ★ PENDING for both repos. Anything managed decides that question silently.
- [ ] **What is the real persisted shape of a subject?** Take it from an actual
      `exam-subject` payload in `contracts/` (core-loop recorded these), not from
      the SKILL.md's promise.
- [ ] **What happens to `sessionId`?** Today it is the only continuity mechanism.
      Does a persisted subject replace it, coexist with it, or ignore it? Answer
      before touching `src/claude/runner.ts`.
- [ ] **Does anything in `fe` have to change for the "done when" to be true?**
      If yes, this job needs `extend fe:main` and the answer is no longer be-only.
- [ ] **Is generation actually runnable right now?** The CLI login has expired
      before. "Generate → persist → reload" cannot be verified end to end while it
      is, so check early rather than at QA.
