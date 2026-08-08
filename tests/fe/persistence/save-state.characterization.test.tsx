/**
 * fe-4 — never let a teacher believe unsaved work is saved.
 *
 * persist.ts swallows storage errors by design. That was right when the cost was
 * a lost local cache; now the server is the source of truth, so a swallowed
 * NETWORK failure would be the same harm this job exists to prevent, delivered
 * quietly. The save state must be visible and honest.
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const TID = "0123456789abcdef0123456789abcdef";
const EXAM = {
  title: "الموضوع",
  meta: { totalPoints: 20, topic: "الدوال" },
  exercises: [{ id: "ex1", label: "التمرين الأول", points: 20, statement: "أ" }],
};

function mockFetch(handler: (url: string, init: RequestInit) => unknown) {
  const f = vi.fn(async (url: string, init: RequestInit = {}) => handler(url, init));
  vi.stubGlobal("fetch", f);
  return f;
}

const ok = (status: number, payload: unknown) => ({
  ok: status < 300,
  status,
  json: async () => payload,
});

async function bootAndGenerate() {
  const { default: App } = await import("@/App");
  render(<App />);
  await waitFor(() => expect(localStorage.getItem("teacher.id.v1")).toBeTruthy());
  fireEvent.click(screen.getByRole("button", { name: "توليد الموضوع" }));
}

beforeEach(() => {
  localStorage.clear();
  // RE-BASELINED for persistence-gaps fe-1 (declared supersession, WF-65).
  //
  // These suites were written when the app minted an ANONYMOUS teacher id on boot
  // (POST /api/teacher) and walked straight into the builder. fe-1's declared scope is
  // to gate the app on a teacher id and render the auth panel when there is none, so
  // that boot-time mint no longer happens and every one of these mounts stopped at the
  // sign-in screen.
  //
  // The invariants these suites exist for are UNCHANGED — a second exam must not destroy
  // the first, every subject call carries the teacher header, a legacy draft is adopted
  // exactly once. Seeding the id puts the app back in the state each test was actually
  // written to exercise, so the pins keep testing what they were built to test.
  localStorage.setItem("teacher.id.v1", JSON.stringify(TID));
  vi.unstubAllGlobals();
  vi.resetModules();
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => cleanup());

describe("positive — an honest save indicator", () => {
  test("a successful create ends in a visible Arabic 'saved'", async () => {
    mockFetch((url, init) => {
      if (url === "/api/teacher") return ok(201, { teacherId: TID });
      if (url === "/api/generate") return ok(200, { data: EXAM });
      if (url === "/api/subjects" && init.method === "POST") {
        return ok(201, { id: "s1", createdAt: "t", updatedAt: "t", subject: EXAM });
      }
      return ok(200, { subjects: [] });
    });

    await bootAndGenerate();
    await waitFor(() => expect(screen.getByText("تم الحفظ")).toBeTruthy());
    expect(screen.getByRole("status")).toBeTruthy();
  });

  test("a store_unavailable failure shows Arabic + retry, and retry re-issues the create", async () => {
    let creates = 0;
    mockFetch((url, init) => {
      if (url === "/api/teacher") return ok(201, { teacherId: TID });
      if (url === "/api/generate") return ok(200, { data: EXAM });
      if (url === "/api/subjects" && init.method === "POST") {
        creates += 1;
        return ok(503, { error: { message: "لم نتمكّن من الحفظ", type: "store_unavailable" } });
      }
      return ok(200, { subjects: [] });
    });

    await bootAndGenerate();
    await waitFor(() => expect(screen.getByText("لم نتمكّن من الحفظ.")).toBeTruthy());
    expect(creates).toBe(1);

    fireEvent.click(
      screen.getAllByRole("button", { name: "إعادة المحاولة" })[0],
    );
    await waitFor(() => expect(creates).toBe(2));
  });

  test("a claude_auth failure offers NO retry — same 503, opposite advice", async () => {
    mockFetch((url, init) => {
      if (url === "/api/teacher") return ok(201, { teacherId: TID });
      if (url === "/api/generate") return ok(200, { data: EXAM });
      if (url === "/api/subjects" && init.method === "POST") {
        return ok(503, { error: { message: "انتهت الجلسة", type: "claude_auth" } });
      }
      return ok(200, { subjects: [] });
    });

    await bootAndGenerate();
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    // The save indicator must not invite a retry that cannot work.
    expect(screen.queryByText("لم نتمكّن من الحفظ.")).toBeNull();
  });

  test("the indicator is a polite live region, not a blocking dialog", async () => {
    mockFetch((url, init) => {
      if (url === "/api/teacher") return ok(201, { teacherId: TID });
      if (url === "/api/generate") return ok(200, { data: EXAM });
      if (url === "/api/subjects" && init.method === "POST") {
        return ok(201, { id: "s1", createdAt: "t", updatedAt: "t", subject: EXAM });
      }
      return ok(200, { subjects: [] });
    });

    await bootAndGenerate();
    await waitFor(() => expect(screen.getByRole("status")).toBeTruthy());
    expect(screen.getByRole("status").getAttribute("aria-live")).toBe("polite");
  });
});

describe("QA regression — a failed boot must not silently drop every save", () => {
  /**
   * SUPERSEDED by persistence-gaps fe-1 (WF-65), 2026-08-08.
   *
   * This pinned the BOOT-MINT RETRY: POST /api/teacher failed on boot, and the app
   * recovered by minting again later. fe-1 gates the app on a teacher id, so there is no
   * boot mint to fail — identity now comes from sign-in, whose failure states (retryable
   * store_unavailable vs. non-retryable invalid_credentials) are pinned in
   * features/persistence-gaps/tests/fe/auth.characterization.test.tsx.
   *
   * The invariant that outlives the flow is the narrow one asserted here: a flaky
   * identity endpoint must never leave a teacher who HAS an identity unable to save.
   */
  test("a failing /api/teacher never blocks saving for a teacher who has an id", async () => {
    let creates = 0;
    mockFetch((url, init) => {
      // Hard-fail identity issuance for the whole test. It must be irrelevant.
      if (url === "/api/teacher") return { ok: false, status: 500, json: async () => ({}) };
      if (url === "/api/generate") return ok(200, { data: EXAM });
      if (url === "/api/subjects" && init.method === "POST") {
        creates += 1;
        return ok(201, { id: "s1", createdAt: "t", updatedAt: "t", subject: EXAM });
      }
      return ok(200, { subjects: [] });
    });

    const { default: App } = await import("@/App");
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "توليد الموضوع" }));
    await waitFor(() => expect(creates).toBe(1));
  });
});

describe("negative — nothing else changed", () => {
  test("nothing is announced before any write happens", async () => {
    mockFetch((url) => {
      if (url === "/api/teacher") return ok(201, { teacherId: TID });
      return ok(200, { subjects: [] });
    });
    const { default: App } = await import("@/App");
    render(<App />);
    await waitFor(() => expect(localStorage.getItem("teacher.id.v1")).toBeTruthy());
    expect(screen.queryByRole("status")).toBeNull();
  });

  test("the local cache still swallows storage failures — app renders anyway", async () => {
    mockFetch((url) => {
      if (url === "/api/teacher") return ok(201, { teacherId: TID });
      return ok(200, { subjects: [] });
    });
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
