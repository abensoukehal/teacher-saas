# be-1 — promote the two skills into the catalogue

**status:** done · **tag:** happy-path · **cycles used:** 2 of 6

## What the sub-issue asked for

`exam-plan` and `exercise-one` existed as measured prototypes in the job worktree
(untracked). Make them real catalogue entries: listed by `/api/skills`, spawnable by name,
and pinned so their contracts cannot silently drift.

## What changed

`stacks/teacher-be` — one commit, `3ff53e9`:

- `agent/.claude/skills/exam-plan/SKILL.md` — committed as-is
- `agent/.claude/skills/exercise-one/SKILL.md` — committed as-is

**No TypeScript changed, and that is the finding, not a shortcut.** `listSkills()` reads
`agent/.claude/skills/` and `isKnownSkill()` is defined as membership of that listing
(`src/claude/skills.ts:38,67`), so *committing the directory IS the registration*. This is
the "a skill IS the capability" property the be brief states; the promotion cost being zero
is evidence the property actually holds rather than being an aspiration.

Verified live on the instance under test: `/api/skills` returns all five, sorted —
`exam-plan, exam-subject, exercise-one, refine-exercise, solution-sheet`.

## The oracle

`features/parallel-exercises/tests/be/skills-catalogue.characterization.test.js` — 19
clauses, and the harness both suites share:

- `fake-claude.mjs` — a stand-in for the `claude` binary
- `replay-harness.js` — boots a real teacher-be with `CLAUDE_BIN` pointed at it
- `fixtures/rec-*.json` — the six recordings from SEED §9.2, verbatim

What it pins:

| clause | why it is here |
|---|---|
| `/api/skills` lists both promoted names | the catalogue is a directory read; an unreadable dir or malformed frontmatter makes a skill vanish silently |
| the three pre-existing skills are still listed, and the full sorted list matches | be-1's Delta freezes them — a promotion adds, it never reorders or drops |
| every description is non-empty | the description is the trigger the CLI matches on; an empty one is a skill that never fires |
| both names pass validation and reach the runner | the positive half of the guard, proved by a replayed run coming back with parsed `data` |
| `exam-plan-x`, `../etc`, `exercise-one/../exam-subject`, `exam plan`, `""`, and four non-string types → `400 invalid_request` | the name is interpolated as `/<name>`; caller input must never reach the CLI |
| each SKILL.md's frontmatter `name` matches its directory | the catalogue keys on frontmatter, the filesystem keys on the directory — a mismatch publishes one name and spawns another |
| both still say "JSON ONLY" | `json.ts` tolerates a fence, but the instruction is what keeps tolerance a net rather than the mechanism (2/13 recorded runs were unparseable anyway) |
| `exercise-one` still promises to echo `id`/`label`/`points` unchanged | contract §5.2 — the whole fan-out assembles on that promise |
| `exam-plan` still promises points summing to `totalPoints`, ids `ex1…exN`, "Never renumber" | contract §5.1, §5.3 — once the plan returns, nothing downstream can fix a wrong total |
| both still demand Arabic only | the product's first hard constraint, and nothing in the type system notices its removal |

The last five are the "cannot drift silently" half. They are property checks on the skill
*text*, because that text is the contract: a rewrite can break the fan-out without touching
a line of TypeScript, and no other gate in this repo would notice.

## Decisions the sub-issue did not spell out

**The suite boots its own service instead of using the lane.** A real `exercise-one` run is
45–120 s and real subscription quota (SEED §10), and be-2's surface needs four of them. The
seam chosen is `config.claude.bin` — the service already spawns that binary and parses its
stdout — so pointing it at a replay script leaves the spawn, the stdout-before-exit-code
parse, `extractJson`, the concurrency gate and the whole error classification as real code
under test. A module-level stub would have skipped exactly the parts that have broken
before. **No production code carries any test scaffolding.**

**`agent/CLAUDE.md` was left alone.** Its skill table lists two skills and is now stale by
three (`solution-sheet` was already missing before this job). be-1's Delta freezes
everything but the two skill directories, so it is flagged rather than edited.

## Exit protocol

- oracle green ×2 — 55/55 across both suites, twice
- `/api/skills` diffed against its recording — five skills, sorted, descriptions intact
- journal sealed

## review

**Verdict: approve.** (Cross-model REVIEW gate, 2026-08-09.)

Blind prediction matched the diff: zero-TypeScript promotion via the directory-read
catalogue, and the oracle pinning the skill *text* as contract. No divergence to litigate.

**Attack log.**
- Ran the full be gate ×3 across the review (105/105 every clean run) and `/api/skills`
  against a replay-boot instance — five skills, sorted, descriptions intact.
- Validation rejects held under the oracle's adversarial names; nothing new found beyond
  its list (the name interpolation is guarded before spawn, verified in `runner.ts` path).
- The skill-text property pins (JSON ONLY, echo promise, points-sum promise, Arabic only)
  are the right defence for a contract that lives in prose; no gate but this one would
  notice a rewrite. Held.
- `agent/CLAUDE.md` staleness flagged here was fixed by commit `7c2a3b0` before review.

Nothing broke. Nothing expected to break here — the slice is a registration plus pins,
and the pins killed every mutation aimed at their subject matter elsewhere (see be-2/be-3
review sections for the shared-suite kill counts).
