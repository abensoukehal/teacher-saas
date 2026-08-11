/**
 * be-1 — the programme route: the corpus becomes visible, whole and whitelisted.
 *
 * THE RULE THIS SUITE EXISTS TO DEFEND: the projection is a FIELD-EXPLICIT WHITELIST and
 * this file owns its key set. `toProgrammeRecord` may never spread a stored document, so
 * every clause below asserts key-set EQUALITY rather than the presence of what we want —
 * a field that appears on the wire without a contract amendment turns this red, which is
 * the only mechanism that makes "excluded" mean anything a year from now.
 *
 * Several exclusions are correctness decisions, not byte savings, and they are pinned as
 * such (contract §2):
 *   - `units[].weeks` / `units[].hours` disagree with the week rows (the 111% bug). With-
 *     holding them makes the correct computation the only available one.
 *   - `contentHash` hashes the STORED document while we emit a PROJECTION — a client
 *     validating on it would have a validator that silently stopped validating.
 *   - `transcriptionRev` gives `fe` one obvious thing to do (diff it against the class's
 *     stamp), which is the two-version-axes collapse the data model forbids.
 *   - `weekNumberPrinted` equals `week` in all 135 rows: it records a disagreement that
 *     does not exist.
 *
 * The other half is the 404. `resolve()`/`notFound()` live in `src/routes/progress.ts`,
 * which this slice may not touch, so the guard is REPLICATED — and a replicated guard
 * drifts unless something compares the two. The parity clauses below compare RAW RESPONSE
 * TEXT across routes with only the correlationId masked (contract §0, §7).
 *
 * ⚠ `\square` is a transcription placeholder appearing 61 times across 48 corpus strings
 * where the ministry printed ℤ/ℂ/ℝ. It is ESCALATED and PARKED (SEED). Ministry text goes
 * out exactly as stored: no clause here remaps, sanitises or tolerates a "fixed" one, and
 * the verbatim byte-compare below would fail if any stack tried.
 *
 * PRECONDITION: the lane is up. A hollow run is RED in job mode — WF-82.
 */
const { readFileSync } = require("node:fs");
const { ObjectId, MongoClient } = require("mongodb");
const { describeIfLane } = require("guard");

const BE = process.env.CHAR_BE_URL || "http://localhost:9000";
const LOG = process.env.CHAR_BE_LOG || "";
const MONGO = "mongodb://127.0.0.1:27017";
const DB = "teacher_saas";

const ROUTE = "/api/classes/:classId/programme";

/**
 * The six stream values and the document each resolves to, RECORDED 2026-08-11.
 *
 * Six streams over FIVE documents — the lettres record carries آداب وفلسفة and لغات
 * أجنبية together, so two of these rows name one docKey on purpose (WF-70: one probe per
 * corpus document, and the pair proves the multikey match rather than assuming it).
 *
 * `rows` is the TOTAL row count of that document. If a re-transcription moves one of
 * these numbers, this suite goes red — and that is the sub-issue's ask-when, not a test to
 * be edited around: the recording moved, so the contract's density reasoning must be
 * re-checked before the number is.
 */
const STREAM_DOCS = [
  { stream: "شعبة الرياضيات", docKey: "tadarroj-3as-math", weeklyHours: 7, hours: 189, units: 14, rows: 103 },
  { stream: "تقني رياضي", docKey: "tadarroj-3as-techmath", weeklyHours: 6, hours: 162, units: 14, rows: 97 },
  { stream: "علوم تجريبية", docKey: "tadarroj-3as-sciences", weeklyHours: 5, hours: 135, units: 14, rows: 81 },
  { stream: "تسيير واقتصاد", docKey: "tadarroj-3as-gestion", weeklyHours: 4, hours: 108, units: 12, rows: 59 },
  { stream: "آداب وفلسفة", docKey: "tadarroj-3as-lettres", weeklyHours: 2, hours: 54, units: 10, rows: 39 },
  { stream: "لغات أجنبية", docKey: "tadarroj-3as-lettres", weeklyHours: 2, hours: 54, units: 10, rows: 39 },
];

/** The whitelist, at four depths. Sorted, and compared for EQUALITY (contract §2). */
const PROGRAMME_KEYS = [
  "docKey",
  "edition",
  "emphasisLegend",
  "source",
  "totals",
  "units",
  "weeklyHours",
  "weeks",
].sort();
const TOTALS_KEYS = ["hours", "weeks"].sort();
const SOURCE_KEYS = ["authority", "title"].sort();
const LEGEND_KEYS = ["pdfPage", "text"].sort();
const UNIT_KEYS = ["id", "name"].sort();
const WEEK_KEYS = ["hours", "pdfPages", "rows", "unitId", "week"].sort();
const ROW_KEYS = ["competencies", "contents", "emphasis", "guidance", "hours"].sort();

/**
 * Stored keys that must not reach the wire, as they would appear in the serialised
 * payload. Matched as `"<key>":` rather than as bare substrings — the corpus is Arabic
 * prose and a bare `current` could legitimately occur inside a ministry string, which
 * would make this clause fail for a reason that has nothing to do with the projection.
 *
 * `units[].weeks` and `units[].hours` are NOT here and cannot be: `weeks` and `hours` are
 * legitimate keys elsewhere in the payload. They are excluded STRUCTURALLY, by the unit
 * key-set clause, which is the stronger check anyway.
 */
const FORBIDDEN_KEYS = [
  "contentHash",
  "transcriptionRev",
  "frontMatter",
  "weekNumberPrinted",
  "nameText",
  "weeksText",
  "hoursText",
  "docPages",
  "renderedAt",
  "sourcePdfPage",
  "streams",
  "level",
  "current",
  "createdAt",
  "updatedAt",
  "_id",
  "file",
  "pages",
];

/** The `/api` index as recorded BEFORE this slice (2026-08-11, lane s9). It may grow by one. */
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
const PLANTED_CLASSES = []; // ObjectIds this suite created, removed in afterAll
const MINTED_TEACHERS = []; // anonymous rows this suite minted, removed in afterAll

/** Raw text as well as the parsed body — the parity clauses compare BYTES, not objects. */
async function raw(method, p, { teacher, headers = {} } = {}) {
  const res = await fetch(`${BE}${p}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(teacher ? { "x-teacher-id": teacher } : {}),
      ...headers,
    },
  });
  const text = await res.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch (_e) {
    body = null;
  }
  return { status: res.status, text, body, etag: res.headers.get("etag") };
}

async function call(method, p, opts) {
  const { status, body } = await raw(method, p, opts);
  return { status, body };
}

/**
 * The correlationId is the ONE field two responses may legitimately differ in — it is
 * per-request by construction. Masking it is what turns "these two bodies say the same
 * thing" into an executable byte-compare instead of an eyeball.
 */
function mask(text, body) {
  const cid = body && body.correlationId;
  return cid ? text.split(cid).join("<correlationId>") : text;
}

async function mintTeacher() {
  const res = await fetch(`${BE}/api/teacher`, { method: "POST" });
  const body = await res.json();
  MINTED_TEACHERS.push(body.teacherId);
  return body.teacherId;
}

async function makeClass(teacher, stream, name = "قسم البرنامج") {
  const res = await fetch(`${BE}/api/classes`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-teacher-id": teacher },
    body: JSON.stringify({ name, stream }),
  });
  const body = await res.json();
  if (res.status === 201 && body.class && body.class.id) {
    PLANTED_CLASSES.push(new ObjectId(body.class.id));
  }
  return { status: res.status, body };
}

/**
 * The log is written by a separate process through a redirect, so a line can land a beat
 * after the response. The silence clause below still has to WAIT — asserting "no line
 * appeared" the instant a response returns would pass even against a service that logs.
 */
async function logLines(predicate, { tries = 12, waitMs = 50 } = {}) {
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
    if (hits.length > 0) return hits;
    await new Promise((r) => setTimeout(r, waitMs));
  }
  return hits;
}

describeIfLane(BE, "be-1 — GET /api/classes/:classId/programme", () => {
  let teacher;
  let mathsClassId;

  beforeAll(async () => {
    mongo = new MongoClient(MONGO);
    await mongo.connect();
    db = mongo.db(DB);
    teacher = await mintTeacher();
    const { body } = await makeClass(teacher, "شعبة الرياضيات");
    mathsClassId = body.class.id;
  });

  afterAll(async () => {
    if (db) {
      if (PLANTED_CLASSES.length > 0) {
        await db.collection("classes").deleteMany({ _id: { $in: PLANTED_CLASSES } });
        await db
          .collection("progress")
          .deleteMany({ classId: { $in: PLANTED_CLASSES.map((o) => o.toHexString()) } });
      }
      if (MINTED_TEACHERS.length > 0) {
        await db.collection("teachers").deleteMany({ teacherId: { $in: MINTED_TEACHERS } });
      }
    }
    if (mongo) await mongo.close();
  });

  describe("the happy path — the ministry's own summary, served whole", () => {
    test("a class on شعبة الرياضيات gets its programme: 27 weeks, 189 hours, 14 units", async () => {
      const { status, body } = await call("GET", `/api/classes/${mathsClassId}/programme`, {
        teacher,
      });
      expect(status).toBe(200);
      expect(body.programme.docKey).toBe("tadarroj-3as-math");
      expect(body.programme.edition).toBeTruthy();
      expect(body.programme.weeklyHours).toBe(7);
      // EQUALITY, not a subset: `weeksText`/`hoursText` are the PDF's label strings for
      // these same two numbers and the UI composes its own Arabic label (contract §0).
      expect(body.programme.totals).toEqual({ weeks: 27, hours: 189 });
      expect(body.programme.units).toHaveLength(14);
      expect(body.programme.weeks).toHaveLength(27);
      expect(body.correlationId).toBeTruthy();
    });

    test("the envelope is exactly {programme, correlationId} — the slice-1 idiom", async () => {
      const { body } = await call("GET", `/api/classes/${mathsClassId}/programme`, { teacher });
      expect(Object.keys(body).sort()).toEqual(["correlationId", "programme"]);
    });
  });

  describe("the whitelist is EXECUTABLE — key-set equality at every depth (contract §2)", () => {
    let programme;
    let payload;

    beforeAll(async () => {
      const { body } = await call("GET", `/api/classes/${mathsClassId}/programme`, { teacher });
      programme = body.programme;
      payload = JSON.stringify(body);
    });

    test("the programme object carries exactly the eight named fields", () => {
      expect(Object.keys(programme).sort()).toEqual(PROGRAMME_KEYS);
    });

    test("totals, source and emphasisLegend carry exactly their named keys", () => {
      expect(Object.keys(programme.totals).sort()).toEqual(TOTALS_KEYS);
      expect(Object.keys(programme.source).sort()).toEqual(SOURCE_KEYS);
      expect(Object.keys(programme.emphasisLegend).sort()).toEqual(LEGEND_KEYS);
    });

    test("every unit is exactly {id, name} — `weeks` and `hours` withheld ON PURPOSE", () => {
      // The correctness exclusion, contract §2: the summary table's per-unit numbers
      // DISAGREE with the week rows (naive summing gives 210 of 189 hours = 111% on this
      // very stream). Withholding them makes the correct computation — run-summed
      // `weeks[].hours` — the only one a client can perform.
      for (const unit of programme.units) {
        expect(Object.keys(unit).sort()).toEqual(UNIT_KEYS);
      }
    });

    test("every week is exactly {week, unitId, hours, pdfPages, rows}", () => {
      // `pdfPages` is FLATTENED out of the stored `weeks[].source` — the ministry's printed
      // page, the receipt behind every verbatim claim on the screen. `docPages` indexes our
      // render and stays home.
      for (const week of programme.weeks) {
        expect(Object.keys(week).sort()).toEqual(WEEK_KEYS);
        expect(Array.isArray(week.pdfPages)).toBe(true);
      }
    });

    test("every row is exactly {competencies, contents, guidance, hours, emphasis}", () => {
      let rows = 0;
      for (const week of programme.weeks) {
        for (const row of week.rows) {
          expect(Object.keys(row).sort()).toEqual(ROW_KEYS);
          rows += 1;
        }
      }
      expect(rows).toBe(103);
    });

    test.each(FORBIDDEN_KEYS)("no `%s` key anywhere in the payload", (key) => {
      expect(payload.includes(`"${key}":`)).toBe(false);
    });
  });

  describe("verbatim is a COMPARISON against the store, never a fixture", () => {
    // A fixture would only prove the projection matches what a test author typed. Reading
    // the same fields out of Mongo inside the suite proves the projection may DROP a field
    // and may never ALTER one — which is the whole verbatim promise, and the reason a
    // parked `\square` must arrive on the wire as a literal `\square`.
    let programme;
    let stored;

    beforeAll(async () => {
      const { body } = await call("GET", `/api/classes/${mathsClassId}/programme`, { teacher });
      programme = body.programme;
      stored = await db.collection("programmes").findOne({
        docKey: "tadarroj-3as-math",
        current: true,
      });
    });

    test("source.authority and source.title are byte-equal to the stored document", () => {
      expect(programme.source.authority).toBe(stored.source.authority);
      expect(programme.source.title).toBe(stored.source.title);
    });

    test("emphasisLegend is byte-equal, both keys — the caption AND its page", () => {
      expect(programme.emphasisLegend.text).toBe(stored.emphasisLegend.text);
      expect(programme.emphasisLegend.pdfPage).toBe(stored.emphasisLegend.pdfPage);
    });

    test("week 20's full rows are byte-equal to the stored rows", () => {
      const servedWeek = programme.weeks.find((w) => w.week === 20);
      const storedWeek = stored.weeks.find((w) => w.week === 20);
      expect(JSON.stringify(servedWeek.rows)).toBe(JSON.stringify(storedWeek.rows));
      expect(servedWeek.unitId).toBe(storedWeek.unitId);
      expect(servedWeek.hours).toBe(storedWeek.hours);
      expect(servedWeek.pdfPages).toEqual(storedWeek.source.pdfPages);
    });

    test("units keep their ASSIGNED ids and names, in stored order", () => {
      expect(programme.units.map((u) => u.id)).toEqual(stored.units.map((u) => u.id));
      expect(programme.units.map((u) => u.name)).toEqual(stored.units.map((u) => u.name));
    });
  });

  describe("one probe per corpus document — all six streams (WF-70)", () => {
    test.each(STREAM_DOCS)(
      "$stream resolves to $docKey, 27 weeks, $rows rows",
      async ({ stream, docKey, weeklyHours, hours, units, rows }) => {
        const own = await mintTeacher();
        const created = await makeClass(own, stream);
        expect(created.status).toBe(201);

        const { status, body } = await call(
          "GET",
          `/api/classes/${created.body.class.id}/programme`,
          { teacher: own },
        );
        expect(status).toBe(200);
        // The document whose `streams` array HELD that value — the multikey match, which
        // is what lets the two lettres streams share one record.
        expect(body.programme.docKey).toBe(docKey);
        expect(body.programme.weeklyHours).toBe(weeklyHours);
        expect(body.programme.totals).toEqual({ weeks: 27, hours });
        expect(body.programme.units).toHaveLength(units);
        expect(body.programme.weeks).toHaveLength(27);
        expect(body.programme.weeks.reduce((n, w) => n + w.rows.length, 0)).toBe(rows);
      },
    );
  });

  describe("the density that drove the contract — competencies is IN", () => {
    // The contract OVERRODE an earlier recommendation to drop `competencies` on measured
    // density. These are that measurement, executable: if a re-transcription moves them,
    // the reasoning behind the inclusion moved too and the ask-when fires.
    let programme;

    beforeAll(async () => {
      const { body } = await call("GET", `/api/classes/${mathsClassId}/programme`, { teacher });
      programme = body.programme;
    });

    test("maths: 76 rows carry a competency, 63 contents, 55 guidance", () => {
      const rows = programme.weeks.flatMap((w) => w.rows);
      expect(rows.filter((r) => r.competencies.length > 0)).toHaveLength(76);
      expect(rows.filter((r) => r.contents.length > 0)).toHaveLength(63);
      expect(rows.filter((r) => r.guidance.length > 0)).toHaveLength(55);
    });

    test("real week 20: 7 rows, a competency on all 7, contents on only 3", () => {
      // Excluding competencies would render four of these seven ministry rows blank —
      // which is the sentence that killed the exclusion.
      const week = programme.weeks.find((w) => w.week === 20);
      expect(week.rows).toHaveLength(7);
      expect(week.rows.filter((r) => r.competencies.length > 0)).toHaveLength(7);
      expect(week.rows.filter((r) => r.contents.length > 0)).toHaveLength(3);
    });
  });

  describe("404 parity — the replicated guard cannot drift (contract §0, §7)", () => {
    let probes;

    beforeAll(async () => {
      const stranger = await mintTeacher();
      const theirs = await makeClass(stranger, "علوم تجريبية", "قسم شخص آخر");
      probes = [
        ["a well-formed id that does not exist", new ObjectId().toHexString()],
        ["another teacher's real class", theirs.body.class.id],
        ["non-hex garbage", "gggggggggggggggggggggggg"],
        // `ObjectId.isValid` accepts uppercase hex, so the lowercase-shape check MUST run
        // before the store — otherwise a real owned class resolves through a spelling this
        // product does not use, inventing a second id convention by accident.
        ["the UPPERCASE spelling of a real OWNED class", null],
      ];
      probes[3][1] = mathsClassId.toUpperCase();
    });

    test.each([0, 1, 2, 3])("probe %i answers 404 class_not_found on the programme route", async (i) => {
      const [, id] = probes[i];
      const { status, body } = await call("GET", `/api/classes/${id}/programme`, { teacher });
      expect(status).toBe(404);
      expect(body.error.type).toBe("class_not_found");
      expect(body.error.message).toBe("القسم غير موجود");
    });

    test("all four probe bodies are byte-identical to each other", async () => {
      const texts = [];
      for (const [, id] of probes) {
        const r = await raw("GET", `/api/classes/${id}/programme`, { teacher });
        texts.push(mask(r.text, r.body));
      }
      // Existence is not probeable: "bad shape", "not yours" and "never existed" must be
      // one answer, byte for byte, or the difference between them IS the oracle.
      expect(new Set(texts).size).toBe(1);
    });

    test("and byte-identical to GET /api/progress/:classId's 404 for the same probes", async () => {
      for (const [label, id] of probes) {
        const mine = await raw("GET", `/api/classes/${id}/programme`, { teacher });
        const theirs = await raw("GET", `/api/progress/${id}`, { teacher });
        expect(mine.status).toBe(theirs.status);
        // The guard is REPLICATED, not exported — `progress.ts` is read-only this slice.
        // This clause is the thing that stops the copy from drifting.
        expect({ [label]: mask(mine.text, mine.body) }).toEqual({
          [label]: mask(theirs.text, theirs.body),
        });
      }
    });
  });

  describe("the identity gate is on the PREFIX", () => {
    test("no x-teacher-id → 401 teacher_required, in Arabic", async () => {
      const { status, body } = await call("GET", `/api/classes/${mathsClassId}/programme`);
      expect(status).toBe(401);
      expect(body.error).toEqual({ message: "مطلوب تسجيل الدخول", type: "teacher_required" });
      expect(body.correlationId).toBeTruthy();
    });

    test("the 401 fires before the class lookup — an unknown id answers 401, not 404", async () => {
      // Otherwise the 401/404 difference would answer "is this class real?" to a caller
      // holding no credential at all (SEED §6, authorisation).
      const { status } = await call("GET", `/api/classes/${new ObjectId().toHexString()}/programme`);
      expect(status).toBe(401);
    });
  });

  describe("caching — Express's default ETag IS the whole story (contract §0)", () => {
    test("If-None-Match from the first response yields 304 with a zero-byte body", async () => {
      const first = await raw("GET", `/api/classes/${mathsClassId}/programme`, { teacher });
      expect(first.status).toBe(200);
      expect(first.etag).toBeTruthy();
      const second = await raw("GET", `/api/classes/${mathsClassId}/programme`, {
        teacher,
        headers: { "if-none-match": first.etag },
      });
      // Pinned so a later middleware — compression, a memo, an envelope tweak — cannot
      // break the one caching behaviour this route ships with, unnoticed.
      expect(second.status).toBe(304);
      expect(second.text).toBe("");
    });
  });

  describe("the /api index grows by exactly one", () => {
    test("every recorded route survives and the programme entry joins them", async () => {
      const { body } = await call("GET", "/api");
      for (const route of RECORDED_ROUTES) expect(body.routes).toContain(route);
      expect(body.routes).toContain(ROUTE);
      expect(body.routes).toHaveLength(RECORDED_ROUTES.length + 1);
    });
  });

  describe("the picker's bound is untouched — two reports, never collapsed (contract §3)", () => {
    test("GET /api/progress/:classId still answers the slice-1 shape and numbers", async () => {
      const { status, body } = await call("GET", `/api/progress/${mathsClassId}`, { teacher });
      expect(status).toBe(200);
      expect(Object.keys(body).sort()).toEqual(["correlationId", "programme", "progress"]);
      // `totalWeeks` bounds writes; `totals.weeks` labels headers. Same number today,
      // different question — collapsing them recreates the vacuous pin be-2 closes.
      expect(Object.keys(body.programme).sort()).toEqual(["docKey", "edition", "totalWeeks"]);
      expect(body.programme.docKey).toBe("tadarroj-3as-math");
      expect(body.programme.edition).toBe("2022-09");
      expect(body.programme.totalWeeks).toBe(27);
    });
  });

  describe("observability — the silence is the design, so the silence is pinned (SEED §5)", () => {
    test("the correlationId echoes, and the read writes NO mutation line", async () => {
      const { body } = await call("GET", `/api/classes/${mathsClassId}/programme`, { teacher });
      const cid = body.correlationId;
      expect(cid).toBeTruthy();

      // A programme read is a cache-friendly read of a PUBLIC document. A mutation-style
      // line here would be noise, and noise in a mutation log is how a real `cas_loss`
      // stops being noticed. The absence is deliberate — so it is asserted, not assumed.
      const lines = await logLines(
        (o) =>
          o.correlationId === cid &&
          (o.msg === "class.created" || o.msg === "progress.write" || o.event),
      );
      expect(lines).toEqual([]);
    });
  });
});
