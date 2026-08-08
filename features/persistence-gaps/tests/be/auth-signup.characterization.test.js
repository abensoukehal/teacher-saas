/**
 * be-1 — write the teacher down: `teachers` collection + sign-up/sign-in.
 *
 * The load-bearing test in this file is "clear the browser, sign in, exams are still
 * there". That is gap #1 (SEED → Problem): the teacher id lived only in localStorage,
 * so clearing site data orphaned every exam forever — the documents survive in Mongo
 * and nothing can ever find them again.
 *
 * Black-box by necessity — see stacks/be.md → "Test harness". Drives the real lane over
 * HTTP and asserts stored state with the mongodb driver.
 *
 * PRECONDITION: `tools/dev up -d` from the job worktree. A hollow run (every test
 * skipped) is RED in job mode — WF-82.
 */
const { MongoClient } = require("mongodb");
const { describeIfLane } = require("guard");

// tools/ci derives these from THIS checkout's own lane, so the server we drive is the
// one CHAR_ROOTDIR resolves dist/ and run-log.jsonl against (WF-82). Never hardcode.
const BE = process.env.CHAR_BE_URL || "http://localhost:9000";
const MONGO = "mongodb://127.0.0.1:27017";
const DB = "teacher_saas";

const HEX32 = /^[0-9a-f]{32}$/;
const CODE = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/;

let mongo;
let db;

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

/** A fresh address per run — these tests insert, and must not collide across runs. */
let n = 0;
const freshEmail = () => `prof.${Date.now()}.${n++}@example.dz`;

const SUBJECT = {
  title: "اختبار الفصل الأول",
  meta: { totalPoints: 20, topic: "الدوال" },
  exercises: [{ id: "ex1", label: "التمرين الأول", points: 20, statement: "$f(x)=x^2$" }],
};

describeIfLane(BE, "be-1 — accounts adopt the existing teacher id", () => {
  beforeAll(async () => {
    mongo = new MongoClient(MONGO);
    await mongo.connect();
    db = mongo.db(DB);
  });
  afterAll(async () => {
    if (mongo) await mongo.close();
  });

  describe("positive — sign-up writes the teacher down", () => {
    test("201 with a 32-hex teacherId and a transcribable recovery code", async () => {
      const email = freshEmail();
      const { status, body } = await call("POST", "/api/auth/signup", {
        body: { email, password: "correct horse battery" },
      });
      expect(status).toBe(201);
      expect(body.teacherId).toMatch(HEX32);
      expect(body.recoveryCode).toMatch(CODE);
    });

    test("the secrets are HASHED, and neither appears anywhere in the document", async () => {
      const email = freshEmail();
      const password = "s3cret-password-value";
      const { body } = await call("POST", "/api/auth/signup", { body: { email, password } });

      const doc = await db.collection("teachers").findOne({ teacherId: body.teacherId });
      expect(doc).toBeTruthy();
      expect(doc.passwordHash).toMatch(/^scrypt\$/);
      expect(doc.recoveryHash).toMatch(/^scrypt\$/);
      expect(doc.recoveryUsedAt).toBeNull();

      // The whole document, as a string: the plaintext must be nowhere in it.
      const asText = JSON.stringify(doc);
      expect(asText).not.toContain(password);
      expect(asText).not.toContain(body.recoveryCode);
    });

    test("email is normalised — signup mixed-case, signin lowercase", async () => {
      const email = freshEmail().toUpperCase();
      const up = await call("POST", "/api/auth/signup", {
        body: { email, password: "another-password" },
      });
      expect(up.status).toBe(201);

      const inn = await call("POST", "/api/auth/signin", {
        body: { email: email.toLowerCase(), password: "another-password" },
      });
      expect(inn.status).toBe(200);
      expect(inn.body.teacherId).toBe(up.body.teacherId);
    });

    test("duplicate signup is 409 email_taken", async () => {
      const email = freshEmail();
      await call("POST", "/api/auth/signup", { body: { email, password: "first-password" } });
      const again = await call("POST", "/api/auth/signup", {
        body: { email, password: "second-password" },
      });
      expect(again.status).toBe(409);
      expect(again.body.error.type).toBe("email_taken");
    });
  });

  describe("positive — GAP #1 CLOSED: a cleared browser no longer orphans exams", () => {
    test("sign in returns the SAME teacherId, and the subjects are still reachable", async () => {
      const email = freshEmail();
      const password = "the-password";

      // 1. sign up, 2. create a subject as that teacher
      const up = await call("POST", "/api/auth/signup", { body: { email, password } });
      const teacherId = up.body.teacherId;
      const created = await call("POST", "/api/subjects", {
        teacher: teacherId,
        body: { subject: SUBJECT, controls: null },
      });
      expect(created.status).toBe(201);

      // 3. the browser is cleared — the id is GONE client-side. All the teacher has
      //    is their email and password. This is the whole point of the sub-issue.
      const back = await call("POST", "/api/auth/signin", { body: { email, password } });
      expect(back.status).toBe(200);
      expect(back.body.teacherId).toBe(teacherId);

      const list = await call("GET", "/api/subjects", { teacher: back.body.teacherId });
      expect(list.status).toBe(200);
      expect(list.body.subjects.map((s) => s.id)).toContain(created.body.id);
    });

    test("the teacherId is ADOPTED, not reissued — no document is rewritten", async () => {
      const email = freshEmail();
      const password = "adoption-password";
      const up = await call("POST", "/api/auth/signup", { body: { email, password } });

      const created = await call("POST", "/api/subjects", {
        teacher: up.body.teacherId,
        body: { subject: SUBJECT, controls: null },
      });
      const before = await db
        .collection("subjects")
        .findOne({ teacherId: up.body.teacherId });

      await call("POST", "/api/auth/signin", { body: { email, password } });

      const after = await db.collection("subjects").findOne({ teacherId: up.body.teacherId });
      expect(after.updatedAt.getTime()).toBe(before.updatedAt.getTime());
      expect(String(after._id)).toBe(created.body.id);
    });
  });

  describe("negative — sign-in must not be an account-enumeration oracle", () => {
    test("unknown email and wrong password are INDISTINGUISHABLE", async () => {
      const email = freshEmail();
      await call("POST", "/api/auth/signup", { body: { email, password: "right-password" } });

      const wrongPassword = await call("POST", "/api/auth/signin", {
        body: { email, password: "WRONG-password" },
      });
      const unknownEmail = await call("POST", "/api/auth/signin", {
        body: { email: freshEmail(), password: "right-password" },
      });

      expect(wrongPassword.status).toBe(401);
      expect(unknownEmail.status).toBe(401);
      expect(wrongPassword.body.error.type).toBe("invalid_credentials");
      expect(unknownEmail.body.error.type).toBe("invalid_credentials");

      // Identical apart from the per-request correlation id.
      const strip = (b) => ({ ...b, correlationId: undefined });
      expect(strip(wrongPassword.body)).toEqual(strip(unknownEmail.body));
    });

    test("a short password is rejected before anything is stored", async () => {
      const email = freshEmail();
      const res = await call("POST", "/api/auth/signup", { body: { email, password: "short" } });
      expect(res.status).toBe(400);
      expect(res.body.error.type).toBe("invalid_request");
      expect(await db.collection("teachers").findOne({ email: email.toLowerCase() })).toBeNull();
    });
  });

  describe("negative — the perimeter is bit-stable (be-2 changes this, not be-1)", () => {
    test("POST /api/teacher still mints an id, unchanged", async () => {
      const { status, body } = await call("POST", "/api/teacher");
      expect(status).toBe(201);
      expect(body.teacherId).toMatch(HEX32);
      expect(Object.keys(body).sort()).toEqual(["correlationId", "teacherId"]);
    });

    test("an unknown well-formed id is STILL accepted here — rejection arrives in be-2", async () => {
      const ghost = "f".repeat(32);
      const { status, body } = await call("GET", "/api/subjects", { teacher: ghost });
      expect(status).toBe(200);
      expect(body.subjects).toEqual([]);
    });

    test("auth routes need no x-teacher-id header — that is how you get one", async () => {
      const res = await call("POST", "/api/auth/signin", {
        body: { email: freshEmail(), password: "whatever-password" },
      });
      expect(res.status).toBe(401); // not 401 teacher_required
      expect(res.body.error.type).toBe("invalid_credentials");
    });
  });
});
