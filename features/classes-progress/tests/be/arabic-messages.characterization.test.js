/**
 * be-7 — the last English strings a teacher can reach.
 *
 * THE DEFECT. `fe` renders `payload.error.message` RAW to the teacher
 * (fe/src/lib/api.ts:145,309) and branches only on `payload.error.type` (its KIND table,
 * api.ts:83). Arabic-only is the product's FIRST hard constraint. So every English
 * `message` on a teacher-reachable path was an English string in front of a teacher — a
 * correctness bug, not a polish item. be-6 fixed the catch-all and FOUND six more; this
 * suite is the executable form of closing them.
 *
 * The six, recorded 2026-08-11 on lane s8 BEFORE the change:
 *   src/routes/subjects.ts:50   "subject not found"                       ← hottest surface
 *   src/routes/subjects.ts:473  "exercise is required"
 *   src/routes/subjects.ts:479  "exercise.id must match the path segment"
 *   src/app.ts:176              "input is required (string or object)"
 *   src/app.ts:183              `unknown skill <caller's own input>`
 *   src/app.ts:281              "internal server error"
 *
 * ⚠ WHY THIS ASSERTS ABSENCE-OF-LATIN AND NOT AN ARABIC LITERAL.
 * A suite that pinned «الموضوع غير موجود» exactly would become a TRANSLATION LOCK: the
 * next reword — a product decision someone is entitled to make — would go red for the
 * wrong reason, and whoever fixed it would learn to edit the expected string, which is
 * precisely how the constraint stops being checked. So the clauses below assert the
 * PROPERTY the constraint actually states: the message contains Arabic and contains no
 * Latin word (`!/[A-Za-z]{4,}/`). A reword stays green; a regression to English cannot.
 * The four-letter floor is deliberate — it tolerates an incidental token (a unit, an
 * `id`) while catching any real English word.
 *
 * ⚠ WHAT MUST NOT MOVE, and is therefore asserted at least as strictly as before:
 *   · every `error.type` is pinned to its recorded value, per probe. Callers branch on
 *     the type; translating a message while renaming a type would be a silent breaking
 *     change dressed up as a translation.
 *   · every status code is pinned per probe.
 *   · every OTHER error body is compared to a recorded literal, byte for byte.
 *   · the `/api` index by exact set equality, both directions; `/health` still answers.
 *
 * PRECONDITION: the lane is up. A hollow run is RED in job mode — WF-82.
 */
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { ObjectId, MongoClient } = require("mongodb");
const { describeIfLane } = require("guard");

const BE = process.env.CHAR_BE_URL || "http://localhost:9000";
const ROOTDIR = process.env.CHAR_ROOTDIR || "";
const MONGO = "mongodb://127.0.0.1:27017";
const DB = "teacher_saas";

const STREAM = "شعبة الرياضيات";

/** Any Arabic letter. */
const ARABIC = /[؀-ۿ]/;
/** A LATIN WORD — four letters or more. The property, not a literal. */
const LATIN_WORD = /[A-Za-z]{4,}/;

/**
 * Every other error body on this job's perimeter, recorded as literals.
 *
 * THE PERIMETER DIFFERENTIAL. be-7 changed six messages; these prove it changed only
 * those six. Each was reproduced against the lane before it was written here, and each
 * passed against the OLD code too — which is what makes them a differential rather than
 * a restatement of the new behaviour.
 */
const RECORDED_401 =
  '{"error":{"message":"مطلوب تسجيل الدخول","type":"teacher_required"},"correlationId":"<CID>"}';
const RECORDED_403 =
  '{"error":{"message":"هذه الصفحة مخصَّصة للمشرف","type":"forbidden"},"correlationId":"<CID>"}';
const RECORDED_CLASS_404 =
  '{"error":{"message":"القسم غير موجود","type":"class_not_found"},"correlationId":"<CID>"}';
const RECORDED_CATCHALL_404 =
  '{"error":{"message":"الصفحة غير موجودة","type":"not_found"},"correlationId":"<CID>"}';
const RECORDED_MALFORMED_BODY =
  '{"error":{"message":"الطلب غير صالح","type":"invalid_request"},"correlationId":"<CID>"}';
const RECORDED_CONFLICT =
  '{"error":{"message":"تغيّر تقدّم القسم أثناء الحفظ","type":"conflict"},"correlationId":"<CID>"}';

/** The `/api` index, untouched by this sub-issue — asserted as an exact set. */
const RECORDED_ROUTES = [
  "/health",
  "/api/skills",
  "/api/generate",
  "/api/teacher",
  "/api/subjects",
  "/api/exams",
  "/api/classes",
  "/api/progress",
  "/api/auth/signup",
  "/api/auth/signin",
  "/api/auth/recover",
];

let mongo;
let db;

/** Every teacher this file minted. THE cleanup key. */
const MINTED_TEACHERS = [];

async function call(method, path, { body, rawBody, teacher, correlationId } = {}) {
  const bodyless = method === "GET" || method === "HEAD";
  const payload =
    rawBody !== undefined ? rawBody : body !== undefined ? JSON.stringify(body) : undefined;
  const res = await fetch(`${BE}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(teacher ? { "x-teacher-id": teacher } : {}),
      ...(correlationId ? { "x-correlation-id": correlationId } : {}),
    },
    ...(bodyless || payload === undefined ? {} : { body: payload }),
  });
  const raw = await res.text();
  let parsed = null;
  try {
    parsed = JSON.parse(raw);
  } catch (_e) {
    parsed = null;
  }
  return { status: res.status, raw, body: parsed, header: res.headers.get("x-correlation-id") };
}

/** The one thing that legitimately differs between two otherwise identical responses. */
const mask = (raw) => raw.replace(/"correlationId":"[^"]*"/, '"correlationId":"<CID>"');

async function mintTeacher() {
  const { body } = await call("POST", "/api/teacher");
  MINTED_TEACHERS.push(body.teacherId);
  return body.teacherId;
}

/**
 * A stored subject, WITHOUT spending a generation.
 *
 * `POST /api/subjects` is a plain insert — it never reaches `src/claude/`. Nothing in
 * this file calls a real generation: every `/api/generate` and `/api/exams` probe below
 * is rejected by validation BEFORE `runClaude` is reached (app.ts, exams.ts:573).
 */
async function makeSubject(teacher) {
  const res = await call("POST", "/api/subjects", {
    teacher,
    body: {
      subject: {
        title: "اختبار",
        exercises: [{ id: "ex1", label: "التمرين الأول", points: 20, statement: "س" }],
      },
    },
  });
  if (res.status !== 201) throw new Error(`subject setup failed: ${res.status} ${res.raw}`);
  // The record is FLAT — `id` at the root, `subject` is the nested payload. Reading
  // `body.subject.id` yields the EXERCISE-less undefined and every 404 clause below
  // would then pass against `/api/subjects/undefined`, which is not the same fact.
  if (typeof res.body.id !== "string") throw new Error(`no subject id in ${res.raw}`);
  return res.body.id;
}

async function makeClass(teacher, name = "3ر1") {
  const res = await call("POST", "/api/classes", { teacher, body: { name, stream: STREAM } });
  if (res.status !== 201) throw new Error(`class setup failed: ${res.status} ${res.raw}`);
  return res.body.class;
}

/** The one assertion this whole sub-issue exists to make. */
function expectArabicMessage(res) {
  const message = res.body?.error?.message;
  expect(typeof message).toBe("string");
  expect(message.length).toBeGreaterThan(0);
  expect(message).toMatch(ARABIC);
  expect(message).not.toMatch(LATIN_WORD);
}

describeIfLane(BE, "be-7 — the last English strings a teacher can reach", () => {
  let teacherA;
  let teacherB;
  let ownSubject;
  let foreignSubject;
  let ownClass;

  beforeAll(async () => {
    mongo = new MongoClient(MONGO);
    await mongo.connect();
    db = mongo.db(DB);
    teacherA = await mintTeacher();
    teacherB = await mintTeacher();
    ownSubject = await makeSubject(teacherA);
    foreignSubject = await makeSubject(teacherB);
    ownClass = await makeClass(teacherA);
  });

  afterAll(async () => {
    if (db && MINTED_TEACHERS.length > 0) {
      const scope = { teacherId: { $in: MINTED_TEACHERS } };
      await db.collection("subjects").deleteMany(scope);
      await db.collection("classes").deleteMany(scope);
      await db.collection("progress").deleteMany(scope);
      await db.collection("teachers").deleteMany(scope);
    }
    if (mongo) await mongo.close();
  });

  // ---------------------------------------------------------------------------------
  // 1 · subjects.ts:50 — THE ONE THAT MATTERS
  // ---------------------------------------------------------------------------------

  describe("`subject not found` — the hottest teacher-reachable 404", () => {
    /**
     * FOUR routes funnel through the same `notFound` helper (subjects.ts:47). One clause
     * per route, WF-70: a single probe would be satisfied by one lucky handler, and this
     * is the message a teacher meets when they open a bookmarked exam that is gone.
     *
     * Every route here is a read or a store write — none of them reaches `src/claude/`.
     */
    const ROUTES = [
      ["open a subject", (id) => ["GET", `/api/subjects/${id}`]],
      ["read its correction", (id) => ["GET", `/api/subjects/${id}/solutions`]],
      [
        "read an exercise's history",
        (id) => ["GET", `/api/subjects/${id}/exercises/ex1/revisions`],
      ],
      [
        "replace an exercise",
        (id) => ["PUT", `/api/subjects/${id}/exercises/ex1`, { exercise: { id: "ex1" } }],
      ],
    ];

    /**
     * THE THREE WAYS A SUBJECT IS UNRESOLVABLE. All three must answer identically —
     * existence is not probeable (project/CLAUDE.md: "another teacher's subject returns
     * the same not-found as one that never existed") — and all three must be Arabic.
     */
    const unresolvable = () => [
      ["never existed", new ObjectId().toHexString()],
      ["another teacher's", foreignSubject],
      ["not even an id", "zzz"],
    ];

    for (const [routeName, mk] of ROUTES) {
      it(`${routeName} -> 404 subject_not_found, Arabic, on all three unresolvable shapes`, async () => {
        const bodies = [];
        for (const [, id] of unresolvable()) {
          const [method, path, body] = mk(id);
          const res = await call(method, path, { teacher: teacherA, ...(body ? { body } : {}) });
          expect(res.status).toBe(404);
          // THE TYPE DID NOT MOVE. Only the message did.
          expect(res.body.error.type).toBe("subject_not_found");
          expectArabicMessage(res);
          expect(Object.keys(res.body.error).sort()).toEqual(["message", "type"]);
          expect(Object.keys(res.body).sort()).toEqual(["correlationId", "error"]);
          bodies.push(mask(res.raw));
        }
        // Non-probeability, re-checked after the message moved: translating one branch
        // and not another would have split this single body into two.
        expect(new Set(bodies).size).toBe(1);
      });
    }

    it("all four routes answer the SAME body — one message, not four translations", async () => {
      // The helper exists so there is exactly one wording. Four near-synonyms would be
      // four things to keep in sync, and the drift would be invisible.
      const id = new ObjectId().toHexString();
      const bodies = [];
      for (const [, mk] of ROUTES) {
        const [method, path, body] = mk(id);
        const res = await call(method, path, { teacher: teacherA, ...(body ? { body } : {}) });
        bodies.push(mask(res.raw));
      }
      expect(new Set(bodies).size).toBe(1);
    });

    it("it is still DISTINCT from the catch-all and from class_not_found", async () => {
      // Three different 404s that must not converge. `subject_not_found` says "that exam
      // is not yours or not there"; `class_not_found` says the same about a class; the
      // catch-all says "there is no such route". Collapsing any two would make a typo in
      // `fe` indistinguishable from a missing exam.
      const subject = await call("GET", `/api/subjects/${new ObjectId().toHexString()}`, {
        teacher: teacherA,
      });
      const klass = await call("GET", `/api/progress/${new ObjectId().toHexString()}`, {
        teacher: teacherA,
      });
      const route = await call("GET", "/api/nope", { teacher: teacherA });
      const all = [mask(subject.raw), mask(klass.raw), mask(route.raw)];
      expect(new Set(all).size).toBe(3);
      expect(all[1]).toBe(RECORDED_CLASS_404);
      expect(all[2]).toBe(RECORDED_CATCHALL_404);
    });
  });

  // ---------------------------------------------------------------------------------
  // 2 · subjects.ts:473,479 — the refine route's two 400s
  // ---------------------------------------------------------------------------------

  describe("replacing an exercise — both 400s speak Arabic", () => {
    it("no exercise in the body -> 400 invalid_request, Arabic", async () => {
      const res = await call("PUT", `/api/subjects/${ownSubject}/exercises/ex1`, {
        teacher: teacherA,
        body: {},
      });
      expect(res.status).toBe(400);
      expect(res.body.error.type).toBe("invalid_request");
      expectArabicMessage(res);
    });

    it("a non-object exercise -> 400 invalid_request, Arabic", async () => {
      // One probe per degenerate variant — WF-70. The old literal was reached by all of
      // them, so all of them must be Arabic now.
      for (const exercise of [null, "ex1", 42, []]) {
        const res = await call("PUT", `/api/subjects/${ownSubject}/exercises/ex1`, {
          teacher: teacherA,
          body: { exercise },
        });
        expect(res.status).toBe(400);
        expect(res.body.error.type).toBe("invalid_request");
        expectArabicMessage(res);
      }
    });

    it("the exercise id disagrees with the path -> 400 invalid_request, Arabic", async () => {
      const res = await call("PUT", `/api/subjects/${ownSubject}/exercises/ex1`, {
        teacher: teacherA,
        body: { exercise: { id: "ex9" } },
      });
      expect(res.status).toBe(400);
      expect(res.body.error.type).toBe("invalid_request");
      expectArabicMessage(res);
      // The old message named `exercise.id` and "the path segment" — an API detail a
      // teacher has no concept of. Translating it was also the chance to stop describing
      // the wire to someone who never sees it.
      expect(res.body.error.message).not.toContain("exercise");
      expect(res.body.error.message).not.toContain("id");
    });

    it("the two 400s remain DIFFERENT messages — not collapsed into one", async () => {
      // They are different faults and a teacher (and an operator) can tell them apart.
      // Translating both to one generic string would have lost information the English
      // version carried.
      const missing = await call("PUT", `/api/subjects/${ownSubject}/exercises/ex1`, {
        teacher: teacherA,
        body: {},
      });
      const mismatched = await call("PUT", `/api/subjects/${ownSubject}/exercises/ex1`, {
        teacher: teacherA,
        body: { exercise: { id: "ex9" } },
      });
      expect(missing.body.error.message).not.toBe(mismatched.body.error.message);
    });
  });

  // ---------------------------------------------------------------------------------
  // 3 · app.ts:176,183 — /api/generate's two 400s
  // ---------------------------------------------------------------------------------

  describe("/api/generate — the validation that fires before the CLI", () => {
    // NOTHING HERE SPAWNS A GENERATION. Every probe is refused by the two guards at
    // app.ts:174-186, which run before `runClaude`.

    it("an empty or absent input -> 400 invalid_request, Arabic", async () => {
      for (const body of [{}, { input: "" }, { input: "   " }, { input: null }, { input: 42 }]) {
        const res = await call("POST", "/api/generate", { body });
        expect(res.status).toBe(400);
        expect(res.body.error.type).toBe("invalid_request");
        expectArabicMessage(res);
      }
    });

    it("an unknown skill -> 400 invalid_request, Arabic", async () => {
      for (const skill of ["exam-plan-x", "../etc", "exam plan", "", 42, { name: "x" }, ["x"]]) {
        const res = await call("POST", "/api/generate", { body: { skill, input: "س" } });
        expect(res.status).toBe(400);
        expect(res.body.error.type).toBe("invalid_request");
        expectArabicMessage(res);
      }
    });

    it("THE REFLECTION: the rejected skill name is not echoed back", async () => {
      // The old message interpolated the CALLER'S OWN STRING into a body `fe` renders
      // raw. That is both an English run inside an Arabic message and caller input
      // reflected into a response — this clause is why the name had to go, and it is
      // what stops someone helpfully putting it back.
      const res = await call("POST", "/api/generate", {
        body: { skill: "definitely-not-a-skill", input: "س" },
      });
      expect(res.body.error.message).not.toContain("definitely-not-a-skill");
      expect(res.body.error.message).not.toContain("skill");
      expectArabicMessage(res);
    });

    it("ANTI-VACUITY: the two guards are DISTINCT, and the catalogue is real", async () => {
      // A route that answered one 400 to everything would satisfy every clause above.
      // It cannot be checked by letting a known skill through — `exam-subject` would
      // spawn a ~110 s agent loop — so the discrimination is checked where it is free:
      // the two guards produce two different messages, in the order app.ts applies them
      // (input FIRST at :174, skill SECOND at :181 — a valid input is required to reach
      // the skill guard at all).
      const inputGuard = await call("POST", "/api/generate", { body: {} });
      const skillGuard = await call("POST", "/api/generate", {
        body: { skill: "nope-nope", input: "س" },
      });
      expect(inputGuard.status).toBe(400);
      expect(skillGuard.status).toBe(400);
      expect(inputGuard.body.error.message).not.toBe(skillGuard.body.error.message);
      expectArabicMessage(inputGuard);
      expectArabicMessage(skillGuard);
      // And the catalogue the guard checks against is not empty — otherwise "unknown
      // skill" would be the only possible answer and the clauses above would be trivial.
      const { status, body } = await call("GET", "/api/skills");
      expect(status).toBe(200);
      expect(body.skills.map((s) => s.name)).toEqual(
        expect.arrayContaining(["exam-subject", "refine-exercise"]),
      );
    });
  });

  // ---------------------------------------------------------------------------------
  // 4 · /api/exams — named by the Oracle slot; already Arabic, pinned so it stays
  // ---------------------------------------------------------------------------------

  describe("/api/exams — its validation was already Arabic, and must remain so", () => {
    it("invalid controls -> 400 invalid_request, Arabic", async () => {
      // Refused by `invalidControls` (exams.ts:573) BEFORE the plan spawns — these cost
      // nothing. One probe per control, WF-70.
      const BODIES = [
        { exerciseCount: 0 },
        { exerciseCount: "3" },
        { exerciseCount: 999 },
        { durationMinutes: -1 },
        { totalPoints: 0 },
        { totalPoints: 1e9 },
      ];
      for (const body of BODIES) {
        const res = await call("POST", "/api/exams", { teacher: teacherA, body });
        expect(res.status).toBe(400);
        expect(res.body.error.type).toBe("invalid_request");
        expectArabicMessage(res);
      }
    });
  });

  // ---------------------------------------------------------------------------------
  // 5 · THE SOURCE SWEEP — the clause that catches the NEXT English literal
  // ---------------------------------------------------------------------------------

  describe("no English message literal remains in any route or in the app", () => {
    /**
     * The black-box clauses above can only reach branches a request can reach.
     * `app.ts`'s `internal_error` fallback is, by design, NOT one of them — it fires
     * only when this service has a bug of its own, and a suite that could trigger it
     * would be triggering a defect. So that literal is verified where it lives.
     *
     * Reading the source also buys the thing no probe can: a clause that goes red when
     * someone adds a NEW English message anywhere in `src/routes/` or `src/app.ts`,
     * including a branch nobody has written a probe for. That is the regression this
     * sub-issue actually wants to prevent.
     *
     * Two extraction shapes, because the service writes messages two ways:
     *   · `message: "…"`            — an error body built inline
     *   · `bad(res, req, "…")`      — the per-router 400 helper
     * Interpolated (`${…}`) and pass-through (`err.message`) forms are not string
     * literals and are handled by the allow-list below.
     */
    const readSource = (rel) => readFileSync(join(ROOTDIR, rel), "utf8");

    const FILES = [
      "src/app.ts",
      "src/routes/subjects.ts",
      "src/routes/classes.ts",
      "src/routes/progress.ts",
      "src/routes/auth.ts",
      "src/routes/exams.ts",
      "src/teacher.ts",
    ];

    /**
     * KNOWN AND DELIBERATELY NOT FIXED HERE — every entry is reported in the be-7
     * journal for the backlog, and each is out of this sub-issue's Delta.
     *
     * These are ALLOWED PAST THE SWEEP, not blessed. Listing them here is what makes
     * them countable: the next job that fixes one deletes its line, and the sweep
     * immediately starts enforcing it.
     */
    const ALLOWED_ENGLISH = [
      // `invalidSubject` (subjects.ts:103-116) — FIVE English literals on
      // `POST /api/subjects`, pinned live in section 6 below. Found by be-7's sweep,
      // outside be-7's Delta (which names six specific sites), so reported not fixed.
      "subject is required",
      "subject.title must be a string",
      "subject.exercises must be a non-empty array",
      "every exercise needs a non-empty id",
      "exercise ids must be unique",
    ];

    it.each(FILES)("%s has no English `message:` literal", (rel) => {
      const src = readSource(rel);
      const hits = [...src.matchAll(/message:\s*"([^"]*)"/g)]
        .map((m) => m[1])
        .filter((s) => LATIN_WORD.test(s))
        .filter((s) => !ALLOWED_ENGLISH.includes(s));
      expect(hits).toEqual([]);
    });

    it.each(FILES)("%s passes no English literal to bad()", (rel) => {
      const src = readSource(rel);
      const hits = [...src.matchAll(/\bbad\(\s*res,\s*req,\s*"([^"]*)"/g)]
        .map((m) => m[1])
        .filter((s) => LATIN_WORD.test(s))
        .filter((s) => !ALLOWED_ENGLISH.includes(s));
      expect(hits).toEqual([]);
    });

    it("no validator still RETURNS an English message string", () => {
      // The shape the be-6 sweep's grep could not see — `return "…"` inside a validator,
      // handed to `bad()` one line later. It is how `invalidSubject` survived two passes.
      for (const rel of FILES) {
        const src = readSource(rel);
        const hits = [...src.matchAll(/^\s*return\s+"([^"]*)";/gm)]
          .map((m) => m[1])
          .filter((s) => LATIN_WORD.test(s))
          .filter((s) => !ALLOWED_ENGLISH.includes(s));
        expect({ file: rel, hits }).toEqual({ file: rel, hits: [] });
      }
    });

    it("ANTI-VACUITY: the sweep can actually see strings, and its allow-list is live", () => {
      // Without this, a broken regex or a wrong ROOTDIR would make every clause above
      // pass by finding nothing at all — the exact failure mode of a source-reading test.
      expect(ROOTDIR).not.toBe("");
      const app = readSource("src/app.ts");
      expect(app.length).toBeGreaterThan(1000);
      const allMessages = [...app.matchAll(/message:\s*"([^"]*)"/g)].map((m) => m[1]);
      expect(allMessages.length).toBeGreaterThan(3);
      expect(allMessages.some((s) => ARABIC.test(s))).toBe(true);
      // The `internal_error` fallback — the literal no request can reach — is Arabic.
      const internal = app.match(/error:\s*\{\s*message:\s*"([^"]*)",\s*type:\s*"internal_error"/);
      expect(internal).not.toBeNull();
      expect(internal[1]).toMatch(ARABIC);
      expect(internal[1]).not.toMatch(LATIN_WORD);
      // Every allow-list entry is still really in the source. A stale entry would silently
      // widen the sweep, which is how an allow-list rots into a blanket exemption.
      const subjects = readSource("src/routes/subjects.ts");
      for (const s of ALLOWED_ENGLISH) expect(subjects).toContain(s);
    });
  });

  // ---------------------------------------------------------------------------------
  // 6 · RECORDED, NOT FIXED — the gap be-7's sweep found and its Delta does not cover
  // ---------------------------------------------------------------------------------

  describe("KNOWN GAP: POST /api/subjects still answers in English", () => {
    /**
     * ⚠ THESE CLAUSES PIN A DEFECT, ON PURPOSE.
     *
     * `invalidSubject` (subjects.ts:103-116) returns five English strings, handed
     * straight to `bad()` at subjects.ts:144. They are teacher-reachable — `POST
     * /api/subjects` is the save path — and they are the SAME defect be-7 just fixed
     * one function above. They are recorded here rather than fixed because be-7's Delta
     * names six specific sites and these are not among them; be-6's recording grep
     * (`grep … | grep -i message`) structurally could not see a `return "…"`, which is
     * how they survived two passes.
     *
     * Pinning rather than skipping is be-5's precedent (it pinned the English catch-all
     * as an inherited gap, and be-6 then superseded it). The effect is that closing this
     * is a DECLARED supersession with a red test to point at — not a silent drive-by.
     */
    const PROBES = [
      ["no subject at all", {}],
      ["a non-string title", { subject: { title: 1 } }],
      ["no exercises", { subject: { title: "ت", exercises: [] } }],
      ["an exercise with no id", { subject: { title: "ت", exercises: [{ id: "" }] } }],
      [
        "duplicate exercise ids",
        { subject: { title: "ت", exercises: [{ id: "ex1" }, { id: "ex1" }] } },
      ],
    ];

    it.each(PROBES)(
      "%s -> 400 invalid_request, and the message is STILL English (be-7 did not fix this)",
      async (_name, body) => {
        const res = await call("POST", "/api/subjects", { teacher: teacherA, body });
        expect(res.status).toBe(400);
        expect(res.body.error.type).toBe("invalid_request");
        // The recording. When this goes red because someone translated it, that is the
        // fix landing — amend this block, delete the matching ALLOWED_ENGLISH entry, and
        // declare the supersession.
        expect(res.body.error.message).toMatch(LATIN_WORD);
      },
    );
  });

  // ---------------------------------------------------------------------------------
  // 7 · THE PERIMETER DIFFERENTIAL — every other body byte-identical
  // ---------------------------------------------------------------------------------

  describe("every other error body is unchanged, byte for byte", () => {
    it("the 401 gate", async () => {
      const res = await call("GET", "/api/subjects");
      expect(res.status).toBe(401);
      expect(mask(res.raw)).toBe(RECORDED_401);
    });

    it("the 403 admin gate — a real teacher who is not an admin", async () => {
      const res = await call("GET", "/api/admin/kpis", { teacher: teacherA });
      expect(res.status).toBe(403);
      expect(mask(res.raw)).toBe(RECORDED_403);
    });

    it("class_not_found", async () => {
      const res = await call("GET", `/api/progress/${new ObjectId().toHexString()}`, {
        teacher: teacherA,
      });
      expect(res.status).toBe(404);
      expect(mask(res.raw)).toBe(RECORDED_CLASS_404);
    });

    it("the catch-all 404 — be-6's, untouched by be-7", async () => {
      const res = await call("GET", "/api/nope", { teacher: teacherA });
      expect(res.status).toBe(404);
      expect(mask(res.raw)).toBe(RECORDED_CATCHALL_404);
    });

    it("invalid_request from a malformed body", async () => {
      const res = await call("POST", "/api/classes", { teacher: teacherA, rawBody: "{not json" });
      expect(res.status).toBe(400);
      expect(mask(res.raw)).toBe(RECORDED_MALFORMED_BODY);
    });

    it("conflict from a stale progress rev", async () => {
      const klass = await makeClass(teacherA, "3ر7");
      const first = await call("PUT", `/api/progress/${klass.id}`, {
        teacher: teacherA,
        body: { rev: 0, markedWeek: 3 },
      });
      expect(first.status).toBe(200);
      const stale = await call("PUT", `/api/progress/${klass.id}`, {
        teacher: teacherA,
        body: { rev: 0, markedWeek: 4 },
      });
      expect(stale.status).toBe(409);
      expect(mask(stale.raw)).toBe(RECORDED_CONFLICT);
    });

    it("EVERY error.type on the perimeter is byte-identical to its recording", async () => {
      // THE TYPES MUST NOT MOVE. `fe`'s KIND table (api.ts:83) branches on exactly these
      // strings; a translation that renamed one would be a silent breaking change. One
      // table, every probe be-7 touched or could have touched.
      const EXPECTED = [
        ["subject_not_found", 404, () => call("GET", `/api/subjects/${new ObjectId().toHexString()}`, { teacher: teacherA })],
        ["invalid_request", 400, () => call("PUT", `/api/subjects/${ownSubject}/exercises/ex1`, { teacher: teacherA, body: {} })],
        ["invalid_request", 400, () => call("POST", "/api/generate", { body: {} })],
        ["invalid_request", 400, () => call("POST", "/api/generate", { body: { skill: "nope-nope", input: "س" } })],
        ["invalid_request", 400, () => call("POST", "/api/exams", { teacher: teacherA, body: { exerciseCount: 0 } })],
        ["invalid_request", 400, () => call("POST", "/api/subjects", { teacher: teacherA, body: {} })],
        ["not_found", 404, () => call("GET", "/api/nope", { teacher: teacherA })],
        ["class_not_found", 404, () => call("GET", `/api/progress/${new ObjectId().toHexString()}`, { teacher: teacherA })],
        ["teacher_required", 401, () => call("GET", "/api/subjects")],
        ["forbidden", 403, () => call("GET", "/api/admin/kpis", { teacher: teacherA })],
      ];
      for (const [type, status, probe] of EXPECTED) {
        const res = await probe();
        expect({ type: res.body.error.type, status: res.status }).toEqual({ type, status });
      }
    });

    it("the /api index gained nothing and lost nothing", async () => {
      const { status, body } = await call("GET", "/api");
      expect(status).toBe(200);
      expect(body.service).toBe("teacher-be");
      expect([...body.routes].sort()).toEqual([...RECORDED_ROUTES].sort());
    });

    it("/health still answers", async () => {
      const { status, body } = await call("GET", "/health");
      expect(status).toBe(200);
      expect(body.service).toBe("teacher-be");
    });

    it("ANTI-VACUITY: real routes still answer 200", async () => {
      // Without this, a service that errored on everything would satisfy most of the
      // clauses above by accident.
      const subject = await call("GET", `/api/subjects/${ownSubject}`, { teacher: teacherA });
      expect(subject.status).toBe(200);
      expect(subject.body.id).toBe(ownSubject);
      const progress = await call("GET", `/api/progress/${ownClass.id}`, { teacher: teacherA });
      expect(progress.status).toBe(200);
      const skills = await call("GET", "/api/skills");
      expect(skills.status).toBe(200);
    });
  });
});
