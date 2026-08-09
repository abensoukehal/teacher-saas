/**
 * be-5 — a fan-out gets a budget, not a bigger cap.
 *
 * THE PROBLEM (SEED §6): one exam is now N+1 agent loops, and `CLAUDE_MAX_CONCURRENT` is
 * a FLAT GLOBAL number defaulting to 3. So a single 3-exercise fan-out saturates the whole
 * gate by itself and every other teacher queues behind one exam. The global cap cannot
 * express that — it knows how many loops exist, not whose they are.
 *
 * THE FIX IS NOT A BIGGER CAP. The capacity study measured a safe ceiling of 9 on this
 * machine and deliberately left raising it to a human with the evidence in hand;
 * `project/CLAUDE.md` records "the concurrency cap stays" as a must-not-undo. The budget
 * is an ADDITIONAL bound underneath it, and this suite asserts both directions: the budget
 * binds, and the global cap still binds over everything.
 *
 * NEVER CALLS A REAL GENERATION — recordings replayed. Nothing here asserts total
 * generation time (SEED §10.2).
 */
const fs = require("node:fs");
const path = require("node:path");
const { ObjectId, MongoClient } = require("mongodb");
const { startReplayServer, client } = require("./replay-harness");

const MONGO = process.env.CHAR_MONGO_URL || "mongodb://127.0.0.1:27017";
const DB = "teacher_saas";
const REPO = process.env.CHAR_ROOTDIR;

const GLOBAL_CAP = 3;
const BUDGET = 2;

const CONTROLS = {
  stream: "علوم تجريبية",
  level: "3AS",
  topic: "الدوال العددية والنهايات",
  difficulty: "متوسط",
  exerciseCount: 6,
  durationMinutes: 120,
  format: "composition",
  totalPoints: 20,
};

jest.setTimeout(180_000);

let server;
let call;
let mongo;
let db;
const CREATED = [];
const TEACHERS = [];

/** Samples /health as fast as it will answer, for as long as `stop` says to. */
function sampleHealth(url) {
  const samples = [];
  let running = true;
  const loop = (async () => {
    while (running) {
      try {
        const res = await fetch(`${url}/health`);
        const body = await res.json();
        samples.push({ active: body.claude.active, queued: body.claude.queued });
      } catch {
        /* the instance is busy; skip this sample */
      }
      await new Promise((r) => setTimeout(r, 40));
    }
  })();
  return {
    samples,
    stop: async () => {
      running = false;
      await loop;
      return samples;
    },
  };
}

async function mint(c) {
  const { body } = await c("POST", "/api/teacher");
  TEACHERS.push(body.teacherId);
  return body.teacherId;
}

beforeAll(async () => {
  // A long per-run delay so the gate is observably occupied rather than a blur, and the
  // product defaults for both numbers.
  server = await startReplayServer({ delayMs: 700, maxConcurrent: GLOBAL_CAP });
  call = client(server.url);
  mongo = await new MongoClient(MONGO).connect();
  db = mongo.db(DB);
});

afterAll(async () => {
  if (server) await server.stop();
  if (db) {
    if (CREATED.length > 0) {
      await db.collection("subjects").deleteMany({ _id: { $in: CREATED } });
      await db.collection("exercise_revisions").deleteMany({ subjectId: { $in: CREATED } });
    }
    if (TEACHERS.length > 0) {
      await db.collection("teachers").deleteMany({ teacherId: { $in: TEACHERS } });
    }
  }
  if (mongo) await mongo.close();
});

describe("be-5 — /health reports the budget alongside the cap", () => {
  test("an operator can read both numbers without cross-referencing", async () => {
    const { body } = await call("GET", "/health");
    expect(typeof body.fanout).toBe("object");
    expect(body.fanout.budget).toBe(BUDGET);
    expect(body.fanout.globalCap).toBe(GLOBAL_CAP);
    expect(typeof body.fanout.groups).toBe("number");
  });

  test("the budget always leaves a loop for somebody else", async () => {
    // The invariant that makes the budget worth having at all.
    const { body } = await call("GET", "/health");
    expect(body.fanout.budget).toBeLessThan(body.claude.max);
    expect(body.fanout.budget).toBeGreaterThanOrEqual(1);
  });

  test("/health's claude sub-object is NOT extended", async () => {
    // The promoted regression net pins these keys EXACTLY. The budget is reported
    // top-level for that reason — the same place `authRateLimit` sits, for the same reason.
    const { body } = await call("GET", "/health");
    expect(Object.keys(body.claude).sort()).toEqual(
      ["active", "detail", "max", "ok", "queued"].sort(),
    );
  });
});

describe("be-5 — the budget binds one exam", () => {
  let samples;

  beforeAll(async () => {
    const teacher = await mint(call);
    const probe = sampleHealth(server.url);
    const { body } = await call("POST", "/api/exams", { body: CONTROLS, teacher });
    CREATED.push(new ObjectId(body.subjectId));

    const until = Date.now() + 60_000;
    for (;;) {
      const got = await call("GET", `/api/subjects/${body.subjectId}`, { teacher });
      if (got.body.subject.exercises.every((e) => e.status !== "pending")) break;
      if (Date.now() > until) throw new Error("fan-out never settled");
      await new Promise((r) => setTimeout(r, 100));
    }
    samples = await probe.stop();
  });

  test("the probe actually observed the fan-out running", () => {
    // Without this, every clause below would pass vacuously on a sample of zeroes.
    expect(samples.length).toBeGreaterThan(5);
    expect(Math.max(...samples.map((s) => s.active))).toBeGreaterThan(0);
  });

  test("one exam never holds more than its budget of concurrent loops", () => {
    // Six exercises want six loops at once; the budget lets two run and queues the rest.
    const peak = Math.max(...samples.map((s) => s.active));
    expect(peak).toBeLessThanOrEqual(BUDGET);
  });

  test("total active never exceeds the global cap", () => {
    // The negative clause. The budget is an EXTRA bound — it must never become the only
    // one, and nothing above may exceed the machine-wide number.
    for (const s of samples) expect(s.active).toBeLessThanOrEqual(GLOBAL_CAP);
  });

  test("and the exam still completes — a budget throttles, it does not drop work", async () => {
    const doc = await db.collection("subjects").findOne({ _id: CREATED[CREATED.length - 1] });
    expect(doc.subject.exercises.map((e) => e.status)).toEqual(Array(6).fill("ready"));
    expect(doc.subject.exercises.reduce((n, e) => n + e.points, 0)).toBe(20);
  });
});

describe("be-5 — a second teacher is not starved by the first one's exam", () => {
  test("their request makes progress while a 6-exercise fan-out is in flight", async () => {
    // THE ACTUAL REASON THIS EXISTS. Before the budget, a 3-exercise fan-out filled the
    // default gate of 3 and the next teacher waited for a whole exam — minutes — before
    // their plan could even start.
    const first = await mint(call);
    const second = await mint(call);

    const started = await call("POST", "/api/exams", { body: CONTROLS, teacher: first });
    CREATED.push(new ObjectId(started.body.subjectId));

    // While that fan-out is still working, a different teacher asks for an exam.
    const t0 = Date.now();
    const theirs = await call("POST", "/api/exams", {
      body: { ...CONTROLS, exerciseCount: 3 },
      teacher: second,
    });
    const waited = Date.now() - t0;
    CREATED.push(new ObjectId(theirs.body.subjectId));

    expect(theirs.status).toBe(201);
    expect(theirs.body.subject.exercises).toHaveLength(3);

    // The first exam must still have been running — otherwise this proves nothing.
    const firstDoc = await db
      .collection("subjects")
      .findOne({ _id: new ObjectId(started.body.subjectId) });
    expect(firstDoc.subject.exercises.length).toBe(6);

    // No timing ORACLE (SEED §10.2 forbids one) — this is a starvation bound, not a
    // latency claim: the free slot means the plan does not queue behind six exercises,
    // and six replayed exercises at 700 ms each cannot finish in under two seconds.
    expect(waited).toBeLessThan(2_000);
  });
});

describe("be-5 — the budget cannot be configured out of existence", () => {
  test("a budget set at or above the cap is clamped to leave one loop free", async () => {
    // An operator raising CLAUDE_FANOUT_BUDGET to 99 is asking for exactly the starvation
    // this gate prevents. The clamp is what makes the guarantee a guarantee.
    const wide = await startReplayServer({
      delayMs: 100,
      maxConcurrent: GLOBAL_CAP,
      fanoutBudget: 99,
    });
    try {
      const { body } = await client(wide.url)("GET", "/health");
      expect(body.fanout.configured).toBe(99);
      expect(body.fanout.budget).toBe(GLOBAL_CAP - 1);
      expect(body.fanout.budget).toBeLessThan(body.claude.max);
    } finally {
      await wide.stop();
    }
  });

  test("a budget of zero still lets a fan-out run", async () => {
    // A floor of 1, because a budget of 0 would deadlock every exam rather than throttle it.
    const zero = await startReplayServer({ delayMs: 100, maxConcurrent: GLOBAL_CAP, fanoutBudget: 0 });
    try {
      const c = client(zero.url);
      const { body: health } = await c("GET", "/health");
      expect(health.fanout.budget).toBe(1);

      const teacher = await mint(c);
      const { status, body } = await c("POST", "/api/exams", {
        body: { ...CONTROLS, exerciseCount: 3 },
        teacher,
      });
      expect(status).toBe(201);
      CREATED.push(new ObjectId(body.subjectId));

      const until = Date.now() + 45_000;
      for (;;) {
        const got = await c("GET", `/api/subjects/${body.subjectId}`, { teacher });
        if (got.body.subject.exercises.every((e) => e.status !== "pending")) {
          expect(got.body.subject.exercises.map((e) => e.status)).toEqual([
            "ready",
            "ready",
            "ready",
          ]);
          break;
        }
        if (Date.now() > until) throw new Error("a budget of 0 deadlocked the fan-out");
        await new Promise((r) => setTimeout(r, 100));
      }
    } finally {
      await zero.stop();
    }
  });
});

describe("be-5 — the global cap's default is untouched", () => {
  test("CLAUDE_MAX_CONCURRENT still defaults to 3 in config.ts", () => {
    // Pinned against the source, because every instance in this suite passes the value
    // explicitly and would therefore never notice the DEFAULT moving. The capacity study
    // measured a safe ceiling of 9 and deliberately left raising it to a human; this job
    // adds a budget under the cap, it does not relax the cap.
    const source = fs.readFileSync(path.join(REPO, "src", "config.ts"), "utf8");
    expect(source).toMatch(/maxConcurrent:\s*int\("CLAUDE_MAX_CONCURRENT",\s*3\)/);
  });

  test("the budget's own default is below that cap", () => {
    const source = fs.readFileSync(path.join(REPO, "src", "config.ts"), "utf8");
    const m = /fanoutBudget:\s*int\("CLAUDE_FANOUT_BUDGET",\s*(\d+)\)/.exec(source);
    expect(m).not.toBeNull();
    expect(Number(m[1])).toBeLessThan(3);
  });
});
