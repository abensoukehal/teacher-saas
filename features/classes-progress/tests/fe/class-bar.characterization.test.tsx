/**
 * fe-1 — the class layer and the bar.
 *
 * THE FEATURE, in one sentence: a teacher who has classes can see them and pick one;
 * a teacher who has none sees the app exactly as it is today.
 *
 * The clauses that are here because a plausible implementation gets them wrong:
 *
 *   - **zero classes must be invisible.** All 17,861 stored teachers have zero
 *     classes. A bar that renders empty, a grid row that reserves space, or a
 *     `?classId=` that goes out as `""` would ship a visible change to every single
 *     one of them — and `""` reads as "no filter" on the list but as
 *     `404 class_not_found` on a write (contract §5), so the two directions of that
 *     one mistake fail differently and neither is loud.
 *   - **`teacher.class.v1` must die with a rejected identity.** The key names another
 *     teacher's class id. Left behind when `be` stops recognising the browser's id, it
 *     is the next teacher's selection — the same shape of bug as a stale session.
 *   - **week 0 is not a position.** A class nobody has positioned shows its name and
 *     nothing else: no rail, no «أسبوع 0». Contract §7.2 — a week-0 class shows *no*
 *     pacing, not zero pacing.
 *   - **the bar sits AFTER both early returns.** The signed-out gate and `#/admin` are
 *     top-level returns in `App.tsx`; a bar rendered above either of them would put a
 *     teacher's class list on the sign-in screen and in the operator's console.
 */
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import App from "@/App";
import { railPercent, type ClassRef } from "@/lib/classes";

const TID = "0123456789abcdef0123456789abcdef";
const C1 = "6a7a7a365877e8523b8b023c";
const C2 = "6a7a7a575877e8523b8b023d";

/** Recorded 2026-08-11 against lane slot 8 — `GET /api/classes`, createdAt ASCENDING. */
const TWO_CLASSES: ClassRef[] = [
  { id: C1, name: "3ر1", stream: "شعبة الرياضيات", createdAt: "2026-08-11T01:26:14.969Z" },
  { id: C2, name: "3ع2", stream: "علوم تجريبية", createdAt: "2026-08-11T01:26:47.159Z" },
];

/**
 * The recorded `GET /api/progress/:classId` body.
 *
 * ONE key set, whether the document exists or not — including
 * `programmeTranscriptionRev`, which is `null` until the first write stamps it
 * (contract §4). The fixture always sends all eight keys for the same reason the
 * contract insists on them: a shape that gains a key after the first write would let
 * `fe` branch on which of two shapes it got, and the branch it forgot would be the
 * empty one.
 */
function progressBody(classId: string, markedWeek: number, totalWeeks = 27) {
  const started = markedWeek > 0;
  return {
    progress: {
      classId,
      markedWeek,
      entries: [],
      rev: started ? 1 : 0,
      programmeDocKey: started ? "tadarroj-3as-math" : null,
      programmeEdition: started ? "2022-09" : null,
      programmeTranscriptionRev: started ? 4 : null,
      updatedAt: started ? "2026-08-11T01:26:47.207Z" : null,
    },
    programme: { docKey: "tadarroj-3as-math", edition: "2022-09", totalWeeks },
    correlationId: "cid-progress",
  };
}

interface ApiOptions {
  classes?: ClassRef[];
  /** classId → markedWeek. Absent classes answer the synthesized empty state. */
  weeks?: Record<string, number>;
  totalWeeks?: number;
  /** Make the subject list answer `401 teacher_required` — the rejected-identity path. */
  rejectIdentity?: boolean;
  /** Make `GET /api/classes` fail — a `be` that predates this slice answers 404. */
  classesFail?: number;
}

/** A fetch mock over the four surfaces this slice can touch, recording every call. */
function mockApi(opts: ApiOptions = {}) {
  const calls: Array<{ method: string; url: string }> = [];
  const fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? "GET";
    calls.push({ method, url });
    const res = (status: number, payload: unknown) => ({
      ok: status < 300,
      status,
      json: async () => payload,
    });

    if (url.startsWith("/api/subjects") && method === "GET") {
      if (opts.rejectIdentity) {
        return res(401, {
          error: { message: "انتهت الجلسة.", type: "teacher_required" },
          correlationId: "cid-401",
        });
      }
      return res(200, { subjects: [], correlationId: "cid-list" });
    }
    if (url === "/api/classes" && method === "GET") {
      if (opts.classesFail) {
        return res(opts.classesFail, {
          error: { message: "غير موجود", type: "not_found" },
          correlationId: "cid-classes",
        });
      }
      return res(200, { classes: opts.classes ?? [], correlationId: "cid-classes" });
    }
    const p = /^\/api\/progress\/([^?]+)$/.exec(url);
    if (p && method === "GET") {
      const id = decodeURIComponent(p[1]!);
      return res(200, progressBody(id, opts.weeks?.[id] ?? 0, opts.totalWeeks ?? 27));
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
    classCalls: () => calls.filter((c) => c.url === "/api/classes"),
  };
}

async function boot() {
  await act(async () => {
    render(<App />);
  });
}

const bar = () => document.querySelector(".classbar");
const tabs = () => [...document.querySelectorAll<HTMLElement>("[data-class-id]")];
const selected = () =>
  tabs().find((t) => t.getAttribute("aria-pressed") === "true")?.getAttribute("data-class-id") ??
  null;

/** Text a teacher reads, whitespace-collapsed. No maths lives in this surface. */
const text = (root: Element) => (root.textContent ?? "").replace(/\s+/g, " ").trim();

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
});

// ---------------------------------------------------------------------------------
// THE POSITIVE — the bar, and what each tab says
// ---------------------------------------------------------------------------------

describe("a teacher with classes gets a bar", () => {
  test("both classes render, in the order `be` sent them, each with a rail sized markedWeek/totalWeeks", async () => {
    localStorage.setItem("teacher.id.v1", JSON.stringify(TID));
    mockApi({ classes: TWO_CLASSES, weeks: { [C1]: 8, [C2]: 20 } });
    await boot();

    await waitFor(() => expect(bar()).toBeTruthy());
    expect(tabs().map((t) => t.getAttribute("data-class-id"))).toEqual([C1, C2]);
    // Names, verbatim — a switcher that renames a teacher's own label is broken.
    expect(text(tabs()[0]!)).toContain("3ر1");
    expect(text(tabs()[1]!)).toContain("3ع2");

    // The rail is the position, drawn. 8/27 and 20/27 — from the RESPONSE's
    // `programme.totalWeeks`, never from a constant.
    const fills = document.querySelectorAll<HTMLElement>(".classtab__rail-fill");
    expect(fills).toHaveLength(2);
    expect(fills[0]!.style.width).toBe(railPercent(8, 27));
    expect(fills[1]!.style.width).toBe(railPercent(20, 27));
    expect(railPercent(8, 27)).toBe("29.6%");
  });

  test("the picker's denominator is the RESPONSE's totalWeeks, not 27-the-constant", async () => {
    // Every document in the corpus says 27 today, which is exactly what makes a
    // hardcoded 27 survive every test written against today's data (SEED risk flag).
    localStorage.setItem("teacher.id.v1", JSON.stringify(TID));
    mockApi({ classes: TWO_CLASSES, weeks: { [C1]: 15 }, totalWeeks: 30 });
    await boot();

    await waitFor(() => expect(bar()).toBeTruthy());
    const fill = document.querySelector<HTMLElement>(".classtab__rail-fill")!;
    expect(fill.style.width).toBe(railPercent(15, 30));
    expect(fill.style.width).not.toBe(railPercent(15, 27));
  });

  test("a week-0 class shows its NAME and nothing else — no rail, and never «أسبوع 0»", async () => {
    // Contract §7.2: `markedWeek: 0` is a state, not a position. Inventing a 0% rail
    // or printing the week number would be the product claiming a position nobody set.
    localStorage.setItem("teacher.id.v1", JSON.stringify(TID));
    mockApi({ classes: TWO_CLASSES, weeks: { [C1]: 8 } });
    await boot();

    await waitFor(() => expect(bar()).toBeTruthy());
    const zero = tabs()[1]!;
    expect(text(zero)).toBe("3ع2");
    expect(zero.querySelector(".classtab__rail")).toBeNull();
    expect(text(zero)).not.toContain("أسبوع");
    expect(text(zero)).not.toContain("0");
    // …while the positioned one does say where it is.
    expect(text(tabs()[0]!)).toContain("أسبوع 8");
  });

  test("`railPercent` refuses to invent a fill it cannot compute", () => {
    expect(railPercent(0, 27)).toBeNull();
    expect(railPercent(8, 0)).toBeNull();
    // One decimal where it carries information (8/27 is 29.6%, not 30%), and no
    // trailing `.0` — a width the DOM would hand back in a different spelling than it
    // was given is a value that cannot be asserted on.
    expect(railPercent(27, 27)).toBe("100%");
    // Out of range can only come from a corrupt read; it clamps rather than
    // overflowing the track.
    expect(railPercent(40, 27)).toBe("100%");
    expect(railPercent(-3, 27)).toBeNull();
  });
});

// ---------------------------------------------------------------------------------
// THE NEGATIVE — the 17,861 teachers with no classes
// ---------------------------------------------------------------------------------

describe("a teacher with ZERO classes sees today's app", () => {
  test("no bar, no extra node, no grid-row modifier — and no request carries a classId", async () => {
    localStorage.setItem("teacher.id.v1", JSON.stringify(TID));
    const h = mockApi({ classes: [] });
    await boot();

    // The list settled, so the bar has had every chance to appear.
    await waitFor(() => expect(h.classCalls().length).toBe(1));

    const shell = document.querySelector(".app")!;
    expect(bar()).toBeNull();
    expect(tabs()).toHaveLength(0);
    // The shell is EXACTLY what it is today: the class list is the only thing that
    // may add a row, and it added none.
    expect(shell.className).toBe("app");
    expect([...shell.children].map((c) => c.className.split(" ")[0])).toEqual([
      "sidebar",
      "workspace",
    ]);

    // Contract §0/§5: `""` reads as no-filter and writes as a 404. The only safe
    // serialisation of "no class" is the absent key, on every surface.
    for (const url of h.urls()) expect(url).not.toContain("classId");
  });

  test("a class read that FAILS renders no bar and no alert — it does not borrow the exam's error surface", async () => {
    // A `be` that predates this slice answers 404 to every one of these. Reporting it
    // would boot every teacher on an older backend into a banner about a feature they
    // are not using — and would then keep stealing the alert a refine or a save needs
    // (contract §10: one stack deploying alone changes nothing the other's users see).
    // Found by the promoted net, not by this file: it broke a persistence-gaps clause
    // that asserts on `role="alert"`.
    localStorage.setItem("teacher.id.v1", JSON.stringify(TID));
    const h = mockApi({ classes: TWO_CLASSES, classesFail: 404 });
    await boot();
    await waitFor(() => expect(h.classCalls().length).toBe(1));

    expect(bar()).toBeNull();
    expect(document.querySelector(".app")!.className).toBe("app");
    expect(document.querySelector("[role='alert']")).toBeNull();
  });

  test("the subject list request is byte-identical to today's", async () => {
    localStorage.setItem("teacher.id.v1", JSON.stringify(TID));
    const h = mockApi({ classes: [] });
    await boot();
    await waitFor(() => expect(h.classCalls().length).toBe(1));

    const list = h.calls.filter((c) => c.url.startsWith("/api/subjects"));
    expect(list).toHaveLength(1);
    expect(list[0]!.url).toBe("/api/subjects");
  });
});

// ---------------------------------------------------------------------------------
// THE SELECTION — persisted, reconciled, and dropped with the identity
// ---------------------------------------------------------------------------------

describe("the selected class", () => {
  test("survives a remount through `teacher.class.v1`", async () => {
    localStorage.setItem("teacher.id.v1", JSON.stringify(TID));
    mockApi({ classes: TWO_CLASSES, weeks: { [C1]: 8, [C2]: 20 } });
    await boot();
    await waitFor(() => expect(tabs()).toHaveLength(2));

    await act(async () => {
      tabs()[1]!.click();
    });
    expect(selected()).toBe(C2);
    expect(localStorage.getItem("teacher.class.v1")).toBe(JSON.stringify(C2));

    cleanup();
    await boot();
    await waitFor(() => expect(tabs()).toHaveLength(2));
    expect(selected()).toBe(C2);
  });

  test("a persisted id that is no longer in the list falls back to NO selection, without crashing", async () => {
    // A class list is not immutable from this browser's point of view: the same
    // account is used on another machine, and the id in storage can name something
    // this teacher's list no longer contains. Rendering a selection for it would
    // scope every later request to a class that is not there.
    localStorage.setItem("teacher.id.v1", JSON.stringify(TID));
    localStorage.setItem("teacher.class.v1", JSON.stringify("6a7a7a000000000000000000"));
    mockApi({ classes: TWO_CLASSES, weeks: { [C1]: 8 } });
    await boot();

    await waitFor(() => expect(tabs()).toHaveLength(2));
    expect(selected()).toBeNull();
    // And the dangling id is not left behind to be re-read next time.
    expect(localStorage.getItem("teacher.class.v1")).toBeNull();
  });

  test("a rejected identity takes `teacher.class.v1` with it", async () => {
    // App.tsx `dropRejectedIdentity`. The key names a class id that belongs to the
    // identity `be` just refused — leaving it is how the NEXT teacher on this browser
    // starts out with a stranger's class selected.
    localStorage.setItem("teacher.id.v1", JSON.stringify(TID));
    localStorage.setItem("teacher.class.v1", JSON.stringify(C1));
    mockApi({ classes: TWO_CLASSES, rejectIdentity: true });
    await boot();

    await waitFor(() => expect(localStorage.getItem("teacher.id.v1")).toBeNull());
    expect(localStorage.getItem("teacher.class.v1")).toBeNull();
    expect(bar()).toBeNull();
  });
});

// ---------------------------------------------------------------------------------
// THE NEGATIVE — the bar renders AFTER both early returns
// ---------------------------------------------------------------------------------

describe("where the bar does NOT appear", () => {
  test("the signed-out gate has no bar, and asks for no classes at all", async () => {
    const h = mockApi({ classes: TWO_CLASSES });
    await boot();

    // The auth gate is the whole render (App.tsx's first early return).
    await waitFor(() => expect(document.querySelector("form, .auth")).toBeTruthy());
    expect(bar()).toBeNull();
    // No identity, no teacher-scoped read: a class list for nobody is a request that
    // can only be refused.
    expect(h.classCalls()).toHaveLength(0);
  });

  test("the operator's console renders without a bar", async () => {
    // SEED §6: the console gets no class bar. It is a different job on the same
    // screen — a teacher's classes have no meaning in it.
    localStorage.setItem("teacher.id.v1", JSON.stringify(TID));
    window.location.hash = "#/admin";
    mockApi({ classes: TWO_CLASSES, weeks: { [C1]: 8, [C2]: 20 } });
    await boot();

    await waitFor(() => expect(document.querySelector("[data-testid='admin-console']")).toBeTruthy());
    expect(bar()).toBeNull();
    expect(tabs()).toHaveLength(0);
    expect(document.querySelector(".app")).toBeNull();
  });
});

// ---------------------------------------------------------------------------------
// THE HARD CONSTRAINTS
// ---------------------------------------------------------------------------------

describe("the hard constraints hold on the bar", () => {
  test("Arabic only, Western digits, no LaTeX — and the DOM order under rtl is the class order", async () => {
    localStorage.setItem("teacher.id.v1", JSON.stringify(TID));
    mockApi({ classes: TWO_CLASSES, weeks: { [C1]: 8, [C2]: 20 } });
    await boot();
    await waitFor(() => expect(bar()).toBeTruthy());

    const t = text(bar()!);
    // Latin letters are the test rather than a word list: a list only catches the
    // English somebody thought of. There is no maths in this surface, so any Latin
    // run at all is a defect.
    expect(t.match(/[A-Za-z]{2,}/g) ?? []).toEqual([]);
    // Western digits, by constraint — «أسبوع ٨» is the wrong product.
    expect(t).not.toMatch(/[٠-٩۰-۹]/);
    for (const needle of ["$", "\\frac", "\\text", "\\begin{"]) expect(t).not.toContain(needle);

    // The document really is RTL, and the bar leaves the direction to it rather than
    // pinning a physical side — jsdom cannot see a mirrored layout, so the assertion
    // is on what causes one.
    expect(document.documentElement.getAttribute("dir") ?? "rtl").toBe("rtl");
    expect(bar()!.getAttribute("style")).toBeNull();
    expect(bar()!.className).not.toMatch(/left|right/);

    // DOM order IS the reading order under `dir="rtl"`: first class first.
    expect(tabs().map((el) => text(el).split(" ")[0])).toEqual(["3ر1", "3ع2"]);
  });

  test("every class call is relative — an absolute URL would make this lane talk to the main checkout", async () => {
    localStorage.setItem("teacher.id.v1", JSON.stringify(TID));
    const h = mockApi({ classes: TWO_CLASSES, weeks: { [C1]: 8 } });
    await boot();
    await waitFor(() => expect(bar()).toBeTruthy());

    for (const url of h.urls()) {
      expect(url.startsWith("/api/")).toBe(true);
      expect(url).not.toMatch(/^https?:/);
    }
    // The progress reads are per class, addressed BY class id (contract §0).
    expect(h.urls()).toContain(`/api/progress/${C1}`);
    expect(h.urls()).toContain(`/api/progress/${C2}`);
  });
});
