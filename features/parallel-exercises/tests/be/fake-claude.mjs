#!/usr/bin/env node
/**
 * A stand-in for the `claude` binary — REPLAY, never a real generation.
 *
 * WHY THIS AND NOT A MODULE STUB. A generation is a 45–120 s agent loop that spends real
 * subscription quota (SEED §10), so no test may ever call one. The seam this uses is the
 * one the service already has: `config.claude.bin`, spawned by `src/claude/runner.ts` and
 * read back off stdout. Pointing CLAUDE_BIN here changes NOTHING in the service — the
 * spawn, the stdout-before-exit-code parse, `extractJson`, the concurrency gate and the
 * error classification are all the real code under test. A module-level stub would have
 * skipped exactly the parts that have broken before.
 *
 * Every payload it serves is a VERBATIM recording from `fixtures/rec-*.json`, captured
 * 2026-08-09 on lane 0 and listed in SEED §9.2. The one composed response is documented
 * where it is composed.
 *
 * Env:
 *   FAKE_CLAUDE_FIXTURES  dir holding the rec-*.json recordings (required)
 *   FAKE_CLAUDE_MODE      "valid" (default) | "trunc-ex1"  — which exercise recording ex1 gets
 *   FAKE_CLAUDE_DELAY_MS  per-run delay; the fan-out's fills must OVERLAP for the CAS
 *                         clause to mean anything, so every exercise run waits the same
 *                         amount and they all land together. Default 250.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const DIR = process.env.FAKE_CLAUDE_FIXTURES;
const MODE = process.env.FAKE_CLAUDE_MODE || "valid";
const DELAY = Number(process.env.FAKE_CLAUDE_DELAY_MS ?? 250);

const argv = process.argv.slice(2);

if (argv.includes("--version")) {
  process.stdout.write("0.0.0-replay (fake claude)\n");
  process.exit(0);
}

const rec = (name) => JSON.parse(readFileSync(join(DIR, name), "utf8"));

/** The prompt is the last positional arg: `/<skill> <json>`. */
const prompt = argv[argv.length - 1] ?? "";
const m = /^\/([a-z0-9-]+)\s+([\s\S]*)$/i.exec(prompt.trim());
const skill = m?.[1] ?? "";
let input = {};
try {
  input = JSON.parse(m?.[2] ?? "{}");
} catch {
  input = {};
}

/**
 * A valid `exercise-one` result for ex1.
 *
 * There is no VALID recorded ex1 in the fan-out — the real one came back truncated, which
 * is why `rec-fan-ex1.json` is be-3's material rather than be-2's. So the statement is
 * lifted verbatim from `rec-run-ex3.json`'s first exercise (a real generated first
 * exercise on the same topic, same controls) and the assignment fields are echoed back
 * from the request, which is exactly what the real skill does with them.
 */
function composedEx1() {
  const monolith = JSON.parse(rec("rec-run-ex3.json").result);
  const source = monolith.exercises[0];
  const envelope = rec("rec-fan-ex2.json");
  return {
    ...envelope,
    result: JSON.stringify({
      id: input.id,
      label: input.label,
      points: input.points,
      difficulty: input.difficulty ?? source.difficulty,
      topics: source.topics ?? [],
      statement: source.statement,
    }),
  };
}

function exerciseResult() {
  if (input.id === "ex1") {
    return MODE === "trunc-ex1" ? rec("rec-fan-ex1.json") : composedEx1();
  }
  if (input.id === "ex2") return rec("rec-fan-ex2.json");
  if (input.id === "ex3") return rec("rec-fan-ex3.json");
  // Beyond the three recorded assignments, echo the request as a minimal valid result —
  // enough for an orchestration clause, and never claimed to be recorded material.
  const envelope = rec("rec-fan-ex2.json");
  return {
    ...envelope,
    result: JSON.stringify({
      id: input.id,
      label: input.label,
      points: input.points,
      difficulty: input.difficulty,
      topics: [],
      statement: `$f(x)=x^{2}$ — ${input.id}`,
    }),
  };
}

let out;
if (skill === "exam-plan") out = rec("rec-plan.json");
else if (skill === "exercise-one") out = exerciseResult();
else if (skill === "exam-subject") out = rec("rec-run-ex3.json");
else {
  // An unknown skill never reaches here in the real service — `isKnownSkill` rejects it
  // first. Failing loudly means a test that loses that guard cannot pass quietly.
  process.stderr.write(`fake-claude: no recording for skill ${JSON.stringify(skill)}\n`);
  process.exit(1);
}

setTimeout(() => {
  process.stdout.write(JSON.stringify(out));
  process.exit(0);
}, skill === "exam-plan" ? Math.min(DELAY, 100) : DELAY);
