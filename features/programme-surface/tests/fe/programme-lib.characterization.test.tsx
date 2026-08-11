/**
 * fe-1 — the programme becomes data `fe` can hold.
 *
 * THE FEATURE, in one sentence: one small pure module turns the ministry's document
 * into the three numbers every screen in this slice draws from — the unit runs, each
 * run's fill, and the two-fact write that «تمّ ✓» and «تخطٍّ ↷» share.
 *
 * The clauses that are here because a plausible implementation gets them wrong:
 *
 *   - **a segment is a unit RUN, not a unit.** Maths has 14 units and **15 runs**:
 *     `u12` holds week 20, `u11` interrupts at 21, `u12` resumes at 22–23. Grouping
 *     by unique `unitId` draws 14 segments and spans one of them from week 20 to
 *     week 23 — four weeks, one of which belongs to another unit. Killed positively
 *     below: the mutant is written out and its own output is asserted to differ.
 *   - **run hours come from the WEEKS, never from a declared per-unit figure.** The
 *     prototype sizes each segment by its unit's own `hours`; walking the runs that
 *     way counts `u12`'s 21 hours twice and sums to **210 against a 189-hour track —
 *     111%, an overflow**. It is exact only on the three corpus documents that happen
 *     to have no non-contiguous unit, so it is invisible on 3 of 5. The route does not
 *     send `units[].hours` at all (contract §2, a correctness exclusion) — this suite
 *     pins that the type has no such field, so the mutant cannot even be typed.
 *   - **the denominator is Σ `weeks[].hours`, never `totals.hours`** (contract §4).
 *     Both say 189 on maths — and on all five documents — so only a synthetic
 *     divergence can hold that line.
 *   - **the week bound comes from the data.** Every real document says twenty-seven,
 *     which is exactly what let a hardcoded twenty-seven survive all 411 backend tests
 *     in slice 1. A thirty-week fixture kills the twin mutant here, and the module's
 *     own source is grepped for the literal.
 *   - **`markedWeek` rides EVERY write** (contract §5, measured: an entry-only PUT is
 *     `400 invalid_request`). So marking a week is two facts, not one, and the builder
 *     is the only place that pairing exists.
 *   - **entries are 1-based, `markedWeek` is 0-based.** There is no week 0 to
 *     annotate, so the builder refuses `W = 0` rather than writing `{week: 0}`.
 */
import { describe, expect, test, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  advanceWrite,
  deriveRuns,
  runFill,
  trackTotal,
  type Programme,
  type ProgrammeWeek,
  type UnitRun,
} from "@/lib/programme";
import { getClassProgramme, saveProgress } from "@/lib/api";
import { DIVERGENT_TOTALS, MATH, THIRTY_WEEKS } from "./programme-fixtures";

const TID = "0123456789abcdef0123456789abcdef";
const CID = "6a7af1b8aee084b1a7cef8bf";

/** Float noise only — these are sums of small integers divided by a small integer. */
const EPS = 1e-9;

// ── the two mutants, written out so their output can be asserted against ───────────
//
// A negative clause that only says "the right answer is X" leaves the reader to trust
// that the wrong answer isn't also X. These produce the wrong answers on the record.

/** MUTANT A — one segment per unique `unitId`, spanning first..last occurrence. */
function runsPerUniqueUnit(weeks: ProgrammeWeek[]) {
  const byUnit = new Map<string, ProgrammeWeek[]>();
  for (const w of weeks) {
    const seen = byUnit.get(w.unitId);
    if (seen) seen.push(w);
    else byUnit.set(w.unitId, [w]);
  }
  return [...byUnit.entries()].map(([unitId, ws]) => ({
    unitId,
    firstWeek: ws[0].week,
    lastWeek: ws[ws.length - 1].week,
  }));
}

/**
 * MUTANT B — the prototype's `segH = u.hours`: walk the runs, size each by its unit's
 * DECLARED hours. The declared figures are not on the wire, so they are read from the
 * stored corpus here purely to compute what the mutant would have drawn.
 */
const DECLARED_UNIT_HOURS: Record<string, number> = {
  u01: 7, u02: 14, u03: 14, u04: 7, u05: 14, u06: 14, u07: 7,
  u08: 21, u09: 21, u10: 14, u11: 7, u12: 21, u13: 21, u14: 7,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

// ── 1 · the run derivation ────────────────────────────────────────────────────────

describe("deriveRuns — a segment is a unit RUN", () => {
  test("the real maths document yields 15 runs from 14 units, in week order", () => {
    expect(MATH.units).toHaveLength(14);
    expect(MATH.weeks).toHaveLength(27);

    const runs = deriveRuns(MATH.weeks);
    expect(runs).toHaveLength(15);

    // week order, and every week accounted for exactly once
    const spans = runs.map((r) => [r.unitId, r.weeks[0].week, r.weeks[r.weeks.length - 1].week]);
    expect(spans).toEqual([
      ["u01", 1, 1],
      ["u02", 2, 3],
      ["u03", 4, 5],
      ["u04", 6, 6],
      ["u05", 7, 8],
      ["u06", 9, 10],
      ["u07", 11, 11],
      ["u08", 12, 14],
      ["u09", 15, 17],
      ["u10", 18, 19],
      ["u12", 20, 20],
      ["u11", 21, 21],
      ["u12", 22, 23],
      ["u13", 24, 26],
      ["u14", 27, 27],
    ]);
    expect(runs.flatMap((r) => r.weeks.map((w) => w.week))).toEqual(
      MATH.weeks.map((w) => w.week),
    );
  });

  test("each run's hours are Σ its own weeks' hours, and they sum to the track", () => {
    const runs = deriveRuns(MATH.weeks);
    for (const run of runs) {
      expect(run.hours).toBe(run.weeks.reduce((s, w) => s + w.hours, 0));
    }
    expect(runs.reduce((s, r) => s + r.hours, 0)).toBe(trackTotal(MATH.weeks));
    expect(trackTotal(MATH.weeks)).toBe(189);
  });

  test("MUTANT A dies: grouping by unique unit draws 14 and mis-spans weeks 20–23", () => {
    const mutant = runsPerUniqueUnit(MATH.weeks);

    // what the mutant actually produces — recorded, not assumed
    expect(mutant).toHaveLength(14);
    expect(mutant.find((m) => m.unitId === "u12")).toEqual({
      unitId: "u12",
      firstWeek: 20,
      lastWeek: 23,
    });

    // …and week 21 belongs to u11, so that span swallows another unit's week
    expect(MATH.weeks.find((w) => w.week === 21)!.unitId).toBe("u11");

    // the real derivation splits it in two, with u11's single week between them
    const real = deriveRuns(MATH.weeks);
    expect(real).not.toHaveLength(mutant.length);
    expect(real.filter((r) => r.unitId === "u12").map((r) => r.weeks.map((w) => w.week))).toEqual([
      [20],
      [22, 23],
    ]);
  });

  test("MUTANT B dies: sizing by declared unit hours overflows the track — 210 of 189", () => {
    const runs = deriveRuns(MATH.weeks);
    const mutantTotal = runs.reduce((s, r) => s + DECLARED_UNIT_HOURS[r.unitId], 0);

    expect(mutantTotal).toBe(210);
    expect(mutantTotal / trackTotal(MATH.weeks)).toBeCloseTo(1.111, 3);
    expect(mutantTotal).toBeGreaterThan(trackTotal(MATH.weeks));

    // the run-summed answer is exact, and it is what the module returns
    expect(runs.reduce((s, r) => s + r.hours, 0)).toBe(189);

    // and the mutant is not merely wrong — it is unreachable. The wire carries no
    // per-unit hours at all (contract §2), so `units[]` has two keys and no more.
    for (const unit of MATH.units) {
      expect(Object.keys(unit).sort()).toEqual(["id", "name"]);
    }
  });
});

// ── 2 · the segment widths ────────────────────────────────────────────────────────

describe("segment fractions — the denominator is Σ weeks[].hours", () => {
  function fractions(p: Programme): number[] {
    const total = trackTotal(p.weeks);
    return deriveRuns(p.weeks).map((r) => r.hours / total);
  }

  test("the maths fractions sum to exactly one track", () => {
    const f = fractions(MATH);
    expect(f).toHaveLength(15);
    expect(f.reduce((s, x) => s + x, 0)).toBeCloseTo(1, 9);
    // the first run is one week of seven hours against 189
    expect(f[0]).toBeCloseTo(7 / 189, 12);
  });

  test("a programme whose totals.hours disagrees with its weeks still sums to one", () => {
    expect(DIVERGENT_TOTALS.totals.hours).toBe(999);
    expect(trackTotal(DIVERGENT_TOTALS.weeks)).toBe(150);
    expect(DIVERGENT_TOTALS.totals.hours).not.toBe(trackTotal(DIVERGENT_TOTALS.weeks));

    const f = fractions(DIVERGENT_TOTALS);
    expect(f.reduce((s, x) => s + x, 0)).toBeCloseTo(1, 9);

    // what the mutant would have drawn: a track filled to 15%
    const mutant = deriveRuns(DIVERGENT_TOTALS.weeks).map(
      (r) => r.hours / DIVERGENT_TOTALS.totals.hours,
    );
    expect(mutant.reduce((s, x) => s + x, 0)).toBeCloseTo(150 / 999, 9);
    expect(mutant.reduce((s, x) => s + x, 0)).toBeLessThan(1 - EPS);
  });
});

// ── 3 · the fill ──────────────────────────────────────────────────────────────────

describe("runFill — Σ hours where week ≤ markedWeek, over the run's hours", () => {
  const runs: UnitRun[] = deriveRuns(MATH.weeks);

  test("markedWeek 0 fills nothing anywhere — a class with no position shows no pacing", () => {
    expect(runs.map((r) => runFill(r, 0))).toEqual(runs.map(() => 0));
  });

  test("markedWeek 10: the first six runs are full, the rest empty — 70 of 189 hours", () => {
    const fills = runs.map((r) => runFill(r, 10));
    expect(fills.slice(0, 6)).toEqual([1, 1, 1, 1, 1, 1]);
    expect(fills.slice(6)).toEqual(new Array(9).fill(0));

    const filled = runs.reduce((s, r) => s + r.hours * runFill(r, 10), 0);
    expect(filled).toBe(70);
    expect(trackTotal(MATH.weeks)).toBe(189);
  });

  test("markedWeek 13 lands mid-run: run 8 (u08, weeks 12–14) fills 14 of 21", () => {
    const eighth = runs[7];
    expect(eighth.unitId).toBe("u08");
    expect(eighth.weeks.map((w) => w.week)).toEqual([12, 13, 14]);
    expect(eighth.hours).toBe(21);

    expect(runFill(eighth, 13)).toBeCloseTo(14 / 21, 12);
    expect(runFill(eighth, 11)).toBe(0); // the run has not been entered
    expect(runFill(eighth, 14)).toBe(1); // fully passed
    expect(runFill(eighth, 20)).toBe(1); // and stays full past its end
  });

  test("the interrupted unit fills as two runs, not one — week 21 does not fill u12", () => {
    const first = runs[10];
    const second = runs[12];
    expect([first.unitId, second.unitId]).toEqual(["u12", "u12"]);

    // positioned at 21: u12's first run is done, its second untouched
    expect(runFill(first, 21)).toBe(1);
    expect(runFill(second, 21)).toBe(0);
    // a single 20→23 segment would read 2 of 4 weeks here — a unit half-taught that
    // has in fact only had its first week
  });
});

// ── 4 · the week bound comes from the data ────────────────────────────────────────

describe("a thirty-week programme — the twin of be-2's kill", () => {
  test("every derivation follows the fixture, not a constant", () => {
    expect(THIRTY_WEEKS.totals.weeks).toBe(30);
    expect(THIRTY_WEEKS.weeks).toHaveLength(30);

    const runs = deriveRuns(THIRTY_WEEKS.weeks);
    expect(runs.map((r) => [r.unitId, r.weeks[0].week, r.weeks[r.weeks.length - 1].week])).toEqual([
      ["s1", 1, 10],
      ["s2", 11, 20],
      ["s3", 21, 21],
      ["s1", 22, 22],
      ["s4", 23, 30],
    ]);
    expect(trackTotal(THIRTY_WEEKS.weeks)).toBe(150);
    expect(runs.reduce((s, r) => s + r.hours, 0)).toBe(150);

    // the last run reaches week 30 and only a mark at 30 fills it
    const last = runs[4];
    expect(runFill(last, 29)).toBeCloseTo(7 / 8, 12);
    expect(runFill(last, 30)).toBe(1);
  });

  test("the module's source carries no twenty-seven literal", () => {
    const root = process.env.CHAR_ROOTDIR;
    if (!root) throw new Error("CHAR_ROOTDIR is unset — run this through `tools/ci fe --slug …`");
    const src = readFileSync(path.join(root, "src/lib/programme.ts"), "utf8");
    const offenders = src.split("\n").filter((l) => l.includes("27"));
    expect(offenders).toEqual([]);
  });
});

// ── 5 · the advance write ─────────────────────────────────────────────────────────

describe("advanceWrite — two facts, because markedWeek rides every PUT", () => {
  test("«تمّ ✓» at week 5 of 27 advances to 6 and records week 5 done", () => {
    expect(advanceWrite(5, 27, "done")).toEqual({
      markedWeek: 6,
      entry: { week: 5, status: "done" },
    });
  });

  test("«تخطٍّ ↷» differs from «تمّ ✓» in exactly one key", () => {
    const done = advanceWrite(5, 27, "done");
    const skipped = advanceWrite(5, 27, "skipped");
    expect(skipped.markedWeek).toBe(done.markedWeek);
    expect(skipped.entry.week).toBe(done.entry.week);
    expect(skipped.entry.status).toBe("skipped");
    expect(done.entry.status).toBe("done");
  });

  test("at the last week the position clamps and the entry still records", () => {
    expect(advanceWrite(27, 27, "skipped")).toEqual({
      markedWeek: 27,
      entry: { week: 27, status: "skipped" },
    });
    expect(advanceWrite(27, 27, "done")).toEqual({
      markedWeek: 27,
      entry: { week: 27, status: "done" },
    });
  });

  test("the clamp follows the bound it is given, not a constant", () => {
    expect(advanceWrite(5, 30, "done").markedWeek).toBe(6);
    expect(advanceWrite(29, 30, "done").markedWeek).toBe(30);
    expect(advanceWrite(30, 30, "done")).toEqual({
      markedWeek: 30,
      entry: { week: 30, status: "done" },
    });
  });

  test("week 0 is refused — entries are 1-based and there is no week 0 to annotate", () => {
    expect(() => advanceWrite(0, 27, "done")).toThrow();
    expect(() => advanceWrite(0, 27, "skipped")).toThrow();
    expect(() => advanceWrite(-1, 27, "done")).toThrow();
  });
});

// ── 6 · the wire ──────────────────────────────────────────────────────────────────

/** Minimal `fetch` stand-in — records the call, answers with the given body. */
function stubFetch(body: unknown, ok = true, status = 200) {
  const calls: { url: string; init: RequestInit }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init: RequestInit) => {
      calls.push({ url, init });
      return Promise.resolve({ ok, status, json: () => Promise.resolve(body) } as Response);
    }),
  );
  return calls;
}

describe("the calls", () => {
  test("getClassProgramme reads the class's own programme, relative and identified", async () => {
    const calls = stubFetch({ programme: MATH, correlationId: "cid-programme" });

    const programme = await getClassProgramme(TID, CID);

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(`/api/classes/${CID}/programme`);
    expect(calls[0].url.startsWith("/api/")).toBe(true); // never an absolute URL
    expect(calls[0].init.method).toBe("GET");
    expect((calls[0].init.headers as Record<string, string>)["x-teacher-id"]).toBe(TID);
    expect(calls[0].init.body).toBeUndefined();

    // the envelope is unwrapped; the document arrives whole
    expect(programme.docKey).toBe("tadarroj-3as-math");
    expect(programme.weeks).toHaveLength(27);
    expect(Object.keys(programme).sort()).toEqual([
      "docKey",
      "edition",
      "emphasisLegend",
      "source",
      "totals",
      "units",
      "weeklyHours",
      "weeks",
    ]);
  });

  test("saveProgress carries an entry verbatim when the builder produces one", async () => {
    const calls = stubFetch({ progress: { classId: CID, markedWeek: 9, rev: 4 } });

    const built = advanceWrite(8, 27, "done");
    await saveProgress(TID, CID, { rev: 3, ...built });

    expect(calls[0].url).toBe(`/api/progress/${CID}`);
    expect(calls[0].init.method).toBe("PUT");
    expect(calls[0].init.body).toBe(
      '{"rev":3,"markedWeek":9,"entry":{"week":8,"status":"done"}}',
    );
  });

  test("without an entry the slice-1 body goes out byte-identical", async () => {
    const calls = stubFetch({ progress: { classId: CID, markedWeek: 9, rev: 4 } });

    await saveProgress(TID, CID, { rev: 3, markedWeek: 9 });

    // no `entry` key at all — not null, not an empty object. `be` reads the key's
    // presence, and «وصلنا هنا» is slice 1's setter write reused unchanged.
    expect(calls[0].init.body).toBe('{"rev":3,"markedWeek":9}');
  });
});
