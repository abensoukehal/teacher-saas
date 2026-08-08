/**
 * fe-2 — a printable correction sheet, separate from the exam.
 *
 * THE LOAD-BEARING NEGATIVE: the exam's print output must stay byte-identical.
 * The teacher prints the exam for the class and keeps the correction; a sheet
 * carrying both is worse than useless, and the failure mode is a class receiving
 * the answer key. `exam-print-baseline.html` is recorded from the frozen `ExamView`
 * and compared verbatim.
 *
 * REFRESHED 2026-08-08, and the reason matters. `teacher-fe` merged an unrelated fix
 * (PR #4) that renders the generator's `**…**` as real bold instead of literal asterisks,
 * and this job then rebased onto it. The exam's printed HTML legitimately changed —
 * `<span>**الجزء الأول**</span>` became a bold run — so the baseline was re-dumped.
 *
 * That is exactly the move that can hide a regression, so it was earned, not assumed:
 * `git diff origin/main...HEAD -- src/components/ExamView.tsx src/lib/katex.tsx
 * src/lib/exam.ts` is EMPTY for this job. The change came from the base, not from here,
 * and the bold run is the only divergence.
 *
 * Print rules cannot be exercised by jsdom — it applies no `@media print`. So the
 * scoping is pinned on both sides of the seam it actually lives on: the DOM marker
 * the app sets while printing, and the rule in `App.css` that reads it. Asserting
 * only the marker would let the stylesheet forget to use it, which is precisely
 * the leak.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import ExamView from "@/components/ExamView";
import SolutionView from "@/components/SolutionView";
import { DRAFTS, EXAM, expectNoLatex, stored, visibleText } from "./fixtures";

const TID = "0123456789abcdef0123456789abcdef";
const SID = "6a76f42ca530c73b5a723837";

const baseline = (name: string) =>
  readFileSync(path.join(__dirname, "fixtures", name), "utf8");

/** The app's stylesheet, read as text — the only way to pin a print rule here. */
const CSS = readFileSync(
  path.join(process.env.CHAR_ROOTDIR ?? ".", "src/App.css"),
  "utf8",
);

/** The body of `@media print { … }`, so a rule outside it cannot satisfy a clause. */
function printBlock(): string {
  const at = CSS.indexOf("@media print");
  expect(at).toBeGreaterThan(-1);
  const open = CSS.indexOf("{", at);
  let depth = 0;
  for (let i = open; i < CSS.length; i++) {
    if (CSS[i] === "{") depth++;
    else if (CSS[i] === "}" && --depth === 0) return CSS.slice(open + 1, i);
  }
  throw new Error("unterminated @media print");
}

function harness() {
  const printed: string[] = [];
  vi.stubGlobal(
    "print",
    vi.fn(() => {
      // What the printer would see: the mode marker as it stands AT print time.
      printed.push(document.querySelector(".app")?.getAttribute("data-print") ?? "");
    }),
  );
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const method = init.method ?? "GET";
      const res = (status: number, payload: unknown) => ({ ok: status < 300, status, json: async () => payload });
      if (url === "/api/subjects" && method === "GET") return res(200, { subjects: [] });
      if (url === `/api/subjects/${SID}`) {
        return res(200, { id: SID, createdAt: "t", updatedAt: "t", subject: EXAM });
      }
      if (url === `/api/subjects/${SID}/solutions` && method === "GET") {
        return res(200, { solutions: stored({ ex2: true }), correlationId: "c" });
      }
      return res(404, { error: { message: "غير موجود", type: "subject_not_found" } });
    }),
  );
  return { printed };
}

async function mountApp() {
  const { default: App } = await import("@/App");
  const r = render(<App />);
  await waitFor(() => expect(document.querySelectorAll("[data-solution-for]").length).toBe(3));
  return r;
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("teacher.id.v1", JSON.stringify(TID));
  localStorage.setItem("teacher.current.v1", JSON.stringify(SID));
  vi.unstubAllGlobals();
  vi.resetModules();
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => cleanup());

describe("THE NEGATIVE — the students' paper is unchanged", () => {
  test("ExamView's printable output is byte-identical to the recorded baseline", () => {
    const { container } = render(<ExamView exam={EXAM} printable />);
    expect(container.innerHTML).toBe(baseline("exam-print-baseline.html"));
  });

  test("ExamView's on-screen output is byte-identical too — nothing here touched it", () => {
    const { container } = render(<ExamView exam={EXAM} refiningId={null} onRefine={() => {}} />);
    expect(container.innerHTML).toBe(baseline("exam-screen-baseline.html"));
  });

  test("printing the EXAM hides the correction — the rule exists, inside @media print", () => {
    const block = printBlock().replace(/\s+/g, " ");
    expect(block).toMatch(/\[data-print="exam"\][^{}]*\.solutions[^{}]*\{[^{}]*display:\s*none/);
  });

  test("printing the CORRECTION hides the exam — a correction sheet is not a paper", () => {
    const block = printBlock().replace(/\s+/g, " ");
    expect(block).toMatch(/\[data-print="solutions"\][^{}]*\.exam[^{}]*\{[^{}]*display:\s*none/);
  });

  test("the default mode is `exam` — an untriggered Ctrl+P still prints the paper", async () => {
    harness();
    await mountApp();
    expect(document.querySelector(".app")?.getAttribute("data-print")).toBe("exam");
  });
});

describe("two print actions, distinct", () => {
  test("both exist, and they are not the same control", async () => {
    harness();
    await mountApp();
    const exam = screen.getByRole("button", { name: "طباعة الموضوع" });
    const sol = screen.getByRole("button", { name: "طباعة التصحيح" });
    expect(exam).not.toBe(sol);
  });

  test("printing the exam marks the page `exam` AT print time, and prints once", async () => {
    const h = harness();
    await mountApp();
    fireEvent.click(screen.getByRole("button", { name: "طباعة الموضوع" }));

    await waitFor(() => expect(h.printed).toEqual(["exam"]));
  });

  test("printing the correction marks the page `solutions` AT print time, and prints once", async () => {
    const h = harness();
    await mountApp();
    fireEvent.click(screen.getByRole("button", { name: "طباعة التصحيح" }));

    await waitFor(() => expect(h.printed).toEqual(["solutions"]));
  });

  test("after printing the correction the page returns to `exam`", async () => {
    const h = harness();
    await mountApp();
    fireEvent.click(screen.getByRole("button", { name: "طباعة التصحيح" }));
    await waitFor(() => expect(h.printed).toEqual(["solutions"]));

    await waitFor(() => expect(document.querySelector(".app")?.getAttribute("data-print")).toBe("exam"));
  });

  test("with no correction there is nothing to print — the action is not offered", async () => {
    vi.stubGlobal("print", vi.fn());
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit = {}) => {
        const method = init.method ?? "GET";
        const res = (s: number, p: unknown) => ({ ok: s < 300, status: s, json: async () => p });
        if (url === "/api/subjects" && method === "GET") return res(200, { subjects: [] });
        if (url === `/api/subjects/${SID}`) return res(200, { id: SID, createdAt: "t", updatedAt: "t", subject: EXAM });
        if (url === `/api/subjects/${SID}/solutions`) return res(200, { solutions: [], correlationId: "c" });
        return res(404, { error: { message: "غير موجود", type: "subject_not_found" } });
      }),
    );
    const { default: App } = await import("@/App");
    render(<App />);
    await waitFor(() => expect(screen.getByRole("button", { name: "طباعة الموضوع" })).toBeTruthy());
    expect(screen.queryByRole("button", { name: "طباعة التصحيح" })).toBeNull();
  });
});

describe("the printable correction itself", () => {
  const printable = (over: Record<string, unknown> = {}) =>
    render(<SolutionView exam={EXAM} solutions={stored()} printable {...(over as never)} />);

  test("every exercise's answer and scale, in exam order, with label and points", () => {
    const { container } = printable();
    const blocks = [...container.querySelectorAll("[data-solution-for]")];
    expect(blocks.map((b) => b.getAttribute("data-solution-for"))).toEqual(["ex1", "ex2", "ex3"]);

    for (const ex of EXAM.exercises) {
      const b = container.querySelector(`[data-solution-for="${ex.id}"]`)!;
      const text = visibleText(b);
      expect(text).toContain(ex.label);
      expect(text).toContain(String(ex.points));
      const draft = DRAFTS.find((d) => d.exerciseId === ex.id)!;
      expect(b.querySelectorAll(".sol__scale-part").length).toBe(draft.scale.length);
    }
  });

  test("a STALE correction is marked stale IN PRINT — the paper must say so too", () => {
    const { container } = printable({ solutions: stored({ ex2: true }) });
    const ex2 = container.querySelector('[data-solution-for="ex2"]')!;

    expect(ex2.getAttribute("data-stale")).toBe("true");
    expect(ex2.querySelector(".sol__stale")).not.toBeNull();
    // Not only a badge — the sentence survives, because a badge alone can be missed
    // on paper and the reader cannot hover it.
    expect(ex2.querySelector(".sol__stale-note")).not.toBeNull();
    expect(visibleText(ex2)).toMatch(/[؀-ۿ]/);
  });

  test("no stale marker is printed on a current correction", () => {
    const { container } = printable({ solutions: stored({ ex2: true }) });
    for (const id of ["ex1", "ex3"]) {
      expect(container.querySelector(`[data-solution-for="${id}"] .sol__stale`)).toBeNull();
    }
  });

  test("the print sheet offers no interactive affordance", () => {
    const { container } = printable({ onRegenerate: () => {} });
    expect(container.querySelector(".sol__regen")).toBeNull();
    expect(container.querySelectorAll("button").length).toBe(0);
  });

  test("Arabic only, no LaTeX, nothing forced LTR", () => {
    const { container } = printable({ solutions: stored({ ex1: true }) });
    const text = visibleText(container);
    expectNoLatex(text);
    expect(text.match(/[A-Za-z]{4,}/g) ?? []).toEqual([]);
    expect(container.querySelector('[dir="ltr"]')).toBeNull();
  });

  test("maths still renders through KaTeX on paper", () => {
    const { container } = printable();
    expect(container.querySelectorAll(".katex").length).toBeGreaterThan(0);
    expect(container.querySelectorAll(".katex-error").length).toBe(0);
  });
});
