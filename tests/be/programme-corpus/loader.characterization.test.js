/**
 * be-2 — `scripts/load-programmes.mjs`: the only writer, idempotent, guarded.
 *
 * The loader is the single bridge between the source of record (a JSONL file in git) and
 * its projection (Mongo). Everything asserted here is a REFUSAL — the three ways the
 * projection could quietly stop matching the file:
 *
 *   exit 1  the file is invalid          → nothing is written, not even the good lines
 *   exit 2  Mongo was hand-edited        → nothing is written; the DB is wrong
 *   exit 3  the file changed silently    → nothing is written; a correction needs an audit trail
 *
 * Spawns the script as a child process and asserts on exit code + output. Writes only to
 * the scratch db `programme_corpus_ci`; `teacher_saas` and `run-log.jsonl` are asserted
 * untouched.
 */
const { execFileSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const { MongoClient } = require("mongodb");
const F = require("./fixtures/seed-fixtures");

const ROOT = process.env.CHAR_ROOTDIR ?? ".";
const SCRIPT = path.resolve(ROOT, "scripts/load-programmes.mjs");
const BUILT = path.resolve(ROOT, "dist/store/programmes.js");
const RUN_LOG = path.resolve(ROOT, "run-log.jsonl");
const MONGO = process.env.MONGO_URL ?? "mongodb://127.0.0.1:27017";
const SCRATCH = "programme_corpus_ci";
const REAL_DB = "teacher_saas";

let mongo;
let db;
let tmp;
let runLogBefore;

/** Run the loader. Never throws — the exit code IS the assertion. */
function load(args) {
  try {
    const out = execFileSync("node", [SCRIPT, ...args], {
      encoding: "utf8",
      env: { ...process.env, MONGO_URL: MONGO },
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { code: 0, out };
  } catch (err) {
    return { code: err.status ?? -1, out: `${err.stdout ?? ""}${err.stderr ?? ""}` };
  }
}

/** Materialise a fixture variant, optionally mutated, and return its path. */
function seed(name, mutate) {
  return F.writeVariant(tmp, name, mutate);
}

const scratchArgs = (file, ...rest) => ["--file", file, "--db", SCRATCH, ...rest];

beforeAll(async () => {
  // A hollow gate is not a pass: the loader imports the BUILT store module.
  if (!fs.existsSync(BUILT)) {
    throw new Error(`${BUILT} is missing — run \`npm run build\` in stacks/teacher-be before gating.`);
  }
  if (!fs.existsSync(SCRIPT)) throw new Error(`${SCRIPT} is missing`);

  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "programme-loader-"));
  mongo = new MongoClient(MONGO);
  await mongo.connect();
  db = mongo.db(SCRATCH);
  await db.dropDatabase();
  runLogBefore = fs.existsSync(RUN_LOG) ? fs.statSync(RUN_LOG) : null;
});

afterAll(async () => {
  if (db) await db.dropDatabase();
  if (mongo) await mongo.close();
  if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
});

beforeEach(async () => {
  await db.dropDatabase();
});

describe("be-2 · loading, and loading again", () => {
  test("a valid file inserts at transcriptionRev 1 with the contract's indexes", async () => {
    const file = seed("valid");
    const res = load(scratchArgs(file));
    expect(res.code).toBe(0);
    expect(res.out).toMatch(/inserted fixture-3as-math @ 2022-09/);
    expect(res.out).toMatch(/lines-read=28 weeks=27 rows=\d+ rejected=0 action=inserted/);

    const docs = await db.collection("programmes").find({}).toArray();
    expect(docs).toHaveLength(1);
    expect(docs[0].transcriptionRev).toBe(1);
    expect(docs[0].current).toBe(true);
    expect(docs[0].weeks).toHaveLength(27);
    expect(docs[0].contentHash).toMatch(/^[0-9a-f]{64}$/);

    const idx = (await db.collection("programmes").indexes()).map((i) => i.name);
    expect(idx).toEqual(
      expect.arrayContaining(["docKey_1_edition_1", "streams_1_current_1", "docKey_1_current_1"]),
    );
  });

  test("the same file again is a no-op — the loader is idempotent", async () => {
    const file = seed("valid");
    expect(load(scratchArgs(file)).code).toBe(0);
    const res = load(scratchArgs(file));
    expect(res.code).toBe(0);
    expect(res.out).toMatch(/unchanged/);
    expect(res.out).toMatch(/action=unchanged/);
    expect(await db.collection("programmes").countDocuments({})).toBe(1);
    expect(await db.collection("programme_revisions").countDocuments({})).toBe(0);
  });

  test("--dry-run decides and writes nothing", async () => {
    const file = seed("valid");
    const res = load(scratchArgs(file, "--dry-run"));
    expect(res.code).toBe(0);
    expect(res.out).toMatch(/DRY-RUN/);
    expect(res.out).toMatch(/action=inserted/);
    expect(await db.collection("programmes").countDocuments({})).toBe(0);
    // Not even the collections/indexes are created.
    const names = (await db.listCollections().toArray()).map((c) => c.name);
    expect(names).not.toContain("programmes");
  });
});

describe("be-2 · a changed file needs --correct", () => {
  const edit = (lines) => {
    lines[6].rows[0].contents[0] = "محتوى مصحّح بعد قراءة ثانية";
    return lines;
  };

  test("without --correct it exits 3 and the DB is untouched", async () => {
    const original = seed("valid");
    expect(load(scratchArgs(original)).code).toBe(0);
    const before = await db.collection("programmes").findOne({});

    const changed = F.writeVariant(path.join(tmp, "changed"), "valid", edit);
    const res = load(scratchArgs(changed));
    expect(res.code).toBe(3);
    expect(res.out).toMatch(/REFUSED/);
    expect(res.out).toMatch(/differs: weeks\[5\]\.rows\[0\]\.contents\[0\]/);
    expect(res.out).toMatch(/--correct/);
    expect(res.out).toMatch(/action=refused/);

    const after = await db.collection("programmes").findOne({});
    expect(after.contentHash).toBe(before.contentHash);
    expect(after.transcriptionRev).toBe(1);
    expect(await db.collection("programme_revisions").countDocuments({})).toBe(0);
  });

  test("with --correct it records the superseded document verbatim and bumps the rev", async () => {
    const original = seed("valid");
    expect(load(scratchArgs(original)).code).toBe(0);
    const before = await db.collection("programmes").findOne({});

    const changed = F.writeVariant(path.join(tmp, "changed2"), "valid", edit);
    const res = load(scratchArgs(changed, "--correct", "--note", "layer-2 fix"));
    expect(res.code).toBe(0);
    expect(res.out).toMatch(/corrected fixture-3as-math @ 2022-09 transcriptionRev=1 → 2/);
    expect(res.out).toMatch(/action=corrected/);

    expect(await db.collection("programmes").countDocuments({})).toBe(1);
    const after = await db.collection("programmes").findOne({});
    expect(after.transcriptionRev).toBe(2);
    expect(after.weeks[5].rows[0].contents[0]).toBe("محتوى مصحّح بعد قراءة ثانية");

    const revs = await db.collection("programme_revisions").find({}).toArray();
    expect(revs).toHaveLength(1);
    expect(revs[0].docKey).toBe("fixture-3as-math");
    expect(revs[0].edition).toBe("2022-09");
    expect(revs[0].transcriptionRev).toBe(1);
    expect(revs[0].note).toBe("layer-2 fix");
    expect(revs[0].doc.contentHash).toBe(before.contentHash);
    expect(revs[0].doc.weeks[5].rows[0].contents[0]).toBe(before.weeks[5].rows[0].contents[0]);
  });
});

describe("be-2 · the hand-edit guard", () => {
  test("a field edited directly in Mongo exits 2, names the mismatch, and writes nothing", async () => {
    const file = seed("valid");
    expect(load(scratchArgs(file)).code).toBe(0);

    // The hand-edit this guard exists for: somebody "fixes" a total in the database.
    await db.collection("programmes").updateOne({}, { $set: { "totals.hours": 181 } });

    const res = load(scratchArgs(file));
    expect(res.code).toBe(2);
    expect(res.out).toMatch(/HAND-EDIT DETECTED/);
    expect(res.out).toMatch(/stored contentHash: [0-9a-f]{64}/);
    expect(res.out).toMatch(/recomputed:\s+[0-9a-f]{64}/);
    expect(res.out).toMatch(/DB is wrong and the file is right/);
    expect(res.out).toMatch(/action=hand-edited/);

    // The edit is still there — the loader refused, it did not repair.
    const doc = await db.collection("programmes").findOne({});
    expect(doc.totals.hours).toBe(181);
    expect(doc.transcriptionRev).toBe(1);
    expect(await db.collection("programme_revisions").countDocuments({})).toBe(0);
  });

  test("--correct does not paper over a hand-edit", async () => {
    const file = seed("valid");
    expect(load(scratchArgs(file)).code).toBe(0);
    await db.collection("programmes").updateOne({}, { $set: { "totals.hours": 181 } });

    const res = load(scratchArgs(file, "--correct"));
    expect(res.code).toBe(2);
    expect(await db.collection("programme_revisions").countDocuments({})).toBe(0);
    expect((await db.collection("programmes").findOne({})).totals.hours).toBe(181);
  });
});

describe("be-2 · whole-file reject — never a partial load", () => {
  const rejectsFile = async (variant, matcher) => {
    const file = seed(variant);
    const res = load(scratchArgs(file));
    expect(res.code).toBe(1);
    expect(res.out).toMatch(/REJECTED/);
    expect(res.out).toMatch(matcher);
    expect(res.out).toMatch(/nothing written/);
    expect(res.out).toMatch(/weeks=0 rows=0 rejected=[1-9]/);
    // ZERO documents — not the 26 weeks that were fine.
    expect(await db.collection("programmes").countDocuments({})).toBe(0);
    return res;
  };

  test("one row without emphasis rejects the whole file and names the line", async () => {
    await rejectsFile("emphasis-missing", /line 6:.*emphasis is required/s);
  });

  test("an out-of-enum emphasis", async () => {
    await rejectsFile("emphasis-out-of-enum", /line 6:.*emphasis must be one of/);
  });

  test("added-2022 with no legend on the document", async () => {
    await rejectsFile("emphasis-added-without-legend", /requires the document's emphasisLegend/);
  });

  test("a second programme line", async () => {
    await rejectsFile("second-programme-line", /a second programme line/);
  });

  test("26 weeks", async () => {
    await rejectsFile("weeks-26", /expected 27 week lines, found 26/);
  });

  test("a week with empty source.pdfPages", async () => {
    await rejectsFile("pdfpages-empty", /source\.pdfPages must be a non-empty array/);
  });

  test("a field named trimester", async () => {
    await rejectsFile("trimester-on-week", /trimester has no source/);
  });

  test("a line that is not valid JSON", async () => {
    const file = path.join(tmp, "broken.jsonl");
    const lines = F.toJsonl(F.variant("valid")).split("\n");
    lines[4] = "{not json";
    fs.writeFileSync(file, lines.join("\n"), "utf8");
    const res = load(scratchArgs(file));
    expect(res.code).toBe(1);
    expect(res.out).toMatch(/line 5: not valid JSON/);
    expect(await db.collection("programmes").countDocuments({})).toBe(0);
  });

  test("every bad line is reported, not just the first", async () => {
    const file = F.writeVariant(path.join(tmp, "many"), "valid", (lines) => {
      delete lines[5].rows[0].emphasis;
      lines[9].source.pdfPages = [];
      lines[0].units[0].trimester = 1;
      return lines;
    });
    const res = load(scratchArgs(file));
    expect(res.code).toBe(1);
    expect(res.out).toMatch(/emphasis is required/);
    expect(res.out).toMatch(/pdfPages must be a non-empty array/);
    expect(res.out).toMatch(/trimester has no source/);
    expect(res.out).toMatch(/rejected=[3-9]/);
  });
});

describe("be-2 · CLI surface", () => {
  test("--file is required", () => {
    const res = load(["--db", SCRATCH]);
    expect(res.code).toBe(1);
    expect(res.out).toMatch(/--file <path>\.jsonl is required/);
  });

  test("a missing file is named, not stack-traced", () => {
    const res = load(scratchArgs(path.join(tmp, "nope.jsonl")));
    expect(res.code).toBe(1);
    expect(res.out).toMatch(/no such file/);
  });

  test("every run prints the one-line report", () => {
    const file = seed("valid");
    for (const args of [scratchArgs(file), scratchArgs(file), scratchArgs(file, "--dry-run")]) {
      expect(load(args).out).toMatch(/^load-programmes: file=\S+ db=/m);
    }
  });

  /**
   * `--db` names the database in BOTH corpus CLIs or it is refused — one parse, shared with
   * the verifier (`scripts/lib/db-arg.mjs`). The loader's half of that is the misparse
   * be-2's review found: `--db --correct` silently targeted a database literally named
   * "--correct". The argument that decides WHERE to write never resolves out of sight.
   */
  test("--db followed by a flag is refused, not used as the database name", async () => {
    const res = load(["--file", seed("valid"), "--db", "--correct"]);
    expect(res.code).toBe(1);
    expect(res.out).toMatch(/--db needs a database name/);
    // The database that used to be created is not there.
    const dbs = (await mongo.db("admin").admin().listDatabases()).databases.map((d) => d.name);
    expect(dbs).not.toContain("--correct");
  });

  test("--db-name with no value is refused too", () => {
    const res = load(["--file", seed("valid"), "--db-name"]);
    expect(res.code).toBe(1);
    expect(res.out).toMatch(/--db-name needs a database name/);
  });

  test("every report line says which database, and where the name came from", () => {
    const out = load(scratchArgs(seed("valid"))).out;
    expect(out).toMatch(new RegExp(`db=${SCRATCH} db-from=--db `));
  });
});

describe("be-4 · the live-database guard", () => {
  // A scratch database made to LOOK live — it holds a collection named `subjects` and
  // nothing else. The guard keys on the collection names actually present, so this is
  // indistinguishable from the real thing as far as the loader is concerned, and no test
  // ever has to point at teacher_saas to prove the guard works.
  const LOOKS_LIVE = "programme_corpus_ci_live";

  /** Run the loader with MONGO_DB scrubbed, so the default really is the default. */
  function loadNoDb(args) {
    const env = { ...process.env, MONGO_URL: MONGO };
    delete env.MONGO_DB;
    try {
      return { code: 0, out: execFileSync("node", [SCRIPT, ...args], { encoding: "utf8", env, stdio: ["ignore", "pipe", "pipe"] }) };
    } catch (err) {
      return { code: err.status ?? -1, out: `${err.stdout ?? ""}${err.stderr ?? ""}` };
    }
  }

  beforeEach(async () => {
    await mongo.db(LOOKS_LIVE).dropDatabase();
    await mongo.db(LOOKS_LIVE).collection("subjects").insertOne({ marker: "not a real subject" });
  });

  afterAll(async () => {
    await mongo.db(LOOKS_LIVE).dropDatabase();
  });

  test("a database holding the product's collections is refused, and nothing is written", async () => {
    const file = seed("valid");
    const res = load(["--file", file, "--db", LOOKS_LIVE]);
    expect(res.code).toBe(4);
    expect(res.out).toMatch(/REFUSED — database "programme_corpus_ci_live" holds the product's live collections: subjects/);
    expect(res.out).toMatch(/--allow-live-db/);
    expect(res.out).toMatch(/weeks=0 rows=0 rejected=0 action=refused-live-db/);

    const names = (await mongo.db(LOOKS_LIVE).listCollections().toArray()).map((c) => c.name);
    expect(names).toEqual(["subjects"]);
  });

  test("the guard fires under --dry-run too — a guard that trusts its own flag is not a guard", async () => {
    const file = seed("valid");
    const res = load(["--file", file, "--db", LOOKS_LIVE, "--dry-run"]);
    expect(res.code).toBe(4);
    expect(res.out).toMatch(/action=refused-live-db/);
  });

  test("--allow-live-db is the only way through, and it does let the load happen", async () => {
    const file = seed("valid");
    const res = load(["--file", file, "--db", LOOKS_LIVE, "--allow-live-db"]);
    expect(res.code).toBe(0);
    expect(res.out).toMatch(/action=inserted/);
    expect(await mongo.db(LOOKS_LIVE).collection("programmes").countDocuments({})).toBe(1);
  });

  test("all four live collection names trip it, one at a time", async () => {
    const file = seed("valid");
    for (const name of ["subjects", "teachers", "exercise_revisions", "solutions"]) {
      await mongo.db(LOOKS_LIVE).dropDatabase();
      await mongo.db(LOOKS_LIVE).collection(name).insertOne({ marker: 1 });
      const res = load(["--file", file, "--db", LOOKS_LIVE]);
      expect(res.code).toBe(4);
      expect(res.out).toContain(`live collections: ${name}`);
    }
  });

  test("a scratch database with no live collections is not affected", async () => {
    const file = seed("valid");
    expect(load(scratchArgs(file)).code).toBe(0);
  });

  test("THE CASE THIS EXISTS FOR: a forgotten --db falls back to teacher_saas and is refused", async () => {
    const before = (await mongo.db(REAL_DB).listCollections().toArray()).map((c) => c.name).sort();
    const file = seed("valid");

    const res = loadNoDb(["--file", file]);

    expect(res.code).toBe(4);
    expect(res.out).toMatch(/database "teacher_saas" holds the product's live collections/);
    expect(res.out).toMatch(/action=refused-live-db/);

    // The whole point: teacher_saas gained nothing — not a document, not a collection.
    const after = (await mongo.db(REAL_DB).listCollections().toArray()).map((c) => c.name).sort();
    // before/after IS the assertion — a fixed list here was re-baselined out in be-9,
    // because the corpus collections this job creates are not a perimeter breach.
    expect(after).toEqual(before);
  });
});

/**
 * be-11 — QA's B2 at the CLI: exit 5, and the two flags that must never be one flag.
 *
 * `--correct` says "we misread our own page"; `--new-edition` says "the ministry revised the
 * programme". The store module holds the state table (see the be-11 clauses there); these
 * clauses pin what an OPERATOR sees, because the failure QA was pointing at is an operator
 * failure — a wrong edition string that exits 0 and reports `inserted`.
 */
describe("be-11 · a new edition needs saying so", () => {
  /** The same document at a later edition, content changed as a real revision would be. */
  function nextEditionLines(edition = "2023-09") {
    const lines = F.variant("valid");
    lines[0].edition = edition;
    for (const l of lines) if (l.type === "week") l.hours = 7;
    return lines;
  }

  const write = (name, lines) => F.writeJsonl(tmp, name, lines);

  test("a second edition exits 5, names what is already stored, and writes nothing", async () => {
    expect(load(scratchArgs(seed("valid"))).code).toBe(0);

    const res = load(scratchArgs(write("e2-refused", nextEditionLines())));
    expect(res.code).toBe(5);
    expect(res.out).toMatch(/REFUSED/);
    expect(res.out).toMatch(/already stored at 2022-09/);
    expect(res.out).toMatch(/2023-09/);
    // Both ways out are named — this is the message an operator acts on.
    expect(res.out).toMatch(/--new-edition/);
    expect(res.out).toMatch(/--correct can never change a document's edition/);
    expect(res.out).toMatch(/action=refused-new-edition/);

    expect(await db.collection("programmes").countDocuments({})).toBe(1);
  });

  test("--new-edition loads it, and never reports it in the same words as a first load", async () => {
    expect(load(scratchArgs(seed("valid"))).code).toBe(0);

    const res = load(scratchArgs(write("e2-declared", nextEditionLines()), "--new-edition"));
    expect(res.code).toBe(0);
    expect(res.out).toMatch(/NEW EDITION fixture-3as-math @ 2023-09/);
    expect(res.out).toMatch(/already held: 2022-09 — none was modified/);
    expect(res.out).toMatch(/current is now 2023-09/);
    expect(res.out).toMatch(/action=new-edition/);

    const docs = await db.collection("programmes").find({ docKey: "fixture-3as-math" }).toArray();
    expect(docs).toHaveLength(2);
    expect(docs.filter((d) => d.current === true).map((d) => d.edition)).toEqual(["2023-09"]);
  });

  test("--correct with --new-edition is refused before a connection is even opened", async () => {
    expect(load(scratchArgs(seed("valid"))).code).toBe(0);

    const args = scratchArgs(write("e2-both", nextEditionLines()), "--correct", "--new-edition");
    const res = load(args);
    expect(res.code).toBe(1);
    expect(res.out).toMatch(/two different version axes/);
    expect(await db.collection("programmes").countDocuments({})).toBe(1);

    // "Before a connection" is the claim, so point it at a port nothing is listening on:
    // a contradiction the tool has to connect in order to notice is a contradiction it
    // reports as a Mongo timeout.
    let offline;
    try {
      execFileSync("node", [SCRIPT, ...args], {
        encoding: "utf8",
        env: { ...process.env, MONGO_URL: "mongodb://127.0.0.1:1" },
        stdio: ["ignore", "pipe", "pipe"],
      });
      offline = { code: 0, out: "" };
    } catch (err) {
      offline = { code: err.status ?? -1, out: `${err.stdout ?? ""}${err.stderr ?? ""}` };
    }
    expect(offline.code).toBe(1);
    expect(offline.out).toMatch(/two different version axes/);
    expect(offline.out).not.toMatch(/ECONNREFUSED|ServerSelection/);
  });

  test("--correct alone cannot bring an edition into being — it exits 5, not 0", async () => {
    expect(load(scratchArgs(seed("valid"))).code).toBe(0);

    const res = load(scratchArgs(write("e2-correct", nextEditionLines()), "--correct"));
    expect(res.code).toBe(5);

    const docs = await db.collection("programmes").find({ docKey: "fixture-3as-math" }).toArray();
    expect(docs).toHaveLength(1);
    expect(docs[0].edition).toBe("2022-09");
    expect(docs[0].transcriptionRev).toBe(1);
    expect(await db.collection("programme_revisions").countDocuments({})).toBe(0);
  });

  test("THE CASE THIS EXISTS FOR: a mistyped edition is a FILE error, not a third document", async () => {
    expect(load(scratchArgs(seed("valid"))).code).toBe(0);

    // `2022-9` for `2022-09`. It used to insert, take `current`, and exit 0 reporting
    // `inserted` — a typo indistinguishable from the ministry revising the programme.
    const res = load(scratchArgs(write("e2-typo", nextEditionLines("2022-9"))));
    expect(res.code).toBe(1);
    expect(res.out).toMatch(/edition "2022-9" must be YYYY-MM/);
    expect(res.out).toMatch(/action=rejected/);

    expect(await db.collection("programmes").countDocuments({})).toBe(1);
    expect((await db.collection("programmes").findOne({})).current).toBe(true);
  });

  test("--dry-run on a new edition decides and writes nothing", async () => {
    expect(load(scratchArgs(seed("valid"))).code).toBe(0);

    const res = load(
      scratchArgs(write("e2-dry", nextEditionLines()), "--new-edition", "--dry-run"),
    );
    expect(res.code).toBe(0);
    expect(res.out).toMatch(/DRY-RUN/);
    expect(res.out).toMatch(/weeks=0 rows=0/);
    expect(await db.collection("programmes").countDocuments({})).toBe(1);
  });

  test("--new-edition changes nothing about a single-edition corpus", async () => {
    // The flag is inert where there is no second edition: insert, then idempotent no-op.
    const file = seed("valid");
    expect(load(scratchArgs(file, "--new-edition")).out).toMatch(/inserted fixture-3as-math/);
    expect(load(scratchArgs(file)).out).toMatch(/unchanged/);
    expect(load(scratchArgs(file, "--new-edition")).out).toMatch(/unchanged/);
    expect(await db.collection("programmes").countDocuments({})).toBe(1);
  });

  test("the usage line offers --new-edition", () => {
    const res = load([]);
    expect(res.code).toBe(1);
    expect(res.out).toMatch(/\[--new-edition\]/);
  });
});

describe("be-2 · perimeter", () => {
  test("teacher_saas is untouched by this suite", async () => {
    // RE-BASELINED (be-9). This asserted a fixed four-collection list, which was true
    // until be-4 loaded the corpus into teacher_saas — the deliverable of this very job.
    // The clause's NAME was always the real intent: the product's collections are not
    // disturbed. So it now asserts that, and tolerates the corpus collections this job
    // exists to create. A product collection disappearing is still a hard failure.
    const PRODUCT = ["exercise_revisions", "solutions", "subjects", "teachers"];
    const CORPUS = ["programme_revisions", "programmes"];
    const names = (await mongo.db(REAL_DB).listCollections().toArray()).map((c) => c.name).sort();
    for (const c of PRODUCT) expect(names).toContain(c);
    expect(names.filter((n) => !PRODUCT.includes(n) && !CORPUS.includes(n))).toEqual([]);
  });

  test("run-log.jsonl is neither written nor created", () => {
    const after = fs.existsSync(RUN_LOG) ? fs.statSync(RUN_LOG) : null;
    if (runLogBefore === null) {
      expect(after).toBeNull();
    } else {
      expect(after.size).toBe(runLogBefore.size);
      expect(after.mtimeMs).toBe(runLogBefore.mtimeMs);
    }
  });
});
