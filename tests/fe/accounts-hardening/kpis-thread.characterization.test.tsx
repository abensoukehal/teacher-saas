/**
 * fe-1 — stop discarding the two numbers.
 *
 * `/api/generate` returns `{data, costUsd, durationMs, sessionId, correlationId}`.
 * The persistence-gaps job kept `correlationId` and deliberately dropped `costUsd`,
 * on the reasoning that the run log was the one source of cost truth. be-1 moved that
 * truth onto the subject document, so the two numbers now have to REACH it — nothing
 * else in the system can answer "what did this exam take to produce" once the per-lane
 * JSONL is out of the picture.
 *
 * WHAT THIS SUITE EXISTS TO CATCH, in order of how expensive the mistake is:
 *  1. a path that INVENTS the numbers — a zero, or a fresh measurement — because every
 *     invented value silently corrupts `avgCostUsdPerExam` for the whole system;
 *  2. a retry or a race that DROPS them, leaving an exam whose cost is unanswerable;
 *  3. a teacher ever being shown one. `costUsd` is a usage signal under a subscription,
 *     not money (contract §1), and fe-1 stores it — it does not render it.
 *
 * Never calls `/api/generate`. The envelope is a recorded run replayed from beside
 * this suite, read with `__dirname` so promotion cannot break the path.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const REC = JSON.parse(
  readFileSync(path.join(__dirname, "fixtures/rec-exam-subject.2026-08-07.json"), "utf8"),
) as {
  data: { title: string; exercises: Array<{ id: string; label: string }> };
  costUsd: number;
  durationMs: number;
  sessionId: string;
  correlationId: string;
};

/** The GENERATION's id — the join key. Never the save request's own id. */
const GEN_CID = REC.correlationId;
const TID = "0123456789abcdef0123456789abcdef";

type Call = { method: string; url: string; body: any; headers: Record<string, string> };

function harness(
  over: { create?: [number, unknown]; envelope?: Record<string, unknown> } = {},
) {
  const calls: Call[] = [];
  const fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? "GET";
    calls.push({
      method,
      url,
      body: init.body ? JSON.parse(init.body as string) : undefined,
      headers: (init.headers ?? {}) as Record<string, string>,
    });
    const res = (status: number, payload: unknown) => ({
      ok: status < 300,
      status,
      json: async () => payload,
    });

    if (url === "/api/generate") {
      return res(
        200,
        over.envelope ?? {
          data: REC.data,
          costUsd: REC.costUsd,
          durationMs: REC.durationMs,
          sessionId: REC.sessionId,
          correlationId: REC.correlationId,
        },
      );
    }
    if (url === "/api/subjects" && method === "POST") {
      const [s, p] = over.create ?? [
        201,
        { id: "s1", createdAt: "t", updatedAt: "t", subject: REC.data, genCorrelationId: GEN_CID },
      ];
      return res(s, p);
    }
    if (url === "/api/subjects" && method === "GET") return res(200, { subjects: [] });
    if (url.startsWith("/api/subjects/")) return res(200, { solutions: [] });
    return res(404, { error: { message: "غير موجود", type: "subject_not_found" } });
  });

  vi.stubGlobal("fetch", fetchMock);
  const of = (u: string, m = "POST") => calls.filter((c) => c.url === u && c.method === m);
  return { calls, of, creates: () => of("/api/subjects") };
}

async function mountApp() {
  const { default: App } = await import("@/App");
  return render(<App />);
}

/**
 * RE-BASELINED for parallel-exercises fe-2 (declared supersession, WF-65), 2026-08-09.
 *
 * Same supersession as cost-join, for the same reason. Exam creation moved to
 * POST /api/exams, where `be` inserts the skeleton and then sets `costUsd`,
 * `durationMs` and `genCorrelationId` itself once the fan-out finishes
 * (routes/exams.ts → setKpis; one correlation id per exam across all spawns). `fe`
 * cannot measure a run that completes after the response, so on that path it sends
 * none of them — and inventing a number would answer the cost question WRONG, which
 * project/CLAUDE.md calls out as worse than not answering it.
 *
 * The pair still travels from `fe` on the one path that still creates a subject — the
 * replay of a queued save — so that is the driver, and every rule these clauses exist
 * for (numbers not strings, null never zero, never re-measured on a retry, one exam per
 * double-click) is still pinned on the code that still does it.
 */
const QUEUED = {
  subject: REC.data,
  controls: null,
  genCorrelationId: GEN_CID,
  costUsd: REC.costUsd,
  durationMs: REC.durationMs,
  queuedAt: "t",
};
const seedQueue = (over: Partial<typeof QUEUED> = {}) =>
  localStorage.setItem("teacher.pending.v1", JSON.stringify({ ...QUEUED, ...over }));
/** Replay a queued save — the surviving path that sends the pair from `fe`. */
const generate = () => fireEvent.click(screen.getByRole("button", { name: "حفظ الآن" }));
const awaitReplay = async () =>
  waitFor(() => expect(screen.getByRole("button", { name: "حفظ الآن" })).toBeTruthy());

/** The progressive path, stubbed. `be` fills the numbers in after the fan-out. */
function progressive(calls: Array<{ method: string; url: string; body: any }>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const method = init.method ?? "GET";
      calls.push({ method, url, body: init.body ? JSON.parse(init.body as string) : undefined });
      const res = (status: number, payload: unknown) => ({
        ok: status < 300,
        status,
        json: async () => payload,
      });
      if (url === "/api/exams") {
        return res(201, { subjectId: "s1", subject: REC.data, correlationId: GEN_CID });
      }
      if (url === "/api/subjects" && method === "GET") return res(200, { subjects: [] });
      if (url === "/api/subjects/s1") {
        return res(200, {
          id: "s1",
          createdAt: "t",
          updatedAt: "t",
          subject: REC.data,
          genCorrelationId: GEN_CID,
          costUsd: REC.costUsd,
          durationMs: REC.durationMs,
        });
      }
      return res(404, { error: { message: "غير موجود", type: "subject_not_found" } });
    }),
  );
}
const startExamFromUI = async () => {
  await waitFor(() => expect(screen.getByRole("button", { name: "توليد الموضوع" })).toBeTruthy());
  fireEvent.click(screen.getByRole("button", { name: "توليد الموضوع" }));
};

beforeEach(() => {
  localStorage.clear();
  // Already signed in: this sub-issue is about the save body, not the gate.
  localStorage.setItem("teacher.id.v1", JSON.stringify(TID));
  vi.unstubAllGlobals();
  vi.resetModules();
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => cleanup());

describe("the two numbers reach the store", () => {
  test("a replayed save carries costUsd and durationMs from THAT run", async () => {
    seedQueue();
    const h = harness();
    await mountApp();
    await awaitReplay();
    generate();

    await waitFor(() => expect(h.creates()).toHaveLength(1));
    const body = h.creates()[0].body;
    expect(body.costUsd).toBe(REC.costUsd);
    expect(body.durationMs).toBe(REC.durationMs);
    // Numbers, not strings: `be` rejects a non-number with 400, and a stringified
    // figure would be a 400 that only ever fires in production.
    expect(typeof body.costUsd).toBe("number");
    expect(typeof body.durationMs).toBe("number");
  });

  test("they travel in the BODY, beside the join key — not a header, not a query param", async () => {
    seedQueue();
    const h = harness();
    await mountApp();
    await awaitReplay();
    generate();
    await waitFor(() => expect(h.creates()).toHaveLength(1));

    const c = h.creates()[0];
    expect(Object.keys(c.body).sort()).toEqual([
      "controls",
      "costUsd",
      "durationMs",
      "genCorrelationId",
      "subject",
    ]);
    expect(c.url).toBe("/api/subjects");
    expect(c.url).not.toContain("?");
    for (const k of Object.keys(c.headers)) {
      expect(k.toLowerCase()).not.toBe("x-cost-usd");
      expect(k.toLowerCase()).not.toBe("x-duration-ms");
    }
    // The join key is not replaced by the numbers — it still answers a different question.
    expect(c.body.genCorrelationId).toBe(GEN_CID);
  });

  test("legacy-draft adoption sends null for BOTH — an adopted draft has no generation", async () => {
    // The clause that protects every average in the system. A legacy draft was never
    // generated through this app, so there is nothing to measure; a zero would read as
    // a free, instant run and drag `avgCostUsdPerExam` down for good.
    localStorage.setItem("teacher.draft.v1", JSON.stringify(REC.data));
    const h = harness();
    await mountApp();

    await waitFor(() => expect(h.creates()).toHaveLength(1));
    const body = h.creates()[0].body;
    // Present AND null, not absent-because-forgotten: nullable IS the contract.
    expect(body).toHaveProperty("costUsd", null);
    expect(body).toHaveProperty("durationMs", null);
    expect(body.costUsd).not.toBe(0);
    expect(body.durationMs).not.toBe(0);
    expect(body).toHaveProperty("genCorrelationId", null);
  });

  test("an envelope WITHOUT the numbers sends null, never zero and never a guess", async () => {
    // `be` has always been free to omit them, and a run that fails to report is not a
    // run that cost nothing. Same rule as the legacy path, reached from the other side.
    seedQueue({ costUsd: undefined, durationMs: undefined });
    const h = harness({
      envelope: { data: REC.data, correlationId: GEN_CID },
    });
    await mountApp();
    await awaitReplay();
    generate();

    await waitFor(() => expect(h.creates()).toHaveLength(1));
    const body = h.creates()[0].body;
    expect(body).toHaveProperty("costUsd", null);
    expect(body).toHaveProperty("durationMs", null);
  });

  test("a RETRIED save re-sends the SAME pair — never dropped, never re-measured", async () => {
    seedQueue();
    const h = harness({
      create: [503, { error: { message: "الخدمة غير متاحة مؤقتًا", type: "store_unavailable" } }],
    });
    await mountApp();
    await awaitReplay();
    generate();
    await waitFor(() => expect(h.creates()).toHaveLength(1));

    fireEvent.click(await screen.findByRole("button", { name: "إعادة المحاولة" }));
    await waitFor(() => expect(h.creates()).toHaveLength(2));

    for (const c of h.creates()) {
      expect(c.body.costUsd).toBe(REC.costUsd);
      expect(c.body.durationMs).toBe(REC.durationMs);
      expect(c.body.genCorrelationId).toBe(GEN_CID);
    }
  });

  test("a queued save that outlives the tab replays with the numbers still attached", async () => {
    // The pending intent is what a reload replays. If the pair rode in a closure instead
    // of in the stored intent, the replayed exam would land with null KPIs and nothing
    // would ever say so.
    localStorage.setItem(
      "teacher.pending.v1",
      JSON.stringify({
        subject: REC.data,
        controls: null,
        genCorrelationId: GEN_CID,
        costUsd: REC.costUsd,
        durationMs: REC.durationMs,
        queuedAt: "2026-08-08T00:00:00.000Z",
      }),
    );
    const h = harness();
    await mountApp();

    fireEvent.click(await screen.findByRole("button", { name: "حفظ الآن" }));
    await waitFor(() => expect(h.creates()).toHaveLength(1));
    expect(h.creates()[0].body.costUsd).toBe(REC.costUsd);
    expect(h.creates()[0].body.durationMs).toBe(REC.durationMs);
  });

  test("RACE — two retry presses in ONE act() still make exactly one exam", async () => {
    // `fireEvent` flushes React between events, so two separate calls would only prove
    // that `disabled` works. Both clicks are dispatched inside a single `act()` so the
    // component cannot re-render between them — which is the only version of this that
    // exercises the ref guard. `create` is insert-only: a second create is a second exam,
    // in a product with no delete route, and it would double-count in every KPI average.
    seedQueue();
    const h = harness({
      create: [503, { error: { message: "الخدمة غير متاحة مؤقتًا", type: "store_unavailable" } }],
    });
    await mountApp();
    await awaitReplay();
    generate();
    await waitFor(() => expect(h.creates()).toHaveLength(1));

    const retry = await screen.findByRole("button", { name: "إعادة المحاولة" });
    await act(async () => {
      retry.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      retry.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() => expect(h.creates().length).toBeGreaterThanOrEqual(2));
    expect(h.creates()).toHaveLength(2); // the original + ONE retry, not two
    expect(h.creates()[1].body.costUsd).toBe(REC.costUsd);
  });
});

describe("negative — nothing else moved", () => {
  test("the recorded exam renders exactly as before", async () => {
    progressive([]);
    await mountApp();
    await startExamFromUI();

    await waitFor(() => expect(screen.getByText(REC.data.title)).toBeTruthy());
    for (const ex of REC.data.exercises) {
      expect(screen.getAllByText(new RegExp(ex.label)).length).toBeGreaterThan(0);
    }
    expect(REC.data.exercises).toHaveLength(3);
  });

  test("no usage figure is ever shown to a teacher", async () => {
    // fe-1 STORES the numbers; it does not render them. `costUsd` is not money and the
    // teacher-facing surface has no business carrying an operator's metric at all.
    // Driven through the progressive path, where the numbers now come BACK from `be`
    // on the subject read — which is the version of this that could newly leak one.
    progressive([]);
    await mountApp();
    await startExamFromUI();
    await waitFor(() => expect(screen.getByText(REC.data.title)).toBeTruthy());

    const text = document.body.textContent ?? "";
    expect(text).not.toContain(String(REC.costUsd));
    expect(text).not.toContain(String(REC.durationMs));
    expect(text).not.toContain("costUsd");
    expect(text).not.toContain("$");
    expect(text).not.toContain("USD");
  });

  /**
   * SUPERSEDED by parallel-exercises fe-2 — asserted at module level, same as cost-join.
   * `/api/generate` is still frozen and still takes {skill, input}; the exam-creation
   * FLOW simply no longer goes through it, so the button cannot observe it any more.
   */
  test("the generate REQUEST shape is untouched — /api/generate is frozen", async () => {
    const calls: Array<{ url: string; body: any }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit = {}) => {
        calls.push({ url, body: JSON.parse(init.body as string) });
        return { ok: true, status: 200, json: async () => ({ data: REC.data, correlationId: "c" }) };
      }),
    );
    const { generateExam } = await import("@/lib/api");
    await generateExam(
      { skill: "exam-subject", input: { topic: "الدوال" } } as never,
      new AbortController().signal,
    );
    expect(calls[0]!.url).toBe("/api/generate");
    expect(Object.keys(calls[0]!.body).sort()).toEqual(["input", "skill"]);
  });

  test("refineExercise still resolves to ONE exercise, not an envelope", async () => {
    const one = { id: "ex1", label: "التمرين الأول", points: 7, statement: "نص" };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ data: one, correlationId: "c", costUsd: 0.1, durationMs: 5 }),
      })),
    );
    const { refineExercise } = await import("@/lib/api");
    const out = await refineExercise(
      { instruction: "غيّر الأرقام", exercise: one as never, exam: REC.data as never },
      new AbortController().signal,
    );
    expect(out).toEqual(one);
  });

  test("replaceStoredExercise does not acquire KPI fields — only create measures a run", async () => {
    const calls: Call[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit = {}) => {
        calls.push({
          method: init.method ?? "GET",
          url,
          body: init.body ? JSON.parse(init.body as string) : undefined,
          headers: {},
        });
        return { ok: true, status: 200, json: async () => ({ id: "s1", subject: REC.data }) };
      }),
    );
    const { replaceStoredExercise } = await import("@/lib/api");
    await replaceStoredExercise(TID, "s1", { id: "ex1", label: "ل", points: 1 } as never);
    expect(Object.keys(calls[0].body).sort()).toEqual(["exercise"]);
  });
});
