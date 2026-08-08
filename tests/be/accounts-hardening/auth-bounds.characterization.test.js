/**
 * be-4 — bound the auth surface.
 *
 * A ~60-bit recovery code is safe against online guessing ONLY if guessing is bounded.
 * QA measured 40 consecutive wrong-password sign-ins at ~21–28 req/s with no throttle
 * at all. Separately, `POST /api/auth/signup` answered `409 email_taken`, which is a
 * clean one-request enumeration oracle — and it undid the care taken to make sign-IN
 * indistinguishable.
 *
 * ⚠ ORDERING IN THIS FILE IS DELIBERATE, not cosmetic. The limiter is keyed on
 * IP + route and every suite in this gate runs from 127.0.0.1, in parallel. So the
 * tests that deliberately EXHAUST a bucket are placed last, after this file's own
 * window-expiry test has already burned more wall-clock than the sibling suites take to
 * finish. The `recover` route is used for the early exhaustion work; a sibling suite also
 * calls it, which is why the limits are configurable and raised for this harness. Reordering these describes can make sibling suites flake.
 *
 * PRECONDITION: the lane is up. A hollow run is RED in job mode — WF-82.
 */
const { readFileSync } = require("node:fs");
const { randomBytes } = require("node:crypto");
const { MongoClient } = require("mongodb");
const { describeIfLane } = require("guard");

const BE = process.env.CHAR_BE_URL || "http://localhost:9000";
const LOG = process.env.CHAR_BE_LOG || "";
const MONGO = "mongodb://127.0.0.1:27017";
const DB = "teacher_saas";

// Mirrors the service's defaults. The limits are configurable (src/config.ts reads
// AUTH_RATE_LIMIT_*), and /health reports what an instance is ACTUALLY enforcing — so if
// these ever disagree, ask the service, don't edit this blindly. Read at module load, not
// in beforeAll: jest computes test titles at collection time, so a value fetched later is
// already too late for anything that names a number.
const envInt = (k, d) => (process.env[k] ? Number(process.env[k]) : d);
const LIMIT = {
  signin: envInt("AUTH_RATE_LIMIT_SIGNIN", 10),
  signup: envInt("AUTH_RATE_LIMIT_SIGNUP", 10),
  recover: envInt("AUTH_RATE_LIMIT_RECOVER", 10),
};

const HEX32 = /^[0-9a-f]{32}$/;
const CODE = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/;

let mongo;
let db;

async function call(method, p, { body, teacher, headers = {} } = {}) {
  const res = await fetch(`${BE}${p}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(teacher ? { "x-teacher-id": teacher } : {}),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return {
    status: res.status,
    retryAfter: res.headers.get("retry-after"),
    body: await res.json(),
  };
}

const freshSecret = () => `pw-${randomBytes(15).toString("base64url")}`;
let n = 0;
const freshEmail = () => `bounds.${Date.now()}.${n++}@example.dz`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** One failing recover attempt — the tightest-limited route, and nobody else's. */
const badRecover = () =>
  call("POST", "/api/auth/recover", {
    body: { email: freshEmail(), recoveryCode: "AAAA-BBBB-CCCC", password: freshSecret() },
  });

/** One failing sign-in against an address that does not exist. */
const badSignin = (email = freshEmail()) =>
  call("POST", "/api/auth/signin", { body: { email, password: freshSecret() } });

function expectThrottled(res) {
  expect(res.status).toBe(429);
  expect(res.body.error.type).toBe("rate_limited");
  // Arabic — a hard product constraint, and this message reaches a teacher.
  expect(res.body.error.message).toMatch(/[؀-ۿ]/);
  expect(res.body.error.message).not.toMatch(/[a-zA-Z]{3}/);
  // Retryable, and it says WHEN — a bare 429 is indistinguishable from a wall.
  expect(Number(res.body.error.retryAfterSeconds)).toBeGreaterThan(0);
  expect(Number(res.retryAfter)).toBeGreaterThan(0);
  expect(res.body.correlationId).toBeTruthy();
}

describeIfLane(BE, "be-4 — the auth surface is bounded", () => {
  beforeAll(async () => {
    mongo = new MongoClient(MONGO);
    await mongo.connect();
    db = mongo.db(DB);
  });
  afterAll(async () => {
    if (mongo) await mongo.close();
  });

  // ---- A. recover: the tightest bucket, and one no sibling suite touches -----------
  describe("recover is limited at least as tightly as signin", () => {
    test("the limit is lower than sign-in's", () => {
      // Stated as a clause rather than left implicit: a recovery code is the one
      // secret a teacher writes on paper, and it is the only ~60-bit value in the
      // product. It must never be the loosest thing to guess against.
      expect(LIMIT.recover).toBeLessThanOrEqual(LIMIT.signin);
    });

    test(`attempt ${LIMIT.recover + 1} is 429, and it keeps refusing`, async () => {
      const seen = [];
      for (let i = 0; i < LIMIT.recover + 1; i++) seen.push(await badRecover());
      for (let i = 0; i < LIMIT.recover; i++) expect(seen[i].status).toBe(401);
      expectThrottled(seen[LIMIT.recover]);
      // Still refused on the next request — not a one-shot hiccup.
      expectThrottled(await badRecover());
    });

    test("a throttled request logs at warn, with the route and no teacher id", async () => {
      if (!LOG) throw new Error("CHAR_BE_LOG is unset — run via tools/ci");
      await badRecover();
      const lines = readFileSync(LOG, "utf8")
        .split("\n")
        .filter((l) => l.includes("ratelimit.blocked"))
        .map((l) => JSON.parse(l));
      expect(lines.length).toBeGreaterThan(0);
      const last = lines[lines.length - 1];
      expect(last.level).toBe("warn");
      expect(last.path).toContain("/auth/recover");
      expect(last.correlationId).toBeTruthy();
      // NEVER a whole bearer credential in a log line — the discipline requireTeacher
      // already keeps from the other side.
      expect(JSON.stringify(last)).not.toMatch(/[0-9a-f]{32}/);
    });

    test("spoofing x-forwarded-for does NOT buy a fresh bucket", async () => {
      // `trust proxy` is off, so req.ip is the socket. A limiter that keyed on a
      // caller-supplied header would be bypassable with one line of curl.
      expectThrottled(
        await call("POST", "/api/auth/recover", {
          headers: { "x-forwarded-for": "203.0.113.7" },
          body: { email: freshEmail(), recoveryCode: "AAAA-BBBB-CCCC", password: freshSecret() },
        }),
      );
    });

    test("a DIFFERENT route is unaffected while recover is throttled", async () => {
      // Per IP+ROUTE. Exhausting recovery must not lock a teacher out of signing up.
      //
      // The probe is `signup` and not `signin` deliberately: signin is the bucket this
      // file exhausts later and that the sibling suites also spend, so a failure there
      // would be ambiguous between "the limiter leaked across routes" (the bug) and
      // "someone else filled that bucket" (not a bug). A successful signup refunds its
      // own reservation, so that bucket stays empty under normal traffic.
      expectThrottled(await badRecover());
      const other = await call("POST", "/api/auth/signup", {
        body: { email: freshEmail(), password: freshSecret() },
      });
      expect(other.status).toBe(201);
    });
  });

  // ---- B. the window EXPIRES (this is also what lets the sibling suites finish) ----
  describe("the window expires", () => {
    test(
      "after the window passes, requests are accepted again",
      async () => {
        const blocked = await badRecover();
        expectThrottled(blocked);
        // Wait exactly as long as the service itself said to, plus a margin. Reading
        // the delay from the response keeps this test independent of the constant.
        await sleep(Number(blocked.body.error.retryAfterSeconds) * 1000 + 700);
        const after = await badRecover();
        expect(after.status).toBe(401);
      },
      60_000,
    );
  });

  // ---- C. sign-up no longer confirms that an address exists -----------------------
  describe("sign-up is non-confirming", () => {
    test("a duplicate address answers exactly like a fresh one", async () => {
      const email = freshEmail();
      const first = await call("POST", "/api/auth/signup", {
        body: { email, password: freshSecret() },
      });
      const second = await call("POST", "/api/auth/signup", {
        body: { email, password: freshSecret() },
      });

      expect(first.status).toBe(201);
      expect(second.status).toBe(201);
      // Same keys, same shapes. `409 email_taken` was a one-request oracle over every
      // address a person might want to check.
      expect(Object.keys(second.body).sort()).toEqual(Object.keys(first.body).sort());
      expect(second.body.teacherId).toMatch(HEX32);
      expect(second.body.recoveryCode).toMatch(CODE);
      expect(JSON.stringify(second.body)).not.toContain("email_taken");
    });

    test("and creates NO second account for that address", async () => {
      const email = freshEmail();
      await call("POST", "/api/auth/signup", { body: { email, password: freshSecret() } });
      const before = await db.collection("teachers").findOne({ email });

      await call("POST", "/api/auth/signup", { body: { email, password: freshSecret() } });

      expect(await db.collection("teachers").countDocuments({ email })).toBe(1);
      const after = await db.collection("teachers").findOne({ email });
      // The real account is untouched: same id, same password, not even a touch of
      // updatedAt. A "silent" signup that quietly reset a password would be far worse
      // than the oracle it replaces.
      expect(after.teacherId).toBe(before.teacherId);
      expect(after.passwordHash).toBe(before.passwordHash);
      expect(after.updatedAt.getTime()).toBe(before.updatedAt.getTime());
    });

    test("the id handed back on a duplicate is USABLE, like any other", async () => {
      // The decoy must not be a dead id: a caller who probes with it would otherwise
      // get 401 from requireTeacher and learn the address was taken after all.
      const email = freshEmail();
      await call("POST", "/api/auth/signup", { body: { email, password: freshSecret() } });
      const dup = await call("POST", "/api/auth/signup", {
        body: { email, password: freshSecret() },
      });
      const listed = await call("GET", "/api/subjects", { teacher: dup.body.teacherId });
      expect(listed.status).toBe(200);
      expect(listed.body.subjects).toEqual([]);
      // …and it is NOT the real account's id.
      const real = await db.collection("teachers").findOne({ email });
      expect(dup.body.teacherId).not.toBe(real.teacherId);
    });

    test("a duplicate does not strand the caller's own anonymous exams", async () => {
      // A teacher who typos into an address that already exists keeps the id their
      // exams are stored under, instead of being silently moved to an empty workspace.
      const mine = (await call("POST", "/api/teacher")).body.teacherId;
      await call("POST", "/api/subjects", {
        teacher: mine,
        body: {
          subject: {
            title: "اختبار",
            meta: { totalPoints: 20 },
            exercises: [{ id: "ex1", label: "الأول", points: 20, statement: "$x$" }],
          },
        },
      });
      const taken = freshEmail();
      await call("POST", "/api/auth/signup", { body: { email: taken, password: freshSecret() } });

      const dup = await call("POST", "/api/auth/signup", {
        teacher: mine,
        body: { email: taken, password: freshSecret() },
      });
      expect(dup.status).toBe(201);
      expect(dup.body.teacherId).toBe(mine);
      const listed = await call("GET", "/api/subjects", { teacher: dup.body.teacherId });
      expect(listed.body.subjects.length).toBe(1);
    });
  });

  // ---- D. the limiter's blast radius ----------------------------------------------
  describe("the limiter never touches the subject routes", () => {
    test("30 rapid subject reads all succeed", async () => {
      const teacher = (await call("POST", "/api/teacher")).body.teacherId;
      const results = await Promise.all(
        Array.from({ length: 30 }, () => call("GET", "/api/subjects", { teacher })),
      );
      expect(results.every((r) => r.status === 200)).toBe(true);
    });

    test("POST /api/teacher is not under the limiter either", async () => {
      const results = await Promise.all(
        Array.from({ length: 20 }, () => call("POST", "/api/teacher")),
      );
      expect(results.every((r) => r.status === 201)).toBe(true);
    });
  });

  // ---- E. sign-in's indistinguishability survives ---------------------------------
  describe("sign-in still says nothing about which addresses exist", () => {
    test("unknown email and wrong password are byte-identical", async () => {
      const email = freshEmail();
      const password = freshSecret();
      await call("POST", "/api/auth/signup", { body: { email, password } });

      const wrongPassword = await badSignin(email);
      const unknownEmail = await badSignin();

      expect(wrongPassword.status).toBe(unknownEmail.status);
      expect(wrongPassword.status).toBe(401);
      // Byte-identical apart from the per-request correlation id.
      expect(JSON.stringify(wrongPassword.body.error)).toBe(
        JSON.stringify(unknownEmail.body.error),
      );
    });

    test("failures below the limit do not punish a following SUCCESS", async () => {
      const email = freshEmail();
      const password = freshSecret();
      await call("POST", "/api/auth/signup", { body: { email, password } });

      for (let i = 0; i < 3; i++) await badSignin(email);
      const ok = await call("POST", "/api/auth/signin", { body: { email, password } });
      expect(ok.status).toBe(200);
      expect(ok.body.teacherId).toMatch(HEX32);
    });
  });

  // ---- F. LAST: the tests that exhaust sign-in ------------------------------------
  // Placed here on purpose — see the file header. By now this file has burned a full
  // window on the expiry test, so the parallel suites have finished their auth calls.
  describe("sign-in is bounded (exhausts the bucket — runs last)", () => {
    test(
      "concurrent requests AT THE BOUNDARY cannot all slip through",
      async () => {
        // The clause a person never writes, and the one that matters: a check that
        // reads the counter, awaits, then writes it lets an entire burst past. Fired
        // together, exactly `limit` may be served.
        const email = freshEmail();
        const password = freshSecret();
        await call("POST", "/api/auth/signup", { body: { email, password } });

        // START FROM AN EMPTY BUCKET, and prove it rather than assume it. The tests
        // above spent part of this window, so a burst fired now would measure whatever
        // was left. Fill the bucket, read the service's own retry delay, wait it out.
        let blocked = await badSignin(email);
        for (let i = 0; i < LIMIT.signin + 5 && blocked.status !== 429; i++) {
          blocked = await badSignin(email);
        }
        expectThrottled(blocked);
        await sleep(Number(blocked.body.error.retryAfterSeconds) * 1000 + 700);

        const burst = await Promise.all(
          Array.from({ length: LIMIT.signin + 6 }, () => badSignin(email)),
        );
        const served = burst.filter((r) => r.status === 401).length;
        const refused = burst.filter((r) => r.status === 429).length;
        expect(served).toBe(LIMIT.signin);
        expect(refused).toBe(6);
        for (const r of burst.filter((x) => x.status === 429)) expectThrottled(r);
      },
      30_000,
    );

    test(
      "and a valid sign-in is refused too while the bucket is full",
      async () => {
        // Honest about the cost: a fixed window per IP is a blunt instrument, and a
        // legitimate teacher behind the same NAT as an attacker waits it out. Pinned
        // so the trade-off is visible rather than discovered in production.
        const email = freshEmail();
        const password = freshSecret();
        await call("POST", "/api/auth/signup", { body: { email, password } });
        const blocked = await call("POST", "/api/auth/signin", { body: { email, password } });
        expectThrottled(blocked);
      },
      30_000,
    );
  });
});
