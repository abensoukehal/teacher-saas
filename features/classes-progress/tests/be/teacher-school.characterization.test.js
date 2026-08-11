/**
 * be-4 — the school lands on the teacher row.
 *
 * THE RULE THIS SUITE EXISTS TO DEFEND: `school` is an ADDITIVE, OPTIONAL field on a
 * collection that already holds credentials, and 17,862 rows have no such field. None of
 * them may change behaviour, no existing response shape may move, and the write must
 * touch that one field and nothing else — `passwordHash` and `recoveryHash` live in this
 * document, and a handler that rewrites the row instead of `$set`-ing one key is one
 * refactor away from disabling an account.
 *
 * WRITE-ONLY IN SLICE 1 (contract §0). Sign-up step 3 collects the school AFTER the
 * account exists — the recovery code at step 2 proves it — so it cannot ride
 * `POST /api/auth/signup` and gets its own small surface. The print sheet reads it in a
 * later slice; until then "stored, not surfaced" is a property to PIN, not an oversight.
 * The clauses in "stored, not surfaced" are what make adding a read route later a
 * deliberate act rather than a leak nobody noticed.
 *
 * ⚠ The teacherId is a BEARER value. Nothing here logs it whole, and the 401 body is the
 * same one every other guarded surface gives — this route must not become an oracle for
 * which ids exist.
 *
 * PRECONDITION: the lane is up. A hollow run is RED in job mode — WF-82.
 */
const { randomBytes } = require("node:crypto");
const { MongoClient } = require("mongodb");
const { describeIfLane } = require("guard");

const BE = process.env.CHAR_BE_URL || "http://localhost:9000";
const MONGO = "mongodb://127.0.0.1:27017";
const DB = "teacher_saas";

/**
 * The `/api` index as RECORDED before this sub-issue (2026-08-11, lane slot 8), and as it
 * must still read after it.
 *
 * THE INDEX DOES NOT GROW FOR be-4, and that is a decision, not an omission. The listing
 * is PREFIX-level — `/api/subjects` stands for eight routes including
 * `/api/subjects/:id/exercises/:exerciseId/regenerate` — and `/api/teacher` already names
 * the surface `PUT /api/teacher/school` sits on. Adding it would put the only sub-route in
 * the list. It would also break two FROZEN pins: be-2 holds the index at exactly
 * `RECORDED_ROUTES.length + 1` entries and be-3 holds it at this exact set. Those pins are
 * frozen against this implementer; the perimeter differential here is therefore "unchanged
 * in both directions", which is the stronger claim anyway.
 */
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

/** The surface this sub-issue adds. Reachable, and deliberately not indexed — see above. */
const NEW_ROUTE = "/api/teacher/school";

/**
 * The `teachers` document as RECORDED, for both write paths that create one.
 *
 * `createTeacher` gains an optional `school` pass-through in be-4 and NO caller passes it
 * — so a freshly created row's on-disk shape must stay byte-identical to this. A store
 * function that starts writing `school: null` on every insert would be invisible on the
 * wire and would quietly rewrite what "absent" means for every row that follows.
 */
const RECORDED_TEACHER_KEYS = [
  "_id",
  "createdAt",
  "email",
  "passwordHash",
  "recoveryHash",
  "recoveryUsedAt",
  "role",
  "teacherId",
  "updatedAt",
];

/** Contract: a school name is at most this many characters, measured after trimming. */
const SCHOOL_MAX = 120;

const SCHOOL = "ثانوية الأمير عبد القادر";
const HEX32 = /[0-9a-f]{32}/;

let mongo;
let db;
const MINTED_TEACHERS = []; // every row this suite creates, removed in afterAll

async function call(method, p, { body, teacher, raw } = {}) {
  const bodyless = method === "GET" || method === "HEAD";
  const res = await fetch(`${BE}${p}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(teacher ? { "x-teacher-id": teacher } : {}),
    },
    ...(raw !== undefined
      ? { body: raw }
      : bodyless || body === undefined
        ? {}
        : { body: JSON.stringify(body) }),
  });
  return { status: res.status, body: await res.json() };
}

async function mintTeacher() {
  const { body } = await call("POST", "/api/teacher");
  MINTED_TEACHERS.push(body.teacherId);
  return body.teacherId;
}

/** A fresh address per call — sign-up is the surface being pinned, not a fixture. */
function freshEmail() {
  return `be4-${randomBytes(8).toString("hex")}@example.test`;
}

async function signup(email, password = "password123", teacher) {
  const res = await call("POST", "/api/auth/signup", { body: { email, password }, teacher });
  if (res.body?.teacherId) MINTED_TEACHERS.push(res.body.teacherId);
  return res;
}

const rowOf = (teacherId) => db.collection("teachers").findOne({ teacherId });

const setSchool = (teacher, body) => call("PUT", NEW_ROUTE, { teacher, body });

describeIfLane(BE, "be-4 — the school lands on the teacher row, and nothing else moves", () => {
  beforeAll(async () => {
    mongo = new MongoClient(MONGO);
    await mongo.connect();
    db = mongo.db(DB);
  });

  afterAll(async () => {
    if (db && MINTED_TEACHERS.length > 0) {
      // Every row this suite touched hangs off a teacher it minted, so one scope cleans
      // all three collections — including the progress documents a GET synthesizes but
      // does not write, which is why that deleteMany is harmless rather than optional.
      const scope = { teacherId: { $in: MINTED_TEACHERS } };
      await db.collection("classes").deleteMany(scope);
      await db.collection("progress").deleteMany(scope);
      await db.collection("teachers").deleteMany(scope);
    }
    if (mongo) await mongo.close();
  });

  describe("PUT /api/teacher/school — the happy path", () => {
    test("a school is stored, and the answer is {ok:true} and a correlationId — nothing more", async () => {
      const teacher = await mintTeacher();
      const { status, body } = await setSchool(teacher, { school: SCHOOL });
      expect(status).toBe(200);
      expect(body.ok).toBe(true);
      expect(body.correlationId).toBeTruthy();
      // EXACTLY these keys. The surface is write-only in slice 1 (contract §0); echoing
      // the value back would be the read route arriving by accident, and `fe` would start
      // depending on it before slice 2 decides what the read looks like.
      expect(Object.keys(body).sort()).toEqual(["correlationId", "ok"]);
      expect((await rowOf(teacher)).school).toBe(SCHOOL);
    });

    test("a second write REPLACES the first — this is a value, not an append", async () => {
      const teacher = await mintTeacher();
      await setSchool(teacher, { school: SCHOOL });
      const { status } = await setSchool(teacher, { school: "ثانوية ابن باديس" });
      expect(status).toBe(200);
      expect((await rowOf(teacher)).school).toBe("ثانوية ابن باديس");
    });

    test("{school: null} clears it", async () => {
      const teacher = await mintTeacher();
      await setSchool(teacher, { school: SCHOOL });
      const { status } = await setSchool(teacher, { school: null });
      expect(status).toBe(200);
      expect((await rowOf(teacher)).school).toBeNull();
    });

    // Blanking a text field is how a teacher removes a value they typed. Refusing it
    // would leave the only way out of a typo being "type something else" — and the
    // stored set stays {absent, null, non-empty string}, which is what lets a future
    // reader treat absent and null identically without a third case.
    test.each([
      ["an empty string", ""],
      ["whitespace only", "   "],
    ])("%s clears it too — blanking is removal, not an error", async (_label, value) => {
      const teacher = await mintTeacher();
      await setSchool(teacher, { school: SCHOOL });
      const { status } = await setSchool(teacher, { school: value });
      expect(status).toBe(200);
      expect((await rowOf(teacher)).school).toBeNull();
    });

    test("surrounding whitespace is trimmed — the stored value is what will be printed", async () => {
      const teacher = await mintTeacher();
      await setSchool(teacher, { school: `  ${SCHOOL}  ` });
      expect((await rowOf(teacher)).school).toBe(SCHOOL);
    });

    test(`a ${SCHOOL_MAX}-char name is accepted — the boundary the ${SCHOOL_MAX + 1} clause is measured against`, async () => {
      const teacher = await mintTeacher();
      const { status } = await setSchool(teacher, { school: "ق".repeat(SCHOOL_MAX) });
      expect(status).toBe(200);
      expect((await rowOf(teacher)).school).toHaveLength(SCHOOL_MAX);
    });

    test("an account row takes a school the same way an anonymous one does", async () => {
      const { body } = await signup(freshEmail());
      const { status } = await setSchool(body.teacherId, { school: SCHOOL });
      expect(status).toBe(200);
      expect((await rowOf(body.teacherId)).school).toBe(SCHOOL);
    });
  });

  describe("THE CREDENTIAL ROW — the write touches one field and one field only", () => {
    test("password, recovery, email, role and createdAt survive a school write byte-identical", async () => {
      // This row holds the two scrypt hashes and is what requireAdmin reads. A handler
      // that rebuilds the document instead of $set-ing one key would pass every clause
      // above and silently disable an account — so the whole row is compared, not the
      // fields someone thought to name.
      const { body } = await signup(freshEmail());
      const before = await rowOf(body.teacherId);
      await setSchool(body.teacherId, { school: SCHOOL });
      const after = await rowOf(body.teacherId);

      for (const key of ["_id", "teacherId", "email", "passwordHash", "recoveryHash", "role", "createdAt"]) {
        expect(String(after[key])).toBe(String(before[key]));
      }
      expect(after.recoveryUsedAt).toBe(before.recoveryUsedAt);
      // `school` must have changed, and nothing outside {school, updatedAt} may have.
      // (`updatedAt` is not asserted to have moved HERE — it has its own clause, and a
      // same-millisecond write would make this one flaky about the wrong fact.)
      const changed = Object.keys(after).filter((k) => String(after[k]) !== String(before[k]));
      expect(changed).toContain("school");
      expect(changed.filter((k) => k !== "school" && k !== "updatedAt")).toEqual([]);
      // And no key appeared or vanished beyond the one this sub-issue adds.
      expect(Object.keys(after).sort()).toEqual([...RECORDED_TEACHER_KEYS, "school"].sort());
    });

    test("the account still signs in with the same password after a school write", async () => {
      // The executable half of the clause above: hashes compared equal is one thing,
      // the credential still working is the thing a teacher would notice.
      const email = freshEmail();
      const { body } = await signup(email);
      await setSchool(body.teacherId, { school: SCHOOL });
      const signin = await call("POST", "/api/auth/signin", {
        body: { email, password: "password123" },
      });
      expect(signin.status).toBe(200);
      expect(signin.body.teacherId).toBe(body.teacherId);
    });

    test("updatedAt advances", async () => {
      const teacher = await mintTeacher();
      const before = await rowOf(teacher);
      await new Promise((r) => setTimeout(r, 12));
      await setSchool(teacher, { school: SCHOOL });
      const after = await rowOf(teacher);
      expect(new Date(after.updatedAt).getTime()).toBeGreaterThan(new Date(before.updatedAt).getTime());
    });
  });

  describe("negative — the identity gate", () => {
    test("no x-teacher-id header -> 401 teacher_required", async () => {
      const { status, body } = await setSchool(undefined, { school: SCHOOL });
      expect(status).toBe(401);
      expect(body.error.type).toBe("teacher_required");
    });

    test("the 401 body is the SAME one every other guarded surface gives", async () => {
      // Byte-identical to the recorded gate. A route with its own wording is a route
      // that can be told apart from the others, which is a probe by another name.
      const mine = await setSchool(undefined, { school: SCHOOL });
      const recorded = await call("GET", "/api/classes");
      expect(mine.body.error).toEqual(recorded.body.error);
    });

    test.each([
      ["an unissued 32-hex id", () => randomBytes(16).toString("hex")],
      ["a 12-char hex id", () => randomBytes(6).toString("hex")],
      ["non-hex garbage", () => "not-a-teacher-id-at-all"],
    ])("%s -> 401 teacher_required", async (_label, make) => {
      const { status, body } = await setSchool(make(), { school: SCHOOL });
      expect(status).toBe(401);
      expect(body.error.type).toBe("teacher_required");
    });

    test("the UPPERCASE of a real owned id -> 401 — ids are lowercase and case-SENSITIVE", async () => {
      const teacher = await mintTeacher();
      const { status, body } = await setSchool(teacher.toUpperCase(), { school: SCHOOL });
      expect(status).toBe(401);
      expect(body.error.type).toBe("teacher_required");
      // And nothing was written for the real row by the near-miss.
      expect((await rowOf(teacher)).school).toBeUndefined();
    });
  });

  describe("negative — the input bounds", () => {
    test("a body with no `school` key -> 400 invalid_request", async () => {
      // Absent is not null. A PUT that names no value is a caller bug; treating it as a
      // clear would make a malformed request destroy a stored value.
      const teacher = await mintTeacher();
      const { status, body } = await setSchool(teacher, {});
      expect(status).toBe(400);
      expect(body.error.type).toBe("invalid_request");
    });

    test.each([
      ["a number", 42],
      ["an object", { name: "ثانوية" }],
      ["an array", ["ثانوية"]],
      ["a boolean", true],
    ])("%s -> 400 invalid_request (one probe per variant, WF-70)", async (_label, value) => {
      const teacher = await mintTeacher();
      const { status, body } = await setSchool(teacher, { school: value });
      expect(status).toBe(400);
      expect(body.error.type).toBe("invalid_request");
    });

    test(`a ${SCHOOL_MAX + 1}-char name -> 400 invalid_request`, async () => {
      const teacher = await mintTeacher();
      const { status, body } = await setSchool(teacher, { school: "ق".repeat(SCHOOL_MAX + 1) });
      expect(status).toBe(400);
      expect(body.error.type).toBe("invalid_request");
    });

    test("a rejected write leaves the stored value untouched", async () => {
      const teacher = await mintTeacher();
      await setSchool(teacher, { school: SCHOOL });
      await setSchool(teacher, { school: 42 });
      await setSchool(teacher, { school: "ق".repeat(SCHOOL_MAX + 1) });
      expect((await rowOf(teacher)).school).toBe(SCHOOL);
    });

    test("a malformed JSON body -> 400 WITH a correlationId", async () => {
      // The middleware-order pin (project/CLAUDE.md): the correlation-id middleware runs
      // BEFORE the body parser, so even a body that cannot be parsed is traceable.
      const teacher = await mintTeacher();
      const { status, body } = await call("PUT", NEW_ROUTE, { teacher, raw: "{not json" });
      expect(status).toBe(400);
      expect(body.error.type).toBe("invalid_request");
      expect(body.correlationId).toBeTruthy();
    });

    test("an oversized body -> 400 or 413, never 500", async () => {
      const teacher = await mintTeacher();
      const { status } = await setSchool(teacher, { school: "ق".repeat(10000) });
      expect([400, 413]).toContain(status);
    });
  });

  describe("FROZEN — the auth surface is untouched", () => {
    test("POST /api/auth/signup answers 201 with exactly {teacherId, recoveryCode, correlationId}", async () => {
      const { status, body } = await signup(freshEmail());
      expect(status).toBe(201);
      expect(Object.keys(body).sort()).toEqual(["correlationId", "recoveryCode", "teacherId"]);
      expect(body.teacherId).toMatch(/^[0-9a-f]{32}$/);
      expect(body.recoveryCode).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    });

    test("POST /api/auth/signin answers 200 with exactly {teacherId, correlationId}", async () => {
      const email = freshEmail();
      const { body } = await signup(email);
      const { status, body: out } = await call("POST", "/api/auth/signin", {
        body: { email, password: "password123" },
      });
      expect(status).toBe(200);
      expect(Object.keys(out).sort()).toEqual(["correlationId", "teacherId"]);
      expect(out.teacherId).toBe(body.teacherId);
    });

    test("signup ignores a `school` in its body — it is not that surface (contract §0)", async () => {
      const { status, body } = await call("POST", "/api/auth/signup", {
        body: { email: freshEmail(), password: "password123", school: SCHOOL },
      });
      if (body?.teacherId) MINTED_TEACHERS.push(body.teacherId);
      expect(status).toBe(201);
      expect(Object.keys(body).sort()).toEqual(["correlationId", "recoveryCode", "teacherId"]);
      // The whole reason this surface exists separately: sign-up runs before step 3.
      expect((await rowOf(body.teacherId)).school).toBeUndefined();
    });

    test("`createTeacher` writes NO school — a signed-up row's on-disk shape is unchanged", async () => {
      const { body } = await signup(freshEmail());
      expect(Object.keys(await rowOf(body.teacherId)).sort()).toEqual(RECORDED_TEACHER_KEYS);
    });

    test("`POST /api/teacher` writes NO school — an anonymous row's on-disk shape is unchanged", async () => {
      const teacher = await mintTeacher();
      expect(Object.keys(await rowOf(teacher)).sort()).toEqual(RECORDED_TEACHER_KEYS);
    });
  });

  describe("STORED, NOT SURFACED — no recorded surface starts leaking school", () => {
    test("the sign-in response carries no school, even when the row has one", async () => {
      const email = freshEmail();
      const { body } = await signup(email);
      await setSchool(body.teacherId, { school: SCHOOL });
      const { body: out } = await call("POST", "/api/auth/signin", {
        body: { email, password: "password123" },
      });
      expect(JSON.stringify(out)).not.toContain("school");
      expect(JSON.stringify(out)).not.toContain(SCHOOL);
    });

    test.each([
      ["GET /api/subjects", "/api/subjects"],
      ["GET /api/classes", "/api/classes"],
    ])("%s carries no school (one probe per recorded surface, WF-70)", async (_label, path) => {
      const teacher = await mintTeacher();
      await setSchool(teacher, { school: SCHOOL });
      const { status, body } = await call("GET", path, { teacher });
      expect(status).toBe(200);
      expect(JSON.stringify(body)).not.toContain("school");
      expect(JSON.stringify(body)).not.toContain(SCHOOL);
    });

    test("GET /api/progress/:classId carries no school", async () => {
      const teacher = await mintTeacher();
      await setSchool(teacher, { school: SCHOOL });
      const created = await call("POST", "/api/classes", {
        teacher,
        body: { name: "3ر4", stream: "شعبة الرياضيات" },
      });
      const { status, body } = await call("GET", `/api/progress/${created.body.class.id}`, { teacher });
      expect(status).toBe(200);
      expect(JSON.stringify(body)).not.toContain("school");
      expect(JSON.stringify(body)).not.toContain(SCHOOL);
    });

    test("GET /api/admin/teachers carries no school — the projection is an ALLOW-LIST", async () => {
      // The one route that projects out of `teachers`. It excludes a new field by
      // default rather than leaking it until someone remembers to redact — the same
      // property that keeps the two scrypt hashes in this service. Pinned here because
      // be-4 is the first field added to that collection since the rule was written.
      const admin = await mintTeacher();
      await db.collection("teachers").updateOne({ teacherId: admin }, { $set: { role: "admin" } });
      const subject = await mintTeacher();
      await setSchool(subject, { school: SCHOOL });

      const { status, body } = await call("GET", "/api/admin/teachers", { teacher: admin });
      expect(status).toBe(200);
      expect(JSON.stringify(body)).not.toContain("school");
      expect(JSON.stringify(body)).not.toContain(SCHOOL);
    });

    test("no response from this surface echoes the whole bearer id back", async () => {
      const teacher = await mintTeacher();
      const { body } = await setSchool(teacher, { school: SCHOOL });
      expect(JSON.stringify(body)).not.toMatch(HEX32);
    });
  });

  describe("negative — the perimeter: the index is byte-identical, and the surface is reachable", () => {
    test.each(RECORDED_ROUTES)("/api still lists %s", async (route) => {
      const { body } = await call("GET", "/api");
      expect(body.routes).toContain(route);
    });

    test("/api gained nothing and lost nothing — the differential is empty both ways", async () => {
      const { body } = await call("GET", "/api");
      expect([...body.routes].sort()).toEqual([...RECORDED_ROUTES].sort());
    });

    test(`${NEW_ROUTE} is reachable even though it is not indexed`, async () => {
      // The counterweight to the clause above: "the index did not change" must not be
      // satisfiable by the route not existing. An unguarded probe reaches the GUARD —
      // 401, not the 404 this path answered before the sub-issue.
      const { status } = await setSchool(undefined, { school: SCHOOL });
      expect(status).toBe(401);
    });

    test("/api is still this service's own index", async () => {
      const { status, body } = await call("GET", "/api");
      expect(status).toBe(200);
      expect(body.service).toBe("teacher-be");
    });

    test("/health still answers, and says nothing about school", async () => {
      const { status, body } = await call("GET", "/health");
      expect(status).toBe(200);
      expect(body.service).toBe("teacher-be");
      expect(JSON.stringify(body)).not.toContain("school");
    });
  });
});
