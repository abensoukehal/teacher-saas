/**
 * be-2 — store a correction, and tell the truth about staleness.
 *
 * The load-bearing clause is "refine ex2 → only ex2 goes stale". A design that keyed
 * staleness off the subject's `rev` passes every other test here and fails that one,
 * because `rev` advances for the whole document — one refine would mark every correction
 * in the exam stale.
 *
 * A stale correction is worse than none: the teacher hands it to a class.
 *
 * Black-box over HTTP. PRECONDITION `tools/dev up -d`. Hollow run is RED (WF-82).
 * NEVER calls /api/generate — both payloads are recorded fixtures.
 */
const fs = require("node:fs");
const path = require("node:path");
const { MongoClient, ObjectId } = require("mongodb");
const { describeIfLane } = require("guard");

const BE = process.env.CHAR_BE_URL || "http://localhost:9000";
const MONGO = "mongodb://127.0.0.1:27017";
const DB = "teacher_saas";

// Fixtures live BESIDE this suite, read with __dirname. Reaching out of the suite's own
// directory has broken promotion three times in this product.
const EXAM = JSON.parse(
  fs.readFileSync(path.join(__dirname, "fixtures/rec-exam-subject.2026-08-07.json"), "utf8"),
).data;
const REC = JSON.parse(
  fs.readFileSync(path.join(__dirname, "fixtures/rec-solution-sheet.2026-08-08.json"), "utf8"),
);
const SOLUTIONS = REC.data.solutions;
const GEN_CORR = REC.correlationId;

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

async function newSubject(teacher) {
  const { body } = await call("POST", "/api/subjects", {
    teacher,
    body: { subject: EXAM, controls: null },
  });
  return body.id;
}

const save = (teacher, sid, solutions, genCorrelationId = GEN_CORR) =>
  call("POST", `/api/subjects/${sid}/solutions`, {
    teacher,
    body: { solutions, genCorrelationId },
  });

const read = (teacher, sid) => call("GET", `/api/subjects/${sid}/solutions`, { teacher });

/** Refine one exercise through the EXISTING route — the thing that causes staleness. */
const refine = (teacher, sid, exId, text) => {
  const base = EXAM.exercises.find((e) => e.id === exId);
  return call("PUT", `/api/subjects/${sid}/exercises/${exId}`, {
    teacher,
    body: { exercise: { ...base, statement: text } },
  });
};

const staleMap = (body) =>
  Object.fromEntries(body.solutions.map((s) => [s.exerciseId, s.stale]));

describeIfLane(BE, "be-2 — solutions storage + staleness", () => {
  beforeAll(async () => {
    mongo = new MongoClient(MONGO);
    await mongo.connect();
    db = mongo.db(DB);
  });
  afterAll(async () => {
    if (mongo) await mongo.close();
  });

  describe("positive — a correction is stored and read back", () => {
    test("POST stores one row per solution; GET returns them, none stale", async () => {
      const t = await newTeacher();
      const sid = await newSubject(t);
      const saved = await save(t, sid, SOLUTIONS);
      expect(saved.status).toBe(201);

      const got = await read(t, sid);
      expect(got.status).toBe(200);
      expect(got.body.solutions).toHaveLength(3);
      expect(staleMap(got.body)).toEqual({ ex1: false, ex2: false, ex3: false });

      const rows = await db
        .collection("solutions")
        .countDocuments({ subjectId: new ObjectId(sid) });
      expect(rows).toBe(3);
    });

    test("the answer and the scale survive verbatim, Arabic and maths intact", async () => {
      const t = await newTeacher();
      const sid = await newSubject(t);
      await save(t, sid, SOLUTIONS);
      const got = await read(t, sid);
      const ex1 = got.body.solutions.find((s) => s.exerciseId === "ex1");
      const src = SOLUTIONS.find((s) => s.exerciseId === "ex1");
      expect(JSON.stringify(ex1.scale)).toBe(JSON.stringify(src.scale));
      expect(ex1.answer).toBe(src.answer);
      expect(ex1.answer).toMatch(/[؀-ۿ]/);
    });

    test("genCorrelationId is stored, so a correction's cost stays answerable", async () => {
      const t = await newTeacher();
      const sid = await newSubject(t);
      await save(t, sid, SOLUTIONS);
      const doc = await db
        .collection("solutions")
        .findOne({ subjectId: new ObjectId(sid), exerciseId: "ex1" });
      expect(doc.genCorrelationId).toBe(GEN_CORR);
    });
  });

  describe("positive — THE LOAD-BEARING CLAUSE: staleness is per exercise", () => {
    test("refining ex2 makes ONLY ex2 stale", async () => {
      const t = await newTeacher();
      const sid = await newSubject(t);
      await save(t, sid, SOLUTIONS);

      const r = await refine(t, sid, "ex2", "نص جديد للتمرين الثاني");
      expect(r.status).toBe(200);

      const got = await read(t, sid);
      // A `rev`-based design fails exactly here: rev advances for the whole document.
      expect(staleMap(got.body)).toEqual({ ex1: false, ex2: true, ex3: false });
    });

    test("every position behaves the same — ex1 first, ex2 middle, ex3 last (WF-70)", async () => {
      for (const id of ["ex1", "ex2", "ex3"]) {
        const t = await newTeacher();
        const sid = await newSubject(t);
        await save(t, sid, SOLUTIONS);
        await refine(t, sid, id, `تعديل ${id}`);
        const got = await read(t, sid);
        const map = staleMap(got.body);
        expect(map[id]).toBe(true);
        for (const other of ["ex1", "ex2", "ex3"].filter((x) => x !== id)) {
          expect(map[other]).toBe(false);
        }
      }
    });

    test("re-saving that one exercise clears its staleness", async () => {
      const t = await newTeacher();
      const sid = await newSubject(t);
      await save(t, sid, SOLUTIONS);
      await refine(t, sid, "ex2", "نص جديد");
      expect(staleMap((await read(t, sid)).body).ex2).toBe(true);

      // regenerate just that one — a partial submission is valid
      const one = SOLUTIONS.filter((s) => s.exerciseId === "ex2");
      const again = await save(t, sid, one);
      expect(again.status).toBe(201);

      const got = await read(t, sid);
      expect(staleMap(got.body)).toEqual({ ex1: false, ex2: false, ex3: false });
      // still exactly one row per exercise — upsert, not append
      expect(
        await db.collection("solutions").countDocuments({ subjectId: new ObjectId(sid) }),
      ).toBe(3);
    });

    test("restoring the original statement makes it current again", async () => {
      const t = await newTeacher();
      const sid = await newSubject(t);
      await save(t, sid, SOLUTIONS);
      const original = EXAM.exercises.find((e) => e.id === "ex1").statement;
      await refine(t, sid, "ex1", "مؤقت");
      expect(staleMap((await read(t, sid)).body).ex1).toBe(true);
      await refine(t, sid, "ex1", original);
      // staleness is DERIVED from content, not a stored flag — so it heals.
      expect(staleMap((await read(t, sid)).body).ex1).toBe(false);
    });
  });

  describe("negative — what must be rejected, with nothing stored", () => {
    test("an exerciseId not in the exam is 400 and stores nothing", async () => {
      const t = await newTeacher();
      const sid = await newSubject(t);
      const bad = [{ exerciseId: "ex99", answer: "لا شيء", scale: [{ part: "جزء", points: 1 }] }];
      const res = await save(t, sid, bad);
      expect(res.status).toBe(400);
      expect(res.body.error.type).toBe("invalid_request");
      expect(
        await db.collection("solutions").countDocuments({ subjectId: new ObjectId(sid) }),
      ).toBe(0);
    });

    test("a scale that does not sum to the exercise's points is 400", async () => {
      const t = await newTeacher();
      const sid = await newSubject(t);
      const bad = [
        { exerciseId: "ex1", answer: "جواب", scale: [{ part: "جزء", points: 99 }] },
      ];
      const res = await save(t, sid, bad);
      expect(res.status).toBe(400);
      expect(res.body.error.type).toBe("invalid_request");
      expect(
        await db.collection("solutions").countDocuments({ subjectId: new ObjectId(sid) }),
      ).toBe(0);
    });

    test("the whole batch is rejected if any entry is bad — never partially stored", async () => {
      const t = await newTeacher();
      const sid = await newSubject(t);
      const mixed = [SOLUTIONS[0], { exerciseId: "ex99", answer: "x", scale: [] }];
      const res = await save(t, sid, mixed);
      expect(res.status).toBe(400);
      expect(
        await db.collection("solutions").countDocuments({ subjectId: new ObjectId(sid) }),
      ).toBe(0);
    });

    test("errors are Arabic and carry a correlationId", async () => {
      const t = await newTeacher();
      const sid = await newSubject(t);
      const res = await save(t, sid, [{ exerciseId: "ex99", answer: "x", scale: [] }]);
      expect(res.body.error.message).toMatch(/[؀-ۿ]/);
      expect(res.body.correlationId).toBeTruthy();
    });
  });

  describe("negative — the perimeter is untouched", () => {
    test("no solutions → 200 with an empty list, never 404", async () => {
      const t = await newTeacher();
      const sid = await newSubject(t);
      const got = await read(t, sid);
      expect(got.status).toBe(200);
      expect(got.body.solutions).toEqual([]);
    });

    test("another teacher's subject is 404, identical to one that never existed", async () => {
      const owner = await newTeacher();
      const sid = await newSubject(owner);
      const stranger = await newTeacher();
      const theirs = await read(stranger, sid);
      const nothing = await read(stranger, "6a7600000000000000000000");
      expect(theirs.status).toBe(404);
      const strip = (b) => ({ ...b, correlationId: undefined });
      expect(strip(theirs.body)).toEqual(strip(nothing.body));
    });

    test("the subject read path gains NO key and the document is unchanged", async () => {
      const t = await newTeacher();
      const sid = await newSubject(t);
      const before = await call("GET", `/api/subjects/${sid}`, { teacher: t });
      await save(t, sid, SOLUTIONS);
      const after = await call("GET", `/api/subjects/${sid}`, { teacher: t });
      expect(Object.keys(after.body).sort()).toEqual(Object.keys(before.body).sort());
      const doc = await db.collection("subjects").findOne({ _id: new ObjectId(sid) });
      expect(Object.keys(doc).some((k) => /solution|answer|scale/i.test(k))).toBe(false);
    });

    test("refining still archives a revision — solutions did not disturb it", async () => {
      const t = await newTeacher();
      const sid = await newSubject(t);
      await save(t, sid, SOLUTIONS);
      await refine(t, sid, "ex3", "نص");
      const rev = await call("GET", `/api/subjects/${sid}/exercises/ex3/revisions`, {
        teacher: t,
      });
      expect(rev.body.revisions).toHaveLength(1);
    });
  });

  describe("negative — concurrency, written from the start", () => {
    test("two simultaneous saves for one exercise leave exactly ONE row", async () => {
      const t = await newTeacher();
      const sid = await newSubject(t);
      const one = SOLUTIONS.filter((s) => s.exerciseId === "ex1");
      const results = await Promise.all([save(t, sid, one), save(t, sid, one)]);
      for (const r of results) expect([201, 409]).toContain(r.status);
      expect(
        await db
          .collection("solutions")
          .countDocuments({ subjectId: new ObjectId(sid), exerciseId: "ex1" }),
      ).toBe(1);
    });
  });
});
