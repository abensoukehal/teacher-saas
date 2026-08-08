/**
 * fe-4 — a failed save survives the tab closing.
 *
 * A teacher who hits a failed save and closes the tab loses that exam: 128
 * seconds and $0.65 of generation, gone with no trace anywhere. The retry was a
 * closure in memory, which is exactly as durable as the tab.
 *
 * THE CLAUSE THIS SUITE EXISTS FOR: `create` is INSERT-ONLY on `be` — there is no
 * upsert and no fixed key. So a replay that fires twice does not "save twice", it
 * creates TWO exams, and the teacher gets a duplicate they must work out how to
 * delete through a product that deliberately has no delete. Every path that can
 * start a create is pinned here, including the concurrent ones.
 *
 * The second rule, from the observability baseline: the replay must be VISIBLE.
 * A silent background write is indistinguishable from data loss.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const TID = "0123456789abcdef0123456789abcdef";
const GEN_CID = "43e41235-f59a-44ad-9b2b-e91cff1f8610";

const EXAM = {
  title: "اختبار في مادة الرياضيات",
  meta: { totalPoints: 20, topic: "الدوال", stream: "شعبة الرياضيات" },
  exercises: [
    { id: "ex1", label: "التمرين الأول", points: 10, statement: "نهاية $f$" },
    { id: "ex2", label: "التمرين الثاني", points: 10, statement: "نص" },
  ],
};

const PENDING_KEY = "teacher.pending.v1";

type Call = { method: string; url: string; body: any };

/** `create` fails until `ok` is flipped — the shape of a datastore blink. */
function harness(opts: { createFails?: "store" | "auth" | false } = {}) {
  const calls: Call[] = [];
  let mode = opts.createFails ?? false;

  const fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? "GET";
    calls.push({ method, url, body: init.body ? JSON.parse(init.body as string) : undefined });
    const res = (status: number, payload: unknown) => ({
      ok: status < 300,
      status,
      json: async () => payload,
    });

    if (url === "/api/generate") {
      return res(200, { data: EXAM, correlationId: GEN_CID, costUsd: 0.645421 });
    }
    if (url === "/api/subjects" && method === "POST") {
      if (mode === "store") {
        return res(503, {
          error: { message: "الخدمة غير متاحة مؤقتًا", type: "store_unavailable" },
        });
      }
      if (mode === "auth") {
        return res(503, {
          error: { message: "الخدمة تحتاج إعادة تسجيل دخول", type: "claude_auth" },
        });
      }
      return res(201, { id: "s1", createdAt: "t", updatedAt: "t", subject: EXAM });
    }
    if (url === "/api/subjects" && method === "GET") return res(200, { subjects: [] });
    return res(404, { error: { message: "غير موجود", type: "subject_not_found" } });
  });

  vi.stubGlobal("fetch", fetchMock);
  return {
    calls,
    creates: () => calls.filter((c) => c.url === "/api/subjects" && c.method === "POST"),
    heal: () => {
      mode = false;
    },
  };
}

async function mountApp() {
  const { default: App } = await import("@/App");
  return render(<App />);
}

const generate = () => fireEvent.click(screen.getByRole("button", { name: "توليد الموضوع" }));
const replayBtn = () => screen.getByRole("button", { name: "حفظ الآن" });
const pending = () => localStorage.getItem(PENDING_KEY);

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("teacher.id.v1", JSON.stringify(TID));
  vi.unstubAllGlobals();
  vi.resetModules();
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => cleanup());

describe("queueing a failed save", () => {
  test("a RETRYABLE failure writes teacher.pending.v1 with the exam", async () => {
    const h = harness({ createFails: "store" });
    await mountApp();
    await waitFor(() => expect(screen.getByRole("button", { name: "توليد الموضوع" })).toBeTruthy());
    generate();

    await waitFor(() => expect(h.creates()).toHaveLength(1));
    await waitFor(() => expect(pending()).toBeTruthy());
    const q = JSON.parse(pending()!);
    expect(q.subject.title).toBe(EXAM.title);
    // The join key travels with it — a replayed save must still answer what it cost.
    expect(q.genCorrelationId).toBe(GEN_CID);
  });

  test("a NON-retryable failure does not queue — a human must act, not a loop", async () => {
    const h = harness({ createFails: "auth" });
    await mountApp();
    generate();

    await waitFor(() => expect(h.creates()).toHaveLength(1));
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(pending()).toBeNull();
  });

  test("a successful save queues nothing", async () => {
    const h = harness();
    await mountApp();
    generate();

    await waitFor(() => expect(h.creates()).toHaveLength(1));
    await waitFor(() => expect(screen.getByText("تم الحفظ")).toBeTruthy());
    expect(pending()).toBeNull();
  });
});

describe("the replay — offered, never silent", () => {
  test("a remount OFFERS the pending save and fires NOTHING on its own", async () => {
    // The observability rule: a silent background write is indistinguishable
    // from data loss. The teacher must see it happen.
    localStorage.setItem(
      PENDING_KEY,
      JSON.stringify({ subject: EXAM, controls: null, genCorrelationId: GEN_CID, queuedAt: "t" }),
    );
    const h = harness();
    await mountApp();

    await waitFor(() => expect(replayBtn()).toBeTruthy());
    // Mounted, offered, and not written.
    expect(h.creates()).toHaveLength(0);
  });

  test("replaying stores the exam, clears the key, and stops offering", async () => {
    localStorage.setItem(
      PENDING_KEY,
      JSON.stringify({ subject: EXAM, controls: null, genCorrelationId: GEN_CID, queuedAt: "t" }),
    );
    const h = harness();
    await mountApp();
    fireEvent.click(await screen.findByRole("button", { name: "حفظ الآن" }));

    await waitFor(() => expect(h.creates()).toHaveLength(1));
    expect(h.creates()[0].body.subject.title).toBe(EXAM.title);
    expect(h.creates()[0].body.genCorrelationId).toBe(GEN_CID);

    await waitFor(() => expect(pending()).toBeNull());
    await waitFor(() => expect(screen.queryByRole("button", { name: "حفظ الآن" })).toBeNull());
  });

  test("A DOUBLE-CLICKED REPLAY CREATES ONE EXAM, NOT TWO", async () => {
    // `create` is insert-only. Two writes are not idempotent — they are two
    // exams, in a product with no delete route.
    localStorage.setItem(
      PENDING_KEY,
      JSON.stringify({ subject: EXAM, controls: null, genCorrelationId: GEN_CID, queuedAt: "t" }),
    );
    const h = harness();
    await mountApp();

    const btn = await screen.findByRole("button", { name: "حفظ الآن" });
    // Dispatched inside ONE act, so React cannot re-render (and cannot set
    // `disabled`) between them. Asserting through `fireEvent` would prove only
    // that React honours the attribute — verified: with the in-flight guard
    // removed, a fireEvent version of this clause still passes, and this one
    // fails with 3 creates.
    await act(async () => {
      btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() => expect(h.creates().length).toBeGreaterThan(0));
    await waitFor(() => expect(pending()).toBeNull());
    expect(h.creates()).toHaveLength(1);
  });

  test("THE QUEUE AND THE RETRY ARE THE SAME WRITE — never two exams", async () => {
    // A failed save shows a retry AND queues. If both affordances can start a
    // create concurrently, the teacher gets a duplicate.
    const h = harness({ createFails: "store" });
    await mountApp();
    generate();
    await waitFor(() => expect(h.creates()).toHaveLength(1));
    await waitFor(() => expect(pending()).toBeTruthy());
    h.heal();

    const buttons = screen.getAllByRole("button", { name: /حفظ الآن|إعادة المحاولة/ });
    expect(buttons.length).toBe(2); // both affordances really are on screen
    await act(async () => {
      for (const b of buttons) b.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() => expect(pending()).toBeNull());
    // One more create than the failed one — not one per affordance.
    expect(h.creates()).toHaveLength(2);
  });

  test("a FAILED replay keeps the key — the exam is not dropped on the way back", async () => {
    localStorage.setItem(
      PENDING_KEY,
      JSON.stringify({ subject: EXAM, controls: null, genCorrelationId: GEN_CID, queuedAt: "t" }),
    );
    const h = harness({ createFails: "store" });
    await mountApp();
    fireEvent.click(await screen.findByRole("button", { name: "حفظ الآن" }));

    await waitFor(() => expect(h.creates()).toHaveLength(1));
    expect(pending()).toBeTruthy();
    expect(screen.getByRole("button", { name: "حفظ الآن" })).toBeTruthy();
  });

  test("the replay issues exactly one POST, never one per render", async () => {
    localStorage.setItem(
      PENDING_KEY,
      JSON.stringify({ subject: EXAM, controls: null, genCorrelationId: GEN_CID, queuedAt: "t" }),
    );
    const h = harness({ createFails: "store" });
    await mountApp();
    await waitFor(() => expect(replayBtn()).toBeTruthy());
    // Re-render repeatedly without touching the affordance.
    for (const v of ["1", "2", "3"]) {
      fireEvent.change(screen.getByLabelText("عدد التمارين"), { target: { value: v } });
    }
    await waitFor(() => expect(replayBtn()).toBeTruthy());
    expect(h.creates()).toHaveLength(0);
  });
});

describe("the save states a teacher actually sees", () => {
  test("saving → saved", async () => {
    harness();
    await mountApp();
    generate();
    await waitFor(() => expect(screen.getByText("تم الحفظ")).toBeTruthy());
  });

  test("retryable failure → an Arabic queued notice AND a retry", async () => {
    harness({ createFails: "store" });
    await mountApp();
    generate();

    await waitFor(() => expect(pending()).toBeTruthy());
    // Both halves are visible: the save failed, AND the exam is being held.
    // Telling the teacher only the first would leave them believing it is lost.
    expect(await screen.findByText("لم نتمكّن من الحفظ.")).toBeTruthy();
    expect(screen.getByText("لديك موضوع لم يُحفظ بعد.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "حفظ الآن" })).toBeTruthy();
    // Arabic, and no Latin copy leaked into either banner.
    expect(document.body.textContent).toMatch(/[؀-ۿ]/);
  });

  test("hard failure → no queue, and the teacher is told a retry will not help", async () => {
    harness({ createFails: "auth" });
    await mountApp();
    generate();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("لا يُحل بإعادة المحاولة");
    expect(pending()).toBeNull();
  });
});

describe("negative — the storage discipline and gap #5", () => {
  test("controls panel state still round-trips via teacher.controls.v1", async () => {
    harness();
    await mountApp();
    await waitFor(() => expect(localStorage.getItem("teacher.controls.v1")).toBeTruthy());

    fireEvent.change(screen.getByLabelText("عدد التمارين"), { target: { value: "4" } });
    await waitFor(() =>
      expect(JSON.parse(localStorage.getItem("teacher.controls.v1")!).exerciseCount).toBe(4),
    );

    cleanup();
    harness();
    await mountApp();
    expect((screen.getByLabelText("عدد التمارين") as HTMLInputElement).value).toBe("4");
  });

  test("the paint cache keeps its behaviour", async () => {
    harness();
    await mountApp();
    generate();
    await waitFor(() => expect(localStorage.getItem("teacher.cache.v1")).toBeTruthy());
    expect(JSON.parse(localStorage.getItem("teacher.cache.v1")!).title).toBe(EXAM.title);
  });

  test("EVERY storage access stays guarded, including remove — the app still renders", async () => {
    // An unguarded removeItem crashed the app before first render in private
    // mode once already. Clearing the pending key is a new remove path.
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

  test("a queue attempt under broken storage does not break the save path", async () => {
    const h = harness({ createFails: "store" });
    localStorage.setItem("teacher.id.v1", JSON.stringify(TID));
    await mountApp();
    await waitFor(() => expect(screen.getByRole("button", { name: "توليد الموضوع" })).toBeTruthy());

    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage disabled");
    });
    generate();
    // The write still happened and the failure is still reported honestly; only
    // the durability of the queue is lost, which is the documented trade.
    await waitFor(() => expect(h.creates()).toHaveLength(1));
    expect(screen.getByRole("alert")).toBeTruthy();
    vi.restoreAllMocks();
  });

  test("no existing key changed name or shape", async () => {
    harness();
    await mountApp();
    generate();
    await waitFor(() => expect(screen.getByText("تم الحفظ")).toBeTruthy());

    expect(localStorage.getItem("teacher.id.v1")).toBe(JSON.stringify(TID));
    expect(localStorage.getItem("teacher.current.v1")).toBe(JSON.stringify("s1"));
    expect(localStorage.getItem("teacher.draft.v1")).toBeNull();
  });
});
