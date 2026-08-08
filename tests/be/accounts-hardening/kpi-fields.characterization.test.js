/**
 * be-1 — store the two numbers the operator cannot currently see.
 *
 * `/api/generate` already returns `costUsd` and `durationMs`; `fe` receives both and
 * throws them away. They land on the subject exactly as `genCorrelationId` did, so
 * every later KPI is a Mongo query rather than a parse of run-log.jsonl (a file that
 * is explicitly "not the datastore", and is per-lane besides).
 *
 * ⚠ `costUsd` IS NOT MONEY. The product runs on a subscription, not credit billing —
 * it is the CLI's notional API-equivalent, a usage signal. It is never validated as
 * currency and never described as one.
 *
 * Black-box over HTTP against the running lane, asserting stored state with the
 * mongodb driver. NEVER calls /api/generate (~73–145 s of real generation).
 *
 * PRECONDITION: the lane is up. A hollow run (every test skipped) is RED in job
 * mode — WF-82.
 */
const path = require("node:path");
const { readFileSync } = require("node:fs");
const { MongoClient, ObjectId } = require("mongodb");
const { describeIfLane } = require("guard");

// tools/ci derives this from THIS checkout's own lane. Never hardcode a lane.
const BE = process.env.CHAR_BE_URL || "http://localhost:9000";
const MONGO = "mongodb://127.0.0.1:27017";
const DB = "teacher_saas";

// Fixture BESIDE the suite, read with __dirname — reaching outside a suite's own
// directory has broken promotion three times in this product.
const RECORDED = JSON.parse(
  readFileSync(path.join(__dirname, "fixtures", "rec-subject-shape.2026-08-08.json"), "utf8"),
);

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

/** A recorded envelope's real numbers — the values a generation actually produced. */
const REAL_COST = 0.756058;
const REAL_DURATION = 145467;

const SUBJECT = {
  title: "اختبار الفصل الأول",
  meta: { totalPoints: 20, topic: "الدوال" },
  exercises: [{ id: "ex1", label: "التمرين الأول", points: 20, statement: "$f(x)=x^2$" }],
};

async function freshTeacher() {
  const { body } = await call("POST", "/api/teacher");
  return body.teacherId;
}

describeIfLane(BE, "be-1 — per-exam cost and duration land on the subject", () => {
  beforeAll(async () => {
    mongo = new MongoClient(MONGO);
    await mongo.connect();
    db = mongo.db(DB);
  });
  afterAll(async () => {
    if (mongo) await mongo.close();
  });

  describe("positive — both numbers are stored and echoed everywhere", () => {
    test("create echoes them, and the DOCUMENT carries them as numbers", async () => {
      const teacher = await freshTeacher();
      const { status, body } = await call("POST", "/api/subjects", {
        teacher,
        body: { subject: SUBJECT, costUsd: REAL_COST, durationMs: REAL_DURATION },
      });
      expect(status).toBe(201);
      expect(body.costUsd).toBe(REAL_COST);
      expect(body.durationMs).toBe(REAL_DURATION);

      const doc = await db.collection("subjects").findOne({ _id: new ObjectId(body.id) });
      expect(doc.costUsd).toBe(REAL_COST);
      expect(doc.durationMs).toBe(REAL_DURATION);
      expect(typeof doc.costUsd).toBe("number");
      expect(typeof doc.durationMs).toBe("number");
    });

    test("GET and LIST echo the same values a later, independent read", async () => {
      // THE SECOND-COMPUTATION CLAUSE. The numbers arrive on the create request, so a
      // handler could plausibly echo them straight back without ever storing them.
      // Reading them on a *separate* request is the only thing that tells the two apart.
      const teacher = await freshTeacher();
      const { body: created } = await call("POST", "/api/subjects", {
        teacher,
        body: { subject: SUBJECT, costUsd: REAL_COST, durationMs: REAL_DURATION },
      });

      const got = await call("GET", `/api/subjects/${created.id}`, { teacher });
      expect(got.status).toBe(200);
      expect(got.body.costUsd).toBe(REAL_COST);
      expect(got.body.durationMs).toBe(REAL_DURATION);

      const listed = await call("GET", "/api/subjects", { teacher });
      const row = listed.body.subjects.find((s) => s.id === created.id);
      expect(row).toBeTruthy();
      expect(row.costUsd).toBe(REAL_COST);
      expect(row.durationMs).toBe(REAL_DURATION);
    });

    test("zero is a value, not an absence", async () => {
      // 0 is falsy. `costUsd || null` would silently turn a genuinely-free run into
      // "no data", and the KPI denominator would quietly disagree with the exam count.
      const teacher = await freshTeacher();
      const { body } = await call("POST", "/api/subjects", {
        teacher,
        body: { subject: SUBJECT, costUsd: 0, durationMs: 0 },
      });
      expect(body.costUsd).toBe(0);
      expect(body.durationMs).toBe(0);

      const got = await call("GET", `/api/subjects/${body.id}`, { teacher });
      expect(got.body.costUsd).toBe(0);
      expect(got.body.durationMs).toBe(0);
    });

    test("omitted -> 201 and stored null (additive: fe may merge later)", async () => {
      const teacher = await freshTeacher();
      const { status, body } = await call("POST", "/api/subjects", {
        teacher,
        body: { subject: SUBJECT },
      });
      expect(status).toBe(201);
      expect(body.costUsd).toBeNull();
      expect(body.durationMs).toBeNull();

      const doc = await db.collection("subjects").findOne({ _id: new ObjectId(body.id) });
      expect(doc.costUsd).toBeNull();
      expect(doc.durationMs).toBeNull();
    });

    test("explicit null is accepted, not a validation error", async () => {
      const teacher = await freshTeacher();
      const { status, body } = await call("POST", "/api/subjects", {
        teacher,
        body: { subject: SUBJECT, costUsd: null, durationMs: null },
      });
      expect(status).toBe(201);
      expect(body.costUsd).toBeNull();
      expect(body.durationMs).toBeNull();
    });

    test("concurrent creates do not cross-contaminate each other's numbers", async () => {
      // Two exams saved at once — one cheap, one expensive. A value held anywhere but
      // on its own document (a module-level "last" variable, a shared builder) shows up
      // here and nowhere else.
      const teacher = await freshTeacher();
      const [a, b] = await Promise.all([
        call("POST", "/api/subjects", {
          teacher,
          body: { subject: SUBJECT, costUsd: 0.1111, durationMs: 11111 },
        }),
        call("POST", "/api/subjects", {
          teacher,
          body: { subject: SUBJECT, costUsd: 0.9999, durationMs: 99999 },
        }),
      ]);
      const reread = await Promise.all([
        call("GET", `/api/subjects/${a.body.id}`, { teacher }),
        call("GET", `/api/subjects/${b.body.id}`, { teacher }),
      ]);
      expect(reread[0].body.costUsd).toBe(0.1111);
      expect(reread[0].body.durationMs).toBe(11111);
      expect(reread[1].body.costUsd).toBe(0.9999);
      expect(reread[1].body.durationMs).toBe(99999);
    });
  });

  describe("positive — a non-number is rejected", () => {
    // A bad KPI is worse than a missing one: a missing one is visibly null, a bad one
    // is averaged. The same reasoning genCorrelationId already applies to its type.
    test.each([
      ["costUsd as a string", { costUsd: "0.756058" }],
      ["costUsd as a boolean", { costUsd: true }],
      ["costUsd as an object", { costUsd: { usd: 1 } }],
      ["durationMs as a string", { durationMs: "145467" }],
      ["durationMs as an array", { durationMs: [1] }],
    ])("%s -> 400 invalid_request, and NOTHING is created", async (_name, extra) => {
      const teacher = await freshTeacher();
      const { status, body } = await call("POST", "/api/subjects", {
        teacher,
        body: { subject: SUBJECT, ...extra },
      });
      expect(status).toBe(400);
      expect(body.error.type).toBe("invalid_request");
      // A rejected create must not leave a half-written row behind.
      expect(await db.collection("subjects").countDocuments({ teacherId: teacher })).toBe(0);
    });
  });

  describe("negative — documents written before this job are untouched", () => {
    test("a legacy document reads back null and is NOT rewritten", async () => {
      const teacher = await freshTeacher();
      const legacyAt = new Date("2026-07-01T09:00:00.000Z");
      const res = await db.collection("subjects").insertOne({
        teacherId: teacher,
        subject: SUBJECT,
        controls: null,
        genCorrelationId: null,
        createdAt: legacyAt,
        updatedAt: legacyAt,
      });
      const id = res.insertedId.toHexString();

      const got = await call("GET", `/api/subjects/${id}`, { teacher });
      expect(got.status).toBe(200);
      expect(got.body.costUsd).toBeNull();
      expect(got.body.durationMs).toBeNull();

      const listed = await call("GET", "/api/subjects", { teacher });
      const row = listed.body.subjects.find((s) => s.id === id);
      expect(row.costUsd).toBeNull();
      expect(row.durationMs).toBeNull();

      // NO MIGRATION. Reading must not backfill: the fields stay absent and updatedAt
      // is byte-identical to what was inserted.
      const after = await db.collection("subjects").findOne({ _id: res.insertedId });
      expect(after.updatedAt.getTime()).toBe(legacyAt.getTime());
      expect("costUsd" in after).toBe(false);
      expect("durationMs" in after).toBe(false);
    });
  });

  describe("negative — the response is a SUPERSET of the recorded shape", () => {
    test("every recorded record key survives, with its recorded type", async () => {
      const teacher = await freshTeacher();
      const { body } = await call("POST", "/api/subjects", {
        teacher,
        body: { subject: SUBJECT, genCorrelationId: "rec-shape", costUsd: REAL_COST, durationMs: REAL_DURATION },
      });
      const got = await call("GET", `/api/subjects/${body.id}`, { teacher });
      for (const key of Object.keys(RECORDED.record)) {
        expect(got.body).toHaveProperty(key);
        expect(typeof got.body[key]).toBe(typeof RECORDED.record[key]);
      }
      expect(got.body.subject).toEqual(SUBJECT);
      expect(got.body.genCorrelationId).toBe("rec-shape");
    });

    test("every recorded summary key survives on the list row", async () => {
      const teacher = await freshTeacher();
      const { body } = await call("POST", "/api/subjects", {
        teacher,
        body: { subject: SUBJECT, costUsd: REAL_COST, durationMs: REAL_DURATION },
      });
      const listed = await call("GET", "/api/subjects", { teacher });
      const row = listed.body.subjects.find((s) => s.id === body.id);
      for (const key of RECORDED.summaryKeys) {
        expect(row).toHaveProperty(key);
      }
    });
  });

  describe("negative — a non-FINITE number would poison every average", () => {
    /**
     * Added after review. `1e999` is valid JSON that parses to Infinity, so a `typeof ===
     * "number"` guard admits it — and one Infinity makes avgCostUsdPerExam Infinity forever.
     * The shipped guard uses Number.isFinite; this pins that it does.
     */
    for (const [label, raw] of [
      ["Infinity via 1e999", '{"subject":SUBJ,"costUsd":1e999,"durationMs":1000}'],
      ["-Infinity", '{"subject":SUBJ,"costUsd":-1e999,"durationMs":1000}'],
      ["Infinity in durationMs", '{"subject":SUBJ,"costUsd":0.5,"durationMs":1e999}'],
    ]) {
      test(`${label} is rejected 400, and nothing is stored`, async () => {
        const t = await freshTeacher();
        const before = await db.collection("subjects").countDocuments({ teacherId: t });
        const res = await fetch(`${BE}/api/subjects`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-teacher-id": t },
          body: raw.replace("SUBJ", JSON.stringify(SUBJECT)),
        });
        expect(res.status).toBe(400);
        expect((await res.json()).error.type).toBe("invalid_request");
        expect(await db.collection("subjects").countDocuments({ teacherId: t })).toBe(before);
      });
    }
  });
});
