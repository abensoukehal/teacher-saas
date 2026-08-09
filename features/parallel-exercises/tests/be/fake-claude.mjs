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
 * The recorded statement for a slot.
 *
 * ex2 and ex3 come from the fan-out recordings. There is no VALID recorded ex1 — the real
 * one came back truncated, which is why `rec-fan-ex1.json` is be-3's material and not
 * be-2's — so ex1 borrows the first exercise of the recorded MONOLITH run, a real
 * generated first exercise on the same topic under the same controls. Slots past the three
 * recorded ones reuse ex2's statement; nothing above three exercises was ever recorded
 * (SEED §9.7) and no clause reads that content.
 */
function recordedStatement(id) {
  if (id === "ex2") return JSON.parse(rec("rec-fan-ex2.json").result);
  if (id === "ex3") return JSON.parse(rec("rec-fan-ex3.json").result);
  if (id === "ex1") return JSON.parse(rec("rec-run-ex3.json").result).exercises[0];
  return JSON.parse(rec("rec-fan-ex2.json").result);
}

/**
 * The assignment fields are ALWAYS echoed from the request, exactly as the real skill is
 * required to (`exercise-one`: "echo them back exactly as given"). For the canonical
 * 3-exercise replay the request and the recording agree, so this is byte-identical to the
 * recording; it only differs when a test drives an assignment no run ever covered.
 *
 * `bad-echo-ex2` deliberately breaks that promise, which is the only way to exercise
 * `be`'s verify-don't-trust rule (contract §5.2) — the CLI reports such a run as a success.
 */
function exerciseResult() {
  if (MODE === "trunc-ex1" && input.id === "ex1") {
    return rec("rec-fan-ex1.json"); // the real truncated capture, verbatim
  }
  const source = recordedStatement(input.id);
  const envelope = rec("rec-fan-ex2.json");
  const points = MODE === "bad-echo-ex2" && input.id === "ex2" ? input.points + 1 : input.points;
  return {
    ...envelope,
    result: JSON.stringify({
      id: input.id,
      label: input.label,
      points,
      difficulty: input.difficulty ?? source.difficulty,
      topics: source.topics ?? [],
      statement: source.statement,
    }),
  };
}

/**
 * The recorded plan is a 3-exercise composition and is served verbatim for that shape.
 *
 * For any OTHER `exerciseCount` the assignments are WIDENED synthetically — clearly not a
 * recording, and used for exactly one thing: driving a fan-out wider than the recordings
 * cover, so the number of concurrent writers into one document can be pinned at the
 * service's own ceiling. It asserts nothing about plan QUALITY at that width; SEED §9.7 is
 * explicit that nothing above 3 exercises has been exercised for real.
 */
function planResult() {
  const envelope = rec("rec-plan.json");
  const n = Number(input.exerciseCount ?? 3);
  const total = Number(input.totalPoints ?? 20);
  if (n === 3) return envelope;

  const plan = JSON.parse(envelope.result);
  const base = Math.floor(total / n);
  const assignments = Array.from({ length: n }, (_, i) => ({
    ...(plan.assignments[i % plan.assignments.length] ?? {}),
    id: `ex${i + 1}`,
    label: `التمرين ${i + 1}`,
    points: i === n - 1 ? total - base * (n - 1) : base,
  }));
  return { ...envelope, result: JSON.stringify({ ...plan, assignments }) };
}

let out;
if (skill === "exam-plan") out = planResult();
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
