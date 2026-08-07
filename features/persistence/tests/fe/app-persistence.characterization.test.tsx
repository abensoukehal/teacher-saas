/**
 * fe-2 — the source of truth moves to the server, and the orphan draft is adopted.
 *
 * The load-bearing test here is "a second generation creates a SECOND subject".
 * The old code wrote every exam to one fixed localStorage key, so exam #2
 * destroyed exam #1 — silently, with no recovery. That is the defect this job
 * exists to close.
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const TID = "0123456789abcdef0123456789abcdef";

const EXAM_A = {
  title: "الموضوع الأول",
  meta: { totalPoints: 20, topic: "الدوال", stream: "شعبة الرياضيات", level: "3AS" },
  exercises: [
    { id: "ex1", label: "التمرين الأول", points: 10, statement: "أ" },
    { id: "ex2", label: "التمرين الثاني", points: 10, statement: "ب" },
  ],
};
const EXAM_B = { ...EXAM_A, title: "الموضوع الثاني" };

/** Records every call so the assertions can talk about the wire, not the UI. */
function harness() {
  const calls: Array<{ method: string; url: string; body: unknown; teacher?: string }> = [];
  let generateCount = 0;
  let createCount = 0;

  const fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? "GET";
    const body = init.body ? JSON.parse(init.body as string) : undefined;
    const teacher = (init.headers as Record<string, string> | undefined)?.["x-teacher-id"];
    calls.push({ method, url, body, teacher });

    const ok = (status: number, payload: unknown) => ({
      ok: status < 300,
      status,
      json: async () => payload,
    });

    if (url === "/api/teacher") return ok(201, { teacherId: TID });
    if (url === "/api/generate") {
      // refine returns ONE exercise, generate returns a whole subject — the two
      // skills share this route and must not be conflated.
      if ((body as { skill?: string })?.skill === "refine-exercise") {
        return ok(200, {
          data: { ...EXAM_A.exercises[0], statement: "مُعدّل" },
          correlationId: "c",
        });
      }
      generateCount += 1;
      return ok(200, { data: generateCount === 1 ? EXAM_A : EXAM_B, correlationId: "c" });
    }
    if (url === "/api/subjects" && method === "POST") {
      createCount += 1;
      return ok(201, {
        id: `s${createCount}`,
        createdAt: "t",
        updatedAt: "t",
        subject: body.subject,
      });
    }
    if (url === "/api/subjects" && method === "GET") return ok(200, { subjects: [] });
    if (method === "PUT") return ok(200, { id: "s1", createdAt: "t", updatedAt: "t", subject: EXAM_A });
    return ok(404, { error: { message: "no", type: "subject_not_found" } });
  });

  vi.stubGlobal("fetch", fetchMock);
  return { calls, creates: () => calls.filter((c) => c.url === "/api/subjects" && c.method === "POST") };
}

async function generate() {
  fireEvent.click(screen.getByRole("button", { name: "توليد الموضوع" }));
}

beforeEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.resetModules();
  // jsdom does not implement scrollIntoView, and RefinePanel calls it on mount to
  // bring the panel into view. A jsdom gap, not a product bug — stubbed here
  // rather than in the shared engine setup file, which travels between clones.
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
});

describe("THE DEFECT — a second exam must not destroy the first", () => {
  test("two generations issue two creates with different subject ids", async () => {
    const h = harness();
    const { default: App } = await import("@/App");
    render(<App />);
    await waitFor(() => expect(localStorage.getItem("teacher.id.v1")).toBeTruthy());

    await generate();
    await waitFor(() => expect(h.creates()).toHaveLength(1));
    await generate();
    await waitFor(() => expect(h.creates()).toHaveLength(2));

    const [first, second] = h.creates();
    // Two distinct exams were sent — nothing was overwritten client-side either.
    expect((first.body as { subject: { title: string } }).subject.title).toBe("الموضوع الأول");
    expect((second.body as { subject: { title: string } }).subject.title).toBe("الموضوع الثاني");
  });

  test("there is no single fixed exam key left as the source of truth", async () => {
    const h = harness();
    const { default: App } = await import("@/App");
    render(<App />);
    await waitFor(() => expect(localStorage.getItem("teacher.id.v1")).toBeTruthy());
    await generate();
    await waitFor(() => expect(h.creates()).toHaveLength(1));

    // The old key must not be resurrected as storage.
    expect(localStorage.getItem("teacher.draft.v1")).toBeNull();
    // The current subject is tracked by SERVER id, not by a slot.
    expect(localStorage.getItem("teacher.current.v1")).toBe(JSON.stringify("s1"));
  });
});

describe("F1 — identity", () => {
  test("no stored id → exactly one POST /api/teacher, and it is persisted", async () => {
    const h = harness();
    const { default: App } = await import("@/App");
    render(<App />);
    await waitFor(() => expect(localStorage.getItem("teacher.id.v1")).toBe(JSON.stringify(TID)));
    expect(h.calls.filter((c) => c.url === "/api/teacher")).toHaveLength(1);
  });

  test("an existing id → ZERO POST /api/teacher", async () => {
    localStorage.setItem("teacher.id.v1", JSON.stringify(TID));
    const h = harness();
    const { default: App } = await import("@/App");
    render(<App />);
    await generate();
    await waitFor(() => expect(h.creates()).toHaveLength(1));
    expect(h.calls.filter((c) => c.url === "/api/teacher")).toHaveLength(0);
  });

  test("every subject call carries the teacher header", async () => {
    const h = harness();
    const { default: App } = await import("@/App");
    render(<App />);
    await waitFor(() => expect(localStorage.getItem("teacher.id.v1")).toBeTruthy());
    await generate();
    await waitFor(() => expect(h.creates()).toHaveLength(1));
    for (const c of h.creates()) expect(c.teacher).toBe(TID);
  });
});

describe("F1 — one-shot adoption of the pre-persistence draft", () => {
  test("a legacy draft is posted once and the key is then cleared", async () => {
    localStorage.setItem("teacher.draft.v1", JSON.stringify(EXAM_A));
    const h = harness();
    const { default: App } = await import("@/App");
    render(<App />);

    await waitFor(() => expect(h.creates()).toHaveLength(1));
    expect((h.creates()[0].body as { subject: { title: string } }).subject.title).toBe(
      "الموضوع الأول",
    );
    await waitFor(() => expect(localStorage.getItem("teacher.draft.v1")).toBeNull());
  });

  test("a FAILED adoption does NOT clear the key — the draft survives", async () => {
    localStorage.setItem("teacher.draft.v1", JSON.stringify(EXAM_A));
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === "/api/teacher") {
          return { ok: true, status: 201, json: async () => ({ teacherId: TID }) };
        }
        return {
          ok: false,
          status: 503,
          json: async () => ({ error: { message: "لم نتمكّن من الحفظ", type: "store_unavailable" } }),
        };
      }),
    );
    const { default: App } = await import("@/App");
    render(<App />);

    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    // The whole point: a failed migration must never destroy the teacher's work.
    expect(localStorage.getItem("teacher.draft.v1")).toBe(JSON.stringify(EXAM_A));
  });

  test("no legacy draft → nothing is posted at boot", async () => {
    const h = harness();
    const { default: App } = await import("@/App");
    render(<App />);
    await waitFor(() => expect(localStorage.getItem("teacher.id.v1")).toBeTruthy());
    expect(h.creates()).toHaveLength(0);
  });
});

describe("F3 — a refinement writes through to the store", () => {
  test("refining issues PUT /api/subjects/:id/exercises/:exerciseId", async () => {
    const h = harness();
    const { default: App } = await import("@/App");
    render(<App />);
    await waitFor(() => expect(localStorage.getItem("teacher.id.v1")).toBeTruthy());
    await generate();
    await waitFor(() => expect(h.creates()).toHaveLength(1));

    await waitFor(() => expect(screen.getAllByRole("button", { name: "تعديل هذا التمرين" }).length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByRole("button", { name: "تعديل هذا التمرين" })[0]);

    // Controls also renders text inputs, so target the panel's textarea by placeholder.
    const box = screen.getByPlaceholderText("اكتب ما تريد تغييره بلغتك…");
    fireEvent.change(box, { target: { value: "صغّر الأعداد" } });
    fireEvent.click(screen.getByRole("button", { name: "طبّق التعديل" }));

    await waitFor(() => {
      expect(h.calls.some((c) => c.method === "PUT" && /\/api\/subjects\/s1\/exercises\//.test(c.url))).toBe(true);
    });
  });
});

describe("negative — the frozen perimeter", () => {
  test("controls persistence is unchanged, same key", async () => {
    harness();
    const { default: App } = await import("@/App");
    render(<App />);
    await waitFor(() => expect(localStorage.getItem("teacher.controls.v1")).toBeTruthy());
  });

  test("the generate request shape is unchanged", async () => {
    const h = harness();
    const { default: App } = await import("@/App");
    render(<App />);
    await waitFor(() => expect(localStorage.getItem("teacher.id.v1")).toBeTruthy());
    await generate();
    const gen = h.calls.find((c) => c.url === "/api/generate");
    expect(gen).toBeDefined();
    expect(gen!.method).toBe("POST");
    // still {skill, input} — be's contract was not touched by this job
    expect(Object.keys(gen!.body as object).sort()).toEqual(["input", "skill"]);
  });

  test("spliceExercise still throws on an unknown id (exam.ts untouched)", async () => {
    const { spliceExercise } = await import("@/lib/exam");
    expect(() =>
      spliceExercise(EXAM_A as never, { ...EXAM_A.exercises[0], id: "ex99" } as never),
    ).toThrow();
  });

  test("storage failures are still swallowed — the app renders anyway", async () => {
    harness();
    const boom = () => {
      throw new Error("storage disabled");
    };
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(boom);
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(boom);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(boom);

    const { default: App } = await import("@/App");
    expect(() => render(<App />)).not.toThrow();
    vi.restoreAllMocks();
  });
});
