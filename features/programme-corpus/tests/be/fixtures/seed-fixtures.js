/**
 * Seed-file fixtures for the programme-corpus suites (be-1, be-2, be-3).
 *
 * The BASE fixture is shaped like the real شعبة الرياضيات document — weeklyHours 7,
 * totals 27/189, and the actual 14-row summary table from `transcription-sample.md`
 * (three repeated معالجة units included, because repeated unit NAMES with distinct
 * assigned ids are exactly what the schema exists to survive).
 *
 * Every negative variant is a NAMED mutation of that base (WF-70: one fixture per way a
 * check can fail). They are derived rather than committed as 20 near-identical files so
 * that a change to the base cannot leave a stale negative silently passing.
 */
const fs = require("node:fs");
const path = require("node:path");

/** The real summary table: [name, weeks, weeksText, hours, hoursText]. */
const UNIT_TABLE = [
  ["تقويم تشخيصي لمكتسبات التلاميذ", 1, "أسبوع", 7, "7 ساعات"],
  ["الدوال العددية (الاشتقاقية والاستمرارية)", 2, "أسبوعان", 14, "14 ساعة"],
  ["الدالتان الأسية واللوغاريتمية", 2, "أسبوعان", 14, "14 ساعة"],
  ["الدوال العددية (النهايات)", 1, "أسبوع", 7, "7 ساعات"],
  ["التزايد المقارن ودراسة الدوال", 2, "أسبوعان", 14, "14 ساعة"],
  ["المتتاليات العددية", 2, "أسبوعان", 14, "14 ساعة"],
  ["معالجة", 1, "أسبوع", 7, "7 ساعات"],
  ["الدوال الأصلية والحساب التكاملي", 3, "3 أسابيع", 21, "21 ساعة"],
  ["الأعداد والحساب", 3, "3 أسابيع", 21, "21 ساعة"],
  ["الإحصاء والاحتمالات", 2, "أسبوعان", 14, "14 ساعة"],
  ["معالجة", 1, "أسبوع", 7, "7 ساعات"],
  ["الأعداد المركبة والتحويلات النقطية", 3, "3 أسابيع", 21, "21 ساعة"],
  ["الهندسة في الفضاء", 3, "3 أسابيع", 21, "21 ساعة"],
  ["معالجة", 1, "أسبوع", 7, "7 ساعات"],
];

const LEGEND_TEXT =
  "تم إدراج العناصر الملونة بالأحمر لعدم تناولها في السنة الدراسية 2021-2022";

function units() {
  return UNIT_TABLE.map(([name, weeks, weeksText, hours, hoursText], i) => ({
    id: `u${String(i + 1).padStart(2, "0")}`,
    name,
    nameText: name,
    weeks,
    weeksText,
    hours,
    hoursText,
    sourcePdfPage: 5,
  }));
}

/** Walk the units table, consuming each unit's week count, to label weeks 1..27. */
function unitIdForWeek(week) {
  let seen = 0;
  for (let i = 0; i < UNIT_TABLE.length; i++) {
    seen += UNIT_TABLE[i][1];
    if (week <= seen) return `u${String(i + 1).padStart(2, "0")}`;
  }
  return null;
}

function rowsFor(week, { legend }) {
  // Both shapes sum to 7 — the weekly-hours invariant is the point.
  const hours = week % 2 === 0 ? [2, 2, 1, 2] : [4, 3];
  return hours.map((h, i) => ({
    competencies: [`كفاءة ${week}.${i + 1}: توظيف المشتقات لدراسة الدوال $x \\mapsto \\sqrt{x}$`],
    contents: [`محتوى ${week}.${i + 1}`],
    guidance: i === 0 ? [`السير المنهجي للأسبوع ${week}`] : [],
    hours: h,
    // One red row, so the base always exercises the emphasis machinery rather than
    // only ever seeing "normal".
    emphasis:
      week === 26 && i === 0 ? (legend ? "added-2022" : "red-unlegended") : "normal",
  }));
}

function programmeLine({ legend }) {
  return {
    type: "programme",
    docKey: "fixture-3as-math",
    edition: "2022-09",
    streams: ["شعبة الرياضيات"],
    level: "3AS",
    source: {
      authority: "وزارة التربية الوطنية — المفتشية العامة للتربية الوطنية",
      title: "التدرج السنوي لبناء التعلمات — السنة الثالثة ثانوي رياضيات",
      file: "tadarroj-3as-math-2022.pdf",
      pages: 19,
      renderedAt: "2026-08-10",
    },
    weeklyHours: 7,
    totals: { weeks: 27, hours: 189, weeksText: "27 أسبوع", hoursText: "189 ساعة" },
    frontMatter: {
      intro: "مقدمة",
      methodNote: "مذكرة منهجية",
      graduateProfile: "ملامح التخرج",
    },
    competencies: [
      { domain: "الدوال", statements: ["دراسة دالة", "توظيف المشتقات"] },
      { domain: "الحساب", statements: ["الأعداد المركبة"] },
    ],
    emphasisLegend: legend ? { text: LEGEND_TEXT, pdfPage: 3 } : null,
    units: units(),
  };
}

function weekLine(week, opts) {
  return {
    type: "week",
    week,
    // One unprinted week number, as on the real pdf page 6.
    weekNumberPrinted: week === 3 ? null : week,
    unitId: unitIdForWeek(week),
    hours: 7,
    source: { pdfPages: [5 + week], docPages: [4 + week] },
    rows: rowsFor(week, opts),
  };
}

/** A complete, valid seed file as an array of line objects. */
function baseLines({ legend = false } = {}) {
  const lines = [programmeLine({ legend })];
  for (let w = 1; w <= 27; w++) lines.push(weekLine(w, { legend }));
  return lines;
}

const clone = (lines) => JSON.parse(JSON.stringify(lines));

/**
 * Every negative variant, each named for the rule it violates. A variant is a function so
 * that it always mutates a FRESH clone of the current base.
 */
const VARIANTS = {
  "valid": () => baseLines(),
  "valid-legend": () => baseLines({ legend: true }),

  // --- schema rejects (be-1 slot 4) ---------------------------------------
  "emphasis-missing": () => {
    const l = clone(baseLines());
    delete l[5].rows[0].emphasis;
    return l;
  },
  "emphasis-out-of-enum": () => {
    const l = clone(baseLines());
    l[5].rows[0].emphasis = "red";
    return l;
  },
  "emphasis-added-without-legend": () => {
    const l = clone(baseLines());
    l[5].rows[0].emphasis = "added-2022"; // base has emphasisLegend: null
    return l;
  },
  "emphasis-unlegended-with-legend": () => {
    const l = clone(baseLines({ legend: true }));
    l[5].rows[0].emphasis = "red-unlegended"; // this document HAS a legend
    return l;
  },
  "pdfpages-empty": () => {
    const l = clone(baseLines());
    l[7].source.pdfPages = [];
    return l;
  },
  "weeks-26": () => {
    const l = clone(baseLines());
    l.splice(27, 1); // drop the last week line
    return l;
  },
  "week-repeated": () => {
    const l = clone(baseLines());
    l[15].week = 14; // week 15 line now says 14 — 27 lines, one week twice
    return l;
  },
  "trimester-on-week": () => {
    const l = clone(baseLines());
    l[9].trimester = 1;
    return l;
  },
  "trimester-on-unit": () => {
    const l = clone(baseLines());
    l[0].units[0].trimester = 1;
    return l;
  },
  "unit-id-orphan": () => {
    const l = clone(baseLines());
    l[9].unitId = "u99";
    return l;
  },
  "second-programme-line": () => {
    const l = clone(baseLines());
    l.push(programmeLine({ legend: false }));
    return l;
  },

  // --- verifier fixtures (be-3), schema-valid but arithmetically wrong ------
  "a3-totals-181": () => {
    const l = clone(baseLines());
    l[0].totals.hours = 181; // the pdftotext corruption: 181/27 is not an integer
    return l;
  },
  "a1-units-hours-mismatch": () => {
    const l = clone(baseLines());
    l[0].units[0].hours = 8; // Σ units.hours becomes 190, totals still 189
    return l;
  },
  "a2-units-weeks-mismatch": () => {
    const l = clone(baseLines());
    // Weeks only: Σ units.weeks becomes 28 while Σ units.hours stays 189, so A1 and A3
    // stay green and A2 is the assertion that fires.
    l[0].units[13].weeks = 2;
    return l;
  },
  "a4-week-hours-6": () => {
    const l = clone(baseLines());
    l[12].rows[3].hours = 1; // week 12: 2+2+1+2 = 7 → 2+2+1+1 = 6
    return l;
  },
  // A week line states its hours TWICE — the `hours` field and the rows that sum to it.
  // These three are the ways the two can disagree; before the A4 fix only the row sum was
  // ever read, so `a4-week-declares-999` passed every assertion (REVIEW's repro).
  "a4-week-declares-999": () => {
    const l = clone(baseLines());
    l[7].hours = 999; // rows still sum to 7 — nothing else in the file notices
    return l;
  },
  "a4-week-hours-absent": () => {
    const l = clone(baseLines());
    delete l[7].hours; // the field the schema.yaml assigns to A4, simply not there
    return l;
  },
  "a4-week-consistent-but-wrong": () => {
    const l = clone(baseLines());
    // Week 12 is internally consistent — declared 6, rows 2+2+1+1 = 6 — and still wrong,
    // because the document's weeklyHours is 7. A check of the field against its own rows
    // would call this green.
    l[12].rows[3].hours = 1;
    l[12].hours = 6;
    return l;
  },

  "a5-week-missing": () => {
    const l = clone(baseLines());
    l.splice(14, 1); // week 14's line is gone; weeks run 1..13,15..27
    return l;
  },
  "a5-week-duplicated": () => {
    const l = clone(baseLines());
    l[15].week = 14; // 27 lines, week 14 twice, week 15 never
    return l;
  },
  "a6-unit-unreferenced": () => {
    const l = clone(baseLines());
    // Give week 27 to unit u13 instead of u14 — u14 is now referenced by no week.
    l[27].unitId = "u13";
    return l;
  },
};

function toJsonl(lines) {
  return lines.map((l) => JSON.stringify(l)).join("\n") + "\n";
}

/** First ~6 words of a cell — the attribution anchor the layer-2 compare diffs on. */
function anchor(cell) {
  const text = Array.isArray(cell) ? cell.join(" ") : (cell ?? "");
  return String(text).trim().split(/\s+/).filter(Boolean).slice(0, 6).join(" ");
}

/**
 * A layer-2 file that AGREES with a seed, line for line.
 *
 * A real l2 file comes from a fresh reader who never saw the seed; this one is derived from
 * it, which is exactly what makes it useful as a fixture: any discrepancy `--compare`
 * reports against it is the comparison's own fault, so the negative fixtures below can
 * introduce one disagreement at a time and know it is the only one.
 */
function l2From(lines) {
  const programme = lines.find((l) => l.type === "programme");
  const unitsById = new Map((programme.units ?? []).map((u) => [u.id, u]));
  return lines
    .filter((l) => l.type === "week")
    .map((w) => ({
      type: "l2-week",
      week: w.week,
      weekNumberPrinted: w.weekNumberPrinted ?? null,
      unitLabelSeen: w.unitId === null ? null : (unitsById.get(w.unitId)?.nameText ?? null),
      pdfPages: w.source.pdfPages,
      rowCount: w.rows.length,
      rowHours: w.rows.map((r) => r.hours),
      rowEmphasis: w.rows.map((r) => r.emphasis),
      anchors: w.rows.map((r) => ({
        competenciesFirst: anchor(r.competencies),
        contentsFirst: anchor(r.contents),
        guidanceFirst: anchor(r.guidance),
      })),
    }));
}

/** Materialise a variant as a .jsonl file and return its path. */
function writeVariant(dir, name, mutate) {
  const lines = VARIANTS[name] ? VARIANTS[name]() : null;
  if (!lines) throw new Error(`no such fixture variant: ${name}`);
  const final = typeof mutate === "function" ? mutate(lines) : lines;
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${name}.jsonl`);
  fs.writeFileSync(file, toJsonl(final), "utf8");
  return file;
}

/** Write arbitrary line objects (seed or l2) as a .jsonl file. */
function writeJsonl(dir, name, lines) {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, name.endsWith(".jsonl") ? name : `${name}.jsonl`);
  fs.writeFileSync(file, toJsonl(lines), "utf8");
  return file;
}

module.exports = {
  LEGEND_TEXT,
  UNIT_TABLE,
  baseLines,
  programmeLine,
  weekLine,
  VARIANTS,
  variant: (name) => VARIANTS[name](),
  toJsonl,
  writeVariant,
  writeJsonl,
  l2From,
  anchor,
  clone,
};
