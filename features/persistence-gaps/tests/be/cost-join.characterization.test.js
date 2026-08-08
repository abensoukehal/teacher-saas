/**
 * be-4 — give a subject a join key to the generation that produced it.
 *
 * Cost per exam is the number the billing model turns on: a generation is ~$0.65
 * measured against a price point of ~$15/month, so roughly 23 exams to break even.
 * Today it is unanswerable, and not merely unpopulated — DISCOVERY established that
 * `correlationId` is PER-REQUEST, so a subject's create line and its generation line
 * carry different ids and no join exists even in principle (SEED journal H5).
 *
 * The fix needs NO change to /api/generate: it already returns costUsd and the
 * generation's correlationId in its envelope (journal H4). Only the subject was
 * missing the key.
 *
 * Black-box over HTTP; PRECONDITION `tools/dev up -d`. Hollow run is RED (WF-82).
 */
const fs = require("node:fs");
const path = require("node:path");
const { MongoClient, ObjectId } = require("mongodb");
const { describeIfLane } = require("guard");

const BE = process.env.CHAR_BE_URL || "http://localhost:9000";
const MONGO = "mongodb://127.0.0.1:27017";
const DB = "teacher_saas";

const RECORDING = JSON.parse(
  fs.readFileSync(path.join(__dirname, "fixtures/rec-exam-subject.2026-08-07.json"), "utf8"),
);
const SUBJECT = RECORDING.data;
/** The real generation's own correlationId and cost, from the recorded envelope. */
const GEN_CORR = RECORDING.correlationId;
const GEN_COST = RECORDING.costUsd;

let mongo;
let db;

async function call(method, p, { body, teacher } = {}) {
  const res = await fetch(`${BE}${p}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(teacher ? { "x-teacher-id": teacher } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: res.status, body: await res.json() };
}

const newTeacher = async () => (await call("POST", "/api/teacher")).body.teacherId;

describeIfLane(BE, "be-4 — cost attribution", () => {
  beforeAll(async () => {
    mongo = new MongoClient(MONGO);
    await mongo.connect();
    db = mongo.db(DB);
  });
  afterAll(async () => {
    if (mongo) await mongo.close();
  });

  describe("positive — the join key is carried and echoed", () => {
    test("genCorrelationId is stored and returned on create, get and list", async () => {
      const t = await newTeacher();
      const created = await call("POST", "/api/subjects", {
        teacher: t,
        body: { subject: SUBJECT, controls: null, genCorrelationId: GEN_CORR },
      });
      expect(created.status).toBe(201);
      expect(created.body.genCorrelationId).toBe(GEN_CORR);

      const got = await call("GET", `/api/subjects/${created.body.id}`, { teacher: t });
      expect(got.body.genCorrelationId).toBe(GEN_CORR);

      const list = await call("GET", "/api/subjects", { teacher: t });
      expect(list.body.subjects.find((s) => s.id === created.body.id).genCorrelationId).toBe(
        GEN_CORR,
      );

      const doc = await db.collection("subjects").findOne({ _id: new ObjectId(created.body.id) });
      expect(doc.genCorrelationId).toBe(GEN_CORR);
    });

    test("THE GAP CLOSED — the subject's key actually finds a run line, and its cost", async () => {
      // Rewritten 2026-08-08. The first version asserted that a literal in a checked-in
      // fixture was a positive number and never opened the run log — the join it claimed
      // to prove was never executed. It now performs the join for real.
      //
      // /api/generate is NOT called (~$0.65, ~128 s — see stacks/be.md). Instead the run
      // line the generator would have written is appended from the recorded envelope,
      // which is exactly the shape runlog.ts emits.
      const runlog = path.join(process.env.CHAR_ROOTDIR ?? ".", "run-log.jsonl");
      const unique = `verify-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      fs.appendFileSync(
        runlog,
        `${JSON.stringify({
          ts: new Date().toISOString(),
          skill: "exam-subject",
          correlationId: unique,
          durationMs: RECORDING.durationMs,
          costUsd: RECORDING.costUsd,
          exerciseCount: SUBJECT.exercises.length,
          ok: true,
        })}\n`,
      );

      const t = await newTeacher();
      const created = await call("POST", "/api/subjects", {
        teacher: t,
        body: { subject: SUBJECT, controls: null, genCorrelationId: unique },
      });
      expect(created.status).toBe(201);

      // THE JOIN: subject → its generation's correlationId → the run line → the cost.
      const key = created.body.genCorrelationId;
      const runLine = fs
        .readFileSync(runlog, "utf8")
        .split("\n")
        .filter(Boolean)
        .map((l) => {
          try {
            return JSON.parse(l);
          } catch {
            return null;
          }
        })
        .find((o) => o && o.correlationId === key && typeof o.costUsd === "number");

      expect(runLine).toBeDefined();
      expect(runLine.costUsd).toBe(RECORDING.costUsd);
      expect(runLine.durationMs).toBe(RECORDING.durationMs);
      // Answerable at last: what did THIS exam cost to produce?
      expect(runLine.costUsd).toBeGreaterThan(0);
    });

    test("the two ids stay DISTINCT — the request's own vs the generation's", async () => {
      const t = await newTeacher();
      const created = await call("POST", "/api/subjects", {
        teacher: t,
        body: { subject: SUBJECT, controls: null, genCorrelationId: GEN_CORR },
      });
      // correlationId is THIS request's; genCorrelationId is the generation's. Confusing
      // them is precisely why the gap existed.
      expect(created.body.correlationId).not.toBe(created.body.genCorrelationId);
      expect(created.body.genCorrelationId).toBe(GEN_CORR);
    });
  });

  describe("positive — optional, which is what keeps it additive", () => {
    test("omitted → 201 and stored null, so be can merge before fe", async () => {
      const t = await newTeacher();
      const created = await call("POST", "/api/subjects", {
        teacher: t,
        body: { subject: SUBJECT, controls: null },
      });
      expect(created.status).toBe(201);
      expect(created.body.genCorrelationId).toBeNull();
      const doc = await db.collection("subjects").findOne({ _id: new ObjectId(created.body.id) });
      expect(doc.genCorrelationId).toBeNull();
    });

    test("explicit null → 201, stored null (the legacy-draft adoption path)", async () => {
      const t = await newTeacher();
      const created = await call("POST", "/api/subjects", {
        teacher: t,
        body: { subject: SUBJECT, controls: null, genCorrelationId: null },
      });
      expect(created.status).toBe(201);
      expect(created.body.genCorrelationId).toBeNull();
    });

    test("a non-string is rejected rather than silently stored", async () => {
      const t = await newTeacher();
      const created = await call("POST", "/api/subjects", {
        teacher: t,
        body: { subject: SUBJECT, controls: null, genCorrelationId: 42 },
      });
      expect(created.status).toBe(400);
      expect(created.body.error.type).toBe("invalid_request");
    });
  });

  describe("negative — nothing existing moved", () => {
    test("pre-existing documents read back null and are NOT rewritten", async () => {
      const old = await db
        .collection("subjects")
        .findOne({ genCorrelationId: { $exists: false } });
      if (!old) return; // every doc already carries the field; nothing to assert
      const before = old.updatedAt.getTime();
      const t = old.teacherId;
      const got = await call("GET", `/api/subjects/${String(old._id)}`, { teacher: t });
      if (got.status === 200) expect(got.body.genCorrelationId).toBeNull();
      const after = await db.collection("subjects").findOne({ _id: old._id });
      expect(after.updatedAt.getTime()).toBe(before); // read did not migrate it
    });

    test("the create response is a SUPERSET of the recorded shape — nothing removed", async () => {
      const t = await newTeacher();
      const created = await call("POST", "/api/subjects", {
        teacher: t,
        body: { subject: SUBJECT, controls: null },
      });
      for (const k of ["id", "createdAt", "updatedAt", "subject", "correlationId"]) {
        expect(Object.keys(created.body)).toContain(k);
      }
    });

    test("the run log gains no new field and no teacher content", async () => {
      const runlog = path.join(process.env.CHAR_ROOTDIR ?? ".", "run-log.jsonl");
      const lines = fs
        .readFileSync(runlog, "utf8")
        .split("\n")
        .filter(Boolean)
        .map((l) => {
          try {
            return JSON.parse(l);
          } catch {
            return null;
          }
        })
        .filter((o) => o && o.kind === "subject");
      expect(lines.length).toBeGreaterThan(0);
      for (const l of lines.slice(-20)) {
        expect(Object.keys(l).sort()).toEqual(
          ["correlationId", "kind", "op", "subjectId", "ts"].sort(),
        );
        expect(JSON.stringify(l)).not.toMatch(/[؀-ۿ]/);
      }
    });
  });
});
