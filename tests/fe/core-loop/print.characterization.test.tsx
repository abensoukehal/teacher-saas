import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ExamView from "@/components/ExamView";
import type { ExamSubject } from "@/lib/exam";
import gen1 from "../../iterations/01-initial/recordings/gen1.json";
import gen3 from "../../iterations/01-initial/recordings/gen3-curriculum-gap.json";

const exam = gen1.data as ExamSubject;

describe("printable view (fe-6)", () => {
  it("keeps the paper: title, meta and every exercise", () => {
    const { container } = render(<ExamView exam={exam} printable />);
    expect(container.querySelector(".exam__title")?.textContent).toBe(exam.title);
    expect(container.querySelectorAll("[data-exercise-id]").length).toBe(exam.exercises.length);
    expect(container.querySelector(".exam__meta")?.textContent).toContain(
      String(exam.meta.totalPoints),
    );
  });

  it("drops the generator's notes — guidance for the teacher, not the students' paper", () => {
    const { container } = render(<ExamView exam={gen3.data as ExamSubject} printable />);
    expect(container.querySelector(".notice")).toBeNull();
  });

  it("offers no refine affordance in print", () => {
    const { container } = render(<ExamView exam={exam} printable onRefine={() => {}} />);
    expect(container.querySelector(".ex__refine")).toBeNull();
  });

  it("still renders math, with no KaTeX errors", () => {
    const { container } = render(<ExamView exam={exam} printable />);
    expect(container.querySelectorAll(".katex").length).toBeGreaterThan(0);
    expect(container.querySelectorAll(".katex-error").length).toBe(0);
  });
});
