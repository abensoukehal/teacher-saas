/**
 * Fixtures for the programme surface (slice 2).
 *
 * Three programmes, and the split between them is the point:
 *
 *   - `MATH` is **real corpus data**, recorded from the live route. Every number the
 *     fe-1 oracle asserts (15 runs, 189 hours, u12 split at weeks 20 / 22–23) is a
 *     fact about the ministry's own document, not a fact an implementer invented to
 *     match their code.
 *   - `THIRTY_WEEKS` is **synthetic and must be**: `WEEKS_PER_YEAR` is enforced at
 *     three points in the loader, so a programme with any other week count cannot be
 *     made through it. Every real document says twenty-seven — which is exactly what
 *     let a hardcoded twenty-seven survive all 411 backend tests in slice 1. `fe`'s
 *     twin mutant dies here.
 *   - `DIVERGENT_TOTALS` pins the bar's denominator. Contract §4: the track total is
 *     Σ `weeks[].hours`, **never** `totals.hours`. Today those agree in all five
 *     corpus documents (measured 2026-08-11: 189/189, 162/162, 135/135, 108/108,
 *     54/54), so a mutant reading `totals.hours` would pass against every real
 *     document. That agreement is why this fixture is synthetic — the pin has to be
 *     buildable before the two numbers ever part, not after.
 *
 * Recorded 2026-08-11 against lane slot 9 (be :9900):
 *   curl -s -H "x-teacher-id: <id>" localhost:9900/api/classes/<classId>/programme
 *
 * RE-RECORDED 2026-08-11, same lane, at `tadarroj-3as-math` **transcriptionRev 5**
 * (edition unchanged at `2022-09` — this is our reading being corrected, not the
 * ministry's document). The corpus restored the double-struck set symbols the source
 * PDFs fail to embed, so the recording that predates it is a recording of a corpus
 * that no longer exists.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Programme, ProgrammeWeek } from "@/lib/programme";

/**
 * The whole `programme` object from the recorded 200, verbatim — now carrying the 26
 * `\mathbb{…}` symbols that replaced the 21 `\square` strings the SEED escalated. They
 * are here UNTOUCHED on purpose, exactly as the placeholders were: no fixture in this
 * job may sanitise or restore corpus text itself (contract §6.5). The escalation was
 * closed the only way §6.5 permits — at the source, through the loader, with a
 * `programme_revisions` row behind it — and NOTHING in either stack changed.
 *
 * The whole diff against the previous recording is those 21 strings, each a pure
 * placeholder→symbol substitution. Every number fe-1, fe-2 and fe-3 assert (27 weeks,
 * 189 hours, u12 at weeks 20 / 22–23, 308 corpus strings, 103 rows) is unmoved.
 */
export const MATH: Programme = JSON.parse(
  // `__dirname` keeps the fixture beside the suite that uses it — the shape that
  // survives promotion into `project/tests/fe/` (the parallel-exercises precedent).
  readFileSync(path.join(__dirname, "fixtures/programme-math.2026-08-11.json"), "utf8"),
) as Programme;

/** One row of ministry text, shaped like the wire. Content is irrelevant to fe-1. */
function row(hours: number) {
  return {
    competencies: ["كفاءة"],
    contents: ["محتوى"],
    guidance: ["توجيه"],
    hours,
    emphasis: "normal",
  };
}

function week(w: number, unitId: string, hours: number): ProgrammeWeek {
  return { week: w, unitId, hours, pdfPages: [w], rows: [row(hours)] };
}

/**
 * A thirty-week programme whose unit `s1` is non-contiguous, same as maths' `u12`.
 *
 * Runs: s1(1–10)=50 · s2(11–20)=50 · s3(21)=5 · s1(22)=5 · s4(23–30)=40 → five runs
 * from four units, 150 hours. `totals` agrees with the weeks here; the disagreement
 * lives in `DIVERGENT_TOTALS` so each fixture pins exactly one thing.
 */
const THIRTY_WEEKS_WEEKS: ProgrammeWeek[] = [
  ...Array.from({ length: 10 }, (_, i) => week(i + 1, "s1", 5)),
  ...Array.from({ length: 10 }, (_, i) => week(i + 11, "s2", 5)),
  week(21, "s3", 5),
  week(22, "s1", 5),
  ...Array.from({ length: 8 }, (_, i) => week(i + 23, "s4", 5)),
];

export const THIRTY_WEEKS: Programme = {
  docKey: "synthetic-thirty",
  edition: "2026-01",
  weeklyHours: 5,
  totals: { weeks: 30, hours: 150 },
  source: { authority: "وزارة التربية الوطنية", title: "تدرّج اصطناعي" },
  emphasisLegend: { text: "تم ادراج ما هو ملّون باللون الأحمر", pdfPage: 2 },
  units: [
    { id: "s1", name: "المحور الأول" },
    { id: "s2", name: "المحور الثاني" },
    { id: "s3", name: "معالجة" },
    { id: "s4", name: "المحور الرابع" },
  ],
  weeks: THIRTY_WEEKS_WEEKS,
};

/**
 * Σ `weeks[].hours` is 150; `totals.hours` says 999. A bar sized off `totals.hours`
 * renders segments summing to 15% of its track and looks merely "a bit empty" —
 * which is why this is pinned rather than eyeballed.
 */
export const DIVERGENT_TOTALS: Programme = {
  ...THIRTY_WEEKS,
  docKey: "synthetic-divergent",
  totals: { weeks: 30, hours: 999 },
};
