/**
 * be-1 — the class spine, observable from its first write.
 *
 * THE RULE THIS SUITE EXISTS TO DEFEND: a class is owner-scoped INSIDE the query and
 * its stream is validated against the LIVE CORPUS, never against a hardcoded union.
 * Six streams map onto five documents — the lettres record carries two — so a union
 * copied into TypeScript would pass a review and drift the first time the corpus moves.
 *
 * The other half is observability, and it is why this sub-issue ran first: before it,
 * nothing logged a class or progress mutation, so a CAS loss in be-2 would have been
 * invisible and the loop could not have verified concurrency it cannot see (SEED §5).
 * Every class/progress write emits ONE structured line; the clause at the bottom is
 * what makes that a fact rather than an intention.
 *
 * ⚠ The teacherId is a BEARER value. A log line carries an 8-char PREFIX and never the
 * whole 32 hex — the discipline `teacher.rejected` already keeps (src/teacher.ts:76).
 *
 * PRECONDITION: the lane is up. A hollow run is RED in job mode — WF-82.
 */
const { readFileSync } = require("node:fs");
const { randomBytes } = require("node:crypto");
const { ObjectId, MongoClient } = require("mongodb");
const { describeIfLane } = require("guard");

const BE = process.env.CHAR_BE_URL || "http://localhost:9000";
const LOG = process.env.CHAR_BE_LOG || "";
const MONGO = "mongodb://127.0.0.1:27017";
const DB = "teacher_saas";

/**
 * The six stream values, RECORDED (SEED §2, 2026-08-11) — codepoint-identical to the
 * handoff union at `types/contracts.ts:4`.
 *
 * Hardcoded here ON PURPOSE, and it is not a contradiction of "never hardcode the union
 * in the product": the SUITE is the characterization. The service must read the corpus;
 * this file pins what the corpus said when the contract was locked, and the clause below
 * compares the two. If the ministry corpus is reloaded with a different set, this suite
 * goes red — which is exactly the sub-issue's ask-when, not a test to be edited around.
 */
const STREAMS = [
  "شعبة الرياضيات",
  "تقني رياضي",
  "علوم تجريبية",
  "تسيير واقتصاد",
  "آداب وفلسفة",
  "لغات أجنبية",
];

/** The `/api` index as recorded before this slice. It may GROW; nothing may vanish. */
const RECORDED_ROUTES = [
  "/health",
  "/api/skills",
  "/api/generate",
  "/api/teacher",
  "/api/subjects",
  "/api/exams",
  "/api/auth/signup",
  "/api/auth/signin",
  "/api/auth/recover",
];

const HEX24_LOWER = /^[0-9a-f]{24}$/;
const HEX32 = /[0-9a-f]{32}/;

let mongo;
let db;
const PLANTED_CLASSES = []; // ObjectIds this suite created, removed in afterAll
const MINTED_TEACHERS = []; // anonymous rows this suite minted, removed in afterAll

async function call(method, p, { body, teacher } = {}) {
  // GET and HEAD carry no body — fetch throws outright rather than ignoring one, and the
  // identity-gate table below shares its cases between POST and GET on purpose. Dropping
  // it here keeps that table a single list of one fact ("no valid header -> 401") instead
  // of two divergent copies.
  const bodyless = method === "GET" || method === "HEAD";
  const res = await fetch(`${BE}${p}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(teacher ? { "x-teacher-id": teacher } : {}),
    },
    ...(bodyless || body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: res.status, body: await res.json() };
}

async function mintTeacher() {
  const { body } = await call("POST", "/api/teacher");
  MINTED_TEACHERS.push(body.teacherId);
  return body.teacherId;
}

async function makeClass(teacher, body) {
  const res = await call("POST", "/api/classes", { teacher, body });
  if (res.status === 201 && res.body.class?.id) PLANTED_CLASSES.push(new ObjectId(res.body.class.id));
  return res;
}

/** A distinct createdAt per class — the ordering clause is about ORDER, not ms resolution. */
const tick = () => new Promise((r) => setTimeout(r, 12));

/**
 * The log is written by a separate process through a redirect, so a line can land a
 * beat after the response. Poll briefly rather than sleeping a fixed amount.
 */
async function findLogLines(predicate, { tries = 20, waitMs = 50 } = {}) {
  for (let i = 0; i < tries; i++) {
    const hits = readFileSync(LOG, "utf8")
      .split("\n")
      .filter((l) => l.trim() !== "")
      .map((l) => {
        try {
          return JSON.parse(l);
        } catch (_e) {
          return null;
        }
      })
      .filter((o) => o && predicate(o));
    if (hits.length > 0) return hits;
    await new Promise((r) => setTimeout(r, waitMs));
  }
  return [];
}

describeIfLane(BE, "be-1 — classes: created, listed, owner-scoped, and observable", () => {
  beforeAll(async () => {
    mongo = new MongoClient(MONGO);
    await mongo.connect();
    db = mongo.db(DB);
  });

  afterAll(async () => {
    if (db) {
      if (PLANTED_CLASSES.length > 0) {
        await db.collection("classes").deleteMany({ _id: { $in: PLANTED_CLASSES } });
      }
      if (MINTED_TEACHERS.length > 0) {
        await db.collection("teachers").deleteMany({ teacherId: { $in: MINTED_TEACHERS } });
      }
    }
    if (mongo) await mongo.close();
  });

  describe("POST /api/classes — the happy path", () => {
    test("a class is created and answers with a 24-char LOWERCASE hex id and an ISO createdAt", async () => {
      const teacher = await mintTeacher();
      const { status, body } = await makeClass(teacher, {
        name: "3ر1",
        stream: "شعبة الرياضيات",
      });
      expect(status).toBe(201);
      expect(body.class.name).toBe("3ر1");
      expect(body.class.stream).toBe("شعبة الرياضيات");
      // ONE id convention in this product. Teacher ids are lowercase-hex and
      // case-SENSITIVE (teacher.ts:19); a class id that arrived uppercase would
      // invent a second convention and break the first comparison someone writes.
      expect(body.class.id).toMatch(HEX24_LOWER);
      // A real ISO instant, not a Date object stringified some other way.
      expect(new Date(body.class.createdAt).toISOString()).toBe(body.class.createdAt);
      expect(body.correlationId).toBeTruthy();
    });

    test("the response is what actually landed in the store, scoped to its owner", async () => {
      const teacher = await mintTeacher();
      const { body } = await makeClass(teacher, { name: "3ر2", stream: "تقني رياضي" });
      const stored = await db.collection("classes").findOne({
        _id: new ObjectId(body.class.id),
        teacherId: teacher,
      });
      // teacherId is DENORMALISED into the document — that is what lets every read
      // scope ownership inside the query instead of checking after the fetch.
      expect(stored).toBeTruthy();
      expect(stored.name).toBe("3ر2");
      expect(stored.stream).toBe("تقني رياضي");
    });

    test("a duplicate name for the SAME teacher is accepted — names are labels", async () => {
      // Contract §0. Refusing one would be the product grading the teacher's naming.
      const teacher = await mintTeacher();
      const first = await makeClass(teacher, { name: "3ر1", stream: "شعبة الرياضيات" });
      const second = await makeClass(teacher, { name: "3ر1", stream: "شعبة الرياضيات" });
      expect(first.status).toBe(201);
      expect(second.status).toBe(201);
      expect(second.body.class.id).not.toBe(first.body.class.id);
    });

    test("an 80-char name is accepted — the boundary the 81 clause is measured against", async () => {
      const teacher = await mintTeacher();
      const { status } = await makeClass(teacher, {
        name: "ق".repeat(80),
        stream: "شعبة الرياضيات",
      });
      expect(status).toBe(201);
    });
  });

  describe("streams — validated against the CORPUS, one probe per value (WF-70)", () => {
    test("the corpus still holds exactly the six recorded streams", async () => {
      // The guard on every clause below. If this drifts, the six probes are testing a
      // union that no longer exists and the sub-issue's ask-when has fired.
      const live = await db.collection("programmes").distinct("streams");
      expect([...live].sort()).toEqual([...STREAMS].sort());
    });

    test.each(STREAMS)("a class is creatable for stream %s", async (stream) => {
      // Six streams over FIVE documents — the lettres record carries آداب وفلسفة and
      // لغات أجنبية together, so both must resolve out of one document.
      const teacher = await mintTeacher();
      const { status, body } = await makeClass(teacher, { name: "قسم", stream });
      expect(status).toBe(201);
      expect(body.class.stream).toBe(stream);
    });

    test("every one of the six resolves to a CURRENT programme, not merely to a document", async () => {
      // Storing a class whose stream resolves to nothing would make
      // GET /api/progress/:classId unanswerable in be-2 — contract §2.
      for (const stream of STREAMS) {
        const doc = await db.collection("programmes").findOne({ streams: stream, current: true });
        expect(doc).toBeTruthy();
      }
    });
  });

  describe("GET /api/classes — ordered, and scoped to its owner", () => {
    test("classes come back createdAt ASCENDING — a switcher's tab order must be stable", async () => {
      // Newest-first would reorder the bar every time a class is added (contract §3).
      const teacher = await mintTeacher();
      const made = [];
      for (const name of ["أ", "ب", "ج"]) {
        const { body } = await makeClass(teacher, { name, stream: "علوم تجريبية" });
        made.push(body.class.id);
        await tick();
      }
      const { status, body } = await call("GET", "/api/classes", { teacher });
      expect(status).toBe(200);
      expect(body.classes.map((c) => c.id)).toEqual(made);
      const times = body.classes.map((c) => new Date(c.createdAt).getTime());
      for (let i = 1; i < times.length; i++) {
        expect(times[i - 1]).toBeLessThanOrEqual(times[i]);
      }
      expect(body.correlationId).toBeTruthy();
    });

    test("a teacher with no classes gets [] and a 200 — legacy mode, never an error", async () => {
      const teacher = await mintTeacher();
      const { status, body } = await call("GET", "/api/classes", { teacher });
      expect(status).toBe(200);
      expect(body.classes).toEqual([]);
    });

    test("another teacher's classes are NOT in this teacher's list", async () => {
      const owner = await mintTeacher();
      const other = await mintTeacher();
      const { body: mine } = await makeClass(owner, { name: "3ر9", stream: "شعبة الرياضيات" });
      const { body } = await call("GET", "/api/classes", { teacher: other });
      expect(body.classes.some((c) => c.id === mine.class.id)).toBe(false);
    });

    test("a listed class carries no teacherId and no internal keys", async () => {
      // The wire shape is contract §3's four fields. A leaked teacherId would put a
      // bearer credential in a payload that has no use for it.
      const teacher = await mintTeacher();
      await makeClass(teacher, { name: "3ت1", stream: "تسيير واقتصاد" });
      const { body } = await call("GET", "/api/classes", { teacher });
      expect(Object.keys(body.classes[0]).sort()).toEqual(["createdAt", "id", "name", "stream"]);
      expect(JSON.stringify(body.classes)).not.toMatch(HEX32);
    });
  });

  describe("negative — a bad stream or a bad name is 400 invalid_request", () => {
    // "رياضيات" is the near-miss that matters: a plausible abbreviation of a real value.
    test.each([
      ["a near-miss of a real stream", "رياضيات"],
      ["an empty stream", ""],
      ["Latin junk", "not-a-stream"],
      ["a stream that is not a string", 7],
      ["a missing stream", undefined],
    ])("%s -> 400 invalid_request", async (_label, stream) => {
      const teacher = await mintTeacher();
      const { status, body } = await makeClass(
        teacher,
        stream === undefined ? { name: "3ر1" } : { name: "3ر1", stream },
      );
      expect(status).toBe(400);
      expect(body.error.type).toBe("invalid_request");
      expect(body.correlationId).toBeTruthy();
    });

    test.each([
      ["an empty name", ""],
      ["a whitespace-only name", "   "],
      ["an 81-char name", "ق".repeat(81)],
      ["a name that is not a string", 42],
      ["a missing name", undefined],
    ])("%s -> 400 invalid_request", async (_label, name) => {
      const teacher = await mintTeacher();
      const { status, body } = await makeClass(
        teacher,
        name === undefined
          ? { stream: "شعبة الرياضيات" }
          : { name, stream: "شعبة الرياضيات" },
      );
      expect(status).toBe(400);
      expect(body.error.type).toBe("invalid_request");
    });

    test("a rejected class is not stored", async () => {
      // A 400 that still inserted would make the validation cosmetic.
      const teacher = await mintTeacher();
      await makeClass(teacher, { name: "3ر1", stream: "رياضيات" });
      expect(await db.collection("classes").countDocuments({ teacherId: teacher })).toBe(0);
    });
  });

  describe("negative — the identity gate is requireTeacher, not a reimplementation", () => {
    const CASES = [
      ["POST", "/api/classes"],
      ["GET", "/api/classes"],
    ];

    test.each(CASES)("%s %s with NO header -> 401 teacher_required", async (method, p) => {
      const { status, body } = await call(method, p, { body: { name: "3ر1", stream: "شعبة الرياضيات" } });
      expect(status).toBe(401);
      expect(body.error.type).toBe("teacher_required");
    });

    test.each(CASES)("%s %s with an UNISSUED 32-hex id -> 401", async (method, p) => {
      const { status, body } = await call(method, p, {
        teacher: randomBytes(16).toString("hex"),
        body: { name: "3ر1", stream: "شعبة الرياضيات" },
      });
      expect(status).toBe(401);
      expect(body.error.type).toBe("teacher_required");
    });

    test.each(CASES)("%s %s with the UPPERCASE of a valid id -> 401 (ids are case-sensitive)", async (method, p) => {
      const teacher = await mintTeacher();
      const { status } = await call(method, p, {
        teacher: teacher.toUpperCase(),
        body: { name: "3ر1", stream: "شعبة الرياضيات" },
      });
      expect(status).toBe(401);
    });

    test("the 401 body is BYTE-IDENTICAL to the recorded gate on /api/subjects", async () => {
      // Same "who are you" answer everywhere. A new route answering differently would
      // be a second identity story, which is how one of them ends up laxer.
      const recorded = await call("GET", "/api/subjects");
      const fromClasses = await call("GET", "/api/classes");
      expect(fromClasses.status).toBe(recorded.status);
      expect(fromClasses.body.error).toEqual(recorded.body.error);
    });
  });

  describe("negative — the perimeter: the index GREW, nothing vanished", () => {
    test.each(RECORDED_ROUTES)("/api still lists %s", async (route) => {
      const { body } = await call("GET", "/api");
      expect(body.routes).toContain(route);
    });

    test("/api is still this service's own index", async () => {
      const { status, body } = await call("GET", "/api");
      expect(status).toBe(200);
      expect(body.service).toBe("teacher-be");
    });
  });

  describe("THE BLIND-SPOT CLOSURE — every class write emits one structured line", () => {
    test("class.created carries the response's correlationId, the classId, and an 8-char teacherIdPrefix", async () => {
      if (!LOG) throw new Error("CHAR_BE_LOG is unset — run via tools/ci, not jest directly");
      const teacher = await mintTeacher();
      const { body } = await makeClass(teacher, { name: "3ر7", stream: "شعبة الرياضيات" });

      const hits = await findLogLines(
        (o) => o.event === "class.created" && o.correlationId === body.correlationId,
      );
      // Exactly one — a write that logged twice would double-count in be-5's
      // concurrency drill, where the line count IS the oracle.
      expect(hits).toHaveLength(1);
      const line = hits[0];
      expect(line.classId).toBe(body.class.id);
      // AMENDED by be-6 (WF-65 declared supersession): the key is `teacherIdPrefix`, the
      // name teacher.ts and routes/auth.ts already used at six call sites. The VALUE and
      // the 8-char slice did not move — only what the field is called, and `teacher` is
      // now asserted absent so the rename is complete rather than doubled.
      expect(line.teacherIdPrefix).toBe(teacher.slice(0, 8));
      expect(line.teacherIdPrefix).toHaveLength(8);
      expect(line.teacher).toBeUndefined();
    });

    test("NO log line for this write contains the whole 32-hex bearer value", async () => {
      // The one clause that cannot be satisfied by accident. A credential written to a
      // log cannot be rotated out of wherever that log was shipped.
      if (!LOG) throw new Error("CHAR_BE_LOG is unset — run via tools/ci, not jest directly");
      const teacher = await mintTeacher();
      const { body } = await makeClass(teacher, { name: "3ر8", stream: "لغات أجنبية" });
      const hits = await findLogLines((o) => o.correlationId === body.correlationId);
      expect(hits.length).toBeGreaterThan(0);
      for (const line of hits) {
        expect(JSON.stringify(line)).not.toMatch(HEX32);
        expect(JSON.stringify(line)).not.toContain(teacher);
      }
    });

    test("a REJECTED create logs no class.created — the line means a write happened", async () => {
      if (!LOG) throw new Error("CHAR_BE_LOG is unset — run via tools/ci, not jest directly");
      const teacher = await mintTeacher();
      const { body } = await makeClass(teacher, { name: "3ر1", stream: "رياضيات" });
      const hits = await findLogLines((o) => o.event === "class.created" && o.correlationId === body.correlationId, {
        tries: 4,
      });
      expect(hits).toHaveLength(0);
    });
  });
});
