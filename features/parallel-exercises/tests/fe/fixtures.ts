/**
 * The recorded payloads, read from BESIDE this suite.
 *
 * Never `../be/fixtures/…` and never a relative reach into the repo: `__dirname`
 * keeps a fixture with the suite that uses it, which is what survives promotion into
 * `project/tests/fe/`. Reaching across directories for a fixture has broken promotion
 * three times in this product.
 *
 * NOTHING HERE IS GENERATED AT TEST TIME. A real generation costs a full agent loop
 * and 45–122 s; these are replays of runs captured on 2026-08-09 (SEED §9.2).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import type { ExamSubject, Exercise } from "@/lib/exam";

const read = (name: string) =>
  JSON.parse(readFileSync(path.join(__dirname, "fixtures", name), "utf8"));

/**
 * A REAL pre-progressive exam — the 6,086-exam back catalogue, byte for byte.
 *
 * There is no `status` field anywhere in this document, and that is the entire
 * reason it is here. It is the fixture that catches absent→pending.
 */
export const MONOLITH = read("rec-exam-subject.2026-08-07.json").data as ExamSubject;

const REC = read("rec-fanout.2026-08-09.json") as {
  plan: {
    title: string;
    meta: ExamSubject["meta"];
    assignments: Array<{ id: string; label: string; points: number; difficulty: string }>;
  };
  exercises: Record<string, Exercise>;
  truncatedEx1: { chars: number; parses: boolean };
};

/** The recorded `exam-plan` output: points 5+7+8 = 20, difficulty progressive. */
export const PLAN = REC.plan;

/** The two exercises the recorded fan-out returned VALID. */
export const FILLED = REC.exercises;

/**
 * The recorded FAILURE: `exercise-one` returned 906 characters of truncated JSON
 * with `subtype: "success"` and `is_error: false`. ~10% of runs do this (SEED §10.1),
 * which is 27% of 3-exercise exams. It is kept as a fact about the shape rather than
 * as text, because `fe` never sees the raw CLI output — `be` turns it into
 * `status: "failed"`, which is what this suite renders.
 */
export const TRUNCATED_EX1 = REC.truncatedEx1;

/**
 * The subject exactly as `POST /api/exams` answers it — after the plan (~26 s), before
 * any exercise exists. Every id, label and points is already final; every statement is
 * empty (contract §1).
 */
export function skeleton(): ExamSubject {
  return {
    title: PLAN.title,
    meta: PLAN.meta,
    exercises: PLAN.assignments.map((a) => ({
      id: a.id,
      label: a.label,
      points: a.points,
      difficulty: a.difficulty,
      statement: "",
      status: "pending" as const,
    })),
  };
}

/**
 * A real recorded body for an id the FAN-OUT has none for.
 *
 * `FILLED` holds ex2 and ex3 only, because the recorded run's ex1 is the truncated
 * one — the failure this job exists to survive. So a `ready` ex1 borrows the
 * monolith recording's own first exercise: still real recorded model output for
 * «التمرين الأول», never invented text. The plan's id, label and points are kept,
 * because those are the assignment and filling never changes them (contract §5.2).
 */
function borrowed(id: string): Exercise | undefined {
  return MONOLITH.exercises.find((e) => e.id === id);
}

/**
 * The same subject partway through the fan-out.
 *
 * `state` names what each id is now — anything not named stays `pending`, which is
 * what an in-flight exam looks like. A `ready` id takes a recorded statement; a
 * `failed` one keeps the empty statement the placeholder was inserted with, because
 * that is what `be` leaves behind (contract §1).
 */
export function partial(state: Record<string, "ready" | "failed">): ExamSubject {
  const base = skeleton();
  return {
    ...base,
    exercises: base.exercises.map((ex) => {
      const want = state[ex.id];
      if (want === "failed") return { ...ex, status: "failed" as const };
      if (want !== "ready") return ex;
      const body = FILLED[ex.id] ?? borrowed(ex.id);
      if (!body) throw new Error(`no recorded body for ${ex.id} — fixtures cannot invent one`);
      // The ASSIGNMENT wins over the recording: id, label and points are what the
      // plan fixed, and a fill that changed one would be a defect, not a variation.
      return { ...body, id: ex.id, label: ex.label, points: ex.points, status: "ready" as const };
    }),
  };
}

/** A `SubjectRecord` envelope around any subject — what `GET /api/subjects/:id` sends. */
export const record = (id: string, subject: ExamSubject) => ({
  id,
  createdAt: "2026-08-09T05:47:00.000Z",
  updatedAt: "2026-08-09T05:49:00.000Z",
  subject,
  genCorrelationId: "plan-cid-0001",
});

/**
 * Strip KaTeX's invisible `<annotation>` before reading text: the source TeX lives
 * there by design and is not what a teacher sees.
 */
export function visibleText(root: Element): string {
  const clone = root.cloneNode(true) as Element;
  clone.querySelectorAll("annotation, .katex-mathml").forEach((n) => n.remove());
  return (clone.textContent ?? "").replace(/\s+/g, " ");
}

/**
 * THE HARD CONSTRAINT, AS AN ASSERTION. A teacher does not know what LaTeX is and
 * must never be shown any — not in a statement, not in a waiting state, not in a
 * failure message.
 */
export function expectNoLatex(visible: string) {
  for (const needle of [
    "$",
    "\\frac",
    "\\dfrac",
    "\\text",
    "\\sqrt",
    "\\begin{",
    "\\lim",
    "\\mathbb",
    "\\(",
  ]) {
    expect(visible).not.toContain(needle);
  }
}

/**
 * The UI's OWN words — everything a teacher reads except the rendered mathematics.
 *
 * The maths islands are removed rather than kept, because KaTeX legitimately paints
 * Latin letters a teacher is meant to see: `lim`, `f`, `e`, `sin`. Those are
 * mathematical notation, not an English UI string, and lumping them together would
 * make the Arabic-only assertion below unusable on any exam with a limit in it —
 * which is most of them.
 */
export function uiText(root: Element): string {
  const clone = root.cloneNode(true) as Element;
  clone.querySelectorAll("annotation, .katex-mathml, .katex").forEach((n) => n.remove());
  return (clone.textContent ?? "").replace(/\s+/g, " ");
}

/**
 * No English, anywhere a teacher can read. Arabic is the only locale this product
 * has — not a default with a fallback (project hard constraints).
 *
 * Latin letters are the test rather than a word list: a word list only catches the
 * English someone thought of. Digits and punctuation are fine — this app already
 * renders numerals through `.num`. Feed it `uiText`, never `visibleText`.
 */
export function expectNoLatinWords(text: string) {
  const latin = text.match(/[A-Za-z]{2,}/g) ?? [];
  expect(latin).toEqual([]);
}
