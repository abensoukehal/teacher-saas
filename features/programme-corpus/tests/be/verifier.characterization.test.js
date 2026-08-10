/**
 * be-3 — `scripts/verify-programmes.mjs`: layer 1, the pass gate, and the L2 compare.
 *
 * One fixture per way a check can fail (WF-70), because every assertion here exists for a
 * failure that already happened or that no other mechanism can see:
 *
 *   A3   `totals.hours == weeklyHours × 27` — 181, 128 and 44 all reached the product brief
 *        from a corrupted text extraction and none of them divides by 27.
 *   A5   week boundaries are not on the page: PDF p11 carries two rows and no week number,
 *        and weeks straddle page breaks. Only the ordinal sequence catches a lost week.
 *   A7   red text is semantic. A row whose emphasis is out of enum, or "added-2022" in a
 *        document with no legend, is lost meaning wearing a valid-looking value.
 *   --compare   layer 1 catches NO attribution error. The three anchor/hours/emphasis
 *        disagreements below are the drift a passing arithmetic check cannot see, so they
 *        are exactly what compare must catch.
 *
 * The verifier never writes, in any mode — asserted for the file and for the database.
 */
const { execFileSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const { MongoClient } = require("mongodb");
const F = require("./fixtures/seed-fixtures");

const ROOT = process.env.CHAR_ROOTDIR ?? ".";
const VERIFY = path.resolve(ROOT, "scripts/verify-programmes.mjs");
const LOAD = path.resolve(ROOT, "scripts/load-programmes.mjs");
const BUILT = path.resolve(ROOT, "dist/store/programmes.js");
const MONGO = process.env.MONGO_URL ?? "mongodb://127.0.0.1:27017";
const SCRATCH = "programme_corpus_ci";
const REAL_DB = "teacher_saas";

let mongo;
let db;
let tmp;

function run(script, args) {
  try {
    const out = execFileSync("node", [script, ...args], {
      encoding: "utf8",
      env: { ...process.env, MONGO_URL: MONGO },
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { code: 0, out };
  } catch (err) {
    return { code: err.status ?? -1, out: `${err.stdout ?? ""}${err.stderr ?? ""}` };
  }
}

const verify = (args) => run(VERIFY, args);
const seed = (name, mutate) => F.writeVariant(tmp, name, mutate);

/** Assert a fixture is red, that the named assertion is the one that failed. */
function failsWith(variant, assertion, matcher) {
  const res = verify(["--file", seed(variant)]);
  expect(res.code).toBe(1);
  expect(res.out).toMatch(new RegExp(`^${assertion}\\s+FAIL`, "m"));
  if (matcher) expect(res.out).toMatch(matcher);
  return res;
}

beforeAll(async () => {
  if (!fs.existsSync(BUILT)) {
    throw new Error(`${BUILT} is missing — run \`npm run build\` in stacks/teacher-be before gating.`);
  }
  if (!fs.existsSync(VERIFY)) throw new Error(`${VERIFY} is missing`);
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "programme-verify-"));
  mongo = new MongoClient(MONGO);
  await mongo.connect();
  db = mongo.db(SCRATCH);
  await db.dropDatabase();
});

afterAll(async () => {
  if (db) await db.dropDatabase();
  if (mongo) await mongo.close();
  if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
});

describe("be-3 · layer 1, full file", () => {
  test("the valid fixture is green and every assertion is reported by name", () => {
    const res = verify(["--file", seed("valid")]);
    expect(res.code).toBe(0);
    for (const a of ["A1", "A2", "A3", "A4", "A5", "A6", "A7"]) {
      expect(res.out).toMatch(new RegExp(`^${a}\\s+PASS`, "m"));
    }
    expect(res.out).toMatch(/7 passed, 0 failed/);
  });

  test("A3 — totals corrupted to 181, the exact error that reached the brief", () => {
    const res = failsWith("a3-totals-181", "A3", /totals\.hours 181 != weeklyHours 7 × 27 = 189/);
    // The tell: it does not divide.
    expect(res.out).toMatch(/181 \/ 27 = 6\.7/);
  });

  test("A1 — units' hours do not sum to the stated total", () => {
    failsWith("a1-units-hours-mismatch", "A1", /Σ units\.hours 190 != totals\.hours 189/);
  });

  test("A2 — units' weeks do not sum to 27", () => {
    failsWith("a2-units-weeks-mismatch", "A2", /Σ units\.weeks 28/);
  });

  test("A4 — one week's rows sum to 6 instead of weeklyHours", () => {
    failsWith("a4-week-hours-6", "A4", /week 12: 2 \+ 2 \+ 1 \+ 1 = 6/);
  });

  test("A5 — week 14 missing", () => {
    failsWith("a5-week-missing", "A5", /missing: 14/);
  });

  test("A5 — week 14 duplicated", () => {
    failsWith("a5-week-duplicated", "A5", /repeated: 14/);
  });

  test("A6 — a week points at a unit that does not exist", () => {
    failsWith("unit-id-orphan", "A6", /week 9: unitId "u99" is not declared/);
  });

  test("A6 — a declared unit that no week references", () => {
    failsWith("a6-unit-unreferenced", "A6", /unit u14 is referenced by no week/);
  });

  test("A7 — a week with no source.pdfPages is not verifiable", () => {
    failsWith("pdfpages-empty", "A7", /week 7: source\.pdfPages is empty/);
  });

  test("A7 — an out-of-enum emphasis", () => {
    failsWith("emphasis-out-of-enum", "A7", /emphasis "red" is not one of/);
  });

  test("A7 — added-2022 in a document that records no legend", () => {
    failsWith("emphasis-added-without-legend", "A7", /the document records no emphasisLegend/);
  });

  test("A7 — red-unlegended in a document that HAS a legend", () => {
    failsWith("emphasis-unlegended-with-legend", "A7", /the document HAS a legend/);
  });

  test("a valid document that carries the legend is green with added-2022 rows", () => {
    const res = verify(["--file", seed("valid-legend")]);
    expect(res.code).toBe(0);
    expect(res.out).toMatch(/^A7\s+PASS/m);
  });
});

describe("be-3 · --partial, the pass-boundary gate", () => {
  /** Weeks 1..k only — what a transcription pass legitimately commits. */
  const truncated = (k) =>
    F.writeJsonl(
      tmp,
      `partial-${k}`,
      F.variant("valid").filter((l) => l.type === "programme" || l.week <= k),
    );

  test("nine closed weeks are green and the resume state is printed", () => {
    const res = verify(["--file", truncated(9), "--partial"]);
    expect(res.code).toBe(0);
    expect(res.out).toMatch(/resume: next week 10/);
    // Weeks 1..9 land in u06 (1|2|2|1|2|2… of the real summary table), one of its two used.
    expect(res.out).toMatch(/open unit u06 \(1 of 2 weeks consumed\)/);
    expect(res.out).toMatch(/last pdfPage seen 14/);
    expect(res.out).toMatch(/units not yet started: u07, u08/);
  });

  test("A1–A3 still run in partial mode — pass 0's gate is the summary table", () => {
    const res = verify(["--file", truncated(9), "--partial"]);
    for (const a of ["A1", "A2", "A3"]) expect(res.out).toMatch(new RegExp(`^${a}\\s+PASS`, "m"));
  });

  test("pass 0 — a file with the programme line and no weeks at all", () => {
    const file = F.writeJsonl(tmp, "pass0", [F.variant("valid")[0]]);
    const res = verify(["--file", file, "--partial"]);
    expect(res.code).toBe(0);
    expect(res.out).toMatch(/resume: next week 1/);
    expect(res.out).toMatch(/^A3\s+PASS/m);
  });

  test("pass 0 catches a mis-read summary total before a single week is transcribed", () => {
    const file = F.writeJsonl(tmp, "pass0-bad", [F.variant("a3-totals-181")[0]]);
    const res = verify(["--file", file, "--partial"]);
    expect(res.code).toBe(1);
    expect(res.out).toMatch(/^A3\s+FAIL/m);
  });

  test("a completed unit is reported as complete, not as open", () => {
    // Weeks 1..8 finish u05 exactly (1+2+2+1+2).
    const res = verify(["--file", truncated(8), "--partial"]);
    expect(res.code).toBe(0);
    expect(res.out).toMatch(/open unit none \(u05 complete, 2 of 2 weeks\)/);
    expect(res.out).toMatch(/resume: next week 9/);
  });

  test("a gap in the committed weeks is red — a pass commits closed weeks IN ORDER", () => {
    const file = F.writeJsonl(
      tmp,
      "partial-gap",
      F.variant("valid").filter((l) => l.type === "programme" || (l.week <= 9 && l.week !== 5)),
    );
    const res = verify(["--file", file, "--partial"]);
    expect(res.code).toBe(1);
    expect(res.out).toMatch(/^A5\s+FAIL/m);
  });

  test("a truncated file is RED without --partial — 27 weeks is not optional", () => {
    const res = verify(["--file", truncated(9)]);
    expect(res.code).toBe(1);
    expect(res.out).toMatch(/^A5\s+FAIL/m);
  });
});

describe("be-3 · --compare, the layer-2 oracle", () => {
  const pair = (name, mutateL2) => {
    const lines = F.variant("valid");
    const l2 = F.l2From(lines);
    return [
      F.writeJsonl(tmp, `${name}-seed`, lines),
      F.writeJsonl(tmp, `${name}-l2`, mutateL2 ? mutateL2(l2) : l2),
    ];
  };

  test("an agreeing l2 file is green", () => {
    const [s, l] = pair("agree");
    const res = verify(["--compare", s, l]);
    expect(res.code).toBe(0);
    expect(res.out).toMatch(/27 seed week\(s\), 27 l2 week\(s\), 0 discrepancy\(ies\)/);
  });

  test("a row's hours disagree — the page says 3 where the seed says 2", () => {
    const [s, l] = pair("hours", (l2) => {
      l2[5].rowHours[0] = 3;
      return l2;
    });
    const res = verify(["--compare", s, l]);
    expect(res.code).toBe(1);
    expect(res.out).toMatch(/week 6 · row\[0\]\.hours · seed says 2 · page says 3/);
  });

  test("a row's emphasis disagrees — the colour the transcription missed", () => {
    const [s, l] = pair("emphasis", (l2) => {
      l2[10].rowEmphasis[1] = "red-unlegended";
      return l2;
    });
    const res = verify(["--compare", s, l]);
    expect(res.code).toBe(1);
    expect(res.out).toMatch(/week 11 · row\[1\]\.emphasis · seed says "normal" · page says "red-unlegended"/);
  });

  test("an anchor disagrees — the attribution drift no arithmetic can see", () => {
    const [s, l] = pair("anchor", (l2) => {
      l2[3].anchors[0].competenciesFirst = "نص مختلف تماما عن المخزن هنا";
      return l2;
    });
    const res = verify(["--compare", s, l]);
    expect(res.code).toBe(1);
    expect(res.out).toMatch(/week 4 · row\[0\]\.competencies · seed says/);
  });

  test("a row-count disagreement is reported once, not amplified per row", () => {
    const [s, l] = pair("rowcount", (l2) => {
      l2[1].rowCount = 3;
      return l2;
    });
    const res = verify(["--compare", s, l]);
    expect(res.code).toBe(1);
    expect(res.out).toMatch(/week 2 · rowCount · seed says 4 · page says 3/);
    expect(res.out).toMatch(/1 discrepancy\(ies\)/);
  });

  test("a week the l2 pass never read is reported as a coverage gap", () => {
    const [s, l] = pair("coverage", (l2) => l2.filter((x) => x.week !== 20));
    const res = verify(["--compare", s, l]);
    expect(res.code).toBe(1);
    expect(res.out).toMatch(/week 20 · coverage · seed says "present" · page says "no l2 line"/);
  });

  test("full text is deliberately NOT compared — two honest reads differ in whitespace", () => {
    const lines = F.variant("valid");
    const l2 = F.l2From(lines);
    // Same first six words, different tail and different spacing: not a disagreement.
    const s = F.writeJsonl(tmp, "ws-seed", lines);
    l2[7].anchors[0].competenciesFirst = `  ${l2[7].anchors[0].competenciesFirst}   وزيادة في الذيل`;
    const l = F.writeJsonl(tmp, "ws-l2", l2);
    expect(verify(["--compare", s, l]).code).toBe(0);
  });

  test("a محور label the page did not show is not a disagreement", () => {
    const [s, l] = pair("nolabel", (l2) => {
      l2[2].unitLabelSeen = null; // rotated, merged cell — the reader saw no label
      return l2;
    });
    expect(verify(["--compare", s, l]).code).toBe(0);
  });
});

describe("be-3 · --db mode", () => {
  beforeAll(async () => {
    await db.dropDatabase();
    const res = run(LOAD, ["--file", seed("valid"), "--db", SCRATCH]);
    expect(res.code).toBe(0);
  });

  test("a loaded document verifies green and its contentHash is recomputed", () => {
    const res = verify(["--db", "--db-name", SCRATCH, "--docKey", "fixture-3as-math"]);
    expect(res.code).toBe(0);
    for (const a of ["A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8"]) {
      expect(res.out).toMatch(new RegExp(`^${a}\\s+PASS`, "m"));
    }
    expect(res.out).toMatch(/transcriptionRev=1/);
  });

  test("a hand-edit in the database is reported, not repaired", async () => {
    await db.collection("programmes").updateOne({}, { $set: { "totals.hours": 181 } });
    const res = verify(["--db", "--db-name", SCRATCH, "--docKey", "fixture-3as-math"]);
    expect(res.code).toBe(1);
    expect(res.out).toMatch(/^A3\s+FAIL/m);
    expect(res.out).toMatch(/^A8\s+FAIL/m);
    expect(res.out).toMatch(/edited outside the loader/);
    // Reported, not repaired.
    expect((await db.collection("programmes").findOne({})).totals.hours).toBe(181);
    await db.collection("programmes").updateOne({}, { $set: { "totals.hours": 189 } });
  });

  test("an unknown docKey is named, not stack-traced", () => {
    const res = verify(["--db", "--db-name", SCRATCH, "--docKey", "no-such-doc"]);
    expect(res.code).toBe(1);
    expect(res.out).toMatch(/no current document for docKey no-such-doc/);
  });
});

describe("be-3 · the verifier never writes", () => {
  test("no file it reads changes, in any mode", () => {
    const file = seed("valid");
    const l2 = F.writeJsonl(tmp, "nowrite-l2", F.l2From(F.variant("valid")));
    const before = [file, l2].map((f) => fs.statSync(f));

    verify(["--file", file]);
    verify(["--file", file, "--partial"]);
    verify(["--compare", file, l2]);

    [file, l2].forEach((f, i) => {
      const s = fs.statSync(f);
      expect(s.size).toBe(before[i].size);
      expect(s.mtimeMs).toBe(before[i].mtimeMs);
    });
  });

  test("--db mode creates no collection and no index", async () => {
    const fresh = "programme_corpus_ci_readonly";
    const res = verify(["--db", "--db-name", fresh, "--docKey", "fixture-3as-math"]);
    expect(res.code).toBe(1);
    const names = (await mongo.db(fresh).listCollections().toArray()).map((c) => c.name);
    expect(names).toEqual([]);
  });

  test("the scratch db's documents are unchanged by a verify run", async () => {
    const before = await db.collection("programmes").find({}).toArray();
    verify(["--db", "--db-name", SCRATCH, "--docKey", "fixture-3as-math"]);
    const after = await db.collection("programmes").find({}).toArray();
    expect(JSON.stringify(after)).toBe(JSON.stringify(before));
  });
});

describe("be-3 · CLI surface + perimeter", () => {
  test("no mode is an error that names the three modes", () => {
    const res = verify([]);
    expect(res.code).toBe(1);
    expect(res.out).toMatch(/--file <path>\.jsonl \[--partial\]/);
    expect(res.out).toMatch(/--compare <seed>\.jsonl <l2>\.jsonl/);
  });

  test("a missing file is named", () => {
    const res = verify(["--file", path.join(tmp, "nope.jsonl")]);
    expect(res.code).toBe(1);
    expect(res.out).toMatch(/no such file/);
  });

  test("teacher_saas is untouched by this suite", async () => {
    const names = (await mongo.db(REAL_DB).listCollections().toArray()).map((c) => c.name).sort();
    expect(names).toEqual(["exercise_revisions", "solutions", "subjects", "teachers"]);
  });
});
