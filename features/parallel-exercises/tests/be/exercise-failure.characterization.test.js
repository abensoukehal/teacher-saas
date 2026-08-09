/**
 * be-3 — a malformed exercise fails alone, and retries itself.
 *
 * THE MEASUREMENT THIS EXISTS FOR (SEED §10.1): 1 in 10 `exercise-one` runs comes back
 * malformed, so a 3-exercise fan-out has a **27% chance of a hole**. Under the monolith
 * the same failure killed a whole 110 s exam. Per-exercise retry is therefore not a
 * nice-to-have — it is what makes the design shippable at all.
 *
 * THE TRAP THE FIXTURES ENCODE: both real truncations were reported by the CLI as
 * `subtype: success`, `is_error: false`. `rec-fan-ex1.json` is 906 chars with an
 * unbalanced brace; `rec-trunc-9.json` is 763 chars behind a ``` fence. Exit code and
 * `is_error` are useless here, and a suite that trusted either would pass while the
 * product shipped holes.
 *
 * NEVER CALLS A REAL GENERATION — every payload is one of those recordings, replayed.
 * NOTHING HERE ASSERTS TOTAL GENERATION TIME (SEED §10.2).
 */
const { ObjectId, MongoClient } = require("mongodb");
const { startReplayServer, client } = require("./replay-harness");

const MONGO = process.env.CHAR_MONGO_URL || "mongodb://127.0.0.1:27017";
const DB = "teacher_saas";
const TOTAL_POINTS = 20;

const CONTROLS = {
  stream: "علوم تجريبية",
  level: "3AS",
  topic: "الدوال العددية والنهايات",
  difficulty: "متوسط",
  exerciseCount: 3,
  durationMinutes: 120,
  format: "composition",
  totalPoints: 20,
};

/** The retry budget the implementation states: the original plus ONE automatic retry. */
const GENERATION_ATTEMPTS = 2;

jest.setTimeout(180_000);

let mongo;
let db;
const CREATED = [];
const TEACHERS = [];

/** Runs one exam to completion on a server in the given replay mode. */
async function runExam(mode) {
  const server = await startReplayServer({ mode, delayMs: 150 });
  const call = client(server.url);
  const { body: minted } = await call("POST", "/api/teacher");
  const teacher = minted.teacherId;
  TEACHERS.push(teacher);

  const created = await call("POST", "/api/exams", { body: CONTROLS, teacher });
  const subjectId = created.body.subjectId;
  CREATED.push(new ObjectId(subjectId));

  const until = Date.now() + 60_000;
  let last;
  for (;;) {
    last = await call("GET", `/api/subjects/${subjectId}`, { teacher });
    const settling = last.body.subject.exercises.filter((e) => e.status === "pending");
    if (settling.length === 0) break;
    if (Date.now() > until) throw new Error("fan-out never settled");
    await new Promise((r) => setTimeout(r, 150));
  }
  return { server, call, teacher, subjectId, created, response: last };
}

beforeAll(async () => {
  mongo = await new MongoClient(MONGO).connect();
  db = mongo.db(DB);
});

afterAll(async () => {
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

describe("be-3 — a permanently truncated exercise fails alone", () => {
  let ctx;
  let byId;

  beforeAll(async () => {
    // ex1 returns the real 906-char truncated capture on EVERY attempt.
    ctx = await runExam("trunc-ex1");
    byId = new Map(ctx.response.body.subject.exercises.map((e) => [e.id, e]));
  });

  afterAll(async () => {
    if (ctx) await ctx.server.stop();
  });

  test("the truncated exercise is marked failed with an empty statement", () => {
    expect(byId.get("ex1").status).toBe("failed");
    expect(byId.get("ex1").statement).toBe("");
  });

  test("the OTHER exercises are ready — the whole point of the fan-out", () => {
    // Under the monolith this same malformed response killed the entire exam and returned
    // `data: null` after 110 s. Here it costs one exercise out of three.
    expect(byId.get("ex2").status).toBe("ready");
    expect(byId.get("ex3").status).toBe("ready");
    expect(byId.get("ex2").statement.trim().length).toBeGreaterThan(0);
    expect(byId.get("ex3").statement.trim().length).toBeGreaterThan(0);
  });

  test("the exam is NOT an error response", () => {
    // Contract §3. The other exercises are real and useful, so a hole is a state of the
    // exam, never a failed request.
    expect(ctx.created.status).toBe(201);
    expect(ctx.response.status).toBe(200);
    expect(ctx.response.body.error).toBeUndefined();
    expect(ctx.response.body.subject.exercises).toHaveLength(3);
  });

  test("points still sum to 20 with a failed exercise present", () => {
    // The failed slot keeps its points, so the exam still adds up and every other
    // exercise is worth what the plan said it was worth.
    const sum = ctx.response.body.subject.exercises.reduce((n, e) => n + e.points, 0);
    expect(sum).toBe(TOTAL_POINTS);
    expect(byId.get("ex1").points).toBe(5);
    expect(byId.get("ex1").label).toBe("التمرين الأول");
  });

  test("a failed fill writes NO exercise_revisions row", async () => {
    // Contract §5.4 — the outgoing slot was a `pending` placeholder, and a `""` statement
    // is not superseded teacher-visible work. Archiving it would let "restore" put a blank
    // exercise on a printed sheet.
    const rows = await db
      .collection("exercise_revisions")
      .countDocuments({ subjectId: new ObjectId(ctx.subjectId) });
    expect(rows).toBe(0);
  });

  test("retry was attempted, and it is BOUNDED", () => {
    // Both halves matter. Zero retries means a 27% hole rate ships; unbounded retry on a
    // ~110 s loop is a resource bug wearing resilience's clothes.
    expect(ctx.server.attempts("ex1")).toBe(GENERATION_ATTEMPTS);
    // A healthy slot is generated exactly once — the retry is not a blanket double-spend.
    expect(ctx.server.attempts("ex2")).toBe(1);
    expect(ctx.server.attempts("ex3")).toBe(1);
  });

  test("rev advanced once per slot, the failed one included", async () => {
    // The `failed` marking goes through the same compare-and-set as a real fill, so it
    // cannot be lost to the race either.
    const doc = await db.collection("subjects").findOne({ _id: new ObjectId(ctx.subjectId) });
    expect(doc.rev).toBe(3);
  });
});

describe("be-3 — a retry that succeeds yields ready", () => {
  let ctx;
  let byId;

  beforeAll(async () => {
    // ex1 is truncated on the first attempt and valid on the second — the ~9-in-10 case
    // where one more draw is all it takes.
    ctx = await runExam("trunc-ex1-once");
    byId = new Map(ctx.response.body.subject.exercises.map((e) => [e.id, e]));
  });

  afterAll(async () => {
    if (ctx) await ctx.server.stop();
  });

  test("the recovered exercise is ready, not failed", () => {
    expect(byId.get("ex1").status).toBe("ready");
    expect(byId.get("ex1").statement.trim().length).toBeGreaterThan(0);
  });

  test("the retry happened before anything was written off", () => {
    // Two spawns and a `ready` outcome is only reachable if the first result was refused
    // and a second was taken — i.e. the retry precedes the `failed` marking, never follows it.
    expect(ctx.server.attempts("ex1")).toBe(2);
  });

  test("the recovered exercise still carries the plan's id, label and points", () => {
    expect(byId.get("ex1").id).toBe("ex1");
    expect(byId.get("ex1").label).toBe("التمرين الأول");
    expect(byId.get("ex1").points).toBe(5);
  });

  test("the whole exam is ready and still sums to 20", () => {
    expect(ctx.response.body.subject.exercises.map((e) => e.status)).toEqual([
      "ready",
      "ready",
      "ready",
    ]);
    expect(ctx.response.body.subject.exercises.reduce((n, e) => n + e.points, 0)).toBe(
      TOTAL_POINTS,
    );
  });

  test("a recovered slot writes no revision either", async () => {
    const rows = await db
      .collection("exercise_revisions")
      .countDocuments({ subjectId: new ObjectId(ctx.subjectId) });
    expect(rows).toBe(0);
  });
});

describe("be-3 — a FENCED but complete result is recovered, not retried", () => {
  /**
   * The second capture SEED §9.2 lists as a truncation is not one.
   *
   *   rec-fan-ex1.json  906 chars, braces 22 vs 21 — genuinely cut mid-object.
   *   rec-trunc-9.json  763 chars, braces 18 vs 18, closing ``` present — COMPLETE.
   *
   * Its raw `JSON.parse` fails only because of the ```json fence, and stripping that fence
   * is precisely what `src/claude/json.ts` was written for. Measured here, not assumed.
   *
   * This matters beyond tidiness: SEED §10.1 counted it toward "2/13 ≈ 15% malformed", so
   * the SERVICE-VISIBLE malformed rate is lower than the raw-parse rate. It does not change
   * the design — one unrecoverable case in thirteen still puts a 3-exercise exam near a 20%
   * hole rate without retry — but a suite that asserted a `failed` here would have pinned a
   * wasted agent loop as correct behaviour.
   */
  let ctx;

  beforeAll(async () => {
    ctx = await runExam("fenced-ex1");
  });

  afterAll(async () => {
    if (ctx) await ctx.server.stop();
  });

  test("it lands ready, with the recovered statement", () => {
    const byId = new Map(ctx.response.body.subject.exercises.map((e) => [e.id, e]));
    expect(byId.get("ex1").status).toBe("ready");
    expect(byId.get("ex1").statement.trim().length).toBeGreaterThan(0);
    // Recovered, not fabricated: the fence itself must not survive into the statement.
    expect(byId.get("ex1").statement).not.toMatch(/```/);
  });

  test("no retry is spent on a result that was usable all along", () => {
    // A retry here would burn a whole agent loop — 45-120 s and a concurrency slot — to
    // re-derive something the service already had.
    expect(ctx.server.attempts("ex1")).toBe(1);
  });

  test("the assignment survived the fence", () => {
    const byId = new Map(ctx.response.body.subject.exercises.map((e) => [e.id, e]));
    expect(byId.get("ex1").points).toBe(5);
    expect(byId.get("ex1").label).toBe("التمرين الأول");
    expect(ctx.response.body.subject.exercises.reduce((n, e) => n + e.points, 0)).toBe(
      TOTAL_POINTS,
    );
  });
});
