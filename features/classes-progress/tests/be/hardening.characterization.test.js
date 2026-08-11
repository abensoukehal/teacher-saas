/**
 * be-5 — the perimeter drill: probes, abuse, and log truth under fire.
 *
 * THE RULE THIS SUITE EXISTS TO DEFEND: existence is not probeable from any angle.
 * The new surfaces hold credentialed-adjacent data behind a BEARER id with no rate
 * limiting (inherited knowingly, project/CLAUDE.md ⚠), so what CAN be verified must be —
 * and "the 404s look the same" is not verification. This file compares them BYTE FOR
 * BYTE, with only the correlationId masked, across every id shape and every surface.
 *
 * Three other things it pins, each with a specific failure behind it:
 *
 *   1. Malformed input never crashes into an untraceable 500. Every rejection is a
 *      400/404/413 carrying a correlationId, in Arabic, with no Mongo text and no stack
 *      reaching the client. The correlation-id middleware runs BEFORE the body parser
 *      (src/app.ts:36-42) precisely so a body we cannot parse is still traceable — QA
 *      found that one the hard way (BUG-3), and this suite makes it executable.
 *   2. The mutation log tells the truth under REAL concurrency, not just in be-2's
 *      two-writer case. Five writers, one winner, and the log is the oracle — a CAS loss
 *      that emits nothing is indistinguishable from a write that vanished (SEED §5).
 *   3. The no-rate-limit posture, recorded HONESTLY. Auth is limited (src/ratelimit.ts);
 *      the class and progress routes are not. That is a known, accepted gap for this
 *      milestone — pinned here so a future limiter is a deliberate contract change and
 *      not drift nobody noticed.
 *
 * ⚠ THIS SUITE CHANGES NO BEHAVIOUR. be-5 is a hardening/probe sub-issue over surfaces
 * be-1..be-4 already built and froze. Every clause below was reproduced against the lane
 * BEFORE it was written; a clause that failed would have been a stop-and-ask, never an
 * edit to the service.
 *
 * ⚠ CLEANUP IS BY OWNER, never by a tracked-id list. Half these probes expect a REFUSAL,
 * and a tracked list only ever learns about the 201s — worse, an assertion that fails
 * mid-test aborts before the push, so the tracking is least reliable exactly when the
 * suite left the most behind. Deleting everything owned by the teachers this file minted
 * is unconditional and cannot drift out of step with the probes.
 *
 * PRECONDITION: the lane is up. A hollow run is RED in job mode — WF-82.
 */
const { readFileSync, existsSync } = require("node:fs");
const { ObjectId, MongoClient } = require("mongodb");
const { describeIfLane } = require("guard");

const BE = process.env.CHAR_BE_URL || "http://localhost:9000";
const LOG = process.env.CHAR_BE_LOG || "";
const MONGO = "mongodb://127.0.0.1:27017";
const DB = "teacher_saas";

/** One corpus stream is enough here — be-1 already pins all six. */
const STREAM = "شعبة الرياضيات";

/**
 * The recorded 404 body, correlationId masked (contract §6).
 *
 * The matrix below compares its fifteen cells against EACH OTHER, which alone would be
 * satisfied by rewording all fifteen at once. Comparing against this literal too is what
 * makes the pin absolute: the message, the type, the key order and the whitespace are all
 * part of what "byte-identical" means to a caller reading the wire.
 */
const RECORDED_CLASS_404 =
  '{"error":{"message":"القسم غير موجود","type":"class_not_found"},"correlationId":"<CID>"}';

/** The rejections these surfaces are allowed to produce. A 500 is never on this list. */
const ALLOWED_REJECTIONS = new Set([
  "class_not_found",
  "invalid_request",
  "payload_too_large",
  "teacher_required",
  "conflict",
]);

/**
 * Text that must never reach a client. Each entry is a real leak shape, not a guess:
 * driver class names and duplicate-key codes come out of Mongo, `.ts:NN` and `at Object.`
 * come out of a V8 stack, and `node_modules` is the give-away that an internal path was
 * serialised into a response.
 */
const LEAK_MARKERS =
  /MongoError|MongoServerError|MongoNetworkError|E11000|BSONError|BSONTypeError|\.ts:\d+|\.js:\d+|at Object\.|at async |node_modules|"stack"/i;

const HEX32 = /^[0-9a-f]{32}$/;
const NOTE_MAX = 500; // src/routes/progress.ts
const NAME_MAX = 80; // src/routes/classes.ts
const SCHOOL_MAX = 120; // src/routes/auth.ts

/** 10 KB of a single character — over every field bound, under the 1 MB body limit. */
const TEN_KB = "x".repeat(10 * 1024);

let mongo;
let db;

/** Every teacher this file minted. THE cleanup key — see the header note. */
const MINTED_TEACHERS = [];

/**
 * @returns {Promise<{status:number, raw:string, body:object|null}>}
 *
 * `raw` is the response TEXT and is the point of this helper: the parity clauses compare
 * bytes, and `JSON.parse` followed by `JSON.stringify` would silently normalise key order
 * and whitespace — hiding exactly the difference a caller would see.
 */
async function call(method, path, { body, rawBody, teacher, correlationId } = {}) {
  // GET and HEAD carry no body — fetch throws outright rather than ignoring one.
  const bodyless = method === "GET" || method === "HEAD";
  const payload = rawBody !== undefined ? rawBody : body !== undefined ? JSON.stringify(body) : undefined;
  const res = await fetch(`${BE}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(teacher ? { "x-teacher-id": teacher } : {}),
      ...(correlationId ? { "x-correlation-id": correlationId } : {}),
    },
    ...(bodyless || payload === undefined ? {} : { body: payload }),
  });
  const raw = await res.text();
  let parsed = null;
  try {
    parsed = JSON.parse(raw);
  } catch (_e) {
    parsed = null;
  }
  return { status: res.status, raw, body: parsed };
}

/** The one thing that legitimately differs between two otherwise identical responses. */
const mask = (raw) => raw.replace(/"correlationId":"[^"]*"/, '"correlationId":"<CID>"');

async function mintTeacher() {
  const { body } = await call("POST", "/api/teacher");
  MINTED_TEACHERS.push(body.teacherId);
  return body.teacherId;
}

async function makeClass(teacher, name) {
  const res = await call("POST", "/api/classes", { teacher, body: { name, stream: STREAM } });
  if (res.status !== 201) throw new Error(`class setup failed: ${res.status} ${res.raw}`);
  return res.body.class;
}

/** A minimal subject the store will accept — this suite never generates anything. */
const subjectBody = (classId) => ({
  subject: { title: "اختبار", exercises: [{ id: "ex1", statement: "س" }] },
  ...(classId === undefined ? {} : { classId }),
});

/**
 * The whole-perimeter assertion, applied to every abuse probe.
 *
 * A rejection is only clean if it is ALL of these at once: a caller-error status, a
 * classified type the contract names, a correlationId to trace it by, and no internal
 * text. Asserting only the status is how a 400 that leaks a Mongo message passes a gate.
 */
function expectCleanRejection(res) {
  // Asserted on the VALUES rather than on booleans, so a failure prints the status and
  // the type it actually got — the jest test name already carries which probe this was.
  expect([400, 404, 413]).toContain(res.status);
  expect(res.body).not.toBeNull();
  expect([...ALLOWED_REJECTIONS]).toContain(res.body?.error?.type);
  // The middleware-order pin, made executable on every single probe rather than once.
  expect(typeof res.body?.correlationId).toBe("string");
  expect(res.body.correlationId.length).toBeGreaterThan(0);
  expect(res.raw).not.toMatch(LEAK_MARKERS);
  expect(res.body.error.stack).toBeUndefined();
}

/**
 * The log is written by another process through a redirect, so a line can land a beat
 * after the response. Poll rather than sleep a fixed amount.
 */
async function findLogLines(predicate, { tries = 30, waitMs = 50 } = {}) {
  let hits = [];
  for (let i = 0; i < tries; i++) {
    hits = readLog()
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
  return hits;
}

const readLogText = () => readFileSync(LOG, "utf8");
const readLog = () => readLogText().split("\n").filter((l) => l.trim() !== "");

describeIfLane(BE, "be-5 — the perimeter: probes, abuse, and log truth under fire", () => {
  /** Teacher A owns everything; teacher B exists only to be somebody else. */
  let teacherA;
  let teacherB;
  let ownClass;
  let foreignClass;

  /** The five id shapes, and the canonical body every one of them must produce. */
  let ID_SHAPES;
  let canonical404;

  beforeAll(async () => {
    mongo = new MongoClient(MONGO);
    await mongo.connect();
    db = mongo.db(DB);

    teacherA = await mintTeacher();
    teacherB = await mintTeacher();
    ownClass = await makeClass(teacherA, "3ر1");
    foreignClass = await makeClass(teacherB, "3ر2");

    ID_SHAPES = [
      // Well-formed, correct length, simply never inserted. Freshly generated so it
      // cannot collide with a stored class no matter how the collection grows.
      ["well-formed but nonexistent", new ObjectId().toHexString()],
      // Not an id at all.
      ["malformed non-hex", "not-a-class-id-at-all"],
      // Hex, but the wrong length — a truncation bug's signature.
      ["12-char hex", "6a7a7a605877"],
      // A REAL class that exists and belongs to someone else. The cell that matters most:
      // any answer here that differs from "nonexistent" turns the surface into an oracle
      // for other teachers' class ids.
      ["another teacher's real class", () => foreignClass.id],
      // Ids in this product are 24 LOWERCASE hex and the check is case-sensitive
      // (src/routes/progress.ts:26, the teacher.ts:19 discipline). `ObjectId.isValid`
      // accepts uppercase, so without that regex an uppercased id would resolve to a real
      // class through a spelling the product does not use — a second id convention
      // arriving by accident, and a working existence probe.
      ["UPPERCASE of a real owned id", () => ownClass.id.toUpperCase()],
    ];

    const probe = await call("GET", `/api/progress/${new ObjectId().toHexString()}`, {
      teacher: teacherA,
    });
    canonical404 = mask(probe.raw);
  });

  afterAll(async () => {
    // BY OWNER, unconditionally — see the header note. This is the only cleanup, and it
    // does not care which probes happened to succeed.
    if (db && MINTED_TEACHERS.length > 0) {
      const owner = { teacherId: { $in: MINTED_TEACHERS } };
      await db.collection("classes").deleteMany(owner);
      await db.collection("progress").deleteMany(owner);
      await db.collection("subjects").deleteMany(owner);
      await db.collection("teachers").deleteMany(owner);
    }
    if (mongo) await mongo.close();
  });

  // ---------------------------------------------------------------------------------
  // 1 · THE 404 BYTE-PARITY MATRIX — the centre of this sub-issue
  // ---------------------------------------------------------------------------------

  describe("the 404 matrix — existence is not probeable from any angle", () => {
    /**
     * The three surfaces that take a class id from a caller. They must not merely all
     * return 404 — they must return the SAME 404, because a caller who can tell them
     * apart can tell a real class id from an invented one.
     */
    const SURFACES = [
      [
        "GET /api/progress/:classId",
        (id, teacher) => call("GET", `/api/progress/${id}`, { teacher }),
      ],
      [
        "PUT /api/progress/:classId",
        (id, teacher) =>
          call("PUT", `/api/progress/${id}`, { teacher, body: { rev: 0, markedWeek: 1 } }),
      ],
      [
        "POST /api/subjects (classId)",
        (id, teacher) => call("POST", "/api/subjects", { teacher, body: subjectBody(id) }),
      ],
    ];

    it("the canonical body is the one the contract recorded, byte for byte", () => {
      // Without this, the fifteen cells below only prove they agree with each other —
      // a single reword everywhere would keep them all green and change the wire.
      expect(canonical404).toBe(RECORDED_CLASS_404);
    });

    for (const [surfaceName, send] of SURFACES) {
      describe(surfaceName, () => {
        for (const [shapeName] of [
          ["well-formed but nonexistent"],
          ["malformed non-hex"],
          ["12-char hex"],
          ["another teacher's real class"],
          ["UPPERCASE of a real owned id"],
        ]) {
          // One clause per cell — WF-70. A single loop asserting fifteen things reports
          // one failure and hides the other fourteen.
          it(`${shapeName} -> 404 class_not_found, byte-identical`, async () => {
            const entry = ID_SHAPES.find(([n]) => n === shapeName);
            const value = typeof entry[1] === "function" ? entry[1]() : entry[1];
            const res = await send(value, teacherA);

            expect(res.status).toBe(404);
            expect(res.body.error.type).toBe("class_not_found");
            // THE MECHANICAL COMPARISON. Not "looks the same" — the same bytes, with only
            // the correlationId masked.
            expect(mask(res.raw)).toBe(canonical404);
          });
        }
      });
    }

    it("a malformed id is NOT distinguished from an unowned one by status either", async () => {
      // Contract §6 spells this out because 400 is the intuitive answer for a bad shape,
      // and the intuitive answer is the leak: "400 means the id was never real, 404 means
      // it is real and not yours" is a complete oracle built out of two status codes.
      const bad = await call("GET", "/api/progress/not-a-class-id-at-all", { teacher: teacherA });
      const foreign = await call("GET", `/api/progress/${foreignClass.id}`, { teacher: teacherA });
      expect(bad.status).toBe(foreign.status);
      expect(mask(bad.raw)).toBe(mask(foreign.raw));
    });

    it("the owned class answers 200 — the matrix is not green because everything 404s", async () => {
      // The clause that keeps the fifteen above meaningful. A service that answered 404
      // to every id, including real ones, would pass the whole matrix.
      const res = await call("GET", `/api/progress/${ownClass.id}`, { teacher: teacherA });
      expect(res.status).toBe(200);
      expect(res.body.progress.classId).toBe(ownClass.id);
    });

    it("an absent id segment is a ROUTE-level 404, and is class-independent", async () => {
      // RECORDED HONESTLY, not forced into the matrix. `/api/progress/` never reaches the
      // class surfaces at all — it falls to the service's catch-all (src/app.ts:209-211),
      // which has been there since the scaffold commit and answers the same for every
      // unknown path. So its body differs from class_not_found by design, and that is not
      // a parity hole: the answer cannot vary with whether any class exists, which is the
      // only property §6 is protecting.
      const withClass = await call("GET", "/api/progress/", { teacher: teacherA });
      const withoutClass = await call("GET", "/api/progress/", { teacher: teacherB });

      expect(withClass.status).toBe(404);
      expect(withClass.body.error.type).toBe("not_found");
      expect(withClass.body.error.type).not.toBe("class_not_found");
      // Identical for a teacher who owns a class and one asked about a path with no id —
      // nothing about the collection is readable here.
      expect(withClass.raw).toBe(withoutClass.raw);
    });

    it("the catch-all 404 carries NO correlationId — recorded, not fixed here", () => {
      // A pre-existing gap in the route-level catch-all, older than this job (scaffold
      // commit fd122fc) and outside be-5's Delta. Pinned so it is inherited knowingly
      // rather than discovered later, and so closing it is a deliberate change that turns
      // this clause red on purpose.
      return call("GET", "/api/progress/", { teacher: teacherA }).then((res) => {
        expect(res.body.correlationId).toBeUndefined();
      });
    });
  });

  // ---------------------------------------------------------------------------------
  // 2 · ABUSE INPUTS — nothing reaches the datastore as a query operator
  // ---------------------------------------------------------------------------------

  describe("NoSQL-injection shapes on every string field of every new route", () => {
    /**
     * The four shapes that turn a string comparison into a query. `{$ne:null}` matches
     * every document, `{$exists:true}` the same, `{$regex:".*"}` the same by another road,
     * and the array form is what a repeated HTTP param or a hand-rolled client produces.
     * A field that accepted any of them would read another teacher's rows through a
     * filter that was supposed to bound them.
     */
    const INJECTIONS = [
      ["$ne", { $ne: null }],
      ["$exists", { $exists: true }],
      ["$regex", { $regex: ".*" }],
      ["array-wrapped", ["6a7a7a605877e8523b8b0000"]],
    ];

    /** Every string-bearing field on every surface this slice added. */
    const FIELDS = [
      ["POST /api/classes · name", (v, t) => call("POST", "/api/classes", { teacher: t, body: { name: v, stream: STREAM } })],
      ["POST /api/classes · stream", (v, t) => call("POST", "/api/classes", { teacher: t, body: { name: "n", stream: v } })],
      ["POST /api/subjects · classId", (v, t) => call("POST", "/api/subjects", { teacher: t, body: subjectBody(v) })],
      ["PUT /api/progress · rev", (v, t) => call("PUT", `/api/progress/${ownClass.id}`, { teacher: t, body: { rev: v, markedWeek: 1 } })],
      ["PUT /api/progress · markedWeek", (v, t) => call("PUT", `/api/progress/${ownClass.id}`, { teacher: t, body: { rev: 0, markedWeek: v } })],
      ["PUT /api/progress · entry.week", (v, t) => call("PUT", `/api/progress/${ownClass.id}`, { teacher: t, body: { rev: 0, markedWeek: 1, entry: { week: v, status: "done" } } })],
      ["PUT /api/progress · entry.status", (v, t) => call("PUT", `/api/progress/${ownClass.id}`, { teacher: t, body: { rev: 0, markedWeek: 1, entry: { week: 1, status: v } } })],
      ["PUT /api/progress · entry.note", (v, t) => call("PUT", `/api/progress/${ownClass.id}`, { teacher: t, body: { rev: 0, markedWeek: 1, entry: { week: 1, status: "done", note: v } } })],
      ["PUT /api/teacher/school · school", (v, t) => call("PUT", "/api/teacher/school", { teacher: t, body: { school: v } })],
    ];

    for (const [fieldName, send] of FIELDS) {
      for (const [shapeName, value] of INJECTIONS) {
        // One clause per (field × shape) — WF-70.
        it(`${fieldName} rejects ${shapeName}`, async () => {
          const res = await send(value, teacherA);
          expectCleanRejection(res);
        });
      }
    }

    it("the query string cannot smuggle an operator into ?classId", async () => {
      // Express's default query parser builds OBJECTS from bracket syntax, so
      // `?classId[$ne]=null` arrives as `{$ne: "null"}` rather than a string. The route
      // refuses any non-string (src/routes/subjects.ts:220) — the same guard that catches
      // a repeated param, doing double duty.
      for (const q of ["classId%5B%24ne%5D=null", "classId%5B%24regex%5D=.*", "classId%5B%24exists%5D=true"]) {
        const res = await call("GET", `/api/subjects?${q}`, { teacher: teacherA });
        expectCleanRejection(res);
        expect(res.body.error.type).toBe("invalid_request");
      }
    });

    it("an operator-shaped x-teacher-id is a 401, never a query", async () => {
      // The header is the bearer value and the join key; if it reached the store as an
      // object it would match every teacher's rows at once.
      const res = await call("GET", "/api/classes", { teacher: '{"$ne":null}' });
      expect(res.status).toBe(401);
      expect(res.body.error.type).toBe("teacher_required");
      expect(res.raw).not.toMatch(LEAK_MARKERS);
    });
  });

  describe("over-length values and oversized payloads", () => {
    it(`a ${TEN_KB.length}-byte class name is 400, not 500`, async () => {
      const res = await call("POST", "/api/classes", {
        teacher: teacherA,
        body: { name: TEN_KB, stream: STREAM },
      });
      expectCleanRejection(res);
      expect(res.status).toBe(400);
    });

    it("a 10 KB progress note is 400, not 500", async () => {
      const res = await call("PUT", `/api/progress/${ownClass.id}`, {
        teacher: teacherA,
        body: { rev: 0, markedWeek: 1, entry: { week: 1, status: "done", note: TEN_KB } },
      });
      expectCleanRejection(res);
      expect(res.status).toBe(400);
    });

    it("a 10 KB school is 400, not 500", async () => {
      const res = await call("PUT", "/api/teacher/school", {
        teacher: teacherA,
        body: { school: TEN_KB },
      });
      expectCleanRejection(res);
      expect(res.status).toBe(400);
    });

    it("the bounds are exact — one character over is refused, exactly at is accepted", async () => {
      // The over-length clauses above would pass against a service that refused
      // everything. These pin WHERE the line is, so a bound that silently moves is caught.
      const atName = await call("POST", "/api/classes", {
        teacher: teacherA,
        body: { name: "ن".repeat(NAME_MAX), stream: STREAM },
      });
      expect(atName.status).toBe(201);
      const overName = await call("POST", "/api/classes", {
        teacher: teacherA,
        body: { name: "ن".repeat(NAME_MAX + 1), stream: STREAM },
      });
      expect(overName.status).toBe(400);

      const atSchool = await call("PUT", "/api/teacher/school", {
        teacher: teacherA,
        body: { school: "م".repeat(SCHOOL_MAX) },
      });
      expect(atSchool.status).toBe(200);
      const overSchool = await call("PUT", "/api/teacher/school", {
        teacher: teacherA,
        body: { school: "م".repeat(SCHOOL_MAX + 1) },
      });
      expect(overSchool.status).toBe(400);
    });

    it("a body past the 1 MB parser limit is 413 payload_too_large, not 500", async () => {
      const res = await call("POST", "/api/classes", {
        teacher: teacherA,
        rawBody: JSON.stringify({ name: "x".repeat(2 * 1024 * 1024), stream: STREAM }),
      });
      expectCleanRejection(res);
      expect(res.status).toBe(413);
      expect(res.body.error.type).toBe("payload_too_large");
    });
  });

  describe("malformed JSON — the middleware-order pin, executable", () => {
    const MALFORMED = '{"rev":0,"markedWeek":';

    const TARGETS = [
      ["POST /api/classes", () => call("POST", "/api/classes", { teacher: teacherA, rawBody: MALFORMED })],
      ["PUT /api/progress/:classId", () => call("PUT", `/api/progress/${ownClass.id}`, { teacher: teacherA, rawBody: MALFORMED })],
      ["POST /api/subjects", () => call("POST", "/api/subjects", { teacher: teacherA, rawBody: MALFORMED })],
      ["PUT /api/teacher/school", () => call("PUT", "/api/teacher/school", { teacher: teacherA, rawBody: MALFORMED })],
    ];

    for (const [name, send] of TARGETS) {
      it(`${name} answers 400 WITH a correlationId`, async () => {
        const res = await send();
        expect(res.status).toBe(400);
        expect(res.body.error.type).toBe("invalid_request");
        // THE POINT. The correlation-id middleware runs before express.json, so the one
        // response a caller most needs to trace is traceable. It used to run after.
        expect(typeof res.body.correlationId).toBe("string");
        expect(res.body.correlationId.length).toBeGreaterThan(0);
        expect(res.raw).not.toMatch(LEAK_MARKERS);
      });
    }

    it("a malformed body cannot be used to distinguish a real class from an invented one", async () => {
      // The parser runs before routing, so the answer is identical either way — which
      // means the 400/404 ORDERING is not itself an existence oracle.
      const real = await call("PUT", `/api/progress/${ownClass.id}`, { teacher: teacherA, rawBody: MALFORMED });
      const fake = await call("PUT", `/api/progress/${new ObjectId().toHexString()}`, { teacher: teacherA, rawBody: MALFORMED });
      const junk = await call("PUT", "/api/progress/garbage", { teacher: teacherA, rawBody: MALFORMED });
      expect(mask(real.raw)).toBe(mask(fake.raw));
      expect(mask(real.raw)).toBe(mask(junk.raw));
    });

    it("NaN and Infinity are malformed JSON, and land as 400 rather than a coerced number", async () => {
      // There is no NaN literal in JSON. A service that accepted one would have to be
      // parsing something other than JSON — and a NaN markedWeek passes `> totalWeeks`
      // and `< 0` both, so it would sail through the bounds check.
      for (const rawBody of ['{"rev":0,"markedWeek":NaN}', '{"rev":0,"markedWeek":Infinity}']) {
        const res = await call("PUT", `/api/progress/${ownClass.id}`, { teacher: teacherA, rawBody });
        expect(res.status).toBe(400);
        expect(res.body.error.type).toBe("invalid_request");
        expect(typeof res.body.correlationId).toBe("string");
      }
    });
  });

  describe("numeric abuse on the progress write", () => {
    const CASES = [
      ["markedWeek 1e9", { rev: 0, markedWeek: 1e9 }],
      ["markedWeek 1000000000", { rev: 0, markedWeek: 1000000000 }],
      ["markedWeek -1", { rev: 0, markedWeek: -1 }],
      ["markedWeek 1.5", { rev: 0, markedWeek: 1.5 }],
      ['markedWeek "8" (string)', { rev: 0, markedWeek: "8" }],
      ["markedWeek null", { rev: 0, markedWeek: null }],
      ["markedWeek absent", { rev: 0 }],
      ["rev -1", { rev: -1, markedWeek: 1 }],
      ["rev 1.5", { rev: 1.5, markedWeek: 1 }],
      ['rev "0" (string)', { rev: "0", markedWeek: 1 }],
      ["rev absent", { markedWeek: 1 }],
      ["entry.week 0 (entries are 1-based)", { rev: 0, markedWeek: 1, entry: { week: 0, status: "done" } }],
      ["entry.status unknown", { rev: 0, markedWeek: 1, entry: { week: 1, status: "DONE" } }],
      ["entry unknown key", { rev: 0, markedWeek: 1, entry: { week: 1, status: "done", colour: "red" } }],
      [`entry.note ${NOTE_MAX + 1} chars`, { rev: 0, markedWeek: 1, entry: { week: 1, status: "done", note: "ن".repeat(NOTE_MAX + 1) } }],
    ];

    for (const [name, body] of CASES) {
      it(`${name} -> clean 400`, async () => {
        const res = await call("PUT", `/api/progress/${ownClass.id}`, { teacher: teacherA, body });
        expectCleanRejection(res);
        expect(res.status).toBe(400);
        expect(res.body.error.type).toBe("invalid_request");
      });
    }

    it("nothing above was written — the class is still at week 0, rev 0", async () => {
      // The clause that makes the fifteen above worth having. A 400 that nevertheless
      // wrote would be a far worse defect than a 500 that did not.
      const res = await call("GET", `/api/progress/${ownClass.id}`, { teacher: teacherA });
      expect(res.status).toBe(200);
      expect(res.body.progress.rev).toBe(0);
      expect(res.body.progress.markedWeek).toBe(0);
      expect(res.body.progress.entries).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------------
  // 3 · THE FIVE-WRITER CAS DRILL — the log is the oracle, not the status codes
  // ---------------------------------------------------------------------------------

  describe("five concurrent writers, one winner, and the log proves it", () => {
    const WRITERS = 5;
    let drillClass;
    let nonce;
    let responses;
    let logLines;

    beforeAll(async () => {
      // Its own class, so the drill cannot be perturbed by anything above it.
      drillClass = await makeClass(teacherA, "drill");
      nonce = `be5-cas-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

      // Every writer claims rev 0 and asks for a DIFFERENT week, so the stored document
      // identifies its own winner — "one of them won" is much weaker than "this one did".
      responses = await Promise.all(
        Array.from({ length: WRITERS }, (_, i) =>
          call("PUT", `/api/progress/${drillClass.id}`, {
            teacher: teacherA,
            correlationId: `${nonce}-${i + 1}`,
            body: { rev: 0, markedWeek: i + 1 },
          }).then((res) => ({ ...res, sentCid: `${nonce}-${i + 1}`, week: i + 1 })),
        ),
      );

      logLines = await findLogLines(
        (o) => o.msg === "progress.write" && o.classId === drillClass.id,
        { tries: 40 },
      );
    });

    it("exactly one 200 and four 409 conflict", () => {
      const won = responses.filter((r) => r.status === 200);
      const lost = responses.filter((r) => r.status === 409);
      expect(won).toHaveLength(1);
      expect(lost).toHaveLength(WRITERS - 1);
      for (const r of lost) expect(r.body.error.type).toBe("conflict");
      // The winner's response carries the NEW rev — stored rev + 1, contract §4.
      expect(won[0].body.progress.rev).toBe(1);
    });

    it("the log shows exactly one win and four cas_loss", () => {
      // THE CLAUSE THIS SUB-ISSUE'S OBSERVABILITY EXISTS FOR (SEED §5). Five 409s prove
      // the caller was refused; only the log distinguishes "the compare-and-set did its
      // job" from "four writes vanished", and from the outside those are the same 409.
      expect(logLines).toHaveLength(WRITERS);
      expect(logLines.filter((l) => l.outcome === "win")).toHaveLength(1);
      expect(logLines.filter((l) => l.outcome === "cas_loss")).toHaveLength(WRITERS - 1);
    });

    it("five distinct correlationIds, each matching a response", () => {
      const logged = logLines.map((l) => l.correlationId).sort();
      const sent = responses.map((r) => r.sentCid).sort();
      expect(new Set(logged).size).toBe(WRITERS);
      expect(logged).toEqual(sent);
      // And each response echoed the id it was given, so the join is real in both
      // directions rather than merely the same set by coincidence.
      for (const r of responses) expect(r.body.correlationId).toBe(r.sentCid);
    });

    it("the winning log line is the winning response, not just any of the five", () => {
      const winner = responses.find((r) => r.status === 200);
      const winLine = logLines.find((l) => l.outcome === "win");
      expect(winLine.correlationId).toBe(winner.sentCid);
      expect(winLine.rev).toBe(1);
      expect(winLine.week).toBe(winner.week);
      // Each loser logs the rev it BELIEVED IN (0), which is the useful half of a loss.
      for (const l of logLines.filter((x) => x.outcome === "cas_loss")) expect(l.rev).toBe(0);
    });

    it("every line carries an 8-char teacher prefix and never the bearer value", () => {
      for (const l of logLines) {
        expect(l.teacher).toBe(teacherA.slice(0, 8));
        expect(l.teacher).toHaveLength(8);
        // The whole id must not have arrived under a different key.
        expect(l.teacherId).toBeUndefined();
        expect(JSON.stringify(l)).not.toContain(teacherA);
      }
    });

    it("zero full 32-hex ids anywhere in the drill's log lines", () => {
      // Not just OUR id — any 32-hex run at all. A teacher id logged whole cannot be
      // rotated out of wherever that log was shipped, so the check is shape-based rather
      // than value-based.
      for (const l of logLines) {
        const hits = JSON.stringify(l).match(/[0-9a-f]{32}/g) || [];
        expect(hits).toEqual([]);
      }
    });

    it("the stored document reflects the winner alone", async () => {
      const winner = responses.find((r) => r.status === 200);
      const docs = await db.collection("progress").find({ classId: drillClass.id }).toArray();
      // ONE document — the unique {classId:1} index is what turns a concurrent double
      // insert into a duplicate key, and thence into the same 409 as a CAS loss.
      expect(docs).toHaveLength(1);
      expect(docs[0].rev).toBe(1);
      expect(docs[0].markedWeek).toBe(winner.week);
      // And the read surface agrees with the collection.
      const read = await call("GET", `/api/progress/${drillClass.id}`, { teacher: teacherA });
      expect(read.body.progress.markedWeek).toBe(winner.week);
      expect(read.body.progress.rev).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------------
  // 4 · THE NO-RATE-LIMIT POSTURE — recorded as the accepted gap it is
  // ---------------------------------------------------------------------------------

  describe("rate limiting: auth has it, these routes do not (accepted gap)", () => {
    /**
     * ⚠ THIS IS A RECORDING OF THE CURRENT STATE, NOT AN ENDORSEMENT.
     *
     * The class and progress routes are NOT rate limited. They sit behind `requireTeacher`
     * with a BEARER id that is recoverable but not secret (project/CLAUDE.md ⚠), and the
     * contract says so explicitly: "rate_limited stays auth-only — these routes are not
     * rate-limited in slice 1 (inherited knowingly)" (§6).
     *
     * be-5 must NOT add a limiter — that is a product decision, not a hardening freebie,
     * and its Delta forbids it. What be-5 CAN do is make the gap executable, so that the
     * day someone adds one it is a deliberate contract change that turns this clause red,
     * rather than drift that nobody notices until `fe` starts seeing 429s it cannot
     * render.
     */
    it("11 rapid POST /api/classes all succeed — no 429 on this surface", async () => {
      const results = await Promise.all(
        Array.from({ length: 11 }, (_, i) =>
          call("POST", "/api/classes", {
            teacher: teacherA,
            body: { name: `rl${i}`, stream: STREAM },
          }),
        ),
      );
      for (const r of results) expect(r.status).toBe(201);
      expect(results.some((r) => r.status === 429)).toBe(false);
    });

    it("11 rapid GET /api/progress all succeed — no 429 on the read either", async () => {
      const results = await Promise.all(
        Array.from({ length: 11 }, () =>
          call("GET", `/api/progress/${ownClass.id}`, { teacher: teacherA }),
        ),
      );
      for (const r of results) expect(r.status).toBe(200);
    });

    it("11 rapid PUT /api/teacher/school all succeed — no 429", async () => {
      // Deliberately included: it is the one new surface that writes to the CREDENTIAL
      // row, so if any of the three were going to be limited it would be this one.
      const results = [];
      for (let i = 0; i < 11; i++) {
        results.push(await call("PUT", "/api/teacher/school", { teacher: teacherA, body: { school: `ثانوية ${i}` } }));
      }
      for (const r of results) expect(r.status).toBe(200);
    });

    it("the limiter still exists for auth — the gap is scoped, not absent", async () => {
      // Read through /health rather than by exhausting a bucket: these suites share one
      // service on the lane (WF-84), and a suite that drains the signin bucket breaks a
      // sibling in a way that looks like a product bug and is not.
      const res = await fetch(`${BE}/health`);
      const health = await res.json();
      expect(health.authRateLimit).toBeDefined();
      for (const surface of ["signup", "signin", "recover"]) {
        expect(typeof health.authRateLimit[surface]).toBe("number");
        expect(health.authRateLimit[surface]).toBeGreaterThan(0);
      }
    });
  });

  // ---------------------------------------------------------------------------------
  // 5 · THE LOG, WHOLE — no bearer value anywhere in it
  // ---------------------------------------------------------------------------------

  describe("the mutation log never carries a whole teacher id", () => {
    it("the lane log is readable and contains this suite's own writes", () => {
      // FIRST, so the scan below cannot pass vacuously. A missing or wrong CHAR_BE_LOG
      // would make "the id appears nowhere" trivially true — which is exactly the hollow
      // green WF-82 exists to refuse.
      expect(LOG).not.toBe("");
      expect(existsSync(LOG)).toBe(true);
      const text = readLogText();
      expect(text).toContain(ownClass.id);
      expect(text).toContain('"msg":"class.created"');
    });

    it("no teacher id this suite minted appears anywhere in the log", () => {
      const text = readLogText();
      for (const id of MINTED_TEACHERS) {
        expect(HEX32.test(id)).toBe(true);
        // Every route above was driven with these ids — creates, reads, refusals,
        // malformed bodies, injections and the concurrency drill. If any code path logged
        // the header instead of its prefix, this is where it surfaces.
        expect(text.includes(id)).toBe(false);
        // The prefix must still be there, or the log is not identifying the writer at all.
        expect(text).toContain(id.slice(0, 8));
      }
    });

    it("rejected requests log a prefix too, never the bearer value", async () => {
      // `teacher.rejected` (src/teacher.ts:71-80) is the precedent every mutation line
      // follows. Note the KEY DIFFERS from the mutation log's: this line says
      // `teacherIdPrefix`, `mutationlog.ts` says `teacher`. Both are prefix-only, so the
      // discipline holds and nothing leaks — but an operator grepping one name will not
      // find the other, so both are pinned here rather than assumed identical.
      const forged = "f".repeat(32);
      const res = await call("GET", "/api/classes", { teacher: forged });
      expect(res.status).toBe(401);
      const lines = await findLogLines(
        (o) => o.msg === "teacher.rejected" && o.teacherIdPrefix === forged.slice(0, 8),
      );
      expect(lines.length).toBeGreaterThan(0);
      for (const l of lines) expect(l.teacherIdPrefix).toHaveLength(8);
      expect(readLogText().includes(forged)).toBe(false);
    });
  });
});
