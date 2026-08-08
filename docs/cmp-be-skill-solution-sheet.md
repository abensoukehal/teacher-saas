---
kind: component
id: cmp-be-skill-solution-sheet
title: "The solution-sheet skill"
plane: implementation
part_of: mod-be-agent-workspace
realizes: [feat-solution-sheets]
repos: [teacher-be@40c5abc]
source: [teacher-be/agent/.claude/skills/solution-sheet/SKILL.md]
status: fresh
last_verified: 2026-08-08
tags: [backend, skill, arabic]
---

# The solution-sheet skill

Produces the correction for a stored exam. **Registration is the directory existing** —
`claude/skills.ts` lists `<agent cwd>/.claude/skills`, so `GET /api/skills` advertised
it the moment the folder appeared, with no `src/` change at all.

> Note the location: **`agent/.claude/skills/`**, not the repo root. `config.ts` points the
> CLI at `<repo>/agent`. This was documented wrongly for two jobs before being corrected.

## What it is judged on

"Is the mathematics right" is not mechanically decidable, and the product never claims it is.
These are:

- one entry per exercise, ids exactly as given, **none invented**
- each scale sums **exactly** to that exercise's points (halves are normal in Algerian marking)
- Arabic prose; maths in `$…$`; **never Arabic inside a math span** — KaTeX has no Arabic
  glyph metrics, so it parses without error and renders a broken glyph
- answers are *worked*, and each step corresponds to something in the scale

## A trap worth knowing

Checking "no Latin prose" naively is wrong: LaTeX commands (`\dfrac`, `\sqrt`, `\infty`)
are the renderer's language, not the teacher's. And splitting on `$` to find math breaks on
`$$…$$` — display math lands on an even index and gets counted as prose. **Strip display
math first, then inline.** Three separate property checks reported failures on correct output
before this was got right, and the natural response to a red check is to "fix" the skill.
