/**
 * be-3 — subjects adopt `classId` without losing the past.
 *
 * THE ONE FAILURE THIS SUITE EXISTS TO MAKE IMPOSSIBLE: a legacy subject vanishing.
 *
 * There are 8,423 stored subjects and not one of them has a `classId` (SEED §2, re-verified
 * at pre-flight). If a class-scoped list treats "no classId" as "some other class's", every
 * teacher opens the app after this deploy and finds their entire history gone. Nothing in a
 * key-set assertion catches that — the shapes would all be perfect, the list would just be
 * empty. So the middle third of this file is adversarial about exactly one question, asked
 * from four directions: does a subject with no `classId` still come back?
 *
 *   1. under `?classId=<a real, owned class>`      — legacy is never "another class's"
 *   2. under no filter at all                       — the unfiltered list is unchanged
 *   3. a class-A subject is not hidden from the unfiltered list — the filter is opt-in
 *   4. by id, through `getOwned`                    — the frozen function, made executable
 *
 * This is the `roleOf` absent→admin bug class, which survived a green gate in
 * `accounts-hardening` because absence was defaulted instead of allow-listed. So `classOf`
 * is pinned as an ALLOW-LIST, not a `??`: a NON-STRING `classId` planted straight into Mongo
 * — number, object, array, boolean, empty string, explicit null — must read back as legacy
 * from BOTH projections and stay in every list. A `doc.classId ?? null` passthrough answers
 * `42` and passes a naive suite; here it fails six clauses (WF-70, one probe per degenerate
 * variant).
 *
 * The counterweight, so the pin cannot be satisfied by simply never filtering: a subject
 * tagged class A must NOT appear under `?classId=<class B>`. Both halves or neither.
 *
 * ALSO PINNED, because it is the second way this lands wrong: `classOf` returns the stored
 * string VERBATIM and does not validate ownership on read. A subject carrying another
 * teacher's class id is that class's, not legacy — the `{teacherId}` scope is what makes
 * that harmless, and re-deriving ownership inside a projection would be the post-hoc check
 * every store here refuses.
 *
 * ⚠ Ids are 24 LOWERCASE hex, case-sensitive. `ObjectId.isValid` accepts uppercase, so an
 * uppercased class id would otherwise resolve through a spelling this product does not use —
 * a second id convention arriving by accident (the `teacher.ts:19` discipline; be-2 guards
 * the same edge on `/api/progress/:classId`).
 *
 * PRECONDITION: the lane is up. A hollow run is RED in job mode — WF-82.
 */
const { randomBytes } = require("node:crypto");
const { ObjectId, MongoClient } = require("mongodb");
const { describeIfLane } = require("guard");

const BE = process.env.CHAR_BE_URL || "http://localhost:9000";
const MONGO = "mongodb://127.0.0.1:27017";
const DB = "teacher_saas";

const STREAM = "شعبة الرياضيات";
const HEX24_LOWER = /^[0-9a-f]{24}$/;

/**
 * `toRecord`'s recorded response key set — `GET /api/subjects/:id`, SEED §3, re-recorded at
 * pre-flight 2026-08-11. `correlationId` is the envelope's, not the record's.
 *
 * The ONLY wire change this sub-issue is allowed to make is adding `classId` to this list
 * and to the summary list below. Both are asserted as exact set equality, so an extra key —
 * a leaked `teacherId`, a stray `rev` — is as red as a missing one.
 */
const RECORDED_RECORD_KEYS = [
  "correlationId",
  "costUsd",
  "createdAt",
  "durationMs",
  "genCorrelationId",
  "id",
  "subject",
  "updatedAt",
];

/** `toSummary`'s recorded key set — `GET /api/subjects` (`subjects.ts:189-202`), SEED §3. */
const RECORDED_SUMMARY_KEYS = [
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

/** The `/api` index as it stands after be-1 and be-2. be-3 adds NO route — it may not grow. */
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
const PLANTED_SUBJECTS = [];
const PLANTED_CLASSES = [];
const MINTED_TEACHERS = [];

async function call(method, p, { body, teacher } = {}) {
  const bodyless = method === "GET" || method === "HEAD";
  const res = await fetch(`${BE}${p}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(teacher ? { "x-teacher-id": teacher } : {}),
    },
    ...(bodyless || body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: res.status, body: await res.json() };
}

async function mintTeacher() {
  const { body } = await call("POST", "/api/teacher");
  MINTED_TEACHERS.push(body.teacherId);
  return body.teacherId;
}

/** A class through the real surface — be-1's route is the only way one exists. */
async function makeClass(teacher, name = "3ر1") {
  const { status, body } = await call("POST", "/api/classes", {
    teacher,
    body: { name, stream: STREAM },
  });
  if (status !== 201) throw new Error(`class create failed: ${status} ${JSON.stringify(body)}`);
  PLANTED_CLASSES.push(new ObjectId(body.class.id));
  return body.class;
}

function subjectBody(title, extra = {}) {
  return {
    subject: {
      title,
      meta: { totalPoints: 20, topic: "الدوال" },
      exercises: [{ id: "ex1", label: "التمرين 1", points: 20, statement: "أوجد $f'(x)$" }],
    },
    ...extra,
  };
}

/** A subject through the real surface. Returns the whole response for shape clauses. */
async function makeSubject(teacher, title, extra = {}) {
  const { status, body } = await call("POST", "/api/subjects", {
    teacher,
    body: subjectBody(title, extra),
  });
  if (status === 201) PLANTED_SUBJECTS.push(new ObjectId(body.id));
  return { status, body };
}

/**
 * Plant a raw `classId` value straight into the document, bypassing every route.
 *
 * This is the only way to produce the degenerate shapes the allow-list exists for: the POST
 * validator refuses a non-string, so a non-string can only arrive the way the real ones did —
 * from history, from a migration, from a hand-edit. `$unset` for the legacy case, because
 * "absent" and "null" are different documents and both must read as legacy.
 */
async function plantClassId(subjectId, value) {
  const _id = new ObjectId(subjectId);
  const update = value === undefined ? { $unset: { classId: "" } } : { $set: { classId: value } };
  await db.collection("subjects").updateOne({ _id }, update);
}

const listSubjects = (teacher, query = "") =>
  call("GET", `/api/subjects${query}`, { teacher });

const idsOf = (res) => res.body.subjects.map((s) => s.id);

/** Bodies compared without the per-request correlationId — everything else must match. */
function stableBody(body) {
  const { correlationId: _drop, ...rest } = body;
  return JSON.stringify(rest);
}

describeIfLane(BE, "be-3 — subjects.classId: additive, allow-listed, legacy-inclusive", () => {
  beforeAll(async () => {
    mongo = new MongoClient(MONGO);
    await mongo.connect();
    db = mongo.db(DB);
  });

  afterAll(async () => {
    if (db) {
      if (PLANTED_SUBJECTS.length > 0) {
        await db.collection("subjects").deleteMany({ _id: { $in: PLANTED_SUBJECTS } });
      }
      // SWEEP BY OWNER, not only by tracked id. Half of this suite POSTs subjects it
      // EXPECTS to be refused, and a tracked-id list only ever learns about the ones that
      // came back 201 — so on a red run, where a refusal wrongly succeeds, the litter is
      // exactly the documents nothing knows to remove. Every subject this suite can create
      // belongs to a teacher it minted, so the owner is the complete key.
      if (MINTED_TEACHERS.length > 0) {
        await db.collection("subjects").deleteMany({ teacherId: { $in: MINTED_TEACHERS } });
      }
      if (PLANTED_CLASSES.length > 0) {
        const ids = PLANTED_CLASSES.map((o) => o.toHexString());
        await db.collection("progress").deleteMany({ classId: { $in: ids } });
        await db.collection("classes").deleteMany({ _id: { $in: PLANTED_CLASSES } });
      }
      if (MINTED_TEACHERS.length > 0) {
        await db.collection("teachers").deleteMany({ teacherId: { $in: MINTED_TEACHERS } });
      }
    }
    if (mongo) await mongo.close();
  });

  // ---------------------------------------------------------------- storage + projection

  describe("POST /api/subjects — an owned classId is stored and surfaced verbatim", () => {
    test("a subject created with an owned classId carries it on create, get and list", async () => {
      const teacher = await mintTeacher();
      const klass = await makeClass(teacher);
      const { status, body } = await makeSubject(teacher, "مع قسم", { classId: klass.id });

      expect(status).toBe(201);
      expect(body.classId).toBe(klass.id);

      // The store is the arbiter, not the API: the value must actually be on the document,
      // as a string, at the ROOT — not nested into `subject`, where it would be invisible
      // to any query and would ride the verbatim payload it does not belong to.
      const doc = await db.collection("subjects").findOne({ _id: new ObjectId(body.id) });
      expect(doc.classId).toBe(klass.id);
      expect(typeof doc.classId).toBe("string");
      expect(doc.subject.classId).toBeUndefined();

      const got = await call("GET", `/api/subjects/${body.id}`, { teacher });
      expect(got.status).toBe(200);
      expect(got.body.classId).toBe(klass.id);

      const listed = await listSubjects(teacher);
      expect(listed.body.subjects[0].classId).toBe(klass.id);
    });

    test("classId absent → null in BOTH projections, surfaced deliberately", async () => {
      const teacher = await mintTeacher();
      const { status, body } = await makeSubject(teacher, "بدون قسم");

      expect(status).toBe(201);
      // The key is PRESENT and null — not missing. `fe` must not have to distinguish two
      // shapes; a key that appeared only on class-tagged subjects would make the branch it
      // forgot the legacy one, which is every subject that exists today.
      expect(Object.keys(body)).toContain("classId");
      expect(body.classId).toBeNull();

      // And nothing was written: absent stays absent on the document. A route that stored
      // `classId: null` would rewrite 8,423 documents' worth of meaning for no reason.
      const doc = await db.collection("subjects").findOne({ _id: new ObjectId(body.id) });
      expect("classId" in doc).toBe(false);

      const got = await call("GET", `/api/subjects/${body.id}`, { teacher });
      expect(got.body.classId).toBeNull();

      const listed = await listSubjects(teacher);
      expect(listed.body.subjects[0].classId).toBeNull();
    });

    test("classId: null is accepted and means absent — the genCorrelationId precedent", async () => {
      const teacher = await mintTeacher();
      const { status, body } = await makeSubject(teacher, "قسم فارغ", { classId: null });

      expect(status).toBe(201);
      expect(body.classId).toBeNull();
      const doc = await db.collection("subjects").findOne({ _id: new ObjectId(body.id) });
      expect(doc.classId == null).toBe(true);
    });
  });

  // -------------------------------------------------------------------- the allow-list

  describe("classOf is an ALLOW-LIST — every degenerate stored value reads as legacy", () => {
    /**
     * One probe per degenerate variant (WF-70). Each of these is a value that a `??`
     * passthrough would happily surface: `42`, `{}`, `[]`, `true`, `""`. The empty string is
     * the sharpest of them — it is a string, so a `typeof === "string"` check alone admits
     * it, and it would then be a class id that can never match any class while still
     * excluding the subject from every legacy-inclusive list.
     */
    const DEGENERATE = [
      ["a number", 42],
      ["an object", { id: "x" }],
      ["an array", ["a"]],
      ["a boolean", true],
      ["the empty string", ""],
      ["an explicit null", null],
    ];

    test.each(DEGENERATE)("%s planted in Mongo reads as legacy in both projections", async (_label, value) => {
      const teacher = await mintTeacher();
      const { body } = await makeSubject(teacher, "مزروع");
      await plantClassId(body.id, value);

      const got = await call("GET", `/api/subjects/${body.id}`, { teacher });
      expect(got.status).toBe(200);
      expect(got.body.classId).toBeNull();

      const listed = await listSubjects(teacher);
      expect(listed.body.subjects[0].classId).toBeNull();
    });

    test.each(DEGENERATE)("%s planted in Mongo still appears under ?classId=<a real class>", async (_label, value) => {
      const teacher = await mintTeacher();
      const klass = await makeClass(teacher);
      const { body } = await makeSubject(teacher, "مزروع ومرئي");
      await plantClassId(body.id, value);

      const filtered = await listSubjects(teacher, `?classId=${klass.id}`);
      expect(filtered.status).toBe(200);
      expect(idsOf(filtered)).toEqual([body.id]);
    });

    test("a stored classId is returned VERBATIM — the projection does not re-check ownership", async () => {
      // Another teacher's class id, planted on THIS teacher's subject. `classOf` is a
      // read-side allow-list on SHAPE, not an ownership check: the {teacherId} scope is
      // what bounds the result, and re-deriving ownership inside a projection would be the
      // post-hoc check every store here refuses. So the value comes back as-is, and the
      // subject is NOT legacy — it simply belongs to a class this teacher cannot name.
      const owner = await mintTeacher();
      const stranger = await mintTeacher();
      const foreign = await makeClass(stranger, "قسم غريب");
      const mine = await makeClass(owner, "قسمي");
      const { body } = await makeSubject(owner, "منسوب لقسم غريب");
      await plantClassId(body.id, foreign.id);

      const got = await call("GET", `/api/subjects/${body.id}`, { teacher: owner });
      expect(got.body.classId).toBe(foreign.id);

      // Not legacy — so it does not ride along under another class's filter.
      const filtered = await listSubjects(owner, `?classId=${mine.id}`);
      expect(idsOf(filtered)).toEqual([]);
    });
  });

  // ------------------------------------------------- THE PIN: legacy is never filtered out

  describe("legacy subjects survive — the pin this sub-issue exists for", () => {
    /**
     * The fixture every clause below reads: one teacher, two classes, three subjects.
     * L is legacy (the 8,423), A and B are tagged. Written newest-last so ordering is
     * knowable: the list is `updatedAt` DESC, so the expected order is B, A, L.
     */
    async function fixture() {
      const teacher = await mintTeacher();
      const a = await makeClass(teacher, "3ر1");
      const b = await makeClass(teacher, "3ر2");
      const L = (await makeSubject(teacher, "قديم")).body;
      const A = (await makeSubject(teacher, "قسم أ", { classId: a.id })).body;
      const B = (await makeSubject(teacher, "قسم ب", { classId: b.id })).body;
      return { teacher, a, b, L, A, B };
    }

    test("a legacy subject appears under ?classId=<class A>", async () => {
      const { teacher, a, L, A, B } = await fixture();
      const res = await listSubjects(teacher, `?classId=${a.id}`);
      expect(res.status).toBe(200);
      expect(idsOf(res)).toContain(L.id);
      expect(idsOf(res)).toContain(A.id);
      expect(idsOf(res)).not.toContain(B.id);
    });

    test("a legacy subject appears under ?classId=<class B> too — under ANY real class", async () => {
      const { teacher, b, L, A, B } = await fixture();
      const res = await listSubjects(teacher, `?classId=${b.id}`);
      expect(idsOf(res)).toContain(L.id);
      expect(idsOf(res)).toContain(B.id);
      expect(idsOf(res)).not.toContain(A.id);
    });

    test("a legacy subject appears with NO filter at all", async () => {
      const { teacher, L } = await fixture();
      const res = await listSubjects(teacher);
      expect(res.status).toBe(200);
      expect(idsOf(res)).toContain(L.id);
    });

    test("a class-tagged subject is NOT hidden from the unfiltered list", async () => {
      // The filter is opt-in. Tagging a subject must not remove it from the view every
      // teacher without classes is permanently in (contract §0, legacy mode).
      const { teacher, L, A, B } = await fixture();
      const res = await listSubjects(teacher);
      expect(idsOf(res)).toEqual([B.id, A.id, L.id]);
    });

    test("a legacy subject still opens by id — getOwned gained no classId filter", async () => {
      // The freeze, made executable. A `classId` filter inside `getOwned` would 404 a
      // legacy subject out of its own teacher's hands on the subject-open path.
      const { teacher, L } = await fixture();
      const res = await call("GET", `/api/subjects/${L.id}`, { teacher });
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(L.id);
      expect(res.body.classId).toBeNull();
    });

    test("a class-tagged subject opens by id with no class named in the request", async () => {
      const { teacher, a, A } = await fixture();
      const res = await call("GET", `/api/subjects/${A.id}`, { teacher });
      expect(res.status).toBe(200);
      expect(res.body.classId).toBe(a.id);
    });

    test("the other getOwned readers still reach a legacy subject", async () => {
      // Two of the five call sites, both cheap reads (`routes/subjects.ts:193,376`). Their
      // recorded answer for a subject with no history and no correction is 200-with-empty,
      // and it must not become a 404 for the 8,423.
      const { teacher, L } = await fixture();
      const revisions = await call(
        "GET",
        `/api/subjects/${L.id}/exercises/ex1/revisions`,
        { teacher },
      );
      expect(revisions.status).toBe(200);
      expect(revisions.body.revisions).toEqual([]);

      const solutions = await call("GET", `/api/subjects/${L.id}/solutions`, { teacher });
      expect(solutions.status).toBe(200);
    });

    test("the same readers reach a class-tagged subject", async () => {
      const { teacher, A } = await fixture();
      const revisions = await call(
        "GET",
        `/api/subjects/${A.id}/exercises/ex1/revisions`,
        { teacher },
      );
      expect(revisions.status).toBe(200);
      const solutions = await call("GET", `/api/subjects/${A.id}/solutions`, { teacher });
      expect(solutions.status).toBe(200);
    });

    test("the filter preserves the recorded newest-first ordering", async () => {
      const { teacher, a, L, A } = await fixture();
      const res = await listSubjects(teacher, `?classId=${a.id}`);
      expect(idsOf(res)).toEqual([A.id, L.id]);
    });

    test("a filtered list is scoped to the caller — another teacher's subjects never appear", async () => {
      const { a } = await fixture();
      const stranger = await mintTeacher();
      const own = (await makeSubject(stranger, "لغريب")).body;
      const res = await listSubjects(stranger, `?classId=${a.id}`);
      expect(res.status).toBe(200);
      expect(idsOf(res)).toEqual([own.id]);
    });
  });

  // ------------------------------------------------------- the filter param is not an oracle

  describe("?classId= is not ownership-validated — nothing probeable (contract §5)", () => {
    async function twoSubjects() {
      const teacher = await mintTeacher();
      const mine = await makeClass(teacher);
      const L = (await makeSubject(teacher, "قديم")).body;
      const A = (await makeSubject(teacher, "موسوم", { classId: mine.id })).body;
      return { teacher, mine, L, A };
    }

    test("another teacher's real class id → 200, legacy-only, no error", async () => {
      const { teacher, L, A } = await twoSubjects();
      const stranger = await mintTeacher();
      const foreign = await makeClass(stranger, "قسم غريب");

      const res = await listSubjects(teacher, `?classId=${foreign.id}`);
      expect(res.status).toBe(200);
      expect(idsOf(res)).toEqual([L.id]);
      expect(idsOf(res)).not.toContain(A.id);
      expect(res.body.error).toBeUndefined();
    });

    test("a nonexistent 24-hex id → 200, legacy-only", async () => {
      const { teacher, L } = await twoSubjects();
      const res = await listSubjects(teacher, `?classId=${new ObjectId().toHexString()}`);
      expect(res.status).toBe(200);
      expect(idsOf(res)).toEqual([L.id]);
    });

    test("non-hex garbage → 200, legacy-only, never a 400", async () => {
      const { teacher, L } = await twoSubjects();
      const res = await listSubjects(teacher, "?classId=not-an-id");
      expect(res.status).toBe(200);
      expect(idsOf(res)).toEqual([L.id]);
    });

    test("the UPPERCASE of an owned class id matches nothing — ids are lowercase", async () => {
      const { teacher, mine, L } = await twoSubjects();
      const res = await listSubjects(teacher, `?classId=${mine.id.toUpperCase()}`);
      expect(res.status).toBe(200);
      expect(idsOf(res)).toEqual([L.id]);
    });

    test("an EMPTY ?classId= is no filter at all — the direction that cannot lose a subject", async () => {
      // Ambiguous by nature, so it is decided here rather than left to whoever reads the
      // query string next: an empty value is not a class, and the only safe reading of "not
      // a class" on a LIST is "do not narrow". Narrowing to legacy-only would silently drop
      // every tagged subject for a client that serialised an unset filter as `?classId=`.
      const { teacher, L, A } = await twoSubjects();
      const res = await listSubjects(teacher, "?classId=");
      expect(res.status).toBe(200);
      expect(idsOf(res)).toEqual([A.id, L.id]);
    });

    test("a repeated ?classId= is refused as a bad request, never silently coerced", async () => {
      // Express parses a repeated param into an ARRAY. Comparing an array to a stored string
      // matches nothing, which would look exactly like "you have no subjects" — so it is
      // named as invalid instead of guessed at.
      const { teacher } = await twoSubjects();
      const res = await listSubjects(teacher, "?classId=a&classId=b");
      expect(res.status).toBe(400);
      expect(res.body.error.type).toBe("invalid_request");
    });
  });

  // ------------------------------------------------------------------- POST validation

  describe("POST /api/subjects — an unresolvable classId is one byte-identical 404", () => {
    /** Every one of these is well-formed enough to be a string and resolves to no class. */
    async function unresolvableCases(teacher) {
      const stranger = await mintTeacher();
      const foreign = await makeClass(stranger, "قسم غريب");
      const owned = await makeClass(teacher, "قسمي");
      return [
        ["another teacher's real class", foreign.id],
        ["a nonexistent 24-hex id", new ObjectId().toHexString()],
        ["non-hex garbage", "not-an-id"],
        ["a 12-char hex id", randomBytes(6).toString("hex")],
        ["the empty string", ""],
        ["the UPPERCASE of an OWNED class id", owned.id.toUpperCase()],
      ];
    }

    test("all six unresolvable shapes answer 404 class_not_found with the SAME body", async () => {
      const teacher = await mintTeacher();
      const cases = await unresolvableCases(teacher);
      const bodies = [];

      for (const [label, classId] of cases) {
        const { status, body } = await call("POST", "/api/subjects", {
          teacher,
          body: subjectBody("مرفوض", { classId }),
        });
        expect([label, status]).toEqual([label, 404]);
        expect(body.error.type).toBe("class_not_found");
        expect(body.correlationId).toEqual(expect.any(String));
        bodies.push(stableBody(body));
      }

      // Byte-identical, so which of "absent", "not yours" and "not even an id" happened is
      // not readable off the response. Distinguishing them would leak which ids are real.
      expect(new Set(bodies).size).toBe(1);
    });

    test("a refused create stores NOTHING — the subject is not written first and judged after", async () => {
      const teacher = await mintTeacher();
      const before = await db.collection("subjects").countDocuments({ teacherId: teacher });
      await call("POST", "/api/subjects", {
        teacher,
        body: subjectBody("مرفوض", { classId: new ObjectId().toHexString() }),
      });
      const after = await db.collection("subjects").countDocuments({ teacherId: teacher });
      expect(after).toBe(before);
    });

    test.each([
      ["a number", 42],
      ["an object", { id: "x" }],
      ["an array", ["a"]],
      ["a boolean", true],
    ])("%s in the body is 400 invalid_request — a type error, not a lookup", async (_label, classId) => {
      // A wrong TYPE is a caller bug and is named as one (the `genCorrelationId` precedent,
      // `routes/subjects.ts:110-112`). It is not a 404: nothing was looked up, so answering
      // "not found" would describe a search that never happened.
      const teacher = await mintTeacher();
      const { status, body } = await call("POST", "/api/subjects", {
        teacher,
        body: subjectBody("نوع خاطئ", { classId }),
      });
      expect(status).toBe(400);
      expect(body.error.type).toBe("invalid_request");
    });

    test("a valid classId on a subject with an invalid payload is still a 400 on the payload", async () => {
      // Validation order must not change which error a caller sees for a body that is wrong
      // in the recorded way.
      const teacher = await mintTeacher();
      const klass = await makeClass(teacher);
      const { status, body } = await call("POST", "/api/subjects", {
        teacher,
        body: { subject: { title: "بلا تمارين", meta: {}, exercises: [] }, classId: klass.id },
      });
      expect(status).toBe(400);
      expect(body.error.type).toBe("invalid_request");
    });
  });

  // ---------------------------------------------------------------------- the perimeter

  describe("the perimeter — exactly one new key, and nothing else moved", () => {
    test("GET /api/subjects/:id answers the recorded key set PLUS classId, and no more", async () => {
      const teacher = await mintTeacher();
      const { body } = await makeSubject(teacher, "محيط");
      const got = await call("GET", `/api/subjects/${body.id}`, { teacher });
      expect(Object.keys(got.body).sort()).toEqual(
        [...RECORDED_RECORD_KEYS, "classId"].sort(),
      );
    });

    test("GET /api/subjects answers the recorded summary key set PLUS classId, and no more", async () => {
      const teacher = await mintTeacher();
      await makeSubject(teacher, "محيط القائمة");
      const listed = await listSubjects(teacher);
      expect(Object.keys(listed.body).sort()).toEqual(["correlationId", "subjects"]);
      expect(Object.keys(listed.body.subjects[0]).sort()).toEqual(
        [...RECORDED_SUMMARY_KEYS, "classId"].sort(),
      );
    });

    test("POST /api/subjects answers the same key set as the record it just created", async () => {
      const teacher = await mintTeacher();
      const { body } = await makeSubject(teacher, "محيط الإنشاء");
      expect(Object.keys(body).sort()).toEqual([...RECORDED_RECORD_KEYS, "classId"].sort());
    });

    test("a teacher with no subjects still gets 200 and an empty list", async () => {
      const teacher = await mintTeacher();
      const res = await listSubjects(teacher);
      expect(res.status).toBe(200);
      expect(res.body.subjects).toEqual([]);
    });

    test("the classId is a 24-lowercase-hex string on the wire — one id convention", async () => {
      const teacher = await mintTeacher();
      const klass = await makeClass(teacher);
      const { body } = await makeSubject(teacher, "هوية", { classId: klass.id });
      expect(body.classId).toMatch(HEX24_LOWER);
    });

    test("/api still lists every recorded route and grew by nothing", async () => {
      const { status, body } = await call("GET", "/api");
      expect(status).toBe(200);
      expect(body.routes.sort()).toEqual([...RECORDED_ROUTES].sort());
    });

    test("the gate is unchanged — no header is still 401 teacher_required, filter or not", async () => {
      const plain = await call("GET", "/api/subjects");
      expect(plain.status).toBe(401);
      expect(plain.body.error.type).toBe("teacher_required");

      const filtered = await call("GET", "/api/subjects?classId=aaaaaaaaaaaaaaaaaaaaaaaa");
      expect(filtered.status).toBe(401);
      expect(filtered.body.error.type).toBe("teacher_required");

      const posted = await call("POST", "/api/subjects", { body: subjectBody("بلا هوية") });
      expect(posted.status).toBe(401);
      expect(posted.body.error.type).toBe("teacher_required");
    });

    test("be-1's class surface is untouched", async () => {
      const teacher = await mintTeacher();
      const klass = await makeClass(teacher);
      const { status, body } = await call("GET", "/api/classes", { teacher });
      expect(status).toBe(200);
      expect(body.classes.map((c) => c.id)).toEqual([klass.id]);
      expect(Object.keys(body.classes[0]).sort()).toEqual(["createdAt", "id", "name", "stream"]);
    });

    test("be-2's progress surface is untouched", async () => {
      const teacher = await mintTeacher();
      const klass = await makeClass(teacher);
      const { status, body } = await call("GET", `/api/progress/${klass.id}`, { teacher });
      expect(status).toBe(200);
      expect(body.progress.markedWeek).toBe(0);
      expect(body.progress.rev).toBe(0);
      expect(Object.keys(body.progress).sort()).toEqual([
        "classId",
        "entries",
        "markedWeek",
        "programmeDocKey",
        "programmeEdition",
        "programmeTranscriptionRev",
        "rev",
        "updatedAt",
      ]);
    });
  });
});
