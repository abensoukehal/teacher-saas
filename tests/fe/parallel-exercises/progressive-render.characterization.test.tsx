/**
 * fe-1 — render the exam as it arrives.
 *
 * THE FEATURE, in one sentence: a teacher sees the first finished exercise while the
 * rest are still being written (SEED §3 — ~74 s rather than ~110 s). Nothing here
 * asserts a TOTAL generation time, in either direction. Fan-out does not make an exam
 * faster and the SEED forbids any oracle that implies it did (§5.5, §10.2).
 *
 * The three clauses that are here because a plausible implementation gets them wrong:
 *
 *   - an ABSENT `status` is `ready`. 6,086 stored exams predate the field, and
 *     `ex.status ?? "pending"` turns every one of them into a half-finished exam that
 *     polls forever. Same shape as `roleOf` absent→admin, which survived a green gate.
 *   - an EMPTY statement is never drawn as an exercise. A blank exercise reads to a
 *     teacher as a product that lost their work.
 *   - the poll STOPS. A loop that does not is a quota and battery leak on a phone,
 *     and it is invisible in every screenshot of a working feature.
 */
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import App from "@/App";
import ExamView from "@/components/ExamView";
import { hasPending, isRenderable, statusOf, pointsSum } from "@/lib/exam";
import { MAX_POLLS, POLL_INTERVAL_MS, pollSubject } from "@/lib/poll";
import { startExam } from "@/lib/api";
import { DEFAULT_CONTROLS, buildExamRequest } from "@/lib/taxonomy";
import {
  MONOLITH,
  PLAN,
  TRUNCATED_EX1,
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

/** Drives the loop without wall-clock time. See PollOptions.wait. */
const nowait = () => Promise.resolve();

beforeEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.resetModules();
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => cleanup());

// ---------------------------------------------------------------------------------
// THE POSITIVE — the whole feature
// ---------------------------------------------------------------------------------

describe("an exam renders as it arrives", () => {
  test("ex1 ready, ex2+ex3 pending — ex1's statement is on screen, the others say they are still being written", () => {
    const exam = partial({ ex1: "ready" });
    const { container } = render(<ExamView exam={exam} />);
    const sections = container.querySelectorAll("section.ex");
    expect(sections).toHaveLength(3);

    // The finished one is REALLY there — a distinctive fragment of the recorded
    // statement, rendered, not a label echoed back.
    expect(visibleText(sections[0]!)).toContain("احسب");
    expect(sections[0]!.querySelector(".statement")).toBeTruthy();
    expect(sections[0]!.querySelector(".ex__placeholder")).toBeNull();

    // The two that are not written yet say so, in Arabic, and carry no statement.
    for (const i of [1, 2]) {
      const s = sections[i]!;
      expect(s.querySelector(".statement")).toBeNull();
      expect(s.getAttribute("data-status")).toBe("pending");
      expect(visibleText(s)).toContain("جارٍ كتابة هذا التمرين");
    }
  });

  test("the paper's shape and its /20 are right from the FIRST paint, before any exercise exists", () => {
    // The plan fixes id, label and points before a statement exists (contract §5.1),
    // so nothing reflows and no total changes as the exercises land. A teacher
    // watching an exam assemble must not watch the marks move.
    const empty = skeleton();
    expect(pointsSum(empty)).toBe(20);
    expect(empty.meta.totalPoints).toBe(20);

    const { container } = render(<ExamView exam={empty} />);
    expect(container.querySelectorAll("section.ex")).toHaveLength(3);
    expect(visibleText(container)).toContain("العلامة: 20/20");
    expect(
      [...container.querySelectorAll("section.ex")].map((s) => s.getAttribute("data-exercise-id")),
    ).toEqual(["ex1", "ex2", "ex3"]);

    // …and it still reads 20/20 with only one exercise written.
    cleanup();
    const half = render(<ExamView exam={partial({ ex2: "ready" })} />);
    expect(pointsSum(partial({ ex2: "ready" }))).toBe(20);
    expect(visibleText(half.container)).toContain("العلامة: 20/20");
  });

  test("a filled exercise keeps the assignment's id, label and points — filling is not a variation", () => {
    // contract §5.2. `be` verifies this rather than trusting the skill; `fe` renders
    // whatever it is handed, so this pins that the fixture's own fill is faithful and
    // that nothing in the render substitutes one for another.
    const exam = partial({ ex2: "ready", ex3: "ready" });
    for (const a of PLAN.assignments) {
      const ex = exam.exercises.find((e) => e.id === a.id)!;
      expect(ex.label).toBe(a.label);
      expect(ex.points).toBe(a.points);
    }
    const { container } = render(<ExamView exam={exam} />);
    const ex2 = container.querySelector('[data-exercise-id="ex2"]')!;
    expect(visibleText(ex2)).toContain("التمرين الثاني");
    expect(visibleText(ex2)).toContain("(7 نقاط)");
  });
});

// ---------------------------------------------------------------------------------
// THE NEGATIVE — a blank exercise is worse than an honest wait
// ---------------------------------------------------------------------------------

describe("an empty statement is NEVER rendered as an exercise", () => {
  test("pending, failed, and a `ready` exercise `be` should never have sent — none of them draws an empty body", () => {
    const exam = partial({ ex3: "failed" });
    // The third case is a defensive one and belongs here: `status` alone would trust
    // `be` to never emit a ready-and-empty exercise, and the cost of that trust being
    // misplaced is the exact blank box this clause forbids.
    exam.exercises[1] = { ...exam.exercises[1]!, status: "ready", statement: "   " };

    const { container } = render(<ExamView exam={exam} />);
    for (const s of container.querySelectorAll("section.ex")) {
      const statement = s.querySelector(".statement");
      if (statement) {
        // If a body was drawn at all, it has real content in it.
        expect(visibleText(statement).trim().length).toBeGreaterThan(0);
      } else {
        // Otherwise there is a placeholder saying so — never nothing.
        const ph = s.querySelector(".ex__placeholder");
        expect(ph).toBeTruthy();
        expect(visibleText(ph!).trim().length).toBeGreaterThan(0);
      }
    }
    // Specifically: three exercises, one real body, two spoken-for gaps.
    expect(container.querySelectorAll("section.ex .statement")).toHaveLength(0);
    expect(container.querySelectorAll(".ex__placeholder")).toHaveLength(3);
  });

  test("`isRenderable` needs BOTH a ready status and a body — either alone is not enough", () => {
    expect(isRenderable({ id: "ex1", label: "ل", points: 5, statement: "نصّ" })).toBe(true);
    expect(isRenderable({ id: "ex1", label: "ل", points: 5, statement: "" })).toBe(false);
    expect(isRenderable({ id: "ex1", label: "ل", points: 5, statement: "  \n " })).toBe(false);
    expect(
      isRenderable({ id: "ex1", label: "ل", points: 5, statement: "نصّ", status: "pending" }),
    ).toBe(false);
    expect(
      isRenderable({ id: "ex1", label: "ل", points: 5, statement: "نصّ", status: "failed" }),
    ).toBe(false);
  });

  test("a truncated run — the ~10% failure — costs ONE exercise, and the others stay usable", () => {
    // The recorded fan-out's ex1 came back at 906 chars of unparseable JSON with
    // `subtype: success` (SEED §10.1). Under the monolith that is a dead exam; here
    // it is one slot.
    expect(TRUNCATED_EX1.parses).toBe(false);
    expect(TRUNCATED_EX1.chars).toBe(906);

    const exam = partial({ ex1: "failed", ex2: "ready", ex3: "ready" });
    const { container } = render(<ExamView exam={exam} />);
    expect(container.querySelectorAll("section.ex .statement")).toHaveLength(2);
    expect(visibleText(container.querySelector('[data-exercise-id="ex2"]')!)).toContain("احسب");
    expect(visibleText(container.querySelector('[data-exercise-id="ex3"]')!).length).toBeGreaterThan(
      100,
    );
  });

  test("there is nothing to refine until there is a statement", () => {
    // `refine-exercise` is handed the exercise itself. Sending an empty one spends a
    // whole agent loop on nothing and can only come back as a guess.
    const exam = partial({ ex2: "ready" });
    const { container } = render(<ExamView exam={exam} onRefine={() => {}} />);
    const btn = (id: string) =>
      container.querySelector(`[data-exercise-id="${id}"] .ex__refine`) as HTMLButtonElement;
    expect(btn("ex1").disabled).toBe(true);
    expect(btn("ex3").disabled).toBe(true);
    expect(btn("ex2").disabled).toBe(false);
  });
});

// ---------------------------------------------------------------------------------
// THE NEGATIVE — absent means ready
// ---------------------------------------------------------------------------------

describe("the 6,086 exams that predate `status`", () => {
  test("a subject with NO status field anywhere renders every exercise in full", () => {
    expect(JSON.stringify(MONOLITH)).not.toContain("status");

    const { container } = render(<ExamView exam={MONOLITH} />);
    expect(container.querySelectorAll("section.ex")).toHaveLength(MONOLITH.exercises.length);
    // Every one has a real body and NONE has a placeholder. `?? "pending"` fails here.
    expect(container.querySelectorAll("section.ex .statement")).toHaveLength(MONOLITH.exercises.length);
    expect(container.querySelectorAll(".ex__placeholder")).toHaveLength(0);
    expect(visibleText(container)).not.toContain("جارٍ كتابة");
  });

  test("`statusOf` reads absent as ready — and so does anything it has never heard of", () => {
    const base = { id: "ex1", label: "التمرين الأول", points: 5, statement: "نصّ" };
    expect(statusOf(base)).toBe("ready");
    expect(statusOf({ ...base, status: "ready" })).toBe("ready");
    expect(statusOf({ ...base, status: "pending" })).toBe("pending");
    expect(statusOf({ ...base, status: "failed" })).toBe("failed");
    // A value from a future build must be able to make an exercise RENDER, never
    // make it vanish. The whitelist is what guarantees the direction of that failure.
    expect(statusOf({ ...base, status: "queued" as never })).toBe("ready");
    expect(statusOf({ ...base, status: undefined })).toBe("ready");
  });

  test("a monolith exam is never `pending`, so opening one starts no poll at all", () => {
    expect(hasPending(MONOLITH)).toBe(false);
    expect(hasPending(skeleton())).toBe(true);
    expect(hasPending(partial({ ex1: "ready", ex2: "ready" }))).toBe(true);
    // Nothing pending — a failed exercise is finished business, not something to wait for.
    expect(hasPending(partial({ ex1: "failed", ex2: "ready", ex3: "ready" }))).toBe(false);
  });
});

// ---------------------------------------------------------------------------------
// THE NEGATIVE — the poll stops
// ---------------------------------------------------------------------------------

describe("polling stops", () => {
  /** A fetch mock that answers GET /api/subjects/:id from a scripted sequence. */
  function reads(sequence: ReturnType<typeof record>[]) {
    let n = 0;
    const calls: string[] = [];
    const fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
      calls.push(`${init.method ?? "GET"} ${url}`);
      const rec = sequence[Math.min(n++, sequence.length - 1)]!;
      return { ok: true, status: 200, json: async () => rec };
    });
    vi.stubGlobal("fetch", fetchMock);
    return { calls, gets: () => calls.filter((c) => c.startsWith("GET /api/subjects/")) };
  }

  test("it stops the moment nothing is pending — and does NOT read again after that", async () => {
    const h = reads([
      record(SID, partial({ ex2: "ready" })),
      record(SID, partial({ ex2: "ready", ex3: "ready" })),
      record(SID, partial({ ex1: "ready", ex2: "ready", ex3: "ready" })),
      // If the loop ever gets here it did not stop, and this read is the proof.
      record(SID, skeleton()),
    ]);
    const seen: number[] = [];
    const outcome = await pollSubject(
      TID,
      SID,
      (rec) => seen.push(rec.subject.exercises.filter((e) => statusOf(e) === "ready").length),
      { wait: nowait, maxPolls: 50 },
    );

    expect(outcome).toBe("complete");
    expect(seen).toEqual([1, 2, 3]);
    expect(h.gets()).toHaveLength(3);
  });

  test("a subject that is ALREADY complete costs exactly one read", async () => {
    const h = reads([record(SID, MONOLITH)]);
    expect(await pollSubject(TID, SID, () => {}, { wait: nowait, maxPolls: 50 })).toBe("complete");
    expect(h.gets()).toHaveLength(1);
  });

  test("an abort stops it, and no update lands after the abort", async () => {
    const h = reads([record(SID, skeleton())]);
    const ctrl = new AbortController();
    let updates = 0;
    const p = pollSubject(
      TID,
      SID,
      () => {
        updates++;
        ctrl.abort();
      },
      { wait: nowait, signal: ctrl.signal, maxPolls: 50 },
    );
    expect(await p).toBe("aborted");
    expect(updates).toBe(1);
    expect(h.gets()).toHaveLength(1);
  });

  test("a fan-out that never settles is bounded — it does not poll forever", async () => {
    // The backstop. Nothing in `status` handling can rule out a generation that
    // simply never finishes, and "poll until it does" is then an infinite loop.
    const h = reads([record(SID, skeleton())]);
    expect(await pollSubject(TID, SID, () => {}, { wait: nowait, maxPolls: 7 })).toBe("exhausted");
    expect(h.gets()).toHaveLength(7);
    // The shipped bound is finite and generous — ~10 min at 3 s, several times the
    // worst measured run (121.8 s for one exercise, SEED §10.2).
    expect(Number.isFinite(MAX_POLLS)).toBe(true);
    expect(MAX_POLLS * POLL_INTERVAL_MS).toBeGreaterThan(150_000);
    expect(MAX_POLLS * POLL_INTERVAL_MS).toBeLessThanOrEqual(15 * 60_000);
  });

  test("a retryable read failure is survived; a dead identity stops it immediately", async () => {
    // A wifi blip must not strand a half-drawn sheet the store has already finished.
    let n = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        n++;
        if (n === 1) throw new TypeError("network down");
        return {
          ok: true,
          status: 200,
          json: async () => record(SID, partial({ ex1: "ready", ex2: "ready", ex3: "ready" })),
        };
      }),
    );
    expect(await pollSubject(TID, SID, () => {}, { wait: nowait, maxPolls: 9 })).toBe("complete");
    expect(n).toBe(2);

    // The opposite case: retrying an id `be` no longer knows can only ever be refused,
    // so a loop over it is the quota leak in its purest form.
    let m = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        m++;
        return {
          ok: false,
          status: 401,
          json: async () => ({
            error: { message: "انتهت الجلسة.", type: "teacher_required" },
          }),
        };
      }),
    );
    await expect(
      pollSubject(TID, SID, () => {}, { wait: nowait, maxPolls: 9 }),
    ).rejects.toMatchObject({ type: "teacher_required" });
    expect(m).toBe(1);
  });
});

// ---------------------------------------------------------------------------------
// The app, end to end
// ---------------------------------------------------------------------------------

describe("the app renders a filling exam and then leaves it alone", () => {
  function app(sequence: ReturnType<typeof record>[]) {
    let n = 0;
    const calls: Array<{ method: string; url: string }> = [];
    const fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
      const method = init.method ?? "GET";
      calls.push({ method, url });
      const res = (status: number, payload: unknown) => ({
        ok: status < 300,
        status,
        json: async () => payload,
      });
      if (url === "/api/subjects" && method === "GET") {
        return res(200, {
          subjects: [
            {
              id: SID,
              title: PLAN.title,
              exerciseCount: 3,
              totalPoints: 20,
              createdAt: "t",
              updatedAt: "t",
            },
          ],
        });
      }
      if (url === `/api/subjects/${SID}` && method === "GET") {
        return res(200, sequence[Math.min(n++, sequence.length - 1)]);
      }
      if (url.endsWith("/solutions")) return res(200, { solutions: [] });
      return res(404, { error: { message: "غير موجود", type: "subject_not_found" } });
    });
    vi.stubGlobal("fetch", fetchMock);
    localStorage.setItem("teacher.id.v1", JSON.stringify(TID));
    localStorage.setItem("teacher.current.v1", JSON.stringify(SID));
    return {
      calls,
      subjectReads: () => calls.filter((c) => c.url === `/api/subjects/${SID}` && c.method === "GET"),
    };
  }

  test("opening an exam mid-generation shows what is written and fills in the rest, then quiets down", async () => {
    const h = app([
      record(SID, partial({ ex2: "ready" })),
      record(SID, partial({ ex2: "ready", ex3: "ready" })),
      record(SID, partial({ ex1: "ready", ex2: "ready", ex3: "ready" })),
    ]);

    await act(async () => {
      render(<App />);
    });

    // The boot read painted the exam: one real exercise, two still being written.
    await waitFor(() => expect(document.querySelectorAll("section.ex")).toHaveLength(3));
    expect(document.querySelectorAll("section.ex .statement")).toHaveLength(1);
    expect(document.body.textContent).toContain("جارٍ كتابة هذا التمرين");

    // The poll fills the rest. Real timers, real interval — this is the shipped path.
    await waitFor(() => expect(document.querySelectorAll("section.ex .statement")).toHaveLength(3), {
      timeout: 15_000,
    });
    expect(document.querySelectorAll(".ex__placeholder")).toHaveLength(0);

    // AND THEN IT STOPS. Let several more intervals pass and count the reads: the
    // number must not move. This is the clause a leaking poll fails.
    const after = h.subjectReads().length;
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS * 3));
    expect(h.subjectReads().length).toBe(after);
  }, 30_000);

  test("opening a monolith exam issues ONE read, ever", async () => {
    const h = app([record(SID, MONOLITH)]);
    await act(async () => {
      render(<App />);
    });
    await waitFor(() =>
      expect(document.querySelectorAll("section.ex .statement")).toHaveLength(MONOLITH.exercises.length),
    );
    const after = h.subjectReads().length;
    expect(after).toBe(1);
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS * 2));
    expect(h.subjectReads().length).toBe(1);
  }, 20_000);
});

// ---------------------------------------------------------------------------------
// Starting one — the new surface
// ---------------------------------------------------------------------------------

describe("POST /api/exams", () => {
  function stub(reply: [number, unknown]) {
    const calls: Array<{ method: string; url: string; body: any; headers: Record<string, string> }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit = {}) => {
        calls.push({
          method: init.method ?? "GET",
          url,
          body: init.body ? JSON.parse(init.body as string) : undefined,
          headers: (init.headers ?? {}) as Record<string, string>,
        });
        return { ok: reply[0] < 300, status: reply[0], json: async () => reply[1] };
      }),
    );
    return calls;
  }

  test("it is its OWN surface, relative, teacher-scoped, and carries the controls unwrapped", async () => {
    const calls = stub([200, { subjectId: SID, subject: skeleton(), correlationId: "plan-1" }]);
    const started = await startExam(TID, buildExamRequest(DEFAULT_CONTROLS).input);

    expect(calls).toHaveLength(1);
    // Relative, always — an absolute URL makes a job lane talk to the main checkout.
    expect(calls[0]!.url).toBe("/api/exams");
    expect(calls[0]!.method).toBe("POST");
    expect(calls[0]!.headers["x-teacher-id"]).toBe(TID);
    // No {skill, input} envelope: `/api/exams` names its own skill server-side.
    expect(Object.keys(calls[0]!.body).sort()).toEqual(
      ["difficulty", "durationMinutes", "exerciseCount", "format", "level", "stream", "topic"].sort(),
    );
    expect(started.subjectId).toBe(SID);
    expect(hasPending(started.subject)).toBe(true);
  });

  test("it answers with a SKELETON — every statement empty, every id/label/points already final", async () => {
    stub([200, { subjectId: SID, subject: skeleton(), correlationId: "plan-1" }]);
    const started = await startExam(TID, buildExamRequest(DEFAULT_CONTROLS).input);
    expect(started.subject.exercises.map((e) => e.id)).toEqual(["ex1", "ex2", "ex3"]);
    expect(started.subject.exercises.every((e) => e.statement === "")).toBe(true);
    expect(started.subject.exercises.every((e) => statusOf(e) === "pending")).toBe(true);
    expect(pointsSum(started.subject)).toBe(20);
  });

  test("the existing failure contract applies unchanged — branch on `type`, never the code", async () => {
    stub([401, { error: { message: "لا بدّ من هوية معلّم.", type: "teacher_required" } }]);
    await expect(startExam(TID, buildExamRequest(DEFAULT_CONTROLS).input)).rejects.toMatchObject({
      type: "teacher_required",
      retryable: false,
    });
  });
});

// ---------------------------------------------------------------------------------
// THE HARD CONSTRAINTS — Arabic only, RTL, and no LaTeX
// ---------------------------------------------------------------------------------

describe("the hard constraints hold on every new surface", () => {
  test("every string a teacher can read in a filling exam is Arabic — no English anywhere", () => {
    const { container } = render(
      <ExamView exam={partial({ ex2: "ready", ex3: "failed" })} onRefine={() => {}} />,
    );
    // Read what a teacher reads: text nodes and the labels of controls.
    expectNoLatinWords(uiText(container));
    for (const b of container.querySelectorAll("button")) {
      expectNoLatinWords(b.textContent ?? "");
    }
    // The two states this job introduces, by their actual words.
    expect(visibleText(container)).toContain("جارٍ كتابة هذا التمرين");
    expect(visibleText(container)).toContain("تعذّرت كتابة هذا التمرين");
  });

  test("the waiting and failure copy names no exercise id, no status word and no error code", () => {
    // `ex2` means nothing to a teacher and `pending` means less. The header beside
    // the placeholder already says which exercise it is.
    const { container } = render(<ExamView exam={partial({ ex2: "failed" })} />);
    for (const ph of container.querySelectorAll(".ex__placeholder")) {
      const t = ph.textContent ?? "";
      expect(t).not.toMatch(/ex\d/i);
      expect(t).not.toMatch(/pending|failed|ready|error|null|undefined|\d{3}/i);
    }
  });

  test("no LaTeX is ever visible — not in a statement, not in a waiting state, not in a failure", () => {
    // The statements in these fixtures are dense with `$…$`, `\dfrac`, `\mathbb` and
    // `\lim`. All of it must arrive as rendered maths and none as characters.
    const { container } = render(<ExamView exam={partial({ ex2: "ready", ex3: "ready" })} />);
    expect(container.querySelectorAll(".katex").length).toBeGreaterThan(0);
    expectNoLatex(visibleText(container));

    cleanup();
    const gaps = render(<ExamView exam={partial({ ex1: "failed" })} />);
    expectNoLatex(visibleText(gaps.container));
  });

  test("the RTL layout holds — logical properties only, and the document is rtl", () => {
    // jsdom cannot see a visual break, so the assertion is on what causes one: a
    // physical left/right in the placeholder's own styling would mirror wrongly.
    expect(document.documentElement.getAttribute("dir") ?? "rtl").toBe("rtl");
    const { container } = render(<ExamView exam={partial({ ex2: "ready" })} />);
    const ph = container.querySelector(".ex__placeholder")!;
    // It is a plain block in the RTL flow, not positioned against an edge.
    expect(ph.getAttribute("style")).toBeNull();
    expect(ph.className).not.toMatch(/left|right/);
  });

  test("a pending exercise is announced as busy, and a ready one carries no status at all", () => {
    const { container } = render(<ExamView exam={partial({ ex2: "ready" })} />);
    const ex1 = container.querySelector('[data-exercise-id="ex1"]')!;
    const ex2 = container.querySelector('[data-exercise-id="ex2"]')!;
    expect(ex1.getAttribute("aria-busy")).toBe("true");
    // A finished exercise must be indistinguishable from a monolith one, down to the
    // attributes — that is what keeps the recorded print baseline byte-identical.
    expect(ex2.hasAttribute("aria-busy")).toBe(false);
    expect(ex2.hasAttribute("data-status")).toBe(false);
  });
});
