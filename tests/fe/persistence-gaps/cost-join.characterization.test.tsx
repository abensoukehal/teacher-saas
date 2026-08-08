/**
 * fe-2 — stop throwing the generation envelope away.
 *
 * `/api/generate` already returns `{data, costUsd, durationMs, sessionId,
 * correlationId}`. `fe` discarded all but `data` one line before it would have
 * been useful, so nothing tied a stored exam to the run that produced it — and
 * cost-per-exam was unanswerable even in principle.
 *
 * The join key is the deliverable, not the cost: `genCorrelationId` on the
 * subject, joined against `run-log.jsonl`. `costUsd` is deliberately NOT
 * persisted from here — two sources of cost truth drift.
 *
 * THE CONFUSION THIS SUITE EXISTS TO CATCH: the save response carries a
 * `correlationId` of its own — that HTTP request's. It is a different value with
 * a different meaning, and storing it would look right and answer nothing.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

/**
 * The real recorded envelope — 128 s and $0.65 of a real run, replayed.
 *
 * Read through `CHAR_TESTDIR` (which `tools/ci` exports and the shared vitest
 * config already requires) rather than `import.meta.url`: under vite's transform
 * that is not a file: URL, and rather than a bare import, because the fixture
 * sits outside the suite's `server.fs.allow` root.
 */
// The fixture sits BESIDE this suite. It used to be reached for at
// `CHAR_TESTDIR/../be/fixtures/…`, which resolved while the suite lived in the job
// workspace and broke the moment it was promoted — the same fault 94106ed fixed once
// already. A promoted suite must not walk out of its own directory.
const REC = JSON.parse(
  readFileSync(path.join(__dirname, "fixtures/rec-exam-subject.2026-08-07.json"), "utf8"),
) as {
  data: { title: string; exercises: Array<{ id: string; label: string }> };
  costUsd: number;
  durationMs: number;
  sessionId: string;
  correlationId: string;
};

const GEN_CID = "43e41235-f59a-44ad-9b2b-e91cff1f8610";
/** The create request's OWN id, from the same recorded trace. Never the join key. */
const SAVE_CID = "82e1faf5-0000-4000-8000-000000000001";
const TID = "0123456789abcdef0123456789abcdef";

type Call = { method: string; url: string; body: any; headers: Record<string, string> };

function harness(over: { create?: [number, unknown] } = {}) {
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
      return res(200, {
        data: REC.data,
        costUsd: REC.costUsd,
        durationMs: REC.durationMs,
        sessionId: REC.sessionId,
        correlationId: REC.correlationId,
      });
    }
    if (url === "/api/subjects" && method === "POST") {
      const [s, p] = over.create ?? [
        201,
        {
          id: "s1",
          createdAt: "t",
          updatedAt: "t",
          subject: REC.data,
          genCorrelationId: GEN_CID,
          correlationId: SAVE_CID,
        },
      ];
      return res(s, p);
    }
    if (url === "/api/subjects" && method === "GET") return res(200, { subjects: [] });
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

const generate = () => fireEvent.click(screen.getByRole("button", { name: "توليد الموضوع" }));

beforeEach(() => {
  localStorage.clear();
  // Signed in already: this sub-issue is about the save, not the gate.
  localStorage.setItem("teacher.id.v1", JSON.stringify(TID));
  vi.unstubAllGlobals();
  vi.resetModules();
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => cleanup());

describe("the join key reaches the store", () => {
  test("generate → save carries genCorrelationId = the GENERATION's id", async () => {
    const h = harness();
    await mountApp();
    await waitFor(() => expect(screen.getByRole("button", { name: "توليد الموضوع" })).toBeTruthy());
    generate();

    await waitFor(() => expect(h.creates()).toHaveLength(1));
    expect(h.creates()[0].body.genCorrelationId).toBe(GEN_CID);
  });

  test("the two correlation ids stay distinct — the save's own id is NOT the join key", async () => {
    const h = harness();
    await mountApp();
    generate();
    await waitFor(() => expect(h.creates()).toHaveLength(1));

    expect(h.creates()[0].body.genCorrelationId).not.toBe(SAVE_CID);
    expect(h.creates()[0].body.genCorrelationId).toBe(REC.correlationId);
  });

  test("it travels in the BODY — not a header, not a query param", async () => {
    const h = harness();
    await mountApp();
    generate();
    await waitFor(() => expect(h.creates()).toHaveLength(1));

    const c = h.creates()[0];
    // SUPERSEDED by accounts-hardening fe-1 (WF-65), 2026-08-08.
    //
    // This pinned the create body's EXACT key set at a moment when the join key was the
    // whole deliverable and cost deliberately lived only in the run log. accounts-hardening
    // moves cost truth ONTO the subject — `be` stores costUsd/durationMs so the operator's
    // KPIs are a query rather than a file parse — so `fe` now always sends both.
    //
    // The invariant worth keeping is not the key list. It is that the join key is still
    // sent and the request still goes to the right place, which is what it now asserts.
    expect(Object.keys(c.body)).toEqual(expect.arrayContaining(["subject", "genCorrelationId"]));
    expect(c.url).toBe("/api/subjects");
    expect(c.url).not.toContain("?");
    for (const k of Object.keys(c.headers)) expect(k.toLowerCase()).not.toBe("x-correlation-id");
  });

  /**
   * SUPERSEDED by accounts-hardening fe-1 (WF-65), 2026-08-08.
   *
   * This asserted that `fe` does NOT persist costUsd — correct when the run log was the
   * single source of cost truth and the join key was the deliverable. That reasoning was
   * about avoiding TWO sources of truth; accounts-hardening resolves it the other way,
   * moving cost onto the subject so per-exam KPIs are queryable, which is what an operator
   * actually needs.
   *
   * Flipped rather than deleted: the behaviour is now the opposite, and it matters that
   * `null` is sent when there is nothing to record — a zero would corrupt every average.
   */
  test("costUsd IS persisted from fe now — and absence is null, never zero", async () => {
    const h = harness();
    await mountApp();
    generate();
    await waitFor(() => expect(h.creates()).toHaveLength(1));
    const body = h.creates()[0].body as Record<string, unknown>;
    expect(Object.keys(body)).toContain("costUsd");
    expect(Object.keys(body)).toContain("durationMs");
    expect(body.costUsd === null || typeof body.costUsd === "number").toBe(true);
    expect(body.costUsd).not.toBe(0);
  });

  test("legacy adoption sends genCorrelationId: null — it has no generation to point at", async () => {
    localStorage.setItem("teacher.draft.v1", JSON.stringify(REC.data));
    const h = harness();
    await mountApp();

    await waitFor(() => expect(h.creates()).toHaveLength(1));
    // Present and null, not absent-because-forgotten: nullable IS the contract.
    expect(h.creates()[0].body).toHaveProperty("genCorrelationId", null);
  });

  test("A RETRIED save keeps the SAME join key and never invents a second one", async () => {
    // The repeat case, written from the start. A retry that lost the id would
    // store a subject whose cost is unanswerable — the very gap being closed —
    // and one that invented a fresh id would answer it WRONG, which is worse.
    const h = harness({
      create: [503, { error: { message: "الخدمة غير متاحة مؤقتًا", type: "store_unavailable" } }],
    });
    await mountApp();
    generate();
    await waitFor(() => expect(h.creates()).toHaveLength(1));

    fireEvent.click(await screen.findByRole("button", { name: "إعادة المحاولة" }));
    await waitFor(() => expect(h.creates()).toHaveLength(2));

    const [first, second] = h.creates();
    expect(first.body.genCorrelationId).toBe(GEN_CID);
    expect(second.body.genCorrelationId).toBe(GEN_CID);
  });
});

describe("negative — the envelope change is invisible everywhere else", () => {
  test("the recorded exam renders exactly as before", async () => {
    harness();
    await mountApp();
    generate();

    await waitFor(() => expect(screen.getByText(REC.data.title)).toBeTruthy());
    for (const ex of REC.data.exercises) {
      expect(screen.getAllByText(new RegExp(ex.label)).length).toBeGreaterThan(0);
    }
    // Three exercises in, three exercises out — the unwrap did not drop one.
    expect(REC.data.exercises).toHaveLength(3);
  });

  test("a 200 with data:null still throws no_data — the envelope must not swallow it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ data: null, correlationId: "c" }) })),
    );
    const { generateExam, GenerateError } = await import("@/lib/api");
    const err = await generateExam({} as never, new AbortController().signal).catch((e) => e);

    expect(err).toBeInstanceOf(GenerateError);
    expect(err.kind).toBe("no_data");
    expect(err.retryable).toBe(true);
    expect(err.message).toMatch(/[؀-ۿ]/);
  });

  test("generateExam's error mapping and Arabic messages are unchanged", async () => {
    const cases: Array<[string, string, boolean]> = [
      ["claude_auth", "auth", false],
      ["claude_timeout", "timeout", true],
      ["claude_exit", "backend", true],
      ["invalid_request", "bad_request", false],
    ];
    for (const [type, kind, retryable] of cases) {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => ({
          ok: false,
          status: 500,
          json: async () => ({ error: { message: "رسالة بالعربية", type }, correlationId: "c" }),
        })),
      );
      vi.resetModules();
      const { generateExam } = await import("@/lib/api");
      const err = await generateExam({} as never, new AbortController().signal).catch((e) => e);
      expect(err.kind).toBe(kind);
      expect(err.retryable).toBe(retryable);
      expect(err.message).toBe("رسالة بالعربية");
    }
  });

  test("refineExercise still resolves to ONE exercise, not an envelope", async () => {
    // post() is shared with refine. Returning the envelope from the shared
    // transport must not leak into the refine path's shape.
    const one = { id: "ex1", label: "التمرين الأول", points: 7, statement: "نص" };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ data: one, correlationId: "c" }) })),
    );
    const { refineExercise } = await import("@/lib/api");
    const out = await refineExercise(
      { instruction: "غيّر الأرقام", exercise: one as never, exam: REC.data as never },
      new AbortController().signal,
    );
    expect(out).toEqual(one);
  });

  test("the generate REQUEST shape is untouched — /api/generate is frozen", async () => {
    const h = harness();
    await mountApp();
    generate();
    await waitFor(() => expect(h.of("/api/generate")).toHaveLength(1));
    expect(Object.keys(h.of("/api/generate")[0].body).sort()).toEqual(["input", "skill"]);
  });
});
