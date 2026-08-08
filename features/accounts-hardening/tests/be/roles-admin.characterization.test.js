/**
 * be-2 — a real role, and an admin that cannot be self-registered.
 *
 * An admin who "sees everything" is a privilege boundary. There is no boundary today,
 * only a bearer string — so the role has to be a STORED fact, never something a request
 * can influence and never something inferred.
 *
 * ⚠ THE PASSWORD IS NEVER COMMITTED. This suite therefore never contains one: it
 * GENERATES a random secret per run, hands it to the script through the environment,
 * and then greps the whole tree for that generated value expecting zero hits. That is
 * strictly stronger than grepping for one known literal — it proves the property (the
 * script writes its input nowhere) rather than the absence of one string.
 *
 * NOTE ON `requireAdmin`: its 401/403/pass behaviour is black-box-observable only once
 * a route uses it, and the first admin route arrives in be-3. Those clauses live in
 * admin-surfaces.characterization.test.js, deliberately and not by omission.
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

// tools/ci sets CHAR_ROOTDIR to the sub-repo checkout this gate is running against —
// the same checkout the lane is serving. The script under test lives there.
const REPO = process.env.CHAR_ROOTDIR;
const SEED = REPO ? path.join(REPO, "scripts", "seed-admin.mjs") : null;

let mongo;
let db;

/**
 * BACKS OFF ON 429, like a real client would.
 *
 * be-4 puts a real rate limiter on /api/auth/*, keyed per IP + route — and every suite
 * in this gate drives the same lane from 127.0.0.1, in parallel. A sibling suite that
 * deliberately exhausts a bucket would otherwise turn this file red for a reason that
 * has nothing to do with roles.
 *
 * Safe by construction: NOTHING in this file asserts anything about throttling, so
 * retrying past a 429 cannot mask a clause here. The limiter's own behaviour — including
 * that it never touches the subject routes — is pinned in auth-bounds, where a 429 is
 * the thing under test and is never retried.
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

/** Run the seed script. Returns {status, stdout} — a nonzero exit is data, not a throw. */
function seed(args, env = {}) {
  try {
    const stdout = execFileSync("node", [SEED, ...args], {
      cwd: REPO,
      encoding: "utf8",
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { status: 0, stdout };
  } catch (err) {
    return { status: err.status ?? 1, stdout: `${err.stdout ?? ""}${err.stderr ?? ""}` };
  }
}

/** A secret that exists only for this run and is never written to any file. */
const freshSecret = () => `pw-${randomBytes(15).toString("base64url")}`;

let n = 0;
const freshEmail = () => `admin.probe.${Date.now()}.${n++}@example.dz`;

const SUBJECT = {
  title: "اختبار الفصل الأول",
  meta: { totalPoints: 20, topic: "الدوال" },
  exercises: [{ id: "ex1", label: "التمرين الأول", points: 20, statement: "$f(x)=x^2$" }],
};

/** grep the tree for a literal. Returns the matching lines — empty means clean. */
function grepTree(root, literal) {
  try {
    return execFileSync(
      "grep",
      ["-rIF", "--exclude-dir=node_modules", "--exclude-dir=.git", "--", literal, root],
      { encoding: "utf8" },
    );
  } catch (err) {
    // grep exits 1 for "no match" — that is the passing case.
    if (err.status === 1) return "";
    throw err;
  }
}

describeIfLane(BE, "be-2 — a stored role, and an admin nobody can self-register", () => {
  beforeAll(async () => {
    if (!REPO) throw new Error("CHAR_ROOTDIR is unset — run via tools/ci, not jest directly");
    mongo = new MongoClient(MONGO);
    await mongo.connect();
    db = mongo.db(DB);
  });
  afterAll(async () => {
    if (mongo) await mongo.close();
  });

  describe("positive — the seed script", () => {
    test("a dry run names the default address and writes NOTHING", async () => {
      const before = await db.collection("teachers").countDocuments({ email: "admin@app.com" });
      const { status, stdout } = seed([]);
      expect(status).toBe(0);
      expect(stdout).toContain("admin@app.com");
      expect(stdout.toUpperCase()).toContain("DRY RUN");
      const after = await db.collection("teachers").countDocuments({ email: "admin@app.com" });
      expect(after).toBe(before);
    });

    test("--yes creates an admin row from ADMIN_PASSWORD in the environment", async () => {
      const email = freshEmail();
      const password = freshSecret();
      const { status } = seed(["--yes"], { ADMIN_EMAIL: email, ADMIN_PASSWORD: password });
      expect(status).toBe(0);

      const doc = await db.collection("teachers").findOne({ email });
      expect(doc).toBeTruthy();
      expect(doc.teacherId).toMatch(/^[0-9a-f]{32}$/);
      expect(doc.role).toBe("admin");
      // HASHED, never stored in the clear — this repo's whole reason for the env var.
      expect(doc.passwordHash).toMatch(/^scrypt\$/);
      expect(JSON.stringify(doc)).not.toContain(password);
    });

    test("the seeded admin can actually SIGN IN with that password", async () => {
      // This is what pins the script's hash format to src/store/teachers.ts. The script
      // cannot import the TypeScript source, so it reproduces the scrypt$ encoding — and
      // a silent drift in either direction would leave an admin who cannot log in. The
      // only honest check is the round trip through the real service.
      const email = freshEmail();
      const password = freshSecret();
      seed(["--yes"], { ADMIN_EMAIL: email, ADMIN_PASSWORD: password });
      const doc = await db.collection("teachers").findOne({ email });

      const { status, body } = await call("POST", "/api/auth/signin", { body: { email, password } });
      expect(status).toBe(200);
      expect(body.teacherId).toBe(doc.teacherId);
    });

    test("re-running does not duplicate, and does NOT reset the password", async () => {
      const email = freshEmail();
      const first = freshSecret();
      const second = freshSecret();
      seed(["--yes"], { ADMIN_EMAIL: email, ADMIN_PASSWORD: first });
      const before = await db.collection("teachers").findOne({ email });

      const { status } = seed(["--yes"], { ADMIN_EMAIL: email, ADMIN_PASSWORD: second });
      expect(status).toBe(0);

      expect(await db.collection("teachers").countDocuments({ email })).toBe(1);
      const after = await db.collection("teachers").findOne({ email });
      expect(after.teacherId).toBe(before.teacherId);
      expect(after.passwordHash).toBe(before.passwordHash);
      expect(after.updatedAt.getTime()).toBe(before.updatedAt.getTime());

      // The observable half of the same fact: the ORIGINAL password still works and the
      // second one never took effect. A re-seed that silently rotated the credential
      // would lock the operator out of their own console.
      const ok = await call("POST", "/api/auth/signin", { body: { email, password: first } });
      expect(ok.status).toBe(200);
      const no = await call("POST", "/api/auth/signin", { body: { email, password: second } });
      expect(no.status).toBe(401);
    });

    test("--yes without ADMIN_PASSWORD refuses, nonzero, and creates nothing", async () => {
      const email = freshEmail();
      const env = { ADMIN_EMAIL: email, ADMIN_PASSWORD: "" };
      const { status, stdout } = seed(["--yes"], env);
      expect(status).not.toBe(0);
      expect(stdout).toContain("ADMIN_PASSWORD");
      expect(await db.collection("teachers").countDocuments({ email })).toBe(0);
    });

    test("THE SECRET NEVER TOUCHES A FILE — zero hits anywhere in the tree", async () => {
      const email = freshEmail();
      const password = freshSecret();
      const { stdout } = seed(["--yes"], { ADMIN_EMAIL: email, ADMIN_PASSWORD: password });

      // Not in the script's own output — a credential echoed to a terminal ends up in
      // scrollback, in a CI log, and in a screenshot.
      expect(stdout).not.toContain(password);
      // Not anywhere in the service checkout (run-log.jsonl and .env included — the
      // grep is over the whole tree, not a hand-picked list).
      expect(grepTree(REPO, password)).toBe("");
      // Nor in this job's own test tree, which is versioned in the project repo.
      expect(grepTree(path.join(__dirname), password)).toBe("");
    });

    test("the script carries no fallback password of its own", async () => {
      // A default would be a committed credential wearing a disguise.
      const src = require("node:fs").readFileSync(SEED, "utf8");
      expect(src).toContain("ADMIN_PASSWORD");
      expect(src).not.toMatch(/ADMIN_PASSWORD\s*\]?\s*(\?\?|\|\|)\s*["'`]/);
    });
  });

  describe("positive — sign-up ALWAYS creates a teacher", () => {
    test.each([
      ["a plain signup", {}],
      ["role: admin in the body", { role: "admin" }],
      ["role: ADMIN, upper case", { role: "ADMIN" }],
      ["isAdmin: true", { isAdmin: true }],
      ["a nested role", { teacher: { role: "admin" } }],
    ])("%s -> role is teacher", async (_name, extra) => {
      const email = freshEmail();
      const { status, body } = await call("POST", "/api/auth/signup", {
        body: { email, password: freshSecret(), ...extra },
      });
      expect(status).toBe(201);
      const doc = await db.collection("teachers").findOne({ teacherId: body.teacherId });
      expect(doc.role).toBe("teacher");
    });

    test("adopting an anonymous id still yields a teacher, never a blank privilege", async () => {
      const minted = await call("POST", "/api/teacher");
      const email = freshEmail();
      const { body } = await call("POST", "/api/auth/signup", {
        teacher: minted.body.teacherId,
        body: { email, password: freshSecret(), role: "admin" },
      });
      expect(body.teacherId).toBe(minted.body.teacherId);
      const doc = await db.collection("teachers").findOne({ teacherId: body.teacherId });
      expect(doc.role).toBe("teacher");
    });

    test("an anonymous row minted by POST /api/teacher is a teacher too", async () => {
      const { body } = await call("POST", "/api/teacher");
      const doc = await db.collection("teachers").findOne({ teacherId: body.teacherId });
      expect(doc.role).toBe("teacher");
    });

    test("concurrent signups racing one anonymous id both land as teachers", async () => {
      // One claims the row, the other mints a fresh id. Neither path may leave the role
      // to chance — this is the ordering nobody describes in prose, so it is written first.
      const minted = await call("POST", "/api/teacher");
      const [a, b] = await Promise.all([
        call("POST", "/api/auth/signup", {
          teacher: minted.body.teacherId,
          body: { email: freshEmail(), password: freshSecret(), role: "admin" },
        }),
        call("POST", "/api/auth/signup", {
          teacher: minted.body.teacherId,
          body: { email: freshEmail(), password: freshSecret(), role: "admin" },
        }),
      ]);
      expect(a.status).toBe(201);
      expect(b.status).toBe(201);
      expect(a.body.teacherId).not.toBe(b.body.teacherId);
      for (const id of [a.body.teacherId, b.body.teacherId]) {
        const doc = await db.collection("teachers").findOne({ teacherId: id });
        expect(doc.role).toBe("teacher");
      }
    });
  });

  describe("negative — existing rows are not rewritten", () => {
    test("a legacy teacher row keeps no role field, and still works", async () => {
      const teacherId = randomBytes(16).toString("hex");
      const legacyAt = new Date("2026-07-01T09:00:00.000Z");
      await db.collection("teachers").insertOne({
        teacherId,
        email: null,
        passwordHash: null,
        recoveryHash: null,
        recoveryUsedAt: null,
        createdAt: legacyAt,
        updatedAt: legacyAt,
      });

      // It is a perfectly good teacher: the teacher surfaces accept it unchanged.
      const listed = await call("GET", "/api/subjects", { teacher: teacherId });
      expect(listed.status).toBe(200);

      const after = await db.collection("teachers").findOne({ teacherId });
      expect("role" in after).toBe(false);
      expect(after.updatedAt.getTime()).toBe(legacyAt.getTime());
    });
  });

  describe("negative — an admin is NOT a super-teacher", () => {
    test("the teacher-facing routes treat the admin exactly like anyone else", async () => {
      const email = freshEmail();
      const password = freshSecret();
      seed(["--yes"], { ADMIN_EMAIL: email, ADMIN_PASSWORD: password });
      const admin = (await db.collection("teachers").findOne({ email })).teacherId;

      // A different teacher's subject.
      const victim = (await call("POST", "/api/teacher")).body.teacherId;
      const { body: theirs } = await call("POST", "/api/subjects", {
        teacher: victim,
        body: { subject: SUBJECT },
      });

      // The admin's own list does not contain it…
      const mine = await call("GET", "/api/subjects", { teacher: admin });
      expect(mine.status).toBe(200);
      expect(mine.body.subjects.some((s) => s.id === theirs.id)).toBe(false);

      // …and reading it directly is the SAME not-found a stranger gets. Ownership is
      // scoped inside the query; a role must never relax that.
      const asAdmin = await call("GET", `/api/subjects/${theirs.id}`, { teacher: admin });
      const stranger = (await call("POST", "/api/teacher")).body.teacherId;
      const asStranger = await call("GET", `/api/subjects/${theirs.id}`, { teacher: stranger });
      expect(asAdmin.status).toBe(404);
      expect(asAdmin.body.error).toEqual(asStranger.body.error);
    });
  });

  describe("negative — no hash leaves the service", () => {
    test("signup and signin responses carry no hash of any kind", async () => {
      const email = freshEmail();
      const password = freshSecret();
      const up = await call("POST", "/api/auth/signup", { body: { email, password } });
      const inn = await call("POST", "/api/auth/signin", { body: { email, password } });
      for (const body of [up.body, inn.body]) {
        const json = JSON.stringify(body);
        expect(json).not.toContain("scrypt$");
        expect(json).not.toContain("passwordHash");
        expect(json).not.toContain("recoveryHash");
      }
    });
  });

  describe("negative — a legacy row without a role is a TEACHER at the guard", () => {
    /**
     * Added after review. A mutation inverting `roleOf` (absent -> admin) SURVIVED the whole
     * gate: the two legacy-row tests exercised the /admin/teachers listing's own inline
     * ternary and a teacher route, but **neither sent a null-role id through requireAdmin**.
     *
     * That is the single highest-blast-radius line in the job — 68% of teacher rows carry no
     * `role` field, so an inverted default would silently make thousands of accounts admin,
     * with a fully green gate.
     */
    test("a null-role id is REFUSED by requireAdmin — 403, not admitted", async () => {
      const legacy = require("node:crypto").randomBytes(16).toString("hex");
      await db.collection("teachers").insertOne({
        teacherId: legacy,
        email: null,
        passwordHash: null,
        recoveryHash: null,
        recoveryUsedAt: null,
        // deliberately NO `role` field — the shape every pre-existing row has
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      for (const route of ["/api/admin/kpis", "/api/admin/teachers", "/api/admin/exams"]) {
        const res = await call("GET", route, { teacher: legacy });
        expect(res.status).toBe(403);
        expect(res.body.error.type).toBe("forbidden");
      }
    });

    test("and it is still a working TEACHER — refusing admin is not locking them out", async () => {
      const legacy = require("node:crypto").randomBytes(16).toString("hex");
      await db.collection("teachers").insertOne({
        teacherId: legacy, email: null, passwordHash: null, recoveryHash: null,
        recoveryUsedAt: null, createdAt: new Date(), updatedAt: new Date(),
      });
      const list = await call("GET", "/api/subjects", { teacher: legacy });
      expect(list.status).toBe(200);
      expect(list.body.subjects).toEqual([]);
    });
  });
});
