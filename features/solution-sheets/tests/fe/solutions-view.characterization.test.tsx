/**
 * fe-1 — the correction as a teacher reads it.
 *
 * A correction is the densest maths in the product, and the grading scale is the
 * trap: its `part` strings carry `$…$` too. Printing them raw would put `\dfrac`
 * in front of a teacher, which the product forbids outright.
 */
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import SolutionView from "@/components/SolutionView";
import { DRAFTS, EXAM, expectNoLatex, stored, visibleText } from "./fixtures";

afterEach(() => cleanup());

const view = (over: Record<string, unknown> = {}) =>
  render(<SolutionView exam={EXAM} solutions={stored()} {...(over as never)} />);

describe("the correction renders, per exercise, in exam order", () => {
  test("one block per exercise, keyed by the exercise id", () => {
    const { container } = view();
    const blocks = [...container.querySelectorAll("[data-solution-for]")];
    expect(blocks.map((b) => b.getAttribute("data-solution-for"))).toEqual(["ex1", "ex2", "ex3"]);
  });

  test("each block carries the exercise's own label and points", () => {
    const { container } = view();
    for (const ex of EXAM.exercises) {
      const block = container.querySelector(`[data-solution-for="${ex.id}"]`)!;
      const text = visibleText(block);
      expect(text).toContain(ex.label);
      expect(text).toContain(String(ex.points));
    }
  });

  test("the grading scale is rendered — every part, with its points", () => {
    const { container } = view();
    for (const draft of DRAFTS) {
      const block = container.querySelector(`[data-solution-for="${draft.exerciseId}"]`)!;
      const parts = block.querySelectorAll(".sol__scale-part");
      expect(parts.length).toBe(draft.scale.length);
      const text = visibleText(block);
      for (const p of draft.scale) expect(text).toContain(String(p.points));
    }
  });

  test("an exercise with no correction yet says so — it is never silently skipped", () => {
    const { container } = view({ solutions: stored().filter((s) => s.exerciseId !== "ex2") });
    expect(container.querySelectorAll("[data-solution-for]").length).toBe(3);
    const ex2 = container.querySelector('[data-solution-for="ex2"]')!;
    expect(ex2.className).toContain("sol--missing");
    expect(visibleText(ex2)).toMatch(/[؀-ۿ]/);
  });
});

describe("maths — through KaTeX, and no LaTeX ever visible", () => {
  test("the answers render as KaTeX, with no KaTeX errors", () => {
    const { container } = view();
    expect(container.querySelectorAll(".katex").length).toBeGreaterThan(0);
    expect(container.querySelectorAll(".katex-error").length).toBe(0);
  });

  test("the GRADING SCALE's maths goes through KaTeX too — the likeliest leak", () => {
    const { container } = view();
    const scale = container.querySelector(".sol__scale")!;
    expect(scale.querySelectorAll(".katex").length).toBeGreaterThan(0);
    expectNoLatex(visibleText(scale));
  });

  test("NO LaTeX source is visible anywhere in the correction", () => {
    const { container } = view();
    expectNoLatex(visibleText(container));
  });

  test("stale or current, the constraint holds", () => {
    const { container } = view({ solutions: stored({ ex1: true, ex2: true, ex3: true }) });
    expectNoLatex(visibleText(container));
  });
});

describe("Arabic only, RTL", () => {
  test("no Latin word survives in what a teacher reads", () => {
    const { container } = view();
    const words = visibleText(container).match(/[A-Za-z]{4,}/g) ?? [];
    expect(words).toEqual([]);
  });

  test("nothing forces an LTR direction on the correction", () => {
    const { container } = view();
    expect(container.querySelector('[dir="ltr"]')).toBeNull();
  });
});

describe("stale — the clause that makes a correction safe to hand out", () => {
  test("a stale solution is MARKED stale, in Arabic", () => {
    const { container } = view({ solutions: stored({ ex2: true }) });
    const ex2 = container.querySelector('[data-solution-for="ex2"]')!;

    expect(ex2.className).toContain("sol--stale");
    expect(ex2.getAttribute("data-stale")).toBe("true");
    expect(ex2.querySelector(".sol__stale")).not.toBeNull();
    expect(visibleText(ex2.querySelector(".sol__stale")!)).toMatch(/[؀-ۿ]/);
  });

  test("it is never rendered as though it were current — the others are untouched", () => {
    const { container } = view({ solutions: stored({ ex2: true }) });
    for (const id of ["ex1", "ex3"]) {
      const b = container.querySelector(`[data-solution-for="${id}"]`)!;
      expect(b.getAttribute("data-stale")).toBe("false");
      expect(b.querySelector(".sol__stale")).toBeNull();
    }
  });

  test("a stale solution offers regeneration of JUST that exercise", () => {
    const seen: string[] = [];
    const { container } = view({
      solutions: stored({ ex2: true }),
      onRegenerate: (ex: { id: string }) => seen.push(ex.id),
    });
    const buttons = [...container.querySelectorAll<HTMLButtonElement>(".sol__regen")];
    expect(buttons).toHaveLength(1);
    buttons[0].click();
    expect(seen).toEqual(["ex2"]);
  });

  test("while that one regenerates, every regenerate control is disabled", () => {
    const { container } = view({
      solutions: stored({ ex1: true, ex2: true }),
      onRegenerate: () => {},
      regeneratingId: "ex2",
    });
    const buttons = [...container.querySelectorAll<HTMLButtonElement>(".sol__regen")];
    expect(buttons.length).toBe(2);
    expect(buttons.every((b) => b.disabled)).toBe(true);
  });
});
