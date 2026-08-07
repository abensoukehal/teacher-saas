# Brief — persistence gaps (all six, one job)

**Source:** https://github.com/abensoukehal/teacher-saas/issues/3

Carried whole from `handoffs/2026-08-08-what-is-not-persisted.md`, written at the close
of the `persistence` job. Six gaps, scoped as ONE job by explicit decision.

---

> **Source:** `project/handoffs/2026-08-08-what-is-not-persisted.md`, written at the close
> of the `persistence` job. This issue carries the debrief whole, as one job.
>
> **This is a starting claim, not a spec.** DISCOVERY's first duty is to try to falsify
> it. The last job's brief was wrong about its own premise, and one grep caught it.

## Where things stand

The `persistence` job shipped and merged (2026-08-08):

- abensoukehal/teacher-be#2 · abensoukehal/teacher-fe#2 — both MERGED to `main`
- Anchoring issue: #2
- Full record: `project/features/persistence/` — SEED, sub-issues, contracts, `qa.md`, retro

**What it fixed.** Exams were held client-side under one fixed key (`teacher.draft.v1`),
so a teacher's second exam silently destroyed their first. Exams now live in MongoDB
(`teacher_saas.subjects`), one document per exam, owned by an opaque teacher id.
`create` inserts — there is no upsert and no delete.

**What that leaves.** Six gaps, below. They are not equally urgent: **#1 is the only one
that still loses a teacher's work.**

---

## 1 · The teacher identity is not stored — exams can be orphaned forever

**Size: large. Do this one first.**

There is no `teachers` collection. The id is generated (`teacher-be/src/teacher.ts:21`,
`randomBytes(16)`), handed to the browser, and never written down. `requireTeacher`
(`teacher.ts:43`) only checks the *shape* — a well-formed unknown id is accepted and owns
nothing. The browser is the only place the id exists
(`teacher-fe/src/lib/persist.ts:23`, `teacher.id.v1`).

**Consequence.** Clearing site data does not log a teacher out — it **permanently orphans
every exam they have ever made**. The documents remain in Mongo forever (there is no
delete) but nothing can ever find them again. The same root cause means no cross-device
access: plan on a laptop, print from a desktop, and the desktop shows an empty list.

**It is also a bearer value** — anyone holding the id reads that teacher's exams. Accepted
deliberately for a two-teacher test on exam drafts, and explicitly flagged as something
that must not silently become the auth model.

**What a fix must honour.** The opaque id was designed to be *adopted*, not replaced: an
accounts layer should be able to attach a real identity to existing `teacherId` values
without moving or rewriting any document. State the migration cost explicitly. Mail is not
integrated, so magic-link sign-in is not buildable without adding that first — which is
itself a scoping decision, not a detail.

**Watch out for:** the temptation to build full email+password auth. The product's hard
constraint is *don't over-engineer*, and the milestone is still two teacher friends. A
short recovery code, or sign-in only at the moment a teacher would otherwise lose work,
may buy the whole benefit for a fraction of the surface.

---

## 2 · Exercise revisions are overwritten — there is no history

**Size: small-to-medium. Highest value per unit of work.**

`replaceExercise` does an in-place update (`teacher-be/src/store/subjects.ts:168`,
`$set: { "subject.exercises.$": next }`). The previous version of a reworked exercise is
gone the moment the new one lands.

**Consequence.** A teacher who refines an exercise into something worse has no undo — and
refining is *the* interaction the product exists for, repeated several times per paper. It
also half-breaks the product's own stated principle, *"everything generated is worth
keeping"*: subjects accumulate, revisions do not. Every discarded variant is a
fully-formed, on-syllabus exercise that cost real money to generate and is thrown away —
exactly the material the personal exercise library (roadmap 6) would be built from.

**What a fix must honour.** Exercise ids (`ex1…exN`) are the join key the whole core loop
turns on; history must not disturb them. The current sheet must stay trivially readable —
a teacher opening an exam should not pay for its history. Storage is not a concern: a whole
subject is ~5 KB.

---

## 3 · Cost per exam is unjoinable

**Size: small.**

`run-log.jsonl` now carries `{kind:"subject", op, subjectId, correlationId}` link lines
(`teacher-be/src/runlog.ts:55`), so **revisions per exam is answerable**. Cost is not: the
generation's `correlationId` never reaches the stored subject, because `generateExam`
discards the envelope and returns only `data` (`teacher-fe/src/lib/api.ts:90`).
`createSubject` already accepts a `correlationId` argument (`api.ts:222`) and **nothing
passes one** — the plumbing is half-laid, deliberately, because finishing it changes a
frozen return type.

**Consequence.** You cannot say what any given exam cost to produce. A generation is ~$0.65
measured, against a price point under consideration of 2,000 DZD/month (~$15). That is
roughly 23 exams to break even before infrastructure — so this is the number the billing
model turns on, and `docs/product-brief.md` §4 says not to lock that model in before the
teacher test.

**What a fix must honour.** `run-log.jsonl` must keep carrying **no teacher content** — no
titles, no statements, no Arabic. That guarantee predates this work and is why the file is
safe to keep.

---

## 4 · A failed save is not queued across a reload

**Size: small.**

When a write fails, the interface says so and offers a retry, but only in-session. The exam
survives in the local paint cache (`teacher-fe/src/lib/persist.ts:59`); the *pending save*
does not.

**Consequence.** A teacher who hits a failed save and closes the tab loses that exam.
Narrow, but it is the same silent-loss class the last job was about, so it deserves a
decision rather than drift.

---

## 5 · Live controls state is browser-only

**Size: trivial. Possibly not worth a job.**

The controls used for each exam **are** stored on that exam's document (`controls` field).
Only the panel's current state lives in `localStorage`. Cosmetic; listed for completeness so
nobody rediscovers it as a bug.

---

## 6 · No deploy target, and therefore no backup

**Size: large, and not really a persistence job.**

Mongo is a local instance shared with another harness clone on this machine.
`project/CLAUDE.md` → Deployments is still ★ PENDING for both repos. **Nothing described
above is backed up anywhere.**

Choosing a store implied a deploy question that the last job explicitly did not answer — it
was recorded as accepted risk, not resolved. Anything managed (Atlas, a hosted Mongo)
decides it by implication.

---

## Recommended order within the job

1. **#1 identity** — the only remaining gap that still loses a teacher's work, and
   everything social (sharing, billing, multi-device) is downstream of it.
2. **#2 revision history** — cheapest large win, and it is the raw material for the
   exercise library, which is the retention play.
3. **#3 cost** — small, and it unblocks the billing decision that is currently unmakeable.
4. **#4 / #5** — fold into whichever slice touches that code; neither justifies its own.
5. **#6 deploy** — needed before real teachers depend on any of this, but it is an
   infrastructure concern, not a product one. **DISCOVERY should decide explicitly whether
   it stays in scope**; the debrief itself says it is "not really a persistence job", and #5
   it calls "possibly not worth a job".

**A caution on ordering.** The product's stated strategic problem is that exam generation is
*low-frequency* (3–6 exams per trimester), which is a weak habit loop. None of the six gaps
fixes that. Roadmap item 3 — **weekly exercise series** — is the one that does, and it is
explicitly flagged as "if only one thing is added, this". Persistence gaps are real, but do
not let them crowd out the frequency problem. Tracked separately.

---

## Constraints that apply to every one of these

Non-negotiable; each invalidates plausible-looking designs (`project/CLAUDE.md` → Hard
constraints):

- **Arabic only, RTL throughout.** The sole locale. Any new UI string, any new state.
- **Math renders via KaTeX**; **LaTeX is never shown to a teacher** — not in an input, a
  placeholder, an error, or an export.
- **On-syllabus** for the Algerian programme.
- **Don't over-engineer.** The next milestone is two teacher friends reacting to a working
  product, not a platform.

Plus two the last job established:

- **`/api/generate` is frozen** in request and response shape. Keeping it so is what let
  `be` and `fe` merge in either order.
- **`claude_auth` and `store_unavailable` are both 503 and mean opposite things.** Branch on
  `error.type`, never the status code.

---

## Traps — things already learned the hard way

Each one cost real time in the last job
(`project/features/persistence/iterations/01-initial/retro.md`).

- **The provision receipt's CI baseline can report a green it did not earn.** It said
  `green` for `be` when both gates were in fact RED. Always re-run
  `tools/ci <key> --slug <slug>` **from the job worktree** and believe that instead.
- **`be` tests must be black-box.** Filename must match `*.characterization.test.js`; there
  is no TypeScript transform; and `dist/` is ESM, which jest's CJS runner cannot import
  without a flag that lives in the shared engine config. Drive the running lane over HTTP and
  assert with the `mongodb` driver. Written up in the last job's `stacks/be.md` → "Test
  harness". **Probe the harness before writing any oracle.**
- **`fe`'s `node_modules` is a symlink to the main checkout** and was found with 24 of 88
  packages installed — `katex`, `vitest` and testing-library all missing, so the gate could
  not run at all. Check it early.
- **Record one real generation and reuse it.** A generation is ~128 s and ~$0.65. Never call
  it inside a loop iteration; the last job's payload is at
  `project/features/persistence/iterations/01-initial/contracts/rec-exam-subject.2026-08-07.json`.
- **`tools/docs-verify` does not exist in this clone**, though `/document` instructs you to
  run it.
- **Falsify the brief before planning from it.** The last brief's central claim was wrong and
  one grep — aimed at the *other* stack from the one it blamed — caught it in ten minutes.
  Had planning started from the brief, the headline deliverable would have been a feature
  that already shipped.
