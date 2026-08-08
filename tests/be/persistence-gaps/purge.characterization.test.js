/**
 * be-5 (hardening) — purge orphaned test subjects.
 *
 * The one irreversible act in the job. The product has no delete route on purpose, so
 * every clause here is about the script REFUSING rather than guessing.
 *
 * The orphan definition changed mid-job: be-2's backfill gave every existing teacherId a
 * `teachers` row, so "no row" matches nothing. An orphan is a subject owned by an
 * ANONYMOUS (never-claimed) row AND older than an explicit --before cutoff.
 *
 * Seeds its own data directly through the driver, because createdAt cannot be backdated
 * through the API — and asserts on ITS OWN documents only, never on global counts, so it
 * is safe to run against a shared database.
 */
const { execFileSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const { MongoClient, ObjectId } = require("mongodb");
const { describeIfLane } = require("guard");

const BE = process.env.CHAR_BE_URL || "http://localhost:9000";
const MONGO = "mongodb://127.0.0.1:27017";
const DB = "teacher_saas";
const ROOT = process.env.CHAR_ROOTDIR ?? ".";
const SCRIPT = path.join(ROOT, "scripts/purge-orphans.mjs");

let mongo;
let db;
let dumpDir;

const OLD = new Date("2020-01-01T00:00:00.000Z");
const CUTOFF = "2021-01-01";
const tag = () => `purge-verify-${Date.now()}-${Math.random().toString(16).slice(2)}`;

function run(args, { expectFail = false } = {}) {
  try {
    const out = execFileSync("node", [SCRIPT, ...args], {
      encoding: "utf8",
      env: { ...process.env, PURGE_DUMP_DIR: dumpDir },
      stdio: "pipe",
    });
    return { code: 0, out };
  } catch (err) {
    if (!expectFail) throw err;
    return { code: err.status, out: `${err.stdout ?? ""}${err.stderr ?? ""}` };
  }
}

/** One anonymous teacher with an OLD subject, one account with an OLD subject. */
async function seed() {
  const anonId = tag().replace(/[^a-f0-9]/g, "a").slice(0, 32).padEnd(32, "b");
  const acctId = tag().replace(/[^a-f0-9]/g, "c").slice(0, 32).padEnd(32, "d");
  await db.collection("teachers").insertMany([
    { teacherId: anonId, email: null, passwordHash: null, recoveryHash: null,
      recoveryUsedAt: null, createdAt: OLD, updatedAt: OLD },
    { teacherId: acctId, email: `${tag()}@example.dz`, passwordHash: "scrypt$x",
      recoveryHash: "scrypt$y", recoveryUsedAt: null, createdAt: OLD, updatedAt: OLD },
  ]);
  const subject = { title: "t", meta: { totalPoints: 20 }, exercises: [{ id: "ex1", label: "l", points: 20, statement: "s" }] };
  const anonOld = (await db.collection("subjects").insertOne(
    { teacherId: anonId, subject, controls: null, genCorrelationId: null, createdAt: OLD, updatedAt: OLD },
  )).insertedId;
  const acctOld = (await db.collection("subjects").insertOne(
    { teacherId: acctId, subject, controls: null, genCorrelationId: null, createdAt: OLD, updatedAt: OLD },
  )).insertedId;
  const anonNew = (await db.collection("subjects").insertOne(
    { teacherId: anonId, subject, controls: null, genCorrelationId: null, createdAt: new Date(), updatedAt: new Date() },
  )).insertedId;
  return { anonId, acctId, anonOld, acctOld, anonNew };
}

const alive = async (id) =>
  (await db.collection("subjects").countDocuments({ _id: new ObjectId(id) })) === 1;

describeIfLane(BE, "be-5 — purge orphans", () => {
  beforeAll(async () => {
    mongo = new MongoClient(MONGO);
    await mongo.connect();
    db = mongo.db(DB);
    dumpDir = fs.mkdtempSync(path.join(os.tmpdir(), "purge-dump-"));
  });
  afterAll(async () => {
    if (mongo) await mongo.close();
    if (dumpDir) fs.rmSync(dumpDir, { recursive: true, force: true });
  });

  describe("it refuses before it deletes", () => {
    test("without --before it deletes NOTHING and exits non-zero", async () => {
      const s = await seed();
      const r = run([], { expectFail: true });
      expect(r.code).toBe(2);
      expect(r.out).toMatch(/--before/);
      // there is no default cutoff, and nothing was touched
      expect(await alive(s.anonOld)).toBe(true);
      expect(await alive(s.acctOld)).toBe(true);
    });

    test("a malformed --before is refused", async () => {
      const r = run(["--before", "not-a-date"], { expectFail: true });
      expect(r.code).toBe(2);
    });

    test("DRY RUN is the default — it reports and deletes nothing", async () => {
      const s = await seed();
      const r = run(["--before", CUTOFF]);
      expect(r.code).toBe(0);
      expect(r.out).toMatch(/DRY RUN/);
      expect(await alive(s.anonOld)).toBe(true);
      expect(await alive(s.acctOld)).toBe(true);
      expect(await alive(s.anonNew)).toBe(true);
    });

    test("a failed dump means NO delete", async () => {
      const s = await seed();
      // point the dump at a path that cannot be written
      const r = (() => {
        try {
          execFileSync("node", [SCRIPT, "--before", CUTOFF, "--yes"], {
            encoding: "utf8",
            env: { ...process.env, PURGE_DUMP_DIR: "/dev/null/nope" },
            stdio: "pipe",
          });
          return { code: 0 };
        } catch (err) {
          return { code: err.status, out: `${err.stdout ?? ""}${err.stderr ?? ""}` };
        }
      })();
      expect(r.code).not.toBe(0);
      // the whole point: the data is still there
      expect(await alive(s.anonOld)).toBe(true);
      expect(await alive(s.acctOld)).toBe(true);
    });
  });

  describe("what it deletes, and what it must never touch", () => {
    test("--yes removes ONLY anonymous subjects older than the cutoff", async () => {
      const s = await seed();
      const r = run(["--before", CUTOFF, "--yes"]);
      expect(r.code).toBe(0);

      // gone: anonymous AND old
      expect(await alive(s.anonOld)).toBe(false);
      // kept: an ACCOUNT's subject, however old — this is the clause that matters
      expect(await alive(s.acctOld)).toBe(true);
      // kept: anonymous but newer than the cutoff
      expect(await alive(s.anonNew)).toBe(true);
    });

    test("a real dump artifact exists and is non-empty", async () => {
      const s = await seed();
      run(["--before", CUTOFF, "--yes"]);
      const dumps = fs.readdirSync(dumpDir);
      expect(dumps.length).toBeGreaterThan(0);
      const inner = path.join(dumpDir, dumps[dumps.length - 1], DB);
      const bson = fs.readdirSync(inner).filter((f) => f.endsWith(".bson"));
      expect(bson.length).toBeGreaterThan(0);
      const bytes = bson.reduce((n, f) => n + fs.statSync(path.join(inner, f)).size, 0);
      expect(bytes).toBeGreaterThan(0);
      expect(await alive(s.acctOld)).toBe(true);
    });

    test("it is idempotent — a second run finds nothing and deletes nothing", async () => {
      await seed();
      run(["--before", CUTOFF, "--yes"]);
      const again = run(["--before", CUTOFF, "--yes"]);
      expect(again.code).toBe(0);
      expect(again.out).toMatch(/nothing to purge|matched \(orphans\) : 0/);
    });

    test("no ACCOUNT-owned subject is ever removed — checked by IDENTITY, not by count", async () => {
      // Deliberately not a count. Jest runs suites in parallel workers against one shared
      // database, so a global count moves under you and the assertion becomes a race —
      // the same flaw that made an earlier pin flaky. Identity is stable: a document that
      // existed before the purge must still exist after it.
      const accounts = await db
        .collection("teachers")
        .distinct("teacherId", { email: { $type: "string" } });
      const watched = (
        await db
          .collection("subjects")
          .find({ teacherId: { $in: accounts } }, { projection: { _id: 1 } })
          .limit(200)
          .toArray()
      ).map((d) => String(d._id));

      const s = await seed();
      run(["--before", CUTOFF, "--yes"]);

      // every watched account-owned subject is still there
      const stillThere = await db
        .collection("subjects")
        .countDocuments({ _id: { $in: watched.map((id) => new ObjectId(id)) } });
      expect(stillThere).toBe(watched.length);
      // including the old one this test seeded, which the cutoff would otherwise catch
      expect(await alive(s.acctOld)).toBe(true);
    });
  });
});
