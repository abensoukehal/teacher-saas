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
let realCollectionsBefore;

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
  realCollectionsBefore = (await mongo.db(REAL_DB).listCollections().toArray())
    .map((c) => c.name)
    .sort();
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

  // --- A4's second clause: the week's own `hours` field ---------------------
  //
  // The contract's schema.yaml assigns `week.hours` to A4 ("must equal weeklyHours"), and
  // A4 summed the rows and never read it. REVIEW put `week.hours: 999` in a seed and it
  // passed the loader, A1–A8 and `--compare`: a field stored as truth with no owner. These
  // four clauses are that hole, from both directions and in every mode the assertion runs.
  test("A4 — a week DECLARES 999 hours while its rows still sum to weeklyHours", () => {
    const res = failsWith(
      "a4-week-declares-999",
      "A4",
      /week 7: the week line declares hours 999, but weeklyHours is 7 and its rows sum to 7/,
    );
    // The rows are fine, so the row-sum clause must NOT also fire — one fact, one line.
    expect(res.out).toMatch(/1 week-hours problem\(s\)/);
  });

  test("A4 — the week line carries no hours field at all", () => {
    failsWith("a4-week-hours-absent", "A4", /week 7: the week line declares hours null/);
  });

  test("A4 — a week consistent with its own rows and still wrong for the document", () => {
    // declared 6, rows 6, weeklyHours 7. A field checked only against its own rows passes
    // this; A4 is anchored on weeklyHours, so both clauses fire.
    const res = failsWith("a4-week-consistent-but-wrong", "A4", /week 12: 2 \+ 2 \+ 1 \+ 1 = 6/);
    expect(res.out).toMatch(/week 12: the week line declares hours 6, but weeklyHours is 7/);
    expect(res.out).toMatch(/2 week-hours problem\(s\)/);
  });

  test("A4 — the declared-hours clause runs in --partial mode too", () => {
    // The pass gate is where a wrong week is cheapest to catch: before nine more are typed.
    const file = F.writeJsonl(
      tmp,
      "partial-declares-999",
      F.variant("a4-week-declares-999").filter((l) => l.type === "programme" || l.week <= 9),
    );
    const res = verify(["--file", file, "--partial"]);
    expect(res.code).toBe(1);
    expect(res.out).toMatch(/^A4\s+FAIL/m);
    expect(res.out).toMatch(/week 7: the week line declares hours 999/);
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

/**
 * be-3 · the COVERAGE FLOOR — a --compare that compared nothing is not agreement.
 *
 * REVIEW stripped `rowEmphasis`, `anchors` and `unitLabelSeen` out of a layer-2 file and got
 * `0 discrepancies`, exit 0, no warning: the WF-82 failure class (a check that verified
 * nothing reading as a pass) inside this job's own tooling. The floor is two-layered, and
 * both layers are asserted here because either alone is escapable — per-line absence kills
 * the strip, per-file zero-comparisons kills the same attack respelled as all-null.
 *
 * The line these clauses defend: ABSENT is not NULL. A null is a recorded reading ("the
 * rotated محور cell showed no label", "that cell is empty") and two of the five real
 * documents are full of them; an absent key is a field the l2 pass never produced.
 */
describe("be-3 · --compare coverage floor", () => {
  const seedFile = () => F.writeJsonl(tmp, "cov-seed", F.variant("valid"));
  const l2File = (name, mutate) => {
    const l2 = F.l2From(F.variant("valid"));
    return F.writeJsonl(tmp, name, mutate ? mutate(l2) : l2);
  };
  const strip = (...keys) => (l2) =>
    l2.map((x) => {
      const y = { ...x };
      for (const k of keys) delete y[k];
      return y;
    });

  test("THE CASE THIS EXISTS FOR: a hollow l2 file is RED, not a green with 0 discrepancies", () => {
    const res = verify([
      "--compare",
      seedFile(),
      l2File("cov-hollow", strip("rowEmphasis", "anchors", "unitLabelSeen")),
    ]);
    expect(res.code).toBe(1);
    expect(res.out).toMatch(/0 discrepancy\(ies\), 81 coverage gap\(s\)/);
    expect(res.out).toMatch(/week 1 · coverage gap · anchors · the l2 line does not carry the array/);
    expect(res.out).toMatch(/week 1 · coverage gap · rowEmphasis/);
    expect(res.out).toMatch(/week 1 · coverage gap · unitLabelSeen/);
    // And it says out loud how little it compared.
    expect(res.out).toMatch(/compare coverage:.*rowEmphasis 0 rows \(27 GAP\).*anchors 0 cells \(27 GAP\)/);
  });

  test("anchors alone stripped — the attribution check is the only reason the mode exists", () => {
    const res = verify(["--compare", seedFile(), l2File("cov-noanchors", strip("anchors"))]);
    expect(res.code).toBe(1);
    expect(res.out).toMatch(/27 coverage gap\(s\)/);
    expect(res.out).toMatch(/attribution check, which is the only reason this mode exists/);
  });

  test("a short per-row array is a gap — the rest of the week is uncompared", () => {
    const res = verify([
      "--compare",
      seedFile(),
      l2File("cov-short", (l2) => {
        l2[1].rowHours = l2[1].rowHours.slice(0, 2); // 2 entries for 4 rows
        return l2;
      }),
    ]);
    expect(res.code).toBe(1);
    expect(res.out).toMatch(/week 2 · coverage gap · rowHours · 2 entr\(ies\) for 4 row\(s\)/);
  });

  test("a short anchors array is a gap too — the rows past the end are never compared", () => {
    const res = verify([
      "--compare",
      seedFile(),
      l2File("cov-shortanchors", (l2) => {
        l2[1].anchors = l2[1].anchors.slice(0, 1); // 1 entry for 4 rows
        return l2;
      }),
    ]);
    expect(res.code).toBe(1);
    expect(res.out).toMatch(/week 2 · coverage gap · anchors · 1 entr\(ies\) for 4 row\(s\)/);
  });

  test("an anchor object carrying none of the three keys is a gap, named by row", () => {
    const res = verify([
      "--compare",
      seedFile(),
      l2File("cov-emptyanchor", (l2) => {
        l2[3].anchors[1] = {};
        return l2;
      }),
    ]);
    expect(res.code).toBe(1);
    expect(res.out).toMatch(/week 4 · coverage gap · anchors\[1\] · carries none of/);
  });

  test("the per-file floor: every anchor NULLED compares nothing and is still red", () => {
    // The same hollow read in the other spelling — the keys are all there and say nothing.
    const res = verify([
      "--compare",
      seedFile(),
      l2File("cov-allnull", (l2) =>
        l2.map((x) => ({
          ...x,
          anchors: x.anchors.map(() => ({
            competenciesFirst: null,
            contentsFirst: null,
            guidanceFirst: null,
          })),
        })),
      ),
    ]);
    expect(res.code).toBe(1);
    expect(res.out).toMatch(/file · coverage gap · anchors · the l2 file carries the field but compared 0 of 80 row\(s\)/);
  });

  test("null is a READING, not an absence — the real sciences/techmath shape stays green", () => {
    // Both documents record `unitLabelSeen: null` on all 27 weeks (rotated merged محور
    // cells) and null anchors on empty cells. Failing those would fail the corpus.
    const res = verify([
      "--compare",
      seedFile(),
      l2File("cov-nulls", (l2) =>
        l2.map((x) => ({
          ...x,
          unitLabelSeen: null,
          anchors: x.anchors.map((a) => ({ ...a, guidanceFirst: null })),
        })),
      ),
    ]);
    expect(res.code).toBe(0);
    expect(res.out).toMatch(/0 discrepancy\(ies\), 0 coverage gap\(s\)/);
    expect(res.out).toMatch(/unitLabel 0 weeks \(27 not seen\)/);
    expect(res.out).toMatch(/anchors 160 cells \(80 not seen\)/);
  });

  test("an agreeing l2 file reports what it compared, not just that it agreed", () => {
    const res = verify(["--compare", seedFile(), l2File("cov-full")]);
    expect(res.code).toBe(0);
    expect(res.out).toMatch(
      /compare coverage: weekNumberPrinted 26 weeks \(1 not seen\) · unitLabel 27 weeks · rowCount 27 weeks · rowHours 80 rows · rowEmphasis 80 rows · anchors 240 cells/,
    );
    expect(res.out).toMatch(/0 discrepancy\(ies\), 0 coverage gap\(s\)/);
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

  /**
   * `--db <name>` — the asymmetry that failed GREEN.
   *
   * The loader took `--db <name>`; the verifier took `--db` (boolean) plus `--db-name`. So
   * `verify --db scratch_db --docKey X` ate the name as a flag and returned `8 passed,
   * 0 failed` about the LIVE teacher_saas — a verdict about a database the caller never
   * asked about. Both CLIs now share one parse (`scripts/lib/db-arg.mjs`).
   */
  test("THE CASE THIS EXISTS FOR: --db <name> verifies THAT database, not the default", () => {
    // An empty database with the same docKey asked for. Before the fix this was green,
    // because the answer came from somewhere else entirely.
    const empty = "programme_corpus_ci_elsewhere";
    const res = verify(["--db", empty, "--docKey", "fixture-3as-math"]);
    expect(res.code).toBe(1);
    expect(res.out).toMatch(new RegExp(`no current document for docKey fixture-3as-math in db ${empty}`));

    // …and the same command against the database that does hold it is green, naming where
    // the name came from.
    const hit = verify(["--db", SCRATCH, "--docKey", "fixture-3as-math"]);
    expect(hit.code).toBe(0);
    expect(hit.out).toMatch(new RegExp(`subject: db=${SCRATCH} db-from=--db `));
  });

  test("--db <a> --db-name <b> is refused, not resolved", () => {
    const res = verify(["--db", SCRATCH, "--db-name", "somewhere_else", "--docKey", "fixture-3as-math"]);
    expect(res.code).toBe(1);
    expect(res.out).toMatch(/name different databases/);
    // Nothing was verified — no assertion line was printed at all.
    expect(res.out).not.toMatch(/^A1\s+/m);
  });

  test("--db <name> --db-name <the same name> is fine, just redundant", () => {
    const res = verify(["--db", SCRATCH, "--db-name", SCRATCH, "--docKey", "fixture-3as-math"]);
    expect(res.code).toBe(0);
  });

  test("the bare --db mode selector still works and says where the name came from", () => {
    const res = verify(["--db", "--db-name", SCRATCH, "--docKey", "fixture-3as-math"]);
    expect(res.code).toBe(0);
    expect(res.out).toMatch(new RegExp(`subject: db=${SCRATCH} db-from=--db-name `));
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
    // RE-BASELINED twice. be-9 widened a fixed four-collection list to tolerate the corpus
    // collections that job created. programme-surface/be-3 stopped enumerating altogether:
    // the list went stale AGAIN the moment classes-progress added `classes` and `progress`,
    // and a clause every collection-adding job must edit is a clause that reads red for
    // reasons that have nothing to do with the perimeter it guards.
    //
    // The measurement is now the baseline. `realCollectionsBefore` is snapshotted in this
    // file's top-level beforeAll, and the assertion is EXACT SET EQUALITY against it — not
    // a subset check, not a widened literal. It is immune to the next collection anyone
    // adds. The PRODUCT containment stays as a non-vacuity floor: without it, a Mongo that
    // answered an empty list both times would pass this clause having verified nothing.
    const PRODUCT = ["exercise_revisions", "solutions", "subjects", "teachers"];
    const names = (await mongo.db(REAL_DB).listCollections().toArray()).map((c) => c.name).sort();
    for (const c of PRODUCT) expect(names).toContain(c);
    expect(names).toEqual(realCollectionsBefore);
  });
});
