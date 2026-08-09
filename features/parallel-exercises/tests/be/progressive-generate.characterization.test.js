/**
 * be-2 — POST /api/exams: plan, insert the skeleton, fan out, fill in place.
 *
 * WHAT THIS SUITE DEFENDS, in order of how expensive the bug would be:
 *
 *  1. **Absent `status` reads as `ready`, never `pending`.** 6,086 stored exams predate
 *     the field. The wrong default turns the entire archive into half-written exams and
 *     silently stops `exercise_revisions` for all of it. This is the `roleOf`
 *     absent→admin bug class, which survived a green gate once already — so it is pinned
 *     through a CONSEQUENCE (does a replace archive a revision?), not through a field
 *     that a re-implementation could keep emitting while meaning something else.
 *  2. **The fan-out races the CAS deliberately.** N exercises finish independently and
 *     write into ONE document. Two data-loss bugs shipped in this product because the
 *     oracle only ever exercised the order a person would describe, so the concurrent
 *     clause is here from the first commit and asserts `rev` advanced exactly once per
 *     fill — the counter is what proves nothing was clobbered.
 *  3. **Filling a placeholder is not a revision.** History records superseded
 *     teacher-visible work; a `""` statement is not that, and archiving one would make
 *     "restore" able to put a blank exercise on a teacher's sheet.
 *  4. **`/api/generate` is frozen.** Its envelope is pinned here so a change to it fails
 *     this suite rather than a teacher's browser.
 *
 * NEVER CALLS A REAL GENERATION. The instance under test runs against `fake-claude.mjs`,
 * replaying the recordings in SEED §9.2 — a real fan-out is ~4 agent loops, minutes, and
 * real subscription quota per gate run.
 *
 * NOTHING HERE ASSERTS TOTAL GENERATION TIME, in either direction. SEED §10.2: the spread
 * is 2.7x and every configuration is n=1, so any timing clause would be noise dressed as
 * an oracle — and the job explicitly does not claim generation got faster.
 */
const { ObjectId, MongoClient } = require("mongodb");
const { startReplayServer, client } = require("./replay-harness");

const MONGO = process.env.CHAR_MONGO_URL || "mongodb://127.0.0.1:27017";
const DB = "teacher_saas";

/** The recorded plan (SEED §9.2, `rec-plan.json`): three assignments, 5 + 7 + 8 = 20. */
const PLAN_POINTS = [5, 7, 8];
const TOTAL_POINTS = 20;

/** Controls that match the recording — replay means replay. */
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
let teacher; // the owner
let other; // a second, valid teacher
const CREATED = []; // subject _ids to clean up
const TEACHERS = []; // teacherIds to clean up

async function mintTeacher() {
  const { body } = await call("POST", "/api/teacher");
  TEACHERS.push(body.teacherId);
  return body.teacherId;
}

/** Poll the way `fe` will: read the subject until nothing is pending. */
async function waitForFanOut(subjectId, teacherId, timeoutMs = 60_000) {
  const until = Date.now() + timeoutMs;
  for (;;) {
    const { body } = await call("GET", `/api/subjects/${subjectId}`, { teacher: teacherId });
    const pending = body.subject.exercises.filter((e) => e.status === "pending");
    if (pending.length === 0) return body;
    if (Date.now() > until) {
      throw new Error(`fan-out did not settle: ${pending.map((e) => e.id).join(",")} still pending`);
    }
    await new Promise((r) => setTimeout(r, 200));
  }
}

beforeAll(async () => {
  // Long enough that the skeleton is observable through GET before anything fills, and
  // identical for every exercise so all N land together — the worst case for the CAS.
  server = await startReplayServer({ delayMs: 1200 });
  call = client(server.url);
  mongo = await new MongoClient(MONGO).connect();
  db = mongo.db(DB);
  teacher = await mintTeacher();
  other = await mintTeacher();
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

describe("be-2 — POST /api/exams answers with a skeleton", () => {
  let created; // { subjectId, subject }

  beforeAll(async () => {
    const { status, body } = await call("POST", "/api/exams", { body: CONTROLS, teacher });
    expect(status).toBe(201);
    created = body;
    CREATED.push(new ObjectId(body.subjectId));
  });

  test("it returns N exercises, every one pending with an empty statement", () => {
    expect(created.subject.exercises).toHaveLength(CONTROLS.exerciseCount);
    for (const e of created.subject.exercises) {
      expect(e.status).toBe("pending");
      expect(e.statement).toBe("");
      expect(typeof e.label).toBe("string");
      expect(e.label.trim()).not.toBe("");
    }
  });

  test("ids are ex1…exN in order", () => {
    expect(created.subject.exercises.map((e) => e.id)).toEqual(["ex1", "ex2", "ex3"]);
  });

  test("points already sum to 20, before a single exercise exists", () => {
    // Contract §5.1. The plan guarantees it; nothing downstream is in a position to fix
    // a total that is wrong, and the teacher finds out at printing time.
    const sum = created.subject.exercises.reduce((n, e) => n + e.points, 0);
    expect(sum).toBe(TOTAL_POINTS);
    expect(created.subject.exercises.map((e) => e.points)).toEqual(PLAN_POINTS);
    expect(created.subject.meta.totalPoints).toBe(TOTAL_POINTS);
  });

  test("the response carries a correlation id and a subject id", () => {
    expect(typeof created.correlationId).toBe("string");
    expect(created.correlationId.length).toBeGreaterThan(0);
    expect(ObjectId.isValid(created.subjectId)).toBe(true);
  });

  test("GET /api/subjects/:id returns the same skeleton to its owner", async () => {
    const { status, body } = await call("GET", `/api/subjects/${created.subjectId}`, { teacher });
    expect(status).toBe(200);
    expect(body.subject.exercises.map((e) => e.id)).toEqual(["ex1", "ex2", "ex3"]);
    expect(body.subject.exercises.map((e) => e.points)).toEqual(PLAN_POINTS);
  });

  test("a second teacher gets exactly the not-found a nonexistent exam gets", async () => {
    // Existence is not probeable — the two responses must be indistinguishable.
    const mine = await call("GET", `/api/subjects/${created.subjectId}`, { teacher: other });
    const ghost = await call("GET", `/api/subjects/${new ObjectId().toHexString()}`, {
      teacher: other,
    });
    expect(mine.status).toBe(404);
    expect(ghost.status).toBe(404);
    expect(mine.body.error).toEqual(ghost.body.error);
  });

  test("no x-teacher-id is 401 teacher_required", async () => {
    const { status, body } = await call("POST", "/api/exams", { body: CONTROLS });
    expect(status).toBe(401);
    expect(body.error.type).toBe("teacher_required");
  });

  test("an id the server never issued is 401 too, not a silent new owner", async () => {
    const { status, body } = await call("POST", "/api/exams", {
      body: CONTROLS,
      teacher: "0123456789abcdef0123456789abcdef",
    });
    expect(status).toBe(401);
    expect(body.error.type).toBe("teacher_required");
  });

  test.each([
    ["exerciseCount too large", { ...CONTROLS, exerciseCount: 99 }],
    ["exerciseCount zero", { ...CONTROLS, exerciseCount: 0 }],
    ["exerciseCount not an integer", { ...CONTROLS, exerciseCount: 2.5 }],
    ["exerciseCount not a number", { ...CONTROLS, exerciseCount: "3" }],
    ["durationMinutes negative", { ...CONTROLS, durationMinutes: -10 }],
  ])("%s is 400 invalid_request", async (_name, body) => {
    // A fan-out is N concurrent agent loops at ~0.75-1 GB each against a flat global gate.
    // An unbounded exerciseCount is a resource exhaustion vector, not a big exam.
    const res = await call("POST", "/api/exams", { body, teacher });
    expect(res.status).toBe(400);
    expect(res.body.error.type).toBe("invalid_request");
  });
});

describe("be-2 — the fan-out fills every slot, concurrently, into one document", () => {
  let subjectId;
  let skeleton;
  let planCorrelationId;
  let settled;

  beforeAll(async () => {
    const { body } = await call("POST", "/api/exams", { body: CONTROLS, teacher });
    subjectId = body.subjectId;
    skeleton = body.subject;
    planCorrelationId = body.correlationId;
    CREATED.push(new ObjectId(subjectId));
    settled = await waitForFanOut(subjectId, teacher);
  });

  test("every exercise landed — none was lost to the race", () => {
    // THE CLAUSE THIS SUB-ISSUE EXISTS FOR. N independent writers, one document, the same
    // compare-and-set that two concurrent refines once lost a version to.
    expect(settled.subject.exercises).toHaveLength(3);
    for (const e of settled.subject.exercises) {
      expect(e.status).toBe("ready");
      expect(typeof e.statement).toBe("string");
      expect(e.statement.trim().length).toBeGreaterThan(0);
    }
  });

  test("rev advanced exactly once per fill", async () => {
    // The counter is the proof. A lost write leaves rev short; a double-applied one leaves
    // it long. Either way the exam looks plausible and is wrong.
    const doc = await db.collection("subjects").findOne({ _id: new ObjectId(subjectId) });
    expect(doc.rev).toBe(3);
  });

  test("id, label and points after filling are exactly the plan's", () => {
    // Contract §5.2 — the assignment is not the writer's decision.
    const before = new Map(skeleton.exercises.map((e) => [e.id, e]));
    for (const after of settled.subject.exercises) {
      const plan = before.get(after.id);
      expect(plan).toBeDefined();
      expect(after.label).toBe(plan.label);
      expect(after.points).toBe(plan.points);
    }
    expect(settled.subject.exercises.map((e) => e.id)).toEqual(["ex1", "ex2", "ex3"]);
  });

  test("points still sum to 20 after every fill", () => {
    const sum = settled.subject.exercises.reduce((n, e) => n + e.points, 0);
    expect(sum).toBe(TOTAL_POINTS);
  });

  test("filling a placeholder writes NO exercise_revisions row", async () => {
    // Contract §5.4. A placeholder is not superseded teacher-visible work — its statement
    // is "". Recording one would let "restore" put a blank exercise on a printed sheet.
    const rows = await db
      .collection("exercise_revisions")
      .countDocuments({ subjectId: new ObjectId(subjectId) });
    expect(rows).toBe(0);

    for (const id of ["ex1", "ex2", "ex3"]) {
      const { body } = await call(
        "GET",
        `/api/subjects/${subjectId}/exercises/${id}/revisions`,
        { teacher },
      );
      expect(body.revisions).toEqual([]);
    }
  });

  test("the assembled exam is indistinguishable from a monolith exam downstream", () => {
    // SEED §5 exit criterion 4. Same keys, same id scheme, same totals — the only addition
    // is `status`, and every exercise reads `ready`.
    for (const e of settled.subject.exercises) {
      expect(Object.keys(e).sort()).toEqual(
        ["difficulty", "id", "label", "points", "statement", "status", "topics"].sort(),
      );
    }
    expect(typeof settled.subject.title).toBe("string");
    expect(settled.subject.meta.totalPoints).toBe(TOTAL_POINTS);
  });

  test("the exam's usage figures are the whole exam's, not just the plan's", async () => {
    // A fan-out is N+1 runs. Storing only the plan's numbers would under-report every
    // progressive exam in /api/admin/kpis by roughly 4x; leaving them null would drop the
    // path out of those averages entirely. ⚠ costUsd IS NOT MONEY — a usage signal.
    const doc = await db.collection("subjects").findOne({ _id: new ObjectId(subjectId) });
    expect(typeof doc.costUsd).toBe("number");
    expect(typeof doc.durationMs).toBe("number");
    // The recorded plan alone cost 0.6228; the exam is the plan plus three exercises.
    expect(doc.costUsd).toBeGreaterThan(0.6228);
  });

  test("one correlation id ties the whole exam together", async () => {
    // `subjects.genCorrelationId` is a single value and a fan-out has N+1 runs (SEED §9.3).
    // Sharing the request's id across every spawn is what keeps the run-log join intact.
    const doc = await db.collection("subjects").findOne({ _id: new ObjectId(subjectId) });
    expect(doc.genCorrelationId).toBe(planCorrelationId);
  });
});

describe("be-2 — the widest fan-out the service allows still lands every exercise", () => {
  test("six concurrent writers, one document, nothing lost", async () => {
    // MAX_EXERCISES is this service's own bound, so it is this service's job to prove the
    // CAS survives it. Six writers finishing together means the last one has to win a
    // sixth round of the compare-and-set — measured above, a single-attempt CAS loses 2
    // of 3 at width three, so width six is not a formality.
    //
    // The global gate is 3, so this also crosses the queue: three run, three wait, and the
    // second wave collides with a document three fills further along.
    const { status, body } = await call("POST", "/api/exams", {
      body: { ...CONTROLS, exerciseCount: 6 },
      teacher,
    });
    expect(status).toBe(201);
    CREATED.push(new ObjectId(body.subjectId));
    expect(body.subject.exercises).toHaveLength(6);

    const settled = await waitForFanOut(body.subjectId, teacher);
    expect(settled.subject.exercises.map((e) => e.status)).toEqual(Array(6).fill("ready"));
    const doc = await db.collection("subjects").findOne({ _id: new ObjectId(body.subjectId) });
    expect(doc.rev).toBe(6);
    expect(settled.subject.exercises.reduce((n, e) => n + e.points, 0)).toBe(TOTAL_POINTS);
  });
});

describe("be-2 — a fill that does not echo its assignment is refused", () => {
  let rogue;
  let rogueCall;

  beforeAll(async () => {
    rogue = await startReplayServer({ mode: "bad-echo-ex2", delayMs: 200 });
    rogueCall = client(rogue.url);
  });

  afterAll(async () => {
    if (rogue) await rogue.stop();
  });

  test("the exam keeps summing to 20 and the rogue slot stays pending", async () => {
    // Contract §5.2 — `id`, `label` and `points` ARE the assignment. `exercise-one` returns
    // 8 points where the plan said 7, and the CLI calls that run a success: there is no
    // exit code, no `is_error` and no exception to catch. If `be` trusted the echo the exam
    // would silently total 21 and the teacher would find out while printing it.
    //
    // The refusal leaves the slot `pending`, which is what be-3's retry acts on.
    const { body } = await rogueCall("POST", "/api/exams", { body: CONTROLS, teacher });
    CREATED.push(new ObjectId(body.subjectId));

    // The other two still land — one bad fill costs one exercise, never the exam.
    const until = Date.now() + 30_000;
    let subject;
    for (;;) {
      const got = await rogueCall("GET", `/api/subjects/${body.subjectId}`, { teacher });
      subject = got.body.subject;
      const ready = subject.exercises.filter((e) => e.status === "ready");
      if (ready.length >= 2 || Date.now() > until) break;
      await new Promise((r) => setTimeout(r, 200));
    }

    const byId = new Map(subject.exercises.map((e) => [e.id, e]));
    expect(byId.get("ex1").status).toBe("ready");
    expect(byId.get("ex3").status).toBe("ready");
    expect(byId.get("ex2").status).toBe("pending");
    expect(byId.get("ex2").points).toBe(7);
    expect(byId.get("ex2").statement).toBe("");
    expect(subject.exercises.reduce((n, e) => n + e.points, 0)).toBe(TOTAL_POINTS);
  });
});

describe("be-2 — absent status reads as ready, never pending", () => {
  /**
   * Planted directly, exactly as the 6,086 stored exams look: no `status` anywhere, no
   * `rev`. Going through the API would not reproduce them — this is the shape on disk.
   */
  async function plantLegacy(exercises) {
    const now = new Date();
    const res = await db.collection("subjects").insertOne({
      teacherId: teacher,
      subject: {
        title: "اختبار الفصل الأول",
        meta: { totalPoints: 20, topic: "الدوال" },
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

  const legacyExercises = () => [
    { id: "ex1", label: "التمرين الأول", points: 12, statement: "$f(x)=x^{2}$" },
    { id: "ex2", label: "التمرين الثاني", points: 8, statement: "$g(x)=\\ln x$" },
  ];

  test("a monolith-era exam never reads as pending", async () => {
    const id = await plantLegacy(legacyExercises());
    const { status, body } = await call("GET", `/api/subjects/${id}`, { teacher });
    expect(status).toBe(200);
    for (const e of body.subject.exercises) {
      expect(e.status).not.toBe("pending");
      expect(e.status).not.toBe("failed");
      expect(e.statement.trim().length).toBeGreaterThan(0);
    }
  });

  test("replacing a monolith-era exercise DOES archive a revision", async () => {
    // The mutation clause. Archiving is gated on the outgoing exercise reading `ready`, so
    // if absent ever defaults to `pending` this test goes red — and the failure it catches
    // is history silently stopping for every exam that predates the field.
    const id = await plantLegacy(legacyExercises());
    const next = { id: "ex1", label: "التمرين الأول", points: 12, statement: "$f(x)=x^{3}$" };
    const put = await call("PUT", `/api/subjects/${id}/exercises/ex1`, {
      body: { exercise: next },
      teacher,
    });
    expect(put.status).toBe(200);

    const { body } = await call("GET", `/api/subjects/${id}/exercises/ex1/revisions`, { teacher });
    expect(body.revisions).toHaveLength(1);
    expect(body.revisions[0].exercise.statement).toBe("$f(x)=x^{2}$");
  });

  test.each([
    ["ready", "ready"],
    ["a wrong case", "READY"],
    ["a wrong case for pending", "Pending"],
    ["a number", 1],
    ["null", null],
    ["an unknown word", "queued"],
  ])("status %s also reads as ready and archives", async (_name, status) => {
    // An ALLOW-LIST, not `?? "ready"`: only the two literals that mean "not finished" ever
    // read that way. Everything else degrades to ready — the direction that cannot hurt.
    const id = await plantLegacy([
      { id: "ex1", label: "التمرين الأول", points: 12, statement: "$f(x)=x^{2}$", status },
      { id: "ex2", label: "التمرين الثاني", points: 8, statement: "$g(x)=\\ln x$" },
    ]);
    const put = await call("PUT", `/api/subjects/${id}/exercises/ex1`, {
      body: { exercise: { id: "ex1", label: "التمرين الأول", points: 12, statement: "$f(x)=x^{4}$" } },
      teacher,
    });
    expect(put.status).toBe(200);
    const { body } = await call("GET", `/api/subjects/${id}/exercises/ex1/revisions`, { teacher });
    expect(body.revisions).toHaveLength(1);
  });

  test.each(["pending", "failed"])(
    "an explicit %s placeholder archives NOTHING — the contrast that proves the branch",
    async (status) => {
      const id = await plantLegacy([
        { id: "ex1", label: "التمرين الأول", points: 12, statement: "", status },
        { id: "ex2", label: "التمرين الثاني", points: 8, statement: "$g(x)=\\ln x$" },
      ]);
      const put = await call("PUT", `/api/subjects/${id}/exercises/ex1`, {
        body: {
          exercise: { id: "ex1", label: "التمرين الأول", points: 12, statement: "$f(x)=x^{5}$", status: "ready" },
        },
        teacher,
      });
      expect(put.status).toBe(200);
      const { body } = await call("GET", `/api/subjects/${id}/exercises/ex1/revisions`, { teacher });
      expect(body.revisions).toEqual([]);
    },
  );
});

describe("be-2 — /api/generate is frozen", () => {
  test("its response envelope is unchanged", async () => {
    // SEED §9.1 and fe/src/lib/api.ts:235 record this freeze on both sides. The new surface
    // is POST /api/exams; the old one is not extended, byte for byte.
    const { status, body } = await call("POST", "/api/generate", {
      body: { skill: "exam-subject", input: CONTROLS },
    });
    expect(status).toBe(200);
    expect(Object.keys(body).sort()).toEqual(
      ["correlationId", "costUsd", "data", "durationMs", "sessionId", "text"].sort(),
    );
    // Still the whole exam in one payload, with no `status` invented on its exercises —
    // the monolith path is untouched by this job.
    expect(Array.isArray(body.data.exercises)).toBe(true);
    for (const e of body.data.exercises) expect(e.status).toBeUndefined();
  });

  test("it still needs no teacher header", async () => {
    const { status } = await call("POST", "/api/generate", {
      body: { skill: "exam-subject", input: CONTROLS },
    });
    expect(status).toBe(200);
  });

  test("the /api index advertises the new surface alongside the old one", async () => {
    const { body } = await call("GET", "/api");
    expect(body.routes).toContain("/api/generate");
    expect(body.routes).toContain("/api/exams");
  });
});
