/**
 * fe-1 — the typed client for subjects and identity.
 *
 * Pins two things the rest of the frontend depends on:
 *  - every subject call is RELATIVE and carries x-teacher-id (an absolute URL
 *    would make a job lane talk to the main checkout);
 *  - errors are mapped by `error.type`, never by status code. store_unavailable
 *    and claude_auth are BOTH 503 and need opposite advice.
 */
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  GenerateError,
  createSubject,
  getSubject,
  issueTeacher,
  listSubjects,
  replaceStoredExercise,
} from "@/lib/api";
import type { ExamSubject, Exercise } from "@/lib/exam";

const TID = "0123456789abcdef0123456789abcdef";

const SUBJECT: ExamSubject = {
  title: "اختبار في مادة الرياضيات",
  meta: { totalPoints: 20, topic: "الدوال العددية" },
  exercises: [
    { id: "ex1", label: "التمرين الأول", points: 10, statement: "..." },
    { id: "ex2", label: "التمرين الثاني", points: 10, statement: "..." },
  ],
};

function mockOnce(status: number, body: unknown) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("positive — relative URLs and identity on the wire", () => {
  test("issueTeacher posts to a relative /api/teacher and returns the id", async () => {
    const f = mockOnce(201, { teacherId: TID });
    expect(await issueTeacher()).toBe(TID);

    const [url, init] = f.mock.calls[0];
    expect(url).toBe("/api/teacher");
    expect(url.startsWith("/api/")).toBe(true);
    expect(init.method).toBe("POST");
  });

  test("createSubject sends the subject and the teacher header", async () => {
    const f = mockOnce(201, { id: "s1", createdAt: "t", updatedAt: "t", subject: SUBJECT });
    const rec = await createSubject(TID, SUBJECT, { topic: "x" });
    expect(rec.id).toBe("s1");

    const [url, init] = f.mock.calls[0];
    expect(url).toBe("/api/subjects");
    expect(init.headers["x-teacher-id"]).toBe(TID);
    expect(JSON.parse(init.body)).toEqual({ subject: SUBJECT, controls: { topic: "x" } });
  });

  test("listSubjects unwraps the envelope and sends no body on GET", async () => {
    const f = mockOnce(200, { subjects: [{ id: "s1" }, { id: "s2" }] });
    expect(await listSubjects(TID)).toHaveLength(2);

    const [url, init] = f.mock.calls[0];
    expect(url).toBe("/api/subjects");
    expect(init.headers["x-teacher-id"]).toBe(TID);
    expect(init.body).toBeUndefined();
  });

  test("getSubject encodes the id into a relative path", async () => {
    const f = mockOnce(200, { id: "s/1", createdAt: "t", updatedAt: "t", subject: SUBJECT });
    await getSubject(TID, "s/1");
    expect(f.mock.calls[0][0]).toBe("/api/subjects/s%2F1");
  });

  test("replaceStoredExercise PUTs to the exercise path with the exercise body", async () => {
    const f = mockOnce(200, { id: "s1", createdAt: "t", updatedAt: "t", subject: SUBJECT });
    const ex = SUBJECT.exercises[1] as Exercise;
    await replaceStoredExercise(TID, "s1", ex);

    const [url, init] = f.mock.calls[0];
    expect(url).toBe("/api/subjects/s1/exercises/ex2");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toEqual({ exercise: ex });
  });
});

describe("positive — one error variant per contract type (WF-70)", () => {
  const cases: Array<[number, string, string, boolean]> = [
    // status, error.type, expected kind, expected retryable
    [401, "teacher_required", "bad_request", false],
    [404, "subject_not_found", "not_found", false],
    [409, "exercise_not_found", "not_found", false],
    [503, "store_unavailable", "store", true],
  ];

  for (const [status, type, kind, retryable] of cases) {
    test(`${status} ${type} → kind ${kind}, retryable=${retryable}`, async () => {
      mockOnce(status, { error: { message: "رسالة", type }, correlationId: "cid" });
      const err = await listSubjects(TID).catch((e) => e);
      expect(err).toBeInstanceOf(GenerateError);
      expect(err.kind).toBe(kind);
      expect(err.retryable).toBe(retryable);
      expect(err.correlationId).toBe("cid");
    });
  }

  test("store_unavailable and claude_auth are both 503 but map OPPOSITELY", async () => {
    mockOnce(503, { error: { type: "store_unavailable" } });
    const store = await listSubjects(TID).catch((e) => e);

    mockOnce(503, { error: { type: "claude_auth" } });
    const auth = await listSubjects(TID).catch((e) => e);

    expect(store.retryable).toBe(true);
    expect(auth.retryable).toBe(false);
    // If this ever collapses, a teacher is told to re-login because the database blinked.
    expect(store.kind).not.toBe(auth.kind);
  });

  test("an unrecognised type falls back to a retryable backend failure", async () => {
    mockOnce(500, { error: { type: "something_new" } });
    const err = await listSubjects(TID).catch((e) => e);
    expect(err.kind).toBe("backend");
    expect(err.retryable).toBe(true);
  });

  test("a transport failure is a network error, in Arabic", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("boom")));
    const err = await listSubjects(TID).catch((e) => e);
    expect(err.kind).toBe("network");
    expect(err.message).toMatch(/[؀-ۿ]/);
  });
});

describe("negative — the frozen perimeter", () => {
  test("no absolute backend URL is introduced anywhere in the client", async () => {
    const src = await import("@/lib/api?raw").catch(() => null);
    // Fall back to behavioural proof if ?raw is unavailable in this config.
    const f = mockOnce(200, { subjects: [] });
    await listSubjects(TID);
    for (const [url] of f.mock.calls) {
      expect(String(url)).not.toMatch(/^https?:\/\//);
    }
    if (src && typeof (src as { default?: string }).default === "string") {
      expect((src as { default: string }).default).not.toMatch(/https?:\/\/localhost/);
    }
  });

  test("generation's error mapping is unchanged", async () => {
    // The pre-existing table must keep its meanings — this is the frozen contract
    // fe-1 must not disturb while adding four new types to the same map.
    const { generateExam } = await import("@/lib/api");
    mockOnce(503, { error: { type: "claude_auth", message: "x" } });
    const err = await generateExam({} as never, new AbortController().signal).catch((e) => e);
    expect(err.kind).toBe("auth");
    expect(err.retryable).toBe(false);
  });

  test("a 200 generate with data:null is still a failure, not an empty exam", async () => {
    const { generateExam } = await import("@/lib/api");
    mockOnce(200, { data: null, correlationId: "c" });
    const err = await generateExam({} as never, new AbortController().signal).catch((e) => e);
    expect(err.kind).toBe("no_data");
  });
});
