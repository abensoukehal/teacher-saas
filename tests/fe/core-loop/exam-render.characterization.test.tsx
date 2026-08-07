import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ExamView from "@/components/ExamView";
import { spliceExercise, type ExamSubject } from "@/lib/exam";
import gen1 from "./recordings/gen1.json";
import gen2 from "./recordings/gen2.json";
import gen3 from "./recordings/gen3-curriculum-gap.json";
import refine1 from "./recordings/refine1.json";

const exams: Array<[string, ExamSubject]> = [
  ["gen1", gen1.data as ExamSubject],
  ["gen2", gen2.data as ExamSubject],
  ["gen3", gen3.data as ExamSubject],
];

describe("ExamView renders real recorded exams", () => {
  it.each(exams)("%s: every math span renders, none errors", (_name, exam) => {
    const { container } = render(<ExamView exam={exam} />);
    expect(container.querySelectorAll(".katex").length).toBeGreaterThan(0);
    // KaTeX marks a failed span with .katex-error; zero is the bar.
    expect(container.querySelectorAll(".katex-error").length).toBe(0);
  });

  it.each(exams)("%s: one card per exercise, keyed by id", (_name, exam) => {
    const { container } = render(<ExamView exam={exam} />);
    const cards = container.querySelectorAll("[data-exercise-id]");
    expect(cards.length).toBe(exam.exercises.length);
    expect([...cards].map((c) => c.getAttribute("data-exercise-id"))).toEqual(
      exam.exercises.map((e) => e.id),
    );
  });

  it.each(exams)("%s: NO LaTeX source is visible to the teacher", (_name, exam) => {
    const { container } = render(<ExamView exam={exam} />);
    // KaTeX keeps the source in an invisible <annotation>; strip those first,
    // then assert nothing LaTeX-shaped survives in what a teacher actually reads.
    container.querySelectorAll("annotation, .katex-mathml").forEach((n) => n.remove());
    const visible = (container.textContent ?? "").replace(/\s+/g, " ");
    expect(visible).not.toContain("$");
    expect(visible).not.toContain("\\frac");
    expect(visible).not.toContain("\\text");
    expect(visible).not.toContain("\\dfrac");
    expect(visible).not.toContain("\\begin{");
  });

  it("gen3: the generator's REFUSAL reaches the teacher", () => {
    render(<ExamView exam={gen3.data as ExamSubject} />);
    // meta.assumptions records that الحسابيات was off-programme and substituted.
    expect(screen.getByText(/ملاحظات المولّد/)).toBeTruthy();
    expect(screen.getByText(/الحسابيات/)).toBeTruthy();
  });

  it("print view hides the generator notes but keeps the exercises", () => {
    const { container } = render(<ExamView exam={gen3.data as ExamSubject} printable />);
    expect(container.querySelector(".notice")).toBeNull();
    expect(container.querySelectorAll("[data-exercise-id]").length).toBe(
      (gen3.data as ExamSubject).exercises.length,
    );
  });
});

describe("splice — the core loop's join", () => {
  it("replaces only the refined exercise; the others stay identical", () => {
    const exam = gen1.data as ExamSubject;
    const next = refine1.data as ExamSubject["exercises"][number];
    const after = spliceExercise(exam, next);

    expect(after.exercises.find((e) => e.id === next.id)).toEqual(next);
    for (const e of exam.exercises.filter((x) => x.id !== next.id)) {
      expect(after.exercises.find((x) => x.id === e.id)).toEqual(e);
    }
    // Σ points must survive a refine — a teacher finds a broken total at print time.
    expect(after.exercises.reduce((n, e) => n + e.points, 0)).toBe(exam.meta.totalPoints);
  });

  it("REJECTS a response whose id is not in the exam", () => {
    const exam = gen1.data as ExamSubject;
    const rogue = { ...(refine1.data as ExamSubject["exercises"][number]), id: "ex99" };
    expect(() => spliceExercise(exam, rogue)).toThrow(/unknown exercise id/);
  });
});
