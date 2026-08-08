/**
 * be-3 — keep every superseded exercise.
 *
 * Refining is the product's central act (SEED → core loop step 4) and today it destroys
 * the previous version, so the one interaction the product exists for has no undo. Every
 * discarded variant is a fully-formed, on-syllabus exercise that cost ~$0.65 to generate.
 *
 * Two constraints pick the design, and both are asserted below:
 *  - the CURRENT sheet stays one cheap read → history lives in its own collection,
 *    never inside the subject document
 *  - exercise ids (ex1…exN) must not move → replaceExercise keeps its positional $set
 *
 * Black-box over HTTP; PRECONDITION `tools/dev up -d`. Hollow run is RED (WF-82).
 */
const fs = require("node:fs");
const path = require("node:path");
const { MongoClient } = require("mongodb");
const { describeIfLane } = require("guard");

const BE = process.env.CHAR_BE_URL || "http://localhost:9000";
const LOG = process.env.CHAR_BE_LOG || "/tmp/teacher-backend.log";
const MONGO = "mongodb://127.0.0.1:27017";
const DB = "teacher_saas";

/** The real recorded generation — Arabic + LaTeX, ex1..ex3. Never call /api/generate. */
// Beside the test, never reached for with ../../ into another tree — a promoted suite
// that walks out of its own directory breaks the moment it is promoted (fixed in 94106ed).
const RECORDING = JSON.parse(
  fs.readFileSync(path.join(__dirname, "fixtures/rec-exam-subject.2026-08-07.json"), "utf8"),
);
const SUBJECT = RECORDING.data;

let mongo;
let db;

async function call(method, p, { body, teacher } = {}) {
  const res = await fetch(`${BE}${p}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(teacher ? { "x-teacher-id": teacher } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: res.status, body: await res.json() };
}

async function newTeacher() {
  const { body } = await call("POST", "/api/teacher");
  return body.teacherId;
}

async function newSubject(teacher) {
  const { body } = await call("POST", "/api/subjects", {
    teacher,
    body: { subject: SUBJECT, controls: null },
  });
  return body.id;
}

const variantOf = (exId, text) => {
  const base = SUBJECT.exercises.find((e) => e.id === exId);
  return { ...base, statement: text };
};

const revisions = (teacher, sid, exId) =>
  call("GET", `/api/subjects/${sid}/exercises/${exId}/revisions`, { teacher });

const replace = (teacher, sid, exId, text) =>
  call("PUT", `/api/subjects/${sid}/exercises/${exId}`, {
    teacher,
    body: { exercise: variantOf(exId, text) },
  });

describeIfLane(BE, "be-3 — exercise revision history", () => {
  beforeAll(async () => {
    mongo = new MongoClient(MONGO);
    await mongo.connect();
    db = mongo.db(DB);
  });
  afterAll(async () => {
    if (mongo) await mongo.close();
  });

  describe("positive — the superseded version is kept", () => {
    test("the FIRST replacement stores the generated original, byte-identical", async () => {
      const t = await newTeacher();
      const sid = await newSubject(t);
      await replace(t, sid, "ex1", "v2");

      const { status, body } = await revisions(t, sid, "ex1");
      expect(status).toBe(200);
      expect(body.revisions).toHaveLength(1);
      // The exact generated exercise — Arabic and LaTeX intact, not a re-serialisation.
      expect(JSON.stringify(body.revisions[0].exercise)).toBe(
        JSON.stringify(SUBJECT.exercises.find((e) => e.id === "ex1")),
      );
    });

    test("three replacements → three entries, newest superseded first", async () => {
      const t = await newTeacher();
      const sid = await newSubject(t);
      await replace(t, sid, "ex1", "v2");
      await replace(t, sid, "ex1", "v3");
      await replace(t, sid, "ex1", "v4");

      const { body } = await revisions(t, sid, "ex1");
      expect(body.revisions).toHaveLength(3);
      const statements = body.revisions.map((r) => r.exercise.statement);
      expect(statements[0]).toBe("v3"); // most recently superseded
      expect(statements[2]).toBe(SUBJECT.exercises[0].statement); // the original
      const times = body.revisions.map((r) => Date.parse(r.supersededAt));
      expect(times).toEqual([...times].sort((a, b) => b - a));
    });

    test("every position is covered — ex1 first, ex2 middle, ex3 last (WF-70)", async () => {
      const t = await newTeacher();
      const sid = await newSubject(t);
      for (const id of ["ex1", "ex2", "ex3"]) await replace(t, sid, id, `${id}-v2`);
      for (const id of ["ex1", "ex2", "ex3"]) {
        const { body } = await revisions(t, sid, id);
        expect(body.revisions).toHaveLength(1);
        expect(body.revisions[0].exercise.id).toBe(id);
      }
    });
  });

  describe("positive — restore reuses PUT, and is itself a supersession", () => {
    test("restoring an old version brings it back AND grows the history", async () => {
      const t = await newTeacher();
      const sid = await newSubject(t);
      await replace(t, sid, "ex1", "v2");
      await replace(t, sid, "ex1", "v3");

      const before = await revisions(t, sid, "ex1");
      expect(before.body.revisions).toHaveLength(2);
      const original = before.body.revisions[1].exercise;

      // No restore endpoint exists — the client PUTs the old body back.
      const restored = await call("PUT", `/api/subjects/${sid}/exercises/ex1`, {
        teacher: t,
        body: { exercise: original },
      });
      expect(restored.status).toBe(200);

      const sheet = await call("GET", `/api/subjects/${sid}`, { teacher: t });
      const ex1 = sheet.body.subject.exercises.find((e) => e.id === "ex1");
      expect(ex1.statement).toBe(original.statement);

      // History GREW to 3 — restoring never rewinds or destroys.
      const after = await revisions(t, sid, "ex1");
      expect(after.body.revisions).toHaveLength(3);
      expect(after.body.revisions[0].exercise.statement).toBe("v3");
    });
  });

  describe("positive — empty and degenerate states are states, not errors", () => {
    test("a subject never refined → 200 with an empty list, never 404", async () => {
      const t = await newTeacher();
      const sid = await newSubject(t);
      const { status, body } = await revisions(t, sid, "ex1");
      expect(status).toBe(200);
      expect(body.revisions).toEqual([]);
    });

    test("an unknown exerciseId on an existing subject → 200 empty, not 409", async () => {
      const t = await newTeacher();
      const sid = await newSubject(t);
      const { status, body } = await revisions(t, sid, "ex99");
      expect(status).toBe(200);
      expect(body.revisions).toEqual([]);
    });

    test("another teacher's subject is 404, identical to one that never existed", async () => {
      const owner = await newTeacher();
      const sid = await newSubject(owner);
      const stranger = await newTeacher();

      const theirs = await revisions(stranger, sid, "ex1");
      const nothing = await revisions(stranger, "6a7600000000000000000000", "ex1");
      expect(theirs.status).toBe(404);
      expect(theirs.body.error.type).toBe("subject_not_found");
      const strip = (b) => ({ ...b, correlationId: undefined });
      expect(strip(theirs.body)).toEqual(strip(nothing.body));
    });
  });

  describe("negative — the subject read path is untouched", () => {
    test("the sheet gains NO history field and the exercises array is stable", async () => {
      const t = await newTeacher();
      const sid = await newSubject(t);
      const before = await call("GET", `/api/subjects/${sid}`, { teacher: t });
      await replace(t, sid, "ex2", "changed");
      const after = await call("GET", `/api/subjects/${sid}`, { teacher: t });

      expect(Object.keys(after.body).sort()).toEqual(Object.keys(before.body).sort());
      expect(after.body.subject.exercises).toHaveLength(before.body.subject.exercises.length);
      expect(after.body.subject.exercises.map((e) => e.id)).toEqual(
        before.body.subject.exercises.map((e) => e.id),
      );
      // ex2 stayed at ITS index — the positional $set must survive.
      expect(after.body.subject.exercises[1].id).toBe("ex2");
    });

    /**
     * NARROWED BY be-4 (WF-65), 2026-08-08.
     *
     * This asserted the document's EXACT key set, which made it fail on any additive
     * field — be-4's `genCorrelationId` tripped it. That was over-specification: the
     * invariant this pin exists for is that HISTORY is never embedded in the subject,
     * because the subject-open path must stay one cheap read. That is unchanged, and
     * is what it now asserts. Additive fields are explicitly allowed; a history key is
     * still forbidden.
     */
    test("the stored subject document never grows a history key", async () => {
      const t = await newTeacher();
      const sid = await newSubject(t);
      await replace(t, sid, "ex1", "v2");
      await replace(t, sid, "ex1", "v3");
      const doc = await db
        .collection("subjects")
        .findOne({ _id: new (require("mongodb").ObjectId)(sid) });

      // EXACT key set, restored 2026-08-08 after an audit showed the name-regex version
      // let `costUsd` through — which be-4's own Boundaries call a stop condition, and
      // which this pin was the only mechanical guard against. A one-token edit (adding
      // genCorrelationId) preserves the coverage; a regex does not.
      expect(Object.keys(doc).sort()).toEqual(
        [
          "_id",
          "controls",
          "createdAt",
          "genCorrelationId",
          // the optimistic-concurrency counter, added when the millisecond-resolution
          // updatedAt proved unsafe as a version token
          "rev",
          "subject",
          "teacherId",
          "updatedAt",
        ].sort(),
      );
      // and the payload itself carries no embedded history either (kept — a real
      // improvement over the original pin, which never looked below the top level)
      expect(JSON.stringify(doc.subject)).not.toContain("v2");
    });

    test("an unknown exercise id is still 409 AND writes no revision", async () => {
      const t = await newTeacher();
      const sid = await newSubject(t);
      const res = await call("PUT", `/api/subjects/${sid}/exercises/ex99`, {
        teacher: t,
        body: { exercise: { ...variantOf("ex1", "nope"), id: "ex99" } },
      });
      expect(res.status).toBe(409);
      expect(res.body.error.type).toBe("exercise_not_found");
      expect(await db.collection("exercise_revisions").countDocuments({ exerciseId: "ex99" })).toBe(
        0,
      );
    });
  });

  describe("negative — concurrency must not silently lose a version", () => {
    test("two simultaneous refines: BOTH versions survive, one current one archived", async () => {
      const t = await newTeacher();
      const sid = await newSubject(t);

      // A teacher double-tapping refine. Before the compare-and-set both writes returned
      // 200 and one version vanished from the sheet AND from history — the exact failure
      // "everything generated is worth keeping" exists to prevent.
      const results = await Promise.all([
        replace(t, sid, "ex1", "CONCURRENT-A"),
        replace(t, sid, "ex1", "CONCURRENT-B"),
      ]);
      // A loser may legitimately be told 409; it must never be a silent success.
      for (const r of results) expect([200, 409]).toContain(r.status);

      const sheet = await call("GET", `/api/subjects/${sid}`, { teacher: t });
      const current = sheet.body.subject.exercises.find((e) => e.id === "ex1").statement;
      const { body } = await revisions(t, sid, "ex1");
      const archived = body.revisions.map((r) => r.exercise.statement);

      const landed = results.filter((r) => r.status === 200).length;
      // Every version that was accepted is still reachable: either on the sheet or in
      // history. Nothing accepted may disappear.
      const accepted = ["CONCURRENT-A", "CONCURRENT-B"].filter(
        (v) => current === v || archived.includes(v),
      );
      expect(accepted.length).toBe(landed);
      // The generated original is always kept.
      expect(archived).toContain(SUBJECT.exercises[0].statement);
    });

    test("ten simultaneous refines lose nothing", async () => {
      const t = await newTeacher();
      const sid = await newSubject(t);
      const tags = Array.from({ length: 10 }, (_, i) => `RACE-${i}`);
      const results = await Promise.all(tags.map((v) => replace(t, sid, "ex1", v)));

      const sheet = await call("GET", `/api/subjects/${sid}`, { teacher: t });
      const current = sheet.body.subject.exercises.find((e) => e.id === "ex1").statement;
      const { body } = await revisions(t, sid, "ex1");
      const archived = body.revisions.map((r) => r.exercise.statement);

      const accepted = tags.filter((_, i) => results[i].status === 200);
      for (const v of accepted) {
        expect(current === v || archived.includes(v)).toBe(true);
      }
    });
  });

  describe("obs — the run log gains nothing and leaks nothing", () => {
    test("one replaceExercise link line per replace, and no teacher content", async () => {
      const t = await newTeacher();
      const sid = await newSubject(t);
      await replace(t, sid, "ex1", "logged-variant");

      const runlog = path.join(process.env.CHAR_ROOTDIR ?? ".", "run-log.jsonl");
      const lines = fs
        .readFileSync(runlog, "utf8")
        .split("\n")
        .filter(Boolean)
        .map((l) => {
          try {
            return JSON.parse(l);
          } catch {
            return null;
          }
        })
        .filter((o) => o && o.subjectId === sid && o.op === "replaceExercise");
      expect(lines).toHaveLength(1);
      // No titles, no statements, no Arabic — the guarantee that makes the log safe.
      const asText = JSON.stringify(lines[0]);
      expect(asText).not.toContain("logged-variant");
      expect(asText).not.toMatch(/[؀-ۿ]/);
    });

    test("a store.write line is emitted for the replace", async () => {
      const t = await newTeacher();
      const sid = await newSubject(t);
      await replace(t, sid, "ex1", "observed");
      const log = fs.readFileSync(LOG, "utf8");
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
        .find((o) => o && o.msg === "store.write" && o.subjectId === sid);
      expect(line).toBeDefined();
      expect(line.op).toBe("replaceExercise");
    });
  });
});
