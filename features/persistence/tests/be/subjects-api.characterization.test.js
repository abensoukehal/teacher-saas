/**
 * be-3 (with be-2 folded in) — the subject surfaces, and the storage rule they exist
 * to enforce: CREATE INSERTS, ALWAYS.
 *
 * The load-bearing test in this file is "create twice → two records". That is the
 * defect this whole job fixes (teacher-fe/src/lib/persist.ts stored every exam under
 * one fixed key, so a teacher's second exam destroyed their first). An implementation
 * that upserts passes every other test here and fails that one.
 *
 * Black-box by necessity — see stacks/be.md → "Test harness". Drives the real lane
 * over HTTP and asserts stored state with the mongodb driver.
 *
 * PRECONDITION: `tools/dev up -d` from the job worktree (be on :9200).
 */
const fs = require("node:fs");
const path = require("node:path");
const { MongoClient, ObjectId } = require("mongodb");

const BE = "http://localhost:9200";
const MONGO = "mongodb://127.0.0.1:27017";
const DB = "teacher_saas";

/** The real recorded generation — 3 exercises, ex1..ex3, Arabic + LaTeX. */
const RECORDING = JSON.parse(
  fs.readFileSync(
    path.join(
      __dirname,
      "../../iterations/01-initial/contracts/rec-exam-subject.2026-08-07.json",
    ),
    "utf8",
  ),
);
const SUBJECT = RECORDING.data;

let mongo;
let col;

async function call(method, url, { teacher, body } = {}) {
  // fetch throws on a body with GET/HEAD, so drop it rather than making every
  // call site remember — the auth cases below reuse one body for all four verbs.
  const sendBody = body !== undefined && method !== "GET" && method !== "HEAD";
  const res = await fetch(`${BE}${url}`, {
    method,
    headers: {
      ...(sendBody ? { "content-type": "application/json" } : {}),
      ...(teacher ? { "x-teacher-id": teacher } : {}),
    },
    ...(sendBody ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

async function newTeacher() {
  const { status, body } = await call("POST", "/api/teacher");
  expect(status).toBe(201);
  return body.teacherId;
}

beforeAll(async () => {
  try {
    await fetch(`${BE}/health`);
  } catch (err) {
    throw new Error(`be unreachable at ${BE} — run 'tools/dev up -d' first (${err})`);
  }
  mongo = new MongoClient(MONGO, { serverSelectionTimeoutMS: 3000 });
  await mongo.connect();
  col = mongo.db(DB).collection("subjects");
}, 30000);

afterAll(async () => {
  if (mongo) await mongo.close();
});

describe("identity", () => {
  test("POST /api/teacher issues a 32-hex opaque id", async () => {
    const { status, body } = await call("POST", "/api/teacher");
    expect(status).toBe(201);
    expect(body.teacherId).toMatch(/^[0-9a-f]{32}$/);
  });

  test("two calls issue different ids", async () => {
    expect(await newTeacher()).not.toBe(await newTeacher());
  });
});

describe("THE DEFECT — creating never overwrites", () => {
  test("create twice → two distinct records, both retrievable", async () => {
    const t = await newTeacher();

    const a = await call("POST", "/api/subjects", { teacher: t, body: { subject: SUBJECT } });
    const b = await call("POST", "/api/subjects", { teacher: t, body: { subject: SUBJECT } });
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    expect(a.body.id).not.toBe(b.body.id);

    // In the store, not just in the response.
    expect(await col.countDocuments({ teacherId: t })).toBe(2);

    // The FIRST one still exists and is still readable — this is the whole job.
    const again = await call("GET", `/api/subjects/${a.body.id}`, { teacher: t });
    expect(again.status).toBe(200);
    expect(again.body.subject).toEqual(SUBJECT);
  });

  test("a second create does not touch the first record's updatedAt", async () => {
    const t = await newTeacher();
    const a = await call("POST", "/api/subjects", { teacher: t, body: { subject: SUBJECT } });
    const before = (await col.findOne({ _id: new ObjectId(a.body.id) })).updatedAt;
    await call("POST", "/api/subjects", { teacher: t, body: { subject: SUBJECT } });
    const after = (await col.findOne({ _id: new ObjectId(a.body.id) })).updatedAt;
    expect(after.getTime()).toBe(before.getTime());
  });
});

describe("storage shape", () => {
  test("the stored subject round-trips byte-identical, Arabic and LaTeX intact", async () => {
    const t = await newTeacher();
    const { body } = await call("POST", "/api/subjects", { teacher: t, body: { subject: SUBJECT } });

    const doc = await col.findOne({ _id: new ObjectId(body.id) });
    // Byte equality, not a field-by-field walk — that is what catches a mapping
    // layer quietly normalising Arabic or eating a backslash.
    expect(JSON.stringify(doc.subject)).toBe(JSON.stringify(SUBJECT));
    expect(doc.subject.exercises[0].statement).toContain("$");
    expect(doc.subject.exercises[0].statement).toMatch(/[؀-ۿ]/);
    expect(doc.teacherId).toBe(t);
    expect(doc.createdAt).toBeInstanceOf(Date);
  });

  test("the query index exists", async () => {
    const idx = await col.indexes();
    expect(
      idx.some((i) => i.key && i.key.teacherId === 1 && i.key.updatedAt === -1),
    ).toBe(true);
  });
});

describe("list", () => {
  test("newest first, summaries only, and NO statements on the wire", async () => {
    const t = await newTeacher();
    const a = await call("POST", "/api/subjects", { teacher: t, body: { subject: SUBJECT } });
    await new Promise((r) => setTimeout(r, 5));
    const b = await call("POST", "/api/subjects", { teacher: t, body: { subject: SUBJECT } });

    const { status, body } = await call("GET", "/api/subjects", { teacher: t });
    expect(status).toBe(200);
    expect(body.subjects.map((s) => s.id)).toEqual([b.body.id, a.body.id]);

    const first = body.subjects[0];
    expect(first.title).toBe(SUBJECT.title);
    expect(first.exerciseCount).toBe(3);
    expect(first.totalPoints).toBe(SUBJECT.meta.totalPoints);
    // A list of ~5KB subjects would grow without bound for no display benefit.
    expect(JSON.stringify(body)).not.toContain("statement");
  });

  test("a fresh teacher gets 200 and an empty array, never 404", async () => {
    const { status, body } = await call("GET", "/api/subjects", { teacher: await newTeacher() });
    expect(status).toBe(200);
    expect(body.subjects).toEqual([]);
  });
});

describe("refine write-through — replaces in place, never appends", () => {
  // WF-70: one probe per variant. Positional bugs hide at the ends of an array.
  for (const [idx, exId] of [[0, "ex1"], [1, "ex2"], [2, "ex3"]]) {
    test(`PUT ${exId} replaces slot ${idx} and leaves length at 3`, async () => {
      const t = await newTeacher();
      const { body: made } = await call("POST", "/api/subjects", {
        teacher: t,
        body: { subject: SUBJECT },
      });

      const next = { ...SUBJECT.exercises[idx], statement: `REPLACED-${exId}` };
      const { status, body } = await call(
        "PUT",
        `/api/subjects/${made.id}/exercises/${exId}`,
        { teacher: t, body: { exercise: next } },
      );

      expect(status).toBe(200);
      expect(body.subject.exercises).toHaveLength(3);
      expect(body.subject.exercises[idx].id).toBe(exId);
      expect(body.subject.exercises[idx].statement).toBe(`REPLACED-${exId}`);
      // The other two are untouched.
      for (let i = 0; i < 3; i++) {
        if (i !== idx) {
          expect(body.subject.exercises[i].statement).toBe(SUBJECT.exercises[i].statement);
        }
      }

      const doc = await col.findOne({ _id: new ObjectId(made.id) });
      expect(doc.subject.exercises[idx].statement).toBe(`REPLACED-${exId}`);
      expect(doc.updatedAt.getTime()).toBeGreaterThan(doc.createdAt.getTime() - 1);
    });
  }

  test("an unknown exercise id is 409 and the array does NOT grow", async () => {
    const t = await newTeacher();
    const { body: made } = await call("POST", "/api/subjects", {
      teacher: t,
      body: { subject: SUBJECT },
    });

    const { status, body } = await call(
      "PUT",
      `/api/subjects/${made.id}/exercises/ex99`,
      { teacher: t, body: { exercise: { ...SUBJECT.exercises[0], id: "ex99" } } },
    );
    expect(status).toBe(409);
    expect(body.error.type).toBe("exercise_not_found");

    const doc = await col.findOne({ _id: new ObjectId(made.id) });
    expect(doc.subject.exercises).toHaveLength(3);
  });

  test("a body whose exercise.id disagrees with the path is 400", async () => {
    const t = await newTeacher();
    const { body: made } = await call("POST", "/api/subjects", {
      teacher: t,
      body: { subject: SUBJECT },
    });
    const { status, body } = await call(
      "PUT",
      `/api/subjects/${made.id}/exercises/ex2`,
      { teacher: t, body: { exercise: { ...SUBJECT.exercises[0], id: "ex3" } } },
    );
    expect(status).toBe(400);
    expect(body.error.type).toBe("invalid_request");
  });
});

describe("ownership is not probeable", () => {
  test("another teacher's subject 404s with a body IDENTICAL to a missing one", async () => {
    const owner = await newTeacher();
    const other = await newTeacher();
    const { body: made } = await call("POST", "/api/subjects", {
      teacher: owner,
      body: { subject: SUBJECT },
    });

    const foreign = await call("GET", `/api/subjects/${made.id}`, { teacher: other });
    const absent = await call("GET", `/api/subjects/${new ObjectId().toHexString()}`, {
      teacher: other,
    });

    expect(foreign.status).toBe(404);
    expect(absent.status).toBe(404);
    // Byte-equal apart from the per-request correlation id: an attacker must not
    // be able to tell "exists but not yours" from "does not exist".
    delete foreign.body.correlationId;
    delete absent.body.correlationId;
    expect(foreign.body).toEqual(absent.body);

    // ...while the document is demonstrably still there for its owner.
    expect(await col.countDocuments({ _id: new ObjectId(made.id) })).toBe(1);
  });

  test("a malformed subject id is a miss, not a crash", async () => {
    const { status } = await call("GET", "/api/subjects/not-an-object-id", {
      teacher: await newTeacher(),
    });
    expect(status).toBe(404);
  });
});

describe("identity is required on every subject route", () => {
  const cases = [
    ["POST", "/api/subjects"],
    ["GET", "/api/subjects"],
    ["GET", "/api/subjects/000000000000000000000000"],
    ["PUT", "/api/subjects/000000000000000000000000/exercises/ex1"],
  ];
  for (const [method, url] of cases) {
    test(`${method} ${url} without x-teacher-id → 401 teacher_required`, async () => {
      const { status, body } = await call(method, url, { body: { subject: SUBJECT } });
      expect(status).toBe(401);
      expect(body.error.type).toBe("teacher_required");
    });
  }

  test("a malformed teacher id is also 401", async () => {
    const { status, body } = await call("GET", "/api/subjects", { teacher: "nope" });
    expect(status).toBe(401);
    expect(body.error.type).toBe("teacher_required");
  });
});

describe("validation", () => {
  test("an empty exercises array is rejected", async () => {
    const { status, body } = await call("POST", "/api/subjects", {
      teacher: await newTeacher(),
      body: { subject: { ...SUBJECT, exercises: [] } },
    });
    expect(status).toBe(400);
    expect(body.error.type).toBe("invalid_request");
  });

  test("duplicate exercise ids are rejected — they would break refine-by-id", async () => {
    const { status } = await call("POST", "/api/subjects", {
      teacher: await newTeacher(),
      body: { subject: { ...SUBJECT, exercises: [SUBJECT.exercises[0], SUBJECT.exercises[0]] } },
    });
    expect(status).toBe(400);
  });

  test("a missing subject is rejected", async () => {
    const { status } = await call("POST", "/api/subjects", {
      teacher: await newTeacher(),
      body: {},
    });
    expect(status).toBe(400);
  });
});

describe("negative — the frozen perimeter", () => {
  test("/api/generate still rejects an unknown skill with the same envelope", async () => {
    const { status, body } = await call("POST", "/api/generate", {
      body: { skill: "definitely-not-a-skill", input: "x" },
    });
    expect(status).toBe(400);
    expect(body.error.type).toBe("invalid_request");
  });

  test("/api/generate still requires input — unchanged 400", async () => {
    const { status, body } = await call("POST", "/api/generate", { body: { skill: "exam-subject" } });
    expect(status).toBe(400);
    expect(body.error.type).toBe("invalid_request");
  });

  test("/api/skills is unchanged", async () => {
    const { body } = await call("GET", "/api/skills");
    expect(body.skills.map((s) => s.name).sort()).toEqual(["exam-subject", "refine-exercise"]);
  });

  test("no delete route exists — everything generated is kept", async () => {
    const t = await newTeacher();
    const { body: made } = await call("POST", "/api/subjects", {
      teacher: t,
      body: { subject: SUBJECT },
    });
    const { status } = await call("DELETE", `/api/subjects/${made.id}`, { teacher: t });
    expect(status).toBe(404);
    expect(await col.countDocuments({ _id: new ObjectId(made.id) })).toBe(1);
  });
});

describe("observability", () => {
  test("a create emits store.write carrying the subject id and correlation id", async () => {
    const t = await newTeacher();
    const { body } = await call("POST", "/api/subjects", { teacher: t, body: { subject: SUBJECT } });

    const log = fs.readFileSync("/tmp/teacher-backend.s2.log", "utf8");
    const line = log
      .split("\n")
      .filter(Boolean)
      .reverse()
      .map((l) => {
        try {
          return JSON.parse(l);
        } catch {
          return null;
        }
      })
      .find((o) => o && o.msg === "store.write" && o.subjectId === body.id);

    expect(line).toBeDefined();
    expect(line.op).toBe("create");
    expect(line.correlationId).toBe(body.correlationId);
  });
});
