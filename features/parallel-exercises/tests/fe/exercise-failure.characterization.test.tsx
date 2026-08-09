/**
 * fe-2 — reach the progressive path, and show a failed exercise honestly.
 *
 * TWO HALVES, and the first one is why this sub-issue was amended.
 *
 * **Reachability.** fe-1 shipped `startExam` tested but uncalled, because the promoted
 * net bound «توليد الموضوع» to `/api/generate` and fe-1 had to keep that net green.
 * SEED §5 exit criterion 1 is not met until a teacher can actually press something, so
 * the button is repointed here. `/api/generate` stays FROZEN as a *surface* — the
 * solution sheet still spends its run there, and there is a clause below proving it —
 * but exam creation no longer goes through it.
 *
 * **Honesty about a hole.** 27% of 3-exercise exams will have one (SEED §10.1, 1−0.9³).
 * The teacher must see which exercise is missing, in their language, with no id and no
 * error code, and be able to ask for it again without losing the ones that worked.
 *
 * The shapes are a LIVE recording (lane 6, 2026-08-09), not contract guesses.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import App from "@/App";
import ExamView from "@/components/ExamView";
import { statusOf } from "@/lib/exam";
import {
  LIVE_FINAL,
  LIVE_REGEN,
  LIVE_START,
  MONOLITH,
  PLAN,
  expectNoLatex,
  expectNoLatinWords,
  partial,
  record,
  skeleton,
  uiText,
  visibleText,
} from "./fixtures";

const TID = "0123456789abcdef0123456789abcdef";
const SID = "6a76f42ca530c73b5a723837";

type Call = { method: string; url: string; body: any; headers: Record<string, string> };

interface Opts {
  /** Successive answers to GET /api/subjects/:id. The last one repeats. */
  reads?: ReturnType<typeof record>[];
  /** Override POST /api/exams — [status, payload]. */
  exams?: [number, unknown];
  /** Override the regenerate reply — [status, payload]. */
  regen?: [number, unknown];
  /** Nothing open at boot, so the app starts on an empty workspace. */
  noCurrent?: boolean;
  /**
   * Hold POST /api/exams open until `release()`.
   *
   * Needed to observe the WAIT at all: an instantly-resolving mock sets and clears
   * `busy` inside one microtask, so the progress state exists for no render — which
   * would make the assertion below pass or fail on scheduling rather than on copy.
   */
  slowExams?: boolean;
}

function harness(o: Opts = {}) {
  const calls: Call[] = [];
  let n = 0;
  let release: (() => void) | null = null;
  const gate = o.slowExams ? new Promise<void>((r) => (release = r)) : null;
  const fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? "GET";
    calls.push({
      method,
      url,
      body: init.body ? JSON.parse(init.body as string) : undefined,
      headers: (init.headers ?? {}) as Record<string, string>,
    });
    const res = (status: number, payload: unknown) => ({
      ok: status < 300,
      status,
      json: async () => payload,
    });

    if (url === "/api/exams" && method === "POST") {
      if (gate) await gate;
      return res(...(o.exams ?? [201, { subjectId: SID, subject: skeleton(), correlationId: "plan-1" }]));
    }
    if (url === "/api/subjects" && method === "GET") {
      return res(200, {
        subjects: [
          { id: SID, title: PLAN.title, exerciseCount: 3, totalPoints: 20, createdAt: "t", updatedAt: "t" },
        ],
      });
    }
    if (url === `/api/subjects/${SID}` && method === "GET") {
      const seq = o.reads ?? [record(SID, partial({ ex2: "ready", ex3: "ready", ex1: "failed" }))];
      return res(200, seq[Math.min(n++, seq.length - 1)]);
    }
    if (url.endsWith("/regenerate") && method === "POST") {
      return res(
        ...(o.regen ?? [200, record(SID, partial({ ex1: "ready", ex2: "ready", ex3: "ready" }))]),
      );
    }
    if (url === "/api/generate" && method === "POST") {
      return res(200, { data: { solutions: [] }, correlationId: "sol-1" });
    }
    if (url.endsWith("/solutions")) return res(200, { solutions: [] });
    return res(404, { error: { message: "not found", type: "not_found" } });
  });

  vi.stubGlobal("fetch", fetchMock);
  localStorage.setItem("teacher.id.v1", JSON.stringify(TID));
  if (!o.noCurrent) localStorage.setItem("teacher.current.v1", JSON.stringify(SID));

  const of = (url: string, method = "POST") =>
    calls.filter((c) => c.url === url && c.method === method);
  return {
    calls,
    of,
    exams: () => of("/api/exams"),
    generates: () => of("/api/generate"),
    regenerates: () => calls.filter((c) => c.url.endsWith("/regenerate") && c.method === "POST"),
    release: () => release?.(),
  };
}

const generate = () =>
  fireEvent.click(screen.getByRole("button", { name: "توليد الموضوع" }));

beforeEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.resetModules();
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => cleanup());

// ---------------------------------------------------------------------------------
// THE AMENDED SCOPE — the path is reachable
// ---------------------------------------------------------------------------------

describe("«توليد الموضوع» starts a PROGRESSIVE run", () => {
  test("the button posts /api/exams — not /api/generate — and paints the skeleton", async () => {
    const h = harness({
      noCurrent: true,
      reads: [record(SID, partial({ ex2: "ready" }))],
    });
    await act(async () => {
      render(<App />);
    });
    await waitFor(() => expect(screen.getByRole("button", { name: "توليد الموضوع" })).toBeTruthy());

    await act(async () => {
      generate();
    });

    await waitFor(() => expect(h.exams()).toHaveLength(1));
    // THE CLAUSE THE WHOLE JOB HANGS ON. Without it nothing a teacher can press
    // reaches the progressive path, and SEED §5 exit criterion 1 is unmet.
    expect(h.generates()).toHaveLength(0);
    expect(h.exams()[0]!.headers["x-teacher-id"]).toBe(TID);
    // The controls, unwrapped — no {skill, input} envelope on this surface.
    expect(Object.keys(h.exams()[0]!.body).sort()).toEqual(
      ["difficulty", "durationMinutes", "exerciseCount", "format", "level", "stream", "topic"].sort(),
    );

    // The paper is on screen straight away, with its marks already right.
    await waitFor(() => expect(document.querySelectorAll("section.ex")).toHaveLength(3));
    expect(document.body.textContent).toContain("العلامة: 20/20");
    expect(document.body.textContent).toContain("جارٍ كتابة هذا التمرين");
  }, 20_000);

  test("the first ready exercise paints WITHOUT waiting for the rest", async () => {
    // The win the job ships (SEED §3), as a render assertion: one real statement on
    // screen while two slots are still being written.
    const h = harness({
      noCurrent: true,
      reads: [record(SID, partial({ ex2: "ready" }))],
    });
    await act(async () => {
      render(<App />);
    });
    await waitFor(() => expect(screen.getByRole("button", { name: "توليد الموضوع" })).toBeTruthy());
    await act(async () => {
      generate();
    });
    await waitFor(() => expect(h.exams()).toHaveLength(1));

    await waitFor(
      () => expect(document.querySelectorAll("section.ex .statement")).toHaveLength(1),
      { timeout: 15_000 },
    );
    expect(document.querySelectorAll(".ex__placeholder")).toHaveLength(2);
  }, 25_000);

  test("it does NOT create a subject — `be` already stored the skeleton", async () => {
    // `create` is insert-only and there is no delete route, so a create here would be
    // a SECOND exam, not a save. This is the clause that catches someone reinstating
    // the old createOnce call out of habit.
    const h = harness({ noCurrent: true, reads: [record(SID, partial({ ex2: "ready" }))] });
    await act(async () => {
      render(<App />);
    });
    await waitFor(() => expect(screen.getByRole("button", { name: "توليد الموضوع" })).toBeTruthy());
    await act(async () => {
      generate();
    });
    await waitFor(() => expect(h.exams()).toHaveLength(1));
    expect(h.of("/api/subjects", "POST")).toHaveLength(0);
  }, 20_000);

  test("the LIVE recording is the shape this code reads — 201, and every slot pending", () => {
    // Recorded against `be` on lane 6, not inferred from the contract.
    expect(LIVE_START.http).toBe(201);
    const body = LIVE_START.body as any;
    expect(Object.keys(body).sort()).toEqual(["correlationId", "subject", "subjectId"]);
    expect(body.subject.exercises.every((e: any) => e.status === "pending")).toBe(true);
    expect(body.subject.exercises.every((e: any) => e.statement === "")).toBe(true);
    expect(
      body.subject.exercises.reduce((n: number, e: any) => n + e.points, 0),
    ).toBe(20);
    // …and the same subject, read back once the fan-out settled.
    const fin = LIVE_FINAL.body as any;
    expect(fin.subject.exercises.every((e: any) => e.status === "ready")).toBe(true);
    expect(fin.subject.exercises.every((e: any) => e.statement.length > 0)).toBe(true);
  });
});

// ---------------------------------------------------------------------------------
// THE NEGATIVE — /api/generate is a frozen SURFACE, only the flow moved
// ---------------------------------------------------------------------------------

describe("the solution-sheet flow is unaffected", () => {
  test("generating a correction still posts /api/generate with {skill, input}", async () => {
    const h = harness({ reads: [record(SID, MONOLITH)] });
    await act(async () => {
      render(<App />);
    });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "توليد التصحيح النموذجي" })).toBeTruthy(),
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "توليد التصحيح النموذجي" }));
    });

    await waitFor(() => expect(h.generates()).toHaveLength(1));
    // The frozen surface, byte for byte: exactly the two keys it has always taken.
    expect(Object.keys(h.generates()[0]!.body).sort()).toEqual(["input", "skill"]);
    expect(h.generates()[0]!.body.skill).toBe("solution-sheet");
    // And it did NOT go anywhere near the new one.
    expect(h.exams()).toHaveLength(0);
  }, 20_000);

  test("a correction is never asked for an exercise that has no statement", async () => {
    // New hazard with progressive generation: a blank exercise handed to
    // `solution-sheet` spends ~145 s and $0.756 writing a worked answer to nothing,
    // which is then stored as that exercise's correction and reads as current.
    const h = harness({
      reads: [record(SID, partial({ ex2: "ready", ex3: "ready", ex1: "failed" }))],
    });
    await act(async () => {
      render(<App />);
    });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "توليد التصحيح النموذجي" })).toBeTruthy(),
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "توليد التصحيح النموذجي" }));
    });

    await waitFor(() => expect(h.generates()).toHaveLength(1));
    const sent = h.generates()[0]!.body.input.exercises as Array<{ id: string; statement: string }>;
    expect(sent.map((e) => e.id)).toEqual(["ex2", "ex3"]);
    expect(sent.every((e) => e.statement.trim().length > 0)).toBe(true);
  }, 20_000);
});

// ---------------------------------------------------------------------------------
// A FAILED EXERCISE, HONESTLY
// ---------------------------------------------------------------------------------

describe("a failed exercise says so and can be asked for again", () => {
  test("it renders an Arabic explanation and a retry control", () => {
    const { container } = render(
      <ExamView exam={partial({ ex1: "failed", ex2: "ready", ex3: "ready" })} onRegenerate={() => {}} />,
    );
    const failed = container.querySelector('[data-exercise-id="ex1"]')!;
    expect(failed.getAttribute("data-status")).toBe("failed");
    expect(visibleText(failed)).toContain("تعذّرت كتابة هذا التمرين");
    const retry = failed.querySelector(".ex__retry") as HTMLButtonElement;
    expect(retry).toBeTruthy();
    expect(retry.textContent).toBe("إعادة توليد هذا التمرين");
  });

  test("the other exercises stay fully rendered and usable alongside it", () => {
    // The reason fan-out was chosen over streaming the monolith: one hole costs one
    // slot, not the paper. Under the monolith the same failure killed the whole exam.
    const { container } = render(
      <ExamView
        exam={partial({ ex1: "failed", ex2: "ready", ex3: "ready" })}
        onRefine={() => {}}
        onRegenerate={() => {}}
      />,
    );
    expect(container.querySelectorAll("section.ex .statement")).toHaveLength(2);
    const refine = (id: string) =>
      container.querySelector(`[data-exercise-id="${id}"] .ex__refine`) as HTMLButtonElement;
    expect(refine("ex2").disabled).toBe(false);
    expect(refine("ex3").disabled).toBe(false);
    // …and the failed one still cannot be refined — there is no statement to refine.
    expect(refine("ex1").disabled).toBe(true);
    // The paper's marks are unchanged by the hole.
    expect(visibleText(container)).toContain("العلامة: 20/20");
  });

  test("a PENDING exercise gets no retry control — it has not failed yet", () => {
    // Asking again while it is still being written spends a second agent loop on the
    // same slot for nothing.
    const { container } = render(
      <ExamView exam={partial({ ex2: "ready" })} onRegenerate={() => {}} />,
    );
    expect(container.querySelectorAll(".ex__retry")).toHaveLength(0);
    expect(container.querySelectorAll('[data-status="pending"]')).toHaveLength(2);
  });

  test("retry calls /regenerate for THAT exerciseId only", async () => {
    const h = harness({
      reads: [record(SID, partial({ ex1: "failed", ex2: "ready", ex3: "ready" }))],
    });
    await act(async () => {
      render(<App />);
    });
    await waitFor(() => expect(document.querySelector(".ex__retry")).toBeTruthy());

    await act(async () => {
      fireEvent.click(document.querySelector(".ex__retry") as HTMLButtonElement);
    });

    await waitFor(() => expect(h.regenerates()).toHaveLength(1));
    const call = h.regenerates()[0]!;
    expect(call.url).toBe(`/api/subjects/${SID}/exercises/ex1/regenerate`);
    expect(call.headers["x-teacher-id"]).toBe(TID);
    // Relative, always — an absolute URL crosses lanes.
    expect(call.url.startsWith("/api/")).toBe(true);
    // NOT the refine path: a failed exercise never had teacher-visible work to
    // supersede, and recording one would let "restore" restore a blank (contract §5.4).
    expect(h.calls.filter((c) => c.method === "PUT")).toHaveLength(0);

    // The answer replaces the slot in place, and the exam is whole again.
    await waitFor(() => expect(document.querySelectorAll("section.ex .statement")).toHaveLength(3));
    expect(document.querySelectorAll(".ex__retry")).toHaveLength(0);
  }, 20_000);

  test("the LIVE regenerate is the shape this code reads — a whole SubjectRecord", () => {
    // Recorded against `be` on lane 6 AFTER be-4 mounted the route. `fe` does
    // `setExam(rec.subject)` off this, so the response being the entire updated subject
    // rather than the one exercise is what makes the retry a single assignment.
    expect(LIVE_REGEN.http).toBe(200);
    const body = LIVE_REGEN.body as any;
    expect(Object.keys(body)).toEqual(expect.arrayContaining(["id", "subject", "createdAt", "updatedAt"]));

    const before = (LIVE_REGEN.before as any).subject.exercises;
    const after = body.subject.exercises;
    // ONE slot moved, and only one — the exercises that worked were not disturbed.
    expect(after[0].statement).not.toBe(before[0].statement);
    expect(after[1].statement).toBe(before[1].statement);
    // The assignment survived the fill: contract §5.2, verified on real output.
    for (let i = 0; i < after.length; i++) {
      expect([after[i].id, after[i].label, after[i].points]).toEqual([
        before[i].id,
        before[i].label,
        before[i].points,
      ]);
    }
    expect(after.reduce((n: number, e: any) => n + e.points, 0)).toBe(20);
  });

  test("a 404 from regenerate is NOT offered as retryable", async () => {
    // `be`'s catch-all answers `type: "not_found"`, which was missing from fe's error
    // map and fell through to the retryable default — the app would have told the
    // teacher to try again at the one thing trying again can never fix. Found live.
    const h = harness({
      reads: [record(SID, partial({ ex1: "failed", ex2: "ready", ex3: "ready" }))],
      regen: [404, { error: { message: "تعذّر العثور على التمرين.", type: "not_found" } }],
    });
    await act(async () => {
      render(<App />);
    });
    await waitFor(() => expect(document.querySelector(".ex__retry")).toBeTruthy());
    await act(async () => {
      fireEvent.click(document.querySelector(".ex__retry") as HTMLButtonElement);
    });

    await waitFor(() => expect(h.regenerates()).toHaveLength(1));
    await waitFor(() => expect(document.querySelector(".alert")).toBeTruthy());
    // The hard-failure styling, and the sentence that says a retry will not help.
    expect(document.querySelector(".alert--hard")).toBeTruthy();
    expect(document.body.textContent).toContain("لا يُحل بإعادة المحاولة");
    // The exercises that worked are still on screen.
    expect(document.querySelectorAll("section.ex .statement")).toHaveLength(2);
  }, 20_000);
});

// ---------------------------------------------------------------------------------
// PRINT
// ---------------------------------------------------------------------------------

describe("printing an exam with a hole in it", () => {
  test("the failed slot prints an honest note, never an empty box", () => {
    const { container } = render(
      <ExamView exam={partial({ ex1: "failed", ex2: "ready", ex3: "ready" })} printable />,
    );
    const failed = container.querySelector('[data-exercise-id="ex1"]')!;
    // Something is there, and it is words.
    expect(visibleText(failed).trim().length).toBeGreaterThan(0);
    expect(visibleText(failed)).toContain("تعذّرت كتابة هذا التمرين");
    // A teacher who prints must not be handed a control on paper.
    expect(container.querySelectorAll(".ex__retry")).toHaveLength(0);
  });

  test("a complete exam still prints byte-identically — the hole path added nothing to it", () => {
    // The promoted net pins this against a recorded baseline; this is the same
    // property asserted where it can catch a regression during the loop.
    const a = render(<ExamView exam={MONOLITH} printable />).container.innerHTML;
    cleanup();
    const b = render(<ExamView exam={MONOLITH} printable onRegenerate={() => {}} />).container
      .innerHTML;
    expect(b).toBe(a);
  });
});

// ---------------------------------------------------------------------------------
// THE HARD CONSTRAINTS
// ---------------------------------------------------------------------------------

describe("the failure message never leaks internals", () => {
  test("no English, no error code, no exerciseId, no LaTeX", () => {
    const { container } = render(
      <ExamView exam={partial({ ex1: "failed", ex2: "ready", ex3: "ready" })} onRegenerate={() => {}} />,
    );
    const failed = container.querySelector('[data-exercise-id="ex1"]')!;
    const ph = failed.querySelector(".ex__placeholder")!;

    expectNoLatinWords(uiText(ph));
    expectNoLatex(visibleText(ph));
    // `ex1` means nothing to a teacher; the header beside it already names the exercise.
    expect(ph.textContent ?? "").not.toMatch(/ex\d/i);
    expect(ph.textContent ?? "").not.toMatch(/failed|pending|error|404|null|undefined/i);
    // The retry control's own label is Arabic too.
    expectNoLatinWords(failed.querySelector(".ex__retry")!.textContent ?? "");
  });

  test("every string on the new generate wait is Arabic", async () => {
    // The blocking wait is now the PLAN only, and its copy must say what is happening
    // rather than promise a finished exam.
    const h = harness({ noCurrent: true, slowExams: true, reads: [record(SID, skeleton())] });
    await act(async () => {
      render(<App />);
    });
    await waitFor(() => expect(screen.getByRole("button", { name: "توليد الموضوع" })).toBeTruthy());
    act(() => {
      generate();
    });

    // The plan is still running: this is the only blocking wait exam creation has left.
    await waitFor(() => expect(document.querySelector(".progress")).toBeTruthy());
    const progress = document.querySelector(".progress")!;
    expect(progress.textContent).toContain("جارٍ تحضير هيكل الموضوع");
    expect(progress.textContent).toContain("ثانية");
    expectNoLatinWords(uiText(progress));
    await act(async () => {
      h.release();
    });
  }, 20_000);

  test("`statusOf` is unchanged — absent still reads ready on both sides of the contract", () => {
    // `be` does not synthesise `status` on read, so this allow-list is the agreed
    // default for the 6,086 stored exams. fe-2 must not have drifted it.
    expect(MONOLITH.exercises.every((e) => statusOf(e) === "ready")).toBe(true);
    expect(JSON.stringify(MONOLITH)).not.toContain("status");
  });
});
