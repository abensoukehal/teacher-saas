/**
 * be-1 — `exam-plan` and `exercise-one` are real catalogue entries.
 *
 * A skill IS the unit of capability in this service (project/CLAUDE.md, be section), so
 * "promoting a prototype" means exactly three things and this suite pins all three:
 *   1. the catalogue LISTS it — `/api/skills` reads `agent/.claude/skills/`, so a
 *      directory that is present but unreadable, or whose frontmatter is malformed,
 *      silently vanishes from the product's advertised capabilities;
 *   2. the name PASSES validation and reaches the runner — `isKnownSkill` is the guard
 *      that stands between caller input and a `/<name>` interpolation into the prompt;
 *   3. the two properties every downstream consumer depends on are STATED in the SKILL.md
 *      — JSON-only output, and `id`/`label`/`points` echoed back unchanged. Those are the
 *      skill's contract with `be`; a rewrite that drops either one breaks the fan-out
 *      without breaking a single line of TypeScript.
 *
 * NEVER CALLS A REAL GENERATION. The instance under test runs against `fake-claude.mjs`
 * (see replay-harness.js) — the recorded runs from SEED §9.2, replayed.
 */
const fs = require("node:fs");
const path = require("node:path");
const { startReplayServer, client } = require("./replay-harness");

const REPO = process.env.CHAR_ROOTDIR;
const SKILLS_DIR = path.join(REPO, "agent", ".claude", "skills");

/** The two this sub-issue promotes. */
const PROMOTED = ["exam-plan", "exercise-one"];
/** Frozen by be-1's Delta: promoting must not disturb what already shipped. */
const PRE_EXISTING = ["exam-subject", "refine-exercise", "solution-sheet"];
/**
 * Added later in this job — DECLARED SUPERSESSION of the exact-catalogue clause below.
 *
 * be-6 split `solution-one` out of `solution-sheet` the way be-1 split `exercise-one` out
 * of `exam-subject`. Adding a capability is the product growing, so the clause is widened
 * rather than deleted: it still fails if a skill DISAPPEARS or the listing stops sorting,
 * which is what it was written to catch.
 */
const ADDED_BY_BE6 = ["solution-one"];
const CATALOGUE = [...PROMOTED, ...PRE_EXISTING, ...ADDED_BY_BE6];

let server;
let call;

jest.setTimeout(120_000);

beforeAll(async () => {
  server = await startReplayServer();
  call = client(server.url);
});

afterAll(async () => {
  if (server) await server.stop();
});

describe("be-1 — the promoted skills are in the catalogue", () => {
  test("GET /api/skills lists exam-plan and exercise-one", async () => {
    const { status, body } = await call("GET", "/api/skills");
    expect(status).toBe(200);
    const names = body.skills.map((s) => s.name);
    for (const name of PROMOTED) expect(names).toContain(name);
  });

  test("the three pre-existing skills are still listed", async () => {
    const { body } = await call("GET", "/api/skills");
    const names = body.skills.map((s) => s.name);
    for (const name of PRE_EXISTING) expect(names).toContain(name);
    // The whole catalogue, sorted — a promotion adds, it never reorders or drops.
    expect(names).toEqual([...CATALOGUE].sort((a, b) => a.localeCompare(b)));
  });

  test("every listed skill carries a non-empty description", async () => {
    // The description is the trigger the CLI matches on. An empty one is a skill that
    // exists and never fires — indistinguishable, from the outside, from a missing one.
    const { body } = await call("GET", "/api/skills");
    for (const s of body.skills) {
      expect(typeof s.description).toBe("string");
      expect(s.description.trim().length).toBeGreaterThan(20);
    }
  });
});

describe("be-1 — the name guard, in both directions", () => {
  test.each(PROMOTED)("%s passes validation and reaches the runner", async (skill) => {
    const input =
      skill === "exam-plan"
        ? { stream: "علوم تجريبية", level: "3AS", exerciseCount: 3, totalPoints: 20 }
        : { id: "ex2", label: "التمرين الثاني", points: 7, difficulty: "متوسط" };
    const { status, body } = await call("POST", "/api/generate", { body: { skill, input } });
    expect(status).toBe(200);
    // Reaching the runner is the claim; the payload is a replay, so its content is the
    // recording's, not this suite's business. `data !== null` proves the run's result
    // parsed as JSON — i.e. the skill name was interpolated and a result came back.
    expect(body.data).not.toBeNull();
    expect(typeof body.correlationId).toBe("string");
  });

  test.each([
    "exam-plan-x",
    "../etc",
    "exercise-one/../exam-subject",
    "exam plan",
    "",
  ])("unknown skill %j is rejected 400 invalid_request", async (skill) => {
    // The name is interpolated into the prompt as `/<name>`. Caller input that is not in
    // the catalogue must never reach the CLI — this is the guard, not a formatting nicety.
    const { status, body } = await call("POST", "/api/generate", {
      body: { skill, input: { id: "ex1" } },
    });
    expect(status).toBe(400);
    expect(body.error.type).toBe("invalid_request");
  });

  test("a non-string skill is rejected too", async () => {
    for (const skill of [42, { name: "exam-plan" }, ["exam-plan"], true]) {
      const { status, body } = await call("POST", "/api/generate", {
        body: { skill, input: { id: "ex1" } },
      });
      expect(status).toBe(400);
      expect(body.error.type).toBe("invalid_request");
    }
  });
});

describe("be-1 — the two SKILL.md contracts cannot drift silently", () => {
  const read = (name) => fs.readFileSync(path.join(SKILLS_DIR, name, "SKILL.md"), "utf8");

  test.each(PROMOTED)("%s has frontmatter whose name matches its directory", (name) => {
    const source = read(name);
    const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(source);
    expect(fm).not.toBeNull();
    expect(fm[1]).toMatch(new RegExp(`^name:\\s*${name}\\s*$`, "m"));
    expect(fm[1]).toMatch(/^description:\s*\S/m);
  });

  test.each(PROMOTED)("%s states that it returns JSON only", (name) => {
    // `src/claude/json.ts` tolerates a fence and stray prose, but the instruction is what
    // keeps the tolerance a safety net instead of the mechanism. 2/13 recorded runs came
    // back unparseable (SEED §10.1) even WITH the instruction.
    expect(read(name)).toMatch(/JSON ONLY|one JSON object and nothing else/i);
  });

  test("exercise-one still requires id, label and points to be echoed unchanged", () => {
    // Contract §5.2 — the assignment is not the writer's decision. `be` verifies the echo
    // rather than trusting it, but a skill that stops promising it will fail every fill.
    const source = read("exercise-one");
    expect(source).toMatch(/`id`, `label` and `points`/);
    expect(source).toMatch(/echo them back exactly as given|exactly what you were given/i);
  });

  test("exam-plan still promises points that sum to the total, and ids ex1…exN in order", () => {
    // Contract §5.1 and §5.3. The plan is the only thing standing between a fan-out and an
    // exam that does not add up — once it returns, nothing downstream can fix the total.
    const source = read("exam-plan");
    expect(source).toMatch(/Points sum to exactly `totalPoints`|points` sums to `totalPoints`/);
    expect(source).toMatch(/ids `ex1`…`exN` in order|`ex1`, `ex2`, … in order/);
    expect(source).toMatch(/Never renumber/i);
  });

  test.each(PROMOTED)("%s asks for Arabic only — no French, no English", (name) => {
    // The product's first hard constraint. A skill that stops saying so produces material
    // a teacher cannot hand out, and nothing in the type system notices.
    expect(read(name)).toMatch(/Not one word of French or English|Arabic\b/);
  });
});
