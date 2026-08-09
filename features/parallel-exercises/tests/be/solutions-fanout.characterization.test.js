/**
 * be-6 — corrections fan out per exercise, and cannot be started twice.
 *
 * TWO DEFECTS, both filed by QA on the solutions surface.
 *
 * **Bug A — SEED §5 criterion 3 was never built.** "Corrections stream per exercise the
 * same way" was dropped between the SEED and the contract, which never named a transport.
 * QA measured the result: one monolithic `solution-sheet` run, `solutions: []` on every
 * poll for 230 s, then all three at once — the same defect the exam had before this job,
 * still sitting on the correction path.
 *
 * **Bug B — no in-flight guard.** The same exam in two tabs gave two enabled buttons and
 * two full runs; QA drove `claude.active` 1→2 with 206 s and 233 s runs both completing.
 * Refine had its 409 and regenerate had the `writing` registry; solutions had neither.
 *
 * AND ONE HAZARD THIS JOB ITSELF CREATED: an exam can now legitimately carry a `pending`
 * or `failed` exercise whose statement is `""`. Sending one for correction spends ~145 s
 * writing a worked answer to nothing, then stores it as that exercise's CURRENT correction.
 *
 * NEVER CALLS A REAL GENERATION. Corrections replay `rec-solution-sheet.2026-08-08.json`,
 * a real recorded correction. NOTHING HERE ASSERTS TOTAL GENERATION TIME (SEED §10.2) —
 * the fan-out is not faster, it arrives sooner and fails smaller.
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

/** The replayed plan: 5 + 7 + 8 = 20. */
const PLAN_POINTS = { ex1: 5, ex2: 7, ex3: 8 };

jest.setTimeout(240_000);

let mongo;
let db;
const CREATED = [];
const TEACHERS = [];

async function newTeacher(call) {
  const { body } = await call("POST", "/api/teacher");
  TEACHERS.push(body.teacherId);
  return body.teacherId;
}

/** A settled fanned-out exam, ready to be corrected. */
async function settledExam(call, teacher) {
  const created = await call("POST", "/api/exams", { body: CONTROLS, teacher });
  const subjectId = created.body.subjectId;
  CREATED.push(new ObjectId(subjectId));
  const until = Date.now() + 60_000;
  for (;;) {
    const got = await call("GET", `/api/subjects/${subjectId}`, { teacher });
    if (got.body.subject.exercises.every((e) => e.status !== "pending")) return subjectId;
    if (Date.now() > until) throw new Error("fan-out never settled");
    await new Promise((r) => setTimeout(r, 120));
  }
}

const solutionsOf = (call, subjectId, teacher) =>
  call("GET", `/api/subjects/${subjectId}/solutions`, { teacher });

async function waitForSolutions(call, subjectId, teacher, n, timeoutMs = 90_000) {
  const until = Date.now() + timeoutMs;
  for (;;) {
    const { body } = await solutionsOf(call, subjectId, teacher);
    if (body.solutions.length >= n) return body.solutions;
    if (Date.now() > until) {
      throw new Error(`only ${body.solutions.length} of ${n} corrections landed`);
    }
    await new Promise((r) => setTimeout(r, 150));
  }
}

/**
 * The attempt tally is per (skill, exerciseId) for the whole SERVER, not per exam.
 *
 * Two exams on one instance share `solution-one-ex1`, so every spawn assertion has to be a
 * DELTA against a baseline taken immediately before the action. Asserting absolutes read
 * clean and were wrong: they silently counted a sibling test's runs.
 */
const attemptsOf = (server, ids, skill = "solution-one") =>
  Object.fromEntries(ids.map((id) => [id, server.attempts(id, skill)]));

/**
 * Wait for SPAWNS, not for rows.
 *
 * `waitForSolutions` returns instantly when the corrections are already stored from an
 * earlier run, so a re-run's assertions fired before its loops had even started — and the
 * next test then collided with a run still in flight.
 */
async function waitForAttempts(server, ids, target, skill = "solution-one", timeoutMs = 60_000) {
  const until = Date.now() + timeoutMs;
  for (;;) {
    if (ids.every((id) => server.attempts(id, skill) >= target)) return;
    if (Date.now() > until) {
      throw new Error(`attempts stalled at ${JSON.stringify(attemptsOf(server, ids, skill))}`);
    }
    await new Promise((r) => setTimeout(r, 150));
  }
}

/** Plant a subject directly — the only way to get an exact mix of statuses. */
async function plant(owner, exercises) {
  const now = new Date();
  const res = await db.collection("subjects").insertOne({
    teacherId: owner,
    subject: {
      title: "اختبار في مادة الرياضيات",
      meta: { totalPoints: 20, topic: "الدوال", stream: "علوم تجريبية", level: "3AS" },
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

beforeAll(async () => {
  mongo = await new MongoClient(MONGO).connect();
  db = mongo.db(DB);
});

afterAll(async () => {
  if (db) {
    if (CREATED.length > 0) {
      await db.collection("subjects").deleteMany({ _id: { $in: CREATED } });
      await db.collection("solutions").deleteMany({ subjectId: { $in: CREATED } });
      await db.collection("exercise_revisions").deleteMany({ subjectId: { $in: CREATED } });
    }
    if (TEACHERS.length > 0) {
      await db.collection("teachers").deleteMany({ teacherId: { $in: TEACHERS } });
    }
  }
  if (mongo) await mongo.close();
});

describe("be-6 — corrections arrive per exercise (bug A)", () => {
  let server;
  let call;
  let teacher;
  let subjectId;
  let started;

  beforeAll(async () => {
    // `stagger` makes exN take N times as long, so the corrections land one at a time.
    server = await startReplayServer({ mode: "stagger", delayMs: 900 });
    call = client(server.url);
    teacher = await newTeacher(call);
    subjectId = await settledExam(call, teacher);
    started = await call("POST", `/api/subjects/${subjectId}/solutions/generate`, { teacher });
  });

  afterAll(async () => {
    if (server) await server.stop();
  });

  test("the request is accepted immediately, naming what it will correct", () => {
    // 202: the work outlives the response. QA's poll saw `[]` for 230 s because the old
    // path did everything inside one request and answered at the end.
    expect(started.status).toBe(202);
    expect(started.body.exerciseIds).toEqual(["ex1", "ex2", "ex3"]);
    expect(started.body.skipped).toEqual([]);
    expect(typeof started.body.correlationId).toBe("string");
  });

  test("ONE correction is readable while the others are still generating", async () => {
    // THE CRITERION, and exactly what QA measured absent. Before the first correction has
    // landed the list is empty; after it lands the sheet is partial — not empty, not whole.
    const first = await waitForSolutions(call, subjectId, teacher, 1, 60_000);
    expect(first.length).toBeGreaterThanOrEqual(1);
    expect(first.length).toBeLessThan(3);
    expect(first[0].exerciseId).toBe("ex1");
    expect(first[0].answer.trim().length).toBeGreaterThan(0);
  });

  test("the rest follow, and the sheet ends complete and in exam order", async () => {
    const all = await waitForSolutions(call, subjectId, teacher, 3);
    expect(all.map((s) => s.exerciseId)).toEqual(["ex1", "ex2", "ex3"]);
    for (const s of all) expect(s.stale).toBe(false);
  });

  test("each scale still sums EXACTLY to that exercise's points", async () => {
    // The invariant that had to survive the split. A mis-scaled correction is graded
    // against thirty papers before anyone notices.
    const all = await waitForSolutions(call, subjectId, teacher, 3);
    for (const s of all) {
      const total = s.scale.reduce((n, p) => n + p.points, 0);
      expect(Math.abs(total - PLAN_POINTS[s.exerciseId])).toBeLessThan(1e-9);
      for (const p of s.scale) {
        expect(p.points).toBeGreaterThan(0);
        expect(p.part.trim()).not.toBe("");
      }
    }
  });

  test("one correction per exercise — the unique index is intact", async () => {
    const rows = await db
      .collection("solutions")
      .countDocuments({ subjectId: new ObjectId(subjectId) });
    expect(rows).toBe(3);
  });

  test("each exercise got exactly one run", () => {
    for (const id of ["ex1", "ex2", "ex3"]) {
      expect(server.attempts(id, "solution-one")).toBe(1);
    }
  });
});

describe("be-6 — a correction run cannot be started twice (bug B)", () => {
  let server;
  let call;
  let teacher;
  let subjectId;

  beforeAll(async () => {
    server = await startReplayServer({ delayMs: 1200 });
    call = client(server.url);
    teacher = await newTeacher(call);
    subjectId = await settledExam(call, teacher);
  });

  afterAll(async () => {
    if (server) await server.stop();
  });

  test("the second tab is refused 409 without spawning anything", async () => {
    const first = await call("POST", `/api/subjects/${subjectId}/solutions/generate`, { teacher });
    expect(first.status).toBe(202);

    const second = await call("POST", `/api/subjects/${subjectId}/solutions/generate`, { teacher });
    expect(second.status).toBe(409);
    expect(second.body.error.type).toBe("conflict");
    expect(second.body.error.message).toMatch(/[؀-ۿ]/);

    // Bug B's actual cost was quota, so the clause is about loops, not status codes.
    await waitForSolutions(call, subjectId, teacher, 3);
    await waitForAttempts(server, ["ex1", "ex2", "ex3"], 1);
    // ONE spawn per exercise for the two requests combined — the refused tab spawned nothing.
    expect(attemptsOf(server, ["ex1", "ex2", "ex3"])).toEqual({ ex1: 1, ex2: 1, ex3: 1 });
    const rows = await db
      .collection("solutions")
      .countDocuments({ subjectId: new ObjectId(subjectId) });
    expect(rows).toBe(3);
  });

  test("the claim is released — the sheet can be regenerated afterwards", async () => {
    // A guard that leaks its key makes corrections permanently unrepeatable, which looks
    // exactly like a product that randomly stops working.
    const before = attemptsOf(server, ["ex1", "ex2", "ex3"]);
    const again = await call("POST", `/api/subjects/${subjectId}/solutions/generate`, { teacher });
    expect(again.status).toBe(202);
    // Wait for the RE-RUN's spawns. The rows are already there from the first run, so
    // waiting on them would return instantly and assert before anything had started.
    await waitForAttempts(server, ["ex1", "ex2", "ex3"], before.ex1 + 1);
    const after = attemptsOf(server, ["ex1", "ex2", "ex3"]);
    for (const id of ["ex1", "ex2", "ex3"]) {
      expect(after[id] - before[id]).toBe(1);
    }
    // Still one row each — the upsert, not a second set.
    const rows = await db
      .collection("solutions")
      .countDocuments({ subjectId: new ObjectId(subjectId) });
    expect(rows).toBe(3);
  });

  test("a DIFFERENT exam is not blocked by the first one's run", async () => {
    // The guard is per exam. Two teachers, or one teacher with two exams, are ordinary use.
    const other = await settledExam(call, teacher);
    const a = await call("POST", `/api/subjects/${subjectId}/solutions/generate`, { teacher });
    const b = await call("POST", `/api/subjects/${other}/solutions/generate`, { teacher });
    expect([a.status, b.status]).toEqual([202, 202]);
    await waitForSolutions(call, other, teacher, 3);
  });
});

describe("be-6 — a blank or failed exercise is NEVER sent for correction", () => {
  let server;
  let call;
  let teacher;

  beforeAll(async () => {
    server = await startReplayServer({ delayMs: 150 });
    call = client(server.url);
    teacher = await newTeacher(call);
  });

  afterAll(async () => {
    if (server) await server.stop();
  });

  test("a failed and a pending slot are skipped, and the ready ones are corrected", async () => {
    // THE HAZARD THIS JOB CREATED. ~145 s and a full agent loop writing a worked answer to
    // an empty statement — then stored as that exercise's CURRENT correction, so the
    // teacher is handed a confident answer to a question that does not exist.
    const id = await plant(teacher, [
      { id: "ex1", label: "التمرين الأول", points: 5, statement: "$f(x)=x^{2}$", status: "ready" },
      { id: "ex2", label: "التمرين الثاني", points: 7, statement: "", status: "failed" },
      { id: "ex3", label: "التمرين الثالث", points: 8, statement: "", status: "pending" },
    ]);
    const baseline = attemptsOf(server, ["ex1", "ex2", "ex3"]);
    const { status, body } = await call("POST", `/api/subjects/${id}/solutions/generate`, {
      teacher,
    });
    expect(status).toBe(202);
    expect(body.exerciseIds).toEqual(["ex1"]);
    expect(body.skipped).toEqual(["ex2", "ex3"]);

    await waitForSolutions(call, id, teacher, 1);
    // Not one spawn for either empty slot.
    const after = attemptsOf(server, ["ex1", "ex2", "ex3"]);
    expect(after.ex2 - baseline.ex2).toBe(0);
    expect(after.ex3 - baseline.ex3).toBe(0);
    expect(after.ex1 - baseline.ex1).toBe(1);
    const rows = await db.collection("solutions").find({ subjectId: new ObjectId(id) }).toArray();
    expect(rows.map((r) => r.exerciseId)).toEqual(["ex1"]);
  });

  test("a legacy exercise with no status but an empty statement is skipped too", async () => {
    // Absent status reads `ready` by the allow-list, so `status` alone is not the signal —
    // the statement is. Both facts are checked.
    const id = await plant(teacher, [
      { id: "ex1", label: "التمرين الأول", points: 12, statement: "   " },
      { id: "ex2", label: "التمرين الثاني", points: 8, statement: "$g(x)=\\ln x$" },
    ]);
    const before = attemptsOf(server, ["ex1", "ex2"]);
    const { body } = await call("POST", `/api/subjects/${id}/solutions/generate`, { teacher });
    expect(body.exerciseIds).toEqual(["ex2"]);
    expect(body.skipped).toEqual(["ex1"]);
    await waitForSolutions(call, id, teacher, 1);
    const after = attemptsOf(server, ["ex1", "ex2"]);
    // NOT ONE spawn for the blank slot — a delta, since a sibling test corrected an ex1
    // of a different exam on this same instance.
    expect(after.ex1 - before.ex1).toBe(0);
    expect(after.ex2 - before.ex2).toBe(1);
  });

  test("an exam with nothing correctable is 400, not a spawn", async () => {
    const id = await plant(teacher, [
      { id: "ex1", label: "التمرين الأول", points: 12, statement: "", status: "failed" },
      { id: "ex2", label: "التمرين الثاني", points: 8, statement: "", status: "pending" },
    ]);
    const { status, body } = await call("POST", `/api/subjects/${id}/solutions/generate`, {
      teacher,
    });
    expect(status).toBe(400);
    expect(body.error.type).toBe("invalid_request");
    expect(body.error.message).toMatch(/[؀-ۿ]/);
  });
});

describe("be-6 — a bad correction is refused, and costs only itself", () => {
  test("a scale that does not sum to the points is never stored", async () => {
    // The CLI reports such a run as a success — there is no exit code and no exception. If
    // `be` trusted it, a teacher would mark thirty papers against a scale worth 8 on a
    // 7-point exercise.
    const server = await startReplayServer({ mode: "sol-bad-scale-ex2", delayMs: 150 });
    const call = client(server.url);
    try {
      const teacher = await newTeacher(call);
      const subjectId = await settledExam(call, teacher);
      await call("POST", `/api/subjects/${subjectId}/solutions/generate`, { teacher });

      const two = await waitForSolutions(call, subjectId, teacher, 2);
      // ex1 and ex3 are unaffected — one bad correction costs one correction.
      expect(two.map((s) => s.exerciseId).sort()).toEqual(["ex1", "ex3"]);
      for (const s of two) {
        expect(Math.abs(s.scale.reduce((n, p) => n + p.points, 0) - PLAN_POINTS[s.exerciseId]))
          .toBeLessThan(1e-9);
      }
      // Nothing at all is stored for ex2 — absent is honest, a wrong scale is not.
      const rows = await db
        .collection("solutions")
        .find({ subjectId: new ObjectId(subjectId) })
        .toArray();
      expect(rows.map((r) => r.exerciseId).sort()).toEqual(["ex1", "ex3"]);
      // It was retried before being given up on, and the retry is bounded.
      expect(server.attempts("ex2", "solution-one")).toBe(2);
    } finally {
      await server.stop();
    }
  });

  test("a malformed correction is never stored either", async () => {
    const server = await startReplayServer({ mode: "sol-malformed-ex1", delayMs: 150 });
    const call = client(server.url);
    try {
      const teacher = await newTeacher(call);
      const subjectId = await settledExam(call, teacher);
      await call("POST", `/api/subjects/${subjectId}/solutions/generate`, { teacher });
      const two = await waitForSolutions(call, subjectId, teacher, 2);
      expect(two.map((s) => s.exerciseId).sort()).toEqual(["ex2", "ex3"]);
      expect(server.attempts("ex1", "solution-one")).toBe(2);
    } finally {
      await server.stop();
    }
  });
});

describe("be-6 — staleness still derives per exercise", () => {
  let server;
  let call;
  let teacher;
  let subjectId;

  beforeAll(async () => {
    server = await startReplayServer({ delayMs: 150 });
    call = client(server.url);
    teacher = await newTeacher(call);
    subjectId = await settledExam(call, teacher);
    await call("POST", `/api/subjects/${subjectId}/solutions/generate`, { teacher });
    await waitForSolutions(call, subjectId, teacher, 3);
  });

  afterAll(async () => {
    if (server) await server.stop();
  });

  test("refining ONE exercise marks only that correction stale", async () => {
    // The whole reason `answersHash` is per-exercise and not the subject's `rev`: `rev`
    // advances for the whole document, so one refine would mark every correction stale.
    const before = (await solutionsOf(call, subjectId, teacher)).body.solutions;
    expect(before.every((s) => s.stale === false)).toBe(true);

    const subject = (await call("GET", `/api/subjects/${subjectId}`, { teacher })).body.subject;
    const ex2 = subject.exercises[1];
    const put = await call("PUT", `/api/subjects/${subjectId}/exercises/ex2`, {
      body: { exercise: { ...ex2, statement: `${ex2.statement}\n\nسؤال إضافي.` } },
      teacher,
    });
    expect(put.status).toBe(200);

    const after = (await solutionsOf(call, subjectId, teacher)).body.solutions;
    const byId = new Map(after.map((s) => [s.exerciseId, s]));
    expect(byId.get("ex2").stale).toBe(true);
    expect(byId.get("ex1").stale).toBe(false);
    expect(byId.get("ex3").stale).toBe(false);
  });

  test("restoring the statement heals its correction", async () => {
    // Staleness is DERIVED on read, never stored — which is what makes this true. A stored
    // flag would leave a lie behind after a restore.
    const subject = (await call("GET", `/api/subjects/${subjectId}`, { teacher })).body.subject;
    const ex2 = subject.exercises[1];
    const restored = ex2.statement.replace(/\n\nسؤال إضافي\.$/, "");
    await call("PUT", `/api/subjects/${subjectId}/exercises/ex2`, {
      body: { exercise: { ...ex2, statement: restored } },
      teacher,
    });
    const after = (await solutionsOf(call, subjectId, teacher)).body.solutions;
    expect(after.every((s) => s.stale === false)).toBe(true);
  });
});

describe("be-6 — the negative surface", () => {
  let server;
  let call;

  beforeAll(async () => {
    server = await startReplayServer({ delayMs: 120 });
    call = client(server.url);
  });

  afterAll(async () => {
    if (server) await server.stop();
  });

  test("another teacher and a ghost id get the identical 404", async () => {
    const owner = await newTeacher(call);
    const other = await newTeacher(call);
    const id = await plant(owner, [
      { id: "ex1", label: "التمرين الأول", points: 20, statement: "$f(x)=x$", status: "ready" },
    ]);
    const notMine = await call("POST", `/api/subjects/${id}/solutions/generate`, { teacher: other });
    const ghost = await call(
      "POST",
      `/api/subjects/${new ObjectId().toHexString()}/solutions/generate`,
      { teacher: other },
    );
    expect([notMine.status, ghost.status]).toEqual([404, 404]);
    expect(notMine.body.error).toEqual(ghost.body.error);
  });

  test("no x-teacher-id is 401 teacher_required", async () => {
    const { status, body } = await call(
      "POST",
      `/api/subjects/${new ObjectId().toHexString()}/solutions/generate`,
    );
    expect(status).toBe(401);
    expect(body.error.type).toBe("teacher_required");
  });

  test("solution-one is in the catalogue, and solution-sheet is still there", async () => {
    const { body } = await call("GET", "/api/skills");
    const names = body.skills.map((s) => s.name);
    expect(names).toContain("solution-one");
    // FROZEN: solution-sheet keeps working — QA confirmed it consumes an assembled
    // fan-out exam correctly, and /api/generate is untouched.
    expect(names).toContain("solution-sheet");
  });
});
