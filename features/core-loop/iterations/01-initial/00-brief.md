---
kind: feature
                           #   feature        → full arc (feature→milestone→issue→sub-issue)
                           #   bugfix | hotfix → issue-level (issue + sub-issues only)
                           #   exploration | eval → recognized job kinds; scaffold shape TBD
source_url: https://github.com/abensoukehal/teacher-saas/issues/1
                           # (feature) or Issue (bugfix/hotfix). Captured at PROVISION, never back-filled.
company_linear_id: 1        # the upstream id parsed from source_url (project or issue id)
slug: core-loop
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
> [abensoukehal/teacher-saas#1](https://github.com/abensoukehal/teacher-saas/issues/1)
> (no comments on it). Fetched with `gh`, not the Linear MCP — this product is not
> tracked in Linear, and the connector is unauthorized in this workspace anyway.
> Upstream of the issue sits `project/docs/product-brief.md`, the product's source
> of record.

The MVP. A teacher sets controls, gets a draft exam, refines individual exercises in plain Arabic, and prints it. This is what the two teacher-friend testers must be able to do end to end — the brief's quality bar is "the core loop must work end to end so they're reacting to the real thing".

Context: `project/CLAUDE.md` (condensed) and `project/docs/product-brief.md` (source of record).

## The loop

1. **Controls** — topic, difficulty, exercise count, duration (and stream/level).
2. **Optional free-text note**, with topic-aware suggestion chips.
3. **Generate a full draft exam** — `exam-subject` skill.
4. **Drill into one exercise and refine it** in plain Arabic — `refine-exercise` skill. Change its values · change its difficulty · swap it for another on the same topic.
5. **Export** — a standalone printable page, print-to-PDF.

**Step 4 is the product.** It is done many times per exam, so its latency and error UX carry the whole experience. A version of this feature that generates and prints but doesn't refine has not delivered the core loop.

## Hard constraints

These invalidate plausible-looking implementations — check designs against them first.

- **Arabic only, RTL throughout.** The sole locale, not a later i18n pass. Icons, arrows, progress, number and date formatting all have to be correct under `dir="rtl"`.
- **Math renders via KaTeX.** Never plain text, never an image.
- **LaTeX is fully hidden.** Teachers do not know what it is and must never see it — not in an input, placeholder, validation message, or export. Refinement is natural language only.
- **On-syllabus** for the Algerian programme, per stream.
- **Don't over-engineer.** Good UX, minimal surface.

## What already exists

- `be` — the Claude Code CLI wrapper, with both skills in `.claude/skills/`: `exam-subject` (whole exam, exercises carry stable `ex1…exN` ids) and `refine-exercise` (one exercise, `id`/`points`/`label` preserved). `POST /api/generate` takes `{skill, input, sessionId}` and returns `{text, data, …}`; `data` is the parsed JSON.
- `fe` — the Vite + React + TS scaffold. No product UI yet.

## Not in scope

Persistence, accounts, billing/credits, solution sheets, multiple versions, exercise library. All are roadmap items; none is needed for the teacher test.

## Known blockers / risks

- **The `claude` CLI's OAuth session is expired on the dev machine**, so no real generation has run and the skills' output quality is unverified. This blocks acceptance of steps 3–4 until someone runs `claude` and `/login`.
- **`tools/ci` does not gate these stack keys** — it hardcodes `be|fe|ai` against an older repo layout. The job needs a working test gate or an explicit decision to run suites directly.
- **No datastore.** Continuity is delegated to the Claude Code CLI's own per-process sessions, which are lost on restart. Acceptable for this job; it means a draft exam does not survive a refresh, which the UX must not pretend otherwise.
- **Curriculum grounding is unverified.** The 3AS topic list in `exam-subject` is guidance pending a real programme.

## Done when

A teacher can, in Arabic, in one sitting: set controls → generate a draft exam that renders correctly with KaTeX → refine at least one exercise by instruction → print a clean sheet.

## How he thinks we should solve it

Drive the two existing Claude Code skills from a new UI. Nothing about the
generation engine is expected to change in this job:

- `exam-subject` → the draft (step 3). Already emits `exercises[]` with stable
  `ex1…exN` ids.
- `refine-exercise` → step 4. Already takes `{instruction, exercise, examContext}`
  and returns one exercise with `id`/`points`/`label` preserved.

Both are reached through `POST /api/generate {skill, input, sessionId}`, which
returns the parsed skill output in `data`. So the work is expected to be: the
Arabic/RTL/KaTeX UI, the controls, the per-exercise refine interaction, the
printable page — plus whatever `be` needs to serve them.

**Ship lean.** The bar is a working core loop two teacher friends can react to,
not a platform.

## Constraints / deadlines / stakeholders mentioned

- **Hard product constraints** (see the issue body above and `project/CLAUDE.md`):
  Arabic-only RTL as the sole locale · KaTeX for all math · LaTeX never surfaced
  to a teacher in either direction · on-syllabus for the Algerian programme ·
  don't over-engineer.
- **Stakeholders:** two math-teacher friends are the go/no-go testers. Their
  reaction is the validation signal, so the loop must work end to end before they
  see it (`docs/product-brief.md` §6).
- **No deadline stated.**
- **Environmental blocker, not a design one:** the `claude` CLI's OAuth session on
  this machine is expired, so no real generation has ever run. Steps 3–4 cannot be
  accepted until someone runs `claude` and `/login`.

## Open questions to resolve in DISCOVERY

- [ ] **Does the generation actually work?** Nothing has run end to end — the CLI
      login is expired. Everything about exercise shape, latency and failure modes
      below is unverified until it does. Resolve this first; it gates the rest.
- [ ] **What does a real `exam-subject` payload look like?** Record the actual
      JSON, not the SKILL.md's promise, into `contracts/`. The UI's whole data
      model depends on it.
- [ ] **How long does a generation take, and a single refine?** Decides whether
      step 4 needs streaming/partial results or a plain pending state. This is the
      interaction done many times per exam, so it drives the UX more than anything.
- [ ] **Does a refine survive without persistence?** There is no datastore and CLI
      sessions are per-process. Establish whether the draft is held client-side for
      this job, and make sure the UI never implies durability it does not have.
- [ ] **Is KaTeX enough for what the skills emit?** Verify against real output —
      Arabic text mixed with inline `$…$`, display `$$…$$`, arrays. Check
      bidirectional rendering, which is where RTL + math usually breaks.
- [ ] **What is the print target?** Paper size, the school header teachers expect,
      whether they rewrite it by hand (`docs/product-brief.md` §6 flags this as a
      thing to learn from the testers).
- [ ] **Where does each stack's first test come from?** There is nothing to
      characterize against — no tests exist for either stack, so this job's real CI
      baseline is a no-op gate (red), not the "green" the receipt shows. New
      surfaces get spec-tests against `contracts/`. See `build.md` → "CI baseline".
      (`tools/ci <be|fe> --slug core-loop` from this worktree does gate correctly —
      an earlier claim that it could not was wrong.)
