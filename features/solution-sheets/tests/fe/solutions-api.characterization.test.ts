/**
 * fe-1 — the three calls a correction needs.
 *
 *   generateSolutions  → POST /api/generate {skill:"solution-sheet"}   (FROZEN route)
 *   saveSolutions      → POST /api/subjects/:id/solutions              (pure storage)
 *   listSolutions      → GET  /api/subjects/:id/solutions
 *
 * Two things this suite exists to pin:
 *
 * 1. **Every URL is relative.** An absolute backend URL compiled into app code is
 *    THE bug that makes a job lane silently talk to the main checkout's API.
 * 2. **Failures branch on `error.type`, never on the status code.** `claude_auth`
 *    and `store_unavailable` are both 503 and mean opposite things — one needs a
 *    human to re-login, the other is a plain retry.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { DRAFTS, EXAM, GEN_CID, REC_SOLUTIONS, stored } from "./fixtures";

type Call = { method: string; url: string; body: any; headers: Record<string, string> };

const TID = "0123456789abcdef0123456789abcdef";
const SID = "6a76f42ca530c73b5a723837";

function net(reply: (c: Call) => { status: number; payload: unknown }) {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const c: Call = {
        method: init.method ?? "GET",
        url,
        body: init.body ? JSON.parse(init.body as string) : undefined,
        headers: (init.headers ?? {}) as Record<string, string>,
      };
      calls.push(c);
      const { status, payload } = reply(c);
      return { ok: status < 300, status, json: async () => payload };
    }),
  );
  return calls;
}

const ok = (payload: unknown) => () => ({ status: 200, payload });

beforeEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});
afterEach(() => vi.unstubAllGlobals());

describe("generateSolutions — the ONE spawn point, unchanged", () => {
  test("the request is {skill:'solution-sheet', input:<the stored exam>} and nothing else", async () => {
    const calls = net(ok({ data: REC_SOLUTIONS.data, correlationId: GEN_CID }));
    const { generateSolutions } = await import("@/lib/api");
    await generateSolutions(EXAM, new AbortController().signal);

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("/api/generate");
    expect(calls[0].method).toBe("POST");
    // /api/generate is FROZEN. Exactly the two keys the existing skills use.
    expect(Object.keys(calls[0].body).sort()).toEqual(["input", "skill"]);
    expect(calls[0].body.skill).toBe("solution-sheet");
    expect(calls[0].body.input).toEqual(EXAM);
  });

  test("it returns the drafts AND the run's correlation id — the join key", async () => {
    net(ok({ data: REC_SOLUTIONS.data, correlationId: GEN_CID, costUsd: REC_SOLUTIONS.costUsd }));
    const { generateSolutions } = await import("@/lib/api");
    const out = await generateSolutions(EXAM, new AbortController().signal);

    expect(out.solutions).toEqual(DRAFTS);
    expect(out.correlationId).toBe(GEN_CID);
    expect(out.costUsd).toBe(REC_SOLUTIONS.costUsd);
  });

  test("a single-exercise regeneration sends ONLY that exercise", async () => {
    const calls = net(ok({ data: { solutions: [DRAFTS[1]] }, correlationId: GEN_CID }));
    const { buildSolutionRequest, generateSolutions } = await import("@/lib/api");
    const one = { ...EXAM, exercises: [EXAM.exercises[1]] };
    await generateSolutions(one, new AbortController().signal);

    expect(calls[0].body.input.exercises.map((e: any) => e.id)).toEqual(["ex2"]);
    expect(buildSolutionRequest(one).skill).toBe("solution-sheet");
  });

  test("a 200 with data:null is a FAILED run, not an empty correction", async () => {
    net(() => ({ status: 200, payload: { data: null, correlationId: "c" } }));
    const { generateSolutions, GenerateError } = await import("@/lib/api");
    const err = await generateSolutions(EXAM, new AbortController().signal).catch((e) => e);

    expect(err).toBeInstanceOf(GenerateError);
    expect(err.kind).toBe("no_data");
    expect(err.message).toMatch(/[؀-ۿ]/);
  });
});

describe("saveSolutions — pure storage", () => {
  test("POSTs the batch to the subject's own path, with the teacher id", async () => {
    const calls = net(() => ({ status: 201, payload: { solutions: stored(), correlationId: "c" } }));
    const { saveSolutions } = await import("@/lib/api");
    const out = await saveSolutions(TID, SID, DRAFTS, GEN_CID);

    expect(calls[0].method).toBe("POST");
    expect(calls[0].url).toBe(`/api/subjects/${SID}/solutions`);
    expect(calls[0].headers["x-teacher-id"]).toBe(TID);
    expect(Object.keys(calls[0].body).sort()).toEqual(["genCorrelationId", "solutions"]);
    expect(calls[0].body.genCorrelationId).toBe(GEN_CID);
    // The server's answer is authoritative — it carries `stale`, which fe cannot compute.
    expect(out.map((s) => s.stale)).toEqual([false, false, false]);
  });

  test("a PARTIAL batch is a first-class request — that is how one stale correction is redone", async () => {
    const calls = net(() => ({ status: 201, payload: { solutions: stored(), correlationId: "c" } }));
    const { saveSolutions } = await import("@/lib/api");
    await saveSolutions(TID, SID, [DRAFTS[1]], GEN_CID);

    expect(calls[0].body.solutions).toHaveLength(1);
    expect(calls[0].body.solutions[0].exerciseId).toBe("ex2");
  });
});

describe("listSolutions", () => {
  test("GETs the subject's solutions and carries `stale` through verbatim", async () => {
    const calls = net(ok({ solutions: stored({ ex2: true }), correlationId: "c" }));
    const { listSolutions } = await import("@/lib/api");
    const out = await listSolutions(TID, SID);

    expect(calls[0].method).toBe("GET");
    expect(calls[0].url).toBe(`/api/subjects/${SID}/solutions`);
    expect(out.map((s) => [s.exerciseId, s.stale])).toEqual([
      ["ex1", false],
      ["ex2", true],
      ["ex3", false],
    ]);
  });

  test("no correction yet is an EMPTY LIST with a 200 — never a 404", async () => {
    net(ok({ solutions: [], correlationId: "c" }));
    const { listSolutions } = await import("@/lib/api");
    expect(await listSolutions(TID, SID)).toEqual([]);
  });
});

describe("errors — branch on error.type, NEVER the status code", () => {
  test.each([
    // type, status, kind, retryable
    ["store_unavailable", 503, "store", true],
    ["claude_auth", 503, "auth", false],
    ["subject_not_found", 404, "not_found", false],
    ["invalid_request", 400, "bad_request", false],
    ["teacher_required", 401, "bad_request", false],
  ])("%s (%i) → %s, retryable=%s", async (type, status, kind, retryable) => {
    net(() => ({ status, payload: { error: { message: "رسالة بالعربية", type }, correlationId: "c" } }));
    const { listSolutions } = await import("@/lib/api");
    const err = await listSolutions(TID, SID).catch((e) => e);

    expect(err.type).toBe(type);
    expect(err.kind).toBe(kind);
    expect(err.retryable).toBe(retryable);
    expect(err.message).toBe("رسالة بالعربية");
  });

  test("the two 503s are told apart — the same status, opposite meanings", async () => {
    const { listSolutions } = await import("@/lib/api");
    const at = async (type: string) => {
      net(() => ({ status: 503, payload: { error: { message: "م", type } } }));
      return listSolutions(TID, SID).catch((e) => e);
    };
    expect((await at("store_unavailable")).retryable).toBe(true);
    expect((await at("claude_auth")).retryable).toBe(false);
  });
});

describe("obs — no absolute URL may exist in app code", () => {
  test("every solution call is a relative /api/… path", async () => {
    const calls = net(() => ({ status: 200, payload: { data: REC_SOLUTIONS.data, solutions: [] } }));
    const api = await import("@/lib/api");
    await api.generateSolutions(EXAM, new AbortController().signal);
    await api.listSolutions(TID, SID);
    await api.saveSolutions(TID, SID, DRAFTS, GEN_CID).catch(() => {});

    expect(calls.length).toBeGreaterThanOrEqual(3);
    for (const c of calls) {
      expect(c.url.startsWith("/api/")).toBe(true);
      expect(c.url).not.toMatch(/^https?:/);
    }
  });
});
