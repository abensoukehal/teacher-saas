/**
 * fe-5 — the shell learns views: the nav row, the hash mirror, and the wiring.
 *
 * THE INTEGRATION NET. fe-2, fe-3 and fe-4 pin three components in isolation against
 * hand-built props; this one renders `@/App` with a mocked `fetch` and asks whether the
 * app a teacher actually uses puts them on screen, feeds them real reads, and sends the
 * writes the contract specifies. Nothing here mounts a component directly.
 *
 * The clauses that exist because a plausible integration gets them wrong:
 *
 *   - **a teacher with no classes must not notice this slice at all.** Every teacher who
 *     predates it has none, and slice 1 pinned their shell byte-identical to the
 *     pre-slice recording. A nav row that renders for them, a grid modifier that
 *     reserves a track, or one programme GET fired "to warm the cache" is a visible
 *     change shipped to all of them (contract §8.7).
 *   - **the view must FOLLOW the hash, not merely write it.** Writing on change and
 *     reading once at mount leaves Back changing the URL while the screen stands still —
 *     an address bar stating a view the app is not showing, and a refresh that then
 *     jumps somewhere the teacher never asked for (contract §0, amended at seal).
 *   - **the 409 re-read is the host's**, and fe-4 flagged it in writing: the tracker
 *     shows the fresh state it is GIVEN, so a conflict branch that skips `getProgress`
 *     leaves the band re-asking against a position that never moved — invisible to
 *     fe-4's own oracle, and therefore pinned here.
 *   - **`#/admin` keeps its early return.** It sits BEFORE the shell and has no class
 *     bar on purpose; a view mechanism that moved it inside would put the operator's
 *     console behind a teacher's class switcher.
 *   - **the CSS is fe-5's, so the absences of three components are fe-5's too.** fe-2 and
 *     fe-3 shipped scanners that read `src/App.css` and classify by measured saturation
 *     in both themes. fe-4's journal says the same is aimed at `.tracker__*`; it is not —
 *     that scanner is here.
 */
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import App from "@/App";
import type { ClassRef } from "@/lib/classes";
import type { Programme } from "@/lib/programme";
import { MATH, THIRTY_WEEKS } from "./programme-fixtures";

const TID = "0123456789abcdef0123456789abcdef";
const C1 = "6a7a7a365877e8523b8b023c";
const C2 = "6a7a7a575877e8523b8b023d";

/** `GET /api/classes`, createdAt ASCENDING — slice 1's recorded order. */
const TWO_CLASSES: ClassRef[] = [
  { id: C1, name: "3ر1", stream: "شعبة الرياضيات", createdAt: "2026-08-11T01:26:14.969Z" },
  { id: C2, name: "3ع2", stream: "علوم تجريبية", createdAt: "2026-08-11T01:26:47.159Z" },
];

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

const norm = (s: string) => (s ?? "").replace(/\s+/g, " ").trim();
const text = (el: Element | null) => norm(el?.textContent ?? "");

interface ProgressState {
  markedWeek: number;
  rev: number;
  entries: { week: number; status: string; note?: string; completedAt?: string }[];
}

/**
 * `GET /api/progress/:classId` — ONE key set, stored or synthesized (slice 1 §4).
 * The `programme` sub-object is the PICKER'S BOUND and rides only on the read; the
 * PUT's 200 deliberately carries none (contract §5).
 */
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
  /** classId → the position that class's GET answers with. Absent = week 0. */
  positions?: Record<string, ProgressState>;
  /** classId → the programme its route answers with. Absent = `THIRTY_WEEKS`. */
  programmes?: Record<string, Programme>;
  totalWeeks?: number;
  /** Answer the NEXT PUT with `409 conflict`, once. */
  conflictOnce?: boolean;
  /** Answer every programme GET with this status instead. */
  programmeFail?: number;
}

/**
 * A fetch mock over every surface this slice can touch, recording each call.
 *
 * It is STATEFUL for progress on purpose: a PUT advances the stored position, so a
 * re-read after a write answers what `be` would answer, and «تمّ ✓» can be asserted
 * end to end rather than at the request line only.
 */
function mockApi(opts: ApiOptions = {}) {
  const calls: { method: string; url: string; body: unknown }[] = [];
  const positions: Record<string, ProgressState> = {
    ...Object.fromEntries((opts.classes ?? []).map((c) => [c.id, { markedWeek: 0, rev: 0, entries: [] }])),
    ...(opts.positions ?? {}),
  };
  let conflictLeft = opts.conflictOnce ? 1 : 0;
  const bound = opts.totalWeeks ?? THIRTY_WEEKS.totals.weeks;

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
    if (prog && method === "GET") {
      if (opts.programmeFail)
        return res(opts.programmeFail, {
          error: { message: "المتجر غير متاح مؤقتًا.", type: "store_unavailable" },
          correlationId: "cid-prog-fail",
        });
      const id = decodeURIComponent(prog[1]!);
      return res(200, {
        programme: opts.programmes?.[id] ?? THIRTY_WEEKS,
        correlationId: "cid-programme",
      });
    }

    const pr = /^\/api\/progress\/([^?]+)$/.exec(url);
    if (pr) {
      const id = decodeURIComponent(pr[1]!);
      const held = positions[id] ?? { markedWeek: 0, rev: 0, entries: [] };
      if (method === "GET") return res(200, progressBody(id, held, bound));
      if (method === "PUT") {
        if (conflictLeft > 0) {
          conflictLeft -= 1;
          // `be` moves the position in the OTHER tab — the loser must see it after
          // the re-read, which is the whole point of the clause below.
          positions[id] = { ...held, markedWeek: held.markedWeek + 3, rev: held.rev + 1 };
          return res(409, {
            error: { message: "تغيّر تقدّم القسم أثناء الحفظ.", type: "conflict" },
            correlationId: "cid-409",
          });
        }
        const entries = [...held.entries];
        if (body?.entry) {
          const i = entries.findIndex((e) => e.week === body.entry.week);
          const stamped =
            body.entry.status === "done"
              ? { ...body.entry, completedAt: "2026-08-11T02:00:00.000Z" }
              : { ...body.entry };
          if (i >= 0) entries[i] = stamped;
          else entries.push(stamped);
        }
        const next = { markedWeek: body.markedWeek, rev: held.rev + 1, entries };
        positions[id] = next;
        // No `programme` on a write's 200 — the ceiling belongs to the read.
        return res(200, {
          progress: progressBody(id, next, bound).progress,
          correlationId: "cid-put",
        });
      }
    }

    if (url.startsWith("/api/admin/")) {
      if (url.endsWith("/kpis"))
        return res(200, {
          totalExams: 0,
          totalTeachers: 0,
          avgCostUsdPerExam: 0,
          avgDurationMsPerExam: 0,
          avgExamsPerTeacher: 0,
          examsWithKpis: 0,
        });
      if (url.endsWith("/teachers")) return res(200, { teachers: [] });
      if (url.endsWith("/exams")) return res(200, { exams: [] });
    }

    return res(404, { error: { message: "غير موجود", type: "not_found" } });
  });
  vi.stubGlobal("fetch", fetchMock);

  return {
    calls,
    urls: () => calls.map((c) => c.url),
    programmeGets: (classId?: string) =>
      calls.filter(
        (c) =>
          /^\/api\/classes\/[^/]+\/programme$/.test(c.url) &&
          (classId === undefined || c.url.includes(classId)),
      ),
    progressGets: (classId?: string) =>
      calls.filter(
        (c) =>
          c.method === "GET" &&
          c.url.startsWith("/api/progress/") &&
          (classId === undefined || c.url.includes(classId)),
      ),
    puts: () => calls.filter((c) => c.method === "PUT" && c.url.startsWith("/api/progress/")),
    position: (id: string) => positions[id],
  };
}

/** A signed-in teacher, optionally standing in a class already. */
function session(classId?: string) {
  localStorage.setItem("teacher.id.v1", JSON.stringify(TID));
  if (classId) localStorage.setItem("teacher.class.v1", JSON.stringify(classId));
}

async function boot() {
  await act(async () => {
    render(<App />);
  });
}

const shell = () => document.querySelector<HTMLElement>(".app");
const nav = () => document.querySelector<HTMLElement>("nav.nav");
const navItems = () => [...document.querySelectorAll<HTMLElement>(".nav__item")];
const navLabels = () => navItems().map((b) => norm(b.textContent ?? ""));
const navItem = (label: string) => navItems().find((b) => norm(b.textContent ?? "") === label);
const tabs = () => [...document.querySelectorAll<HTMLElement>("[data-class-id]")];
const tracker = () => document.querySelector<HTMLElement>(".tracker");
const weekcard = () => document.querySelector<HTMLElement>(".weekcard");
const band = (week: number) => document.querySelector<HTMLElement>(`[data-week="${week}"]`);
const inBand = (week: number, sel: string) => band(week)?.querySelector<HTMLElement>(sel) ?? null;
const buttonIn = (root: Element | null, label: string) =>
  [...(root?.querySelectorAll<HTMLElement>("button") ?? [])].find(
    (b) => norm(b.textContent ?? "") === label,
  ) ?? null;

async function click(el: Element | null | undefined) {
  if (!el) throw new Error("nothing to click");
  await act(async () => {
    fireEvent.click(el);
  });
}

/** Go to a view the way a teacher does — through the nav. */
const goto = (label: string) => click(navItem(label));

beforeEach(() => {
  localStorage.clear();
  window.location.hash = "";
  vi.unstubAllGlobals();
  vi.resetModules();
  // jsdom has no layout; the tracker's mount scroll is optional-called, and this makes
  // the call observable rather than merely harmless.
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  cleanup();
  window.location.hash = "";
  localStorage.clear();
});

// ══ 1 · THE NAV ROW ═══════════════════════════════════════════════════════════════

describe("the nav row — four items, and two that are absent rather than greyed", () => {
  test("a teacher with a class selected gets exactly four items, in Arabic", async () => {
    session(C1);
    mockApi({ classes: TWO_CLASSES });
    await boot();

    await waitFor(() => expect(nav()).toBeTruthy());
    expect(navLabels()).toEqual(["الرئيسية", "هذا الأسبوع", "البرنامج", "الحساب"]);
    // It is a landmark, not a row of loose buttons: a teacher on a screen reader has to
    // be able to find the way between three screens.
    expect(nav()!.getAttribute("aria-label")).toBeTruthy();
  });

  test("«إعداد موضوع» and «مكتبتي» appear NOWHERE — not disabled, not greyed, absent", async () => {
    // SEED, locked: a greyed item is a promise with a date on it. Slices 3 and 5 own
    // those screens, and a teacher must not be able to tell they were considered.
    session(C1);
    mockApi({ classes: TWO_CLASSES });
    await boot();

    await waitFor(() => expect(nav()).toBeTruthy());
    const whole = text(document.body);
    expect(whole).not.toContain("إعداد موضوع");
    expect(whole).not.toContain("مكتبتي");
    // and no disabled item is hiding one of them under different copy
    for (const item of navItems()) expect((item as HTMLButtonElement).disabled).toBe(false);
    expect(document.querySelectorAll(".nav__item[aria-disabled]")).toHaveLength(0);
  });

  test("classes but NO selection: only «الرئيسية» and «الحساب» are offered", async () => {
    // Both new screens are per-class. Offering them with nothing selected would make the
    // nav a way to reach a screen with no subject; auto-selecting a class to fill the
    // gap would break fe-2's frozen slice-1 clause (a teacher who has chosen none issues
    // the param-less list request).
    session();
    const h = mockApi({ classes: TWO_CLASSES });
    await boot();

    await waitFor(() => expect(nav()).toBeTruthy());
    expect(navLabels()).toEqual(["الرئيسية", "الحساب"]);
    expect(tabs().some((t) => t.getAttribute("aria-pressed") === "true")).toBe(false);
    for (const url of h.urls()) expect(url).not.toContain("classId");
  });

  test("the nav is a grid ROW of the shell, between the class bar and the sidebar", async () => {
    // A row, never a column: `.app`'s two columns carry a load-bearing RTL warning —
    // in RTL the first track is the RIGHTMOST, so a third column mirrors the app. And
    // it sits in the shell rather than inside the workspace, or it would scroll away
    // from the teacher on a nine-screen page.
    session(C1);
    mockApi({ classes: TWO_CLASSES });
    await boot();
    await waitFor(() => expect(nav()).toBeTruthy());

    expect(shell()!.className).toBe("app app--classes app--nav");
    expect([...shell()!.children].map((c) => c.className.split(" ")[0])).toEqual([
      "classbar",
      "nav",
      "sidebar",
      "workspace",
    ]);
    // …and the stylesheet gives that fourth modifier its own track
    expect(declaresFor(readSrc("src/App.css"), ".app--nav", /grid-template-rows/)).toBe(true);
  });

  test("selecting a class in the bar makes the two class views appear", async () => {
    session();
    mockApi({ classes: TWO_CLASSES });
    await boot();
    await waitFor(() => expect(nav()).toBeTruthy());

    await click(tabs()[0]);
    expect(navLabels()).toEqual(["الرئيسية", "هذا الأسبوع", "البرنامج", "الحساب"]);
  });
});

// ══ 2 · ZERO CLASSES — the regression that would reach every existing teacher ══════

describe("a teacher with ZERO classes sees today's app, byte for byte", () => {
  test("no nav, no modifier, no programme fetch — and the shell's children are unchanged", async () => {
    session();
    const h = mockApi({ classes: [] });
    await boot();

    await waitFor(() => expect(h.urls()).toContain("/api/classes"));

    expect(nav()).toBeNull();
    expect(document.querySelectorAll("nav")).toHaveLength(0);
    // slice 1's recorded shape, unweakened: the class list is the ONLY thing that may
    // add a row, and it added none.
    expect(shell()!.className).toBe("app");
    expect([...shell()!.children].map((c) => c.className.split(" ")[0])).toEqual([
      "sidebar",
      "workspace",
    ]);
    expect(h.programmeGets()).toHaveLength(0);
    expect(weekcard()).toBeNull();
    expect(tracker()).toBeNull();
  });

  test("a deep link they never asked for cannot move them off the builder", async () => {
    // A shared URL, a stale bookmark, a second teacher on the same browser. With no
    // classes there is no class to render a per-class screen for, and the honest answer
    // is the app they already have — never an error, never an empty tracker.
    window.location.hash = "#/programme";
    session();
    const h = mockApi({ classes: [] });
    await boot();

    await waitFor(() => expect(h.urls()).toContain("/api/classes"));
    expect(shell()!.className).toBe("app");
    expect(tracker()).toBeNull();
    expect(nav()).toBeNull();
    expect(h.programmeGets()).toHaveLength(0);
    expect(document.querySelector(".empty")).toBeTruthy(); // the builder's own empty state
  });

  test("the request set on boot carries nothing this slice added", async () => {
    session();
    const h = mockApi({ classes: [] });
    await boot();
    await waitFor(() => expect(h.urls()).toContain("/api/classes"));

    for (const url of h.urls()) expect(url).not.toContain("/programme");
    expect(h.puts()).toHaveLength(0);
  });
});

// ══ 3 · THE VIEWS, AND THE HASH THEY MIRROR ═══════════════════════════════════════

describe("switching view moves the screen and the address bar together", () => {
  test("«البرنامج» mounts the tracker on the fetched programme and writes #/programme", async () => {
    session(C1);
    const h = mockApi({ classes: TWO_CLASSES, positions: { [C1]: { markedWeek: 8, rev: 3, entries: [] } } });
    await boot();
    await waitFor(() => expect(nav()).toBeTruthy());

    await goto("البرنامج");
    await waitFor(() => expect(tracker()).toBeTruthy());

    expect(window.location.hash).toBe("#/programme");
    expect(h.programmeGets(C1)).toHaveLength(1);
    // the fetched document, not an invented one: 30 bands, from the fixture's own weeks
    expect(document.querySelectorAll(".tracker__band")).toHaveLength(THIRTY_WEEKS.weeks.length);
    expect(text(band(8))).toContain("الأسبوع الحالي");
    // and the bar the tracker hosts drew a segment per unit RUN of that document
    expect(document.querySelectorAll(".progbar__seg")).toHaveLength(5);
  });

  test("«هذا الأسبوع» mounts the week card and writes #/week", async () => {
    session(C1);
    mockApi({ classes: TWO_CLASSES, positions: { [C1]: { markedWeek: 8, rev: 3, entries: [] } } });
    await boot();
    await waitFor(() => expect(nav()).toBeTruthy());

    await goto("هذا الأسبوع");
    await waitFor(() => expect(weekcard()).toBeTruthy());

    expect(window.location.hash).toBe("#/week");
    // «الأسبوع 8 من 30» — both numbers from the wire, neither from a constant
    expect(text(document.querySelector(".weekcard__eyebrow"))).toContain("الأسبوع 8 من 30");
  });

  test("«الرئيسية» clears the hash and the builder is byte-identical to today's workspace", async () => {
    session(C1);
    mockApi({ classes: TWO_CLASSES, positions: { [C1]: { markedWeek: 8, rev: 3, entries: [] } } });
    await boot();
    await waitFor(() => expect(nav()).toBeTruthy());

    const before = document.querySelector(".workspace")!.innerHTML;

    await goto("البرنامج");
    await waitFor(() => expect(tracker()).toBeTruthy());
    await goto("الرئيسية");

    expect(window.location.hash).toBe("");
    expect(tracker()).toBeNull();
    expect(weekcard()).toBeNull();
    // The default view IS the app as it was — not a rebuilt approximation of it.
    expect(document.querySelector(".workspace")!.innerHTML).toBe(before);
  });

  test("the current view is marked, and exactly one is", async () => {
    session(C1);
    mockApi({ classes: TWO_CLASSES });
    await boot();
    await waitFor(() => expect(nav()).toBeTruthy());

    const current = () =>
      navItems().filter((b) => b.getAttribute("aria-current") === "page").map((b) => norm(b.textContent ?? ""));
    expect(current()).toEqual(["الرئيسية"]);
    await goto("البرنامج");
    expect(current()).toEqual(["البرنامج"]);
    await goto("هذا الأسبوع");
    expect(current()).toEqual(["هذا الأسبوع"]);
    // «الحساب» is an overlay, not a view — it can never be the current page
    expect(navItem("الحساب")!.getAttribute("aria-current")).toBeNull();
  });
});

describe("the hash drives the view — deep links, refresh, and Back", () => {
  test("mounting on #/week with a restored selection lands on the week card", async () => {
    window.location.hash = "#/week";
    session(C1);
    mockApi({ classes: TWO_CLASSES, positions: { [C1]: { markedWeek: 4, rev: 2, entries: [] } } });
    await boot();

    await waitFor(() => expect(weekcard()).toBeTruthy());
    expect(text(document.querySelector(".weekcard__eyebrow"))).toContain("الأسبوع 4 من 30");
  });

  test("mounting on #/programme with NO selection asks for a class — never an error", async () => {
    window.location.hash = "#/programme";
    session();
    const h = mockApi({ classes: TWO_CLASSES });
    await boot();

    await waitFor(() => expect(nav()).toBeTruthy());
    const chooser = document.querySelector(".progview__choose");
    expect(chooser).toBeTruthy();
    expect(text(chooser)).toContain("اختر قسمًا");
    // an error state would be a lie: nothing failed, the teacher simply has not picked
    expect(document.querySelector(".alert")).toBeNull();
    expect(document.querySelector(".progview__error")).toBeNull();
    expect(h.programmeGets()).toHaveLength(0);
    // …and picking one in the bar resolves it in place, on the SAME view
    await click(tabs()[0]);
    await waitFor(() => expect(tracker()).toBeTruthy());
    expect(window.location.hash).toBe("#/programme");
  });

  test("Back moves the screen, because the view follows `hashchange`", async () => {
    // The contract's seal amendment. Read-only-at-mount leaves the address bar stating a
    // view the app is not showing — worse than not mirroring at all, because the next
    // refresh then jumps the teacher somewhere they did not ask to be.
    session(C1);
    mockApi({ classes: TWO_CLASSES, positions: { [C1]: { markedWeek: 8, rev: 3, entries: [] } } });
    await boot();
    await waitFor(() => expect(nav()).toBeTruthy());

    await goto("البرنامج");
    await waitFor(() => expect(tracker()).toBeTruthy());

    // what the browser does on Back: the hash changes under the app, nothing else
    await act(async () => {
      window.location.hash = "";
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(tracker()).toBeNull();
    expect(document.querySelector(".empty")).toBeTruthy();

    // …and Forward, the same way
    await act(async () => {
      window.location.hash = "#/week";
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    await waitFor(() => expect(weekcard()).toBeTruthy());
  });

  test("an unknown hash is the builder, not a blank screen", async () => {
    window.location.hash = "#/nope";
    session(C1);
    mockApi({ classes: TWO_CLASSES });
    await boot();

    await waitFor(() => expect(nav()).toBeTruthy());
    expect(document.querySelector(".empty")).toBeTruthy();
    expect(tracker()).toBeNull();
  });
});

// ══ 4 · #/admin — THE FROZEN DECISION ═════════════════════════════════════════════

describe("the console still returns before the shell", () => {
  test("#/admin renders the console with NO nav and NO class bar", async () => {
    window.location.hash = "#/admin";
    session(C1);
    mockApi({ classes: TWO_CLASSES });
    await boot();

    await waitFor(() => expect(document.querySelector(".admin")).toBeTruthy());
    expect(nav()).toBeNull();
    expect(document.querySelector(".classbar")).toBeNull();
    expect(shell()).toBeNull(); // the early return never reaches `.app`
    expect(tracker()).toBeNull();
  });
});

// ══ 5 · «الحساب» — one handler, and the sidebar button untouched ══════════════════

describe("the account item opens the overlay the sidebar button already opens", () => {
  test("it opens the same panel, and the sidebar's own button still does", async () => {
    session(C1);
    mockApi({ classes: TWO_CLASSES });
    await boot();
    await waitFor(() => expect(nav()).toBeTruthy());

    const sidebarAccount = buttonIn(document.querySelector(".sidebar"), "الحساب");
    expect(sidebarAccount).toBeTruthy(); // NOT moved into the nav — it stays where it was

    await goto("الحساب");
    await waitFor(() => expect(document.querySelector(".auth")).toBeTruthy());
    // the overlay replaces the shell, exactly as it does from the sidebar
    expect(shell()).toBeNull();
  });

  test("the sidebar button opens the identical surface", async () => {
    session(C1);
    mockApi({ classes: TWO_CLASSES });
    await boot();
    await waitFor(() => expect(nav()).toBeTruthy());

    await click(buttonIn(document.querySelector(".sidebar"), "الحساب"));
    await waitFor(() => expect(document.querySelector(".auth")).toBeTruthy());
  });
});

// ══ 6 · THE PROGRAMME READ — once per class, cached, never on the write path ══════

describe("one programme GET per class per session", () => {
  test("switching views does not re-read it; a second class reads its own", async () => {
    session(C1);
    const h = mockApi({
      classes: TWO_CLASSES,
      positions: { [C1]: { markedWeek: 8, rev: 3, entries: [] }, [C2]: { markedWeek: 2, rev: 1, entries: [] } },
      programmes: { [C1]: THIRTY_WEEKS, [C2]: THIRTY_WEEKS },
    });
    await boot();
    await waitFor(() => expect(nav()).toBeTruthy());

    await goto("البرنامج");
    await waitFor(() => expect(tracker()).toBeTruthy());
    await goto("هذا الأسبوع");
    await waitFor(() => expect(weekcard()).toBeTruthy());
    await goto("البرنامج");
    await waitFor(() => expect(tracker()).toBeTruthy());
    expect(h.programmeGets(C1)).toHaveLength(1);

    await click(tabs()[1]);
    await waitFor(() => expect(h.programmeGets(C2)).toHaveLength(1));
    expect(h.programmeGets(C1)).toHaveLength(1);
    expect(h.programmeGets()).toHaveLength(2);
  });

  test("the BUILDER asks for no programme at all, selected class or not", async () => {
    // A document is read because a teacher opened a screen that shows it, never on the
    // off-chance. Warming the cache here would put a 38 KB read on the boot path of the
    // one view that has nothing to do with it.
    session(C1);
    const h = mockApi({ classes: TWO_CLASSES, positions: { [C1]: { markedWeek: 8, rev: 3, entries: [] } } });
    await boot();
    await waitFor(() => expect(nav()).toBeTruthy());
    await waitFor(() => expect(h.progressGets(C1).length).toBeGreaterThan(0));

    expect(h.programmeGets()).toHaveLength(0);
    await goto("البرنامج");
    await waitFor(() => expect(h.programmeGets(C1)).toHaveLength(1));
  });

  test("a class SWITCH keeps the view — and slice 1's context clears still fire", async () => {
    // Contract §0. The switch handler is a host of this change (perimeter, WF-69): the
    // slice-1 clear set must be exactly what it was, and `pendingSave` must survive —
    // it is an unsaved exam, and it belongs to the teacher, not to the classroom.
    session(C1);
    localStorage.setItem(
      "teacher.pending.v1",
      JSON.stringify({ subject: { title: "س", meta: {}, exercises: [] }, controls: null }),
    );
    mockApi({
      classes: TWO_CLASSES,
      positions: { [C1]: { markedWeek: 8, rev: 3, entries: [] }, [C2]: { markedWeek: 2, rev: 1, entries: [] } },
    });
    await boot();
    await waitFor(() => expect(nav()).toBeTruthy());

    await goto("البرنامج");
    await waitFor(() => expect(tracker()).toBeTruthy());

    await click(tabs()[1]);
    await waitFor(() => expect(text(band(2))).toContain("الأسبوع الحالي"));
    expect(window.location.hash).toBe("#/programme");
    expect(tracker()).toBeTruthy();
    expect(localStorage.getItem("teacher.pending.v1")).toBeTruthy();
    expect(JSON.parse(localStorage.getItem("teacher.class.v1")!)).toBe(C2);
  });

  test("the tracker is remounted per class — the new class's own week is scrolled to", async () => {
    // fe-4's scroll is a MOUNT effect, deliberately. Without a key the component
    // survives the switch and never lands on the second class's position.
    session(C1);
    mockApi({
      classes: TWO_CLASSES,
      positions: { [C1]: { markedWeek: 8, rev: 3, entries: [] }, [C2]: { markedWeek: 21, rev: 1, entries: [] } },
    });
    await boot();
    await waitFor(() => expect(nav()).toBeTruthy());
    await goto("البرنامج");
    await waitFor(() => expect(tracker()).toBeTruthy());

    const scroll = Element.prototype.scrollIntoView as unknown as ReturnType<typeof vi.fn>;
    scroll.mockClear();
    await click(tabs()[1]);
    await waitFor(() => expect(text(band(21))).toContain("الأسبوع الحالي"));
    expect(scroll).toHaveBeenCalled();
    // the second class mounts open on ITS week, not on the first class's
    expect(band(21)!.getAttribute("data-open")).toBe("true");
    expect(band(8)!.getAttribute("data-open")).toBe("false");
  });

  test("coming BACK to a class whose document is already cached still remounts it", async () => {
    // The sharper half of the same clause: with both documents held, nothing unmounts on
    // its own, so only the key makes the return a fresh visit. fe-4 left this as a host
    // decision and named the cost — a teacher who folded week 8 shut on one class would
    // find it folded on the next, and the marked week would never be scrolled to again.
    session(C1);
    mockApi({
      classes: TWO_CLASSES,
      positions: { [C1]: { markedWeek: 8, rev: 3, entries: [] }, [C2]: { markedWeek: 21, rev: 1, entries: [] } },
    });
    await boot();
    await waitFor(() => expect(nav()).toBeTruthy());
    await goto("البرنامج");
    await waitFor(() => expect(tracker()).toBeTruthy());

    // an explicit disclosure decision on THIS visit to THIS class
    await click(inBand(8, ".tracker__toggle"));
    expect(band(8)!.getAttribute("data-open")).toBe("false");

    await click(tabs()[1]);
    await waitFor(() => expect(text(band(21))).toContain("الأسبوع الحالي"));

    const scroll = Element.prototype.scrollIntoView as unknown as ReturnType<typeof vi.fn>;
    scroll.mockClear();
    await click(tabs()[0]); // its document is cached — nothing suspends the tracker
    await waitFor(() => expect(text(band(8))).toContain("الأسبوع الحالي"));
    expect(band(8)!.getAttribute("data-open")).toBe("true");
    expect(scroll).toHaveBeenCalled();
  });

  test("«حدّد أين وصلت» on an unpositioned class navigates to the tracker", async () => {
    session(C1);
    mockApi({ classes: TWO_CLASSES }); // week 0 — the invitation, not a week
    await boot();
    await waitFor(() => expect(nav()).toBeTruthy());
    await goto("هذا الأسبوع");
    await waitFor(() => expect(weekcard()).toBeTruthy());

    expect(text(weekcard())).toContain("أين وصل هذا القسم؟");
    await click(buttonIn(weekcard(), "حدّد أين وصلت"));

    await waitFor(() => expect(tracker()).toBeTruthy());
    expect(window.location.hash).toBe("#/programme");
  });

  test("at week 0 the week screen shows NO bar — the invitation stands alone", async () => {
    // Contract §4 as amended: «no pacing» is not «no bar», and the HOST decides. The
    // tracker draws the ministry's year; the week screen at week 0 asks the question
    // instead of drawing an empty track beside it.
    session(C1);
    mockApi({ classes: TWO_CLASSES });
    await boot();
    await waitFor(() => expect(nav()).toBeTruthy());
    await goto("هذا الأسبوع");
    await waitFor(() => expect(weekcard()).toBeTruthy());

    expect(document.querySelector(".progbar")).toBeNull();
    await goto("البرنامج");
    await waitFor(() => expect(tracker()).toBeTruthy());
    expect(document.querySelector(".progbar")).toBeTruthy();
    expect(document.querySelectorAll(".progbar__fill")).toHaveLength(0); // nothing to fill
  });

  test("a positioned week screen DOES carry the bar, and it is filled", async () => {
    session(C1);
    mockApi({ classes: TWO_CLASSES, positions: { [C1]: { markedWeek: 12, rev: 4, entries: [] } } });
    await boot();
    await waitFor(() => expect(nav()).toBeTruthy());
    await goto("هذا الأسبوع");
    await waitFor(() => expect(weekcard()).toBeTruthy());

    expect(document.querySelector(".progbar")).toBeTruthy();
    expect(document.querySelectorAll(".progbar__fill").length).toBeGreaterThan(0);
  });
});

describe("the programme read's own failure states", () => {
  test("a retryable failure says so in Arabic, at the surface that asked, and retries", async () => {
    session(C1);
    const h = mockApi({ classes: TWO_CLASSES, programmeFail: 503 });
    await boot();
    await waitFor(() => expect(nav()).toBeTruthy());
    await goto("البرنامج");

    await waitFor(() => expect(document.querySelector(".progview__error")).toBeTruthy());
    const box = document.querySelector(".progview__error")!;
    expect(text(box)).toMatch(/[؀-ۿ]/);
    expect(text(box)).not.toMatch(/[A-Za-z]/);
    expect(tracker()).toBeNull();
    // the failure is LOCAL: the exam surface's own alert is not borrowed for it
    expect(document.querySelector(".alert")).toBeNull();

    expect(h.programmeGets(C1)).toHaveLength(1);
    await click(buttonIn(box, "إعادة المحاولة"));
    await waitFor(() => expect(h.programmeGets(C1)).toHaveLength(2));
  });

  test("a class that failed is asked again on the next visit — never left waiting forever", async () => {
    // «asked» and «arrived» are different facts, and the cache guard keys on the first.
    // A class whose read failed must leave the asked set, or coming back to it shows a
    // waiting line for a request nobody is making — a screen that is not loading and
    // does not say so.
    session(C1);
    const h = mockApi({ classes: TWO_CLASSES, programmeFail: 503 });
    await boot();
    await waitFor(() => expect(nav()).toBeTruthy());
    await goto("البرنامج");
    await waitFor(() => expect(document.querySelector(".progview__error")).toBeTruthy());

    await click(tabs()[1]);
    await waitFor(() => expect(h.programmeGets(C2).length).toBe(1));
    await click(tabs()[0]);
    await waitFor(() => expect(h.programmeGets(C1).length).toBe(2));
  });
});

// ══ 7 · THE WRITE, END TO END ═════════════════════════════════════════════════════

describe("«تمّ ✓» in the mounted tracker — one PUT, and everything follows it", () => {
  test("the body is {rev, markedWeek: min(W+1,T), entry}, and band, bar and rail advance", async () => {
    session(C1);
    const h = mockApi({ classes: TWO_CLASSES, positions: { [C1]: { markedWeek: 8, rev: 3, entries: [] } } });
    await boot();
    await waitFor(() => expect(nav()).toBeTruthy());
    await goto("البرنامج");
    await waitFor(() => expect(tracker()).toBeTruthy());

    const railBefore = document.querySelector<HTMLElement>(".classtab--on .classtab__rail-fill")!.style.width;
    const fillsBefore = [...document.querySelectorAll<HTMLElement>(".progbar__fill")].map((f) => f.style.width);

    await click(buttonIn(inBand(8, ".tracker__acts"), "تمّ ✓"));

    await waitFor(() => expect(text(band(9))).toContain("الأسبوع الحالي"));
    expect(h.puts()).toHaveLength(1);
    expect(h.puts()[0]!.url).toBe(`/api/progress/${C1}`);
    // `rev` is the value from the LAST READ; `markedWeek` rides every PUT because an
    // entry-only write is a 400 (measured); done/skipped differ in one key only.
    expect(h.puts()[0]!.body).toEqual({
      rev: 3,
      markedWeek: 9,
      entry: { week: 8, status: "done" },
    });

    // the whole screen re-renders from the fresh position — band, bar and the class bar
    expect(text(band(8))).toContain("منجز");
    expect(band(9)!.getAttribute("data-open")).toBe("true");
    const fillsAfter = [...document.querySelectorAll<HTMLElement>(".progbar__fill")].map((f) => f.style.width);
    expect(fillsAfter).not.toEqual(fillsBefore);
    expect(
      document.querySelector<HTMLElement>(".classtab--on .classtab__rail-fill")!.style.width,
    ).not.toBe(railBefore);

    // …and NOT by re-reading anything: the ceiling belongs to the read, the position to
    // the write's own 200
    expect(h.programmeGets()).toHaveLength(1);
    expect(h.progressGets(C1)).toHaveLength(1);
  });

  test("«تخطٍّ ↷» differs in exactly one key", async () => {
    session(C1);
    const h = mockApi({ classes: TWO_CLASSES, positions: { [C1]: { markedWeek: 8, rev: 3, entries: [] } } });
    await boot();
    await waitFor(() => expect(nav()).toBeTruthy());
    await goto("البرنامج");
    await waitFor(() => expect(tracker()).toBeTruthy());

    await click(buttonIn(inBand(8, ".tracker__acts"), "تخطٍّ ↷"));
    await waitFor(() => expect(h.puts()).toHaveLength(1));
    expect(h.puts()[0]!.body).toEqual({
      rev: 3,
      markedWeek: 9,
      entry: { week: 8, status: "skipped" },
    });
    await waitFor(() => expect(text(band(8))).toContain("مُتخطّى"));
  });

  test("«وصلنا هنا» states a position and annotates nothing", async () => {
    session(C1);
    const h = mockApi({ classes: TWO_CLASSES }); // week 0: every band offers it
    await boot();
    await waitFor(() => expect(nav()).toBeTruthy());
    await goto("البرنامج");
    await waitFor(() => expect(tracker()).toBeTruthy());

    await click(buttonIn(inBand(6, ".tracker__acts"), "وصلنا هنا"));
    await waitFor(() => expect(h.puts()).toHaveLength(1));
    // slice 1's setter write, byte-identical — the first one carries `rev: 0`
    expect(h.puts()[0]!.body).toEqual({ rev: 0, markedWeek: 6 });
    await waitFor(() => expect(text(band(6))).toContain("الأسبوع الحالي"));
  });

  test("«أنهيت هذا الأسبوع ✓» on the week card sends the SAME body as «تمّ ✓»", async () => {
    // Contract §0: one write shape, one shared builder, two hosts.
    session(C1);
    const h = mockApi({ classes: TWO_CLASSES, positions: { [C1]: { markedWeek: 8, rev: 3, entries: [] } } });
    await boot();
    await waitFor(() => expect(nav()).toBeTruthy());
    await goto("هذا الأسبوع");
    await waitFor(() => expect(weekcard()).toBeTruthy());

    await click(buttonIn(weekcard(), "أنهيت هذا الأسبوع ✓"));
    await waitFor(() => expect(h.puts()).toHaveLength(1));
    expect(h.puts()[0]!.body).toEqual({
      rev: 3,
      markedWeek: 9,
      entry: { week: 8, status: "done" },
    });
    // the card follows the fresh props it is handed
    await waitFor(() =>
      expect(text(document.querySelector(".weekcard__eyebrow"))).toContain("الأسبوع 9 من 30"),
    );
  });

  test("the week card clamps at the last week too — the builder, not a second spelling", async () => {
    // The card's «أنهيت هذا الأسبوع ✓» is the same write as «تمّ ✓», and this is the
    // case where a hand-written `markedWeek + 1` and fe-1's builder part company. One
    // builder, two hosts (contract §0) — pinned where the difference is visible.
    session(C1);
    const h = mockApi({ classes: TWO_CLASSES, positions: { [C1]: { markedWeek: 30, rev: 9, entries: [] } } });
    await boot();
    await waitFor(() => expect(nav()).toBeTruthy());
    await goto("هذا الأسبوع");
    await waitFor(() => expect(weekcard()).toBeTruthy());

    await click(buttonIn(weekcard(), "أنهيت هذا الأسبوع ✓"));
    await waitFor(() => expect(h.puts()).toHaveLength(1));
    expect(h.puts()[0]!.body).toEqual({
      rev: 9,
      markedWeek: 30,
      entry: { week: 30, status: "done" },
    });
  });

  test("the WRITE BOUND is the progress route's, and the header's number is the ministry's", async () => {
    // Contract §3, and the two numbers are made to disagree here on purpose: they are
    // the same in all five corpus documents, which is exactly what would let one stand
    // in for the other until the first document where they part. The real maths
    // document (27 weeks in `totals`) under a 30-week write bound.
    session(C1);
    const h = mockApi({
      classes: TWO_CLASSES,
      positions: { [C1]: { markedWeek: 27, rev: 5, entries: [] } },
      programmes: { [C1]: MATH },
      totalWeeks: 30,
    });
    await boot();
    await waitFor(() => expect(nav()).toBeTruthy());

    await goto("هذا الأسبوع");
    await waitFor(() => expect(weekcard()).toBeTruthy());
    // the card states a mark against the bound that mark lives under
    expect(text(document.querySelector(".weekcard__eyebrow"))).toContain("الأسبوع 27 من 30");

    await goto("البرنامج");
    await waitFor(() => expect(tracker()).toBeTruthy());
    // …while the header states the ministry's own summary table
    expect(text(document.querySelector(".tracker__provenance"))).toContain("27 أسبوعًا");

    // and the write clamps against the BOUND — 28, not the document's last week
    await click(buttonIn(inBand(27, ".tracker__acts"), "تمّ ✓"));
    await waitFor(() => expect(h.puts()).toHaveLength(1));
    expect(h.puts()[0]!.body).toEqual({
      rev: 5,
      markedWeek: 28,
      entry: { week: 27, status: "done" },
    });
  });

  test("at the last week the position stays put and the entry still records", async () => {
    session(C1);
    const h = mockApi({ classes: TWO_CLASSES, positions: { [C1]: { markedWeek: 30, rev: 9, entries: [] } } });
    await boot();
    await waitFor(() => expect(nav()).toBeTruthy());
    await goto("البرنامج");
    await waitFor(() => expect(tracker()).toBeTruthy());

    await click(buttonIn(inBand(30, ".tracker__acts"), "تمّ ✓"));
    await waitFor(() => expect(h.puts()).toHaveLength(1));
    expect(h.puts()[0]!.body).toEqual({
      rev: 9,
      markedWeek: 30,
      entry: { week: 30, status: "done" },
    });
  });
});

// ══ 8 · THE 409 RE-READ — fe-5's half of a seam fe-4 could not test ═══════════════

describe("a lost compare-and-set re-reads, re-asks at the row, and never resubmits", () => {
  test("exactly one GET follows the 409, the fresh position renders, and no second PUT goes out", async () => {
    session(C1);
    const h = mockApi({
      classes: TWO_CLASSES,
      positions: { [C1]: { markedWeek: 8, rev: 3, entries: [] } },
      conflictOnce: true,
    });
    await boot();
    await waitFor(() => expect(nav()).toBeTruthy());
    await goto("البرنامج");
    await waitFor(() => expect(tracker()).toBeTruthy());

    const readsBefore = h.progressGets(C1).length;
    await click(buttonIn(inBand(8, ".tracker__acts"), "تمّ ✓"));

    // the other tab moved the class to week 11 — the re-read is the only way the band
    // can show it, and without it the row re-asks against a position that never moved
    await waitFor(() => expect(text(band(11))).toContain("الأسبوع الحالي"));
    expect(h.progressGets(C1)).toHaveLength(readsBefore + 1);
    expect(h.puts()).toHaveLength(1); // never resubmitted

    // …and the re-ask is AT THE ROW that lost, in Arabic, with no global banner
    const notice = inBand(8, ".tracker__notice");
    expect(notice).toBeTruthy();
    expect(text(notice)).toContain("تغيّر موقع هذا القسم");
    expect(document.querySelectorAll(".tracker__notice")).toHaveLength(1);
    expect(document.querySelector(".alert")).toBeNull();
    expect(document.querySelector(".savestate")).toBeNull();

    // the programme is NOT re-read: a conflict is about the position, not the document
    expect(h.programmeGets()).toHaveLength(1);
  });

  test("the class bar's rail follows the re-read too — one position, everywhere", async () => {
    session(C1);
    const h = mockApi({
      classes: TWO_CLASSES,
      positions: { [C1]: { markedWeek: 8, rev: 3, entries: [] } },
      conflictOnce: true,
    });
    await boot();
    await waitFor(() => expect(nav()).toBeTruthy());
    await goto("البرنامج");
    await waitFor(() => expect(tracker()).toBeTruthy());

    await click(buttonIn(inBand(8, ".tracker__acts"), "تمّ ✓"));
    await waitFor(() => expect(text(band(11))).toContain("الأسبوع الحالي"));
    expect(text(tabs()[0])).toContain("أسبوع 11");
    expect(h.puts()).toHaveLength(1);
  });

  test("the week card's conflict re-reads the same way", async () => {
    session(C1);
    const h = mockApi({
      classes: TWO_CLASSES,
      positions: { [C1]: { markedWeek: 8, rev: 3, entries: [] } },
      conflictOnce: true,
    });
    await boot();
    await waitFor(() => expect(nav()).toBeTruthy());
    await goto("هذا الأسبوع");
    await waitFor(() => expect(weekcard()).toBeTruthy());

    await click(buttonIn(weekcard(), "أنهيت هذا الأسبوع ✓"));
    await waitFor(() => expect(document.querySelector(".weekcard__notice")).toBeTruthy());
    expect(text(document.querySelector(".weekcard__eyebrow"))).toContain("الأسبوع 11 من 30");
    expect(h.puts()).toHaveLength(1);
  });
});

// ══ 9 · THE REAL DOCUMENT, ONCE ═══════════════════════════════════════════════════

describe("the ministry's own maths document, through the whole app", () => {
  test("twenty-seven bands, fifteen segments, and week 20's seven rows", async () => {
    session(C1);
    mockApi({
      classes: TWO_CLASSES,
      positions: { [C1]: { markedWeek: 20, rev: 6, entries: [] } },
      programmes: { [C1]: MATH },
      totalWeeks: 27,
    });
    await boot();
    await waitFor(() => expect(nav()).toBeTruthy());
    await goto("البرنامج");
    await waitFor(() => expect(tracker()).toBeTruthy());

    expect(document.querySelectorAll(".tracker__band")).toHaveLength(27);
    expect(document.querySelectorAll(".progbar__seg")).toHaveLength(15);
    // the current week mounts open, with every one of the ministry's rows
    expect(band(20)!.querySelectorAll(".tracker__row")).toHaveLength(7);
    // and the ministry's maths is KaTeX, never source
    expect(text(tracker())).not.toContain("\\");
  });
});

// ══ 10 · THE STYLESHEET — three components' absences, and they are mine ═══════════

/**
 * Every classname this slice draws — five prefixes, matched as substrings the way fe-2
 * and fe-3 match theirs, so a modifier (`.tracker__band[data-state="current"]`,
 * `.nav__item--on`) is inside the net rather than one character outside it.
 */
const NEW_CLASSNAMES = ["nav", "progview", "tracker", "weekcard", "progbar"];

describe("no hue on any surface this slice draws — measured, not named", () => {
  test("the scanner discriminates: the positive controls", () => {
    // A rule that is only green after dark is still green, so every `var(--token)` is
    // resolved against BOTH themes before it is classified.
    expect(huedRulesFor(".tracker__tag { color: var(--accent); }", NEW_CLASSNAMES)).toHaveLength(2);
    expect(huedRulesFor(".tracker__flag { color: var(--danger); }", NEW_CLASSNAMES)).toHaveLength(2);
    expect(huedRulesFor(".nav__item { background: #1f6b52; }", NEW_CLASSNAMES)).toHaveLength(1);
    expect(
      huedRulesFor(".tracker__band { border-inline-start: 2px solid #a4342a; }", NEW_CLASSNAMES),
    ).toHaveLength(1);
    // …and does not cry wolf over ink, or over a rule that is not ours
    expect(huedRulesFor(".tracker__tag { color: var(--ink-soft); }", NEW_CLASSNAMES)).toEqual([]);
    expect(huedRulesFor(".nav__item { padding: var(--s-2); }", NEW_CLASSNAMES)).toEqual([]);
    expect(huedRulesFor(".btn--primary { background: var(--accent); }", NEW_CLASSNAMES)).toEqual([]);
  });

  test("`App.css` gives none of them a hue, in either theme", () => {
    // «مُتخطّى» is the label most likely to attract red, and «تمّ ✓» the one most likely
    // to attract green. The product never grades a teacher, and `--danger` is reserved
    // for true errors — a pacing surface is not one.
    expect(huedRulesFor(readSrc("src/App.css"), NEW_CLASSNAMES)).toEqual([]);
  });

  test("the rules this slice appended name no physical side", () => {
    // `App.css:1-8`: logical properties only. A physical `left`/`right` builds, type-
    // checks and mirrors the app — only a screenshot catches it, which is why this is a
    // source clause and not a rendered one.
    const appended = readSrc("src/App.css").slice(baselineCssLength());
    expect(appended.length).toBeGreaterThan(1000); // the slice really did append its rules
    const bare = appended.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(bare).not.toMatch(/(^|[\s;{])(left|right)\s*:/);
    expect(bare).not.toMatch(/\b(margin|padding|border)-(left|right)\s*:/);
  });

  test("the tracker's sub-grid rules exist — the structure alone lines nothing up", () => {
    // fe-4 ships the STRUCTURE (per-row hours and the week total in one container) and
    // says in its own doc comment which rules make them share a track. jsdom cannot
    // measure a column; it can insist the rules were written.
    const css = readSrc("src/App.css");
    expect(declaresFor(css, ".tracker__band", /grid-template-columns\s*:/)).toBe(true);
    expect(declaresFor(css, ".tracker__rows", /grid-template-columns\s*:\s*subgrid/)).toBe(true);
    // …and the band's own middle cell is what the sub-grid spans
    expect(declaresFor(css, ".tracker__rows", /grid-column\s*:\s*3\s*\/\s*5/)).toBe(true);
    // Both, and either may arrive in a grouped selector — the property is what matters.
    expect(declaresFor(css, ".tracker__row", /display\s*:\s*contents/)).toBe(true);
    expect(declaresFor(css, ".tracker__sum", /display\s*:\s*contents/)).toBe(true);
    // the positive control: a property nobody declared is not found
    expect(declaresFor(css, ".tracker__row", /float\s*:/)).toBe(false);
  });

  test("the nav is hidden from a printed sheet, like every other affordance", () => {
    const css = readSrc("src/App.css");
    const printBlocks = [...css.matchAll(/@media\s+print\s*\{([\s\S]*?)\n\}/g)].map((m) => m[1]!);
    expect(printBlocks.some((b) => b.includes(".nav"))).toBe(true);
  });
});

// ══ 11 · THE HARD CONSTRAINTS ═════════════════════════════════════════════════════

describe("Arabic only, Western digits, and no invented vocabulary", () => {
  test("every string fe-5 authored is Arabic — nav, chooser, waiting and error copy", async () => {
    session();
    mockApi({ classes: TWO_CLASSES, programmeFail: 503 });
    window.location.hash = "#/programme";
    await boot();
    await waitFor(() => expect(nav()).toBeTruthy());

    const chrome = [...navLabels(), text(document.querySelector(".progview__choose"))];
    for (const s of chrome) {
      expect(s).not.toMatch(/[A-Za-z]/);
      expect(s).not.toMatch(/[٠-٩]/); // Arabic-Indic digits are not this product's
      expect(s).toMatch(/[؀-ۿ]/);
    }
  });

  test("the word «AI» is nowhere, in the DOM or in the source", async () => {
    session(C1);
    mockApi({ classes: TWO_CLASSES, positions: { [C1]: { markedWeek: 8, rev: 3, entries: [] } } });
    await boot();
    await waitFor(() => expect(nav()).toBeTruthy());
    await goto("البرنامج");
    await waitFor(() => expect(tracker()).toBeTruthy());

    expect(text(document.body)).not.toMatch(/\bAI\b/);
    expect(readCode("src/components/Nav.tsx")).not.toMatch(/\bAI\b/);
  });

  test("every new call is a RELATIVE /api URL", async () => {
    session(C1);
    const h = mockApi({ classes: TWO_CLASSES, positions: { [C1]: { markedWeek: 8, rev: 3, entries: [] } } });
    await boot();
    await waitFor(() => expect(nav()).toBeTruthy());
    await goto("البرنامج");
    await waitFor(() => expect(tracker()).toBeTruthy());
    await click(buttonIn(inBand(8, ".tracker__acts"), "تمّ ✓"));
    await waitFor(() => expect(h.puts()).toHaveLength(1));

    for (const c of h.calls) {
      expect(c.url.startsWith("/api/")).toBe(true);
      expect(c.url).not.toMatch(/^https?:/);
    }
  });

  test("no router, and no new dependency to carry one", () => {
    const pkg = JSON.parse(readSrc("package.json")) as {
      dependencies: Record<string, string>;
    };
    expect(Object.keys(pkg.dependencies).sort()).toEqual(["katex", "react", "react-dom"]);
    const app = readCode("src/App.tsx");
    expect(app).not.toMatch(/react-router|wouter|createBrowserRouter|<Route\b/);
  });
});

// ══ the colour scanner, inherited from fe-2 ═══════════════════════════════════════

function tokenThemes(): Record<string, string>[] {
  const css = readSrc("src/styles/tokens.css");
  return [...css.matchAll(/:root\s*\{([^}]*)\}/g)].map((block) => {
    const map: Record<string, string> = {};
    for (const [, name, value] of block[1]!.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
      map[name!] = value!.trim();
    }
    return map;
  });
}

/** HSV saturation of a `#rrggbb` — how much hue a colour actually carries. */
function saturation(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
  const max = Math.max(r!, g!, b!);
  if (max === 0) return 0;
  return (max - Math.min(r!, g!, b!)) / max;
}

const isHue = (hex: string) => saturation(hex) >= 0.3;

function huedRulesFor(css: string, classNames: string[]): string[] {
  const themes = tokenThemes();
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const offenders: string[] = [];

  for (const [, selector, body] of bare.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!classNames.some((c) => selector!.includes(`.${c}`))) continue;
    for (const [, prop, value] of body!.matchAll(/([\w-]+)\s*:\s*([^;]+)/g)) {
      const hexes = [...value!.matchAll(/#[0-9a-fA-F]{6}/g)].map((m) => m[0]);
      const viaToken = [...value!.matchAll(/var\((--[\w-]+)\)/g)].flatMap(([, name]) =>
        themes
          .map((t) => t[name!])
          .filter((v): v is string => typeof v === "string" && v.startsWith("#")),
      );
      for (const hex of [...hexes, ...viaToken]) {
        if (isHue(hex)) offenders.push(`${selector!.trim()} { ${prop}: ${hex} }`);
      }
    }
  }
  return offenders;
}

/**
 * Does any rule whose selector names `sel` declare `prop`?
 *
 * Selector-fragment rather than exact match, because `.tracker__row` and
 * `.tracker__sum` legitimately share one grouped rule — they say the same thing for the
 * same reason. What is being pinned is the DECLARATION, never its spelling.
 */
function declaresFor(css: string, sel: string, prop: RegExp): boolean {
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const [, selector, body] of bare.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    // `.tracker__row` must not be answered by a rule for `.tracker__rowbody`: the token
    // has to END there, though a state or a descendant may follow it.
    const named = new RegExp(`^${sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w-])`);
    if (!selector!.split(",").some((s) => named.test(s.trim()))) continue;
    if (prop.test(body!)) return true;
  }
  return false;
}

/**
 * How long `App.css` was before this slice — the marker fe-5's append sits after.
 *
 * The append is a contract with the file, not with a byte count: the marker line is
 * what separates «the stylesheet as slice 1 left it» from «everything this slice
 * added», and the physical-side clause reads only the second half. A rule moved above
 * the marker would be an edit to an existing block, which the Delta forbids.
 */
function baselineCssLength(): number {
  const css = readSrc("src/App.css");
  const at = css.indexOf(SLICE2_MARKER);
  expect(at).toBeGreaterThan(0);
  return at;
}

const SLICE2_MARKER = "/* ---- the programme surface (slice 2) ----";
