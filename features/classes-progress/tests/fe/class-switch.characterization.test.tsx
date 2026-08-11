/**
 * fe-2 — switching class is a TOTAL context switch, and the list follows.
 *
 * THE FEATURE, in one sentence: tapping another class feels like walking into another
 * classroom — everything contextual resets and the subjects list refetches scoped to
 * that class — and exactly two things survive: the queued save, and every subject the
 * teacher had before classes existed.
 *
 * The clauses that are here because a plausible implementation gets them wrong:
 *
 *   - **`pendingSave` must NOT be cleared.** It sits in the same `useState` block as
 *     `exam`, `solutions` and `refining`, all of which the switch nulls two lines above
 *     it. It is an unsaved-exam intent queued after a failed save; dropping it on a tab
 *     switch is precisely the silent loss the whole persistence line of work exists to
 *     prevent (contract §7.8, SEED locked). This is the clause most likely to be lost by
 *     someone tidying that block, so it is pinned on STORAGE BYTES, not on a render.
 *   - **the client must not re-filter what `be` returned.** `GET /api/subjects?classId=`
 *     answers with that class's subjects PLUS every legacy one (contract §5). 8,839
 *     subjects are stored and 0 carry a classId; a client-side `s.classId === current`
 *     would delete every teacher's whole history from their own screen while every
 *     server-side test stayed green.
 *   - **`""` is never serialised, and `classId` is never repeated.** The two degenerate
 *     values resolve OPPOSITE ways: `?classId=` is "no filter" but a POST body `""` is
 *     `404 class_not_found`, and a repeated/array-shaped param is `400` — the only new
 *     way the product's most-loaded read can fail (contract §5, pinned block). Both were
 *     re-probed live against :9800 before this file was written.
 *   - **the pollers must let go.** Two effects key on `subjectId` (the progressive exam
 *     read, and the correction batch). When the switch nulls it they must abort, or the
 *     new classroom keeps re-reading the old one's exam.
 *   - **no class selected is byte-identical to today.** The zero-class shell is fe-1's
 *     clause; this file pins the other half of it — a teacher WITH classes who has
 *     selected none issues the same param-less list request as every teacher does today.
 */
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import App from "@/App";
import type { ClassRef } from "@/lib/classes";

const TID = "0123456789abcdef0123456789abcdef";
const C1 = "6a7a7a365877e8523b8b023c";
const C2 = "6a7a7a575877e8523b8b023d";

/** Recorded 2026-08-11 against lane slot 8 — createdAt ASCENDING, `be` owns the order. */
const TWO_CLASSES: ClassRef[] = [
  { id: C1, name: "3ر1", stream: "شعبة الرياضيات", createdAt: "2026-08-11T01:26:14.969Z" },
  { id: C2, name: "3ع2", stream: "علوم تجريبية", createdAt: "2026-08-11T01:26:47.159Z" },
];

const SUBJ_C1 = "6a7a82a95877e8523b8b05f1";
const SUBJ_LEGACY = "6a7a82a95877e8523b8b05fe";
const SUBJ_C2 = "6a7a82a95877e8523b8b05f2";

/** Distinct enough that finding it on screen after a switch is unambiguous. */
const STATEMENT_C1 = "لتكن الدالة المعرفة على المجال المفتوح، أدرس تغيراتها.";

function exam(title: string, statement: string, pending = false) {
  return {
    title,
    meta: {
      stream: "شعبة الرياضيات",
      level: "الثالثة ثانوي",
      topic: "الدوال",
      durationMinutes: 60,
      totalPoints: 20,
    },
    exercises: [
      {
        id: "ex1",
        label: "التمرين الأول",
        points: 10,
        statement,
        topics: ["الدوال"],
        difficulty: "متوسط",
      },
      {
        id: "ex2",
        label: "التمرين الثاني",
        points: 10,
        statement: pending ? "" : "أحسب النهاية عند اللانهاية.",
        topics: ["النهايات"],
        difficulty: "متوسط",
        ...(pending ? { status: "pending" as const } : {}),
      },
    ],
  };
}

function summary(id: string, title: string, classId: string | null) {
  return {
    id,
    title,
    topic: "الدوال",
    exerciseCount: 2,
    totalPoints: 20,
    createdAt: "2026-08-11T01:00:00.000Z",
    updatedAt: "2026-08-11T01:00:00.000Z",
    genCorrelationId: null,
    // The projection key be-3 added. `null` IS legacy, surfaced deliberately —
    // and `fe` reads it for nothing (contract §5).
    classId,
  };
}

/**
 * What `GET /api/subjects` answers, per query.
 *
 * The `?classId=C2` row deliberately carries a subject tagged **C1** as well as the
 * legacy one. `be` would never send that — the point is that the client renders what it
 * was given rather than auditing it. A UI that re-filters passes every other clause in
 * this file and fails this one.
 */
const LISTS: Record<string, ReturnType<typeof summary>[]> = {
  "": [
    summary(SUBJ_C1, "موضوع القسم الأول", C1),
    summary(SUBJ_C2, "موضوع القسم الثاني", C2),
    summary(SUBJ_LEGACY, "موضوع قديم", null),
  ],
  [C1]: [summary(SUBJ_C1, "موضوع القسم الأول", C1), summary(SUBJ_LEGACY, "موضوع قديم", null)],
  [C2]: [
    summary(SUBJ_C2, "موضوع القسم الثاني", C2),
    summary(SUBJ_LEGACY, "موضوع قديم", null),
    summary(SUBJ_C1, "موضوع القسم الأول", C1),
  ],
};

function progressBody(classId: string, markedWeek: number) {
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
    programme: { docKey: "tadarroj-3as-math", edition: "2022-09", totalWeeks: 27 },
    correlationId: "cid-progress",
  };
}

interface Call {
  method: string;
  url: string;
  body: unknown;
}

interface ApiOptions {
  classes?: ClassRef[];
  /** The open subject `GET /api/subjects/:id` answers with. */
  open?: { id: string; subject: ReturnType<typeof exam> };
  /**
   * classIds whose list response HANGS until `release(classId)` is called — the only
   * way to choose the order two in-flight reads resolve in.
   *
   * `""` is the param-less read, so boot's list can be held too. A held id that is
   * requested twice keeps only the latest resolver; every clause below requests each
   * held query exactly once.
   */
  holdLists?: string[];
}

function mockApi(opts: ApiOptions = {}) {
  const calls: Call[] = [];
  const held = new Map<string, () => void>();
  const fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? "GET";
    calls.push({
      method,
      url,
      body: typeof init.body === "string" ? JSON.parse(init.body) : undefined,
    });
    const res = (status: number, payload: unknown) => ({
      ok: status < 300,
      status,
      json: async () => payload,
    });

    if (url === "/api/classes" && method === "GET") {
      return res(200, { classes: opts.classes ?? [], correlationId: "cid-classes" });
    }
    const prog = /^\/api\/progress\/([^?]+)$/.exec(url);
    if (prog && method === "GET") {
      const id = decodeURIComponent(prog[1]!);
      return res(200, progressBody(id, id === C1 ? 8 : 0));
    }

    if (url.startsWith("/api/subjects")) {
      if (method === "POST" && url === "/api/subjects") {
        return res(201, {
          id: "6a7a82a95877e8523b8b0600",
          createdAt: "2026-08-11T02:00:00.000Z",
          updatedAt: "2026-08-11T02:00:00.000Z",
          subject: exam("موضوع محفوظ", "نص محفوظ"),
          correlationId: "cid-create",
        });
      }
      if (/\/revisions$/.test(url)) return res(200, { revisions: [], correlationId: "cid-rev" });
      if (/\/solutions$/.test(url)) return res(200, { solutions: [], correlationId: "cid-sol" });
      const one = /^\/api\/subjects\/([^/?]+)$/.exec(url);
      if (one && method === "GET") {
        if (!opts.open || opts.open.id !== decodeURIComponent(one[1]!)) {
          return res(404, { error: { message: "غير موجود", type: "subject_not_found" } });
        }
        return res(200, {
          id: opts.open.id,
          createdAt: "2026-08-11T01:00:00.000Z",
          updatedAt: "2026-08-11T01:00:00.000Z",
          subject: opts.open.subject,
          correlationId: "cid-get",
        });
      }
      if (method === "GET") {
        // The list. Everything after `?` is the query the app chose to build.
        const q = url.slice("/api/subjects".length);
        const id = q.startsWith("?classId=") ? decodeURIComponent(q.slice("?classId=".length)) : "";
        if (opts.holdLists?.includes(id)) {
          await new Promise<void>((resolve) => held.set(id, resolve));
        }
        return res(200, { subjects: LISTS[id] ?? LISTS[""]!, correlationId: "cid-list" });
      }
    }
    return res(404, { error: { message: "غير موجود", type: "not_found" } });
  });
  vi.stubGlobal("fetch", fetchMock);

  const lists = () =>
    calls.filter((c) => c.method === "GET" && /^\/api\/subjects(\?|$)/.test(c.url));
  return {
    calls,
    urls: () => calls.map((c) => c.url),
    lists,
    lastList: () => lists()[lists().length - 1]!.url,
    reads: (id: string) => calls.filter((c) => c.method === "GET" && c.url === `/api/subjects/${id}`),
    /** Let a held list response land. The order these are called in IS the network. */
    release: (classId: string) => {
      const open = held.get(classId);
      if (!open) throw new Error(`no held list for ${JSON.stringify(classId)}`);
      held.delete(classId);
      open();
    },
  };
}

async function boot() {
  await act(async () => {
    render(<App />);
  });
}

const tabs = () => [...document.querySelectorAll<HTMLElement>("[data-class-id]")];
const tab = (id: string) => tabs().find((t) => t.getAttribute("data-class-id") === id)!;
const selected = () =>
  tabs().find((t) => t.getAttribute("aria-pressed") === "true")?.getAttribute("data-class-id") ??
  null;
const items = () => [...document.querySelectorAll(".subjects__item-title")].map((n) => n.textContent);
const text = () => (document.body.textContent ?? "").replace(/\s+/g, " ");

/** Sign in, hold a class, and have an exam open — the state a switch actually happens in. */
function seed({ cls, open }: { cls?: string | null; open?: string } = {}) {
  localStorage.setItem("teacher.id.v1", JSON.stringify(TID));
  if (cls) localStorage.setItem("teacher.class.v1", JSON.stringify(cls));
  if (open) localStorage.setItem("teacher.current.v1", JSON.stringify(open));
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
  vi.useRealTimers();
  window.location.hash = "";
});

// ---------------------------------------------------------------------------------
// THE SWITCH — everything contextual goes
// ---------------------------------------------------------------------------------

describe("switching class is a total context switch", () => {
  test("an open exam and an active refine panel are both gone, and no stale statement survives", async () => {
    seed({ cls: C1, open: SUBJ_C1 });
    const h = mockApi({ classes: TWO_CLASSES, open: { id: SUBJ_C1, subject: exam("موضوع القسم الأول", STATEMENT_C1) } });
    await boot();

    await waitFor(() => expect(tabs()).toHaveLength(2));
    // The exam is really open, and the refine panel — the core loop's own surface —
    // is really active. A switch that only clears an idle screen proves nothing.
    await waitFor(() => expect(document.querySelector(".exam")).toBeTruthy());
    expect(text()).toContain(STATEMENT_C1);
    await act(async () => {
      document.querySelector<HTMLElement>(".ex__refine")!.click();
    });
    expect(document.querySelector(".refine")).toBeTruthy();
    expect(localStorage.getItem("teacher.current.v1")).toBe(JSON.stringify(SUBJ_C1));

    await act(async () => {
      tab(C2).click();
    });
    await waitFor(() => expect(h.lists().length).toBe(2));

    // exam · subjectId · refining · solutions · solutionsRun — all of them belong to
    // the subject, and the subject belongs to the class that was left behind.
    expect(document.querySelector(".exam")).toBeNull();
    expect(document.querySelector(".refine")).toBeNull();
    expect(document.querySelector(".solutions-pane")).toBeNull();
    expect(text()).not.toContain(STATEMENT_C1);
    expect(localStorage.getItem("teacher.current.v1")).toBeNull();
    expect(localStorage.getItem("teacher.cache.v1")).toBeNull();
    // …and the new classroom is the ordinary empty one, in Arabic.
    expect(text()).toContain("ابدأ بتوليد موضوعك الأول");
    expect(selected()).toBe(C2);
  });

  test("the list refetches scoped to the NEW class — one `classId`, spelled once", async () => {
    seed({ cls: C1 });
    const h = mockApi({ classes: TWO_CLASSES });
    await boot();
    await waitFor(() => expect(tabs()).toHaveLength(2));

    await act(async () => {
      tab(C2).click();
    });
    await waitFor(() => expect(h.lists().length).toBe(2));

    const url = h.lastList();
    expect(url).toBe(`/api/subjects?classId=${C2}`);
    // A repeated or array-shaped param is `400 invalid_request` (contract §5) — the
    // ONLY new way this read can fail, and it is the product's most-loaded one.
    expect(url.match(/classId=/g)).toHaveLength(1);
    expect(url).not.toContain("classId[]");
    // And never the empty spelling, which silently means "no filter" here.
    expect(url).not.toMatch(/classId=(&|$)/);
  });

  test("a LEGACY subject in the response is rendered, and so is one tagged another class", async () => {
    // `be` returns "this class's subjects PLUS every legacy one". 8,839 subjects are
    // stored and 0 carry a classId — a client-side re-filter empties every teacher's
    // history while every server-side test stays green. The C1-tagged row in the C2
    // response is the sharper half: it is there to prove the client does not audit.
    seed({ cls: C1 });
    const h = mockApi({ classes: TWO_CLASSES });
    await boot();
    await waitFor(() => expect(tabs()).toHaveLength(2));

    await act(async () => {
      tab(C2).click();
    });
    await waitFor(() => expect(h.lists().length).toBe(2));

    await waitFor(() => expect(items()).toHaveLength(3));
    expect(items()).toEqual(["موضوع القسم الثاني", "موضوع قديم", "موضوع القسم الأول"]);
  });

  test("the selection lands in `teacher.class.v1` on EVERY switch, there and back", async () => {
    seed({ cls: C1 });
    const h = mockApi({ classes: TWO_CLASSES });
    await boot();
    await waitFor(() => expect(tabs()).toHaveLength(2));

    await act(async () => {
      tab(C2).click();
    });
    await waitFor(() => expect(h.lists().length).toBe(2));
    expect(localStorage.getItem("teacher.class.v1")).toBe(JSON.stringify(C2));

    await act(async () => {
      tab(C1).click();
    });
    await waitFor(() => expect(h.lists().length).toBe(3));
    expect(localStorage.getItem("teacher.class.v1")).toBe(JSON.stringify(C1));
    expect(selected()).toBe(C1);
    expect(h.lastList()).toBe(`/api/subjects?classId=${C1}`);
  });

  test("the live pollers let go: nothing re-reads the old class's exam after the switch", async () => {
    // Two effects key on `subjectId` (App.tsx — the progressive subject read and the
    // correction batch). The switch nulls it; if their cleanup did not abort, the new
    // classroom would keep polling the exam the teacher just left.
    seed({ cls: C1, open: SUBJ_C1 });
    const h = mockApi({
      classes: TWO_CLASSES,
      open: { id: SUBJ_C1, subject: exam("موضوع القسم الأول", STATEMENT_C1, true) },
    });
    // Installed BEFORE the render, deliberately. The poll schedules its first wait the
    // moment the effect runs; fake timers installed after that leave that one timeout
    // on the real clock, where advancing the fake one can never reach it — the loop
    // then looks dead and the test passes for the wrong reason.
    vi.useFakeTimers();
    await boot();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(document.querySelector(".exam")).toBeTruthy();
    expect(tabs()).toHaveLength(2);

    // The poll is REAL: one interval in, the subject has been re-read.
    const before = h.reads(SUBJ_C1).length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_100);
    });
    expect(h.reads(SUBJ_C1).length).toBeGreaterThan(before);

    const atSwitch = h.reads(SUBJ_C1).length;
    await act(async () => {
      tab(C2).click();
    });
    // Four more intervals. Not one further read of a subject that is no longer open.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(12_400);
    });
    expect(h.reads(SUBJ_C1).length).toBe(atSwitch);
  });
});

// ---------------------------------------------------------------------------------
// THE CLAUSE — a queued save survives
// ---------------------------------------------------------------------------------

describe("`pendingSave` survives the switch", () => {
  /** A save that failed and outlived the tab. Written by `savePendingSave`. */
  const PENDING = JSON.stringify({
    subject: exam("موضوع لم يُحفظ", "نص لم يُحفظ بعد"),
    controls: null,
    genCorrelationId: "cid-gen",
    costUsd: 0.6454,
    durationMs: 73_000,
    queuedAt: "2026-08-11T01:30:00.000Z",
  });

  test("byte-identical in storage, and still offered on screen", async () => {
    // THE clause. Every other per-subject state is nulled by the switch; this one sits
    // in the same block and must not be. An unsaved exam dropped on a tab switch is the
    // exact silent loss the persistence work exists to prevent (contract §7.8).
    seed({ cls: C1 });
    localStorage.setItem("teacher.pending.v1", PENDING);
    const h = mockApi({ classes: TWO_CLASSES });
    await boot();
    await waitFor(() => expect(tabs()).toHaveLength(2));
    expect(text()).toContain("لديك موضوع لم يُحفظ بعد");

    await act(async () => {
      tab(C2).click();
    });
    await waitFor(() => expect(h.lists().length).toBe(2));

    expect(localStorage.getItem("teacher.pending.v1")).toBe(PENDING);
    expect(text()).toContain("لديك موضوع لم يُحفظ بعد");

    // And it is still ACTIONABLE — surviving as dead bytes would be no better.
    await act(async () => {
      [...document.querySelectorAll<HTMLElement>("button")]
        .find((b) => b.textContent?.includes("حفظ الآن"))!
        .click();
    });
    await waitFor(() => expect(localStorage.getItem("teacher.pending.v1")).toBeNull());
    const posts = h.calls.filter((c) => c.method === "POST" && c.url === "/api/subjects");
    expect(posts).toHaveLength(1);
  });

  test("no write body ever serialises an unselected class as `\"\"`", async () => {
    // The pinned block, write side: `""` reads as "no filter" on the GET and as
    // `404 class_not_found` on the POST. Omitting the key is the only honest encoding —
    // and in slice 1 `fe` sends no `classId` on a write at all (contract §0: generation
    // is bound to a class in slice 3, not here).
    seed({ cls: null });
    localStorage.setItem("teacher.pending.v1", PENDING);
    const h = mockApi({ classes: TWO_CLASSES });
    await boot();
    await waitFor(() => expect(tabs()).toHaveLength(2));

    await act(async () => {
      [...document.querySelectorAll<HTMLElement>("button")]
        .find((b) => b.textContent?.includes("حفظ الآن"))!
        .click();
    });
    await waitFor(() => expect(localStorage.getItem("teacher.pending.v1")).toBeNull());

    for (const c of h.calls) {
      const body = c.body as Record<string, unknown> | undefined;
      if (body) expect(body.classId).toBeUndefined();
    }
  });
});

// ---------------------------------------------------------------------------------
// THE NEGATIVES — no selection, and the same class twice
// ---------------------------------------------------------------------------------

describe("what the switch must NOT do", () => {
  test("with no class selected the list request is byte-identical to today's", async () => {
    // fe-1 leaves nothing selected on a first load. A teacher who HAS classes but has
    // picked none is still in legacy mode (contract §0) — and `""` would be the easy
    // wrong answer here, because it looks like "no class" and reads as "no filter".
    seed({ cls: null });
    const h = mockApi({ classes: TWO_CLASSES });
    await boot();
    await waitFor(() => expect(tabs()).toHaveLength(2));

    expect(selected()).toBeNull();
    expect(h.lists()).toHaveLength(1);
    expect(h.lists()[0]!.url).toBe("/api/subjects");
    for (const url of h.urls()) expect(url).not.toContain("classId");
    // The whole, unfiltered list — exactly what this teacher sees today.
    expect(items()).toHaveLength(3);
  });

  test("re-tapping the class you are already in clears nothing and refetches nothing", async () => {
    seed({ cls: C1, open: SUBJ_C1 });
    const h = mockApi({ classes: TWO_CLASSES, open: { id: SUBJ_C1, subject: exam("موضوع القسم الأول", STATEMENT_C1) } });
    await boot();
    await waitFor(() => expect(document.querySelector(".exam")).toBeTruthy());
    await waitFor(() => expect(tabs()).toHaveLength(2));
    const before = h.lists().length;

    await act(async () => {
      tab(C1).click();
    });
    await act(async () => {
      tab(C1).click();
    });

    // A no-op switch that cleared the exam would throw away the teacher's open work
    // for a tap that changed nothing.
    expect(h.lists()).toHaveLength(before);
    expect(document.querySelector(".exam")).toBeTruthy();
    expect(text()).toContain(STATEMENT_C1);
    expect(localStorage.getItem("teacher.current.v1")).toBe(JSON.stringify(SUBJ_C1));
    expect(localStorage.getItem("teacher.class.v1")).toBe(JSON.stringify(C1));
  });

  test("a held selection that is no longer in the list does not leave the list filtered by it", async () => {
    // fe-1 drops a dangling `teacher.class.v1`. But boot has ALREADY read the list
    // scoped to it by then, and an unknown classId yields the legacy-only list with no
    // error at all (contract §5) — so without a re-read the teacher would silently see
    // none of the exams they do have.
    seed({ cls: "6a7a7a000000000000000000" });
    const h = mockApi({ classes: TWO_CLASSES });
    await boot();
    await waitFor(() => expect(tabs()).toHaveLength(2));

    expect(selected()).toBeNull();
    expect(localStorage.getItem("teacher.class.v1")).toBeNull();
    await waitFor(() => expect(h.lastList()).toBe("/api/subjects"));
    expect(items()).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------------
// THE LAST INTENT WINS, NOT THE LAST RESOLUTION  (review finding, fe-2)
// ---------------------------------------------------------------------------------

describe("a list response that arrives out of order is discarded", () => {
  /**
   * Two taps, two `refreshList`es, and nothing in HTTP orders their responses.
   *
   * Before the `classId` param existed this race was harmless: every list read asked
   * the same question, so an out-of-order answer was the same answer. Scoping the read
   * is what made ordering meaningful, and the harm is the product's own nightmare
   * shape — class A's exams under class B's tab, `listLoading` false, looking settled.
   * A teacher on an Algerian mobile network reorders responses routinely.
   *
   * Both clauses hold the responses explicitly rather than racing timers: the order
   * they are released in IS the network, so neither can pass by being lucky.
   */

  test("A resolving after B leaves B's subjects on screen, not A's", async () => {
    seed({ cls: null });
    const h = mockApi({ classes: TWO_CLASSES, holdLists: [C1, C2] });
    await boot();
    await waitFor(() => expect(tabs()).toHaveLength(2));
    // boot's own param-less read is not held, so the screen starts settled.
    await waitFor(() => expect(items()).toHaveLength(3));

    // Tap A, then B before A's answer is back. Both reads are now in flight.
    await act(async () => {
      tab(C1).click();
    });
    await act(async () => {
      tab(C2).click();
    });
    expect(h.lists()).toHaveLength(3);
    expect(selected()).toBe(C2);

    // B lands first and paints the classroom the teacher is standing in.
    await act(async () => {
      h.release(C2);
    });
    await waitFor(() => expect(items()).toEqual(LISTS[C2]!.map((s) => s.title)));

    // …and A lands late. THE CLAUSE: it is thrown away. A response for a classroom
    // the teacher has left may never repaint the one they are in.
    await act(async () => {
      h.release(C1);
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(selected()).toBe(C2);
    expect(items()).toEqual(LISTS[C2]!.map((s) => s.title));
    expect(items()).not.toEqual(LISTS[C1]!.map((s) => s.title));
    // The C2-only row is the sharp one: it exists in no other list, so its absence
    // would be unambiguous evidence that A's response won.
    expect(items()).toContain("موضوع القسم الثاني");
  });

  test("a stale response landing while the newest is still in flight neither paints nor settles", async () => {
    // The same race the other way round, and the worse half: the stale answer arrives
    // FIRST and the current one is still coming. Rendering it would put class A's
    // exams under class B's tab and drop the loading state — a screen that is both
    // wrong and finished-looking, which is the one the teacher would trust.
    seed({ cls: null });
    const h = mockApi({ classes: TWO_CLASSES, holdLists: [C1, C2] });
    await boot();
    await waitFor(() => expect(tabs()).toHaveLength(2));
    await waitFor(() => expect(items()).toHaveLength(3));

    await act(async () => {
      tab(C1).click();
    });
    await act(async () => {
      tab(C2).click();
    });
    expect(h.lists()).toHaveLength(3);

    await act(async () => {
      h.release(C1);
    });
    await act(async () => {
      await Promise.resolve();
    });
    // Nothing of A's is on screen…
    expect(items()).not.toContain("موضوع القسم الأول");
    expect(items()).toHaveLength(0);
    // …and the surface still says it is working, because it is.
    expect(text()).toContain("جارٍ التحميل…");

    // Then B lands and the classroom fills in — once, correctly.
    await act(async () => {
      h.release(C2);
    });
    await waitFor(() => expect(items()).toEqual(LISTS[C2]!.map((s) => s.title)));
    expect(text()).not.toContain("جارٍ التحميل…");
  });
});

// ---------------------------------------------------------------------------------
// THE HARD CONSTRAINTS
// ---------------------------------------------------------------------------------

describe("the hard constraints hold across a switch", () => {
  test("every call stays relative, and the post-switch screen is Arabic with Western digits", async () => {
    seed({ cls: C1 });
    const h = mockApi({ classes: TWO_CLASSES });
    await boot();
    await waitFor(() => expect(tabs()).toHaveLength(2));

    await act(async () => {
      tab(C2).click();
    });
    await waitFor(() => expect(h.lists().length).toBe(2));

    for (const url of h.urls()) {
      expect(url.startsWith("/api/")).toBe(true);
      expect(url).not.toMatch(/^https?:/);
    }
    // The bar is the surface this switch owns. No Latin, no Arabic-Indic digits, no
    // LaTeX — and the word "AI" appears nowhere in what it added.
    const barText = (document.querySelector(".classbar")!.textContent ?? "").replace(/\s+/g, " ");
    expect(barText.match(/[A-Za-z]{2,}/g) ?? []).toEqual([]);
    expect(barText).not.toMatch(/[٠-٩۰-۹]/);
    for (const needle of ["$", "\\frac", "\\begin{"]) expect(barText).not.toContain(needle);
  });
});
