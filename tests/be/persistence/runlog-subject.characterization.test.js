/**
 * be-4 (hardening) — tie stored work to the subject it was done on.
 *
 * SEED kit §5 blind spot 3: a run could not be tied to the subject it produced,
 * so "how many refines per exam" — what the teacher test needs — was
 * unanswerable. Counting op:"replaceExercise" per subjectId answers it.
 *
 * The run log must STILL carry no teacher content. That guarantee is older than
 * this job and is the reason the file is safe to keep.
 */
const fs = require("node:fs");
const path = require("node:path");

/**
 * PROMOTED to the regression net (WF-54).
 *
 * These are black-box: they drive a running backend and assert against a real
 * MongoDB. On a mainline checkout with no lane up there is nothing to verify, so
 * the suite SKIPS rather than fails — a red that only means "the server isn't
 * running" trains people to ignore the gate.
 *
 * To actually run them: tools/dev up -d, then tools/ci be.
 */
const { execSync } = require("node:child_process");
const LANE_UP = (() => {
  try {
    execSync("nc -z localhost 9200", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();
const gate = LANE_UP ? describe : describe.skip;
if (!LANE_UP) {
  console.log("skipping: no backend on :9200 (run tools/dev up -d to exercise these)");
}

const BE = "http://localhost:9200";
const RUNLOG = path.join(process.env.CHAR_ROOTDIR, "run-log.jsonl");

const SUBJECT = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "fixtures/rec-exam-subject.2026-08-07.json"),
    "utf8",
  ),
).data;

async function call(method, url, { teacher, body } = {}) {
  const send = body !== undefined && method !== "GET";
  const res = await fetch(`${BE}${url}`, {
    method,
    headers: {
      ...(send ? { "content-type": "application/json" } : {}),
      ...(teacher ? { "x-teacher-id": teacher } : {}),
    },
    ...(send ? { body: JSON.stringify(body) } : {}),
  });
  const t = await res.text();
  return { status: res.status, body: t ? JSON.parse(t) : null };
}

function readLines() {
  if (!fs.existsSync(RUNLOG)) return [];
  return fs
    .readFileSync(RUNLOG, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

let teacher;

beforeAll(async () => {
  try {
    await fetch(`${BE}/health`);
  } catch (err) {
    throw new Error(`be unreachable at ${BE} — run 'tools/dev up -d' first (${err})`);
  }
  const r = await call("POST", "/api/teacher");
  teacher = r.body.teacherId;
}, 30000);

gate("positive — the join key exists", () => {
  test("a create appends a subject link carrying subjectId and correlationId", async () => {
    const { body } = await call("POST", "/api/subjects", { teacher, body: { subject: SUBJECT } });

    await new Promise((r) => setTimeout(r, 150)); // append is fire-and-forget
    const line = readLines()
      .reverse()
      .find((o) => o.kind === "subject" && o.subjectId === body.id);

    expect(line).toBeDefined();
    expect(line.op).toBe("create");
    expect(line.correlationId).toBe(body.correlationId);
    expect(typeof line.ts).toBe("string");
  });

  test("refines are countable per subject — the question kit §5 could not answer", async () => {
    const { body: made } = await call("POST", "/api/subjects", {
      teacher,
      body: { subject: SUBJECT },
    });

    for (const exId of ["ex1", "ex2", "ex1"]) {
      const ex = SUBJECT.exercises.find((e) => e.id === exId);
      await call("PUT", `/api/subjects/${made.id}/exercises/${exId}`, {
        teacher,
        body: { exercise: { ...ex, statement: `v-${exId}` } },
      });
    }

    await new Promise((r) => setTimeout(r, 200));
    const refines = readLines().filter(
      (o) => o.kind === "subject" && o.op === "replaceExercise" && o.subjectId === made.id,
    );
    expect(refines).toHaveLength(3);
  });
});

gate("negative — the run log's guarantees hold", () => {
  test("NO teacher content is ever written — no Arabic, no statements, no titles", async () => {
    const { body: made } = await call("POST", "/api/subjects", {
      teacher,
      body: { subject: SUBJECT },
    });
    await call("PUT", `/api/subjects/${made.id}/exercises/ex1`, {
      teacher,
      body: { exercise: { ...SUBJECT.exercises[0], statement: "سرّي جدا $x^2$" } },
    });
    await new Promise((r) => setTimeout(r, 200));

    const mine = readLines().filter((o) => o.subjectId === made.id);
    expect(mine.length).toBeGreaterThan(0);
    for (const line of mine) {
      const s = JSON.stringify(line);
      expect(s).not.toMatch(/[؀-ۿ]/); // no Arabic
      expect(s).not.toContain("statement");
      expect(s).not.toContain("title");
      expect(s).not.toContain("$");
    }
  });

  test("existing RUN lines keep their exact field names and types", async () => {
    // The pre-existing shape, recorded before this job touched runlog.ts.
    const runs = readLines().filter((o) => o.kind === undefined && "durationMs" in o);
    if (runs.length === 0) return; // no generation has run against this lane yet
    const r = runs[runs.length - 1];
    expect(typeof r.ts).toBe("string");
    expect(typeof r.durationMs).toBe("number");
    expect(typeof r.ok).toBe("boolean");
  });

  test("subject links are distinguishable from run records", async () => {
    const lines = readLines();
    for (const l of lines) {
      if (l.kind === "subject") {
        expect(l.durationMs).toBeUndefined();
        expect(l.subjectId).toBeTruthy();
      }
    }
  });

  test("a failed refine writes NO link line", async () => {
    const { body: made } = await call("POST", "/api/subjects", {
      teacher,
      body: { subject: SUBJECT },
    });
    const before = readLines().filter(
      (o) => o.kind === "subject" && o.op === "replaceExercise" && o.subjectId === made.id,
    ).length;

    const { status } = await call("PUT", `/api/subjects/${made.id}/exercises/ex99`, {
      teacher,
      body: { exercise: { ...SUBJECT.exercises[0], id: "ex99" } },
    });
    expect(status).toBe(409);

    await new Promise((r) => setTimeout(r, 150));
    const after = readLines().filter(
      (o) => o.kind === "subject" && o.op === "replaceExercise" && o.subjectId === made.id,
    ).length;
    expect(after).toBe(before);
  });
});
