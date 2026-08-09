/**
 * fe-1 — the correction wired into the app: every state, and the money clause.
 *
 * THE MONEY CLAUSE: one `/api/generate` run for a correction measured $0.756 and
 * 145 s. Double-clicking the button must issue exactly ONE call. `disabled`
 * re-renders a tick too late to prevent that, so the guard cannot be `disabled`.
 * Two jobs in this product shipped data-loss bugs because every oracle exercised
 * behaviour sequentially; this one does not.
 */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import ExamView from "@/components/ExamView";
import { DRAFTS, EXAM, GEN_CID, REC_SOLUTIONS, expectNoLatex, stored, visibleText } from "./fixtures";

const TID = "0123456789abcdef0123456789abcdef";
const SID = "6a76f42ca530c73b5a723837";
/** The STORING request's own id. A different value with a different meaning. */
const SAVE_CID = "82e1faf5-0000-4000-8000-000000000001";

type Call = { method: string; url: string; body: any; headers: Record<string, string> };

interface Opts {
  /** What GET …/solutions answers with at boot. */
  existing?: Array<Record<string, unknown>>;
  /** Override the generate reply — [status, payload]. */
  generate?: [number, unknown];
  /** Override the save reply — [status, payload]. */
  save?: [number, unknown];
  /** Hold the generate reply open until the returned resolver is called. */
  slowGenerate?: boolean;
  /** Successive answers to GET …/solutions while a batch runs. The last repeats. */
  polled?: Array<Array<Record<string, unknown>>>;
  /** Override POST …/solutions/generate — [status, payload]. */
  start?: [number, unknown];
}

function harness(o: Opts = {}) {
  const calls: Call[] = [];
  let polls = 0;
  let release: (() => void) | null = null;
  const gate = o.slowGenerate ? new Promise<void>((r) => (release = r)) : null;

  const fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? "GET";
    calls.push({
      method,
      url,
      body: init.body ? JSON.parse(init.body as string) : undefined,
      headers: (init.headers ?? {}) as Record<string, string>,
    });
    const res = (status: number, payload: unknown) => ({ ok: status < 300, status, json: async () => payload });

    if (url === "/api/generate") {
      if (gate) await gate;
      const [s, p] = o.generate ?? [200, { data: REC_SOLUTIONS.data, correlationId: GEN_CID, costUsd: REC_SOLUTIONS.costUsd }];
      return res(s, p);
    }
    if (url === "/api/subjects" && method === "GET") {
      return res(200, {
        subjects: [
          { id: SID, title: EXAM.title, exerciseCount: 3, totalPoints: 20, createdAt: "t", updatedAt: "t" },
        ],
      });
    }
    if (url === `/api/subjects/${SID}`) {
      return res(200, { id: SID, createdAt: "t", updatedAt: "t", subject: EXAM, genCorrelationId: "g" });
    }
    /**
     * RE-BASELINED for parallel-exercises fe-3 (declared supersession, WF-65).
     *
     * The WHOLE-EXAM correction moved to `POST …/solutions/generate` (202), after
     * which `be` writes each correction as it lands and `fe` polls `GET …/solutions`
     * — QA bug A, which measured 230 s of `[]` and then three at once. So the
     * whole-exam path no longer spends an `/api/generate` run from `fe` and no longer
     * saves; `be` does both.
     *
     * `/api/generate` + `POST …/solutions` are UNCHANGED and still used, by
     * per-exercise regeneration — the new surface corrects the whole exam and cannot
     * express "just this one". The "stale — regenerating exactly one exercise" block
     * below still drives them and is untouched.
     */
    if (url === `/api/subjects/${SID}/solutions/generate` && method === "POST") {
      if (gate) await gate;
      const [st, pl] = o.start ?? [
        202,
        { subjectId: SID, exerciseIds: ["ex1", "ex2", "ex3"], skipped: [], correlationId: "batch-1" },
      ];
      return res(st, pl);
    }
    if (url === `/api/subjects/${SID}/solutions` && method === "GET") {
      const seq = o.polled;
      if (seq) return res(200, { solutions: seq[Math.min(polls++, seq.length - 1)], correlationId: "c" });
      return res(200, { solutions: o.existing ?? [], correlationId: "c" });
    }
    if (url === `/api/subjects/${SID}/solutions` && method === "POST") {
      const [s, p] = o.save ?? [201, { solutions: stored(), correlationId: SAVE_CID }];
      return res(s, p);
    }
    return res(404, { error: { message: "غير موجود", type: "subject_not_found" } });
  });

  vi.stubGlobal("fetch", fetchMock);
  const of = (url: string, method = "POST") => calls.filter((c) => c.url === url && c.method === method);
  return {
    calls,
    of,
    generates: () => of("/api/generate"),
    /** The whole-exam correction batch — THE new call. */
    batches: () => of(`/api/subjects/${SID}/solutions/generate`),
    saves: () => of(`/api/subjects/${SID}/solutions`),
    release: () => release?.(),
  };
}

async function mountApp() {
  const { default: App } = await import("@/App");
  const r = render(<App />);
  // The subject is open before any of this matters. Matched on the exam heading,
  // not the text: the title also appears in the saved-subjects list.
  await waitFor(() =>
    expect(document.querySelector(".exam__title")?.textContent).toBe(EXAM.title),
  );
  return r;
}

/** Matches the batch label too: fe-3 relabels it «جارٍ تحضير التصحيح…» while one runs. */
const generateBtn = () =>
  screen.getByRole("button", { name: /توليد التصحيح|تحضير التصحيح/ });

/**
 * A real double-click: several presses with NO re-render in between.
 *
 * `fireEvent` flushes React after every call, so by the second one `disabled` is
 * already painted and nothing else is exercised — a burst written with `fireEvent`
 * passes with no guard at all in the app (proved by mutation, 2026-08-08). A real
 * browser dispatches the second click off the same user gesture, before React has
 * repainted, so the presses must land inside ONE `act`.
 */
const burst = async (el: HTMLElement, times = 3) => {
  await act(async () => {
    for (let i = 0; i < times; i++) el.click();
  });
};

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("teacher.id.v1", JSON.stringify(TID));
  localStorage.setItem("teacher.current.v1", JSON.stringify(SID));
  vi.unstubAllGlobals();
  vi.resetModules();
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => cleanup());

describe("idle · empty", () => {
  test("no correction yet → an Arabic empty state and a way to make one", async () => {
    const h = harness();
    await mountApp();
    await waitFor(() => expect(h.of(`/api/subjects/${SID}/solutions`, "GET")).toHaveLength(1));

    const pane = document.querySelector(".solutions-pane")!;
    expect(visibleText(pane)).toMatch(/[؀-ۿ]/);
    expect((visibleText(pane).match(/[A-Za-z]{4,}/g) ?? [])).toEqual([]);
    expect(generateBtn()).toBeTruthy();
    // Nothing was generated just by looking at the page.
    expect(h.generates()).toHaveLength(0);
  });

  test("an existing correction is loaded on open — no generation involved", async () => {
    const h = harness({ existing: stored() });
    await mountApp();

    await waitFor(() => expect(document.querySelectorAll("[data-solution-for]").length).toBe(3));
    expect(h.generates()).toHaveLength(0);
  });
});

describe("generating — and the money clause", () => {
  /**
   * SUPERSEDED by fe-3 — `fe` no longer generates or saves the whole-exam correction.
   *
   * It asked for a run and stored the result, which is exactly why the teacher saw
   * nothing for 230 s: nothing could be shown until the whole batch came back. `be`
   * now owns both halves and writes each correction as it lands. The join-key
   * invariant this clause also carried still holds on the per-exercise path and is
   * pinned in "stale — regenerating exactly one exercise", which is unchanged.
   */
  test("generate starts a BATCH — and `fe` neither runs nor saves it", async () => {
    const h = harness();
    await mountApp();
    fireEvent.click(generateBtn());

    await waitFor(() => expect(h.batches()).toHaveLength(1));
    expect(h.batches()[0].headers["x-teacher-id"]).toBe(TID);
    // No run spent here, and nothing stored from this browser.
    expect(h.generates()).toHaveLength(0);
    expect(h.saves()).toHaveLength(0);
  });

  test("DOUBLE-CLICK issues exactly ONE batch — the money clause, on the new call", async () => {
    // Unchanged in substance: a correction batch is ~200 s of real quota per press,
    // and `disabled` repaints a tick too late to stop a burst off one gesture.
    const h = harness({ slowGenerate: true });
    await mountApp();
    // Three presses, no re-render between them — a real double-click.
    await burst(generateBtn());

    h.release();
    await waitFor(() => expect(h.batches()).toHaveLength(1));
    expect(h.generates()).toHaveLength(0);
  });

  test("while the BATCH runs the control is disabled — not just while the request is", async () => {
    // Strengthened by fe-3. The 202 returns in a moment and the corrections take
    // ~200 s, so disabling on the request alone re-enabled the button for the whole
    // fan-out — which is QA bug B, two tabs and two full runs.
    const h = harness({ polled: [[]] });
    await mountApp();
    fireEvent.click(generateBtn());
    await waitFor(() => expect(h.batches()).toHaveLength(1));

    // The request is long finished and nothing has arrived yet.
    await waitFor(() => expect((generateBtn() as HTMLButtonElement).disabled).toBe(true));
    const pane = document.querySelector(".solutions-pane")!;
    expect(visibleText(pane)).toContain("جارٍ تحضير التصحيح");
    // Pressing again starts nothing.
    await burst(generateBtn());
    expect(h.batches()).toHaveLength(1);
  });

  test("the result the teacher sees comes from the SERVER — `fe` never invents `stale`", async () => {
    // The principle is untouched; only the source moved. It used to be the SAVE
    // response; with fe-3 it is the polled read. Either way `stale` is computed by
    // `be` on every read and `fe` has no way to derive it, so a locally-assembled
    // correction would be one the app cannot tell is current.
    const h = harness({ polled: [[], stored({ ex3: true })] });
    await mountApp();
    fireEvent.click(generateBtn());

    await waitFor(() => expect(document.querySelectorAll("[data-solution-for]").length).toBe(3));
    await waitFor(
      () =>
        expect(
          document.querySelector('[data-solution-for="ex3"]')!.getAttribute("data-stale"),
        ).toBe("true"),
      { timeout: 15_000 },
    );
    expect(h.saves()).toHaveLength(0);
  }, 30_000);
});

describe("stale — regenerating exactly one exercise", () => {
  test("only the stale exercise is re-run, and only it is re-saved", async () => {
    const h = harness({ existing: stored({ ex2: true }) });
    await mountApp();
    await waitFor(() => expect(document.querySelectorAll(".sol__regen").length).toBe(1));

    fireEvent.click(document.querySelector(".sol__regen") as HTMLButtonElement);
    await waitFor(() => expect(h.saves()).toHaveLength(1));

    expect(h.generates()).toHaveLength(1);
    expect(h.generates()[0].body.skill).toBe("solution-sheet");
    expect(h.generates()[0].body.input.exercises.map((e: any) => e.id)).toEqual(["ex2"]);
    // A PARTIAL save — the other two corrections are current and must not be re-stored.
    expect(h.saves()[0].body.solutions.map((s: any) => s.exerciseId)).toEqual(["ex2"]);
  });

  test("double-clicking REGENERATE also issues exactly one run", async () => {
    const h = harness({ existing: stored({ ex2: true }), slowGenerate: true });
    await mountApp();
    await waitFor(() => expect(document.querySelectorAll(".sol__regen").length).toBe(1));

    await burst(document.querySelector(".sol__regen") as HTMLButtonElement, 2);
    h.release();

    await waitFor(() => expect(h.saves()).toHaveLength(1));
    expect(h.generates()).toHaveLength(1);
  });

  test("the whole-exam generate and a single regeneration cannot run at once", async () => {
    const h = harness({ existing: stored({ ex2: true }), slowGenerate: true });
    await mountApp();
    await waitFor(() => expect(document.querySelectorAll(".sol__regen").length).toBe(1));

    // Two DIFFERENT affordances, one gesture apart. `disabled` cannot stop this.
    await act(async () => {
      (document.querySelector(".sol__regen") as HTMLButtonElement).click();
      generateBtn().click();
    });
    h.release();

    await waitFor(() => expect(h.saves()).toHaveLength(1));
    expect(h.generates()).toHaveLength(1);
  });
});

describe("failure — the type decides, not the status", () => {
  test("store_unavailable (503) is retryable, and the retry does NOT regenerate", async () => {
    // Driver moved to the PER-EXERCISE path with fe-3: the whole-exam correction no
    // longer saves from `fe`, so a save failure can only arise where `fe` still
    // stores one. The rule is the same and is the expensive one — a retry that
    // re-ran would charge a second full run for a result the app is still holding.
    const h = harness({
      existing: stored({ ex2: true }),
      save: [503, { error: { message: "الخدمة غير متاحة مؤقتًا", type: "store_unavailable" } }],
    });
    await mountApp();
    await waitFor(() => expect(document.querySelectorAll(".sol__regen").length).toBe(1));
    fireEvent.click(document.querySelector(".sol__regen") as HTMLButtonElement);
    await waitFor(() => expect(h.saves()).toHaveLength(1));

    fireEvent.click(await screen.findByRole("button", { name: "إعادة المحاولة" }));
    await waitFor(() => expect(h.saves()).toHaveLength(2));
    // The $0.76 result is reused. A retry that regenerated would charge twice.
    expect(h.generates()).toHaveLength(1);
    expect(h.saves()[1].body.genCorrelationId).toBe(GEN_CID);
  });

  test("claude_auth (503) is NOT retryable — a human must re-login", async () => {
    // Driver moved to the PER-EXERCISE path with fe-3: this pins `/api/generate`'s
    // error classification, and that route is now reached from the regenerate control
    // rather than the whole-exam button. The rule is untouched — a 503 that needs a
    // human must never be offered as a retry.
    const h = harness({
      existing: stored({ ex2: true }),
      generate: [503, { error: { message: "انتهت جلسة المولّد", type: "claude_auth" } }],
    });
    await mountApp();
    await waitFor(() => expect(document.querySelectorAll(".sol__regen").length).toBe(1));
    fireEvent.click(document.querySelector(".sol__regen") as HTMLButtonElement);

    const alert = await screen.findByRole("alert");
    expect(alert.className).toContain("alert--hard");
    expect(within(alert).queryByRole("button", { name: "إعادة المحاولة" })).toBeNull();
    expect(h.saves()).toHaveLength(0);
  });

  test("a failed run leaves no half-correction on screen", async () => {
    // Same rule on the new surface: if the BATCH cannot even start, the sheet must not
    // appear at all — a correction block with nothing in it is the empty-correction
    // failure this job's whole solutions half exists to prevent.
    harness({ start: [504, { error: { message: "انتهت المهلة", type: "claude_timeout" } }] });
    await mountApp();
    fireEvent.click(generateBtn());

    await screen.findByRole("alert");
    expect(document.querySelectorAll("[data-solution-for]").length).toBe(0);
    expect(document.querySelectorAll(".sol__pending").length).toBe(0);
  });
});

describe("negative — the correction is a SEPARATE surface", () => {
  test("ExamView renders byte-identically to a standalone render", async () => {
    harness({ existing: stored() });
    await mountApp();
    await waitFor(() => expect(document.querySelectorAll("[data-solution-for]").length).toBe(3));

    const inApp = document.querySelector(".exam")!.outerHTML;
    const { container } = render(<ExamView exam={EXAM} refiningId={null} onRefine={() => {}} />);
    expect(inApp).toBe(container.querySelector(".exam")!.outerHTML);
  });

  test("the exam article contains no part of the correction", async () => {
    harness({ existing: stored() });
    await mountApp();
    await waitFor(() => expect(document.querySelectorAll("[data-solution-for]").length).toBe(3));

    const exam = document.querySelector(".exam")!;
    expect(exam.querySelectorAll("[data-solution-for]").length).toBe(0);
    expect(exam.querySelector(".sol__scale")).toBeNull();
    for (const d of DRAFTS) expect(visibleText(exam)).not.toContain(d.scale[0].part.slice(0, 12));
  });

  test("no LaTeX reaches the teacher anywhere on the page", async () => {
    harness({ existing: stored({ ex2: true }) });
    await mountApp();
    await waitFor(() => expect(document.querySelectorAll("[data-solution-for]").length).toBe(3));

    expectNoLatex(visibleText(document.body));
  });
});

describe("obs — relative URLs only", () => {
  test("every call the correction makes is a relative /api/… path", async () => {
    const h = harness({ existing: stored({ ex1: true }) });
    await mountApp();
    await waitFor(() => expect(document.querySelectorAll(".sol__regen").length).toBe(1));
    fireEvent.click(document.querySelector(".sol__regen") as HTMLButtonElement);
    await waitFor(() => expect(h.saves()).toHaveLength(1));

    for (const c of h.calls) {
      expect(c.url.startsWith("/api/")).toBe(true);
      expect(c.url).not.toMatch(/^https?:/);
    }
  });
});
