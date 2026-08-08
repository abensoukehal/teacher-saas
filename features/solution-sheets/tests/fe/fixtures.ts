/**
 * The recorded payloads, read from BESIDE this suite.
 *
 * Never `../be/fixtures/…`: that resolves while the suite lives in the job
 * workspace and breaks the moment it is promoted. Reaching across directories
 * for a fixture has broken promotion three times in this product.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import type { ExamSubject } from "@/lib/exam";

const read = (name: string) =>
  JSON.parse(readFileSync(path.join(__dirname, "fixtures", name), "utf8"));

/** A real exam: ex1/ex2/ex3, points 6+6+8 = meta.totalPoints 20. */
export const EXAM = read("rec-exam-subject.2026-08-07.json").data as ExamSubject;

/**
 * A real `/api/generate {skill:"solution-sheet"}` envelope — $0.756 and 145 s of a
 * real run, replayed. NEVER call the live route from a test.
 */
export const REC_SOLUTIONS = read("rec-solution-sheet.2026-08-08.json") as {
  data: {
    solutions: Array<{
      exerciseId: string;
      answer: string;
      scale: Array<{ part: string; points: number }>;
    }>;
  };
  costUsd: number;
  durationMs: number;
  sessionId: string;
  correlationId: string;
};

export const DRAFTS = REC_SOLUTIONS.data.solutions;
/** The GENERATION's id — the join key, not the storing request's own id. */
export const GEN_CID = REC_SOLUTIONS.correlationId;

/** What `be` answers with: the same rows plus a server-computed `stale`. */
export const stored = (stale: Record<string, boolean> = {}) =>
  DRAFTS.map((s) => ({ ...s, stale: stale[s.exerciseId] ?? false }));

/**
 * Strip KaTeX's invisible `<annotation>` before reading text: the source TeX
 * lives there by design and is not what a teacher sees.
 */
export function visibleText(root: Element): string {
  const clone = root.cloneNode(true) as Element;
  clone.querySelectorAll("annotation, .katex-mathml").forEach((n) => n.remove());
  return (clone.textContent ?? "").replace(/\s+/g, " ");
}

/** The hard constraint, as an assertion. A correction is the densest maths in the
 *  product and therefore the likeliest place to leak LaTeX to a teacher. */
export function expectNoLatex(visible: string) {
  for (const needle of ["$", "\\frac", "\\dfrac", "\\text", "\\sqrt", "\\begin{", "\\lim", "\\("]) {
    expect(visible).not.toContain(needle);
  }
}
