/**
 * be-6 — the catch-all speaks Arabic, and one name for the teacher prefix.
 *
 * TWO DEFECTS, BOTH SMALL, BOTH REAL, and this suite is the executable form of each.
 *
 *   1. The service's catch-all 404 answered `{"error":{"message":"not found",...}}` —
 *      ENGLISH, on a product whose FIRST hard constraint is Arabic-only — and carried no
 *      `correlationId` in the BODY even though the header always had one. Both halves
 *      matter because of the same consumer: `fe` renders `payload.error.message` RAW to
 *      the teacher and reads the id out of `payload.correlationId`, never the header
 *      (fe/src/lib/api.ts). So the old body was simultaneously an English string in front
 *      of a teacher and the one response its own client could not trace. The sibling
 *      handler ten lines below was fixed for exactly this reason (QA BUG-3, malformed
 *      body → «الطلب غير صالح»); the catch-all was missed.
 *
 *   2. `src/mutationlog.ts` logged the teacher prefix under the key `teacher`, while
 *      `src/teacher.ts` and `src/routes/auth.ts` had already been calling that same
 *      concept `teacherIdPrefix` at six call sites. One field, two names — an operator
 *      greps one and misses the other, and the miss is silent.
 *
 * ⚠ THIS IS A WF-65 DECLARED SUPERSESSION, and it is the whole reason this file names
 * what it changed. be-5 pinned the English body and the missing correlationId; be-1,
 * be-2 and be-5 pinned the `teacher` log key. Those pins were TRUE — they recorded the
 * service as it was — and be-6's declared scope is to move exactly that behaviour. What
 * did NOT move is asserted below at least as strictly as before:
 *   · `error.type` stays `not_found`. Callers branch on the type, never the message.
 *   · every OTHER error body is compared against a recorded literal, byte for byte.
 *   · the `/api` index is compared by exact set equality, both directions.
 *   · the logged VALUE and its 8-char slice are unchanged; only the key is renamed, and
 *     the old key is asserted ABSENT so the rename is complete rather than doubled.
 *
 * PRECONDITION: the lane is up. A hollow run is RED in job mode — WF-82.
 */
const { readFileSync } = require("node:fs");
const { ObjectId, MongoClient } = require("mongodb");
const { describeIfLane } = require("guard");

const BE = process.env.CHAR_BE_URL || "http://localhost:9000";
const LOG = process.env.CHAR_BE_LOG || "";
const MONGO = "mongodb://127.0.0.1:27017";
const DB = "teacher_saas";

const STREAM = "شعبة الرياضيات";

/**
 * The catch-all body as it must now read, correlationId masked.
 *
 * A literal and not just "is it Arabic": the message, the type, the key ORDER and the
 * whitespace are all part of what a caller sees on the wire, and `fe` shows the message
 * to a teacher verbatim. Rewording it is a product decision, and this line is what makes
 * it a deliberate one.
 */
const RECORDED_CATCHALL_404 =
  '{"error":{"message":"الصفحة غير موجودة","type":"not_found"},"correlationId":"<CID>"}';

/**
 * Every OTHER error body this job's surfaces can produce, recorded as literals.
 *
 * THE PERIMETER DIFFERENTIAL. be-6 changed one body; these four prove it changed only
 * that one. Each is a shape a real caller depends on, and each was reproduced against the
 * lane before it was written here.
 */
const RECORDED_401 =
  '{"error":{"message":"مطلوب تسجيل الدخول","type":"teacher_required"},"correlationId":"<CID>"}';
const RECORDED_CLASS_404 =
  '{"error":{"message":"القسم غير موجود","type":"class_not_found"},"correlationId":"<CID>"}';
const RECORDED_MALFORMED_BODY =
  '{"error":{"message":"الطلب غير صالح","type":"invalid_request"},"correlationId":"<CID>"}';
const RECORDED_CONFLICT =
  '{"error":{"message":"تغيّر تقدّم القسم أثناء الحفظ","type":"conflict"},"correlationId":"<CID>"}';

/** The `/api` index, unchanged by this sub-issue — asserted as an exact set. */
const RECORDED_ROUTES = [
  "/health",
  "/api/skills",
  "/api/generate",
  "/api/teacher",
  "/api/subjects",
  "/api/exams",
  "/api/classes",
  "/api/progress",
  "/api/auth/signup",
  "/api/auth/signin",
  "/api/auth/recover",
];

/** Any Arabic letter, and any Latin one. The message must have the first and none of the second. */
const ARABIC = /[؀-ۿ]/;
const LATIN = /[A-Za-z]/;
const HEX32 = /[0-9a-f]{32}/;

let mongo;
let db;

/** Every teacher this file minted. THE cleanup key — never a tracked-id list. */
const MINTED_TEACHERS = [];

async function call(method, path, { body, rawBody, teacher, correlationId } = {}) {
  const bodyless = method === "GET" || method === "HEAD";
  const payload =
    rawBody !== undefined ? rawBody : body !== undefined ? JSON.stringify(body) : undefined;
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
  return { status: res.status, raw, body: parsed, header: res.headers.get("x-correlation-id") };
}

/** The one thing that legitimately differs between two otherwise identical responses. */
const mask = (raw) => raw.replace(/"correlationId":"[^"]*"/, '"correlationId":"<CID>"');

async function mintTeacher() {
  const { body } = await call("POST", "/api/teacher");
  MINTED_TEACHERS.push(body.teacherId);
  return body.teacherId;
}

async function makeClass(teacher, name = "3ر1") {
  const res = await call("POST", "/api/classes", { teacher, body: { name, stream: STREAM } });
  if (res.status !== 201) throw new Error(`class setup failed: ${res.status} ${res.raw}`);
  return res.body.class;
}

const readLogLines = () =>
  readFileSync(LOG, "utf8")
    .split("\n")
    .filter((l) => l.trim() !== "")
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch (_e) {
        return null;
      }
    })
    .filter(Boolean);

/** The log is written through a redirect by another process — poll, never sleep a fixed amount. */
async function findLogLines(predicate, { tries = 30, waitMs = 50 } = {}) {
  let hits = [];
  for (let i = 0; i < tries; i++) {
    hits = readLogLines().filter(predicate);
    if (hits.length > 0) return hits;
    await new Promise((r) => setTimeout(r, waitMs));
  }
  return hits;
}

function requireLog() {
  if (!LOG) throw new Error("CHAR_BE_LOG is unset — run via tools/ci, not jest directly");
}

describeIfLane(BE, "be-6 — the catch-all speaks Arabic, and one name for the teacher prefix", () => {
  let teacherA;
  let teacherB;
  let ownClass;

  beforeAll(async () => {
    mongo = new MongoClient(MONGO);
    await mongo.connect();
    db = mongo.db(DB);
    teacherA = await mintTeacher();
    teacherB = await mintTeacher();
    ownClass = await makeClass(teacherA);
  });

  afterAll(async () => {
    if (db && MINTED_TEACHERS.length > 0) {
      const scope = { teacherId: { $in: MINTED_TEACHERS } };
      await db.collection("classes").deleteMany(scope);
      await db.collection("progress").deleteMany(scope);
      await db.collection("teachers").deleteMany(scope);
    }
    if (mongo) await mongo.close();
  });

  // ---------------------------------------------------------------------------------
  // 1 · THE CATCH-ALL SPEAKS ARABIC  (supersedes be-5's two catch-all clauses)
  // ---------------------------------------------------------------------------------

  describe("no English string reaches the client on ANY unrouted path", () => {
    /**
     * Unrouted paths of every shape that reaches the catch-all: a bare unknown segment,
     * an unknown segment under a REAL prefix (the one a typo in `fe` produces), a
     * trailing-slash path whose id segment is missing, and a deep path under a real
     * prefix. One clause per shape — a single probe would be satisfied by one lucky path.
     */
    const UNROUTED = [
      ["a bare unknown path", "/api/nope"],
      ["outside /api entirely", "/nope"],
      ["an unknown segment under a real prefix", "/api/teacher/nope"],
      ["a missing id segment", "/api/progress/"],
      ["a deep path under a real prefix", "/api/classes/x/y/z"],
    ];

    for (const [shapeName, path] of UNROUTED) {
      it(`${shapeName} -> 404, Arabic, with a correlationId in the BODY`, async () => {
        const res = await call("GET", path, { teacher: teacherA });
        expect(res.status).toBe(404);
        // The literal, byte for byte. The clauses below name the individual properties;
        // this one is what stops all of them being reworded at once.
        expect(mask(res.raw)).toBe(RECORDED_CATCHALL_404);
        expect(res.body.error.message).toMatch(ARABIC);
        expect(res.body.error.message).not.toMatch(LATIN);
        expect(typeof res.body.correlationId).toBe("string");
        expect(res.body.correlationId.length).toBeGreaterThan(0);
      });
    }

    it("the four HTTP methods a client actually sends all answer the same body", async () => {
      // The catch-all is method-independent, and it must stay that way: a POST that fell
      // through to a different handler would be a second, unpinned 404 shape.
      const methods = ["GET", "POST", "PUT", "DELETE"];
      const bodies = [];
      for (const m of methods) {
        const res = await call(m, "/api/nope", { teacher: teacherA, ...(m === "GET" ? {} : { body: {} }) });
        expect(res.status).toBe(404);
        bodies.push(mask(res.raw));
      }
      expect(new Set(bodies).size).toBe(1);
      expect(bodies[0]).toBe(RECORDED_CATCHALL_404);
    });

    it("the body's correlationId IS the header's, and echoes a caller-supplied one", async () => {
      // The point of putting it in the body at all: `fe` reads `payload.correlationId`
      // and never the header, so a body id that disagreed with the header would send a
      // teacher to support with an id `tools/obs trace` cannot find.
      const mine = "be6-" + new ObjectId().toHexString();
      const res = await call("GET", "/api/nope", { teacher: teacherA, correlationId: mine });
      expect(res.body.correlationId).toBe(mine);
      expect(res.header).toBe(mine);
    });

    it("an UNAUTHENTICATED caller gets the same catch-all body — it is not a guard", async () => {
      // The catch-all sits after every route, so it answers before any teacher check.
      // Identical with and without a header proves it did not accidentally become an
      // existence oracle in the other direction.
      const withTeacher = await call("GET", "/api/nope", { teacher: teacherA });
      const without = await call("GET", "/api/nope");
      expect(mask(withTeacher.raw)).toBe(mask(without.raw));
      expect(mask(without.raw)).toBe(RECORDED_CATCHALL_404);
    });

    it("the answer cannot vary with whether the asking teacher owns a class", async () => {
      // The non-probeability property be-5 protects, re-checked after the body moved.
      const a = await call("GET", "/api/progress/", { teacher: teacherA }); // owns one
      const b = await call("GET", "/api/progress/", { teacher: teacherB }); // owns none
      expect(mask(a.raw)).toBe(mask(b.raw));
    });
  });

  describe("negative — the TYPE did not move, and real routes still resolve", () => {
    it("error.type is still exactly `not_found`", async () => {
      // The half of the body that must NOT change. Callers branch on `error.type`
      // (project/CLAUDE.md), so renaming it while translating the message would have been
      // a silent breaking change dressed up as a translation.
      const res = await call("GET", "/api/nope", { teacher: teacherA });
      expect(res.body.error.type).toBe("not_found");
      expect(res.body.error.type).not.toBe("class_not_found");
      expect(Object.keys(res.body.error).sort()).toEqual(["message", "type"]);
      expect(Object.keys(res.body).sort()).toEqual(["correlationId", "error"]);
    });

    it("a REAL route still answers 200 — the catch-all did not start swallowing traffic", async () => {
      // Without this, a service that 404'd everything would pass every clause above.
      const res = await call("GET", `/api/progress/${ownClass.id}`, { teacher: teacherA });
      expect(res.status).toBe(200);
      expect(res.body.progress.classId).toBe(ownClass.id);
    });
  });

  // ---------------------------------------------------------------------------------
  // 2 · THE PERIMETER DIFFERENTIAL — every OTHER error body byte-identical
  // ---------------------------------------------------------------------------------

  describe("every other error body is unchanged, byte for byte", () => {
    it("the 401 gate", async () => {
      const res = await call("GET", "/api/classes");
      expect(res.status).toBe(401);
      expect(mask(res.raw)).toBe(RECORDED_401);
    });

    it("class_not_found — and it is still DISTINCT from the catch-all", async () => {
      const res = await call("GET", `/api/progress/${new ObjectId().toHexString()}`, {
        teacher: teacherA,
      });
      expect(res.status).toBe(404);
      expect(mask(res.raw)).toBe(RECORDED_CLASS_404);
      // Two different 404s that must not converge: one says "this class is not yours or
      // not there", the other says "there is no such route". Collapsing them would make
      // a typo in `fe` indistinguishable from a missing class.
      expect(mask(res.raw)).not.toBe(RECORDED_CATCHALL_404);
    });

    it("invalid_request from a malformed body — the sibling handler be-6 copied", async () => {
      const res = await call("POST", "/api/classes", { teacher: teacherA, rawBody: "{not json" });
      expect(res.status).toBe(400);
      expect(mask(res.raw)).toBe(RECORDED_MALFORMED_BODY);
    });

    it("conflict from a stale progress rev", async () => {
      const klass = await makeClass(teacherA, "3ر2");
      const first = await call("PUT", `/api/progress/${klass.id}`, {
        teacher: teacherA,
        body: { rev: 0, markedWeek: 3 },
      });
      expect(first.status).toBe(200);
      // The same rev again — the compare-and-set now loses.
      const stale = await call("PUT", `/api/progress/${klass.id}`, {
        teacher: teacherA,
        body: { rev: 0, markedWeek: 4 },
      });
      expect(stale.status).toBe(409);
      expect(mask(stale.raw)).toBe(RECORDED_CONFLICT);
    });

    it("the /api index gained nothing and lost nothing", async () => {
      const { status, body } = await call("GET", "/api");
      expect(status).toBe(200);
      expect(body.service).toBe("teacher-be");
      expect([...body.routes].sort()).toEqual([...RECORDED_ROUTES].sort());
    });

    it("/health still answers", async () => {
      const { status, body } = await call("GET", "/health");
      expect(status).toBe(200);
      expect(body.service).toBe("teacher-be");
    });
  });

  // ---------------------------------------------------------------------------------
  // 3 · ONE NAME FOR THE TEACHER PREFIX  (supersedes be-1/be-2/be-5's log-key clauses)
  // ---------------------------------------------------------------------------------

  describe("the mutation log calls the prefix what the rest of the service calls it", () => {
    it("class.created logs `teacherIdPrefix`, 8 chars, and no `teacher`", async () => {
      requireLog();
      const teacher = await mintTeacher();
      const { body } = await call("POST", "/api/classes", {
        teacher,
        body: { name: "3ر3", stream: STREAM },
      });
      const hits = await findLogLines(
        (o) => o.event === "class.created" && o.correlationId === body.correlationId,
      );
      expect(hits).toHaveLength(1);
      const line = hits[0];
      // The VALUE and the slice are what be-1 pinned and are unchanged; only the key moved.
      expect(line.teacherIdPrefix).toBe(teacher.slice(0, 8));
      expect(line.teacherIdPrefix).toHaveLength(8);
      expect(line.teacher).toBeUndefined();
      expect(line.teacherId).toBeUndefined();
      // EXACT key set. A rename that left the old key behind would satisfy every clause
      // above and still leave two names for one field, which is the defect itself.
      expect(Object.keys(line).sort()).toEqual([
        "classId",
        "correlationId",
        "event",
        "level",
        "msg",
        "teacherIdPrefix",
      ]);
    });

    it("progress.write logs `teacherIdPrefix`, 8 chars, and no `teacher`", async () => {
      requireLog();
      const teacher = await mintTeacher();
      const klass = await makeClass(teacher, "3ر4");
      const { body } = await call("PUT", `/api/progress/${klass.id}`, {
        teacher,
        body: { rev: 0, markedWeek: 5 },
      });
      const hits = await findLogLines(
        (o) => o.event === "progress.write" && o.correlationId === body.correlationId,
      );
      expect(hits).toHaveLength(1);
      const line = hits[0];
      expect(line.teacherIdPrefix).toBe(teacher.slice(0, 8));
      expect(line.teacherIdPrefix).toHaveLength(8);
      expect(line.teacher).toBeUndefined();
      expect(line.teacherId).toBeUndefined();
      expect(Object.keys(line).sort()).toEqual([
        "classId",
        "correlationId",
        "event",
        "level",
        "msg",
        "outcome",
        "rev",
        "teacherIdPrefix",
        "week",
      ]);
      // The rest of the line is untouched: this rename must not have moved the payload.
      expect(line.outcome).toBe("win");
      expect(line.week).toBe(5);
      expect(line.rev).toBe(1);
      expect(line.classId).toBe(klass.id);
    });

    it("THE DEFECT ITSELF: one grep finds the mutation lines AND the auth lines", async () => {
      // The reason the rename is worth a sub-issue. `teacher.rejected` (teacher.ts) and
      // `class.created` (mutationlog.ts) are the two surfaces an operator correlates when
      // a teacher says "my class vanished" — under two different key names, one grep
      // returns half the story and looks complete.
      requireLog();
      const teacher = await mintTeacher();
      const created = await call("POST", "/api/classes", {
        teacher,
        body: { name: "3ر5", stream: STREAM },
      });
      // A well-formed id the server never issued — the rejection path, which has logged
      // `teacherIdPrefix` since before this job.
      const unissued = "f".repeat(32);
      const rejected = await call("GET", "/api/classes", { teacher: unissued });
      expect(rejected.status).toBe(401);

      const mutation = await findLogLines(
        (o) => o.event === "class.created" && o.correlationId === created.body.correlationId,
      );
      const rejection = await findLogLines((o) => o.msg === "teacher.rejected");
      expect(mutation.length).toBeGreaterThan(0);
      expect(rejection.length).toBeGreaterThan(0);

      // One key name, both surfaces.
      for (const line of [...mutation, ...rejection]) {
        expect(typeof line.teacherIdPrefix).toBe("string");
        expect(line.teacherIdPrefix).toHaveLength(8);
      }
    });

    it("no line ANYWHERE in this lane's log still uses the old `teacher` key", async () => {
      // A whole-file sweep, not just this suite's lines: the rename is only done when the
      // old name has left the log entirely. Parsed rather than grepped, so a `teacher`
      // appearing inside some other string cannot make this pass or fail by accident.
      requireLog();
      const withOldKey = readLogLines().filter((o) => Object.hasOwn(o, "teacher"));
      expect(withOldKey).toEqual([]);
    });

    it("no full 32-hex bearer value appears on ANY line carrying a teacher prefix", async () => {
      // The discipline the rename must not have loosened. Shape-based, not value-based: a
      // teacher id written whole into a log cannot be rotated out of wherever that log was
      // shipped, so ANY 32-hex run on these lines is the failure — not just ours.
      requireLog();
      const lines = readLogLines().filter((o) => Object.hasOwn(o, "teacherIdPrefix"));
      expect(lines.length).toBeGreaterThan(0);
      for (const line of lines) {
        expect(line.teacherIdPrefix).toHaveLength(8);
        expect(JSON.stringify(line)).not.toMatch(HEX32);
      }
      // And our own ids specifically, by value.
      const text = lines.map((l) => JSON.stringify(l)).join("\n");
      for (const id of MINTED_TEACHERS) expect(text).not.toContain(id);
    });
  });
});
