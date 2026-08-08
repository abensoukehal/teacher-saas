/**
 * be-2 — recovery, and teaching requireTeacher to reject.
 *
 * Two load-bearing ideas here:
 *  1. An account a teacher can be locked out of just relocates gap #1 — so the recovery
 *     code must work, be single-use, and RE-ISSUE so there is always a next one.
 *  2. Until an unknown id is rejected, be-1's registry is decorative. But "unknown" had
 *     to be defined carefully: POST /api/teacher issues ids without recording them, so
 *     the strict reading would lock out all 159 existing teacherIds. See the auth
 *     contract's "anonymous teachers" amendment — issued means minted AND recorded.
 *
 * Black-box over HTTP; PRECONDITION `tools/dev up -d`. Hollow run is RED (WF-82).
 */
const { MongoClient } = require("mongodb");
const { describeIfLane } = require("guard");

const BE = process.env.CHAR_BE_URL || "http://localhost:9000";
const MONGO = "mongodb://127.0.0.1:27017";
const DB = "teacher_saas";
const HEX32 = /^[0-9a-f]{32}$/;

let mongo;
let db;
let n = 0;
const freshEmail = () => `rec.${Date.now()}.${n++}@example.dz`;
const randomId = () => require("node:crypto").randomBytes(16).toString("hex");

async function call(method, path, { body, teacher } = {}) {
  const res = await fetch(`${BE}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(teacher ? { "x-teacher-id": teacher } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: res.status, body: await res.json() };
}

const SUBJECT = {
  title: "اختبار",
  meta: { totalPoints: 20 },
  exercises: [{ id: "ex1", label: "تمرين", points: 20, statement: "$x^2$" }],
};

async function signup(email = freshEmail(), password = "a-good-password", teacher) {
  const r = await call("POST", "/api/auth/signup", { body: { email, password }, teacher });
  return { ...r.body, email, password, status: r.status };
}

describeIfLane(BE, "be-2 — recovery + rejection", () => {
  beforeAll(async () => {
    mongo = new MongoClient(MONGO);
    await mongo.connect();
    db = mongo.db(DB);
  });
  afterAll(async () => {
    if (mongo) await mongo.close();
  });

  describe("positive — recovery is the reset path (no mail needed)", () => {
    test("the code resets the password and returns the SAME teacherId", async () => {
      const t = await signup();
      const rec = await call("POST", "/api/auth/recover", {
        body: { email: t.email, recoveryCode: t.recoveryCode, password: "brand-new-password" },
      });
      expect(rec.status).toBe(200);
      expect(rec.body.teacherId).toBe(t.teacherId);

      const inn = await call("POST", "/api/auth/signin", {
        body: { email: t.email, password: "brand-new-password" },
      });
      expect(inn.status).toBe(200);
      expect(inn.body.teacherId).toBe(t.teacherId);
    });

    test("recovery RE-ISSUES — a teacher is never left without a next code", async () => {
      const t = await signup();
      const first = await call("POST", "/api/auth/recover", {
        body: { email: t.email, recoveryCode: t.recoveryCode, password: "second-password" },
      });
      expect(first.body.recoveryCode).toBeTruthy();
      expect(first.body.recoveryCode).not.toBe(t.recoveryCode);

      const second = await call("POST", "/api/auth/recover", {
        body: {
          email: t.email,
          recoveryCode: first.body.recoveryCode,
          password: "third-password",
        },
      });
      expect(second.status).toBe(200);
    });

    test("the consumed code is SINGLE-USE", async () => {
      const t = await signup();
      await call("POST", "/api/auth/recover", {
        body: { email: t.email, recoveryCode: t.recoveryCode, password: "changed-password" },
      });
      const replay = await call("POST", "/api/auth/recover", {
        body: { email: t.email, recoveryCode: t.recoveryCode, password: "again-password" },
      });
      expect(replay.status).toBe(401);
      expect(replay.body.error.type).toBe("invalid_recovery");
    });

    test("the OLD password stops working", async () => {
      const t = await signup();
      await call("POST", "/api/auth/recover", {
        body: { email: t.email, recoveryCode: t.recoveryCode, password: "rotated-password" },
      });
      const old = await call("POST", "/api/auth/signin", {
        body: { email: t.email, password: t.password },
      });
      expect(old.status).toBe(401);
      expect(old.body.error.type).toBe("invalid_credentials");
    });

    test("the code is transcription-tolerant — lowercase and spaces both work", async () => {
      const t = await signup();
      const messy = t.recoveryCode.toLowerCase().replace(/-/g, " ");
      const rec = await call("POST", "/api/auth/recover", {
        body: { email: t.email, recoveryCode: messy, password: "tolerant-password" },
      });
      expect(rec.status).toBe(200);
    });
  });

  describe("positive — requireTeacher now rejects (declared supersession, WF-65)", () => {
    test("an id the server never recorded is 401 teacher_required", async () => {
      const { status, body } = await call("GET", "/api/subjects", { teacher: randomId() });
      expect(status).toBe(401);
      expect(body.error.type).toBe("teacher_required");
    });

    test("a SIGNED-UP teacher still reaches their own subjects", async () => {
      const t = await signup();
      const made = await call("POST", "/api/subjects", {
        teacher: t.teacherId,
        body: { subject: SUBJECT, controls: null },
      });
      expect(made.status).toBe(201);
      const list = await call("GET", "/api/subjects", { teacher: t.teacherId });
      expect(list.status).toBe(200);
      expect(list.body.subjects.map((s) => s.id)).toContain(made.body.id);
    });

    test("the error envelope is unchanged — same shape, Arabic message", async () => {
      const { body } = await call("GET", "/api/subjects", { teacher: randomId() });
      expect(Object.keys(body).sort()).toEqual(["correlationId", "error"]);
      expect(Object.keys(body.error).sort()).toEqual(["message", "type"]);
      expect(body.error.message).toMatch(/[؀-ۿ]/); // Arabic
    });
  });

  describe("positive — anonymous teachers (the contract amendment)", () => {
    test("POST /api/teacher RECORDS the row, so the id it hands out actually works", async () => {
      const { body } = await call("POST", "/api/teacher");
      expect(body.teacherId).toMatch(HEX32);

      const row = await db.collection("teachers").findOne({ teacherId: body.teacherId });
      expect(row).toBeTruthy();
      expect(row.email).toBeNull();

      const list = await call("GET", "/api/subjects", { teacher: body.teacherId });
      expect(list.status).toBe(200); // NOT 401 — it was issued
    });

    test("many anonymous rows coexist — the email index must be PARTIAL", async () => {
      const a = (await call("POST", "/api/teacher")).body.teacherId;
      const b = (await call("POST", "/api/teacher")).body.teacherId;
      expect(a).not.toBe(b);
      expect(await db.collection("teachers").countDocuments({ email: null })).toBeGreaterThan(1);
    });

    test("an anonymous row cannot sign in — it has no password", async () => {
      const anon = (await call("POST", "/api/teacher")).body.teacherId;
      const row = await db.collection("teachers").findOne({ teacherId: anon });
      expect(row.passwordHash).toBeNull();
      const res = await call("POST", "/api/auth/signin", {
        body: { email: "nobody@example.dz", password: "whatever-password" },
      });
      expect(res.status).toBe(401);
      expect(res.body.error.type).toBe("invalid_credentials");
    });

    test("sign-up ADOPTS an unclaimed id — the anonymous exams follow the teacher", async () => {
      const anon = (await call("POST", "/api/teacher")).body.teacherId;
      const made = await call("POST", "/api/subjects", {
        teacher: anon,
        body: { subject: SUBJECT, controls: null },
      });
      expect(made.status).toBe(201);

      const t = await signup(freshEmail(), "adopting-password", anon);
      expect(t.status).toBe(201);
      expect(t.teacherId).toBe(anon); // ← the id is KEPT, not reissued

      const list = await call("GET", "/api/subjects", { teacher: t.teacherId });
      expect(list.body.subjects.map((s) => s.id)).toContain(made.body.id);
    });

    test("an ALREADY-CLAIMED id is not adopted twice — a fresh id is minted", async () => {
      const first = await signup();
      const second = await signup(freshEmail(), "second-password", first.teacherId);
      expect(second.status).toBe(201);
      expect(second.teacherId).not.toBe(first.teacherId);
    });

    test("a malformed x-teacher-id on signup is ignored, not fatal", async () => {
      const t = await signup(freshEmail(), "ignored-header-password", "not-a-valid-id");
      expect(t.status).toBe(201);
      expect(t.teacherId).toMatch(HEX32);
    });
  });

  describe("negative — the backfill kept every pre-existing teacher alive", () => {
    test("NO subject is owned by a teacherId without a teachers row", async () => {
      const owners = await db.collection("subjects").distinct("teacherId");
      const known = new Set(
        await db.collection("teachers").distinct("teacherId", { teacherId: { $in: owners } }),
      );
      const locked = owners.filter((id) => !known.has(id));
      expect(locked).toEqual([]); // every one of them can still reach their exams
    });

    test("the backfill touched teachers only — subjects were not rewritten", async () => {
      const sample = await db.collection("subjects").findOne({});
      expect(Object.keys(sample).sort()).toEqual(
        ["_id", "controls", "createdAt", "subject", "teacherId", "updatedAt"].sort(),
      );
    });
  });

  describe("negative — auth routes stay reachable without a header", () => {
    test("signup, signin and recover never demand x-teacher-id", async () => {
      const s = await call("POST", "/api/auth/signin", {
        body: { email: freshEmail(), password: "no-header-password" },
      });
      expect(s.body.error.type).toBe("invalid_credentials"); // not teacher_required

      const r = await call("POST", "/api/auth/recover", {
        body: { email: freshEmail(), recoveryCode: "AAAA-BBBB-CCCC", password: "x-password" },
      });
      expect(r.body.error.type).toBe("invalid_recovery"); // not teacher_required
    });
  });
});
