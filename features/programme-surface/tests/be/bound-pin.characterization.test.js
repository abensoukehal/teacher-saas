/**
 * be-2 — the bound pin closes: a programme that is not 27 weeks, at last.
 *
 * THE SURVIVOR THIS SUITE EXISTS TO KILL. `markedWeek`'s upper bound is read live from
 * the class's own programme (`src/routes/progress.ts:111,127,139`) and the code is
 * correct — but a mutant substituting the literal `27` for `totalWeeks` survives all 411
 * slice-1 backend tests, because every one of the five corpus documents says 27. The
 * oracle read `totalWeeks` off a response that always answered 27, so it pinned a number
 * rather than a source. `fe`'s twin mutant IS killed; its fixtures vary the ceiling.
 * be-1 then added `GET /api/classes/:classId/programme`, which reports `totals.weeks` —
 * a SECOND surface with the same latent hole. Both die here.
 *
 * WHY THE FIXTURE IS A DIRECT MONGO INSERT, and why that is not a shortcut. You cannot
 * create a non-27 programme through the loader: `WEEKS_PER_YEAR = 27` is enforced by the
 * seed validator at `src/store/programmes.ts:445` (`totals.weeks must be 27`), `:556`
 * (`week must be an integer 1..27`) and `:679` (`expected 27 week lines… a short file is
 * a truncated reading, not a short year`). Those guards are CORRECT and are frozen — the
 * promoted `programme-corpus` suite gates them, and weakening one to make a test possible
 * would trade a real invariant for a fake fixture. Nothing on the read path objects to an
 * inserted document: `getProgrammeForStream` is a plain `findOne({streams, current:true})`
 * with no validation, and `contentHash` is checked only by `scripts/verify-programmes.mjs`,
 * never by the service. So the fixture is deliberately NOT loader-valid — varying the
 * ceiling is its whole job — and it lives and dies inside Mongo and this file. Nothing
 * under `project/data/programmes/` is touched.
 *
 * TWO TRAPS, both paid for in advance:
 *
 *  1. The synthetic document carries a stream value NO REAL DOCUMENT CARRIES. `streams` is
 *     a multikey array and `getProgrammeForStream` matches on it, so a synthetic document
 *     sharing a real stream would resolve REAL classes to it for as long as it existed.
 *  2. Cleanup is in `afterAll`, NEVER at the end of a test body — a mid-suite failure must
 *     still clean up. Slice 1's `classes.characterization.test.js:198-203` asserts
 *     `db.programmes.distinct("streams")` equals EXACTLY the six recorded values, so a
 *     synthetic stream left behind turns a suite this job does not own red. `beforeAll` is
 *     therefore self-healing too: it deletes any residue from a previously crashed run
 *     before inserting, so one crash cannot poison every run after it.
 *
 * And the restoration is ASSERTED, not assumed. The last describe is a sibling of the
 * fixture's, so jest runs it after that block's `afterAll` — which makes "the corpus is
 * back exactly as it was" an executable clause in the suite that does the damage, caught
 * where it is made rather than in someone else's gate.
 *
 * ZERO PRODUCT CODE. The implementation is already right; the PIN is the deliverable.
 *
 * PRECONDITION: the lane is up. A hollow run is RED in job mode — WF-82.
 */
const { ObjectId, MongoClient } = require("mongodb");
const { describeIfLane } = require("guard");

const BE = process.env.CHAR_BE_URL || "http://localhost:9000";
const MONGO = "mongodb://127.0.0.1:27017";
const DB = "teacher_saas";

/**
 * The synthetic document's identity. `docKey` is the self-heal handle — one deleteMany on
 * it removes every trace, whatever went wrong last time. The stream carries the word
 * "اصطناعية" (synthetic) so a human finding one in the database knows immediately what it
 * is and that it is safe to delete.
 */
const SYNTH_DOC_KEY = "synthetic-bound-pin";
const SYNTH_STREAM = "شعبة اصطناعية — اختبار";
const SYNTH_WEEKS = 30;
const SYNTH_WEEKLY_HOURS = 7;

/** The corpus as recorded 2026-08-11 — the state this suite must give back. */
const CORPUS_STREAMS = [
  "آداب وفلسفة",
  "تسيير واقتصاد",
  "تقني رياضي",
  "شعبة الرياضيات",
  "علوم تجريبية",
  "لغات أجنبية",
].sort();
const CORPUS_DOCS = 5;

/** The real ceiling every corpus document reports — the number the mutant hardcodes. */
const REAL_TOTAL_WEEKS = 27;

const OUT_OF_RANGE = { type: "invalid_request", message: "الأسبوع خارج المجال" };

let mongo;
let db;

/** Everything this suite created, removed in the fixture block's afterAll. */
const PLANTED_CLASSES = [];
const MINTED_TEACHERS = [];

/** The corpus fingerprint, taken BEFORE the synthetic insert and compared after cleanup. */
let corpusBefore;

/**
 * The synthetic programme, shaped for its two readers and nothing else.
 *
 * `resolve()` (progress.ts) reads `docKey`, `edition`, `transcriptionRev` and
 * `totals.weeks`; `toProgrammeRecord` (programmes.ts) additionally reads `weeklyHours`,
 * `totals.hours`, `source.{authority,title}`, `emphasisLegend.{text,pdfPage}`,
 * `units[].{id,name}` and every `weeks[]` entry down to its rows. Both are satisfied and
 * the document is otherwise minimal — its job is to differ in exactly one number.
 *
 * `totals.hours` stays arithmetically honest (7 × 30 = 210) even though nothing checks it
 * here: a fixture that lies about a number it is not testing is a trap for whoever reads
 * it next.
 */
function syntheticProgramme() {
  const weeks = [];
  for (let w = 1; w <= SYNTH_WEEKS; w++) {
    weeks.push({
      week: w,
      unitId: "s1",
      hours: SYNTH_WEEKLY_HOURS,
      source: { pdfPages: [w] },
      rows: [
        {
          competencies: [],
          contents: ["محتوى اصطناعي"],
          guidance: [],
          hours: SYNTH_WEEKLY_HOURS,
          emphasis: "normal",
        },
      ],
    });
  }
  return {
    docKey: SYNTH_DOC_KEY,
    // A far-future edition so it can never be mistaken for a ministry revision, and can
    // never win a `current` race with a real document (it shares no docKey with one).
    edition: "9999-01",
    streams: [SYNTH_STREAM],
    current: true,
    source: { authority: "اختبار آلي", title: "برنامج اصطناعي — تثبيت الحدّ" },
    weeklyHours: SYNTH_WEEKLY_HOURS,
    totals: { weeks: SYNTH_WEEKS, hours: SYNTH_WEEKLY_HOURS * SYNTH_WEEKS },
    competencies: null,
    emphasisLegend: { text: "أسطورة اصطناعية", pdfPage: 1 },
    units: [{ id: "s1", name: "وحدة اصطناعية" }],
    weeks,
    transcriptionRev: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

async function call(method, p, { teacher, body } = {}) {
  const res = await fetch(`${BE}${p}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(teacher ? { "x-teacher-id": teacher } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  let parsed = null;
  try {
    parsed = await res.json();
  } catch (_e) {
    parsed = null;
  }
  return { status: res.status, body: parsed };
}

async function mintTeacher() {
  const { body } = await call("POST", "/api/teacher");
  MINTED_TEACHERS.push(body.teacherId);
  return body.teacherId;
}

async function makeClass(teacher, stream, name = "قسم تثبيت الحدّ") {
  const { status, body } = await call("POST", "/api/classes", { teacher, body: { name, stream } });
  if (status === 201 && body.class && body.class.id) {
    PLANTED_CLASSES.push(new ObjectId(body.class.id));
  }
  return { status, body };
}

/** Read the class's current rev rather than counting writes — the CAS token is the truth. */
async function currentRev(teacher, classId) {
  const { body } = await call("GET", `/api/progress/${classId}`, { teacher });
  return body.progress.rev;
}

/** One PUT at the class's live rev, so a clause never fails for a stale token. */
async function put(teacher, classId, payload) {
  const rev = await currentRev(teacher, classId);
  const { status, body } = await call("PUT", `/api/progress/${classId}`, {
    teacher,
    body: { rev, ...payload },
  });
  return {
    status,
    rev: body && body.progress ? body.progress.rev : null,
    error: body && body.error ? { type: body.error.type, message: body.error.message } : null,
  };
}

describeIfLane(BE, "be-2 — markedWeek's ceiling is the CLASS'S programme, not the constant 27", () => {
  beforeAll(async () => {
    mongo = new MongoClient(MONGO);
    await mongo.connect();
    db = mongo.db(DB);
    // Taken before anything is inserted: docKey → contentHash for every corpus document.
    // `contentHash` is the loader's own guard against a hand-edit, which makes it the
    // sharpest available statement of "this document was not touched".
    corpusBefore = (await db.collection("programmes").find({}).toArray())
      .map((d) => ({ docKey: d.docKey, edition: d.edition, contentHash: d.contentHash }))
      .sort((a, b) => (a.docKey < b.docKey ? -1 : 1));
  });

  afterAll(async () => {
    if (mongo) await mongo.close();
  });

  describe("with a synthetic 30-week programme in the corpus", () => {
    let teacher;
    let classId;
    let mathsTeacher;
    let mathsClassId;

    beforeAll(async () => {
      // SELF-HEAL. A previous crashed run may have left the document behind; deleting
      // before inserting means one bad run cannot poison every run after it — and cannot
      // leave `distinct("streams")` permanently red for a suite this job does not own.
      await db.collection("programmes").deleteMany({ docKey: SYNTH_DOC_KEY });
      await db.collection("programmes").insertOne(syntheticProgramme());

      teacher = await mintTeacher();
      const made = await makeClass(teacher, SYNTH_STREAM);
      classId = made.body.class ? made.body.class.id : null;

      // The control, in the SAME run: a real class on a real 27-week document. Without it
      // this suite would only prove "the bound is not 27", not "the bound is each class's
      // own" — and a mutant hardcoding 30 would sail through.
      mathsTeacher = await mintTeacher();
      const maths = await makeClass(mathsTeacher, "شعبة الرياضيات", "قسم مرجعي");
      mathsClassId = maths.body.class ? maths.body.class.id : null;
    });

    afterAll(async () => {
      // NEVER at the end of a test body: a mid-suite failure must still clean up. The
      // programme goes first — it is the one whose residue breaks someone else's gate.
      await db.collection("programmes").deleteMany({ docKey: SYNTH_DOC_KEY });
      if (PLANTED_CLASSES.length > 0) {
        await db.collection("classes").deleteMany({ _id: { $in: PLANTED_CLASSES } });
        await db
          .collection("progress")
          .deleteMany({ classId: { $in: PLANTED_CLASSES.map((o) => o.toHexString()) } });
      }
      if (MINTED_TEACHERS.length > 0) {
        await db.collection("teachers").deleteMany({ teacherId: { $in: MINTED_TEACHERS } });
      }
    });

    describe("the corpus is the validator, not a TypeScript union", () => {
      test("a class is creatable on a stream only the synthetic document carries", async () => {
        // Re-proving slice 1's rule, and the precondition for everything below: if this
        // ever refuses, the corpus-validation contract moved and the sub-issue's ask-when
        // has fired — the fixture technique is gone, not merely broken.
        const { status, body } = await call("GET", `/api/classes`, { teacher });
        expect(status).toBe(200);
        expect(body.classes.map((c) => c.stream)).toContain(SYNTH_STREAM);
        expect(classId).toBeTruthy();
      });
    });

    describe("GET /api/progress/:classId reports the class's OWN ceiling", () => {
      test("totalWeeks is 30 — read live from the document the class resolves to", async () => {
        const { status, body } = await call("GET", `/api/progress/${classId}`, { teacher });
        expect(status).toBe(200);
        expect(body.programme.totalWeeks).toBe(SYNTH_WEEKS);
        expect(body.programme.docKey).toBe(SYNTH_DOC_KEY);
      });
    });

    describe("THE KILL — a hardcoded 27 answers 400 at week 28", () => {
      // Each clause writes at the class's live rev, so they are order-independent in
      // effect even though jest runs them in order.

      test("markedWeek 27 is accepted — the boundary the kill is measured against", async () => {
        // A mutant hardcoding 27 passes THIS clause. That is the point of stating it: it
        // isolates the next one to the ceiling and nothing else.
        const r = await put(teacher, classId, { markedWeek: 27 });
        expect(r.status).toBe(200);
      });

      test("markedWeek 28 is accepted — ★ the mutation survivor dies here", async () => {
        // `markedWeek > totalWeeks` with totalWeeks = 30. Substitute the literal 27 for
        // `totalWeeks` at progress.ts:127 and this answers 400 «الأسبوع خارج المجال».
        // Every other backend clause in this repo stays green under that substitution.
        const r = await put(teacher, classId, { markedWeek: 28 });
        expect(r.status).toBe(200);
      });

      test("markedWeek 30 is accepted — the ceiling itself, inclusive", async () => {
        const r = await put(teacher, classId, { markedWeek: SYNTH_WEEKS });
        expect(r.status).toBe(200);
      });

      test("markedWeek 31 is refused — 400 invalid_request, the recorded Arabic body", async () => {
        // The other half of the pin. Without it, "the bound is the document's" would be
        // satisfied by a service with no upper bound at all.
        const r = await put(teacher, classId, { markedWeek: SYNTH_WEEKS + 1 });
        expect(r.status).toBe(400);
        expect(r.error).toEqual(OUT_OF_RANGE);
      });
    });

    describe("the entry bound follows the SAME ceiling (progress.ts:139)", () => {
      // WF-70: `totalWeeks` has two consumers in one function, and a fix applied to one
      // is not a fix applied to the other. Entries are 1-based while markedWeek is
      // 0-based, so the two bounds are written separately and can drift separately.

      test("entry week 29 is accepted", async () => {
        const r = await put(teacher, classId, {
          markedWeek: SYNTH_WEEKS,
          entry: { week: 29, status: "done" },
        });
        expect(r.status).toBe(200);
      });

      test("entry week 30 is accepted — the ceiling, inclusive", async () => {
        const r = await put(teacher, classId, {
          markedWeek: SYNTH_WEEKS,
          entry: { week: SYNTH_WEEKS, status: "done" },
        });
        expect(r.status).toBe(200);
      });

      test("entry week 31 is refused — 400 invalid_request", async () => {
        const r = await put(teacher, classId, {
          markedWeek: SYNTH_WEEKS,
          entry: { week: SYNTH_WEEKS + 1, status: "done" },
        });
        expect(r.status).toBe(400);
        expect(r.error).toEqual(OUT_OF_RANGE);
      });
    });

    describe("THE TWIN KILL — be-1's route reports the document's own totals", () => {
      test("GET /api/classes/:classId/programme serves totals.weeks 30 and 30 week entries", async () => {
        // A `WEEKS_PER_YEAR` reuse or a literal 27 inside `toProgrammeRecord` dies here.
        // The route is one week old; without this clause it would inherit the exact hole
        // slice 1 left, on a second surface, unnoticed.
        const { status, body } = await call("GET", `/api/classes/${classId}/programme`, {
          teacher,
        });
        expect(status).toBe(200);
        expect(body.programme.totals).toEqual({
          weeks: SYNTH_WEEKS,
          hours: SYNTH_WEEKLY_HOURS * SYNTH_WEEKS,
        });
        expect(body.programme.weeks).toHaveLength(SYNTH_WEEKS);
        expect(body.programme.weeks[SYNTH_WEEKS - 1].week).toBe(SYNTH_WEEKS);
      });
    });

    describe("the bound is PER CLASS — the control, in the same run", () => {
      // This is what turns the clauses above from "not 27" into "the class's own". Both
      // classes exist simultaneously, on the same service, in the same process.

      test("a real maths class still reports totalWeeks 27", async () => {
        const { body } = await call("GET", `/api/progress/${mathsClassId}`, {
          teacher: mathsTeacher,
        });
        expect(body.programme.totalWeeks).toBe(REAL_TOTAL_WEEKS);
        expect(body.programme.docKey).toBe("tadarroj-3as-math");
      });

      test("and refuses markedWeek 28 while the synthetic class accepts it", async () => {
        // The same request, the same instant, two answers — decided by the class alone.
        const real = await put(mathsTeacher, mathsClassId, { markedWeek: 28 });
        const synthetic = await put(teacher, classId, { markedWeek: 28 });
        expect(real.status).toBe(400);
        expect(real.error).toEqual(OUT_OF_RANGE);
        expect(synthetic.status).toBe(200);
      });

      test("its programme route still reports totals.weeks 27", async () => {
        const { body } = await call("GET", `/api/classes/${mathsClassId}/programme`, {
          teacher: mathsTeacher,
        });
        expect(body.programme.totals.weeks).toBe(REAL_TOTAL_WEEKS);
      });
    });
  });

  /**
   * A SIBLING of the fixture block, so jest runs it after that block's `afterAll`. The
   * damage this suite does is undone by then, and these clauses are the proof — the leak
   * is caught in the file that makes it, not in slice 1's `classes` suite where it would
   * read as an unrelated regression.
   */
  describe("the corpus is restored, and that is asserted rather than assumed", () => {
    test("five documents, and no synthetic residue under its docKey", async () => {
      expect(await db.collection("programmes").countDocuments({})).toBe(CORPUS_DOCS);
      expect(await db.collection("programmes").countDocuments({ docKey: SYNTH_DOC_KEY })).toBe(0);
    });

    test("distinct(streams) is exactly the six again — slice 1's own guard expression", async () => {
      // Verbatim the clause at classes.characterization.test.js:198-203. Running it HERE
      // means a crashed cleanup fails this suite rather than someone else's.
      const live = await db.collection("programmes").distinct("streams");
      expect([...live].sort()).toEqual(CORPUS_STREAMS);
      expect(live).not.toContain(SYNTH_STREAM);
    });

    test("every contentHash is byte-unchanged — nothing real was written to", async () => {
      // The strongest available statement: `contentHash` is what the loader itself uses to
      // detect a hand-edit in Mongo. Unchanged hashes on unchanged editions means this
      // suite inserted beside the corpus and never into it.
      const after = (await db.collection("programmes").find({}).toArray())
        .map((d) => ({ docKey: d.docKey, edition: d.edition, contentHash: d.contentHash }))
        .sort((a, b) => (a.docKey < b.docKey ? -1 : 1));
      expect(after).toEqual(corpusBefore);
    });
  });
});
