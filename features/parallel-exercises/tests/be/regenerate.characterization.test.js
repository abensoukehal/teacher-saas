/**
 * be-4 — POST /api/subjects/:id/exercises/:exerciseId/regenerate.
 *
 * The teacher-facing half of be-3. Two rules decide everything here, and they pull in
 * opposite directions on purpose:
 *
 *  - **A placeholder is not work.** Regenerating a `failed` or `pending` slot writes NO
 *    revision — its statement is `""` (contract §5.4).
 *  - **A ready exercise IS work.** Regenerating one DOES write a revision, because that is
 *    a supersession of something the teacher could see and use.
 *
 * And the corollary this suite adds: a regeneration that FAILS must not destroy the
 * exercise the teacher already had. "Everything generated is worth keeping" cannot survive
 * a refresh that blanks a good exercise on a bad draw.
 *
 * NEVER CALLS A REAL GENERATION — recordings from SEED §9.2, replayed.
 */
const { ObjectId, MongoClient } = require("mongodb");
const { startReplayServer, client } = require("./replay-harness");

const MONGO = process.env.CHAR_MONGO_URL || "mongodb://127.0.0.1:27017";
const DB = "teacher_saas";

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

jest.setTimeout(180_000);

let server;
let call;
let mongo;
let db;
let teacher;
let other;
const CREATED = [];
const TEACHERS = [];

const READY_EX1 = () => ({
  id: "ex1",
  label: "التمرين الأول",
  points: 5,
  difficulty: "سهل",
  topics: ["النهايات"],
  statement: "$\\lim\\limits_{x \\to 2} f(x)$",
  status: "ready",
});
const FAILED_EX2 = () => ({
  id: "ex2",
  label: "التمرين الثاني",
  points: 7,
  difficulty: "متوسط",
  topics: ["الاشتقاق"],
  statement: "",
  status: "failed",
});
const READY_EX3 = () => ({
  id: "ex3",
  label: "التمرين الثالث",
  points: 8,
  difficulty: "صعب",
  topics: ["دراسة دالة"],
  statement: "$g(x)=x^{3}$",
  status: "ready",
});

/** A subject planted in the shape the fan-out leaves behind. */
async function plant(owner, exercises) {
  const now = new Date();
  const res = await db.collection("subjects").insertOne({
    teacherId: owner,
    subject: {
      title: "اختبار في مادة الرياضيات",
      meta: { totalPoints: 20, topic: "الدوال العددية والنهايات", stream: "علوم تجريبية", level: "3AS" },
      exercises,
    },
    controls: null,
    genCorrelationId: null,
    createdAt: now,
    updatedAt: now,
  });
  CREATED.push(res.insertedId);
  return res.insertedId.toHexString();
}

const revisionsOf = (subjectId, exerciseId) =>
  db
    .collection("exercise_revisions")
    .countDocuments({ subjectId: new ObjectId(subjectId), exerciseId });

beforeAll(async () => {
  server = await startReplayServer({ delayMs: 400 });
  call = client(server.url);
  mongo = await new MongoClient(MONGO).connect();
  db = mongo.db(DB);
  const a = await call("POST", "/api/teacher");
  const b = await call("POST", "/api/teacher");
  teacher = a.body.teacherId;
  other = b.body.teacherId;
  TEACHERS.push(teacher, other);
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

describe("be-4 — regenerating a failed exercise", () => {
  let id;
  let body;

  beforeAll(async () => {
    id = await plant(teacher, [READY_EX1(), FAILED_EX2(), READY_EX3()]);
    const res = await call("POST", `/api/subjects/${id}/exercises/ex2/regenerate`, { teacher });
    expect(res.status).toBe(200);
    body = res.body;
  });

  test("the same slot is filled, in place and in order", () => {
    expect(body.subject.exercises.map((e) => e.id)).toEqual(["ex1", "ex2", "ex3"]);
    const ex2 = body.subject.exercises[1];
    expect(ex2.status).toBe("ready");
    expect(ex2.statement.trim().length).toBeGreaterThan(0);
  });

  test("id, label and points are the assignment's, not the generator's", () => {
    // Verify, don't trust — the same rule the fan-out applies. A regenerate is another
    // attempt at the exercise the plan already fixed, not a new exercise.
    const ex2 = body.subject.exercises[1];
    expect(ex2.id).toBe("ex2");
    expect(ex2.label).toBe("التمرين الثاني");
    expect(ex2.points).toBe(7);
  });

  test("the exam still sums to 20 and its other exercises are untouched", () => {
    expect(body.subject.exercises.reduce((n, e) => n + e.points, 0)).toBe(20);
    expect(body.subject.exercises[0].statement).toBe(READY_EX1().statement);
    expect(body.subject.exercises[2].statement).toBe(READY_EX3().statement);
  });

  test("it writes NO revision — a placeholder is not superseded work", async () => {
    // Contract §5.4. The outgoing statement was "", and a history that can restore a blank
    // exercise onto a printed sheet is worse than no history.
    expect(await revisionsOf(id, "ex2")).toBe(0);
  });
});

describe("be-4 — regenerating a ready exercise", () => {
  let id;
  let body;

  beforeAll(async () => {
    id = await plant(teacher, [READY_EX1(), FAILED_EX2(), READY_EX3()]);
    const res = await call("POST", `/api/subjects/${id}/exercises/ex1/regenerate`, { teacher });
    expect(res.status).toBe(200);
    body = res.body;
  });

  test("it DOES write a revision — that one is a supersession", async () => {
    // The deliberate contrast with the clause above. The teacher could see and use the old
    // ex1, so it goes into history and stays restorable.
    expect(await revisionsOf(id, "ex1")).toBe(1);
    const { body: hist } = await call(
      "GET",
      `/api/subjects/${id}/exercises/ex1/revisions`,
      { teacher },
    );
    expect(hist.revisions).toHaveLength(1);
    expect(hist.revisions[0].exercise.statement).toBe(READY_EX1().statement);
  });

  test("the slot is refreshed, keeping id, label and points", () => {
    const ex1 = body.subject.exercises[0];
    expect(ex1.id).toBe("ex1");
    expect(ex1.label).toBe("التمرين الأول");
    expect(ex1.points).toBe(5);
    expect(ex1.statement).not.toBe(READY_EX1().statement);
    expect(ex1.status).toBe("ready");
  });
});

describe("be-4 — a failed regeneration never destroys a ready exercise", () => {
  let rogue;
  let rogueCall;
  let id;
  let res;

  beforeAll(async () => {
    // ex2 comes back with 8 points where the stored exercise says 7 — refused every time,
    // and the CLI reports every one of those runs as a success.
    rogue = await startReplayServer({ mode: "bad-echo-ex2", delayMs: 150 });
    rogueCall = client(rogue.url);
    const { body: minted } = await rogueCall("POST", "/api/teacher");
    TEACHERS.push(minted.teacherId);
    id = await plant(minted.teacherId, [
      READY_EX1(),
      { ...FAILED_EX2(), statement: "$h(x)=e^{x}$", status: "ready" },
      READY_EX3(),
    ]);
    res = await rogueCall("POST", `/api/subjects/${id}/exercises/ex2/regenerate`, {
      teacher: minted.teacherId,
    });
  });

  afterAll(async () => {
    if (rogue) await rogue.stop();
  });

  test("it is an error, not a quietly unchanged 200", () => {
    // The teacher asked for something and it did not happen. A 200 with the same exercise
    // back is the product pretending it did the work.
    expect(res.status).toBe(502);
    expect(res.body.error.type).toBe("claude_bad_output");
    expect(typeof res.body.correlationId).toBe("string");
  });

  test("the exercise the teacher already had is still there", async () => {
    // THE CLAUSE THAT MATTERS. Marking it `failed` here would blank real, usable work
    // because one draw went wrong — recoverable only if the teacher noticed and knew to
    // look in the revision history.
    const doc = await db.collection("subjects").findOne({ _id: new ObjectId(id) });
    const ex2 = doc.subject.exercises[1];
    expect(ex2.status).toBe("ready");
    expect(ex2.statement).toBe("$h(x)=e^{x}$");
    expect(ex2.points).toBe(7);
  });

  test("and nothing was written to history either", async () => {
    expect(await revisionsOf(id, "ex2")).toBe(0);
  });
});

describe("be-4 — the negative surface", () => {
  let id;

  beforeAll(async () => {
    id = await plant(teacher, [READY_EX1(), FAILED_EX2(), READY_EX3()]);
  });

  test("an unknown exerciseId, another teacher's subject and a ghost id are the SAME 404", async () => {
    // Existence is not probeable. From outside, "no such exercise" and "not yours" are one
    // fact: there is nothing here for you.
    const unknown = await call("POST", `/api/subjects/${id}/exercises/ex9/regenerate`, { teacher });
    const notMine = await call("POST", `/api/subjects/${id}/exercises/ex1/regenerate`, {
      teacher: other,
    });
    const ghost = await call(
      "POST",
      `/api/subjects/${new ObjectId().toHexString()}/exercises/ex1/regenerate`,
      { teacher: other },
    );
    expect([unknown.status, notMine.status, ghost.status]).toEqual([404, 404, 404]);
    expect(unknown.body.error).toEqual(notMine.body.error);
    expect(notMine.body.error).toEqual(ghost.body.error);
  });

  test("another teacher's regenerate changed nothing", async () => {
    const doc = await db.collection("subjects").findOne({ _id: new ObjectId(id) });
    expect(doc.subject.exercises[0].statement).toBe(READY_EX1().statement);
    expect(doc.rev).toBeUndefined();
  });

  test("no x-teacher-id is 401 teacher_required", async () => {
    const { status, body } = await call("POST", `/api/subjects/${id}/exercises/ex1/regenerate`);
    expect(status).toBe(401);
    expect(body.error.type).toBe("teacher_required");
  });

  test("a malformed subject id is the same 404, not a 500", async () => {
    const { status, body } = await call("POST", "/api/subjects/not-an-id/exercises/ex1/regenerate", {
      teacher,
    });
    expect(status).toBe(404);
    expect(body.error.type).toBe("subject_not_found");
  });
});

describe("be-4 — two concurrent regenerates of the same exercise", () => {
  test("one wins, the other is 409 conflict", async () => {
    // Without the guard the compare-and-set would let BOTH land, one immediately
    // superseding the other: two full agent loops, ~2 minutes, and a result the teacher
    // never sees. Refusing the second before it spawns is cheaper and more truthful.
    const id = await plant(teacher, [READY_EX1(), FAILED_EX2(), READY_EX3()]);
    const [a, b] = await Promise.all([
      call("POST", `/api/subjects/${id}/exercises/ex1/regenerate`, { teacher }),
      call("POST", `/api/subjects/${id}/exercises/ex1/regenerate`, { teacher }),
    ]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([200, 409]);

    const loser = a.status === 409 ? a : b;
    expect(loser.body.error.type).toBe("conflict");
    // Arabic, like every other teacher-facing message in this service.
    expect(loser.body.error.message).toMatch(/[؀-ۿ]/);

    // Exactly one supersession — the losing request never generated anything.
    expect(await revisionsOf(id, "ex1")).toBe(1);
    const doc = await db.collection("subjects").findOne({ _id: new ObjectId(id) });
    expect(doc.rev).toBe(1);
  });

  test("a different exercise in the same exam is NOT blocked", async () => {
    // The guard is per exercise, not per exam — a teacher fixing two exercises at once is
    // ordinary use, not a conflict.
    const id = await plant(teacher, [READY_EX1(), FAILED_EX2(), READY_EX3()]);
    const [a, b] = await Promise.all([
      call("POST", `/api/subjects/${id}/exercises/ex1/regenerate`, { teacher }),
      call("POST", `/api/subjects/${id}/exercises/ex3/regenerate`, { teacher }),
    ]);
    expect([a.status, b.status]).toEqual([200, 200]);
    const doc = await db.collection("subjects").findOne({ _id: new ObjectId(id) });
    expect(doc.rev).toBe(2);
    expect(doc.subject.exercises.reduce((n, e) => n + e.points, 0)).toBe(20);
  });

  test("the guard releases — a second regenerate afterwards still works", async () => {
    // A guard that leaks its key locks the exercise until the process restarts, which
    // would look exactly like a product that randomly stops working.
    const id = await plant(teacher, [READY_EX1(), FAILED_EX2(), READY_EX3()]);
    const first = await call("POST", `/api/subjects/${id}/exercises/ex1/regenerate`, { teacher });
    const second = await call("POST", `/api/subjects/${id}/exercises/ex1/regenerate`, { teacher });
    expect([first.status, second.status]).toEqual([200, 200]);
    expect(await revisionsOf(id, "ex1")).toBe(2);
  });
});

describe("be-4 — ONE writer per slot, fan-out included (review finding 1)", () => {
  /**
   * The regenerate guard used to live in the route and cover only regenerates. The fan-out
   * writes the same slots and was not in it, so a regenerate against a slot the fan-out was
   * still filling was accepted: two spawns for one exercise, two writers racing the CAS, a
   * phantom `exercise_revisions` row archiving a placeholder-shaped pre-image no teacher
   * ever saw, and non-deterministic final content.
   *
   * That `fe` hides the control while a slot is pending made it unreachable from the UI —
   * a coincidence of today's rendering, not an invariant of this service.
   */
  let ctx;
  let owner;
  let subjectId;

  beforeAll(async () => {
    // Slow enough that the fan-out is demonstrably mid-flight when the regenerate arrives.
    ctx = await startReplayServer({ delayMs: 1500 });
    const c = client(ctx.url);
    const { body: minted } = await c("POST", "/api/teacher");
    owner = minted.teacherId;
    TEACHERS.push(owner);
    const created = await c("POST", "/api/exams", { body: CONTROLS, teacher: owner });
    subjectId = created.body.subjectId;
    CREATED.push(new ObjectId(subjectId));
    ctx.call = c;
  });

  afterAll(async () => {
    if (ctx) await ctx.stop();
  });

  test("a regenerate against a slot the fan-out is filling is refused 409", async () => {
    const pending = await ctx.call("GET", `/api/subjects/${subjectId}`, { teacher: owner });
    expect(pending.body.subject.exercises.every((e) => e.status === "pending")).toBe(true);

    const res = await ctx.call("POST", `/api/subjects/${subjectId}/exercises/ex1/regenerate`, {
      teacher: owner,
    });
    expect(res.status).toBe(409);
    expect(res.body.error.type).toBe("conflict");
  });

  test("no phantom revision row, and exactly one spawn per exercise", async () => {
    // Wait for the fan-out to finish, then check what the double writer would have left.
    const until = Date.now() + 45_000;
    for (;;) {
      const got = await ctx.call("GET", `/api/subjects/${subjectId}`, { teacher: owner });
      if (got.body.subject.exercises.every((e) => e.status !== "pending")) break;
      if (Date.now() > until) throw new Error("fan-out never settled");
      await new Promise((r) => setTimeout(r, 150));
    }
    // The phantom row is the tell: a second writer archives the placeholder the first one
    // just wrote, putting an exercise no teacher ever saw into history.
    expect(await revisionsOf(subjectId, "ex1")).toBe(0);
    // And the refused regenerate never spawned — the guard is checked before the CLI.
    expect(ctx.attempts("ex1")).toBe(1);

    const doc = await db.collection("subjects").findOne({ _id: new ObjectId(subjectId) });
    expect(doc.rev).toBe(3); // one fill per slot, not four
    expect(doc.subject.exercises.map((e) => e.status)).toEqual(["ready", "ready", "ready"]);
  });

  test("once the fan-out has released it, the same slot regenerates normally", async () => {
    // The claim must be scoped to the write, not to the exam's lifetime.
    const res = await ctx.call("POST", `/api/subjects/${subjectId}/exercises/ex1/regenerate`, {
      teacher: owner,
    });
    expect(res.status).toBe(200);
    expect(res.body.subject.exercises[0].status).toBe("ready");
    expect(await revisionsOf(subjectId, "ex1")).toBe(1); // NOW it is a real supersession
  });
});

describe("be-4 — a pending slot with NO live writer is regenerable (review finding 2)", () => {
  /**
   * The "pending-and-abandoned" recovery contract §2 promises. A `be` restart mid-fan-out
   * leaves the exam saying «جارٍ كتابة هذا التمرين…» forever with nothing in flight, and
   * be-2 recorded "be-4 is the recovery" — which only becomes true once the guard can tell
   * "someone is writing this" from "nobody is". Finding 1 is what makes that distinction
   * exist, which is why it had to land first.
   */
  test("an orphaned pending slot repairs, and writes no revision", async () => {
    // Planted exactly as a restart leaves it: pending, empty statement, no writer.
    const id = await plant(teacher, [
      READY_EX1(),
      { ...FAILED_EX2(), status: "pending" },
      READY_EX3(),
    ]);
    const { status, body } = await call("POST", `/api/subjects/${id}/exercises/ex2/regenerate`, {
      teacher,
    });
    expect(status).toBe(200);
    const ex2 = body.subject.exercises[1];
    expect(ex2.status).toBe("ready");
    expect(ex2.statement.trim().length).toBeGreaterThan(0);
    expect(ex2.points).toBe(7);
    expect(body.subject.exercises.reduce((n, e) => n + e.points, 0)).toBe(20);
    // Still a placeholder that was replaced — no revision.
    expect(await revisionsOf(id, "ex2")).toBe(0);
  });
});

describe("be-4 — the whole journey: a hole in a fanned-out exam, then regenerated", () => {
  let journey;
  let journeyCall;
  let subjectId;
  let owner;

  beforeAll(async () => {
    // ex1 truncates on both fan-out attempts, so the exam lands with a real hole; the
    // regenerate is the third attempt and succeeds.
    journey = await startReplayServer({ mode: "trunc-ex1-first2", delayMs: 150 });
    journeyCall = client(journey.url);
    const { body: minted } = await journeyCall("POST", "/api/teacher");
    owner = minted.teacherId;
    TEACHERS.push(owner);

    const created = await journeyCall("POST", "/api/exams", { body: CONTROLS, teacher: owner });
    subjectId = created.body.subjectId;
    CREATED.push(new ObjectId(subjectId));

    const until = Date.now() + 45_000;
    for (;;) {
      const got = await journeyCall("GET", `/api/subjects/${subjectId}`, { teacher: owner });
      if (got.body.subject.exercises.every((e) => e.status !== "pending")) break;
      if (Date.now() > until) throw new Error("fan-out never settled");
      await new Promise((r) => setTimeout(r, 150));
    }
  });

  afterAll(async () => {
    if (journey) await journey.stop();
  });

  test("the exam arrives with one failed exercise and two usable ones", async () => {
    const { body } = await journeyCall("GET", `/api/subjects/${subjectId}`, { teacher: owner });
    expect(body.subject.exercises.map((e) => e.status)).toEqual(["failed", "ready", "ready"]);
  });

  test("regenerating the hole repairs it, and still writes no revision", async () => {
    const { status, body } = await journeyCall(
      "POST",
      `/api/subjects/${subjectId}/exercises/ex1/regenerate`,
      { teacher: owner },
    );
    expect(status).toBe(200);
    expect(body.subject.exercises.map((e) => e.status)).toEqual(["ready", "ready", "ready"]);
    expect(body.subject.exercises[0].points).toBe(5);
    expect(body.subject.exercises.reduce((n, e) => n + e.points, 0)).toBe(20);
    // The slot it replaced was a `failed` placeholder with an empty statement.
    expect(await revisionsOf(subjectId, "ex1")).toBe(0);
  });

  test("it took exactly one more attempt than the fan-out already spent", () => {
    expect(journey.attempts("ex1")).toBe(3);
  });
});
