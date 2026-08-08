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
 * PRECONDITION: `tools/dev up -d` from the job worktree (be on the job's lane; see BE_URL below).
 */
const fs = require("node:fs");
const path = require("node:path");
const { MongoClient, ObjectId } = require("mongodb");

/**
 * PROMOTED to the regression net (WF-54).
 *
 * These are black-box: they drive a running backend and assert against a real
 * MongoDB. On a checkout with no lane up there is nothing to verify, so
 * the suite SKIPS rather than fails — a red that only means "the server isn't
 * running" trains people to ignore the gate.
 *
 * To actually run them: tools/dev up -d, then tools/ci be.
 */
const { describeIfLane } = require("guard");

/**
 * The lane comes from the ENVIRONMENT, never a hardcoded port. :9200 was the
 * `persistence` job's slot; a suite pinned to it skips forever on every other slot,
 * which is indistinguishable from passing.
 *
 * describeIfLane skips when nothing is listening (a red meaning only "the server
 * isn't running" trains people to ignore the gate) AND tells tools/ci the layer was
 * hollow, so an all-skipped run reports INCOMPLETE instead of PASS.
 */
// tools/ci derives CHAR_BE_URL from THIS checkout's own lane, so the server we
// drive is the one CHAR_ROOTDIR resolves dist/ and run-log.jsonl against. BE_URL
// stays as a manual override; the literal is only a bare-jest fallback.
const BE = process.env.BE_URL ?? process.env.CHAR_BE_URL ?? "http://localhost:9000";
const gate = (name, fn) => describeIfLane(BE, name, fn);
const MONGO = "mongodb://127.0.0.1:27017";
const DB = "teacher_saas";

/** The real recorded generation — 3 exercises, ex1..ex3, Arabic + LaTeX. */
const RECORDING = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "fixtures/rec-exam-subject.2026-08-07.json"),
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

gate("identity", () => {
  test("POST /api/teacher issues a 32-hex opaque id", async () => {
    const { status, body } = await call("POST", "/api/teacher");
    expect(status).toBe(201);
    expect(body.teacherId).toMatch(/^[0-9a-f]{32}$/);
  });

  test("two calls issue different ids", async () => {
    expect(await newTeacher()).not.toBe(await newTeacher());
  });
});

gate("THE DEFECT — creating never overwrites", () => {
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

gate("storage shape", () => {
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

gate("list", () => {
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

gate("refine write-through — replaces in place, never appends", () => {
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

gate("ownership is not probeable", () => {
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

gate("identity is required on every subject route", () => {
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

gate("validation", () => {
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

gate("negative — the frozen perimeter", () => {
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

gate("the store is down — the promise be-1 deferred to here", () => {
  const { spawn } = require("node:child_process");
  const PORT = 9298;
  let child;

  beforeAll(async () => {
    child = spawn(process.execPath, [path.join(process.env.CHAR_ROOTDIR, "dist/index.js")], {
      env: { ...process.env, PORT: String(PORT), MONGO_URL: "mongodb://127.0.0.1:1", RUN_LOG: "" },
      stdio: "ignore",
    });
    for (let i = 0; i < 60; i++) {
      try {
        await fetch(`http://localhost:${PORT}/health`);
        return;
      } catch {
        await new Promise((r) => setTimeout(r, 250));
      }
    }
    throw new Error("dead-store probe instance never came up");
  }, 30000);

  afterAll(() => child && child.kill("SIGTERM"));

  async function dead(method, url, body) {
    const send = body !== undefined && method !== "GET";
    const res = await fetch(`http://localhost:${PORT}${url}`, {
      method,
      headers: {
        ...(send ? { "content-type": "application/json" } : {}),
        "x-teacher-id": "0123456789abcdef0123456789abcdef",
      },
      ...(send ? { body: JSON.stringify(body) } : {}),
    });
    return { status: res.status, body: await res.json() };
  }

  test("every store-touching route is 503 store_unavailable, NEVER a bare 500", async () => {
    const cases = [
      ["GET", "/api/subjects", undefined],
      ["POST", "/api/subjects", { subject: SUBJECT }],
      ["GET", "/api/subjects/000000000000000000000000", undefined],
      ["PUT", "/api/subjects/000000000000000000000000/exercises/ex1", { exercise: SUBJECT.exercises[0] }],
    ];
    for (const [m, u, b] of cases) {
      const r = await dead(m, u, b);
      expect(r.status).toBe(503);
      expect(r.body.error.type).toBe("store_unavailable");
    }
  }, 30000);

  /**
   * SUPERSEDED BY persistence-gaps be-2 (WF-65), 2026-08-08.
   *
   * This pinned "identity needs no database": POST /api/teacher minted an id in memory
   * and returned 201 even with the store dead. be-2 makes that route RECORD the id it
   * mints, because requireTeacher now rejects ids the server never recorded — so
   * handing back an unrecorded id would give a teacher a credential that fails on its
   * very next request. Needing the store is the point, not an oversight.
   *
   * The invariant the pin protected — this service degrades HONESTLY when the store is
   * down, never with a bare 500 — is unchanged, and is what the flipped expectation
   * asserts: a classified, retryable 503.
   *
   * Practically nothing is lost: with the store down the old 201 handed back an id that
   * could not create or list a single subject.
   */
  test("identity now needs the store, and says so honestly (503, not 500)", async () => {
    const res = await fetch(`http://localhost:${PORT}/api/teacher`, { method: "POST" });
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error.type).toBe("store_unavailable");
  });

  test("a repeated call still fails cleanly — a dead attempt is not cached forever", async () => {
    // The single-flight connect must not memoise a REJECTED promise, or one blip
    // would leave the process permanently unable to reach a recovered database.
    const a = await dead("GET", "/api/subjects");
    const b = await dead("GET", "/api/subjects");
    expect(a.status).toBe(503);
    expect(b.status).toBe(503);
  }, 30000);
});

gate("observability", () => {
  test("a create emits store.write carrying the subject id and correlation id", async () => {
    const t = await newTeacher();
    const { body } = await call("POST", "/api/subjects", { teacher: t, body: { subject: SUBJECT } });

    // The log path is per-LANE (tools/dev writes ".sN" per slot). tools/ci derives it
    // for this checkout; the literal is only a bare-jest fallback for slot 0.
    const log = fs.readFileSync(process.env.CHAR_BE_LOG || "/tmp/teacher-backend.log", "utf8");
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
