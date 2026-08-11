/**
 * be-2 — progress: the read synthesizes, the write compare-and-sets.
 *
 * TWO RULES THIS SUITE EXISTS TO DEFEND, and each has a failure behind it.
 *
 * 1. **Week 0 is a state, not an error.** A class with no progress document is what "not
 *    started" IS (contract §0), so `GET` synthesizes `{markedWeek: 0, entries: [], rev: 0}`
 *    with a 200 and creates nothing. A 404 there would make the empty state — the state
 *    EVERY class is in on the day it is created — indistinguishable from a bad id.
 *
 * 2. **A CAS loss is an immediate 409, with no server-side retry.** This deliberately
 *    differs from `replaceExercise`, which re-reads and retries five times: a refine merges
 *    ONE exercise into whatever the latest document is, so retrying preserves intent. A
 *    progress PUT is whole-state intent over what the teacher was LOOKING AT — if `rev`
 *    moved, their view is stale and only the teacher can re-decide. The concurrency clauses
 *    at the bottom are the heart of this suite: N writers at one `rev` must yield exactly
 *    one 200 and N−1 conflicts, with `rev` advancing exactly once and the winner's value
 *    stored whole. A CAS suite that never actually races proves nothing, so those clauses
 *    dispatch every request before awaiting any of them.
 *
 * The identity fields are the third rule and the quiet one: a class is pointed at a
 * programme by `docKey + edition`, stamped ONCE at insert. `transcriptionRev` is provenance
 * and never identity (contract §1) — collapsing the two axes would make "we fixed a typo in
 * our transcription" read as "the ministry changed the syllabus" and re-point every class
 * mid-year. The restamp clause proves the stamp survives even when the class's own stream
 * is changed underneath it.
 *
 * ⚠ The teacherId is a BEARER value. A log line carries an 8-char PREFIX, never the whole
 * 32 hex — the discipline `teacher.rejected` keeps (src/teacher.ts:76).
 *
 * PRECONDITION: the lane is up. A hollow run is RED in job mode — WF-82.
 */
const { readFileSync } = require("node:fs");
const { randomBytes } = require("node:crypto");
const { ObjectId, MongoClient } = require("mongodb");
const { describeIfLane } = require("guard");

const BE = process.env.CHAR_BE_URL || "http://localhost:9000";
const LOG = process.env.CHAR_BE_LOG || "";
const MONGO = "mongodb://127.0.0.1:27017";
const DB = "teacher_saas";

/**
 * The six stream values and the week total, RECORDED (SEED §2, 2026-08-11): every corpus
 * document runs weeks 1..27 exactly.
 *
 * `RECORDED_TOTAL_WEEKS` is pinned here and then used ONLY to guard the corpus. Every
 * bounds clause below derives its boundary from `programme.totalWeeks` in the response
 * under test, never from this constant — because the risk the SEED flagged is precisely a
 * service that hardcodes 27 and passes a suite that hardcodes 27 too. The one clause that
 * compares them is the guard: if the ministry corpus is reloaded with a different total,
 * this suite goes red, which is the sub-issue's ask-when and not a test to edit around.
 */
const STREAMS = [
  "شعبة الرياضيات",
  "تقني رياضي",
  "علوم تجريبية",
  "تسيير واقتصاد",
  "آداب وفلسفة",
  "لغات أجنبية",
];
const RECORDED_TOTAL_WEEKS = 27;

/** The `/api` index as recorded before this slice, plus be-1's addition. It may GROW. */
const RECORDED_ROUTES = [
  "/health",
  "/api/skills",
  "/api/generate",
  "/api/teacher",
  "/api/subjects",
  "/api/exams",
  "/api/classes",
  "/api/auth/signup",
  "/api/auth/signin",
  "/api/auth/recover",
];

const HEX24_LOWER = /^[0-9a-f]{24}$/;
const HEX32 = /[0-9a-f]{32}/;

/** The wire shape of a progress object — ONE key set, whether synthesized or stored. */
const PROGRESS_KEYS = [
  "classId",
  "entries",
  "markedWeek",
  "programmeDocKey",
  "programmeEdition",
  "programmeTranscriptionRev",
  "rev",
  "updatedAt",
];

/**
 * `toSummary`'s recorded key set (`subjects.ts:189-202`), SEED §3. Pinned here so that a
 * `classId` key arriving early — it belongs to be-3, not to this sub-issue — reads as this
 * slice leaking into a surface it was frozen out of.
 *
 * ── AMENDED BY be-3 (WF-65, declared supersession) ────────────────────────────────────
 * `classId` has now arrived, on time and by charter: adding exactly this one key to
 * `toRecord` and `toSummary` IS be-3's declared scope (stack spec be-3 Delta; contract §5,
 * "Projections"). The clause above was a TEMPORAL guard — "not yet, and not from be-2" —
 * and be-3 is the sub-issue it was waiting for.
 *
 * What is amended is the expected SET, never the assertion: the clause below still demands
 * exact set equality, so a second key, a leaked `teacherId` or a dropped `topic` is as red
 * as it ever was. be-3's own suite pins the same key set independently
 * (`subjects-classid.characterization.test.js`, "the perimeter"), so the invariant is now
 * held in two places rather than relaxed in one.
 */
const RECORDED_SUMMARY_KEYS = [
  "classId",
  "costUsd",
  "createdAt",
  "durationMs",
  "exerciseCount",
  "genCorrelationId",
  "id",
  "title",
  "topic",
  "totalPoints",
  "updatedAt",
];

let mongo;
let db;
const PLANTED_CLASSES = []; // ObjectIds this suite created, removed in afterAll
const PLANTED_SUBJECTS = []; // ditto for the one subject the perimeter clause needs
const MINTED_TEACHERS = []; // anonymous rows this suite minted, removed in afterAll

async function call(method, p, { body, teacher, correlationId } = {}) {
  const bodyless = method === "GET" || method === "HEAD";
  const started = Date.now();
  const res = await fetch(`${BE}${p}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(teacher ? { "x-teacher-id": teacher } : {}),
      ...(correlationId ? { "x-correlation-id": correlationId } : {}),
    },
    ...(bodyless || body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const parsed = await res.json();
  return { status: res.status, body: parsed, ms: Date.now() - started };
}

async function mintTeacher() {
  const { body } = await call("POST", "/api/teacher");
  MINTED_TEACHERS.push(body.teacherId);
  return body.teacherId;
}

/** A class, created through the real surface — be-1's route is the only way one exists. */
async function makeClass(teacher, stream = "شعبة الرياضيات", name = "3ر1") {
  const { status, body } = await call("POST", "/api/classes", {
    teacher,
    body: { name, stream },
  });
  if (status !== 201) throw new Error(`class create failed: ${status} ${JSON.stringify(body)}`);
  PLANTED_CLASSES.push(new ObjectId(body.class.id));
  return body.class;
}

const getProgress = (teacher, classId) => call("GET", `/api/progress/${classId}`, { teacher });
const putProgress = (teacher, classId, body) =>
  call("PUT", `/api/progress/${classId}`, { teacher, body });

/** The stored document, read straight out of Mongo — the store is the arbiter, not the API. */
const storedProgress = (classId) => db.collection("progress").findOne({ classId });

/**
 * The log is written by a separate process through a redirect, so a line can land a beat
 * after the response. Poll briefly rather than sleeping a fixed amount.
 */
async function findLogLines(predicate, { tries = 20, waitMs = 50, expect: want = 1 } = {}) {
  let hits = [];
  for (let i = 0; i < tries; i++) {
    hits = readFileSync(LOG, "utf8")
      .split("\n")
      .filter((l) => l.trim() !== "")
      .map((l) => {
        try {
          return JSON.parse(l);
        } catch (_e) {
          return null;
        }
      })
      .filter((o) => o && predicate(o));
    if (hits.length >= want) return hits;
    await new Promise((r) => setTimeout(r, waitMs));
  }
  return hits;
}

function requireLog() {
  if (!LOG) throw new Error("CHAR_BE_LOG is unset — run via tools/ci, not jest directly");
}

describeIfLane(BE, "be-2 — progress: synthesized on read, compare-and-set on write", () => {
  beforeAll(async () => {
    mongo = new MongoClient(MONGO);
    await mongo.connect();
    db = mongo.db(DB);
  });

  afterAll(async () => {
    if (db) {
      if (PLANTED_CLASSES.length > 0) {
        const ids = PLANTED_CLASSES.map((o) => o.toHexString());
        await db.collection("progress").deleteMany({ classId: { $in: ids } });
        await db.collection("classes").deleteMany({ _id: { $in: PLANTED_CLASSES } });
      }
      if (PLANTED_SUBJECTS.length > 0) {
        await db.collection("subjects").deleteMany({ _id: { $in: PLANTED_SUBJECTS } });
      }
      if (MINTED_TEACHERS.length > 0) {
        await db.collection("teachers").deleteMany({ teacherId: { $in: MINTED_TEACHERS } });
      }
    }
    if (mongo) await mongo.close();
  });

  describe("GET — week 0 is a STATE, synthesized, never an error", () => {
    test("a class that was never written to answers 200 with the canonical empty shape", async () => {
      const teacher = await mintTeacher();
      const klass = await makeClass(teacher);
      const { status, body } = await getProgress(teacher, klass.id);

      expect(status).toBe(200);
      expect(body.progress).toEqual({
        classId: klass.id,
        markedWeek: 0,
        entries: [],
        rev: 0,
        programmeDocKey: null,
        programmeEdition: null,
        programmeTranscriptionRev: null,
        updatedAt: null,
      });
      expect(body.correlationId).toBeTruthy();
    });

    test("the response carries exactly {progress, programme, correlationId}", async () => {
      const teacher = await mintTeacher();
      const klass = await makeClass(teacher);
      const { body } = await getProgress(teacher, klass.id);
      expect(Object.keys(body).sort()).toEqual(["correlationId", "programme", "progress"]);
      expect(Object.keys(body.programme).sort()).toEqual(["docKey", "edition", "totalWeeks"]);
    });

    test("the SYNTHESIZED shape and a STORED one carry the identical key set", async () => {
      // One shape, whether or not a document exists. A key that appears only after the
      // first write would make `fe` branch on which of two shapes it received, and the
      // branch it forgot would be the empty one — the state every class starts in.
      const teacher = await mintTeacher();
      const klass = await makeClass(teacher);
      const empty = await getProgress(teacher, klass.id);
      await putProgress(teacher, klass.id, { rev: 0, markedWeek: 3 });
      const stored = await getProgress(teacher, klass.id);
      expect(Object.keys(empty.body.progress).sort()).toEqual(PROGRESS_KEYS);
      expect(Object.keys(stored.body.progress).sort()).toEqual(PROGRESS_KEYS);
    });

    test("a GET creates NOTHING — the document is lazy, born of the first PUT", async () => {
      // Contract §0: class creation stays a single insert. A GET that materialised a
      // document would make "has this teacher positioned this class?" unanswerable.
      const teacher = await mintTeacher();
      const klass = await makeClass(teacher);
      await getProgress(teacher, klass.id);
      await getProgress(teacher, klass.id);
      expect(await storedProgress(klass.id)).toBeNull();
    });

    test("the corpus still runs weeks 1..27 — the guard on every bounds clause below", async () => {
      const totals = await db.collection("programmes").distinct("totals.weeks");
      expect(totals).toEqual([RECORDED_TOTAL_WEEKS]);
    });

    test.each(STREAMS)(
      "the programme summary is resolved from THAT class's own stream: %s",
      async (stream) => {
        // Six streams over FIVE documents — the lettres record carries two — so a class
        // must get ITS document, not the first one that matched something.
        const teacher = await mintTeacher();
        const klass = await makeClass(teacher, stream, "قسم");
        const { status, body } = await getProgress(teacher, klass.id);
        const doc = await db.collection("programmes").findOne({ streams: stream, current: true });

        expect(status).toBe(200);
        expect(body.programme).toEqual({
          docKey: doc.docKey,
          edition: doc.edition,
          totalWeeks: doc.totals.weeks,
        });
      },
    );
  });

  describe("PUT — the first write inserts, stamps identity, and answers rev 1", () => {
    test("PUT {rev: 0, markedWeek: 8} -> 200 with rev 1 and the identity stamped", async () => {
      const teacher = await mintTeacher();
      const klass = await makeClass(teacher);
      const doc = await db
        .collection("programmes")
        .findOne({ streams: "شعبة الرياضيات", current: true });

      const { status, body } = await putProgress(teacher, klass.id, { rev: 0, markedWeek: 8 });

      expect(status).toBe(200);
      expect(body.progress.rev).toBe(1);
      expect(body.progress.markedWeek).toBe(8);
      expect(body.progress.classId).toBe(klass.id);
      expect(body.progress.programmeDocKey).toBe(doc.docKey);
      expect(body.progress.programmeEdition).toBe(doc.edition);
      expect(body.progress.programmeTranscriptionRev).toBe(doc.transcriptionRev);
      expect(new Date(body.progress.updatedAt).toISOString()).toBe(body.progress.updatedAt);
      expect(body.correlationId).toBeTruthy();
    });

    test("the PUT response carries exactly {progress, correlationId} — no programme block", async () => {
      // The programme summary is a READ concern (contract §4): `fe` gets the week
      // picker's bound from the GET. Returning it here too would give two sources for
      // one bound, and the stale one would win whichever way they disagreed.
      const teacher = await mintTeacher();
      const klass = await makeClass(teacher);
      const { body } = await putProgress(teacher, klass.id, { rev: 0, markedWeek: 1 });
      expect(Object.keys(body).sort()).toEqual(["correlationId", "progress"]);
    });

    test("a subsequent read returns the stamped identity VERBATIM", async () => {
      const teacher = await mintTeacher();
      const klass = await makeClass(teacher);
      const { body: written } = await putProgress(teacher, klass.id, { rev: 0, markedWeek: 8 });
      const { body: read } = await getProgress(teacher, klass.id);
      expect(read.progress).toEqual(written.progress);
    });

    test("a LATER PUT never re-stamps the identity — even when the class's stream moved", async () => {
      // Contract §1: identity is `docKey + edition`, written ONCE. Re-pointing a class at
      // another programme is a future, explicit surface — never a side effect of a write.
      // The class's stream is moved underneath the document to make the clause executable:
      // if the PUT re-resolved, the stamp would follow the stream.
      const teacher = await mintTeacher();
      const klass = await makeClass(teacher, "شعبة الرياضيات");
      const { body: first } = await putProgress(teacher, klass.id, { rev: 0, markedWeek: 4 });

      await db
        .collection("classes")
        .updateOne({ _id: new ObjectId(klass.id) }, { $set: { stream: "علوم تجريبية" } });
      const sciences = await db
        .collection("programmes")
        .findOne({ streams: "علوم تجريبية", current: true });

      const { status, body } = await putProgress(teacher, klass.id, { rev: 1, markedWeek: 5 });
      expect(status).toBe(200);
      expect(body.progress.programmeDocKey).toBe(first.progress.programmeDocKey);
      expect(body.progress.programmeEdition).toBe(first.progress.programmeEdition);
      expect(body.progress.programmeTranscriptionRev).toBe(
        first.progress.programmeTranscriptionRev,
      );
      expect(body.progress.programmeDocKey).not.toBe(sciences.docKey);

      // …while `programme` on the READ is resolved LIVE and does follow the stream. The
      // two are different questions: "what is this class studying now" vs "which
      // programme was this position recorded against".
      const { body: read } = await getProgress(teacher, klass.id);
      expect(read.programme.docKey).toBe(sciences.docKey);
      expect(read.progress.programmeDocKey).toBe(first.progress.programmeDocKey);
    });

    test("each successful PUT advances rev by exactly one", async () => {
      const teacher = await mintTeacher();
      const klass = await makeClass(teacher);
      for (let expected = 1; expected <= 3; expected++) {
        const { status, body } = await putProgress(teacher, klass.id, {
          rev: expected - 1,
          markedWeek: expected,
        });
        expect(status).toBe(200);
        expect(body.progress.rev).toBe(expected);
      }
      const stored = await storedProgress(klass.id);
      expect(stored.rev).toBe(3);
      expect(stored.markedWeek).toBe(3);
      // Ownership is DENORMALISED into the document, which is what lets every read scope
      // it inside the query instead of checking after the fetch (contract §7.5).
      expect(stored.teacherId).toBe(teacher);
    });
  });

  describe("markedWeek — bounded by the class's OWN programme, never by a constant", () => {
    test("0 and totalWeeks are both accepted — the boundaries the rejections are measured against", async () => {
      const teacher = await mintTeacher();
      const klass = await makeClass(teacher);
      const { body: seen } = await getProgress(teacher, klass.id);
      const total = seen.programme.totalWeeks;

      const zero = await putProgress(teacher, klass.id, { rev: 0, markedWeek: 0 });
      expect(zero.status).toBe(200);
      const top = await putProgress(teacher, klass.id, { rev: 1, markedWeek: total });
      expect(top.status).toBe(200);
      expect(top.body.progress.markedWeek).toBe(total);
    });

    test("totalWeeks + 1 is refused — the bound comes from the RESPONSE, not from 27", async () => {
      const teacher = await mintTeacher();
      const klass = await makeClass(teacher);
      const { body: seen } = await getProgress(teacher, klass.id);
      const { status, body } = await putProgress(teacher, klass.id, {
        rev: 0,
        markedWeek: seen.programme.totalWeeks + 1,
      });
      expect(status).toBe(400);
      expect(body.error.type).toBe("invalid_request");
      expect(await storedProgress(klass.id)).toBeNull();
    });

    test.each([
      ["a negative week", -1],
      ["a fractional week", 1.5],
      ["a numeric STRING", "8"],
      ["null", null],
      ["a boolean", true],
      ["an absurd week", 1e9],
      ["NaN over the wire (null after JSON)", Number.NaN],
    ])("%s -> 400 invalid_request", async (_label, markedWeek) => {
      // Week NUMBERS are integers. Unit DURATIONS may be fractional (أسبوع ونصف) — that
      // is a different field in a different collection, and conflating them is how a
      // half-week duration would arrive as a position.
      const teacher = await mintTeacher();
      const klass = await makeClass(teacher);
      const { status, body } = await putProgress(teacher, klass.id, { rev: 0, markedWeek });
      expect(status).toBe(400);
      expect(body.error.type).toBe("invalid_request");
      expect(body.correlationId).toBeTruthy();
    });

    test("a missing markedWeek -> 400 — it is REQUIRED, not a partial update", async () => {
      const teacher = await mintTeacher();
      const klass = await makeClass(teacher);
      const { status, body } = await putProgress(teacher, klass.id, { rev: 0 });
      expect(status).toBe(400);
      expect(body.error.type).toBe("invalid_request");
    });
  });

  describe("rev — required, and an integer ≥ 0", () => {
    test.each([
      ["missing", undefined],
      ["a negative rev", -1],
      ["a fractional rev", 0.5],
      ["a numeric STRING", "0"],
      ["null", null],
    ])("%s -> 400 invalid_request", async (_label, rev) => {
      const teacher = await mintTeacher();
      const klass = await makeClass(teacher);
      const body = rev === undefined ? { markedWeek: 3 } : { rev, markedWeek: 3 };
      const res = await putProgress(teacher, klass.id, body);
      expect(res.status).toBe(400);
      expect(res.body.error.type).toBe("invalid_request");
    });

    test("a malformed body -> 400 WITH a correlationId (the middleware-order pin)", async () => {
      const teacher = await mintTeacher();
      const klass = await makeClass(teacher);
      const res = await fetch(`${BE}/api/progress/${klass.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json", "x-teacher-id": teacher },
        body: "{not json",
      });
      const body = await res.json();
      expect(res.status).toBe(400);
      expect(body.error.type).toBe("invalid_request");
      expect(body.correlationId).toBeTruthy();
    });
  });

  describe("entry — upserted BY WEEK, so a skipped week's note survives", () => {
    test("a note written at week 5 survives a later write that only advances markedWeek", async () => {
      // THE CLAUSE THE FEATURE EXISTS FOR. Rebuilding `entries` wholesale on every write
      // would silently drop the one thing the teacher typed by hand.
      const teacher = await mintTeacher();
      const klass = await makeClass(teacher);
      await putProgress(teacher, klass.id, {
        rev: 0,
        markedWeek: 5,
        entry: { week: 5, status: "skipped", note: "عطلة" },
      });
      const { body } = await putProgress(teacher, klass.id, { rev: 1, markedWeek: 9 });

      expect(body.progress.markedWeek).toBe(9);
      expect(body.progress.entries).toHaveLength(1);
      expect(body.progress.entries[0]).toMatchObject({ week: 5, status: "skipped", note: "عطلة" });
    });

    test("re-upserting week 5 REPLACES that entry and never duplicates it", async () => {
      const teacher = await mintTeacher();
      const klass = await makeClass(teacher);
      await putProgress(teacher, klass.id, {
        rev: 0,
        markedWeek: 5,
        entry: { week: 5, status: "skipped", note: "عطلة" },
      });
      const { body } = await putProgress(teacher, klass.id, {
        rev: 1,
        markedWeek: 5,
        entry: { week: 5, status: "planned" },
      });
      expect(body.progress.entries).toHaveLength(1);
      expect(body.progress.entries[0].week).toBe(5);
      expect(body.progress.entries[0].status).toBe("planned");
      // The whole entry is replaced, so the superseded note does not linger under a
      // status that no longer explains it.
      expect(body.progress.entries[0].note).toBeUndefined();
    });

    test("a 'done' entry gains a server-stamped completedAt; the other two statuses do not", async () => {
      const teacher = await mintTeacher();
      const klass = await makeClass(teacher);
      const before = Date.now();
      const { body } = await putProgress(teacher, klass.id, {
        rev: 0,
        markedWeek: 6,
        entry: { week: 6, status: "done" },
      });
      const done = body.progress.entries[0];
      expect(new Date(done.completedAt).toISOString()).toBe(done.completedAt);
      const stamped = new Date(done.completedAt).getTime();
      expect(stamped).toBeGreaterThanOrEqual(before - 1000);
      expect(stamped).toBeLessThanOrEqual(Date.now() + 1000);

      const planned = await putProgress(teacher, klass.id, {
        rev: 1,
        markedWeek: 6,
        entry: { week: 7, status: "planned" },
      });
      const skipped = await putProgress(teacher, klass.id, {
        rev: 2,
        markedWeek: 6,
        entry: { week: 8, status: "skipped" },
      });
      expect(planned.body.progress.entries.find((e) => e.week === 7).completedAt).toBeUndefined();
      expect(skipped.body.progress.entries.find((e) => e.week === 8).completedAt).toBeUndefined();
    });

    test("a client-supplied completedAt is IGNORED — the server stamps it", async () => {
      const teacher = await mintTeacher();
      const klass = await makeClass(teacher);
      const { body } = await putProgress(teacher, klass.id, {
        rev: 0,
        markedWeek: 6,
        entry: { week: 6, status: "done", completedAt: "1999-01-01T00:00:00.000Z" },
      });
      expect(body.progress.entries[0].completedAt).not.toBe("1999-01-01T00:00:00.000Z");
    });

    test("entries come back week-ASCENDING whatever order they were written in", async () => {
      const teacher = await mintTeacher();
      const klass = await makeClass(teacher);
      await putProgress(teacher, klass.id, {
        rev: 0,
        markedWeek: 9,
        entry: { week: 7, status: "done" },
      });
      await putProgress(teacher, klass.id, {
        rev: 1,
        markedWeek: 9,
        entry: { week: 3, status: "planned" },
      });
      const { body } = await putProgress(teacher, klass.id, {
        rev: 2,
        markedWeek: 9,
        entry: { week: 5, status: "skipped" },
      });
      expect(body.progress.entries.map((e) => e.week)).toEqual([3, 5, 7]);
    });

    test.each([
      ["a capitalised status", "Done"],
      ["a near-miss status", "complete"],
      ["an empty status", ""],
      ["a missing status", undefined],
      ["a numeric status", 7],
      ["a null status", null],
    ])("%s -> 400 invalid_request (the allow-list, one probe per variant)", async (_l, status) => {
      const teacher = await mintTeacher();
      const klass = await makeClass(teacher);
      const entry = status === undefined ? { week: 5 } : { week: 5, status };
      const res = await putProgress(teacher, klass.id, { rev: 0, markedWeek: 5, entry });
      expect(res.status).toBe(400);
      expect(res.body.error.type).toBe("invalid_request");
      expect(await storedProgress(klass.id)).toBeNull();
    });

    test("week 1 and week totalWeeks are accepted as entry weeks", async () => {
      const teacher = await mintTeacher();
      const klass = await makeClass(teacher);
      const { body: seen } = await getProgress(teacher, klass.id);
      const total = seen.programme.totalWeeks;
      const low = await putProgress(teacher, klass.id, {
        rev: 0,
        markedWeek: 1,
        entry: { week: 1, status: "done" },
      });
      expect(low.status).toBe(200);
      const high = await putProgress(teacher, klass.id, {
        rev: 1,
        markedWeek: 1,
        entry: { week: total, status: "planned" },
      });
      expect(high.status).toBe(200);
    });

    test.each([
      ["week 0 — entries are 1-based, unlike markedWeek", 0],
      ["a negative week", -1],
      ["a fractional week", 2.5],
      ["a numeric STRING", "5"],
      ["a missing week", undefined],
    ])("an entry with %s -> 400 invalid_request", async (_label, week) => {
      const teacher = await mintTeacher();
      const klass = await makeClass(teacher);
      const entry = week === undefined ? { status: "done" } : { week, status: "done" };
      const res = await putProgress(teacher, klass.id, { rev: 0, markedWeek: 5, entry });
      expect(res.status).toBe(400);
      expect(res.body.error.type).toBe("invalid_request");
    });

    test("an entry week ABOVE the class's own totalWeeks -> 400", async () => {
      const teacher = await mintTeacher();
      const klass = await makeClass(teacher);
      const { body: seen } = await getProgress(teacher, klass.id);
      const res = await putProgress(teacher, klass.id, {
        rev: 0,
        markedWeek: 5,
        entry: { week: seen.programme.totalWeeks + 1, status: "done" },
      });
      expect(res.status).toBe(400);
      expect(res.body.error.type).toBe("invalid_request");
    });

    test("a 500-char note is accepted; 501 is not", async () => {
      const teacher = await mintTeacher();
      const klass = await makeClass(teacher);
      const ok = await putProgress(teacher, klass.id, {
        rev: 0,
        markedWeek: 5,
        entry: { week: 5, status: "done", note: "م".repeat(500) },
      });
      expect(ok.status).toBe(200);
      const tooLong = await putProgress(teacher, klass.id, {
        rev: 1,
        markedWeek: 5,
        entry: { week: 5, status: "done", note: "م".repeat(501) },
      });
      expect(tooLong.status).toBe(400);
      expect(tooLong.body.error.type).toBe("invalid_request");
    });

    test.each([
      ["a numeric note", 7],
      ["an object note", { text: "x" }],
      ["a null note", null],
    ])("%s -> 400 invalid_request", async (_label, note) => {
      const teacher = await mintTeacher();
      const klass = await makeClass(teacher);
      const res = await putProgress(teacher, klass.id, {
        rev: 0,
        markedWeek: 5,
        entry: { week: 5, status: "done", note },
      });
      expect(res.status).toBe(400);
      expect(res.body.error.type).toBe("invalid_request");
    });

    test.each([
      ["a number", 7],
      ["a string", "week 5"],
      ["an array", [{ week: 5, status: "done" }]],
      ["null", null],
    ])("an entry that is %s -> 400 invalid_request", async (_label, entry) => {
      const teacher = await mintTeacher();
      const klass = await makeClass(teacher);
      const res = await putProgress(teacher, klass.id, { rev: 0, markedWeek: 5, entry });
      expect(res.status).toBe(400);
      expect(res.body.error.type).toBe("invalid_request");
    });

    test("an entry carrying an unknown key -> 400 — the shape is an allow-list", async () => {
      const teacher = await mintTeacher();
      const klass = await makeClass(teacher);
      const res = await putProgress(teacher, klass.id, {
        rev: 0,
        markedWeek: 5,
        entry: { week: 5, status: "done", teacherId: "x" },
      });
      expect(res.status).toBe(400);
      expect(res.body.error.type).toBe("invalid_request");
    });

    test("no entry at all is fine — `entry` is OPTIONAL", async () => {
      const teacher = await mintTeacher();
      const klass = await makeClass(teacher);
      const { status, body } = await putProgress(teacher, klass.id, { rev: 0, markedWeek: 2 });
      expect(status).toBe(200);
      expect(body.progress.entries).toEqual([]);
    });
  });

  describe("CAS — a stale rev loses IMMEDIATELY, and loses nothing", () => {
    test("a stale rev -> 409 conflict, with the stored document untouched", async () => {
      const teacher = await mintTeacher();
      const klass = await makeClass(teacher);
      await putProgress(teacher, klass.id, { rev: 0, markedWeek: 4 });

      const { status, body, ms } = await putProgress(teacher, klass.id, {
        rev: 0,
        markedWeek: 20,
      });
      expect(status).toBe(409);
      expect(body.error.type).toBe("conflict");
      expect(body.correlationId).toBeTruthy();

      // No server-side retry (contract §0). `replaceExercise` re-reads five times because
      // a refine merges ONE exercise into the latest document; a progress PUT is
      // whole-state intent over a view that has moved, so only the teacher can re-decide.
      expect(ms).toBeLessThan(500);

      const stored = await storedProgress(klass.id);
      expect(stored.rev).toBe(1);
      expect(stored.markedWeek).toBe(4);
    });

    test("a FUTURE rev loses too — the CAS is equality, not 'at least'", async () => {
      const teacher = await mintTeacher();
      const klass = await makeClass(teacher);
      await putProgress(teacher, klass.id, { rev: 0, markedWeek: 4 });
      const { status, body } = await putProgress(teacher, klass.id, { rev: 7, markedWeek: 6 });
      expect(status).toBe(409);
      expect(body.error.type).toBe("conflict");
      const stored = await storedProgress(klass.id);
      expect(stored.rev).toBe(1);
      expect(stored.markedWeek).toBe(4);
    });

    test("rev > 0 against a class with NO document -> 409, and creates nothing", async () => {
      // The stored rev is 0 when no document exists (contract §4). A non-zero rev is a
      // caller describing a document that never existed — it must not be able to conjure
      // one at a rev of its own choosing.
      const teacher = await mintTeacher();
      const klass = await makeClass(teacher);
      const { status, body } = await putProgress(teacher, klass.id, { rev: 3, markedWeek: 5 });
      expect(status).toBe(409);
      expect(body.error.type).toBe("conflict");
      expect(await storedProgress(klass.id)).toBeNull();
    });

    test("TWO CONCURRENT first writes -> one 200, one 409, ONE document at rev 1", async () => {
      // Both carry rev 0 and neither can see the other. The unique {classId: 1} index is
      // the tiebreak: the loser's insert is a duplicate key, which maps to the same 409 a
      // CAS loss does (contract §0). Dispatched before either is awaited — a race that
      // does not actually race proves nothing.
      const teacher = await mintTeacher();
      const klass = await makeClass(teacher);

      const results = await Promise.all([
        putProgress(teacher, klass.id, { rev: 0, markedWeek: 11 }),
        putProgress(teacher, klass.id, { rev: 0, markedWeek: 22 }),
      ]);

      const won = results.filter((r) => r.status === 200);
      const lost = results.filter((r) => r.status === 409);
      expect(won).toHaveLength(1);
      expect(lost).toHaveLength(1);
      expect(lost[0].body.error.type).toBe("conflict");
      expect(won[0].body.progress.rev).toBe(1);

      expect(await db.collection("progress").countDocuments({ classId: klass.id })).toBe(1);
      const stored = await storedProgress(klass.id);
      expect(stored.rev).toBe(1);
      // NO LOST UPDATE: the survivor is one writer's value whole, never a blend.
      expect(stored.markedWeek).toBe(won[0].body.progress.markedWeek);
      expect([11, 22]).toContain(stored.markedWeek);
    });

    test("FIVE CONCURRENT writes at one rev -> one 200, four 409, rev advances exactly once", async () => {
      // The heart of this sub-issue. Five writers, one `rev`, five different markedWeeks
      // so a lost update is visible in the stored value rather than merely improbable.
      const teacher = await mintTeacher();
      const klass = await makeClass(teacher);
      await putProgress(teacher, klass.id, { rev: 0, markedWeek: 1 });

      const weeks = [2, 3, 4, 5, 6];
      const results = await Promise.all(
        weeks.map((markedWeek) => putProgress(teacher, klass.id, { rev: 1, markedWeek })),
      );

      const won = results.filter((r) => r.status === 200);
      const lost = results.filter((r) => r.status === 409);
      expect(won).toHaveLength(1);
      expect(lost).toHaveLength(4);
      for (const l of lost) expect(l.body.error.type).toBe("conflict");
      expect(won[0].body.progress.rev).toBe(2);

      const stored = await storedProgress(klass.id);
      expect(stored.rev).toBe(2);
      expect(stored.markedWeek).toBe(won[0].body.progress.markedWeek);
      expect(weeks).toContain(stored.markedWeek);
      expect(await db.collection("progress").countDocuments({ classId: klass.id })).toBe(1);
    });

    test("a losing writer's ENTRY is not applied — the whole write is refused", async () => {
      const teacher = await mintTeacher();
      const klass = await makeClass(teacher);
      await putProgress(teacher, klass.id, { rev: 0, markedWeek: 4 });
      await putProgress(teacher, klass.id, {
        rev: 0,
        markedWeek: 4,
        entry: { week: 4, status: "done", note: "should not land" },
      });
      const stored = await storedProgress(klass.id);
      expect(stored.entries).toEqual([]);
      expect(stored.rev).toBe(1);
    });
  });

  describe("THE CONCURRENCY LOG — one win, N−1 cas_loss, correlated", () => {
    test("the five-writer drill leaves exactly one win and four cas_loss lines", async () => {
      // SEED §5, and the reason be-1 ran first: a CAS loss that emits nothing is
      // invisible, and the operator cannot tell "the concurrency control worked" from "a
      // write vanished". The line count IS the oracle here.
      requireLog();
      const teacher = await mintTeacher();
      const klass = await makeClass(teacher);
      await putProgress(teacher, klass.id, { rev: 0, markedWeek: 1 });

      const results = await Promise.all(
        [2, 3, 4, 5, 6].map((markedWeek) => putProgress(teacher, klass.id, { rev: 1, markedWeek })),
      );
      const ids = results.map((r) => r.body.correlationId);
      expect(new Set(ids).size).toBe(5); // five distinct requests, five distinct ids

      const lines = await findLogLines(
        (o) => o.event === "progress.write" && ids.includes(o.correlationId),
        { expect: 5 },
      );
      expect(lines).toHaveLength(5);
      expect(lines.filter((l) => l.outcome === "win")).toHaveLength(1);
      expect(lines.filter((l) => l.outcome === "cas_loss")).toHaveLength(4);

      // Every line is correlated to a response, and to the right one.
      const winner = results.find((r) => r.status === 200);
      const winLine = lines.find((l) => l.outcome === "win");
      expect(winLine.correlationId).toBe(winner.body.correlationId);
      expect(winLine.classId).toBe(klass.id);
      expect(winLine.rev).toBe(winner.body.progress.rev);
      expect(winLine.week).toBe(winner.body.progress.markedWeek);

      const lostIds = results.filter((r) => r.status === 409).map((r) => r.body.correlationId);
      expect(lines.filter((l) => l.outcome === "cas_loss").map((l) => l.correlationId).sort()).toEqual(
        [...lostIds].sort(),
      );
    });

    test("every progress line carries an 8-char teacherIdPrefix and never the bearer value", async () => {
      requireLog();
      const teacher = await mintTeacher();
      const klass = await makeClass(teacher);
      const { body } = await putProgress(teacher, klass.id, { rev: 0, markedWeek: 3 });
      const lines = await findLogLines((o) => o.correlationId === body.correlationId);
      expect(lines.length).toBeGreaterThan(0);
      const write = lines.find((l) => l.event === "progress.write");
      // AMENDED by be-6 (WF-65 declared supersession): the key is `teacherIdPrefix`, the
      // name teacher.ts and routes/auth.ts already used at six call sites. The VALUE and
      // the 8-char slice did not move — only what the field is called, and `teacher` is
      // now asserted absent so the rename is complete rather than doubled.
      expect(write.teacherIdPrefix).toBe(teacher.slice(0, 8));
      expect(write.teacherIdPrefix).toHaveLength(8);
      expect(write.teacher).toBeUndefined();
      for (const line of lines) {
        expect(JSON.stringify(line)).not.toMatch(HEX32);
        expect(JSON.stringify(line)).not.toContain(teacher);
      }
    });

    test("a successful write logs exactly ONE line — a retry loop would show more", async () => {
      requireLog();
      const teacher = await mintTeacher();
      const klass = await makeClass(teacher);
      const { body } = await putProgress(teacher, klass.id, { rev: 0, markedWeek: 3 });
      const lines = await findLogLines(
        (o) => o.event === "progress.write" && o.correlationId === body.correlationId,
      );
      expect(lines).toHaveLength(1);
      expect(lines[0].outcome).toBe("win");
    });

    test("a REJECTED write (400 / 404) logs no progress.write — the line means a write was decided", async () => {
      requireLog();
      const teacher = await mintTeacher();
      const klass = await makeClass(teacher);
      const bad = await putProgress(teacher, klass.id, { rev: 0, markedWeek: -1 });
      const missing = await putProgress(teacher, new ObjectId().toHexString(), {
        rev: 0,
        markedWeek: 3,
      });
      const ids = [bad.body.correlationId, missing.body.correlationId];
      const lines = await findLogLines(
        (o) => o.event === "progress.write" && ids.includes(o.correlationId),
        { tries: 4 },
      );
      expect(lines).toHaveLength(0);
    });

    test("a GET logs no mutation line — reading is not writing", async () => {
      requireLog();
      const teacher = await mintTeacher();
      const klass = await makeClass(teacher);
      const { body } = await getProgress(teacher, klass.id);
      const lines = await findLogLines(
        (o) => o.event === "progress.write" && o.correlationId === body.correlationId,
        { tries: 4 },
      );
      expect(lines).toHaveLength(0);
    });
  });

  describe("404 class_not_found — existence is not probeable from any angle", () => {
    /**
     * Every unresolvable address, and they must be indistinguishable (contract §6).
     *
     * The uppercase cell is deliberately the probing teacher's OWN class: uppercased, it
     * must still miss. Hex is case-insensitive to `ObjectId`, so this is the one cell that
     * can only pass if the route refuses a non-canonical id itself. Ids in this product
     * are lowercase and case-SENSITIVE (`teacher.ts:19`); one surface accepting a second
     * spelling is how the first comparison someone writes goes wrong.
     */
    async function probes(teacher) {
      const stranger = await mintTeacher();
      const foreign = await makeClass(stranger, "شعبة الرياضيات", "غريب");
      const owned = await makeClass(teacher, "شعبة الرياضيات", "مالك");
      expect(owned.id).toMatch(HEX24_LOWER);
      return [
        ["a well-formed id that never existed", new ObjectId().toHexString()],
        ["ANOTHER teacher's real class", foreign.id],
        ["non-hex garbage", "not-an-id"],
        ["a 12-char hex string", "0123456789ab"],
        ["the UPPERCASE form of the caller's OWN class id", owned.id.toUpperCase()],
        ["an empty-ish id", "%20"],
      ];
    }

    test("GET answers 404 class_not_found to every one, with byte-identical bodies", async () => {
      const teacher = await mintTeacher();
      const cases = await probes(teacher);
      const bodies = [];
      for (const [label, id] of cases) {
        const { status, body } = await getProgress(teacher, id);
        expect([label, status]).toEqual([label, 404]);
        expect(body.error.type).toBe("class_not_found");
        expect(body.correlationId).toBeTruthy();
        bodies.push(JSON.stringify(body.error));
      }
      // ONE answer, byte for byte. Distinguishing "bad shape" from "not yours" would leak
      // which ids are real — the rule `getOwned` already enforces for subjects.
      expect(new Set(bodies).size).toBe(1);
    });

    test("PUT answers 404 class_not_found to every one, with byte-identical bodies", async () => {
      const teacher = await mintTeacher();
      const cases = await probes(teacher);
      const bodies = [];
      for (const [label, id] of cases) {
        // A VALID body on purpose: this clause is about the address, not the payload.
        const { status, body } = await putProgress(teacher, id, { rev: 0, markedWeek: 3 });
        expect([label, status]).toEqual([label, 404]);
        expect(body.error.type).toBe("class_not_found");
        bodies.push(JSON.stringify(body.error));
      }
      expect(new Set(bodies).size).toBe(1);
    });

    test("GET and PUT answer the SAME 404 body — one 'no such class' in this service", async () => {
      const teacher = await mintTeacher();
      const ghost = new ObjectId().toHexString();
      const read = await getProgress(teacher, ghost);
      const write = await putProgress(teacher, ghost, { rev: 0, markedWeek: 3 });
      expect(write.body.error).toEqual(read.body.error);
    });

    test("another teacher's progress is unreachable even after it EXISTS", async () => {
      // The dangerous case: a class with a real document behind it. Ownership is scoped
      // inside the query, so the answer is the same as for a class that never existed.
      const owner = await mintTeacher();
      const stranger = await mintTeacher();
      const klass = await makeClass(owner);
      await putProgress(owner, klass.id, { rev: 0, markedWeek: 12 });

      const read = await getProgress(stranger, klass.id);
      expect(read.status).toBe(404);
      expect(read.body.error.type).toBe("class_not_found");

      const write = await putProgress(stranger, klass.id, { rev: 1, markedWeek: 25 });
      expect(write.status).toBe(404);

      // …and nothing the stranger did touched it.
      const stored = await storedProgress(klass.id);
      expect(stored.markedWeek).toBe(12);
      expect(stored.rev).toBe(1);
    });
  });

  describe("the identity gate is requireTeacher, not a reimplementation", () => {
    let sample;
    beforeAll(async () => {
      const teacher = await mintTeacher();
      sample = await makeClass(teacher);
    });

    const methods = ["GET", "PUT"];

    test.each(methods)("%s with NO header -> 401 teacher_required", async (method) => {
      const { status, body } = await call(method, `/api/progress/${sample.id}`, {
        body: { rev: 0, markedWeek: 3 },
      });
      expect(status).toBe(401);
      expect(body.error.type).toBe("teacher_required");
    });

    test.each(methods)("%s with an UNISSUED 32-hex id -> 401", async (method) => {
      const { status, body } = await call(method, `/api/progress/${sample.id}`, {
        teacher: randomBytes(16).toString("hex"),
        body: { rev: 0, markedWeek: 3 },
      });
      expect(status).toBe(401);
      expect(body.error.type).toBe("teacher_required");
    });

    test.each(methods)("%s with the UPPERCASE of a valid id -> 401 (case-sensitive)", async (method) => {
      const teacher = await mintTeacher();
      const { status } = await call(method, `/api/progress/${sample.id}`, {
        teacher: teacher.toUpperCase(),
        body: { rev: 0, markedWeek: 3 },
      });
      expect(status).toBe(401);
    });

    test("the 401 body is BYTE-IDENTICAL to the recorded gate on /api/subjects", async () => {
      const recorded = await call("GET", "/api/subjects");
      const fromProgress = await call("GET", `/api/progress/${sample.id}`);
      expect(fromProgress.status).toBe(recorded.status);
      expect(fromProgress.body.error).toEqual(recorded.body.error);
    });

    test("the gate fires BEFORE the class lookup — an unknown class is still a 401", async () => {
      // Otherwise an unauthenticated caller could probe class ids through the difference
      // between 401 and 404.
      const { status, body } = await call("GET", `/api/progress/${new ObjectId().toHexString()}`);
      expect(status).toBe(401);
      expect(body.error.type).toBe("teacher_required");
    });
  });

  describe("the perimeter — the index GREW by exactly /api/progress, nothing vanished", () => {
    test.each(RECORDED_ROUTES)("/api still lists %s", async (route) => {
      const { body } = await call("GET", "/api");
      expect(body.routes).toContain(route);
    });

    test("/api now lists /api/progress", async () => {
      const { body } = await call("GET", "/api");
      expect(body.routes).toContain("/api/progress");
    });

    test("/api grew by exactly one entry", async () => {
      const { status, body } = await call("GET", "/api");
      expect(status).toBe(200);
      expect(body.service).toBe("teacher-be");
      expect(body.routes.length).toBe(RECORDED_ROUTES.length + 1);
    });

    test("GET /api/subjects still answers the recorded key set, and only that", async () => {
      // `classId` on a subject is be-3's, not this sub-issue's — see the amendment note on
      // RECORDED_SUMMARY_KEYS. Any OTHER key appearing here would still mean a slice leaked
      // into a surface it was frozen out of.
      const teacher = await mintTeacher();
      const empty = await call("GET", "/api/subjects", { teacher });
      expect(empty.status).toBe(200);
      expect(Object.keys(empty.body).sort()).toEqual(["correlationId", "subjects"]);
      expect(empty.body.subjects).toEqual([]);

      const made = await call("POST", "/api/subjects", {
        teacher,
        body: {
          subject: {
            title: "اختبار",
            meta: { totalPoints: 20, topic: "الدوال" },
            exercises: [{ id: "ex1", points: 20, statement: "…" }],
          },
        },
      });
      expect(made.status).toBe(201);
      PLANTED_SUBJECTS.push(new ObjectId(made.body.id));

      const { body: listed } = await call("GET", "/api/subjects", { teacher });
      expect(Object.keys(listed.subjects[0]).sort()).toEqual(RECORDED_SUMMARY_KEYS);
    });

    test("GET /api/classes is untouched by this slice", async () => {
      const teacher = await mintTeacher();
      const klass = await makeClass(teacher);
      const { status, body } = await call("GET", "/api/classes", { teacher });
      expect(status).toBe(200);
      expect(body.classes.map((c) => c.id)).toEqual([klass.id]);
      expect(Object.keys(body.classes[0]).sort()).toEqual(["createdAt", "id", "name", "stream"]);
    });
  });
});
