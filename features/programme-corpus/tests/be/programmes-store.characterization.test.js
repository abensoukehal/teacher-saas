/**
 * be-1 — `src/store/programmes.ts`: one definition of the shape.
 *
 * The corpus has no consumer (SEED §6.3), so nothing downstream would ever notice a
 * schema that quietly accepted a bad row. This suite IS the perimeter: it pins the
 * rejects (every one of which is a way a 73-page transcription loses meaning silently),
 * the canonical hash, and the loader state table the two scripts share.
 *
 * Writes only to the scratch db `programme_corpus_ci`, dropped at the end. `teacher_saas`
 * is asserted unchanged.
 */
const { execFileSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");
const { MongoClient } = require("mongodb");
const F = require("./fixtures/seed-fixtures");

const ROOT = process.env.CHAR_ROOTDIR ?? ".";
const MODULE = path.resolve(ROOT, "dist/store/programmes.js");
const PROBE = path.join(__dirname, "fixtures", "probe-programmes.mjs");
const MONGO = process.env.MONGO_URL ?? "mongodb://127.0.0.1:27017";
const SCRATCH = "programme_corpus_ci";
const REAL_DB = "teacher_saas";

let mongo;
let db;

/** Call the store module through the ESM probe. Returns {ok, value} | {ok, error}. */
function probe(op, payload = {}) {
  const out = execFileSync("node", [PROBE, op], {
    input: JSON.stringify({ mongoUrl: MONGO, dbName: SCRATCH, ...payload }),
    encoding: "utf8",
    env: { ...process.env, PROBE_MODULE: MODULE },
    stdio: ["pipe", "pipe", "pipe"],
  });
  const line = out.trim().split("\n").filter(Boolean).pop();
  return JSON.parse(line);
}

/** Assert a fixture variant is REJECTED, and return the problems it named. */
function rejects(variantName) {
  const res = probe("assemble", { lines: F.variant(variantName) });
  expect(res.ok).toBe(false);
  expect(res.error.name).toBe("SeedError");
  expect(Array.isArray(res.error.problems)).toBe(true);
  expect(res.error.problems.length).toBeGreaterThan(0);
  return res.error.problems;
}

beforeAll(async () => {
  // A hollow gate is not a pass: if the build is missing, fail loudly here.
  if (!fs.existsSync(MODULE)) {
    throw new Error(
      `${MODULE} is missing — run \`npm run build\` in stacks/teacher-be before gating.`,
    );
  }
  mongo = new MongoClient(MONGO);
  await mongo.connect();
  db = mongo.db(SCRATCH);
  await db.dropDatabase();
});

afterAll(async () => {
  if (db) await db.dropDatabase();
  if (mongo) await mongo.close();
});

describe("be-1 · the seed grammar validates", () => {
  test("the valid fixture assembles into a 27-week document", () => {
    const res = probe("assemble", { lines: F.variant("valid") });
    expect(res.ok).toBe(true);
    const doc = res.value;
    expect(doc.docKey).toBe("fixture-3as-math");
    expect(doc.weeklyHours).toBe(7);
    expect(doc.totals).toEqual({
      weeks: 27,
      hours: 189,
      weeksText: "27 أسبوع",
      hoursText: "189 ساعة",
    });
    expect(doc.weeks).toHaveLength(27);
    expect(doc.weeks.map((w) => w.week)).toEqual(Array.from({ length: 27 }, (_, i) => i + 1));
    // `type` is a line discriminator, not a fact about the programme.
    expect(doc.type).toBeUndefined();
    expect(doc.weeks.every((w) => w.type === undefined)).toBe(true);
  });

  test("the assembled document keeps the fields the contract names", () => {
    const doc = probe("assemble", { lines: F.variant("valid") }).value;
    expect(Object.keys(doc).sort()).toEqual(
      [
        "competencies",
        "docKey",
        "edition",
        "emphasisLegend",
        "frontMatter",
        "level",
        "source",
        "streams",
        "totals",
        "units",
        "weeklyHours",
        "weeks",
      ].sort(),
    );
  });

  test("competencies may be null, and null is not []", () => {
    const lines = F.clone(F.variant("valid"));
    lines[0].competencies = null;
    expect(probe("assemble", { lines }).ok).toBe(true);

    const empty = F.clone(F.variant("valid"));
    empty[0].competencies = [];
    const res = probe("assemble", { lines: empty });
    expect(res.ok).toBe(false);
    expect(res.error.problems.join("\n")).toMatch(/competencies must be null or a non-empty array/);
  });

  test("a week's printed number may be null while its ordinal is not", () => {
    const doc = probe("assemble", { lines: F.variant("valid") }).value;
    expect(doc.weeks[2].weekNumberPrinted).toBeNull();
    expect(doc.weeks[2].week).toBe(3);
  });

  test("emphasis has exactly the three contract values", () => {
    expect(probe("constants").value.EMPHASIS_VALUES).toEqual([
      "normal",
      "added-2022",
      "red-unlegended",
    ]);
  });
});

describe("be-1 · rejects — one fixture per way meaning is lost", () => {
  test("a row without emphasis", () => {
    expect(rejects("emphasis-missing").join("\n")).toMatch(/line 6:.*emphasis is required/s);
  });

  test("an out-of-enum emphasis", () => {
    expect(rejects("emphasis-out-of-enum").join("\n")).toMatch(
      /line 6:.*emphasis must be one of normal \| added-2022 \| red-unlegended/,
    );
  });

  test("added-2022 under a document with no legend", () => {
    expect(rejects("emphasis-added-without-legend").join("\n")).toMatch(
      /line 6:.*"added-2022" requires the document's emphasisLegend to be set/,
    );
  });

  test("red-unlegended under a document that HAS a legend", () => {
    expect(rejects("emphasis-unlegended-with-legend").join("\n")).toMatch(
      /line 6:.*"red-unlegended" is only legal when emphasisLegend is null/,
    );
  });

  test("a week with empty source.pdfPages", () => {
    expect(rejects("pdfpages-empty").join("\n")).toMatch(
      /line 8:.*source\.pdfPages must be a non-empty array of integers/,
    );
  });

  test("26 weeks", () => {
    expect(rejects("weeks-26").join("\n")).toMatch(/expected 27 week lines, found 26/);
  });

  test("a week repeated", () => {
    expect(rejects("week-repeated").join("\n")).toMatch(/line 16: week 14 is repeated/);
  });

  test("a field named trimester on a week", () => {
    expect(rejects("trimester-on-week").join("\n")).toMatch(
      /line 10: "trimester" — trimester has no source/,
    );
  });

  test("a field named trimester nested inside a unit", () => {
    expect(rejects("trimester-on-unit").join("\n")).toMatch(
      /line 1: "units\[0\]\.trimester" — trimester has no source/,
    );
  });

  test("a unitId no unit declares", () => {
    expect(rejects("unit-id-orphan").join("\n")).toMatch(
      /line 10: unitId "u99" is not one of the document's assigned unit ids/,
    );
  });

  test("a second programme line", () => {
    expect(rejects("second-programme-line").join("\n")).toMatch(/a second programme line/);
  });

  test("every problem is reported, not just the first", () => {
    const lines = F.clone(F.variant("valid"));
    delete lines[5].rows[0].emphasis;
    lines[9].source.pdfPages = [];
    lines[0].units[0].trimester = 1;
    const res = probe("assemble", { lines });
    expect(res.ok).toBe(false);
    expect(res.error.problems.length).toBeGreaterThanOrEqual(3);
    const all = res.error.problems.join("\n");
    expect(all).toMatch(/emphasis is required/);
    expect(all).toMatch(/pdfPages must be a non-empty array/);
    expect(all).toMatch(/trimester/);
  });

  test("unit ids are unique even though unit names repeat", () => {
    const doc = probe("assemble", { lines: F.variant("valid") }).value;
    const names = doc.units.filter((u) => u.name === "معالجة");
    expect(names).toHaveLength(3);
    expect(new Set(doc.units.map((u) => u.id)).size).toBe(doc.units.length);

    const dup = F.clone(F.variant("valid"));
    dup[0].units[10].id = dup[0].units[6].id;
    const res = probe("assemble", { lines: dup });
    expect(res.ok).toBe(false);
    expect(res.error.problems.join("\n")).toMatch(/is used twice — unit ids are assigned and unique/);
  });
});

describe("be-1 · canonicalContentHash", () => {
  let doc;
  beforeAll(() => {
    doc = probe("assemble", { lines: F.variant("valid") }).value;
  });

  test("is stable across key order", () => {
    const shuffled = {};
    for (const k of Object.keys(doc).sort().reverse()) shuffled[k] = doc[k];
    shuffled.source = Object.fromEntries(Object.entries(doc.source).reverse());
    expect(probe("hash", { doc: shuffled }).value).toBe(probe("hash", { doc }).value);
  });

  test("ignores transcriptionRev, current, timestamps and _id", () => {
    const base = probe("hash", { doc }).value;
    const decorated = {
      ...doc,
      _id: "68a0000000000000000000aa",
      contentHash: "deadbeef",
      transcriptionRev: 9,
      current: false,
      createdAt: "2020-01-01T00:00:00.000Z",
      updatedAt: "2021-01-01T00:00:00.000Z",
    };
    expect(probe("hash", { doc: decorated }).value).toBe(base);
    expect(probe("constants").value.CONTENT_HASH_EXCLUDES.sort()).toEqual(
      ["_id", "contentHash", "createdAt", "current", "transcriptionRev", "updatedAt"].sort(),
    );
  });

  test("changes when one Arabic character of the transcription changes", () => {
    const base = probe("hash", { doc }).value;
    const edited = JSON.parse(JSON.stringify(doc));
    edited.weeks[5].rows[0].contents[0] += "ـ"; // one kashida
    expect(probe("hash", { doc: edited }).value).not.toBe(base);
  });

  test("changes when array ORDER changes — order is data here", () => {
    const base = probe("hash", { doc }).value;
    const reordered = JSON.parse(JSON.stringify(doc));
    const rows = reordered.weeks[1].rows;
    [rows[0], rows[1]] = [rows[1], rows[0]];
    expect(probe("hash", { doc: reordered }).value).not.toBe(base);
  });

  test("is 64 hex characters", () => {
    expect(probe("hash", { doc }).value).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("be-1 · upsertProgramme — the loader state table", () => {
  const lines = () => F.variant("valid");

  beforeEach(async () => {
    await db.dropDatabase();
  });

  test("insert, then the same file again is a no-op", async () => {
    const first = probe("upsert", { lines: lines() });
    expect(first.ok).toBe(true);
    expect(first.value.action).toBe("inserted");
    expect(first.value.transcriptionRev).toBe(1);

    const second = probe("upsert", { lines: lines() });
    expect(second.value.action).toBe("unchanged");
    expect(second.value.transcriptionRev).toBe(1);

    expect(await db.collection("programmes").countDocuments({})).toBe(1);
    const stored = await db.collection("programmes").findOne({ docKey: "fixture-3as-math" });
    expect(stored.current).toBe(true);
    expect(stored.contentHash).toBe(first.value.contentHash);
    expect(stored.weeks).toHaveLength(27);
  });

  test("the indexes the contract names exist", async () => {
    probe("upsert", { lines: lines() });
    const names = (await db.collection("programmes").indexes()).map((i) => i.name);
    expect(names).toEqual(
      expect.arrayContaining(["docKey_1_edition_1", "streams_1_current_1", "docKey_1_current_1"]),
    );
    const unique = (await db.collection("programmes").indexes()).find(
      (i) => i.name === "docKey_1_edition_1",
    );
    expect(unique.unique).toBe(true);
    const partial = (await db.collection("programmes").indexes()).find(
      (i) => i.name === "docKey_1_current_1",
    );
    expect(partial.partialFilterExpression).toEqual({ current: true });

    const revIdx = (await db.collection("programme_revisions").indexes()).map((i) => i.name);
    expect(revIdx).toContain("docKey_1_edition_1_transcriptionRev_1");
  });

  test("a changed file is REFUSED without correct, and the DB is untouched", async () => {
    probe("upsert", { lines: lines() });
    const before = await db.collection("programmes").findOne({ docKey: "fixture-3as-math" });

    const changed = F.clone(lines());
    changed[6].rows[0].contents[0] = "محتوى مصحّح";
    const res = probe("upsert", { lines: changed });
    expect(res.ok).toBe(true);
    expect(res.value.action).toBe("refused");
    expect(res.value.differences.join("\n")).toMatch(/weeks\[5\]\.rows\[0\]\.contents\[0\]/);

    const after = await db.collection("programmes").findOne({ docKey: "fixture-3as-math" });
    expect(after.contentHash).toBe(before.contentHash);
    expect(after.transcriptionRev).toBe(1);
    expect(await db.collection("programme_revisions").countDocuments({})).toBe(0);
  });

  test("correct records the superseded document and bumps transcriptionRev", async () => {
    probe("upsert", { lines: lines() });
    const before = await db.collection("programmes").findOne({ docKey: "fixture-3as-math" });

    const changed = F.clone(lines());
    changed[6].rows[0].contents[0] = "محتوى مصحّح";
    const res = probe("upsert", {
      lines: changed,
      opts: { correct: true, note: "layer-2 fix" },
    });
    expect(res.value.action).toBe("corrected");
    expect(res.value.transcriptionRev).toBe(2);

    expect(await db.collection("programmes").countDocuments({})).toBe(1);
    const after = await db.collection("programmes").findOne({ docKey: "fixture-3as-math" });
    expect(after.transcriptionRev).toBe(2);
    expect(after.weeks[5].rows[0].contents[0]).toBe("محتوى مصحّح");
    expect(after.createdAt).toEqual(before.createdAt);

    const revs = await db.collection("programme_revisions").find({}).toArray();
    expect(revs).toHaveLength(1);
    expect(revs[0].transcriptionRev).toBe(1);
    expect(revs[0].note).toBe("layer-2 fix");
    // The SUPERSEDED document, verbatim.
    expect(revs[0].doc.contentHash).toBe(before.contentHash);
    expect(revs[0].doc.weeks[5].rows[0].contents[0]).toBe(before.weeks[5].rows[0].contents[0]);
  });

  test("a hand-edit in Mongo throws — the DB is wrong and the file is right", async () => {
    probe("upsert", { lines: lines() });
    await db
      .collection("programmes")
      .updateOne({ docKey: "fixture-3as-math" }, { $set: { "totals.hours": 181 } });

    const res = probe("upsert", { lines: lines() });
    expect(res.ok).toBe(false);
    expect(res.error.name).toBe("HandEditError");
    expect(res.error.message).toMatch(/DB is wrong and the file is right/);
    expect(res.error.storedHash).not.toBe(res.error.recomputedHash);

    // Even --correct must not paper over it.
    const forced = probe("upsert", { lines: lines(), opts: { correct: true } });
    expect(forced.ok).toBe(false);
    expect(forced.error.name).toBe("HandEditError");
    expect(await db.collection("programme_revisions").countDocuments({})).toBe(0);
  });

  test("dryRun decides without writing", async () => {
    const res = probe("upsert", { lines: lines(), opts: { dryRun: true } });
    expect(res.value.action).toBe("inserted");
    expect(res.value.dryRun).toBe(true);
    expect(await db.collection("programmes").countDocuments({})).toBe(0);
  });

  /**
   * RE-ORACLED (be-11, QA's B2). This clause used to load a second edition with no flag and
   * assert it demoted the first. That silent path is the defect: a first load and a whole
   * new ministry edition printed the same word, so a MISTYPED edition entered the corpus and
   * took `current` while exiting 0. The demotion itself is still the contract and is still
   * asserted here — what changed is that reaching it is now a declared act.
   */
  test("loading a newer edition demotes the older one — one current per docKey", async () => {
    probe("upsert", { lines: lines() });
    const next = F.clone(lines());
    next[0].edition = "2023-09";
    for (const l of next) if (l.type === "week") l.hours = 7;
    probe("upsert", { lines: next, opts: { newEdition: true } });

    const docs = await db.collection("programmes").find({ docKey: "fixture-3as-math" }).toArray();
    expect(docs).toHaveLength(2);
    expect(docs.filter((d) => d.current === true)).toHaveLength(1);
    expect(docs.find((d) => d.current === true).edition).toBe("2023-09");

    const current = probe("get", { docKey: "fixture-3as-math" });
    expect(current.value.edition).toBe("2023-09");
    const pinned = probe("get", { docKey: "fixture-3as-math", opts: { edition: "2022-09" } });
    expect(pinned.value.edition).toBe("2022-09");
  });

  test("getProgramme returns null for a docKey that was never loaded", () => {
    expect(probe("get", { docKey: "no-such-doc" }).value).toBeNull();
  });
});

/**
 * be-11 — QA's B2: the edition axis.
 *
 * SEED §3.1 keeps two version axes apart on purpose: `edition` is the MINISTRY revising the
 * programme, `transcriptionRev` is US fixing our own reading of an unchanged page. The SEED's
 * words: collapsing them "would make 'the syllabus changed' indistinguishable from 'we
 * misread a number'". These clauses pin every way the two could still run together.
 *
 * What QA reported — that no code path could create a second edition, and that `--correct`
 * absorbed a new edition into the old document — did NOT reproduce: the lookup was already
 * keyed on `{docKey, edition}`. Two real defects were behind the concern, both reproduced
 * against a scratch database before anything was written:
 *
 *   1. `current` followed the LAST LOAD, not the greatest edition. Correcting a typo in the
 *      2022-09 transcription while 2023-09 was current handed `current` back to 2022-09 and
 *      exited 0 — a transcription fix silently rewinding the syllabus.
 *   2. A new edition was an unannounced insert with no format rule, so `2022-9` for
 *      `2022-09` created a third document, took `current`, and reported `inserted` in the
 *      same words as a first load.
 */
describe("be-11 · a new edition is a new document, and a declared one", () => {
  const lines = () => F.variant("valid");

  /** The same document at a later edition — content differs, as a real revision would. */
  function nextEdition(edition = "2023-09") {
    const next = F.clone(lines());
    next[0].edition = edition;
    for (const l of next) if (l.type === "week") l.hours = 7;
    return next;
  }

  beforeEach(async () => {
    await db.dropDatabase();
  });

  test("a second edition is REFUSED without newEdition, and nothing is written", async () => {
    probe("upsert", { lines: lines() });
    const res = probe("upsert", { lines: nextEdition() });

    expect(res.ok).toBe(true);
    expect(res.value.action).toBe("refused-new-edition");
    // A refusal that does not say what is already there cannot be acted on.
    expect(res.value.storedEditions).toEqual(["2022-09"]);
    expect(await db.collection("programmes").countDocuments({})).toBe(1);
    expect(await db.collection("programme_revisions").countDocuments({})).toBe(0);
  });

  test("with newEdition it becomes a NEW document — the previous one keeps its own record", async () => {
    const first = probe("upsert", { lines: lines() });
    const res = probe("upsert", { lines: nextEdition(), opts: { newEdition: true } });

    expect(res.value.action).toBe("new-edition");
    expect(res.value.transcriptionRev).toBe(1);
    expect(res.value.currentEdition).toBe("2023-09");

    const docs = await db.collection("programmes").find({ docKey: "fixture-3as-math" }).toArray();
    expect(docs).toHaveLength(2);

    // The old document is untouched apart from `current`: same rev, same hash, same content.
    const old = docs.find((d) => d.edition === "2022-09");
    expect(old.transcriptionRev).toBe(1);
    expect(old.contentHash).toBe(first.value.contentHash);
    expect(old.current).toBe(false);
    // A new edition is not a supersession of OUR reading, so it writes no revision row.
    expect(await db.collection("programme_revisions").countDocuments({})).toBe(0);
  });

  test("THE DEFECT: correcting the OLD edition does not steal current from the newer one", async () => {
    probe("upsert", { lines: lines() });
    probe("upsert", { lines: nextEdition(), opts: { newEdition: true } });

    // A transcription fix to 2022-09 — our reading of an unchanged page.
    const fixed = F.clone(lines());
    fixed[0].frontMatter.intro = `${fixed[0].frontMatter.intro} (تصحيح نسخ)`;
    const res = probe("upsert", { lines: fixed, opts: { correct: true } });

    expect(res.value.action).toBe("corrected");
    expect(res.value.edition).toBe("2022-09");
    expect(res.value.transcriptionRev).toBe(2);
    // `current` follows the greatest EDITION, never the last load.
    expect(res.value.currentEdition).toBe("2023-09");

    const docs = await db.collection("programmes").find({ docKey: "fixture-3as-math" }).toArray();
    expect(docs.filter((d) => d.current === true)).toHaveLength(1);
    expect(docs.find((d) => d.current === true).edition).toBe("2023-09");
    expect(probe("get", { docKey: "fixture-3as-math" }).value.edition).toBe("2023-09");
  });

  test("correct and newEdition together is refused — they name the two different axes", () => {
    probe("upsert", { lines: lines() });
    const res = probe("upsert", {
      lines: nextEdition(),
      opts: { correct: true, newEdition: true },
    });

    expect(res.ok).toBe(false);
    expect(res.error.name).toBe("ContradictoryAxesError");
  });

  test("correct can never change a document's edition — it is keyed on {docKey, edition}", async () => {
    const first = probe("upsert", { lines: lines() });
    // `--correct` alone, on a file whose edition moved: the new-edition branch refuses first,
    // so the correction path is unreachable and 2022-09 is not rewritten to 2023-09.
    const res = probe("upsert", { lines: nextEdition(), opts: { correct: true } });

    expect(res.value.action).toBe("refused-new-edition");
    const docs = await db.collection("programmes").find({ docKey: "fixture-3as-math" }).toArray();
    expect(docs).toHaveLength(1);
    expect(docs[0].edition).toBe("2022-09");
    expect(docs[0].transcriptionRev).toBe(1);
    expect(docs[0].contentHash).toBe(first.value.contentHash);
  });

  test("newEdition never rewrites an edition that is already stored — that is a correction", async () => {
    probe("upsert", { lines: lines() });
    const changed = F.clone(lines());
    changed[0].frontMatter.intro = `${changed[0].frontMatter.intro} (تغيير)`;
    // Same edition, changed content: declaring a new edition does not make it one.
    const res = probe("upsert", { lines: changed, opts: { newEdition: true } });

    expect(res.value.action).toBe("refused");
    expect(await db.collection("programmes").countDocuments({})).toBe(1);
    expect((await db.collection("programmes").findOne({})).transcriptionRev).toBe(1);
  });

  test("newEdition on a first-ever load is not an error, and is still an ordinary insert", async () => {
    const res = probe("upsert", { lines: lines(), opts: { newEdition: true } });
    expect(res.value.action).toBe("inserted");
    expect(res.value.storedEditions).toBeUndefined();
    expect(await db.collection("programmes").countDocuments({})).toBe(1);
  });

  test("dryRun on a new edition decides and writes nothing", async () => {
    probe("upsert", { lines: lines() });
    const res = probe("upsert", { lines: nextEdition(), opts: { newEdition: true, dryRun: true } });

    expect(res.value.action).toBe("new-edition");
    expect(res.value.currentEdition).toBe("2023-09");
    expect(await db.collection("programmes").countDocuments({})).toBe(1);
  });

  test("an edition EARLIER than the current one loads, and does not take current", async () => {
    // Backfilling an older edition must not rewind the syllabus either — the rule is the
    // greatest edition, not the newest arrival, in both directions.
    probe("upsert", { lines: nextEdition("2023-09") });
    const res = probe("upsert", { lines: lines(), opts: { newEdition: true } });

    expect(res.value.action).toBe("new-edition");
    expect(res.value.currentEdition).toBe("2023-09");
    expect(probe("get", { docKey: "fixture-3as-math" }).value.edition).toBe("2023-09");
  });
});

describe("be-11 · edition is YYYY-MM, so a typo cannot read as a syllabus revision", () => {
  /** The problems `validateProgrammeLine` reports for a given edition string. */
  function editionProblems(edition) {
    const line = F.programmeLine({ legend: true });
    line.edition = edition;
    return probe("validateProgrammeLine", { line }).value.filter((p) => p.includes("edition"));
  }

  test("the pattern is exported, so the loader and the seed cannot drift", () => {
    expect(probe("constants").value.EDITION_PATTERN).toBe("^\\d{4}-(0[1-9]|1[0-2])$");
  });

  test("2022-09 — the corpus's own edition — is accepted", () => {
    expect(editionProblems("2022-09")).toEqual([]);
  });

  test.each([
    ["2022-9", "unpadded — THE CASE THIS EXISTS FOR: it used to load as a third document"],
    ["2022-13", "not a month"],
    ["2022-00", "not a month"],
    ["2022", "no month at all"],
    ["2022-09-01", "a date, not an edition"],
    ["septembre 2022", "free-form"],
    [" 2022-09", "leading space — a different string, a different document"],
  ])("%s is refused (%s)", (edition) => {
    const problems = editionProblems(edition);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/YYYY-MM/);
  });
});

/**
 * be-11 — QA's B1: the maths legend must keep the page's squash.
 *
 * PDF p18 prints `هوملّون` as ONE cluster — no space, and the shadda on the LAM. The corpus
 * stored `هو ملوّن`: a space inserted and the shadda moved to the WAW. That is the same
 * source-squash class the corpus deliberately PRESERVED for تقني رياضي
 * (`الأحمرلعدم تناولهفي`), so normalising it here was a fidelity loss, not a tidy-up.
 *
 * Confirmed twice before the seed was touched, and the two instruments agree: the PDF's own
 * text layer decodes the cluster as U+0647 U+0648 U+0645 U+0644 U+0651 U+0648 U+0646 with a
 * −0.09pt junction against 3.0pt for every real space on that line, and a 600 dpi render
 * shows the shadda sitting over the lam. The independent layer-2 re-read had it right all
 * along — `--compare` went 112 → 111 discrepancies with the l2 file untouched.
 *
 * This clause reads the SHIPPED seed, not a fixture: the thing that can regress is the
 * corpus, and a future transcription pass would re-normalise it exactly as this one did.
 */
describe("be-11 · the maths legend keeps the page's squash", () => {
  const SEED = path.resolve(__dirname, "..", "..", "..", "..", "data", "programmes", "tadarroj-3as-math.jsonl");

  /** ه و م ل ّ و ن — what page 18 prints. */
  const AS_PRINTED = "هوملّون";
  /** ه و SPACE م ل و ّ ن — what the corpus stored: a space in, the shadda moved. */
  const NORMALISED = "هو ملوّن";

  let head;
  let week24;

  beforeAll(() => {
    const lines = fs.readFileSync(SEED, "utf8").trim().split("\n").map((l) => JSON.parse(l));
    head = lines[0];
    week24 = lines.find((l) => l.type === "week" && l.week === 24);
  });

  test("the legend stores the cluster as printed, not as normalised", () => {
    expect(head.emphasisLegend.text).toContain(AS_PRINTED);
    expect(head.emphasisLegend.text).not.toContain(NORMALISED);
  });

  test("week 24 row 0's guidance carries the SAME string — the legend is printed in that cell", () => {
    expect(week24.rows[0].guidance[0]).toBe(head.emphasisLegend.text);
  });

  test("the rest of the legend is untouched, including the year as printed (2022-2021)", () => {
    // Verified from pixels at 600 dpi while fixing the squash: the page really does print
    // the years in that order, so the l2 file's `2021-2022` is the l2 reader's own
    // normalisation and the seed is right. Nothing else on the line changed.
    expect(head.emphasisLegend.text).toBe(
      `تم ادراج ما ${AS_PRINTED} باللون الأحمر لعدم تناوله في السنة الدراسية 2022-2021`,
    );
    expect(head.emphasisLegend.pdfPage).toBe(18);
  });
});

describe("be-1 · perimeter — the real database is not touched", () => {
  test("teacher_saas holds the same collections before and after this suite", async () => {
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
});
