/**
 * fe-6 — the guard rails: absences, channels, and the promises no one sub-issue owns.
 *
 * THE WHOLE-SLICE NET. fe-1..fe-4 pin four units against hand-built props and fe-5 pins
 * the wiring; each of those nets is scoped to what its own sub-issue could break. This
 * one is scoped to what the SLICE promised — the properties that are true only if every
 * file agrees, and that a per-file oracle therefore cannot see:
 *
 *   - **the shipped absences are the deliverable.** «سلسلة تمارين هذا الأسبوع»,
 *     «تمارين دعم», the «قادم» proposal card, the expected-week marker and its pacing
 *     sentence, «إعداد موضوع», «مكتبتي», a course link on a content item, a note input.
 *     Each component asserts its own; nobody asserted that the two SCREENS, assembled and
 *     driven, carry none of them (contract §0).
 *   - **the two text channels never cross.** `Statement` pairs two «$» and eats both, so
 *     the rule is «one channel per author», not «one channel per field». Pinned here over
 *     the assembled screens with a positive control that the corruption is real.
 *   - **a class-less teacher must not be able to tell this slice shipped.** fe-5 pinned
 *     the shell's className and children; this adds the stronger form — not one string,
 *     classname or request THIS SLICE INTRODUCED appears anywhere in their app.
 *   - **no Latin, no Arabic-Indic digit, no LaTeX source, no «AI».** The corpus carries
 *     zero Latin outside its «$…$» islands (measured 2026-08-11 over all 310 strings), so
 *     the sweep can be honest at the level of the whole document: every text node outside
 *     a KaTeX island, over both screens, all bands open.
 *   - **the colour sweep runs over the WHOLE slice-2 stylesheet**, not a prefix list.
 *     fe-2/fe-3/fe-5 aimed their scanners at the selectors they knew about; a rule added
 *     under a seventh prefix would have escaped all three. This one reads every rule after
 *     the slice-2 marker and resolves every `var(--token)` against BOTH themes.
 *
 * ── Two things this file deliberately does NOT assert ────────────────────────────
 *
 * 1. **No `\square` clause.** The escalation was closed at the SOURCE (loader,
 *    `programme_revisions`, `transcriptionRev` 5) and the corpus now carries
 *    `\mathbb{R}` / `\mathbb{Z}` / `\mathbb{C}` where the boxes were — 26 occurrences
 *    across 21 strings, 0 placeholders left (re-measured live at pre-flight). A clause
 *    expecting a box would now be a clause demanding a defect. What §6.5 actually forbids
 *    survives unchanged and is pinned below: **no stack may remap corpus text**, in
 *    either direction. The corrected symbols make that MORE load-bearing, not less —
 *    a rendering path that leaks LaTeX source now leaks more of it.
 * 2. **Nothing about page fidelity.** Contract §8.9: a green here certifies structure and
 *    channels, never that an Arabic string matches the printed page.
 */
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import App from "@/App";
import type { ClassRef } from "@/lib/classes";
import { Statement } from "@/lib/katex";
import type { Programme } from "@/lib/programme";
import { MATH, THIRTY_WEEKS } from "./programme-fixtures";

const TID = "0123456789abcdef0123456789abcdef";
const C1 = "6a7a7a365877e8523b8b023c";
const C2 = "6a7a7a575877e8523b8b023d";

const TWO_CLASSES: ClassRef[] = [
  { id: C1, name: "3ر1", stream: "شعبة الرياضيات", createdAt: "2026-08-11T01:26:14.969Z" },
  { id: C2, name: "3ع2", stream: "علوم تجريبية", createdAt: "2026-08-11T01:26:47.159Z" },
];

/**
 * The recorded corruption, verbatim (SEED §6): `Statement` pairs the two «$» and both
 * disappear, fusing «5» and «9». It is a teacher's sentence about money, which is why it
 * is the fixture — a note is the one string on these screens whose author is the teacher.
 */
const NOTE = "من 5 $ إلى 9 $ دينار";

// ══ the harness ═══════════════════════════════════════════════════════════════════

const rootDir = () => {
  const dir = process.env.CHAR_ROOTDIR;
  if (!dir) throw new Error("CHAR_ROOTDIR must be set (run via tools/ci)");
  return dir;
};
const readSrc = (rel: string) => readFileSync(path.join(rootDir(), rel), "utf8");
/** The same source with its prose stripped — fe-2's tool, for the same reason. */
const readCode = (rel: string) =>
  readSrc(rel)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");

/** Every file under `src/` — the sweep must not be a list somebody keeps up to date. */
function srcFiles(ext = /\.(ts|tsx|css)$/): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (ext.test(name)) out.push(path.relative(rootDir(), full));
    }
  };
  walk(path.join(rootDir(), "src"));
  return out.sort();
}

const norm = (s: string) => (s ?? "").replace(/\s+/g, " ").trim();
const text = (el: Element | null) => norm(el?.textContent ?? "");

interface ProgressState {
  markedWeek: number;
  rev: number;
  entries: { week: number; status: string; note?: string; completedAt?: string }[];
}

function progressBody(classId: string, p: ProgressState, totalWeeks: number) {
  const started = p.markedWeek > 0 || p.rev > 0;
  return {
    progress: {
      classId,
      markedWeek: p.markedWeek,
      entries: p.entries,
      rev: p.rev,
      programmeDocKey: started ? "tadarroj-3as-math" : null,
      programmeEdition: started ? "2022-09" : null,
      programmeTranscriptionRev: started ? 5 : null,
      updatedAt: started ? "2026-08-11T01:26:47.207Z" : null,
    },
    programme: { docKey: "tadarroj-3as-math", edition: "2022-09", totalWeeks },
    correlationId: "cid-progress",
  };
}

interface ApiOptions {
  classes?: ClassRef[];
  positions?: Record<string, ProgressState>;
  programmes?: Record<string, Programme>;
  totalWeeks?: number;
}

/** fe-5's mock, narrowed to what a guard-rail sweep drives. Records every call. */
function mockApi(opts: ApiOptions = {}) {
  const calls: { method: string; url: string; body: unknown }[] = [];
  const positions: Record<string, ProgressState> = {
    ...Object.fromEntries(
      (opts.classes ?? []).map((c) => [c.id, { markedWeek: 0, rev: 0, entries: [] }]),
    ),
    ...(opts.positions ?? {}),
  };
  const bound = opts.totalWeeks ?? MATH.totals.weeks;

  const fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? "GET";
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method, url, body });
    const res = (status: number, payload: unknown) => ({
      ok: status < 300,
      status,
      json: async () => payload,
    });

    if (url.startsWith("/api/subjects") && method === "GET")
      return res(200, { subjects: [], correlationId: "cid-list" });
    if (url === "/api/classes" && method === "GET")
      return res(200, { classes: opts.classes ?? [], correlationId: "cid-classes" });

    const prog = /^\/api\/classes\/([^/]+)\/programme$/.exec(url);
    if (prog && method === "GET")
      return res(200, {
        programme: opts.programmes?.[decodeURIComponent(prog[1]!)] ?? MATH,
        correlationId: "cid-programme",
      });

    const pr = /^\/api\/progress\/([^?]+)$/.exec(url);
    if (pr) {
      const id = decodeURIComponent(pr[1]!);
      const held = positions[id] ?? { markedWeek: 0, rev: 0, entries: [] };
      if (method === "GET") return res(200, progressBody(id, held, bound));
      if (method === "PUT") {
        const entries = [...held.entries];
        if (body?.entry) {
          const i = entries.findIndex((e) => e.week === body.entry.week);
          if (i >= 0) entries[i] = { ...entries[i], ...body.entry };
          else entries.push(body.entry);
        }
        positions[id] = { markedWeek: body.markedWeek, rev: held.rev + 1, entries };
        return res(200, {
          progress: progressBody(id, positions[id]!, bound).progress,
          correlationId: "cid-put",
        });
      }
    }
    return res(404, { error: { message: "غير موجود", type: "not_found" } });
  });
  vi.stubGlobal("fetch", fetchMock);

  return {
    calls,
    urls: () => calls.map((c) => c.url),
    programmeGets: () =>
      calls.filter((c) => /^\/api\/classes\/[^/]+\/programme$/.test(c.url)),
  };
}

function session(classId?: string) {
  localStorage.setItem("teacher.id.v1", JSON.stringify(TID));
  if (classId) localStorage.setItem("teacher.class.v1", JSON.stringify(classId));
}

async function boot() {
  await act(async () => {
    render(<App />);
  });
}

const nav = () => document.querySelector<HTMLElement>("nav.nav");
const navItem = (label: string) =>
  [...document.querySelectorAll<HTMLElement>(".nav__item")].find(
    (b) => norm(b.textContent ?? "") === label,
  );
const tracker = () => document.querySelector<HTMLElement>(".tracker");
const weekcard = () => document.querySelector<HTMLElement>(".weekcard");

async function click(el: Element | null | undefined) {
  if (!el) throw new Error("nothing to click");
  await act(async () => {
    fireEvent.click(el);
  });
}
const goto = (label: string) => click(navItem(label));

/** Open every band, so the sweep sees the whole year rather than 27 summary lines. */
async function openEveryBand() {
  for (const t of [...document.querySelectorAll<HTMLElement>(".tracker__toggle")]) {
    if (t.getAttribute("aria-expanded") === "false") await click(t);
  }
}

/**
 * Every text node the teacher reads, EXCEPT what is inside a KaTeX island.
 *
 * The islands are excluded because their contents are rendered mathematics, not text:
 * `\mathbb{R}` comes out as ℝ, an integral as glyphs and boxes, and a Latin `f` in a
 * function name is the ministry's mathematics rather than an English UI string. Excluding
 * them is what lets the Latin sweep be honest at document level — and the sweep is only
 * honest because the corpus carries **zero** Latin outside its islands (measured over all
 * 310 strings of the maths document, 2026-08-11). The `$` and `\` clauses then say
 * something real: any that survive got past `Statement` as SOURCE.
 */
/**
 * The elements of the two new screens that are OURS — everything under `.progview`
 * except what KaTeX built inside a `.math` island.
 *
 * The distinction is load-bearing for every classname sweep below: KaTeX's own
 * vocabulary contains `mspace`, `katex-accent`, `mord` and `vlist`, so a sweep over raw
 * markup answers itself and a sweep "fixed" until it passes catches nothing at all.
 */
function ourElements(): Element[] {
  return [...document.querySelectorAll(".progview [class]")].filter(
    (el) => !el.closest(".math"),
  );
}

/**
 * Copy a teacher reads that is NOT a text node — `title`, `aria-label`, `placeholder`.
 *
 * Added at fe-6 because a mutant walked straight through the text sweep: the bar's segment
 * tooltip is `title={unitName + hours}`, so `${run.hours} h (expected)` — an English label
 * carrying the invented reference this slice exists to refuse — was invisible to a walk
 * over text nodes. Three surfaces of this slice put real copy in an attribute and nowhere
 * else: the bar's per-run tooltip, the emphasis flag's caption (the ministry's own legend)
 * and the nav's landmark label. All three are teacher-visible; none is a text node.
 */
function readableAttributes(root: ParentNode = document.body): string {
  const out: string[] = [];
  for (const el of root.querySelectorAll("*")) {
    if (el.closest(".math")) continue; // KaTeX writes its own aria plumbing
    for (const name of ["title", "aria-label", "placeholder", "alt"]) {
      const v = el.getAttribute(name);
      if (v) out.push(v);
    }
  }
  return norm(out.join(" | "));
}

/** The files THIS SLICE wrote. A sweep over all of `src/` answers with slice-1 prose. */
const SLICE_FILES = [
  "src/App.tsx",
  "src/App.css",
  "src/components/Nav.tsx",
  "src/components/ProgrammeBar.tsx",
  "src/components/WeekCard.tsx",
  "src/components/Tracker.tsx",
  "src/lib/programme.ts",
];

function readableText(root: ParentNode = document.body): string {
  const out: string[] = [];
  const walk = (node: Node) => {
    if (node.nodeType === 3) {
      out.push(node.nodeValue ?? "");
      return;
    }
    if (node.nodeType !== 1) return;
    const el = node as Element;
    if (el.classList.contains("math")) return; // a rendered island, not text
    for (const child of [...el.childNodes]) walk(child);
  };
  for (const child of [...(root as Node).childNodes]) walk(child);
  // Normalised, because a text-node boundary is a fact about JSX and not about what the
  // teacher reads: `{totals.weeks}{" "}\n أسبوعًا` is three nodes and one phrase.
  return norm(out.join(" "));
}

beforeEach(() => {
  localStorage.clear();
  window.location.hash = "";
  vi.unstubAllGlobals();
  vi.resetModules();
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  cleanup();
  window.location.hash = "";
  localStorage.clear();
});

/** Both screens of a positioned maths class, every band open. Used by most sweeps. */
async function bothScreens(
  position: ProgressState = { markedWeek: 8, rev: 3, entries: [] },
  programme: Programme = MATH,
  totalWeeks?: number,
) {
  session(C1);
  const h = mockApi({
    classes: TWO_CLASSES,
    positions: { [C1]: position },
    programmes: { [C1]: programme },
    totalWeeks,
  });
  await boot();
  await waitFor(() => expect(nav()).toBeTruthy());

  await goto("هذا الأسبوع");
  await waitFor(() => expect(weekcard()).toBeTruthy());
  const week = readableText();
  const weekHtml = document.body.innerHTML;

  await goto("البرنامج");
  await waitFor(() => expect(tracker()).toBeTruthy());
  await openEveryBand();
  const year = readableText();
  const yearHtml = document.body.innerHTML;

  return { h, week, year, weekHtml, yearHtml, both: `${week} ${year}` };
}

// ══ 1 · THE ABSENCE SWEEP ═════════════════════════════════════════════════════════

describe("what this slice ships is partly what it does not draw", () => {
  /**
   * Contract §0 names them one by one and each component asserts its own. Nobody
   * asserted the assembled screens — which is where a stray affordance would actually
   * reach a teacher, and where a host (fe-5) could reintroduce one that no component
   * oracle covers.
   */
  test("neither screen carries a single absent-by-design string", async () => {
    const { both } = await bothScreens();

    for (const forbidden of [
      "سلسلة", // «سلسلة تمارين هذا الأسبوع» / «سلسلة الأسبوع» — generation is slice 3
      "تمارين دعم", // roadmap 5
      "متوقَّع", // the invented expected week
      "متوقع",
      "إعداد موضوع", // slice 3's nav item, absent rather than greyed
      "مكتبتي", // slice 5's
      "الدرس", // the prototype's course link on a content item — slice 7
      "متأخر", // the pacing sentence, in every form the prototype spells it
      "في الموعد",
      "أسابيع)",
    ])
      expect(both).not.toContain(forbidden);
  });

  test("«قادم» exists ONLY as a week's status label, never as a proposal card", async () => {
    // The prototype draws a «قادم — الأسبوع 9» panel that needs a calendar; there is no
    // calendar anywhere in this product. The word survives because it is the status
    // vocabulary (contract §0) — so the clause has to distinguish the two rather than ban
    // the string, or it would be satisfied by deleting a label that must stay.
    const { year } = await bothScreens();
    expect(year).toContain("قادم");
    expect(year).not.toContain("قادم —");
    expect(year).not.toContain("قادم -");
    for (const el of document.querySelectorAll(".tracker__tag"))
      expect(["قادم", "منجز", "مُتخطّى", "الأسبوع الحالي"]).toContain(text(el));
    // every «قادم» in the DOM is one of those tags and nothing else
    const tags = [...document.querySelectorAll(".tracker__tag")].filter(
      (e) => text(e) === "قادم",
    ).length;
    expect(tags).toBeGreaterThan(0);
    expect(readableText().split("قادم").length - 1).toBe(tags);
  });

  test("no accent marker node and no pacing element on either screen", async () => {
    await bothScreens();
    // OURS only. A raw HTML sweep answers itself with KaTeX's own vocabulary —
    // `mspace` contains «pace» and `katex-accent` contains «accent» — which would
    // make this clause fail on correct code and, worse, could be "fixed" by
    // weakening it until it caught nothing.
    for (const el of ourElements()) {
      expect({ [el.className]: /marker|pace|expected|accent/i.test(el.className) }).toEqual({
        [el.className]: false,
      });
      expect(el.getAttribute("style") ?? "").not.toMatch(/--accent|--danger|--warn/);
    }
    expect(ourElements().length).toBeGreaterThan(100);
  });

  test("a content item is inert — no anchor, no handler, no affordance", async () => {
    await bothScreens();
    const items = [...document.querySelectorAll(".tracker__item, .weekcard__item")];
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(item.querySelector("a")).toBeNull();
      expect(item.querySelector("button")).toBeNull();
      expect(item.getAttribute("role")).toBeNull();
      expect(item.getAttribute("tabindex")).toBeNull();
    }
    // and nothing in either component knows how to open one
    for (const f of ["src/components/WeekCard.tsx", "src/components/Tracker.tsx"])
      expect(readCode(f)).not.toMatch(/<a\b|href=/);
  });

  test("no note input exists — `entry.note` is rendered and never authored", async () => {
    await bothScreens({ markedWeek: 8, rev: 3, entries: [{ week: 5, status: "skipped", note: NOTE }] });
    // the whole app, not just the two screens: an input added anywhere in the programme
    // view is the same defect wherever it is mounted
    const view = document.querySelector(".progview")!;
    expect(view.querySelectorAll("input, textarea, [contenteditable]")).toHaveLength(0);
    for (const f of ["src/components/WeekCard.tsx", "src/components/Tracker.tsx"])
      expect(readCode(f)).not.toMatch(/<input|<textarea|contentEditable/);
  });
});

// ══ 2 · THE TWO CHANNELS ══════════════════════════════════════════════════════════

describe("one channel per author — the ministry through KaTeX, the teacher as plain text", () => {
  test("POSITIVE CONTROL: `Statement` really does eat a teacher's two «$»", () => {
    // Without this the negative clauses below could pass on a `Statement` that had been
    // quietly made safe — and the rule would then be pinned against nothing.
    const { container } = render(<Statement text={NOTE} />);
    expect(norm(container.textContent ?? "")).not.toContain("$");
    expect(container.querySelectorAll(".math").length).toBeGreaterThan(0);
    cleanup();
  });

  test("a note renders byte-verbatim, with both «$», and no KaTeX island in it", async () => {
    await bothScreens({
      markedWeek: 8,
      rev: 3,
      entries: [{ week: 5, status: "skipped", note: NOTE }],
    });
    const note = document.querySelector(".tracker__note")!;
    expect(text(note)).toContain(NOTE);
    expect((note.textContent ?? "").match(/\$/g)).toHaveLength(2);
    expect(note.querySelectorAll(".math")).toHaveLength(0);
    expect(note.querySelectorAll(".statement")).toHaveLength(0);
  });

  test("a note survives a FOLDED band — the disclosure compresses the ministry, not the teacher", async () => {
    // Rendered only when open, a teacher's own sentence would be the one line the
    // collapse hides — the exact opposite of what the collapse is for.
    session(C1);
    mockApi({
      classes: TWO_CLASSES,
      positions: {
        [C1]: { markedWeek: 8, rev: 3, entries: [{ week: 20, status: "skipped", note: NOTE }] },
      },
      programmes: { [C1]: MATH },
    });
    await boot();
    await waitFor(() => expect(nav()).toBeTruthy());
    await goto("البرنامج");
    await waitFor(() => expect(tracker()).toBeTruthy());

    const band20 = document.querySelector('[data-week="20"]')!;
    expect(band20.getAttribute("data-open")).toBe("false");
    expect(text(band20.querySelector(".tracker__note"))).toContain(NOTE);
    expect(band20.querySelectorAll(".math")).toHaveLength(0);
  });

  test("every `Statement` call site in this slice is handed a MINISTRY field", () => {
    // The channel is chosen by WHO WROTE the string, so the pin is on the argument, not
    // on the rendering. `note` must never appear inside a `<Statement …>` in either file.
    for (const f of ["src/components/WeekCard.tsx", "src/components/Tracker.tsx"]) {
      const code = readCode(f);
      const sites = [...code.matchAll(/<Statement\s+text=\{([^}]*)\}/g)].map((m) => m[1]!.trim());
      expect(sites.length).toBeGreaterThan(0);
      for (const arg of sites) {
        expect(arg).not.toMatch(/note/i);
        expect(arg).toMatch(/unitName|row\.|text|items|guidance/);
      }
    }
  });

  test("EVERY «$…$» span in the corpus becomes an island — counted, not sampled", async () => {
    // The negative clauses only mean something if the positive channel is complete. The
    // expected count is DERIVED from the fixture, never written down: a re-recording moves
    // both sides together, while a rendering path that drops or fuses spans moves only
    // one. Measured live at fe-6 on lane s9 with all 27 bands open: 265 islands, 26
    // `.mathbb` glyphs, 0 errors — which is exactly what this computes from the document.
    await bothScreens(); // ends on the tracker with every band open

    // NOT VACUOUS: both sides are non-zero, so a fixture that lost its maths could not
    // satisfy this by agreeing with an empty DOM.
    const islands = expectedIslands(MATH);
    const setSymbols = MATH.weeks
      .flatMap((w) => w.rows.flatMap((r) => [...r.competencies, ...r.contents, ...r.guidance]))
      .reduce((n, s) => n + (s.match(/\\mathbb/g)?.length ?? 0), 0);
    expect(islands).toBe(265);
    expect(setSymbols).toBe(26);

    expect(document.querySelectorAll(".tracker .math")).toHaveLength(islands);
    expect(document.querySelectorAll(".tracker .katex-error")).toHaveLength(0);
    // and the symbols that replaced the escalated placeholders all rendered AS symbols
    expect(document.querySelectorAll(".tracker .mathbb")).toHaveLength(setSymbols);
    expect(readableText()).toContain("السير المنهجي لتدرج التعلمات");
  });
});

// ══ 3 · THE CORPUS SHIPS UNTOUCHED ════════════════════════════════════════════════

describe("no stack may remap ministry text — in either direction", () => {
  /**
   * §6.5's rule outlived the defect it was written for. The boxes are gone (fixed at the
   * source: loader, `programme_revisions`, `transcriptionRev` 5) and `\mathbb{R}` /
   * `\mathbb{Z}` / `\mathbb{C}` stand where they stood — 26 occurrences across 21 strings,
   * measured live at pre-flight. What must never appear is a stack deciding what a symbol
   * meant, which is the same forbidden derivation whichever way it points.
   */
  test("nothing this slice wrote knows a set symbol, a box, or how to swap one for the other", () => {
    // The RAW source, comments included — fe-3 pinned the same on its own file so that
    // `grep -rn square src/components` stays clean, and this is that grep made
    // executable over every file the slice touched. Scoped to those files on purpose:
    // `ExamView.tsx:121` names `\mathbb{C}` in prose, illustrating what a GENERATED exam
    // may contain. That is slice-1 code about a different corpus and not this rule's
    // business; sweeping it would make the clause about someone else's comment.
    for (const rel of SLICE_FILES) {
      const raw = readSrc(rel);
      expect({ [rel]: raw.toLowerCase().includes("square") }).toEqual({ [rel]: false });
      expect({ [rel]: raw.toLowerCase().includes("mathbb") }).toEqual({ [rel]: false });
      // The SYMBOLS are checked against the stripped source, unlike the two spellings
      // above: `WeekCard.tsx` explains in prose that «the corpus prints □ where the
      // ministry printed a number set», which is the note that keeps the rule
      // understood. A clause that deleted the explanation would keep the behaviour and
      // lose the reason.
      expect({ [rel]: /[ℤℂℝℕℚ□]/.test(readCode(rel)) }).toEqual({ [rel]: false });
    }
  });

  test("the recorded corpus carries no placeholder left behind", () => {
    const every = [
      ...MATH.units.map((u) => u.name),
      ...MATH.weeks.flatMap((w) =>
        w.rows.flatMap((r) => [...r.competencies, ...r.contents, ...r.guidance]),
      ),
    ];
    expect(every.filter((s) => s.includes("\\square"))).toEqual([]);
    // and the symbols that replaced them are present and untouched in the fixture
    expect(every.filter((s) => s.includes("\\mathbb")).length).toBe(21);
  });
});

// ══ 4 · THE LEGACY SWEEP ══════════════════════════════════════════════════════════

describe("a teacher with no classes cannot tell this slice shipped", () => {
  /**
   * The regression that would reach EVERY teacher who predates the slice. fe-5 pinned the
   * shell's className and children; this is the stronger statement — not one string,
   * classname or request this slice introduced appears anywhere in their app.
   */
  test("not one classname, string or request of this slice reaches their DOM", async () => {
    session();
    const h = mockApi({ classes: [] });
    await boot();
    await waitFor(() => expect(h.urls()).toContain("/api/classes"));

    const html = document.body.innerHTML;
    for (const cls of ["nav", "progview", "progbar", "weekcard", "tracker", "app--"])
      expect(html).not.toContain(`class="${cls}`);
    for (const cls of ["nav__", "progview__", "progbar__", "weekcard__", "tracker__", "app--nav"])
      expect(html).not.toContain(cls);
    // «البرنامج» is deliberately NOT in this list: it is a word the BUILDER already
    // uses («مواضيع مختلطة من البرنامج», the topic picker's first option, and the
    // disclaimer under the generate button). Banning it here would make the clause pass
    // only by deleting slice-1 copy — a guard rail that damages what it guards.
    for (const s of [
      "هذا الأسبوع",
      "التدرج السنوي",
      "وصلنا هنا",
      "أين وصل هذا القسم؟",
      "أنهيت هذا الأسبوع",
      "نصّ الوزارة حرفيًا",
    ])
      expect(readableText()).not.toContain(s);

    expect(document.querySelectorAll("nav")).toHaveLength(0);
    expect(document.querySelector(".app")!.className).toBe("app");
    expect(h.programmeGets()).toHaveLength(0);
  });

  test("their boot request set is slice 1's, exactly — nothing added, nothing reordered", async () => {
    session();
    const h = mockApi({ classes: [] });
    await boot();
    await waitFor(() => expect(h.urls()).toContain("/api/classes"));

    expect([...h.urls()].sort()).toEqual(["/api/classes", "/api/subjects"]);
    expect(h.calls.every((c) => c.method === "GET")).toBe(true);
  });

  test("a deep link to either new view leaves them exactly where they were", async () => {
    for (const hash of ["#/week", "#/programme"]) {
      window.location.hash = hash;
      session();
      const h = mockApi({ classes: [] });
      await boot();
      await waitFor(() => expect(h.urls()).toContain("/api/classes"));

      expect(document.querySelector(".app")!.className).toBe("app");
      expect(tracker()).toBeNull();
      expect(weekcard()).toBeNull();
      expect(document.querySelector(".progview")).toBeNull();
      expect(h.programmeGets()).toHaveLength(0);
      cleanup();
      localStorage.clear();
      vi.unstubAllGlobals();
    }
  });
});

// ══ 5 · THE LANGUAGE SWEEP ════════════════════════════════════════════════════════

describe("Arabic only, Western digits, no LaTeX, no «AI» — over both assembled screens", () => {
  test("not one Latin letter outside a rendered maths island, on either screen", async () => {
    // Honest at document level only because the corpus carries zero Latin outside «$…$»
    // (all 310 strings, measured 2026-08-11). Inside an island it is mathematics — a
    // function name, a variable — and belongs to the ministry, not to a UI string.
    const { week, year } = await bothScreens();
    for (const [name, body] of [["week", week], ["year", year]] as const) {
      const latin = body.match(/[A-Za-z]+/g) ?? [];
      expect({ [name]: latin }).toEqual({ [name]: [] });
    }
  });

  test("and not one in a TOOLTIP either — attributes are copy too", async () => {
    // A mutant proved this was not covered: `title={`${run.hours} h (expected)`}` on the
    // bar's segments walked through a text-node sweep untouched, carrying both an English
    // label and the invented «expected» reference §6.4 exists to refuse. Three surfaces of
    // this slice speak only through an attribute — the segment tooltip, the emphasis
    // flag's caption, the nav's landmark name.
    await bothScreens();
    const attrs = readableAttributes();
    expect(attrs.match(/[A-Za-z]+/g) ?? []).toEqual([]);
    expect(attrs).not.toMatch(/[٠-٩۰-۹]/);
    expect(attrs).not.toContain("$");
    expect(attrs).not.toContain("\\");
    expect(attrs).not.toMatch(/\bAI\b/i);
    // NOT VACUOUS: the three surfaces really are speaking.
    expect(attrs).toContain("محاور البرنامج السنوي"); // the bar's landmark
    expect(attrs).toContain("التنقّل"); // the nav's
    expect(attrs).toContain(MATH.units[0]!.name); // a segment tooltip, from `units[]`
  });

  test("Western digits everywhere, Arabic-Indic nowhere", async () => {
    const { both } = await bothScreens();
    expect(both).not.toMatch(/[٠-٩۰-۹]/);
    expect(both).toMatch(/\d/); // the week numbers really are being rendered
  });

  test("no LaTeX source reaches the DOM as text — not «$», not a backslash", async () => {
    // The corrected corpus makes this sharper than it was: 26 `\mathbb{…}` where there
    // used to be boxes, so a rendering path that leaked source would now leak MORE of it.
    const { week, year } = await bothScreens();
    for (const body of [week, year]) {
      expect(body).not.toContain("\\");
      expect(body).not.toContain("$");
      expect(body).not.toContain("\\frac");
      expect(body).not.toContain("mathbb");
    }
  });

  test("the ONE «$» a teacher may read is their own note, and it is theirs", async () => {
    const { year } = await bothScreens({
      markedWeek: 8,
      rev: 3,
      entries: [{ week: 5, status: "skipped", note: NOTE }],
    });
    expect(year).toContain(NOTE);
    // every «$» in the whole readable document belongs to that note and to nothing else
    const all = (year.match(/\$/g) ?? []).length;
    expect(all).toBe(2);
  });

  test("the word «AI» is nowhere — in the DOM of either screen, or in this slice's source", async () => {
    const { both } = await bothScreens();
    expect(both).not.toMatch(/\bAI\b/i);
    expect(both).not.toContain("ذكاء اصطناعي");
    // `readCode`, so COMMENTS are out of scope: `Controls.tsx:146` records, in prose,
    // that «يولّد الموضوع بالذكاء الاصطناعي…» was deleted from the busiest screen in the
    // product. A rule that punished the note explaining the rule would delete the reason
    // and keep the behaviour — which is how a rule quietly stops being understood.
    for (const rel of srcFiles(/\.(ts|tsx|css)$/)) {
      const code = readCode(rel);
      expect({ [rel]: /\bAI\b/.test(code) }).toEqual({ [rel]: false });
      expect({ [rel]: /ذكاء\s*ال?اصطناعي/.test(code) }).toEqual({ [rel]: false });
    }
  });

  test("the ≠27 programme changes every number on both screens — no constant survives", async () => {
    // The twin of be-2's kill, at slice level: every real corpus document says 27, so a
    // hardcoded one would be invisible against any of them.
    const { week, year } = await bothScreens(
      { markedWeek: 8, rev: 3, entries: [] },
      THIRTY_WEEKS,
      30,
    );
    expect(week).toContain("الأسبوع 8 من 30");
    expect(year).toContain("30 أسبوعًا");
    expect(document.querySelectorAll(".tracker__band")).toHaveLength(30);
    expect(week).not.toContain("27");
    expect(year).not.toContain("27 أسبوعًا");
  });
});

// ══ 6 · RELATIVE URLS ONLY ════════════════════════════════════════════════════════

describe("no absolute backend URL exists anywhere — the lane proxy is the only path", () => {
  test("every call this slice makes is a relative /api URL", async () => {
    const { h } = await bothScreens();
    expect(h.calls.length).toBeGreaterThan(3);
    for (const c of h.calls) {
      expect(c.url.startsWith("/api/")).toBe(true);
      expect(c.url).not.toMatch(/^https?:/);
      expect(c.url).not.toContain("localhost");
    }
  });

  test("and none is COMPILED IN — the whole of `src/` is swept, not a list of files", () => {
    // An absolute URL in app code is THE bug that makes a job lane's UI talk to the main
    // checkout's API silently. `vite.config.ts` is deliberately not swept: its literals
    // are the documented standalone fallbacks and live outside `src/`.
    for (const rel of srcFiles()) {
      const code = readCode(rel);
      expect({ [rel]: /https?:\/\//.test(code) }).toEqual({ [rel]: false });
      expect({ [rel]: /localhost/.test(code) }).toEqual({ [rel]: false });
      expect({ [rel]: /:\s*(9\d{3}|10\d{3})\b/.test(code) }).toEqual({ [rel]: false });
    }
  });
});

// ══ 7 · THE COLOUR SWEEP, OVER THE WHOLE SLICE-2 STYLESHEET ═══════════════════════

describe("ink, never hue — every rule this slice added, in both themes", () => {
  /**
   * fe-2, fe-3 and fe-5 each aimed a scanner at the selectors they knew about. This one
   * reads **every rule after the slice-2 marker**, so a rule added under a prefix nobody
   * listed cannot escape it — which is the only version of «the slice's CSS is clean»
   * that stays true as the stylesheet grows.
   */
  test("the sweep really is aimed at the whole region, and the region is not empty", () => {
    const rules = sliceRules();
    expect(rules.length).toBeGreaterThan(50);
    // every prefix the three components and the host ship, present in what is scanned
    const sels = rules.map((r) => r.selector).join(" ");
    for (const p of [".nav", ".progview", ".progbar", ".weekcard", ".tracker", ".app--nav"])
      expect(sels).toContain(p);
  });

  test("not one declaration resolves to a hued colour, in EITHER theme", () => {
    expect(huedDeclarations()).toEqual([]);
  });

  test("POSITIVE CONTROL: the scanner does catch a hue, through a token, in each theme", () => {
    // Without this the clause above passes on a scanner that resolves nothing.
    for (const [i, theme] of tokenThemes().entries()) {
      expect(hues(`.x { color: var(--accent); }`, [theme]).length).toBe(1);
      expect(hues(`.x { color: var(--danger); }`, [theme]).length).toBe(1);
      expect(hues(`.x { color: var(--ink); }`, [theme])).toEqual([]);
      expect(i).toBeLessThan(2);
    }
    expect(hues(`.x { color: #b3261e; }`, tokenThemes()).length).toBe(1);
  });

  test("«never accent on a position surface» — no error, grade or status token, anywhere", () => {
    // The repo spells the sub-issue's `--destructive` as `--danger` (tokens.css:26); both
    // spellings are refused so a rename cannot quietly reopen the door. The product never
    // grades: behind is not a failure and ahead is not a reward.
    for (const rule of sliceRules()) {
      for (const [, prop, value] of rule.body.matchAll(/([\w-]+)\s*:\s*([^;]+)/g)) {
        expect({ [`${rule.selector} { ${prop} }`]: value!.trim() }).toEqual({
          [`${rule.selector} { ${prop} }`]: expect.not.stringMatching(
            /--(destructive|danger|accent|warn|success|error)/,
          ) as unknown as string,
        });
      }
    }
  });

  test("and no component names a colour of its own — the stylesheet is the only place", () => {
    for (const f of [
      "src/components/Nav.tsx",
      "src/components/ProgrammeBar.tsx",
      "src/components/WeekCard.tsx",
      "src/components/Tracker.tsx",
    ]) {
      const code = readCode(f);
      for (const token of ["--danger", "--destructive", "--accent", "--warn", "#"])
        expect({ [f]: code.includes(token) }).toEqual({ [f]: false });
      expect({ [f]: /\b(color|background)\s*:/.test(code) }).toEqual({ [f]: false });
    }
  });

  test("no red/green classname on any band, tag, segment or status", async () => {
    await bothScreens({
      markedWeek: 8,
      rev: 3,
      entries: [{ week: 5, status: "skipped" }, { week: 3, status: "done" }],
    });
    const ours = ourElements();
    expect(ours.length).toBeGreaterThan(100);
    for (const el of ours)
      expect({ [el.className]: /danger|destructive|success|error|warn|red|green|accent/i.test(el.className) }).toEqual(
        { [el.className]: false },
      );
  });
});

// ══ 8 · THE TWO OPEN ITEMS fe-5 HANDED ON, JUDGED AND PINNED ══════════════════════

describe("the decisions fe-5 measured and left", () => {
  /**
   * **The reload symptom does not reproduce, so there is nothing to fix.**
   *
   * fe-5 handed this on as «a hard reload beats the scroll-to-marked», with
   * `history.scrollRestoration = "manual"` as the one-line fix they declined because it is
   * global and would cost a teacher their place in a long exam sheet on «الرئيسية».
   *
   * Re-measured live at fe-6 (lane s9, real class at week 22, band open, Chrome), and the
   * effect WINS — twice, from both directions:
   *
   *     parked at scrollTop 300  → reload → landed at 2865   (the effect's target)
   *     parked at scrollTop 4081 → reload → landed at 2865   (the effect's target)
   *
   * The reason is structural rather than lucky: **the scroller is `.workspace`, not the
   * document** (`overflow-y: auto`, slice 1). The browser can only restore an element's
   * scroll offset if that element is scrollable when restoration runs — and at that moment
   * the tracker is a waiting line, because its 27 bands do not exist until the programme
   * read resolves. There is no height to restore into, the restore is a no-op, and the
   * mount effect then runs against a laid-out page.
   *
   * So the decision is not «accept the browser's answer» but «the question was already
   * answered by the layout»: taking over `scrollRestoration` would buy nothing here and
   * still cost the builder its place. It stays untouched, and both halves of the reasoning
   * are pinned — the assignment must not appear, and the app's own scroll must stay
   * once-per-mount, because the day the tracker renders before its data the browser's
   * restore starts winning and this note stops being true.
   */
  test("the app never takes over the browser's scroll restoration", () => {
    for (const rel of srcFiles(/\.(ts|tsx)$/))
      expect({ [rel]: /scrollRestoration/.test(readSrc(rel)) }).toEqual({ [rel]: false });
  });

  test("the scroll-to-marked is still a MOUNT effect, and still the only scroll call", () => {
    // What the browser does on reload is the browser's; what the app does on mount is
    // pinned here, because the reasoning above only holds while the app's own scroll is
    // once-per-mount. A scroll on every position change would make «تمّ ✓» yank the page.
    const code = readCode("src/components/Tracker.tsx");
    expect((code.match(/scrollIntoView/g) ?? []).length).toBe(1);
    // and no OTHER file of this slice scrolls anything. `RefinePanel.tsx` does — it
    // scrolls a teacher to the exercise they are refining — and that is slice-1
    // behaviour on the builder, outside this Delta and none of this rule's business.
    for (const rel of SLICE_FILES) {
      if (rel.endsWith("Tracker.tsx") || rel.endsWith(".css")) continue;
      expect({ [rel]: /scrollIntoView|scrollTo\(/.test(readCode(rel)) }).toEqual({ [rel]: false });
    }
  });

  /**
   * **The band was the one screen in this app that a narrow viewport broke.**
   *
   * Measured live at fe-6 on the real maths document — the ministry's content track by
   * viewport width: 1280 → 370 px · 820 → 322 px · 700 → 202 px · 560 → 62 px · **414 → 0
   * px**, with «مجموع الأسبوع» printed on top of «7 ساعة» in every collapsed band. The
   * band's `4.5rem` and `3.5rem` tracks never shrink, so below ~465 px the `1fr` content
   * track is squeezed out of existence — and nothing overflows, so there is not even a
   * sideways scroll to reach it. The ministry's words simply stop being on the screen.
   *
   * The calibration that made it a defect rather than a limitation: **the builder reads
   * perfectly at 414 px.** Slice 1 already ships `@media (max-width: 900px)`, so this app
   * claims narrow support and every other screen honours it. The tracker was below its own
   * product's standard, and it is the only five-track grid in it.
   *
   * Fixed by APPEND inside fe-5's registered path — no existing rule edited — at the
   * handoff's own 820 px, which is above the damage rather than at it.
   */
  test("the tracker band collapses to one column below the handoff's breakpoint", () => {
    const css = readSrc("src/App.css");
    const at = css.indexOf(SLICE2_MARKER);
    expect(at).toBeGreaterThan(0);
    const region = css.slice(at);
    const media = [...region.matchAll(/@media[^{]*\(max-width:\s*(\d+)px\)/g)].map((m) =>
      Number(m[1]),
    );
    expect(media.length).toBeGreaterThan(0);
    expect(Math.max(...media)).toBeGreaterThanOrEqual(820);

    const block = region.slice(region.indexOf("@media (max-width: 820px)"));
    expect(block.startsWith("@media")).toBe(true);
    // ONE column for the band, and for its notice variant too — that variant re-declares
    // five tracks of its own, so a fix that forgot it would keep the broken layout on the
    // one band that has something to say.
    expect(block).toMatch(/\.tracker__band[\s\S]{0,200}grid-template-columns:\s*minmax\(0,\s*1fr\)/);
    expect(block).toContain(".tracker__band:has(.tracker__notice)");
    // AND the sub-grid's MEANING has to survive the switch: with one band track there is
    // nothing left for `subgrid` to inherit, so `.tracker__rows` must take two tracks of
    // its own — otherwise `display: contents` rows lose the column their hours stack in,
    // and «the rows sum to the week» stops being visible at exactly the width where the
    // teacher has least room to check it.
    expect(block).toMatch(/\.tracker__rows\s*\{[^}]*grid-column:\s*1\s*;/);
    expect(block).toMatch(/\.tracker__rows\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+3\.5rem/);
  });
});

// ══ the scanners ══════════════════════════════════════════════════════════════════

const SLICE2_MARKER = "/* ---- the programme surface (slice 2) ----";

/**
 * How many KaTeX islands the tracker MUST draw for a document, derived from the document.
 *
 * `Statement` splits on lines first and pairs `$` within a line, so the count is per line
 * and not per string — the same arithmetic the renderer does, written once. Guidance
 * strings are joined with a newline before they are handed over, which is why each of them
 * is its own line. The unit heading on every band goes through the same channel and is
 * counted once per BAND, not once per unit: units repeat, and the tracker draws 27 bands.
 */
function expectedIslands(p: Programme): number {
  const pairs = (s: string) =>
    s.split(/\r?\n/).reduce((n, line) => n + Math.floor((line.match(/\$/g)?.length ?? 0) / 2), 0);
  let total = 0;
  for (const w of p.weeks) {
    total += pairs(p.units.find((u) => u.id === w.unitId)?.name ?? "");
    for (const r of w.rows) {
      for (const s of [...r.competencies, ...r.contents]) total += pairs(s);
      if (r.guidance.length > 0) total += pairs(r.guidance.join("\n"));
    }
  }
  return total;
}

/** Both `:root` blocks of `tokens.css` — light, then the dark-scheme override. */
function tokenThemes(): Record<string, string>[] {
  const css = readSrc("src/styles/tokens.css");
  const themes = [...css.matchAll(/:root\s*\{([^}]*)\}/g)].map((block) => {
    const map: Record<string, string> = {};
    for (const [, name, value] of block[1]!.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
      map[name!] = value!.trim();
    }
    return map;
  });
  // A one-theme scan would silently stop covering dark — the theme where three of this
  // palette's "soft" tokens cross the saturation line.
  expect(themes.length).toBe(2);
  return themes;
}

/** HSV saturation of a `#rrggbb` — how much hue a colour actually carries. */
function saturation(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
  const max = Math.max(r!, g!, b!);
  if (max === 0) return 0;
  return (max - Math.min(r!, g!, b!)) / max;
}

/** Every rule AFTER the slice-2 marker — the whole of what this slice added. */
function sliceRules(): { selector: string; body: string }[] {
  const css = readSrc("src/App.css");
  const at = css.indexOf(SLICE2_MARKER);
  expect(at).toBeGreaterThan(0);
  const region = css.slice(at).replace(/\/\*[\s\S]*?\*\//g, "");
  return [...region.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .map((m) => ({ selector: m[1]!.trim().replace(/\s+/g, " "), body: m[2]! }))
    .filter((r) => r.selector.includes("."));
}

/** Hued declarations in an arbitrary stylesheet, resolved against given themes. */
function hues(css: string, themes: Record<string, string>[]): string[] {
  const out: string[] = [];
  for (const [, selector, body] of css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(
    /([^{}]+)\{([^{}]*)\}/g,
  )) {
    for (const [, prop, value] of body!.matchAll(/([\w-]+)\s*:\s*([^;]+)/g)) {
      const literal = [...value!.matchAll(/#[0-9a-fA-F]{6}/g)].map((m) => m[0]!);
      const viaToken = [...value!.matchAll(/var\((--[\w-]+)\)/g)].flatMap(([, name]) =>
        themes
          .map((t) => t[name!])
          .filter((v): v is string => typeof v === "string" && v.startsWith("#")),
      );
      for (const hex of [...literal, ...viaToken])
        if (saturation(hex) >= 0.3) out.push(`${selector!.trim()} { ${prop}: ${hex} }`);
    }
  }
  return out;
}

function huedDeclarations(): string[] {
  const themes = tokenThemes();
  return sliceRules().flatMap((r) => hues(`${r.selector}{${r.body}}`, themes));
}
