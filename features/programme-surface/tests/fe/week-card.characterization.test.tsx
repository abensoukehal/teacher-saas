/**
 * fe-3 — the week card: the ministry's words for this week, verbatim and attributed.
 *
 * THE FEATURE, in one sentence: «هذا الأسبوع» shows the marked week exactly as the
 * ministry wrote it — every row, every field, with the page it was printed on — and one
 * action says the week is done.
 *
 * The clauses that are here because a plausible implementation gets them wrong:
 *
 *   - **every row, and every field on it.** The handoff draws a week as ONE contents
 *     list and ONE guidance paragraph. Real week 20 has seven rows; four carry no
 *     contents and three carry neither contents nor guidance. Both counts are COMPUTED
 *     from the fixture here, so the H2 kill is executable rather than quoted.
 *   - **guidance is joined with a newline, not a separator.** `Statement` makes one `<p>`
 *     per line, so «·» would fuse two distinct ministry sentences into one — verbatim
 *     lost in a way that still looks tidy. Week 20's first row carries two sentences and
 *     the mutant is written out.
 *   - **the provenance line is DATA.** The prototype hardcodes «التدرجات السنوية
 *     الرسمية» in its markup. A conformity claim whose attribution is a UI literal is a
 *     claim nothing can check, so the fixture is edited and the DOM has to follow.
 *   - **the bound is the class's own.** All five corpus documents say twenty-seven, which
 *     is exactly what lets a constant survive. One fixture disagrees with itself on
 *     purpose — the maths programme read at a thirty-week bound — and only the right
 *     source renders «من 30».
 *   - **teacher text never touches KaTeX.** `Statement` silently pairs two `$` and eats
 *     both. The corruption is reproduced here as a positive control, then the card is
 *     shown to have no path from teacher-authored text to it at all.
 *   - **the absences are the deliverable.** No course link on a content item, no exercise
 *     series, no «قادم» panel, no pacing. Each is pinned executably, because an absence
 *     nobody asserts is one refactor away from being helpfully restored.
 *
 * Fixtures are fe-1's (`programme-fixtures.ts`), frozen — `MATH` is the real recorded
 * corpus, `\square` strings and all, and it was re-verified byte-identical to the live
 * route at this sub-issue's pre-flight.
 */
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import WeekCard from "@/components/WeekCard";
import { GenerateError, STORE_UNAVAILABLE_AR } from "@/lib/api";
import { Statement } from "@/lib/katex";
import type { Programme, ProgrammeWeek } from "@/lib/programme";
import { MATH, THIRTY_WEEKS } from "./programme-fixtures";

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
 * This file's comments explain why «من 27» is NOT read from a constant, and quote the
 * number to do it. A grep that punished that would push the reasoning out of the file.
 * What must not appear is the code.
 */
const readCode = (rel: string) =>
  readSrc(rel)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");

const COMPONENT = "src/components/WeekCard.tsx";

type Position = { markedWeek: number; totalWeeks: number; rev: number };

function draw(
  programme: Programme,
  position: Position,
  handlers: {
    onAdvance?: (status: "done" | "skipped") => Promise<unknown>;
    onGoTracker?: () => void;
  } = {},
) {
  const onAdvance = handlers.onAdvance ?? vi.fn(async () => undefined);
  const onGoTracker = handlers.onGoTracker ?? vi.fn();
  const view = render(
    <WeekCard
      programme={programme}
      position={position}
      onAdvance={onAdvance}
      onGoTracker={onGoTracker}
    />,
  );
  const container = view.container;
  return {
    view,
    container,
    onAdvance,
    onGoTracker,
    card: container.querySelector(".weekcard") as HTMLElement,
    rows: [...container.querySelectorAll(".weekcard__row")] as HTMLElement[],
    all: () => [...container.querySelectorAll("*")] as HTMLElement[],
    text: () => norm(container.textContent ?? ""),
    button: (label: string) =>
      [...container.querySelectorAll("button")].find((b) =>
        norm(b.textContent ?? "").includes(label),
      ) as HTMLButtonElement | undefined,
  };
}

/** Whitespace is layout, not content — every text comparison runs through this. */
const norm = (s: string) => s.replace(/\s+/g, " ").trim();

/**
 * Every element the CARD authored — KaTeX's own output excluded.
 *
 * A rendered math island is a tree of `<span style="height:0.675em">`s that the renderer
 * emits and neither this component nor this product controls. Sweeping them for inline
 * style would make every clause below fail on ministry text doing exactly what it is
 * supposed to do, so the sweep stops at the island's edge.
 */
const ours = (container: HTMLElement): HTMLElement[] =>
  ([...container.querySelectorAll("*")] as HTMLElement[]).filter((el) => !el.closest(".math"));

const weekOf = (programme: Programme, week: number): ProgrammeWeek =>
  programme.weeks.find((w) => w.week === week)!;

/**
 * The prose of a ministry string, with its maths removed.
 *
 * `$…$` becomes KaTeX and its characters are no longer the source's, so a "renders
 * verbatim" clause has to compare what survives as text. Short fragments («:», «و») are
 * dropped because they match anywhere and would make the clause vacuous.
 */
const prosePieces = (s: string): string[] =>
  s
    .split(/\$[^$]*\$/)
    .map((t) => norm(t))
    .filter((t) => t.length > 3);

/** Every ministry string on a row, in the ministry's own three columns. */
const ministryStrings = (row: ProgrammeWeek["rows"][number]): string[] => [
  ...row.competencies,
  ...row.contents,
  ...row.guidance,
];

const POSITIONED: Position = { markedWeek: 8, totalWeeks: 27, rev: 4 };
const AT_20: Position = { markedWeek: 20, totalWeeks: 27, rev: 4 };
const AT_24: Position = { markedWeek: 24, totalWeeks: 27, rev: 4 };

// ══ 1 · EVERY ROW, AND EVERY FIELD ON IT — the H2 kill ═════════════════════════════

describe("a week is rows[], and all of them render", () => {
  test("the counts that make this sub-issue exist, computed from the corpus", () => {
    const w20 = weekOf(MATH, 20);

    expect(w20.rows).toHaveLength(7);
    expect(w20.rows.filter((r) => r.competencies.length > 0)).toHaveLength(7);
    expect(w20.rows.filter((r) => r.contents.length > 0)).toHaveLength(3);
    expect(w20.rows.filter((r) => r.guidance.length > 0)).toHaveLength(3);

    // what the two plausible cards blank out, derived rather than remembered
    const contentsOnly = w20.rows.filter((r) => r.contents.length === 0).length;
    const contentsAndGuidance = w20.rows.filter(
      (r) => r.contents.length === 0 && r.guidance.length === 0,
    ).length;
    expect(contentsOnly).toBe(4); // the prototype's card: four of seven rows silent
    expect(contentsAndGuidance).toBe(3); // add guidance back: still three silent
  });

  test("the seven-row week renders seven rows, and not one of them is blank", () => {
    const { rows } = draw(MATH, AT_20);
    const w20 = weekOf(MATH, 20);

    expect(rows).toHaveLength(7);

    rows.forEach((el, i) => {
      const row = w20.rows[i];
      const rowText = norm(el.textContent ?? "");

      // every ministry string this row carries is in THIS row's DOM, verbatim
      for (const s of ministryStrings(row)) {
        for (const piece of prosePieces(s)) expect(rowText).toContain(piece);
      }

      // and every row shows at least one of the ministry's columns — blanks: zero
      expect(el.querySelectorAll(".weekcard__field").length).toBeGreaterThan(0);
    });
  });

  test("the four rows with no contents show their competencies instead", () => {
    const { rows } = draw(MATH, AT_20);
    const w20 = weekOf(MATH, 20);

    const noContents = w20.rows
      .map((r, i) => ({ r, i }))
      .filter(({ r }) => r.contents.length === 0);
    expect(noContents.map(({ i }) => i)).toEqual([1, 3, 4, 6]);

    for (const { r, i } of noContents) {
      const rowText = norm(rows[i].textContent ?? "");
      for (const piece of prosePieces(r.competencies[0])) expect(rowText).toContain(piece);
      // the label is there too — a competency without its column name is an orphan line
      expect(rowText).toContain("الكفاءات المستهدفة");
    }
  });

  test("MUTANT dies: a contents-only card, and a contents+guidance card", () => {
    const { rows } = draw(MATH, AT_20);
    const w20 = weekOf(MATH, 20);

    const silent = (fields: ("competencies" | "contents" | "guidance")[]) =>
      w20.rows.filter((r) => fields.every((f) => r[f].length === 0)).length;

    expect(silent(["contents"])).toBe(4);
    expect(silent(["contents", "guidance"])).toBe(3);

    // the shipped card: every row carries ministry text of its own
    const shipped = rows.filter((el) => el.querySelectorAll(".weekcard__field").length === 0);
    expect(shipped).toHaveLength(0);
  });

  test("an empty column renders nothing — no labelled void", () => {
    const { rows } = draw(MATH, AT_20);
    // row 1 has a competency and nothing else: exactly one field, and the two absent
    // column names are not in it
    expect(rows[1].querySelectorAll(".weekcard__field")).toHaveLength(1);
    const text = norm(rows[1].textContent ?? "");
    expect(text).not.toContain("المحتويات المعرفية");
    expect(text).not.toContain("السير المنهجي");
  });

  test("per-row hours render from data, and they sum to the week's own total", () => {
    const { rows } = draw(MATH, AT_20);
    const w20 = weekOf(MATH, 20);

    const shown = rows.map((el) =>
      Number.parseFloat(norm(el.querySelector(".weekcard__rowhours")!.textContent ?? "")),
    );
    expect(shown).toEqual(w20.rows.map((r) => r.hours));
    expect(shown.reduce((a, b) => a + b, 0)).toBe(w20.hours);
  });

  test("a one-row week is not a special case", () => {
    const single = MATH.weeks.find((w) => w.rows.length === 1)!;
    const { rows } = draw(MATH, { markedWeek: single.week, totalWeeks: 27, rev: 1 });
    expect(rows).toHaveLength(1);
    expect(rows[0].querySelectorAll(".weekcard__field").length).toBeGreaterThan(0);
  });
});

// ══ 2 · THE POSITION LINE — both numbers from props, neither from a constant ════════

describe("«هذا الأسبوع — الأسبوع W من T»", () => {
  test("the maths class at week 8 of 27", () => {
    const { container } = draw(MATH, POSITIONED);
    expect(norm(container.querySelector(".weekcard__eyebrow")!.textContent ?? "")).toBe(
      "هذا الأسبوع — الأسبوع 8 من 27",
    );
  });

  test("the thirty-week fixture renders «من 30»", () => {
    const { container } = draw(THIRTY_WEEKS, { markedWeek: 8, totalWeeks: 30, rev: 1 });
    expect(norm(container.querySelector(".weekcard__eyebrow")!.textContent ?? "")).toBe(
      "هذا الأسبوع — الأسبوع 8 من 30",
    );
  });

  test("THE DISCRIMINATOR: the bound is the class's own, not the document's summary", () => {
    // the real maths programme — whose totals.weeks says 27 — read at a 30-week bound.
    // Only `position.totalWeeks` renders 30; a 27 literal and a `totals.weeks` read both
    // render 27, and they are indistinguishable on every other fixture in this job.
    expect(MATH.totals.weeks).toBe(27);
    const { container } = draw(MATH, { markedWeek: 8, totalWeeks: 30, rev: 1 });
    expect(norm(container.querySelector(".weekcard__eyebrow")!.textContent ?? "")).toBe(
      "هذا الأسبوع — الأسبوع 8 من 30",
    );
  });

  test("the component's code carries no twenty-seven literal", () => {
    const offenders = readCode(COMPONENT)
      .split("\n")
      .filter((l) => l.includes("27"));
    expect(offenders).toEqual([]);
  });

  test("the unit name goes through KaTeX — the channel is the AUTHOR, not the sample", () => {
    // no corpus unit name happens to carry maths today, which is exactly why this is
    // pinned structurally AND with a forged name: «this string has no `$` in it» is an
    // observation about one document, and the rule is about who wrote the string
    expect(MATH.units.every((u) => !u.name.includes("$"))).toBe(true);
    expect(
      draw(MATH, POSITIONED).container.querySelector(".weekcard__unit .statement"),
    ).not.toBeNull();
    cleanup();

    const w8 = weekOf(MATH, 8);
    const withMath: Programme = {
      ...MATH,
      units: MATH.units.map((u) => (u.id === w8.unitId ? { ...u, name: "المجال $[0;1]$" } : u)),
    };
    const unit = draw(withMath, POSITIONED).container.querySelector(".weekcard__unit")!;
    expect(unit.querySelectorAll(".math").length).toBeGreaterThan(0);
    expect(norm(unit.textContent ?? "")).not.toContain("$");
  });

  test("the unit name is resolved through units[], and the DOM follows the fixture", () => {
    const w8 = weekOf(MATH, 8);
    const name = MATH.units.find((u) => u.id === w8.unitId)!.name;
    expect(draw(MATH, POSITIONED).text()).toContain(name);

    const renamed: Programme = {
      ...MATH,
      units: MATH.units.map((u) => (u.id === w8.unitId ? { ...u, name: "اسم مستعار للاختبار" } : u)),
    };
    expect(draw(renamed, POSITIONED).text()).toContain("اسم مستعار للاختبار");
  });

  test("a unit id with no entry in units[] costs its name, not the card", () => {
    const w8 = weekOf(MATH, 8);
    const dangling: Programme = { ...MATH, units: MATH.units.filter((u) => u.id !== w8.unitId) };
    const { rows, text } = draw(dangling, POSITIONED);

    expect(rows).toHaveLength(w8.rows.length);
    // the assigned id is our bookkeeping and never becomes copy
    expect(text()).not.toContain(w8.unitId);
  });

  test("the ✎ figure is ours, sums over the weeks marked, and is not totals.hours", () => {
    const { container } = draw(MATH, POSITIONED);
    const line = norm(container.querySelector(".weekcard__hours")!.textContent ?? "");

    const toDate = MATH.weeks.filter((w) => w.week <= 8).reduce((s, w) => s + w.hours, 0);
    const track = MATH.weeks.reduce((s, w) => s + w.hours, 0);
    expect(toDate).toBe(56);
    expect(track).toBe(189);
    expect(line).toBe(`حتى نهاية هذا الأسبوع: ${toDate} ساعة من ${track} ✎`);
    expect(line.endsWith("✎")).toBe(true);
  });

  test("a programme whose totals.hours disagrees with its weeks uses the weeks", () => {
    const divergent: Programme = { ...MATH, totals: { weeks: 27, hours: 999 } };
    const line = norm(
      draw(divergent, POSITIONED).container.querySelector(".weekcard__hours")!.textContent ?? "",
    );
    expect(line).toContain("من 189");
    expect(line).not.toContain("999");
  });
});

// ══ 3 · MINISTRY TEXT THROUGH KaTeX, VERBATIM ══════════════════════════════════════

describe("their words, their maths, and nothing of ours in between", () => {
  test("contents and guidance both produce KaTeX islands", () => {
    // week 8's guidance is one of the corpus's dense LaTeX strings
    const w8 = weekOf(MATH, 8);
    expect(w8.rows[0].guidance[0]).toContain("$");
    const eight = draw(MATH, POSITIONED);
    expect(eight.container.querySelectorAll(".math").length).toBeGreaterThan(5);

    // week 20's maths is in CONTENTS, not guidance — the column the prototype does draw
    const twenty = draw(MATH, AT_20);
    const contentsIslands = twenty
      .rows[0].querySelectorAll(".weekcard__field")[1]
      .querySelectorAll(".math");
    expect(contentsIslands.length).toBeGreaterThan(0);
  });

  test("guidance is joined with a NEWLINE — one paragraph per ministry sentence", () => {
    const w20 = weekOf(MATH, 20);
    expect(w20.rows[0].guidance).toHaveLength(2);

    const { rows } = draw(MATH, AT_20);
    const body = rows[0].querySelector(".weekcard__field--guidance .weekcard__fieldbody")!;
    const paragraphs = [...body.querySelectorAll(".statement__p")];

    expect(paragraphs).toHaveLength(2);
    paragraphs.forEach((p, i) => {
      for (const piece of prosePieces(w20.rows[0].guidance[i])) {
        expect(norm(p.textContent ?? "")).toContain(piece);
      }
    });
  });

  test("MUTANT dies: joining guidance with «·» fuses two ministry sentences into one", () => {
    const w20 = weekOf(MATH, 20);
    const fused = render(<Statement text={w20.rows[0].guidance.join(" · ")} />);
    expect(fused.container.querySelectorAll(".statement__p")).toHaveLength(1);
    cleanup();

    const split = render(<Statement text={w20.rows[0].guidance.join("\n")} />);
    expect(split.container.querySelectorAll(".statement__p")).toHaveLength(2);
  });

  test("`\\square` renders the literal box, untouched — the escalation ships visibly", () => {
    const w20 = weekOf(MATH, 20);
    expect(w20.rows[0].contents[0]).toContain("\\square");

    const { text } = draw(MATH, AT_20);
    expect(text()).toContain("□");

    // and nothing in the component knows the word — the RAW source, comments included,
    // so fe-6's `grep -rn square src/components` stays clean too
    expect(readSrc(COMPONENT).toLowerCase()).not.toContain("square");
    expect(readSrc(COMPONENT)).not.toMatch(/[ℤℂℝℕℚ]/);
  });

  test("no LaTeX source reaches the DOM as text, on any week", () => {
    for (const week of [8, 20, 24]) {
      const { text } = draw(MATH, { markedWeek: week, totalWeeks: 27, rev: 1 });
      expect(text()).not.toContain("$");
      expect(text()).not.toContain("\\");
      cleanup();
    }
  });
});

// ══ 4 · PROVENANCE COMES FROM DATA ═════════════════════════════════════════════════

describe("the attribution is the conformity claim, so it cannot be a literal", () => {
  test("authority, title and the printed page, all from the wire", () => {
    const { container } = draw(MATH, AT_20);
    const line = container.querySelector(".weekcard__provenance")!.textContent ?? "";

    expect(line).toContain(MATH.source.authority);
    expect(line).toContain(MATH.source.title);
    expect(norm(line)).toContain("الصفحة 16");
    expect(weekOf(MATH, 20).pdfPages).toEqual([16]);
  });

  test("a two-page week says «الصفحات», from its own pdfPages", () => {
    expect(weekOf(MATH, 24).pdfPages).toEqual([18, 19]);
    const line = norm(
      draw(MATH, AT_24).container.querySelector(".weekcard__provenance")!.textContent ?? "",
    );
    expect(line).toContain("الصفحات 18، 19");
  });

  test("change the fixture and the DOM follows — nothing is remembered", () => {
    const forged: Programme = {
      ...MATH,
      source: { authority: "سلطة اختبارية", title: "عنوان اختباري" },
      weeks: MATH.weeks.map((w) => (w.week === 20 ? { ...w, pdfPages: [99] } : w)),
    };
    const line = norm(
      draw(forged, AT_20).container.querySelector(".weekcard__provenance")!.textContent ?? "",
    );
    expect(line).toContain("سلطة اختبارية");
    expect(line).toContain("عنوان اختباري");
    expect(line).toContain("الصفحة 99");
    expect(line).not.toContain(MATH.source.authority);
  });

  test("NO corpus string is written into the component — the whole fixture, swept", () => {
    const src = readSrc(COMPONENT);
    const corpus = [
      MATH.source.authority,
      MATH.source.title,
      MATH.emphasisLegend.text,
      ...MATH.units.map((u) => u.name),
      ...MATH.weeks.flatMap((w) => w.rows.flatMap(ministryStrings)),
      // two rows of the real document transcribe to a bare «.» — a string that matches
      // any source file and would empty this clause silently
    ].filter((s) => s.length > 6);
    expect(corpus.length).toBe(308);
    for (const s of corpus) expect(src).not.toContain(s);

    // and the prototype's own hardcoded attribution, by name — against the CODE, since
    // the file's prose quotes it to say why it is not ported
    const code = readCode(COMPONENT);
    expect(code).not.toContain("التدرجات السنوية الرسمية");
    expect(code).not.toContain("المفتشية العامة");
    expect(code).not.toContain("وزارة التربية");

    /* The word «الوزارة» appears exactly once, in «نصّ الوزارة حرفيًا» — the prototype's
     * own caption, which is OUR claim about how the text below is rendered and not their
     * name. That distinction is the whole clause: an attribution has to be data, a
     * promise about the rendering is the UI's to make. Pinned at one, so a second
     * occurrence is a failure rather than a judgement call. */
    expect([...code.matchAll(/وزارة/g)]).toHaveLength(1);
  });
});

// ══ 5 · CONTENTS ARE INERT — courses are slice 7 ═══════════════════════════════════

describe("no content item is a door to anything", () => {
  test("no anchor, no role, no «الدرس ←», nowhere on the card", () => {
    const { container, text } = draw(MATH, AT_20);

    expect(container.querySelectorAll("a")).toHaveLength(0);
    expect(text()).not.toContain("الدرس");
    expect(text()).not.toContain("←");
    expect(text()).not.toContain("كل محتوى يفتح درسًا");

    for (const el of [...container.querySelectorAll("*")] as HTMLElement[]) {
      expect(el.getAttribute("role")).not.toBe("link");
      expect(el.getAttribute("role")).not.toBe("button");
      expect(el.style.cursor).toBe("");
    }
  });

  test("clicking a content item does nothing at all", () => {
    const { container, onAdvance, onGoTracker } = draw(MATH, AT_20);
    const items = [...container.querySelectorAll(".weekcard__item")];
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) fireEvent.click(item);
    expect(onAdvance).not.toHaveBeenCalled();
    expect(onGoTracker).not.toHaveBeenCalled();
  });

  test("the only buttons on the card are the ones this slice ships", () => {
    const { container } = draw(MATH, AT_20);
    const labels = [...container.querySelectorAll("button")].map((b) => norm(b.textContent ?? ""));
    expect(labels).toEqual(["أنهيت هذا الأسبوع ✓"]);
  });

  test("the absences, swept across every week of the real document", () => {
    const ABSENT = [
      "سلسلة", // the exercise series — slice 3
      "تمارين دعم", // remediation — roadmap 5
      "قادم", // the proposal panel — needs a calendar
      "متوقَّع", // the pacing marker
      "متوقع",
      "متأخرون",
      "في الموعد",
      "استرشادي",
      "إعداد موضوع",
      "مكتبتي",
      "ما أعددتُه مؤخرًا",
      "اختبار الفصل",
    ];
    for (const week of [1, 8, 20, 24, 27]) {
      const { text } = draw(MATH, { markedWeek: week, totalWeeks: 27, rev: 1 });
      for (const phrase of ABSENT) expect(text()).not.toContain(phrase);
      cleanup();
    }
    const code = readCode(COMPONENT);
    for (const phrase of ABSENT) expect(code).not.toContain(phrase);
  });
});

// ══ 6 · EMPHASIS IS PROVENANCE, NEVER STATUS ═══════════════════════════════════════

describe("the ministry's red marking, rendered as their own sentence", () => {
  test("week 24's flagged rows carry the marker and the legend quotes the wire", () => {
    const w24 = weekOf(MATH, 24);
    expect(w24.rows.filter((r) => r.emphasis === "added-2022")).toHaveLength(4);

    const { container, rows } = draw(MATH, AT_24);
    const flagged = rows.filter((el) => el.querySelector(".weekcard__flag") !== null);
    expect(flagged).toHaveLength(4);
    expect(rows.map((el) => el.querySelector(".weekcard__flag") !== null)).toEqual(
      w24.rows.map((r) => r.emphasis === "added-2022"),
    );

    const legend = container.querySelector(".weekcard__legend")!;
    expect(legend.textContent).toContain(MATH.emphasisLegend.text);
    expect(norm(legend.textContent ?? "")).toContain(`الصفحة ${MATH.emphasisLegend.pdfPage}`);

    // the marker points at those words rather than paraphrasing them
    expect(flagged[0].querySelector(".weekcard__flag")!.getAttribute("title")).toBe(
      MATH.emphasisLegend.text,
    );
  });

  test("a week with no flagged row shows no marker and no legend", () => {
    const { container } = draw(MATH, AT_20);
    expect(weekOf(MATH, 20).rows.every((r) => r.emphasis === "normal")).toBe(true);
    expect(container.querySelectorAll(".weekcard__flag")).toHaveLength(0);
    expect(container.querySelector(".weekcard__legend")).toBeNull();
  });

  test("the legend text is not a literal — change it and the DOM follows", () => {
    const forged: Programme = {
      ...MATH,
      emphasisLegend: { text: "بيان اختباري عن اللون", pdfPage: 3 },
    };
    const { container } = draw(forged, AT_24);
    expect(container.querySelector(".weekcard__legend")!.textContent).toContain(
      "بيان اختباري عن اللون",
    );
    expect(norm(container.querySelector(".weekcard__legend")!.textContent ?? "")).toContain(
      "الصفحة 3",
    );
  });

  test("ALLOW-LIST: every value that is not `added-2022` renders as normal", () => {
    for (const value of ["normal", "red-unlegended", "ADDED-2022", "added-2023", ""]) {
      const forged: Programme = {
        ...MATH,
        weeks: MATH.weeks.map((w) =>
          w.week === 24 ? { ...w, rows: w.rows.map((r) => ({ ...r, emphasis: value })) } : w,
        ),
      };
      const { container } = draw(forged, AT_24);
      expect(container.querySelectorAll(".weekcard__flag")).toHaveLength(0);
      expect(container.querySelector(".weekcard__legend")).toBeNull();
      cleanup();
    }
  });
});

// ══ 7 · THE WRITE — one call, one status, no second spelling ════════════════════════

/** A promise the test resolves by hand, so "pending" is observable. */
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("«أنهيت هذا الأسبوع ✓»", () => {
  test("one tap → onAdvance(\"done\"), exactly once, with exactly that argument", async () => {
    const onAdvance = vi.fn(async () => undefined);
    const { button } = draw(MATH, POSITIONED, { onAdvance });

    await act(async () => {
      fireEvent.click(button("أنهيت هذا الأسبوع")!);
    });

    expect(onAdvance).toHaveBeenCalledTimes(1);
    expect(onAdvance.mock.calls[0]).toEqual(["done"]);
  });

  test("the action disables while the write is in flight and comes back after", async () => {
    const gate = deferred<void>();
    const onAdvance = vi.fn(() => gate.promise);
    const { button } = draw(MATH, POSITIONED, { onAdvance });

    expect(button("أنهيت هذا الأسبوع")!.disabled).toBe(false);
    await act(async () => {
      fireEvent.click(button("أنهيت هذا الأسبوع")!);
    });
    expect(button("أنهيت هذا الأسبوع")!.disabled).toBe(true);

    // a second tap during the beat cannot reach the handler
    fireEvent.click(button("أنهيت هذا الأسبوع")!);
    expect(onAdvance).toHaveBeenCalledTimes(1);

    await act(async () => {
      gate.resolve();
      await gate.promise;
    });
    expect(button("أنهيت هذا الأسبوع")!.disabled).toBe(false);
  });

  test("on success the card holds no position of its own — fresh props are the truth", async () => {
    const onAdvance = vi.fn(async () => undefined);
    const { view, container, button } = draw(MATH, POSITIONED, { onAdvance });

    await act(async () => {
      fireEvent.click(button("أنهيت هذا الأسبوع")!);
    });
    // nothing moved on its own: the card still shows week 8
    expect(norm(container.querySelector(".weekcard__eyebrow")!.textContent ?? "")).toContain(
      "الأسبوع 8 من 27",
    );

    view.rerender(
      <WeekCard
        programme={MATH}
        position={{ markedWeek: 9, totalWeeks: 27, rev: 5 }}
        onAdvance={onAdvance}
        onGoTracker={vi.fn()}
      />,
    );
    expect(norm(container.querySelector(".weekcard__eyebrow")!.textContent ?? "")).toContain(
      "الأسبوع 9 من 27",
    );
    expect(container.querySelectorAll(".weekcard__row")).toHaveLength(
      weekOf(MATH, 9).rows.length,
    );
  });

  test("409 → the Arabic re-ask, and NO second call without a new tap", async () => {
    const onAdvance = vi.fn(async () => {
      throw new GenerateError("تغيّر تقدّم القسم أثناء الحفظ", "backend", true, "cid", undefined, "conflict");
    });
    const { container, button } = draw(MATH, POSITIONED, { onAdvance });

    await act(async () => {
      fireEvent.click(button("أنهيت هذا الأسبوع")!);
    });

    const notice = container.querySelector(".weekcard__notice")!;
    expect(norm(notice.textContent ?? "")).toBe(
      "تغيّر موقع هذا القسم في مكان آخر. هذا هو الأسبوع المسجَّل الآن — راجعه قبل أن تسجّل من جديد.",
    );
    expect(notice.getAttribute("role")).toBe("status");
    expect(onAdvance).toHaveBeenCalledTimes(1);

    // no auto-resubmit — not on a timer, not on the next tick
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(onAdvance).toHaveBeenCalledTimes(1);

    // and no separate "retry" control appeared that would resend the stale write
    expect([...container.querySelectorAll("button")].map((b) => norm(b.textContent ?? ""))).toEqual([
      "أنهيت هذا الأسبوع ✓",
    ]);

    // only a NEW tap calls again, and it clears the notice while it runs
    await act(async () => {
      fireEvent.click(button("أنهيت هذا الأسبوع")!);
    });
    expect(onAdvance).toHaveBeenCalledTimes(2);
  });

  test("503 store_unavailable → a retryable Arabic message, action re-enabled", async () => {
    const onAdvance = vi.fn(async () => {
      throw new GenerateError(
        "datastore unavailable",
        "store",
        true,
        "cid",
        undefined,
        "store_unavailable",
      );
    });
    const { container, button } = draw(MATH, POSITIONED, { onAdvance });

    await act(async () => {
      fireEvent.click(button("أنهيت هذا الأسبوع")!);
    });

    const notice = norm(container.querySelector(".weekcard__notice")!.textContent ?? "");
    expect(notice).toBe(STORE_UNAVAILABLE_AR);
    // `be` forwards the driver's own English for this family — it must not reach a teacher
    expect(notice).not.toContain("datastore");
    expect(notice).not.toMatch(/[A-Za-z]/);
    expect(button("أنهيت هذا الأسبوع")!.disabled).toBe(false);
  });

  test("the card builds no write body — the shape is fe-1's builder, in one place", () => {
    const code = readCode(COMPONENT);
    expect(code).not.toContain("advanceWrite");
    expect(code).not.toContain("entry");
    expect(code).not.toContain("Math.min");
    // and nothing arithmetic happens to the position
    expect(code).not.toMatch(/markedWeek\s*\+\s*1/);
  });
});

// ══ 8 · markedWeek 0 — the invitation, and no week at all ══════════════════════════

describe("a class nobody has positioned is asked, not shown a week", () => {
  const ZERO: Position = { markedWeek: 0, totalWeeks: 27, rev: 0 };

  test("the invitation renders, verbatim from the handoff", () => {
    const { container, text } = draw(MATH, ZERO);
    expect(norm(container.querySelector(".weekcard__title")!.textContent ?? "")).toBe(
      "أين وصل هذا القسم؟",
    );
    expect(text()).toContain("أثمن دقيقة في إعدادك");
    expect(text()).toContain("يمكنك دائمًا تعديله من «البرنامج»");
    expect([...container.querySelectorAll("button")].map((b) => norm(b.textContent ?? ""))).toEqual([
      "حدّد أين وصلت",
    ]);
  });

  test("«حدّد أين وصلت» navigates and never writes", () => {
    const { button, onGoTracker, onAdvance } = draw(MATH, ZERO);
    fireEvent.click(button("حدّد أين وصلت")!);
    expect(onGoTracker).toHaveBeenCalledTimes(1);
    expect(onAdvance).not.toHaveBeenCalled();
  });

  test("NO week content, NO «الأسبوع 0», NO pacing", () => {
    const { container, text } = draw(MATH, ZERO);

    expect(container.querySelectorAll(".weekcard__row")).toHaveLength(0);
    expect(container.querySelectorAll(".weekcard__field")).toHaveLength(0);
    expect(container.querySelectorAll(".math")).toHaveLength(0);
    expect(container.querySelector(".weekcard__ministry")).toBeNull();
    expect(container.querySelector(".weekcard__hours")).toBeNull();
    expect(container.querySelector(".weekcard__eyebrow")).toBeNull();

    expect(text()).not.toContain("الأسبوع 0");
    expect(text()).not.toContain("من 27");
    expect(text()).not.toContain("✎");
    expect(text()).not.toContain("0%");
    // and no ministry string of any kind leaked in
    expect(text()).not.toContain(MATH.source.authority);
    expect(text()).not.toContain(MATH.units[0].name);
  });

  test("the card hosts no bar — that is the tracker's decision, not a branch in here", () => {
    const { container } = draw(MATH, ZERO);
    expect(container.querySelectorAll(".progbar")).toHaveLength(0);
    expect(draw(MATH, POSITIONED).container.querySelectorAll(".progbar")).toHaveLength(0);
    expect(readCode(COMPONENT)).not.toContain("ProgrammeBar");
  });
});

// ══ 9 · THE TWO TEXT CHANNELS — one per author ═════════════════════════════════════

describe("teacher-authored text can never reach KaTeX from this card", () => {
  const NOTE = "من 5 $ إلى 9 $ دينار";

  test("POSITIVE CONTROL: `Statement` really does corrupt a teacher's two «$»", () => {
    const { container } = render(<Statement text={NOTE} />);
    const rendered = norm(container.textContent ?? "");

    // both dollars gone, and the two amounts fused — the recorded corruption
    expect(rendered).not.toContain("$");
    expect(rendered).toContain("من 5");
    expect(rendered).toContain("دينار");
    expect(rendered).not.toBe(NOTE);
    expect(container.querySelectorAll(".math").length).toBeGreaterThan(0);
  });

  test("ministry text is safe on the same renderer — zero odd «$» counts in the corpus", () => {
    const odd = MATH.weeks
      .flatMap((w) => w.rows.flatMap(ministryStrings))
      .filter((s) => (s.match(/\$/g) ?? []).length % 2 === 1);
    expect(odd).toEqual([]);
  });

  test("every `Statement` call site in the card receives a ministry field, by name", () => {
    const sites = [...readCode(COMPONENT).matchAll(/<Statement\s+text=\{([^}]*(?:\{[^}]*\})?[^}]*)\}/g)].map(
      (m) => m[1].trim(),
    );
    expect(sites.length).toBeGreaterThan(0);
    for (const expr of sites) {
      expect(["unitName", "text", 'row.guidance.join("\\n")']).toContain(expr);
    }
  });

  test("the card's props carry no teacher-authored text at all", () => {
    // the surface is closed by construction: no `entries`, no `note`, nothing a teacher
    // typed reaches this component, so there is no path to close later by accident
    const code = readCode(COMPONENT);
    expect(code).not.toContain("note");
    expect(code).not.toContain("entries");
  });
});

// ══ 10 · THE THIRD REGISTER, AND THE HARD CONSTRAINTS ══════════════════════════════

describe("three registers: theirs verbatim, ours ✎, the teacher's neither", () => {
  test("the ✎ is on our sum and NOWHERE near the teacher's own mark or action", () => {
    const { container } = draw(MATH, POSITIONED);

    expect(norm(container.querySelector(".weekcard__hours")!.textContent ?? "")).toContain("✎");
    expect(container.querySelector(".weekcard__eyebrow")!.textContent).not.toContain("✎");
    expect(container.querySelector(".weekcard__done")!.textContent).not.toContain("✎");
    expect(container.querySelector(".weekcard__ministry")!.textContent).not.toContain("✎");
  });

  test("exactly one ✎ on the card — a mark that is everywhere marks nothing", () => {
    const { text } = draw(MATH, AT_20);
    expect((text().match(/✎/g) ?? [])).toHaveLength(1);
  });

  test("no red, no green, no accent — measured as a colour, not as a name", () => {
    const src = readCode(COMPONENT);
    expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(src).not.toMatch(/\b(rgb|rgba|hsl|hsla)\(/);
    expect(src).not.toMatch(/--(accent|danger|warn|success)/);
    expect(src.toLowerCase()).not.toMatch(/\b(green|red|success|danger|warning)\b/);

    const { container } = draw(MATH, AT_24);
    const mine = ours(container);
    expect(mine.length).toBeGreaterThan(20);
    for (const el of mine) {
      // the component ships classNames only — no inline style at all, colour included
      expect(el.getAttribute("style")).toBeNull();
      expect(el.className.toLowerCase()).not.toMatch(
        /accent|danger|success|warn|green|red|behind|late|ahead/,
      );
    }
  });

  test("no stylesheet rule gives this card a hue (aimed at fe-5, who writes them)", () => {
    expect(huedRulesFor(readSrc("src/App.css"), CARD_CLASSNAMES)).toEqual([]);
    // the scanner discriminates — positive controls, so a clause that cannot fail shows
    expect(huedRulesFor(".weekcard__flag { color: var(--danger); }", CARD_CLASSNAMES).length)
      .toBeGreaterThan(0);
    expect(huedRulesFor(".weekcard__row { background: #1f6b52; }", CARD_CLASSNAMES)).toHaveLength(1);
    expect(huedRulesFor(".weekcard__row { color: var(--ink-soft); }", CARD_CLASSNAMES)).toEqual([]);
  });

  test("the card's OWN copy is Arabic with Western digits", () => {
    const { container } = draw(MATH, AT_24);
    // ministry maths renders Latin glyphs by design (KaTeX), so this reads the chrome —
    // every string this component authored — and not the ministry's islands
    const chrome = [
      ".weekcard__eyebrow",
      ".weekcard__hours",
      ".weekcard__ministrytitle",
      ".weekcard__fieldlabel",
      ".weekcard__rowhours",
      "button",
    ].flatMap((sel) => [...container.querySelectorAll(sel)].map((el) => el.textContent ?? ""));

    expect(chrome.length).toBeGreaterThan(5);
    for (const s of chrome) {
      expect(s).not.toMatch(/[A-Za-z]/);
      expect(s).not.toMatch(/[٠-٩۰-۹]/); // Arabic-Indic digits
    }
    expect(chrome.join(" ")).toMatch(/[0-9]/); // the numbers are there, in Western digits
  });

  test("no Arabic-Indic digit anywhere on the card, ministry text included", () => {
    for (const week of [8, 20, 24]) {
      const { text } = draw(MATH, { markedWeek: week, totalWeeks: 27, rev: 1 });
      expect(text()).not.toMatch(/[٠-٩۰-۹]/);
      cleanup();
    }
  });

  test("the component's own literals are Arabic — no English string reaches the DOM", () => {
    const literals = [...readCode(COMPONENT).matchAll(/"([^"]*)"/g)]
      .map((m) => m[1])
      .filter((s) => /[؀-ۿ]/.test(s));
    expect(literals.length).toBeGreaterThan(0);
    for (const s of literals) expect(s).not.toMatch(/[A-Za-z]/);
    // and the word this product never says
    expect(readSrc(COMPONENT)).not.toMatch(/\bAI\b/);
  });

  test("no physical side is pinned — RTL is the document's own direction", () => {
    const src = readCode(COMPONENT);
    expect(src).not.toMatch(/\b(marginLeft|marginRight|borderLeft|borderRight|paddingLeft|paddingRight)\b/);
    for (const el of ours(draw(MATH, AT_20).container)) {
      expect(el.getAttribute("style")).toBeNull();
    }
  });
});

// ══ 11 · A WEEK THE DOCUMENT DOES NOT HAVE ═════════════════════════════════════════

describe("a mark with no week behind it says so", () => {
  test("it names the real problem and offers no retry", () => {
    const gapped: Programme = { ...MATH, weeks: MATH.weeks.filter((w) => w.week !== 8) };
    const { container, text } = draw(gapped, POSITIONED);

    expect(text()).toContain("لا يحمل هذا التدرّج أسبوعًا بهذا الرقم");
    expect(norm(container.querySelector(".weekcard__eyebrow")!.textContent ?? "")).toBe(
      "الأسبوع 8 من 27",
    );
    expect(container.querySelectorAll("button")).toHaveLength(0);
    expect(container.querySelectorAll(".weekcard__row")).toHaveLength(0);
  });
});

// ── the colour scanner, inherited from fe-2 ───────────────────────────────────────
//
// Same tool, aimed at this card's classNames. It resolves `var(--token)` against BOTH
// themes before classifying, because a rule that is only green after dark is still green.

const CARD_CLASSNAMES = [
  "weekcard",
  "weekcard__row",
  "weekcard__flag",
  "weekcard__legend",
  "weekcard__field",
  "weekcard__notice",
  "weekcard__hours",
  "weekcard__provenance",
];

function tokenThemes(): Record<string, string>[] {
  const css = readSrc("src/styles/tokens.css");
  return [...css.matchAll(/:root\s*\{([^}]*)\}/g)].map((block) => {
    const map: Record<string, string> = {};
    for (const [, name, value] of block[1].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
      map[name] = value.trim();
    }
    return map;
  });
}

/** HSV saturation of a `#rrggbb` — how much hue a colour actually carries. */
function saturation(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
  const max = Math.max(r, g, b);
  if (max === 0) return 0;
  return (max - Math.min(r, g, b)) / max;
}

const isHue = (hex: string) => saturation(hex) >= 0.3;

function huedRulesFor(css: string, classNames: string[]): string[] {
  const themes = tokenThemes();
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const offenders: string[] = [];

  for (const [, selector, body] of bare.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!classNames.some((c) => selector.includes(`.${c}`))) continue;
    for (const [, prop, value] of body.matchAll(/([\w-]+)\s*:\s*([^;]+)/g)) {
      const hexes = [...value.matchAll(/#[0-9a-fA-F]{6}/g)].map((m) => m[0]);
      const viaToken = [...value.matchAll(/var\((--[\w-]+)\)/g)].flatMap(([, name]) =>
        themes
          .map((t) => t[name])
          .filter((v): v is string => typeof v === "string" && v.startsWith("#")),
      );
      for (const hex of [...hexes, ...viaToken]) {
        if (isHue(hex)) offenders.push(`${selector.trim()} { ${prop}: ${hex} }`);
      }
    }
  }
  return offenders;
}
