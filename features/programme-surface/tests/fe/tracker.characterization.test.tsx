/**
 * fe-4 — the tracker: nine screens made usable, and the writes where the eyes are.
 *
 * THE FEATURE, in one sentence: «البرنامج» renders the ministry's whole year as one band
 * per week — folded shut except where the teacher is — and the current band is where the
 * week gets marked.
 *
 * The clauses that are here because a plausible implementation gets them wrong:
 *
 *   - **collapse is load-bearing, not polish.** The real page is ~8,060 px with a 5.1×
 *     band-height ratio. A folded band's `rows[]` must be ABSENT FROM THE DOM, not hidden
 *     — `display: none` still costs the layout of 103 rows of KaTeX — and the current
 *     week must mount open or the teacher lands on a screen with nothing on it.
 *   - **scroll to the marked week ONCE.** On mount, so the teacher's own position is not
 *     four screens down; never again, or pressing «تمّ ✓» halfway through the year yanks
 *     the page out from under the finger that pressed it.
 *   - **every row, and every field on it.** The handoff's grid draws one row per week and
 *     has no competencies column at all. Real week 20 has seven rows; four carry no
 *     contents. Both counts are COMPUTED from the corpus here.
 *   - **the per-row hours sit under the week's total.** That is the whole reason for the
 *     nested sub-grid, and «the rows sum to the week» is asserted from the fixture rather
 *     than trusted.
 *   - **two text channels, one per author.** Ministry strings go through KaTeX; the
 *     teacher's note does not, because `Statement` pairs two «$» and silently eats both.
 *     The corruption is reproduced as a positive control, then shown not to reach a note.
 *   - **the 409 re-asks AT THE ROW.** The tracker turns one write per session into many,
 *     so a lost compare-and-set is ordinary. A banner would cost the teacher their place
 *     on a twenty-seven-band screen, and an auto-resubmit would restore exactly the silent
 *     overwrite the CAS exists to refuse.
 *   - **two numbers that agree today.** `totals.weeks` labels the header, `totalWeeks`
 *     bounds the write (contract §3). One render disagrees with itself on purpose so a
 *     component that collapsed them cannot pass.
 *   - **the absences are the deliverable.** No pacing marker, no pace sentence, no
 *     «سلسلة الأسبوع», no «تمارين دعم», no note input. Each is pinned executably, because
 *     an absence nobody asserts is one refactor away from being helpfully restored.
 *
 * Fixtures are fe-1's (`programme-fixtures.ts`), frozen — `MATH` is the real recorded
 * corpus at `transcriptionRev 5`, re-verified byte-identical to the live route at this
 * sub-issue's pre-flight. The progress fixtures are built here, because progress is not
 * programme data and no frozen file carries an `entries` array.
 */
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import Tracker from "@/components/Tracker";
import { GenerateError, STORE_UNAVAILABLE_AR } from "@/lib/api";
import type { ProgressEntry } from "@/lib/classes";
import { Statement } from "@/lib/katex";
import type { Programme, ProgrammeWeek } from "@/lib/programme";
import { DIVERGENT_TOTALS, MATH, THIRTY_WEEKS } from "./programme-fixtures";

afterEach(cleanup);

// ── plumbing ──────────────────────────────────────────────────────────────────────

function rootDir(): string {
  const root = process.env.CHAR_ROOTDIR;
  if (!root) throw new Error("CHAR_ROOTDIR is unset — run this through `tools/ci fe --slug …`");
  return root;
}

const readSrc = (rel: string) => readFileSync(path.join(rootDir(), rel), "utf8");

/**
 * The same source with its prose stripped — fe-2's tool, inherited for the same reason.
 *
 * This file's comments explain why «27» is not read from a constant, and quote it to do
 * so. A grep that punished that would push the reasoning out of the file. What must not
 * appear is the code.
 */
const readCode = (rel: string) =>
  readSrc(rel)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");

const COMPONENT = "src/components/Tracker.tsx";

/** Whitespace is layout, not content — every text comparison runs through this. */
const norm = (s: string) => s.replace(/\s+/g, " ").trim();

type Progress = { markedWeek: number; entries: ProgressEntry[]; rev: number };

type WriteBody = { markedWeek: number; entry?: { week: number; status: string } };

function draw(
  programme: Programme,
  progress: Progress,
  totalWeeks: number,
  onWrite: (body: WriteBody) => Promise<unknown> = vi.fn(async () => undefined),
) {
  const view = render(
    <Tracker
      programme={programme}
      progress={progress}
      totalWeeks={totalWeeks}
      onWrite={onWrite}
    />,
  );
  const container = view.container;
  const band = (week: number) =>
    container.querySelector(`.tracker__band[data-week="${week}"]`) as HTMLElement;
  return {
    view,
    container,
    onWrite,
    band,
    bands: () => [...container.querySelectorAll(".tracker__band")] as HTMLElement[],
    text: () => norm(container.textContent ?? ""),
    bandText: (week: number) => norm(band(week).textContent ?? ""),
    toggle: (week: number) => band(week).querySelector(".tracker__toggle") as HTMLButtonElement,
    /** A band's own action, found by its Arabic label — never by DOM position. */
    act: (week: number, label: string) =>
      [...band(week).querySelectorAll("button")].find((b) =>
        norm(b.textContent ?? "").includes(label),
      ) as HTMLButtonElement | undefined,
    rerender: (next: Partial<{ progress: Progress; totalWeeks: number }>) =>
      view.rerender(
        <Tracker
          programme={programme}
          progress={next.progress ?? progress}
          totalWeeks={next.totalWeeks ?? totalWeeks}
          onWrite={onWrite}
        />,
      ),
  };
}

/**
 * Every element the TRACKER authored — KaTeX's own output and the bar's excluded.
 *
 * A rendered math island is a tree of `<span style="height:0.675em">`s the renderer
 * emits and this product does not control; the bar's segments carry inline widths
 * because a width IS its datum, and that ruling is fe-2's, pinned in fe-2's own suite.
 * Sweeping either here would fail clauses on components doing exactly what they should.
 */
const ours = (container: HTMLElement): HTMLElement[] =>
  ([...container.querySelectorAll("*")] as HTMLElement[]).filter(
    (el) => !el.closest(".math") && !el.closest(".progbar"),
  );

const weekOf = (programme: Programme, week: number): ProgrammeWeek =>
  programme.weeks.find((w) => w.week === week)!;

/**
 * The prose of a ministry string, with its maths removed.
 *
 * `$…$` becomes KaTeX and its characters are no longer the source's, so a "renders
 * verbatim" clause compares what survives as text. Short fragments are dropped because
 * they match anywhere and would make the clause vacuous.
 */
const prosePieces = (s: string): string[] =>
  s
    .split(/\$[^$]*\$/)
    .map((t) => norm(t))
    .filter((t) => t.length > 3);

const ministryStrings = (row: ProgrammeWeek["rows"][number]): string[] => [
  ...row.competencies,
  ...row.contents,
  ...row.guidance,
];

/** The note the two-channel rule exists for — the recorded `Statement` corruption case. */
const DOLLAR_NOTE = "من 5 $ إلى 9 $ دينار";

const ENTRIES: ProgressEntry[] = [
  { week: 3, status: "done", completedAt: "2026-08-11T09:00:00.000Z" },
  { week: 4, status: "skipped", note: DOLLAR_NOTE },
  { week: 5, status: "planned" },
  { week: 22, status: "planned", note: "نراجع قبل العطلة" },
];

const AT_8: Progress = { markedWeek: 8, entries: ENTRIES, rev: 4 };
const AT_0: Progress = { markedWeek: 0, entries: [], rev: 0 };

const conflict = () =>
  new GenerateError("تغيّر تقدّم القسم أثناء الحفظ", "backend", false, "cid-1", undefined, "conflict");

/**
 * `scrollIntoView` does not exist in jsdom — there is no layout to scroll.
 *
 * Installing it on the prototype is both the spy and the environment: the component
 * optional-calls it precisely because it may be absent, so a run WITHOUT this install
 * still has to mount cleanly. The last clause of §3 checks that directly.
 */
let scrollSpy: ReturnType<typeof vi.fn>;
let scrolled: Element[];
beforeEach(() => {
  scrolled = [];
  scrollSpy = vi.fn(function (this: Element) {
    scrolled.push(this);
  });
  (Element.prototype as unknown as Record<string, unknown>).scrollIntoView = scrollSpy;
});
afterEach(() => {
  delete (Element.prototype as unknown as Record<string, unknown>).scrollIntoView;
});

// ══ 1 · THE YEAR ═══════════════════════════════════════════════════════════════════

describe("the whole year renders, one band per week", () => {
  test("twenty-seven bands for maths, in the ministry's own order", () => {
    const t = draw(MATH, AT_8, 27);
    const bands = t.bands();

    expect(bands).toHaveLength(MATH.weeks.length);
    expect(bands).toHaveLength(27);
    expect(bands.map((b) => Number(b.dataset.week))).toEqual(MATH.weeks.map((w) => w.week));
  });

  test("THIRTY bands on the thirty-week programme — no twenty-seven anywhere in the code", () => {
    const t = draw(THIRTY_WEEKS, { markedWeek: 4, entries: [], rev: 1 }, 30);

    expect(t.bands()).toHaveLength(30);
    expect(t.band(30)).toBeTruthy();
    expect(
      norm(t.container.querySelector(".tracker__provenance")!.textContent ?? ""),
    ).toContain("30 أسبوعًا");
    expect(readCode(COMPONENT)).not.toContain("27");
  });

  test("the segmented bar is present, and above the bands", () => {
    const t = draw(MATH, AT_8, 27);
    const bar = t.container.querySelector(".progbar")!;
    const list = t.container.querySelector(".tracker__bands")!;

    expect(bar).toBeTruthy();
    // fe-2's own suite owns the segment count; what is fe-4's is that the bar is HOSTED
    expect(bar.querySelectorAll(".progbar__seg")).toHaveLength(15);
    expect(bar.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  test("the header's week count is the MINISTRY'S summary, not the write bound (§3)", async () => {
    // one render, two sources, deliberately disagreeing: the maths document's own
    // `totals.weeks` is 27 while this class's write bound is 30
    const t = draw(MATH, { markedWeek: 27, entries: [], rev: 9 }, 30);
    const head = norm(t.container.querySelector(".tracker__head")!.textContent ?? "");

    expect(head).toContain(`${MATH.totals.weeks} أسبوعًا`);
    expect(head).toContain("27 أسبوعًا");
    expect(head).not.toContain("30 أسبوعًا");

    // …and the write that same render offers is clamped against the OTHER number
    await act(async () => {
      fireEvent.click(t.act(27, "تمّ ✓")!);
    });
    expect(t.onWrite).toHaveBeenCalledWith({
      markedWeek: 28,
      entry: { week: 27, status: "done" },
    });
  });
});

// ══ 2 · COLLAPSE — the 8,060 px fact, made mechanical ══════════════════════════════

describe("collapsed by default, because the real page is nine screens", () => {
  test("a non-current band is ONE summary line and its rows are not in the DOM", () => {
    const t = draw(MATH, AT_8, 27);
    const w20 = weekOf(MATH, 20);
    const b20 = t.band(20);

    expect(b20.querySelectorAll(".tracker__row")).toHaveLength(0);
    expect(b20.querySelectorAll(".tracker__rowhours")).toHaveLength(0);

    // not merely hidden: none of the ministry's words for this week exist anywhere
    const text = t.bandText(20);
    for (const row of w20.rows)
      for (const s of ministryStrings(row))
        for (const piece of prosePieces(s)) expect(text).not.toContain(piece);

    // what a summary line DOES carry: the week, its unit, its hours, its status
    expect(text).toContain("الأسبوع 20");
    expect(text).toContain(MATH.units.find((u) => u.id === w20.unitId)!.name);
    expect(text).toContain(`${w20.hours} ساعة`);
    expect(text).toContain("قادم");
  });

  test("the whole collapsed year holds no ministry row text at all", () => {
    const t = draw(MATH, AT_8, 27);
    const text = t.text();

    // every week except the current one — 102 of 103 rows must be absent
    const hidden = MATH.weeks.filter((w) => w.week !== 8);
    expect(hidden.reduce((n, w) => n + w.rows.length, 0)).toBe(
      103 - weekOf(MATH, 8).rows.length,
    );

    /* Ministry phrasing repeats across weeks, so a piece that ALSO belongs to the one
     * open week proves nothing about the folded ones. Those are excluded rather than
     * ignored, and the surviving count is asserted so the clause cannot empty itself. */
    const visible = weekOf(MATH, 8)
      .rows.flatMap(ministryStrings)
      .flatMap(prosePieces);
    let checked = 0;
    for (const w of hidden)
      for (const row of w.rows)
        for (const s of row.competencies)
          for (const piece of prosePieces(s)) {
            if (visible.some((v) => v.includes(piece))) continue;
            checked += 1;
            expect(text).not.toContain(piece);
          }
    expect(checked).toBeGreaterThan(80);
  });

  test("the CURRENT week mounts expanded — the teacher lands on something", () => {
    const t = draw(MATH, AT_8, 27);
    const w8 = weekOf(MATH, 8);

    expect(t.band(8).dataset.open).toBe("true");
    expect(t.band(8).querySelectorAll(".tracker__row")).toHaveLength(w8.rows.length);
    expect(t.toggle(8).getAttribute("aria-expanded")).toBe("true");
  });

  test("clicking a folded band opens it to the full sub-grid, and again folds it", () => {
    const t = draw(MATH, AT_8, 27);
    const w20 = weekOf(MATH, 20);

    expect(t.toggle(20).getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(t.toggle(20));

    expect(t.toggle(20).getAttribute("aria-expanded")).toBe("true");
    expect(t.band(20).querySelectorAll(".tracker__row")).toHaveLength(7);
    expect(t.bandText(20)).toContain(prosePieces(w20.rows[0]!.competencies[0]!)[0]!);

    fireEvent.click(t.toggle(20));
    expect(t.band(20).querySelectorAll(".tracker__row")).toHaveLength(0);
  });

  test("the teacher may fold the current week away, and it stays folded", () => {
    const t = draw(MATH, AT_8, 27);
    fireEvent.click(t.toggle(8));
    expect(t.band(8).querySelectorAll(".tracker__row")).toHaveLength(0);
  });
});

// ══ 3 · SCROLL TO THE MARKED WEEK — once ═══════════════════════════════════════════

describe("the teacher's own position is on screen when they arrive", () => {
  test("the marked band is scrolled to on mount", () => {
    const t = draw(MATH, AT_8, 27);

    expect(scrollSpy).toHaveBeenCalledTimes(1);
    expect(scrolled[0]).toBe(t.band(8));
  });

  test("and NOT again when the position moves under it", () => {
    const t = draw(MATH, AT_8, 27);
    scrollSpy.mockClear();

    t.rerender({ progress: { markedWeek: 9, entries: ENTRIES, rev: 5 } });
    t.rerender({ progress: { markedWeek: 10, entries: ENTRIES, rev: 6 } });
    fireEvent.click(t.toggle(20));

    expect(scrollSpy).not.toHaveBeenCalled();
  });

  test("an unpositioned class scrolls nowhere — there is no week to land on", () => {
    draw(MATH, AT_0, 27);
    expect(scrollSpy).not.toHaveBeenCalled();
  });

  test("it mounts cleanly where `scrollIntoView` does not exist at all", () => {
    delete (Element.prototype as unknown as Record<string, unknown>).scrollIntoView;
    expect(() => draw(MATH, AT_8, 27)).not.toThrow();
  });
});

// ══ 4 · THE SUB-GRID — the rows sum to the week, visibly ═══════════════════════════

describe("per-row hours stand under the week's own total", () => {
  test("the corpus fact this column exists to show", () => {
    const w20 = weekOf(MATH, 20);
    expect(w20.rows.map((r) => r.hours)).toEqual([1, 1, 1, 1, 1, 1, 1]);
    expect(w20.rows.reduce((n, r) => n + r.hours, 0)).toBe(w20.hours);
  });

  test("an expanded seven-row week shows seven row figures AND the week total", () => {
    const t = draw(MATH, AT_8, 27);
    fireEvent.click(t.toggle(20));
    const b20 = t.band(20);
    const w20 = weekOf(MATH, 20);

    const rowHours = [...b20.querySelectorAll(".tracker__rowhours")].map((el) =>
      norm(el.textContent ?? ""),
    );
    expect(rowHours).toEqual(w20.rows.map((r) => `${r.hours} ساعة`));

    const total = norm(b20.querySelector(".tracker__weekhours")!.textContent ?? "");
    expect(total).toBe(`${w20.hours} ساعة`);

    // both visible at once — that is what makes the arithmetic checkable by eye
    expect(rowHours).toHaveLength(7);
    expect(b20.querySelector(".tracker__rows")!.contains(b20.querySelector(".tracker__weekhours")))
      .toBe(true);
  });

  test("the week total is on the summary line too — it is week-scoped", () => {
    const t = draw(MATH, AT_8, 27);
    expect(norm(t.band(6).querySelector(".tracker__weekhours")!.textContent ?? "")).toBe(
      `${weekOf(MATH, 6).hours} ساعة`,
    );
  });
});

// ══ 5 · EVERY ROW, AND EVERY FIELD ON IT — the H2 kill ═════════════════════════════

describe("a week is rows[], and the tracker renders all of them", () => {
  test("the counts that make this screen impossible to port", () => {
    const w20 = weekOf(MATH, 20);
    expect(w20.rows).toHaveLength(7);
    expect(w20.rows.filter((r) => r.competencies.length > 0)).toHaveLength(7);
    expect(w20.rows.filter((r) => r.contents.length > 0)).toHaveLength(3);
    // the handoff's grid has a content column and no competencies column:
    expect(w20.rows.filter((r) => r.contents.length === 0)).toHaveLength(4);
  });

  test("real week 20 renders seven rows and not one of them is blank", () => {
    const t = draw(MATH, AT_8, 27);
    fireEvent.click(t.toggle(20));
    const rows = [...t.band(20).querySelectorAll(".tracker__row")] as HTMLElement[];
    const w20 = weekOf(MATH, 20);

    expect(rows).toHaveLength(7);
    rows.forEach((el, i) => {
      const row = w20.rows[i]!;
      const text = norm(el.textContent ?? "");
      for (const s of ministryStrings(row))
        for (const piece of prosePieces(s)) expect(text).toContain(piece);
      expect(text.length).toBeGreaterThan(10);
    });
  });

  test("a row with a competency and no contents shows its competency", () => {
    const t = draw(MATH, AT_8, 27);
    fireEvent.click(t.toggle(20));
    const w20 = weekOf(MATH, 20);
    const i = w20.rows.findIndex((r) => r.contents.length === 0 && r.competencies.length > 0);
    expect(i).toBeGreaterThanOrEqual(0);

    const el = t.band(20).querySelector(`.tracker__row[data-row="${i}"]`)!;
    const text = norm(el.textContent ?? "");
    expect(text).toContain("الكفاءات المستهدفة");
    expect(text).not.toContain("المحتويات المعرفية");
    for (const piece of prosePieces(w20.rows[i]!.competencies[0]!))
      expect(text).toContain(piece);
  });
});

// ══ 6 · THE MINISTRY'S CHANNEL — verbatim, through KaTeX, attributed from DATA ══════

describe("ministry text goes through Statement, with its provenance from the wire", () => {
  test("guidance carrying maths renders KaTeX islands inside RTL prose", () => {
    const t = draw(MATH, AT_8, 27);
    const withMath = MATH.weeks.find((w) => w.rows.some((r) => r.guidance.join(" ").includes("$")))!;
    fireEvent.click(t.toggle(withMath.week));

    const band = t.band(withMath.week);
    expect(band.querySelectorAll(".math").length).toBeGreaterThan(0);
    expect(band.querySelectorAll(".katex-error")).toHaveLength(0);
    // the source is never the DOM's text — no teacher ever sees a dollar sign
    expect(norm(band.textContent ?? "")).not.toContain("$");
  });

  test("guidance is joined with a newline — one paragraph per ministry sentence", () => {
    const multi = MATH.weeks.find((w) => w.rows.some((r) => r.guidance.length > 1))!;
    const at = multi.rows.findIndex((r) => r.guidance.length > 1);
    const row = multi.rows[at]!;
    const t = draw(MATH, AT_8, 27);
    fireEvent.click(t.toggle(multi.week));

    const body = t
      .band(multi.week)
      .querySelector(
        `.tracker__row[data-row="${at}"] .tracker__field--guidance .tracker__fieldbody`,
      )!;
    /* Exact, not «at least»: no corpus guidance string carries a newline of its own or
     * opens with a numbered-list marker, so `Statement` makes one `<p>` per ministry
     * sentence and no more — measured at this sub-issue's pre-flight. */
    expect(body.querySelectorAll(".statement__p")).toHaveLength(row.guidance.length);
    expect(row.guidance.length).toBeGreaterThan(1);
    // the mutant: `join(" · ")` fuses two of their sentences into one paragraph
    expect(norm(body.textContent ?? "")).not.toContain("·");
  });

  test("the unit name goes through Statement — the channel follows the AUTHOR", () => {
    const t = draw(MATH, AT_8, 27);
    expect(t.band(8).querySelector(".tracker__unit .statement")).toBeTruthy();

    // forged, because no corpus unit name happens to carry maths today and «this sample
    // has no $» is an observation about one document while the rule is about who wrote it
    const forged: Programme = {
      ...MATH,
      units: MATH.units.map((u) => (u.id === "u05" ? { ...u, name: "المجال $[0;1]$" } : u)),
    };
    const f = draw(forged, AT_8, 27);
    expect(f.band(8).querySelectorAll(".math").length).toBeGreaterThan(0);
    expect(norm(f.band(8).querySelector(".tracker__unit")!.textContent ?? "")).not.toContain("$");
  });

  test("the provenance line is DATA — edit the document and the header follows", () => {
    const edited: Programme = {
      ...MATH,
      source: { authority: "سلطة أخرى للاختبار", title: "عنوان آخر" },
    };
    const t = draw(edited, AT_8, 27);
    const head = norm(t.container.querySelector(".tracker__provenance")!.textContent ?? "");

    expect(head).toContain("سلطة أخرى للاختبار");
    expect(head).toContain("عنوان آخر");
    expect(head).not.toContain(MATH.source.authority);

    // and the prototype's hardcoded attribution appears nowhere in the source
    const code = readCode(COMPONENT);
    expect(code).not.toContain(MATH.source.authority);
    expect(code).not.toContain("التدرجات السنوية الرسمية");
    expect(code).not.toContain("المفتشية العامة");
  });

  test("an expanded week carries the printed pages it was transcribed from", () => {
    const t = draw(MATH, AT_8, 27);
    const w = weekOf(MATH, 8);
    expect(norm(t.band(8).querySelector(".tracker__pages")!.textContent ?? "")).toBe(
      `${w.pdfPages.length > 1 ? "الصفحات" : "الصفحة"} ${w.pdfPages.join("، ")}`,
    );

    const twoPages = MATH.weeks.find((x) => x.pdfPages.length > 1)!;
    fireEvent.click(t.toggle(twoPages.week));
    expect(norm(t.band(twoPages.week).querySelector(".tracker__pages")!.textContent ?? "")).toBe(
      `الصفحات ${twoPages.pdfPages.join("، ")}`,
    );
  });

  test("contents are inert — no anchor, no handler, no «الدرس ←»", () => {
    const t = draw(MATH, AT_8, 27);
    fireEvent.click(t.toggle(20));
    const b20 = t.band(20);

    expect(b20.querySelectorAll("a")).toHaveLength(0);
    expect(b20.querySelectorAll(".tracker__item button")).toHaveLength(0);
    expect(t.text()).not.toContain("الدرس");
  });
});

// ══ 7 · EMPHASIS — provenance, never status, never red ═════════════════════════════

describe("the ministry's red marking renders as their own sentence", () => {
  test("week 24 is the corpus's own `added-2022` case", () => {
    const w24 = weekOf(MATH, 24);
    expect(w24.rows.filter((r) => r.emphasis === "added-2022")).toHaveLength(4);
    expect(MATH.weeks.flatMap((w) => w.rows).filter((r) => r.emphasis === "red-unlegended"))
      .toHaveLength(0);
  });

  test("a flagged row wears a marker, and the band quotes the legend with its page", () => {
    const t = draw(MATH, AT_8, 27);
    fireEvent.click(t.toggle(24));
    const b24 = t.band(24);
    const w24 = weekOf(MATH, 24);

    expect(b24.querySelectorAll(".tracker__flag")).toHaveLength(4);
    b24.querySelectorAll(".tracker__flag").forEach((el) => {
      expect(el.getAttribute("title")).toBe(MATH.emphasisLegend.text);
    });

    // once per band, not once per row — the legend is a sentence, not a chip
    const legend = [...b24.querySelectorAll(".tracker__legend")];
    expect(legend).toHaveLength(1);
    const text = norm(legend[0]!.textContent ?? "");
    expect(text).toContain(MATH.emphasisLegend.text);
    expect(text).toContain(`الصفحة ${MATH.emphasisLegend.pdfPage}`);

    // the unflagged row of week 24 wears nothing
    const plain = w24.rows.findIndex((r) => r.emphasis === "normal");
    expect(
      b24.querySelector(`.tracker__row[data-row="${plain}"] .tracker__flag`),
    ).toBeNull();
  });

  test("the legend is QUOTED, never paraphrased, and never coloured", () => {
    const edited: Programme = {
      ...MATH,
      emphasisLegend: { text: "عبارة الوزارة المعدَّلة للاختبار", pdfPage: 99 },
    };
    const t = draw(edited, AT_8, 27);
    fireEvent.click(t.toggle(24));
    const text = norm(t.band(24).querySelector(".tracker__legend")!.textContent ?? "");

    expect(text).toContain("عبارة الوزارة المعدَّلة للاختبار");
    expect(text).toContain("الصفحة 99");
    expect(readCode(COMPONENT)).not.toContain("2021-2022");
    expect(readCode(COMPONENT)).not.toContain("2022-2021");
  });

  test("the allow-list is `added-2022` alone — an unknown value renders as normal", () => {
    const odd: Programme = {
      ...MATH,
      weeks: MATH.weeks.map((w) =>
        w.week === 6
          ? { ...w, rows: w.rows.map((r) => ({ ...r, emphasis: "red-unlegended" })) }
          : w,
      ),
    };
    const t = draw(odd, AT_8, 27);
    fireEvent.click(t.toggle(6));

    expect(t.band(6).querySelectorAll(".tracker__flag")).toHaveLength(0);
    expect(t.band(6).querySelectorAll(".tracker__legend")).toHaveLength(0);
    // the mutant this kills is the deny-list `emphasis !== "normal"`
    expect(readCode(COMPONENT)).not.toContain("red-unlegended");
  });
});

// ══ 8 · THE TEACHER'S CHANNEL — plain text, always ════════════════════════════════

describe("a note is the teacher's own writing and never touches KaTeX", () => {
  test("POSITIVE CONTROL: `Statement` really does eat a teacher's two «$»", () => {
    const probe = render(<Statement text={DOLLAR_NOTE} />);
    const shown = norm(probe.container.textContent ?? "");
    expect(shown).not.toContain("$");
    expect(shown).not.toBe(DOLLAR_NOTE);
    expect(probe.container.querySelectorAll(".math").length).toBeGreaterThan(0);
    probe.unmount();
  });

  test("the same note renders byte-verbatim on its band, both «$» intact", () => {
    const t = draw(MATH, AT_8, 27);
    const note = t.band(4).querySelector(".tracker__note")!;
    const text = norm(note.textContent ?? "");

    expect(text).toContain(DOLLAR_NOTE);
    expect((text.match(/\$/g) ?? []).length).toBe(2);
    expect(note.querySelectorAll(".math")).toHaveLength(0);
    expect(note.querySelectorAll(".statement")).toHaveLength(0);
    expect(text).toContain("ملاحظتك");
  });

  test("a note shows on a folded band — the disclosure compresses THEIR rows, not yours", () => {
    const t = draw(MATH, AT_8, 27);
    expect(t.band(4).dataset.open).toBe("false");
    expect(t.band(4).querySelectorAll(".tracker__row")).toHaveLength(0);
    expect(t.bandText(4)).toContain(DOLLAR_NOTE);
  });

  test("a week with no note renders no note node at all", () => {
    const t = draw(MATH, AT_8, 27);
    expect(t.band(3).querySelectorAll(".tracker__note")).toHaveLength(0);
    expect(t.bandText(3)).not.toContain("ملاحظتك");
  });

  test("there is no input anywhere — notes are rendered, never authored, this slice", () => {
    const t = draw(MATH, AT_8, 27);
    expect(t.container.querySelectorAll("input")).toHaveLength(0);
    expect(t.container.querySelectorAll("textarea")).toHaveLength(0);
    expect(t.container.querySelectorAll("select")).toHaveLength(0);
  });
});

// ══ 9 · STATUS VOCABULARY — one probe per variant (WF-70) ═════════════════════════

describe("what each band says about itself", () => {
  const tagOf = (t: ReturnType<typeof draw>, week: number) =>
    norm(t.band(week).querySelector(".tracker__tag")!.textContent ?? "");

  test("`< markedWeek` with no entry reads «منجز»", () => {
    expect(tagOf(draw(MATH, AT_8, 27), 6)).toBe("منجز");
  });

  test("an entry `done` reads «منجز»", () => {
    expect(tagOf(draw(MATH, AT_8, 27), 3)).toBe("منجز");
  });

  test("an entry `skipped` reads «مُتخطّى»", () => {
    expect(tagOf(draw(MATH, AT_8, 27), 4)).toBe("مُتخطّى");
  });

  test("`=== markedWeek` reads «الأسبوع الحالي»", () => {
    expect(tagOf(draw(MATH, AT_8, 27), 8)).toBe("الأسبوع الحالي");
  });

  test("`> markedWeek` reads «قادم»", () => {
    expect(tagOf(draw(MATH, AT_8, 27), 9)).toBe("قادم");
  });

  test("the CURRENT week keeps its own label even once it carries an entry", () => {
    /* Real at the last week: the position stays put while the entry records, so week `T`
     * is both marked and annotated. The actions live on the current band, and a band
     * labelled «منجز» beside «تمّ ✓» contradicts itself in one glance. */
    const t = draw(
      MATH,
      { markedWeek: 8, entries: [...ENTRIES, { week: 8, status: "done" }], rev: 7 },
      27,
    );
    expect(tagOf(t, 8)).toBe("الأسبوع الحالي");
    expect(t.act(8, "تمّ ✓")).toBeTruthy();
    expect(t.act(8, "تخطٍّ ↷")).toBeTruthy();
  });

  test("`planned` has no label of its own — it reads as its week's derived state", () => {
    const t = draw(MATH, AT_8, 27);
    expect(tagOf(t, 5)).toBe("منجز"); // planned, behind the mark
    expect(tagOf(t, 22)).toBe("قادم"); // planned, ahead of it
    expect(t.bandText(22)).toContain("نراجع قبل العطلة"); // …and its note still shows
  });
});

// ══ 10 · THE WRITES ═══════════════════════════════════════════════════════════════

describe("«تمّ ✓» and «تخطٍّ ↷» differ in exactly one key", () => {
  test("«تمّ ✓» advances the position and records the week done", async () => {
    const t = draw(MATH, AT_8, 27);
    await act(async () => {
      fireEvent.click(t.act(8, "تمّ ✓")!);
    });

    expect(t.onWrite).toHaveBeenCalledTimes(1);
    expect(t.onWrite).toHaveBeenCalledWith({
      markedWeek: 9,
      entry: { week: 8, status: "done" },
    });
  });

  test("«تخطٍّ ↷» sends the same body with `status` and nothing else changed", async () => {
    const done = draw(MATH, AT_8, 27);
    await act(async () => {
      fireEvent.click(done.act(8, "تمّ ✓")!);
    });
    cleanup();
    const skip = draw(MATH, AT_8, 27);
    await act(async () => {
      fireEvent.click(skip.act(8, "تخطٍّ ↷")!);
    });

    const a = (done.onWrite as unknown as { mock: { calls: WriteBody[][] } }).mock.calls[0]![0]!;
    const b = (skip.onWrite as unknown as { mock: { calls: WriteBody[][] } }).mock.calls[0]![0]!;

    const diff = Object.keys({ ...a, ...b }).filter(
      (k) => JSON.stringify((a as never)[k]) !== JSON.stringify((b as never)[k]),
    );
    expect(diff).toEqual(["entry"]);
    expect(a.entry!.week).toBe(b.entry!.week);
    expect([a.entry!.status, b.entry!.status]).toEqual(["done", "skipped"]);
  });

  test("the two actions exist ONLY on the current band", () => {
    const t = draw(MATH, AT_8, 27);
    expect(t.act(8, "تمّ ✓")).toBeTruthy();
    expect(t.act(8, "تخطٍّ ↷")).toBeTruthy();
    for (const w of [1, 7, 9, 27]) {
      expect(t.act(w, "تمّ ✓")).toBeUndefined();
      expect(t.act(w, "تخطٍّ ↷")).toBeUndefined();
    }
  });

  test("at the last week the position stays put and the entry still records", async () => {
    const t = draw(THIRTY_WEEKS, { markedWeek: 30, entries: [], rev: 2 }, 30);
    await act(async () => {
      fireEvent.click(t.act(30, "تمّ ✓")!);
    });

    expect(t.onWrite).toHaveBeenCalledWith({
      markedWeek: 30,
      entry: { week: 30, status: "done" },
    });
  });

  test("«وصلنا هنا» sets the position directly, with NO entry", async () => {
    const t = draw(MATH, AT_8, 27);
    await act(async () => {
      fireEvent.click(t.act(15, "وصلنا هنا")!);
    });

    expect(t.onWrite).toHaveBeenCalledTimes(1);
    const body = (t.onWrite as unknown as { mock: { calls: WriteBody[][] } }).mock.calls[0]![0]!;
    expect(body).toEqual({ markedWeek: 15 });
    expect("entry" in body).toBe(false);
  });

  test("«وصلنا هنا» is offered on every non-current band", () => {
    const t = draw(MATH, AT_8, 27);
    const offered = MATH.weeks.filter((w) => t.act(w.week, "وصلنا هنا"));
    expect(offered.map((w) => w.week)).toEqual(
      MATH.weeks.map((w) => w.week).filter((w) => w !== 8),
    );
  });

  test("while a write is in flight, THAT band's controls go quiet and no other's", async () => {
    let release!: () => void;
    const onWrite = vi.fn(
      () => new Promise<void>((r) => { release = () => r(); }),
    );
    const t = draw(MATH, AT_8, 27, onWrite);

    fireEvent.click(t.act(8, "تمّ ✓")!);
    expect(t.act(8, "تمّ ✓")!.disabled).toBe(true);
    expect(t.act(8, "تخطٍّ ↷")!.disabled).toBe(true);
    expect(t.act(9, "وصلنا هنا")!.disabled).toBe(false);
    expect(t.act(1, "وصلنا هنا")!.disabled).toBe(false);

    await act(async () => { release(); });
    expect(t.act(8, "تمّ ✓")!.disabled).toBe(false);
  });

  test("success re-renders from fresh props: the mark moves, the bar follows", async () => {
    const t = draw(MATH, AT_8, 27);
    const fillsBefore = t.container.querySelectorAll(".progbar__fill").length;

    await act(async () => { fireEvent.click(t.act(8, "تمّ ✓")!); });
    t.rerender({
      progress: { markedWeek: 9, entries: [...ENTRIES, { week: 8, status: "done" }], rev: 5 },
    });

    expect(norm(t.band(8).querySelector(".tracker__tag")!.textContent ?? "")).toBe("منجز");
    expect(norm(t.band(9).querySelector(".tracker__tag")!.textContent ?? "")).toBe(
      "الأسبوع الحالي",
    );
    expect(t.band(9).dataset.open).toBe("true");
    expect(t.band(9).querySelectorAll(".tracker__row").length).toBe(weekOf(MATH, 9).rows.length);
    expect(t.container.querySelectorAll(".progbar__fill").length).toBeGreaterThan(fillsBefore);
  });

  test("a skipped week re-renders «مُتخطّى» from the same fresh props", async () => {
    const t = draw(MATH, AT_8, 27);
    await act(async () => { fireEvent.click(t.act(8, "تخطٍّ ↷")!); });
    t.rerender({
      progress: { markedWeek: 9, entries: [...ENTRIES, { week: 8, status: "skipped" }], rev: 5 },
    });
    expect(norm(t.band(8).querySelector(".tracker__tag")!.textContent ?? "")).toBe("مُتخطّى");
  });
});

// ══ 11 · THE 409 IS ROW-LOCAL ═════════════════════════════════════════════════════

describe("a lost compare-and-set re-asks at the row that lost it", () => {
  test("the losing band re-asks in Arabic and nothing is resubmitted", async () => {
    const onWrite = vi.fn(async () => { throw conflict(); });
    const t = draw(MATH, AT_8, 27, onWrite);

    await act(async () => { fireEvent.click(t.act(8, "تمّ ✓")!); });

    const notices = [...t.container.querySelectorAll(".tracker__notice")];
    expect(notices).toHaveLength(1);
    expect(notices[0]!.closest(".tracker__band")).toBe(t.band(8));
    expect(norm(notices[0]!.textContent ?? "")).toContain("تغيّر موقع هذا القسم في مكان آخر");
    expect(onWrite).toHaveBeenCalledTimes(1);

    // and it is still exactly one call a beat later — no timer, no retry
    await act(async () => { await Promise.resolve(); });
    expect(onWrite).toHaveBeenCalledTimes(1);
  });

  test("no global banner exists — every notice lives inside a band", async () => {
    const onWrite = vi.fn(async () => { throw conflict(); });
    const t = draw(MATH, AT_8, 27, onWrite);
    await act(async () => { fireEvent.click(t.act(8, "تمّ ✓")!); });

    for (const el of t.container.querySelectorAll(".tracker__notice"))
      expect(el.closest(".tracker__band")).toBeTruthy();
    expect(t.container.querySelector(".tracker__head .tracker__notice")).toBeNull();
    expect(t.container.querySelector(".tracker__foot .tracker__notice")).toBeNull();
  });

  test("the other bands' DOM is untouched", async () => {
    const onWrite = vi.fn(async () => { throw conflict(); });
    const t = draw(MATH, AT_8, 27, onWrite);
    const others = [1, 4, 20, 27];
    const before = others.map((w) => t.band(w).outerHTML);

    await act(async () => { fireEvent.click(t.act(8, "تمّ ✓")!); });

    expect(others.map((w) => t.band(w).outerHTML)).toEqual(before);
  });

  test("the re-ask survives the fresh position it asked to be read", async () => {
    const onWrite = vi.fn(async () => { throw conflict(); });
    const t = draw(MATH, AT_8, 27, onWrite);
    await act(async () => { fireEvent.click(t.act(8, "تمّ ✓")!); });

    // fe-5's re-read lands: the band now shows week 12 as the stored position…
    t.rerender({ progress: { markedWeek: 12, entries: ENTRIES, rev: 9 } });
    expect(norm(t.band(12).querySelector(".tracker__tag")!.textContent ?? "")).toBe(
      "الأسبوع الحالي",
    );
    // …and the losing band is STILL asking, because only a new tap may clear it
    expect(norm(t.band(8).querySelector(".tracker__notice")!.textContent ?? "")).toContain(
      "راجعه قبل أن تسجّل من جديد",
    );
  });

  test("a new tap clears the re-ask", async () => {
    const onWrite = vi.fn(async () => { throw conflict(); });
    const t = draw(MATH, AT_8, 27, onWrite);
    await act(async () => { fireEvent.click(t.act(8, "تمّ ✓")!); });
    expect(t.container.querySelectorAll(".tracker__notice")).toHaveLength(1);

    const ok = vi.fn(async () => undefined);
    t.view.rerender(
      <Tracker programme={MATH} progress={AT_8} totalWeeks={27} onWrite={ok} />,
    );
    await act(async () => { fireEvent.click(t.act(8, "تمّ ✓")!); });
    expect(t.container.querySelectorAll(".tracker__notice")).toHaveLength(0);
  });

  test("a retryable failure says it in Arabic — `be`'s English never reaches the band", async () => {
    const onWrite = vi.fn(async () => {
      throw new GenerateError(
        "datastore unavailable",
        "store",
        true,
        "cid-2",
        undefined,
        "store_unavailable",
      );
    });
    const t = draw(MATH, AT_8, 27, onWrite);
    await act(async () => { fireEvent.click(t.act(8, "وصلنا هنا") ?? t.act(8, "تمّ ✓")!); });

    const notice = t.band(8).querySelector(".tracker__notice")!;
    expect(norm(notice.textContent ?? "")).toBe(STORE_UNAVAILABLE_AR);
    expect(t.text()).not.toContain("datastore");
    expect(t.act(8, "تمّ ✓")!.disabled).toBe(false); // retryable: the action IS the retry
  });
});

// ══ 12 · markedWeek 0 — a state, not a small number ═══════════════════════════════

describe("an unpositioned class", () => {
  test("no band is current, and «وصلنا هنا» is on every one of them", () => {
    const t = draw(MATH, AT_0, 27);

    expect(t.container.querySelectorAll(".tracker__band[data-state='current']")).toHaveLength(0);
    expect(t.text()).not.toContain("الأسبوع الحالي");
    expect(t.text()).not.toContain("تمّ ✓");
    expect(t.text()).not.toContain("تخطٍّ ↷");

    const offered = MATH.weeks.filter((w) => t.act(w.week, "وصلنا هنا"));
    expect(offered).toHaveLength(27);
  });

  test("every band is folded, and every one reads «قادم»", () => {
    const t = draw(MATH, AT_0, 27);
    expect(t.container.querySelectorAll(".tracker__row")).toHaveLength(0);
    const tags = [...t.container.querySelectorAll(".tracker__tag")].map((e) =>
      norm(e.textContent ?? ""),
    );
    expect(new Set(tags)).toEqual(new Set(["قادم"]));
  });

  test("no pacing anywhere: the bar has no fill and the header no hours-to-date", () => {
    const t = draw(MATH, AT_0, 27);
    expect(t.container.querySelectorAll(".progbar__fill")).toHaveLength(0);
    expect(t.container.querySelectorAll(".tracker__todate")).toHaveLength(0);
    expect(t.text()).not.toContain("حتى نهاية الأسبوع");
  });

  test("…but the bar itself is still drawn — the ministry's year is information", () => {
    const t = draw(MATH, AT_0, 27);
    expect(t.container.querySelectorAll(".progbar__seg")).toHaveLength(15);
  });
});

// ══ 13 · THE THREE REGISTERS ══════════════════════════════════════════════════════

describe("whose words are whose", () => {
  test("the footer states all three, and the handoff's two verbatim", () => {
    const t = draw(MATH, AT_8, 27);
    const foot = norm(t.container.querySelector(".tracker__foot")!.textContent ?? "");

    expect(foot).toContain(
      "النص الرسمي معروض حرفيًا · موقعكم المسجَّل هو المعتمد في اشتقاق نطاق أي موضوع، لا التقويم",
    );
    expect(foot).toContain("ما هو من إعدادنا (الدروس، الترجيحات) مُعلَّم ✎");
    expect(t.container.querySelectorAll(".tracker__rule")).toHaveLength(3);
    expect(foot).toContain("ما سجّلتموه أنتم");
  });

  test("what WE derived wears ✎ — and it is the only thing that does", () => {
    const t = draw(MATH, AT_8, 27);
    const toDate = norm(t.container.querySelector(".tracker__todate")!.textContent ?? "");

    // Σ weeks[].hours up to the mark, over Σ all of them — never `totals.hours`
    const upto = MATH.weeks.filter((w) => w.week <= 8).reduce((n, w) => n + w.hours, 0);
    const all = MATH.weeks.reduce((n, w) => n + w.hours, 0);
    expect(toDate).toBe(`حتى نهاية الأسبوع 8: ${upto} ساعة من ${all} ✎`);
    expect(all).not.toBe(0);
    expect(toDate).toContain("✎");
  });

  test("…and its denominator is Σ weeks[].hours, never `totals.hours`", () => {
    /* They agree in all five corpus documents — 189/189 on maths — so a component
     * reading the summary table passes against every real programme. This fixture is
     * synthetic for exactly that reason: 150 hours of weeks against a `totals.hours` of
     * 999, so the wrong denominator is visible instead of merely wrong. */
    const t = draw(DIVERGENT_TOTALS, { markedWeek: 10, entries: [], rev: 3 }, 30);
    const toDate = norm(t.container.querySelector(".tracker__todate")!.textContent ?? "");

    expect(toDate).toBe("حتى نهاية الأسبوع 10: 50 ساعة من 150 ✎");
    expect(toDate).not.toContain("999");
    // …while the header, which IS the summary table, still reports theirs
    expect(
      norm(t.container.querySelector(".tracker__provenance")!.textContent ?? ""),
    ).toContain("999 ساعة");
  });

  test("the teacher's own marks wear NO ✎", () => {
    const t = draw(MATH, AT_8, 27);
    const mine = [
      ...t.container.querySelectorAll(".tracker__tag"),
      ...t.container.querySelectorAll(".tracker__note"),
      ...t.container.querySelectorAll(".tracker__acts"),
    ];
    expect(mine.length).toBeGreaterThan(0);
    for (const el of mine) expect(norm(el.textContent ?? "")).not.toContain("✎");
  });

  test("the ministry's own text wears no ✎ either — it is theirs, not ours", () => {
    const t = draw(MATH, AT_8, 27);
    fireEvent.click(t.toggle(20));
    for (const el of t.band(20).querySelectorAll(".tracker__row"))
      expect(norm(el.textContent ?? "")).not.toContain("✎");
    expect(norm(t.container.querySelector(".tracker__provenance")!.textContent ?? "")).not.toContain(
      "✎",
    );
  });
});

// ══ 14 · THE SHIPPED ABSENCES ═════════════════════════════════════════════════════

describe("what this screen deliberately does not have", () => {
  test("no exercise series and no remediation, on any band", () => {
    const t = draw(MATH, AT_8, 27);
    const text = t.text();
    expect(text).not.toContain("سلسلة");
    expect(text).not.toContain("تمارين دعم");
    expect(readCode(COMPONENT)).not.toContain("سلسلة");
    expect(readCode(COMPONENT)).not.toContain("تمارين دعم");
  });

  test("no pacing marker, no expected week, no pace sentence", () => {
    const t = draw(MATH, AT_8, 27);
    const text = t.text();
    expect(text).not.toContain("متوقَّع");
    expect(text).not.toContain("متأخر");
    expect(text).not.toContain("في الموعد");
    expect(text).not.toContain("التوزيع السنوي");
    const code = readCode(COMPONENT);
    for (const token of ["expected", "pace", "accent"]) expect(code).not.toContain(token);
  });

  test("no course affordance and no «قادم — » proposal panel", () => {
    const t = draw(MATH, AT_8, 27);
    fireEvent.click(t.toggle(20));
    expect(t.container.querySelectorAll("a")).toHaveLength(0);
    expect(t.text()).not.toContain("قادم — ");
  });

  test("the component neither knows nor names the box placeholder", () => {
    const code = readSrc(COMPONENT);
    for (const token of ["square", "mathbb", "ℤ", "ℂ", "ℝ", "ℕ", "ℚ", "□"])
      expect(code).not.toContain(token);
  });
});

// ══ 15 · HARD CONSTRAINTS ═════════════════════════════════════════════════════════

describe("Arabic only, RTL-safe, never a grade", () => {
  test("no Latin word reaches the DOM outside a KaTeX island", () => {
    const t = draw(MATH, AT_8, 27);
    fireEvent.click(t.toggle(20));
    fireEvent.click(t.toggle(24));

    const texts = ours(t.container)
      .filter((el) => el.children.length === 0)
      .map((el) => el.textContent ?? "");
    for (const s of texts) expect(s).not.toMatch(/[A-Za-z]/);
    expect(t.text()).not.toContain("AI");
  });

  test("digits are Western, and no Arabic-Indic digit is authored", () => {
    const t = draw(MATH, AT_8, 27);
    expect(t.bandText(8)).toContain("الأسبوع 8");
    expect(readCode(COMPONENT)).not.toMatch(/[٠-٩]/);
  });

  test("no colour, no red, no green — this component names none", () => {
    const t = draw(MATH, AT_8, 27);
    fireEvent.click(t.toggle(24));

    for (const el of ours(t.container)) {
      expect(el.getAttribute("style")).toBeNull();
      expect(el.className).not.toMatch(/danger|destructive|success|error|warn|red|green|accent/i);
    }
    const code = readCode(COMPONENT);
    for (const token of ["--danger", "--destructive", "color:", "background"])
      expect(code).not.toContain(token);
  });

  test("no LaTeX source is visible anywhere in the rendered year", () => {
    const t = draw(MATH, AT_8, 27);
    // week 8 mounts open; toggling it would CLOSE it and shrink the sweep
    for (const w of MATH.weeks) if (w.week !== 8) fireEvent.click(t.toggle(w.week));
    const shown = ours(t.container)
      .filter((el) => el.children.length === 0)
      .map((el) => el.textContent ?? "")
      .join(" ");
    expect(shown).not.toContain("\\");
    expect(shown.replace(DOLLAR_NOTE, "")).not.toContain("$");
  });

  test("the component builds no write body of its own — one builder, two hosts", () => {
    const code = readCode(COMPONENT);
    expect(code).toContain("advanceWrite");
    expect(code).not.toContain("Math.min");
    expect(code).not.toMatch(/markedWeek\s*\+\s*1/);
    expect(code).not.toContain('status: "done"');
    expect(code).not.toContain('status: "skipped"');
  });
});
