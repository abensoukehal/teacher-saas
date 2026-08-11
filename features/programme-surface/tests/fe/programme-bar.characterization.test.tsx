/**
 * fe-2 — the segmented bar: fifteen segments where the prototype drew fourteen.
 *
 * THE FEATURE, in one sentence: the year at a glance — one segment per unit RUN, sized
 * by that run's own hours, filled by what the teacher marked and by nothing else.
 *
 * The clauses that are here because a plausible implementation gets them wrong:
 *
 *   - **fifteen, not fourteen.** The maths document has 14 units and 15 runs. A bar
 *     built per unique unit renders 14 segments and spans one of them across a week
 *     that belongs to another unit. `deriveRuns` owns that ruling; this suite pins that
 *     the *rendered* bar inherits it, because a component is free to re-group.
 *   - **the denominator is Σ `weeks[].hours`.** `totals.hours` agrees on all five real
 *     documents, so only the synthetic divergence can hold that line — a bar sized off
 *     it fills 15% of its track and merely looks "a bit empty".
 *   - **the three absences are the deliverable, not a gap.** No expected-week marker,
 *     no pacing sentence, no accent. Each is pinned executably, because an absence
 *     nobody asserts is one refactor away from being helpfully restored.
 *   - **an absent fill, not a zero-width one.** At `markedWeek: 0` nobody set a
 *     position; a `width: 0%` node is still the product drawing one. `railPercent`
 *     already answers `null` rather than `"0%"` for exactly this case.
 *   - **the colour is checked as a COLOUR.** A classname check passes a token that
 *     happens to be green, so the tokens are resolved to their hex and measured — with
 *     positive controls, so a clause that cannot fail is visible as one.
 *   - **no twenty-seven.** Every real document says 27 weeks, which is precisely what
 *     lets a hardcoded 27 survive. The thirty-week fixture and a source grep kill it.
 *
 * Fixtures come from fe-1 (`programme-fixtures.ts`) and are frozen here — `MATH` is the
 * real recorded corpus, re-recorded at `transcriptionRev 5` when the set symbols were
 * restored. Nothing this suite asserts is corpus TEXT: every number here is hours, weeks
 * and unit ids, none of which the correction touched.
 */
import { render } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import ProgrammeBar from "@/components/ProgrammeBar";
import { deriveRuns, runFill, trackTotal, type Programme, type ProgrammeWeek } from "@/lib/programme";
import { DIVERGENT_TOTALS, MATH, THIRTY_WEEKS } from "./programme-fixtures";

// ── plumbing ──────────────────────────────────────────────────────────────────────

function rootDir(): string {
  const root = process.env.CHAR_ROOTDIR;
  if (!root) throw new Error("CHAR_ROOTDIR is unset — run this through `tools/ci fe --slug …`");
  return root;
}

const readSrc = (rel: string) => readFileSync(path.join(rootDir(), rel), "utf8");

/**
 * The same source with its prose stripped.
 *
 * Every absence clause below runs against THIS, not the raw file: a comment naming what
 * is deliberately missing — «the prototype's `hasReference` marker is not ported» — is
 * the record of the decision, and a grep that punished it would push the reasoning out
 * of the file. What must not appear is the code.
 */
const readCode = (rel: string) =>
  readSrc(rel)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");

const COMPONENT = "src/components/ProgrammeBar.tsx";

function draw(programme: Programme, markedWeek: number) {
  const { container } = render(<ProgrammeBar programme={programme} markedWeek={markedWeek} />);
  const track = container.querySelector(".progbar") as HTMLElement;
  const segments = [...container.querySelectorAll(".progbar__seg")] as HTMLElement[];
  const fills = [...container.querySelectorAll(".progbar__fill")] as HTMLElement[];
  return { container, track, segments, fills };
}

/** The width a segment or fill actually claims, as the DOM reports it. */
const widthOf = (el: HTMLElement) => el.style.width;

/** Every element the component put on the page, track included. */
const allElements = (container: HTMLElement) => [...container.querySelectorAll("*")] as HTMLElement[];

// ── 1 · the segments ──────────────────────────────────────────────────────────────

describe("one segment per unit RUN, in week order", () => {
  test("the real maths document draws fifteen segments from fourteen units", () => {
    const { segments } = draw(MATH, 0);

    expect(MATH.units).toHaveLength(14);
    expect(segments).toHaveLength(15);

    // in week order, and the interrupted unit appears twice — the split is visible in
    // the DOM, not only in the derivation
    expect(segments.map((s) => s.dataset.unitId)).toEqual([
      "u01", "u02", "u03", "u04", "u05", "u06", "u07", "u08",
      "u09", "u10", "u12", "u11", "u12", "u13", "u14",
    ]);
  });

  test("MUTANT dies in the DOM: a bar grouped per unique unit would draw fourteen", () => {
    // the mutant, written out so its own output is on the record rather than assumed
    const perUniqueUnit = (weeks: ProgrammeWeek[]) => [...new Set(weeks.map((w) => w.unitId))];

    expect(perUniqueUnit(MATH.weeks)).toHaveLength(14);
    expect(draw(MATH, 0).segments).toHaveLength(15);
    expect(perUniqueUnit(MATH.weeks).length).not.toBe(deriveRuns(MATH.weeks).length);
  });

  test("each segment's width is its run's hours over Σ weeks[].hours, and they sum to the track", () => {
    const { segments } = draw(MATH, 0);
    const runs = deriveRuns(MATH.weeks);
    const total = trackTotal(MATH.weeks);

    expect(total).toBe(189);

    segments.forEach((seg, i) => {
      const claimed = Number.parseFloat(widthOf(seg));
      expect(claimed).toBeCloseTo((runs[i].hours / total) * 100, 3);
      expect(widthOf(seg).endsWith("%")).toBe(true);
    });

    const sum = segments.reduce((s, seg) => s + Number.parseFloat(widthOf(seg)), 0);
    expect(sum).toBeCloseTo(100, 3);

    // the first run is one week of seven hours against 189 — a concrete number, so the
    // clause above is not merely the component agreeing with itself
    expect(widthOf(segments[0])).toBe("3.7037%");
  });

  test("a programme whose totals.hours disagrees with its weeks still fills its track", () => {
    expect(DIVERGENT_TOTALS.totals.hours).toBe(999);
    expect(trackTotal(DIVERGENT_TOTALS.weeks)).toBe(150);

    const { segments } = draw(DIVERGENT_TOTALS, 0);
    const sum = segments.reduce((s, seg) => s + Number.parseFloat(widthOf(seg)), 0);
    expect(sum).toBeCloseTo(100, 3);

    // what a bar sized off totals.hours would have drawn: a track filled to 15%
    const mutant = deriveRuns(DIVERGENT_TOTALS.weeks).reduce(
      (s, r) => s + (r.hours / DIVERGENT_TOTALS.totals.hours) * 100,
      0,
    );
    expect(mutant).toBeCloseTo(15.015, 2);
  });
});

// ── 2 · what a segment says ───────────────────────────────────────────────────────

describe("the tooltip — the ministry's name, our hours, marked as ours", () => {
  test("every segment carries its unit's name and its run hours, from the data", () => {
    const { segments } = draw(MATH, 0);
    const runs = deriveRuns(MATH.weeks);

    segments.forEach((seg, i) => {
      const name = MATH.units.find((u) => u.id === runs[i].unitId)!.name;
      expect(seg.title).toBe(`${name} · ${runs[i].hours} سا ✎`);
    });

    // the two runs of the interrupted unit share a name and differ in hours — one week
    // against two, which is exactly what a single merged segment would have hidden
    expect(segments[10].title).toBe(`${segments[12].title.split(" · ")[0]} · 7 سا ✎`);
    expect(segments[12].title.endsWith("14 سا ✎")).toBe(true);
  });

  test("the name comes from units[], not from a literal — change the fixture, the DOM follows", () => {
    const renamed: Programme = {
      ...MATH,
      units: MATH.units.map((u) => (u.id === "u01" ? { ...u, name: "اسم مستعار للاختبار" } : u)),
    };
    expect(draw(renamed, 0).segments[0].title).toBe("اسم مستعار للاختبار · 7 سا ✎");

    // and no ministry unit name is written into the component
    const src = readSrc(COMPONENT);
    for (const unit of MATH.units) expect(src).not.toContain(unit.name);
  });

  test("a unit id with no entry in units[] costs its name, not the bar", () => {
    const dangling: Programme = { ...MATH, units: MATH.units.filter((u) => u.id !== "u01") };
    const { segments } = draw(dangling, 0);

    expect(segments).toHaveLength(15);
    expect(segments[0].title).toBe("7 سا ✎");
    // the assigned id is ours and means nothing to a teacher — it never becomes copy
    expect(segments[0].title).not.toContain("u01");
  });
});

// ── 3 · the fill ──────────────────────────────────────────────────────────────────

describe("the fill is what the teacher marked, and nothing else", () => {
  test("at week 9 each segment's fill matches runFill, mid-run included", () => {
    const { segments, fills } = draw(MATH, 9);
    const runs = deriveRuns(MATH.weeks);

    runs.forEach((run, i) => {
      const fill = segments[i].querySelector(".progbar__fill") as HTMLElement | null;
      const expected = runFill(run, 9);
      if (expected === 0) {
        expect(fill).toBeNull();
        return;
      }
      expect(Number.parseFloat(widthOf(fill!))).toBeCloseTo(expected * 100, 3);
    });

    // concrete: the first five runs cover weeks 1–8 and are full; run six is weeks 9–10
    // and the class stands at 9, so it is exactly half
    expect(fills).toHaveLength(6);
    expect(fills.slice(0, 5).map(widthOf)).toEqual(["100%", "100%", "100%", "100%", "100%"]);
    expect(widthOf(fills[5])).toBe("50%");
  });

  test("the interrupted unit fills as two runs — week 21 does not fill u12's second run", () => {
    const { segments } = draw(MATH, 21);

    expect(segments[10].querySelector(".progbar__fill")).not.toBeNull(); // u12, week 20
    expect(segments[11].querySelector(".progbar__fill")).not.toBeNull(); // u11, week 21
    expect(segments[12].querySelector(".progbar__fill")).toBeNull(); // u12, weeks 22–23
  });

  test("markedWeek 0 draws NO fill node anywhere — absent, not zero-width", () => {
    const { segments, fills } = draw(MATH, 0);

    expect(segments).toHaveLength(15);
    expect(fills).toEqual([]);

    // and nothing else claims a position in its place: a segment holds no children at
    // all, so there is no "0%" node, no placeholder and no empty track inside it
    for (const seg of segments) expect(seg.children).toHaveLength(0);
  });

  test("a fill never claims more than its run", () => {
    for (const week of [1, 13, 27, 99]) {
      for (const fill of draw(MATH, week).fills) {
        expect(Number.parseFloat(widthOf(fill))).toBeLessThanOrEqual(100);
      }
    }
  });
});

// ── 4 · the week bound comes from the data ────────────────────────────────────────

describe("a thirty-week programme — the twin of be-2's kill", () => {
  test("segments, widths and fills all follow the fixture, not a constant", () => {
    const { segments, fills } = draw(THIRTY_WEEKS, 22);

    expect(THIRTY_WEEKS.totals.weeks).toBe(30);
    expect(segments).toHaveLength(5);
    expect(segments.map((s) => s.dataset.unitId)).toEqual(["s1", "s2", "s3", "s1", "s4"]);
    expect(segments.map(widthOf)).toEqual([
      "33.3333%",
      "33.3333%",
      "3.3333%",
      "3.3333%",
      "26.6667%",
    ]);

    // positioned at 22: the first four runs are done, the last (weeks 23–30) untouched
    expect(fills).toHaveLength(4);
    expect(fills.map(widthOf)).toEqual(["100%", "100%", "100%", "100%"]);

    // and only a mark at 30 fills the last one
    expect(draw(THIRTY_WEEKS, 29).fills.map(widthOf).at(-1)).toBe("87.5%");
    expect(draw(THIRTY_WEEKS, 30).fills.map(widthOf).at(-1)).toBe("100%");
  });

  test("the component's source carries no twenty-seven literal", () => {
    const offenders = readSrc(COMPONENT)
      .split("\n")
      .filter((l) => l.includes("27"));
    expect(offenders).toEqual([]);
  });
});

// ── 5 · ABSENCE ONE — no expected-week marker ─────────────────────────────────────

describe("the marker the prototype draws is not here", () => {
  test("the track's children are exactly the segments — no marker sibling", () => {
    const { track, segments } = draw(MATH, 9);
    expect(track.children).toHaveLength(segments.length);
    expect([...track.children].every((c) => c.classList.contains("progbar__seg"))).toBe(true);
  });

  test("the only absolutely-positioned nodes are fills, and none is a three-pixel tick", () => {
    const { container, fills } = draw(MATH, 9);

    const absolute = allElements(container).filter((el) => el.style.position === "absolute");
    expect(absolute).toHaveLength(fills.length);
    absolute.forEach((el, i) => expect(el).toBe(fills[i]));

    // the prototype's marker is a 3px bar bled above and below the track
    for (const el of allElements(container)) {
      expect(el.style.width).not.toBe("3px");
      expect(el.style.top).toBe("");
      expect(el.style.bottom).toBe("");
    }
  });

  test("the bar renders no text at all — the marker's label has nowhere to live", () => {
    for (const week of [0, 9, 27]) {
      expect(draw(MATH, week).container.textContent).toBe("");
    }
  });

  test("the component's code knows nothing about an expected week", () => {
    const code = readCode(COMPONENT).toLowerCase();
    for (const token of ["hasreference", "expected", "reference", "متوقَّع", "متوقع"]) {
      expect(code).not.toContain(token.toLowerCase());
    }
  });
});

// ── 6 · ABSENCE TWO — no pacing sentence ──────────────────────────────────────────

/** Every phrase the prototype's pace line and its caption can produce. */
const PACING = [
  "متوقَّع",
  "متأخرون",
  "متقدّمون",
  "في الموعد",
  "التوزيع السنوي",
  "استرشادي",
  "استرشادية",
  "أسابيع)",
  "أسبوع)",
  "(−",
  "(+",
];

describe("no pacing sentence can reach a teacher through this component", () => {
  test("no rendered text or attribute carries any of it, at any position", () => {
    for (const week of [0, 1, 9, 27]) {
      const { container } = draw(MATH, week);
      const surface = [
        container.textContent ?? "",
        ...allElements(container).flatMap((el) =>
          [...el.attributes].map((a) => a.value),
        ),
      ].join(" ");
      for (const phrase of PACING) expect(surface).not.toContain(phrase);
    }
  });

  test("nor does the component's code", () => {
    const code = readCode(COMPONENT);
    for (const phrase of PACING) expect(code).not.toContain(phrase);
  });
});

// ── 7 · ABSENCE THREE — no accent, and no red or green ────────────────────────────
//
// Checked as a COLOUR, not as a name. A classname check passes `--accent` renamed, and
// passes any token that happens to be green; these clauses resolve the tokens to their
// hex and measure them, and carry positive controls so a check that cannot fail shows
// up as one.

/** The declared value of every custom property, per theme, straight from the source. */
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

/** Ink or hue. Ink is contrast; hue grades. */
const isHue = (hex: string) => saturation(hex) >= 0.3;

describe("the colour classifier itself discriminates", () => {
  test("the accent and the danger tokens read as hue in BOTH themes; the inks do not", () => {
    const themes = tokenThemes();
    expect(themes).toHaveLength(2); // light, and the dark @media override

    for (const theme of themes) {
      for (const hued of ["--accent", "--accent-border", "--danger", "--warn"]) {
        expect(isHue(theme[hued])).toBe(true);
      }
      for (const ink of ["--ink", "--ink-soft", "--ink-faint", "--border", "--border-strong"]) {
        expect(isHue(theme[ink])).toBe(false);
      }
    }

    // the slice-1 ruling this bar is a bigger version of: the selected rail was moved
    // OFF the accent and onto ink, and the two are not close
    expect(saturation(themes[0]["--accent"])).toBeGreaterThan(0.5);
    expect(saturation(themes[0]["--ink-soft"])).toBeLessThan(0.1);
  });
});

/**
 * Every colour a stylesheet gives the classnames this component renders.
 *
 * It is empty today — the component ships classNames and the rules are fe-5's — and
 * that is the point: the moment a rule for `.progbar__fill` arrives, this reads its
 * colour rather than its name.
 */
function huedRulesFor(css: string, classNames: string[]): string[] {
  const themes = tokenThemes();
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const offenders: string[] = [];

  for (const [, selector, body] of bare.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!classNames.some((c) => selector.includes(`.${c}`))) continue;
    // every declaration, not a list of colour properties: a hue can arrive through a
    // shorthand (`border-inline-end: 1px solid …`) or a gradient just as easily as
    // through `background`, and a property allow-list is one more thing to keep current
    for (const [, prop, value] of body.matchAll(/([\w-]+)\s*:\s*([^;]+)/g)) {
      const hexes = [...value.matchAll(/#[0-9a-fA-F]{6}/g)].map((m) => m[0]);
      const viaToken = [...value.matchAll(/var\((--[\w-]+)\)/g)].flatMap(([, name]) =>
        themes.map((t) => t[name]).filter((v): v is string => typeof v === "string" && v.startsWith("#")),
      );
      for (const hex of [...hexes, ...viaToken]) {
        if (isHue(hex)) offenders.push(`${selector.trim()} { ${prop}: ${hex} }`);
      }
    }
  }
  return offenders;
}

describe("no accent, no red, no green — measured, not named", () => {
  const CLASSNAMES = ["progbar", "progbar__seg", "progbar__fill"];

  test("the scanner catches a hued rule — the positive control", () => {
    // the accent resolves in BOTH themes, so it is caught twice: a rule that is only
    // green after dark is still green
    expect(huedRulesFor(".progbar__fill { background: var(--accent); }", CLASSNAMES)).toHaveLength(
      2,
    );
    expect(huedRulesFor(".progbar__fill { background: #a4342a; }", CLASSNAMES)).toHaveLength(1);
    expect(huedRulesFor(".progbar__seg { border-inline-end: 1px solid #1f6b52; }", CLASSNAMES))
      .toHaveLength(1);

    // and it does not cry wolf over ink, or over a rule that is not this bar's
    expect(huedRulesFor(".progbar__fill { background: var(--ink-soft); }", CLASSNAMES)).toEqual([]);
    expect(huedRulesFor(".progbar__seg { block-size: 26px; }", CLASSNAMES)).toEqual([]);
    expect(huedRulesFor(".somethingelse { background: var(--accent); }", CLASSNAMES)).toEqual([]);
  });

  test("no stylesheet rule gives this bar a hue", () => {
    expect(huedRulesFor(readSrc("src/App.css"), CLASSNAMES)).toEqual([]);
  });

  test("the component itself names no colour — no literal, no hued token", () => {
    const src = readCode(COMPONENT);

    expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(src).not.toMatch(/\b(rgb|rgba|hsl|hsla)\(/);
    expect(src).not.toMatch(/--(accent|danger|warn|success)/);
    expect(src.toLowerCase()).not.toMatch(/\b(green|red|success|danger|warning)\b/);
  });

  test("nothing rendered carries an inline colour at all", () => {
    const { container } = draw(MATH, 9);
    for (const el of allElements(container)) {
      const inline = el.getAttribute("style") ?? "";
      expect(inline).not.toMatch(
        /(^|[\s;])(background|background-color|color|border[\w-]*color|outline[\w-]*|fill|stroke|box-shadow)\s*:/,
      );
    }
  });

  test("no classname on any node reads as a grade", () => {
    const { container } = draw(MATH, 9);
    for (const el of allElements(container)) {
      expect(el.className.toLowerCase()).not.toMatch(
        /accent|danger|success|warn|green|red|behind|late|ahead/,
      );
    }
  });
});

// ── 8 · RTL, and the hard constraints ─────────────────────────────────────────────

describe("RTL is logical, everywhere", () => {
  test("the track runs right-to-left and each fill is pinned to its own inline start", () => {
    const { track, fills } = draw(MATH, 9);

    expect(track.style.direction).toBe("rtl");
    for (const fill of fills) {
      expect(fill.style.getPropertyValue("inset-inline-start")).toBe("0px");
      expect(fill.style.position).toBe("absolute");
    }
  });

  test("no physical side is pinned anywhere — in the DOM or in the source", () => {
    const { container } = draw(MATH, 9);
    for (const el of allElements(container)) {
      const inline = el.getAttribute("style") ?? "";
      expect(inline).not.toMatch(/(^|[\s;])(left|right|margin-left|margin-right|padding-left|padding-right|border-left|border-right)\s*:/);
    }

    const src = readCode(COMPONENT);
    expect(src).not.toMatch(/\b(left|right|marginLeft|marginRight|borderLeft|borderRight)\s*:/);
  });
});

describe("the hard constraints", () => {
  test("every string a teacher can see is Arabic with Western digits", () => {
    const { container, track, segments } = draw(MATH, 9);

    const copy = [
      container.textContent ?? "",
      track.getAttribute("aria-label") ?? "",
      ...segments.map((s) => s.title),
    ].join(" ");

    expect(copy).not.toMatch(/[A-Za-z]/); // no English, and no LaTeX command
    expect(copy).not.toMatch(/[٠-٩۰-۹]/); // no Arabic-Indic digits
    expect(copy).toMatch(/[0-9]/); // the hours are there, in Western digits
    expect(copy).not.toContain("$");
    expect(copy).not.toContain("\\");
  });

  test("the component's own copy is Arabic — no English string reaches the DOM", () => {
    const src = readCode(COMPONENT);
    const literals = [...src.matchAll(/"([^"]*)"|`([^`]*)`/g)]
      .map((m) => m[1] ?? m[2])
      // an interpolation is code, not copy — `${run.hours} سا ✎` renders a number
      .map((s) => s.replace(/\$\{[^}]*\}/g, ""));
    const arabic = literals.filter((s) => /[؀-ۿ]/.test(s));

    expect(arabic.length).toBeGreaterThan(0);
    for (const s of arabic) expect(s).not.toMatch(/[A-Za-z]/);
  });
});
