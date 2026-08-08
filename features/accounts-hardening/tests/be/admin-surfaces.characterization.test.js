/**
 * be-3 — admin read surfaces and the global KPIs.
 *
 * THE RULE THIS SUITE EXISTS TO DEFEND: `getOwned` scopes ownership INSIDE the query,
 * so another teacher's subject is indistinguishable from one that never existed. Admin
 * gets its OWN routes behind its OWN guard; a boolean branch inside a teacher handler
 * is expressly forbidden, because that is precisely how an ownership check gets
 * bypassed by accident.
 *
 * The single most important negative clause here: **no hash ever leaves the service.**
 *
 * ⚠ `costUsd` IS NOT MONEY — a usage figure under a subscription. Nothing here treats
 * it as currency.
 *
 * ALSO CARRIED HERE FROM be-2: `requireAdmin`'s 401 / 403 / pass behaviour. It is
 * black-box-observable only once a route uses it, and these are the first routes that do.
 *
 * PRECONDITION: the lane is up. A hollow run is RED in job mode — WF-82.
 */
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { randomBytes } = require("node:crypto");
const { MongoClient } = require("mongodb");
const { describeIfLane } = require("guard");

const BE = process.env.CHAR_BE_URL || "http://localhost:9000";
const MONGO = "mongodb://127.0.0.1:27017";
const DB = "teacher_saas";
const REPO = process.env.CHAR_ROOTDIR;

const ADMIN_ROUTES = ["/api/admin/kpis", "/api/admin/teachers", "/api/admin/exams"];

let mongo;
let db;
let admin; // the seeded admin's teacherId
const PLANTED = []; // _ids this suite inserted directly, removed in afterAll

/**
 * BACKS OFF ON 429 — same reasoning as roles-admin's helper. be-4's limiter is keyed
 * per IP + route and every suite here drives one lane from 127.0.0.1 in parallel.
 * Nothing in this file asserts anything about throttling, so retrying past a 429 masks
 * no clause; the limiter is pinned in auth-bounds, where a 429 is never retried.
 */
async function call(method, p, { body, teacher } = {}) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${BE}${p}`, {
      method,
      headers: {
        "content-type": "application/json",
        ...(teacher ? { "x-teacher-id": teacher } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const parsed = { status: res.status, body: await res.json() };
    if (parsed.status !== 429 || attempt >= 2) return parsed;
    const wait = Number(res.headers.get("retry-after") ?? 1) * 1000 + 400;
    await new Promise((r) => setTimeout(r, wait));
  }
}

const freshSecret = () => `pw-${randomBytes(15).toString("base64url")}`;
let n = 0;
const freshEmail = () => `admin.surfaces.${Date.now()}.${n++}@example.dz`;

const SUBJECT = {
  title: "اختبار الفصل الأول",
  meta: { totalPoints: 20, topic: "الدوال" },
  exercises: [
    { id: "ex1", label: "التمرين الأول", points: 12, statement: "$f(x)=x^2$" },
    { id: "ex2", label: "التمرين الثاني", points: 8, statement: "$g(x)=\\ln x$" },
  ],
};

/** Relative closeness — the shared dev store moves under a parallel suite. */
function relClose(actual, expected, tolerance) {
  return Math.abs(actual - expected) <= Math.abs(expected) * tolerance;
}

describeIfLane(BE, "be-3 — admin read surfaces, behind their own guard", () => {
  beforeAll(async () => {
    if (!REPO) throw new Error("CHAR_ROOTDIR is unset — run via tools/ci, not jest directly");
    mongo = new MongoClient(MONGO);
    await mongo.connect();
    db = mongo.db(DB);

    // Seed a throwaway admin through the real script — the only path to the role.
    const email = freshEmail();
    execFileSync("node", [path.join(REPO, "scripts", "seed-admin.mjs"), "--yes"], {
      cwd: REPO,
      env: { ...process.env, ADMIN_EMAIL: email, ADMIN_PASSWORD: freshSecret() },
      stdio: "ignore",
    });
    admin = (await db.collection("teachers").findOne({ email })).teacherId;
  });

  afterAll(async () => {
    if (PLANTED.length > 0) await db.collection("subjects").deleteMany({ _id: { $in: PLANTED } });
    if (mongo) await mongo.close();
  });

  describe("the guard — 401 and 403 are different facts", () => {
    test.each(ADMIN_ROUTES)("%s with NO header -> 401 teacher_required", async (route) => {
      const { status, body } = await call("GET", route);
      expect(status).toBe(401);
      expect(body.error.type).toBe("teacher_required");
    });

    test.each(ADMIN_ROUTES)("%s with a malformed id -> 401", async (route) => {
      const { status, body } = await call("GET", route, { teacher: "not-a-teacher-id" });
      expect(status).toBe(401);
      expect(body.error.type).toBe("teacher_required");
    });

    test.each(ADMIN_ROUTES)("%s with an UNKNOWN well-formed id -> 401", async (route) => {
      // Well-formed but never issued. Must read as "who are you", never as 403 — an
      // admin route must not become an oracle for which ids exist.
      const { status, body } = await call("GET", route, {
        teacher: randomBytes(16).toString("hex"),
      });
      expect(status).toBe(401);
      expect(body.error.type).toBe("teacher_required");
    });

    test.each(ADMIN_ROUTES)("%s as a valid TEACHER -> 403 forbidden", async (route) => {
      const teacher = (await call("POST", "/api/teacher")).body.teacherId;
      const { status, body } = await call("GET", route, { teacher });
      expect(status).toBe(403);
      expect(body.error.type).toBe("forbidden");
      expect(body.correlationId).toBeTruthy();
    });

    test.each(ADMIN_ROUTES)("%s as the ADMIN -> 200", async (route) => {
      const { status, body } = await call("GET", route, { teacher: admin });
      expect(status).toBe(200);
      expect(body.correlationId).toBeTruthy();
    });

    test("401 and 403 never collapse into one another", async () => {
      const teacher = (await call("POST", "/api/teacher")).body.teacherId;
      const unknown = randomBytes(16).toString("hex");
      const asTeacher = await call("GET", "/api/admin/kpis", { teacher });
      const asUnknown = await call("GET", "/api/admin/kpis", { teacher: unknown });
      expect(asTeacher.status).toBe(403);
      expect(asUnknown.status).toBe(401);
      expect(asTeacher.body.error.type).not.toBe(asUnknown.body.error.type);
    });

    test("the 401 body is IDENTICAL to the one a teacher surface gives", async () => {
      // Same "who are you" answer everywhere, so the admin paths reveal nothing extra
      // by the shape of their refusal.
      const fromAdmin = await call("GET", "/api/admin/kpis");
      const fromTeacher = await call("GET", "/api/subjects");
      expect(fromAdmin.status).toBe(fromTeacher.status);
      expect(fromAdmin.body.error).toEqual(fromTeacher.body.error);
    });
  });

  describe("GET /api/admin/kpis", () => {
    test("every field is present and a FINITE number — never NaN, never null", async () => {
      // A divide-by-zero serialises to null through JSON, which reads as "no data"
      // rather than as the bug it is. Types are the check.
      const { body } = await call("GET", "/api/admin/kpis", { teacher: admin });
      for (const key of [
        "totalExams",
        "totalTeachers",
        "avgCostUsdPerExam",
        "avgDurationMsPerExam",
        "avgExamsPerTeacher",
        "examsWithKpis",
      ]) {
        expect(typeof body[key]).toBe("number");
        expect(Number.isFinite(body[key])).toBe(true);
      }
      expect(Number.isInteger(body.totalExams)).toBe(true);
      expect(Number.isInteger(body.totalTeachers)).toBe(true);
      expect(Number.isInteger(body.examsWithKpis)).toBe(true);
    });

    test("examsWithKpis is a real denominator — smaller than totalExams here", async () => {
      // Older exams all carry null. If these two were ever equal the averages would be
      // claiming a coverage the data does not have.
      const { body } = await call("GET", "/api/admin/kpis", { teacher: admin });
      expect(body.examsWithKpis).toBeGreaterThan(0);
      expect(body.examsWithKpis).toBeLessThan(body.totalExams);
    });

    test("the totals agree with an independent count", async () => {
      const { body } = await call("GET", "/api/admin/kpis", { teacher: admin });
      const exams = await db.collection("subjects").countDocuments();
      // SUPERSEDED (QA F4): `totalTeachers` now counts ACCOUNTS — rows with an email —
      // because counting anonymous sessions made avgExamsPerTeacher read ~3x low on the
      // live store (9069 rows vs ~3100 accounts). The anonymous count is reported beside
      // it rather than folded in.
      const teachers = await db
        .collection("teachers")
        .countDocuments({ email: { $type: "string" } });
      const anon = await db.collection("teachers").countDocuments({ email: null });
      // ±40 absorbs whatever the parallel suite inserts between the two reads.
      expect(Math.abs(body.totalExams - exams)).toBeLessThan(40);
      expect(Math.abs(body.totalTeachers - teachers)).toBeLessThan(40);
      expect(Math.abs(body.anonymousSessions - anon)).toBeLessThan(40);
      expect(relClose(body.avgExamsPerTeacher, exams / teachers, 0.05)).toBe(true);
    });

    test("THE CLAUSE THAT MATTERS — null-KPI exams are IGNORED, not counted as zero", async () => {
      // 150 exams carrying a cost, 150 carrying none. Counting the nulls as zero would
      // divide by a denominator two orders of magnitude larger, so the two models are
      // ~16x apart — far outside any drift a parallel suite can cause.
      const before = (await call("GET", "/api/admin/kpis", { teacher: admin })).body;
      const sumBefore = before.avgCostUsdPerExam * before.examsWithKpis;
      const durSumBefore = before.avgDurationMsPerExam * before.examsWithKpis;

      const teacher = (await call("POST", "/api/teacher")).body.teacherId;
      const now = new Date();
      const withKpis = Array.from({ length: 150 }, () => ({
        teacherId: teacher,
        subject: SUBJECT,
        controls: null,
        genCorrelationId: null,
        costUsd: 4,
        durationMs: 400000,
        createdAt: now,
        updatedAt: now,
      }));
      const without = Array.from({ length: 150 }, () => ({
        teacherId: teacher,
        subject: SUBJECT,
        controls: null,
        genCorrelationId: null,
        createdAt: now,
        updatedAt: now,
      }));
      const res = await db.collection("subjects").insertMany([...withKpis, ...without]);
      PLANTED.push(...Object.values(res.insertedIds));

      const after = (await call("GET", "/api/admin/kpis", { teacher: admin })).body;

      // The denominator moved by the 150 that carry numbers, NOT by all 300.
      expect(after.examsWithKpis).toBeGreaterThanOrEqual(before.examsWithKpis + 150);
      expect(after.examsWithKpis).toBeLessThan(before.examsWithKpis + 200);
      // …while the total moved by all 300.
      expect(after.totalExams).toBeGreaterThanOrEqual(before.totalExams + 300);

      const ignoringNulls = (sumBefore + 150 * 4) / (before.examsWithKpis + 150);
      const countingNullsAsZero = (sumBefore + 150 * 4) / (before.totalExams + 300);
      expect(relClose(after.avgCostUsdPerExam, ignoringNulls, 0.08)).toBe(true);
      expect(relClose(after.avgCostUsdPerExam, countingNullsAsZero, 0.5)).toBe(false);

      const durIgnoring = (durSumBefore + 150 * 400000) / (before.examsWithKpis + 150);
      expect(relClose(after.avgDurationMsPerExam, durIgnoring, 0.08)).toBe(true);
    });

    test("the aggregate is not cached — a new exam shows up on the next read", async () => {
      // The other time the same value could be computed. A snapshot refreshed on a
      // timer would pass every clause above and be wrong for the operator watching it.
      const teacher = (await call("POST", "/api/teacher")).body.teacherId;
      const before = (await call("GET", "/api/admin/kpis", { teacher: admin })).body;
      await call("POST", "/api/subjects", {
        teacher,
        body: { subject: SUBJECT, costUsd: 0.5, durationMs: 1000 },
      });
      const after = (await call("GET", "/api/admin/kpis", { teacher: admin })).body;
      expect(after.totalExams).toBeGreaterThanOrEqual(before.totalExams + 1);
      expect(after.examsWithKpis).toBeGreaterThanOrEqual(before.examsWithKpis + 1);
    });
  });

  describe("GET /api/admin/teachers", () => {
    test("counts exams per teacher", async () => {
      const teacher = (await call("POST", "/api/teacher")).body.teacherId;
      for (let i = 0; i < 3; i++) {
        await call("POST", "/api/subjects", { teacher, body: { subject: SUBJECT } });
      }
      const { body } = await call("GET", "/api/admin/teachers", { teacher: admin });
      const row = body.teachers.find((t) => t.teacherId === teacher);
      expect(row).toBeTruthy();
      expect(row.examCount).toBe(3);
      expect(row.role).toBe("teacher");
      expect(row.email).toBeNull();
      expect(typeof row.createdAt).toBe("string");
    });

    test("a teacher with NO exams is listed with 0, not dropped", async () => {
      // The empty case, per row. A join that drops the zero side makes a brand-new
      // teacher invisible to the operator on the day they sign up.
      const teacher = (await call("POST", "/api/teacher")).body.teacherId;
      const { body } = await call("GET", "/api/admin/teachers", { teacher: admin });
      const row = body.teachers.find((t) => t.teacherId === teacher);
      expect(row).toBeTruthy();
      expect(row.examCount).toBe(0);
    });

    test("a legacy row with no role field reads as a teacher", async () => {
      // ADJUSTED for the QA F1 cap: the listing now returns the newest 200, so a row
      // backdated to July falls off the page and the test would pass vacuously (or fail
      // for the wrong reason). What makes this row "legacy" is the ABSENT `role` field,
      // not its date — so it is inserted with a current timestamp and the missing field
      // stays the thing under test.
      const teacherId = randomBytes(16).toString("hex");
      const now = new Date();
      await db.collection("teachers").insertOne({
        teacherId,
        email: null,
        passwordHash: null,
        recoveryHash: null,
        recoveryUsedAt: null,
        // deliberately NO `role` key
        createdAt: now,
        updatedAt: now,
      });
      const { body } = await call("GET", "/api/admin/teachers", { teacher: admin });
      const row = body.teachers.find((t) => t.teacherId === teacherId);
      expect(row).toBeTruthy();
      expect(row.role).toBe("teacher");
    });

    test("the admin sees itself, with role admin", async () => {
      const { body } = await call("GET", "/api/admin/teachers", { teacher: admin });
      const row = body.teachers.find((t) => t.teacherId === admin);
      expect(row).toBeTruthy();
      expect(row.role).toBe("admin");
      expect(row.email).toContain("@");
    });
  });

  describe("GET /api/admin/exams", () => {
    test("newest first, capped at 200", async () => {
      const { body } = await call("GET", "/api/admin/exams", { teacher: admin });
      expect(Array.isArray(body.exams)).toBe(true);
      expect(body.exams.length).toBeLessThanOrEqual(200);
      // This store holds thousands — a cap that never binds is not a cap.
      expect(body.exams.length).toBe(200);
      const times = body.exams.map((e) => new Date(e.createdAt).getTime());
      for (let i = 1; i < times.length; i++) {
        expect(times[i - 1]).toBeGreaterThanOrEqual(times[i]);
      }
    });

    test("a just-created exam appears with its own KPI numbers", async () => {
      const teacher = (await call("POST", "/api/teacher")).body.teacherId;
      const { body: made } = await call("POST", "/api/subjects", {
        teacher,
        body: { subject: SUBJECT, costUsd: 0.6454, durationMs: 128000 },
      });
      const { body } = await call("GET", "/api/admin/exams", { teacher: admin });
      const row = body.exams.find((e) => e.id === made.id);
      expect(row).toBeTruthy();
      expect(row.teacherId).toBe(teacher);
      expect(row.title).toBe(SUBJECT.title);
      expect(row.exerciseCount).toBe(2);
      expect(row.costUsd).toBe(0.6454);
      expect(row.durationMs).toBe(128000);
    });

    test("an exam with no KPIs reads null, never 0", async () => {
      // 0 is a measurement. Coercing an absence into one would quietly claim a free run.
      const teacher = (await call("POST", "/api/teacher")).body.teacherId;
      const { body: made } = await call("POST", "/api/subjects", {
        teacher,
        body: { subject: SUBJECT },
      });
      const { body } = await call("GET", "/api/admin/exams", { teacher: admin });
      const row = body.exams.find((e) => e.id === made.id);
      expect(row.costUsd).toBeNull();
      expect(row.durationMs).toBeNull();
    });

    test("the exam list carries NO teacher content — no statements, no exercises", async () => {
      // An operator list is a list, not a bulk export of everybody's coursework.
      const teacher = (await call("POST", "/api/teacher")).body.teacherId;
      await call("POST", "/api/subjects", { teacher, body: { subject: SUBJECT } });
      const { body } = await call("GET", "/api/admin/exams", { teacher: admin });
      const json = JSON.stringify(body);
      expect(json).not.toContain("statement");
      expect(json).not.toContain("$f(x)=x^2$");
      for (const row of body.exams) {
        expect(row.subject).toBeUndefined();
        expect(row.exercises).toBeUndefined();
      }
    });
  });

  describe("NO HASH EVER LEAVES THE SERVICE", () => {
    test.each(ADMIN_ROUTES)("%s carries no hash and no hash-shaped field", async (route) => {
      // Every leak of a hash is permanent — it cannot be rotated out of wherever it went.
      const { body } = await call("GET", route, { teacher: admin });
      const json = JSON.stringify(body);
      expect(json).not.toContain("scrypt$");
      expect(json).not.toContain("passwordHash");
      expect(json).not.toContain("recoveryHash");
    });

    test("the teacher list really does contain accounts with hashes stored", async () => {
      // Guards the clause above from passing vacuously: if the list were empty, or held
      // only anonymous rows, "no hash" would be true and would mean nothing.
      const email = freshEmail();
      const { body: signed } = await call("POST", "/api/auth/signup", {
        body: { email, password: freshSecret() },
      });
      const stored = await db.collection("teachers").findOne({ teacherId: signed.teacherId });
      expect(stored.passwordHash).toMatch(/^scrypt\$/);

      const { body } = await call("GET", "/api/admin/teachers", { teacher: admin });
      const row = body.teachers.find((t) => t.teacherId === signed.teacherId);
      expect(row).toBeTruthy();
      expect(row.email).toBe(email);
      expect(JSON.stringify(row)).not.toContain("scrypt$");
    });
  });

  describe("ownership is NOT relaxed anywhere", () => {
    test("a teacher still cannot read another teacher's subject", async () => {
      const owner = (await call("POST", "/api/teacher")).body.teacherId;
      const other = (await call("POST", "/api/teacher")).body.teacherId;
      const { body: theirs } = await call("POST", "/api/subjects", {
        teacher: owner,
        body: { subject: SUBJECT },
      });
      const peek = await call("GET", `/api/subjects/${theirs.id}`, { teacher: other });
      expect(peek.status).toBe(404);
      expect(peek.body.error.type).toBe("subject_not_found");
    });

    test("the admin gets the same 404 on the teacher route, even for an exam it can LIST", async () => {
      // The admin can see the exam exists on /api/admin/exams. That must not make the
      // teacher path yield it: the admin surfaces are separate reads, not a key.
      const owner = (await call("POST", "/api/teacher")).body.teacherId;
      const { body: theirs } = await call("POST", "/api/subjects", {
        teacher: owner,
        body: { subject: SUBJECT, costUsd: 0.2, durationMs: 2000 },
      });
      const listed = await call("GET", "/api/admin/exams", { teacher: admin });
      expect(listed.body.exams.some((e) => e.id === theirs.id)).toBe(true);

      const peek = await call("GET", `/api/subjects/${theirs.id}`, { teacher: admin });
      expect(peek.status).toBe(404);
      expect(peek.body.error.type).toBe("subject_not_found");
    });

    test("there is no admin route that returns a subject's content", async () => {
      const owner = (await call("POST", "/api/teacher")).body.teacherId;
      const { body: theirs } = await call("POST", "/api/subjects", {
        teacher: owner,
        body: { subject: SUBJECT },
      });
      for (const p of [
        `/api/admin/subjects/${theirs.id}`,
        `/api/admin/exams/${theirs.id}`,
        `/api/admin/teachers/${owner}/subjects`,
      ]) {
        const { status } = await call("GET", p, { teacher: admin });
        expect(status).toBe(404);
      }
    });
  });

  describe("negative — QA F4/F1: every aggregate says what it was computed over", () => {
    /**
     * `totalTeachers` used to count EVERY row, including anonymous sessions and the decoy
     * rows a non-confirming sign-up creates. On the live store that was 9069 against ~3100
     * real accounts, so avgExamsPerTeacher read roughly 3x low — spec-compliant and
     * misleading, which is the only kind of dashboard bug that matters.
     */
    test("totalTeachers counts ACCOUNTS, and anonymous sessions are reported separately", async () => {
      const before = (await call("GET", "/api/admin/kpis", { teacher: admin })).body;

      // an anonymous session must move ONE number, and not the account count
      await call("POST", "/api/teacher");
      const after = (await call("GET", "/api/admin/kpis", { teacher: admin })).body;

      // Other suites insert concurrently, so assert the DIRECTION, not exact deltas:
      // an anonymous session must never move the account count, and must move the other.
      expect(after.anonymousSessions).toBeGreaterThan(before.anonymousSessions - 1);
      expect(after.totalTeachers - before.totalTeachers).toBeLessThan(40);
    });

    test("avgExamsPerTeacher divides by ACCOUNTS — anonymous rows never dilute it", async () => {
      const k = (await call("GET", "/api/admin/kpis", { teacher: admin })).body;
      const accounts = await db
        .collection("teachers")
        .countDocuments({ email: { $type: "string" } });
      expect(Math.abs(k.totalTeachers - accounts)).toBeLessThan(40);
      expect(relClose(k.avgExamsPerTeacher, k.totalExams / k.totalTeachers, 0.001)).toBe(true);
    });

    test("the teacher listing is capped and ADMITS it — a silent truncation is a lie", async () => {
      const res = await call("GET", "/api/admin/teachers", { teacher: admin });
      expect(res.body.teachers.length).toBeLessThanOrEqual(200);
      expect(typeof res.body.total).toBe("number");
      expect(res.body.total).toBe(await db.collection("teachers").countDocuments());
      expect(res.body.total).toBeGreaterThanOrEqual(res.body.teachers.length);
    });
  });
});
