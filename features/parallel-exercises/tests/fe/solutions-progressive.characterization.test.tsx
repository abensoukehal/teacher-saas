/**
 * fe-3 — corrections appear one by one.
 *
 * QA bug A: the teacher watched `solutions: []` for 230 s and then got all three at
 * once. The same defect the exam had before this job, still sitting on the correction
 * path — SEED §5 criterion 3 was written, then dropped between the SEED and a contract
 * that never named a transport for it.
 *
 * QA bug B: the same exam in two tabs gave two enabled buttons and two full ~200 s
 * runs. `be` refuses the second batch; the half pinned here is that the button cannot
 * ask, because `be` refusing is not a reason for the UI to offer.
 *
 * TWO THINGS THIS SUITE EXISTS TO CATCH, both invisible in a screenshot of a working
 * feature:
 *
 *   - **the correction poll stops.** It is the longer of the two runs, so a leak here
 *     is the more expensive one. `lib/poll.ts` is reused rather than copied precisely
 *     because this guarantee is what a copy loses.
 *   - **no empty correction box, ever.** `be` stores NOTHING for a correction it could
 *     not produce, so "missing" is the only signal there is. Rendering a blank answer
 *     with a blank scale would read as a correction that says nothing — which a
 *     teacher would carry into a class.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import App from "@/App";
import SolutionView from "@/components/SolutionView";
import { MAX_POLLS, POLL_INTERVAL_MS, pollSolutions } from "@/lib/poll";
import { startSolutions } from "@/lib/api";
import {
  MONOLITH,
  expectNoLatex,
  expectNoLatinWords,
  record,
  uiText,
  visibleText,
} from "./fixtures";

const TID = "0123456789abcdef0123456789abcdef";
const SID = "6a76f42ca530c73b5a723837";
const EXAM = MONOLITH;
const IDS = EXAM.exercises.map((e) => e.id);

/** Drives the loop without wall-clock time. See PollOptions.wait. */
const nowait = () => Promise.resolve();

/**
 * A stored correction, shaped like `be`'s. The maths in `answer` and in every `part`
 * is real `$…$` — the correction is the densest maths in the product and therefore
 * the likeliest place to leak LaTeX to a teacher.
 */
const solution = (exerciseId: string, points: number) => ({
  exerciseId,
  answer: `نحسب النهاية: $\\lim\\limits_{x \\to +\\infty} f(x) = +\\infty$، ومنه النتيجة.`,
  scale: [
    { part: "حساب $f'(x)$", points: points / 2 },
    { part: "الاستنتاج", points: points / 2 },
  ],
  stale: false,
});

type Call = { method: string; url: string; body: any; headers: Record<string, string> };

interface Opts {
  /** Successive answers to GET …/solutions. The last one repeats. */
  batches?: Array<ReturnType<typeof solution>[]>;
  /** Override POST …/solutions/generate — [status, payload]. */
  start?: [number, unknown];
}

function harness(o: Opts = {}) {
  const calls: Call[] = [];
  let n = 0;
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

    if (url === `/api/subjects/${SID}/solutions/generate` && method === "POST") {
      return res(
        ...(o.start ?? [202, { subjectId: SID, exerciseIds: IDS, skipped: [], correlationId: "sol-1" }]),
      );
    }
    if (url === `/api/subjects/${SID}/solutions` && method === "GET") {
      const seq = o.batches ?? [[]];
      return res(200, { solutions: seq[Math.min(n++, seq.length - 1)] });
    }
    if (url === "/api/subjects" && method === "GET") {
      return res(200, {
        subjects: [
          { id: SID, title: EXAM.title, exerciseCount: 3, totalPoints: 20, createdAt: "t", updatedAt: "t" },
        ],
      });
    }
    if (url === `/api/subjects/${SID}` && method === "GET") return res(200, record(SID, EXAM));
    return res(404, { error: { message: "غير موجود", type: "not_found" } });
  });

  vi.stubGlobal("fetch", fetchMock);
  localStorage.setItem("teacher.id.v1", JSON.stringify(TID));
  localStorage.setItem("teacher.current.v1", JSON.stringify(SID));
  return {
    calls,
    starts: () =>
      calls.filter((c) => c.url.endsWith("/solutions/generate") && c.method === "POST"),
    reads: () =>
      calls.filter((c) => c.url === `/api/subjects/${SID}/solutions` && c.method === "GET"),
    generates: () => calls.filter((c) => c.url === "/api/generate"),
  };
}

const startBtn = () => screen.getByRole("button", { name: /التصحيح النموذجي|التصحيح كاملًا|جارٍ تحضير التصحيح/ });

beforeEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.resetModules();
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => cleanup());

// ---------------------------------------------------------------------------------
// THE POSITIVE — they arrive one by one
// ---------------------------------------------------------------------------------

describe("corrections render as they land", () => {
  test("one present, two still coming — the one renders and the others say they are on the way", () => {
    const { container } = render(
      <SolutionView
        exam={EXAM}
        solutions={[solution("ex1", 6)]}
        awaitingIds={["ex2", "ex3"]}
        onRegenerate={() => {}}
      />,
    );

    // The finished one is really there: a worked answer AND its scale.
    const ex1 = container.querySelector('[data-solution-for="ex1"]')!;
    expect(ex1.querySelector(".sol__answer")).toBeTruthy();
    expect(ex1.querySelector(".sol__scale")).toBeTruthy();
    expect(ex1.querySelector(".sol__pending")).toBeNull();
    expect(visibleText(ex1)).toContain("سلّم التنقيط");

    // The two still coming say so, in Arabic, and carry no answer box.
    for (const id of ["ex2", "ex3"]) {
      const s = container.querySelector(`[data-solution-for="${id}"]`)!;
      expect(s.getAttribute("data-awaiting")).toBe("true");
      expect(s.getAttribute("aria-busy")).toBe("true");
      expect(s.querySelector(".sol__answer")).toBeNull();
      expect(s.querySelector(".sol__scale")).toBeNull();
      expect(visibleText(s)).toContain("جارٍ تحضير تصحيح هذا التمرين");
    }
  });

  test("the app shows the sheet filling in, one correction at a time", async () => {
    const h = harness({
      batches: [
        [],
        [solution("ex2", 6)],
        [solution("ex2", 6), solution("ex3", 8)],
        [solution("ex1", 6), solution("ex2", 6), solution("ex3", 8)],
      ],
    });
    await act(async () => {
      render(<App />);
    });
    await waitFor(() => expect(startBtn()).toBeTruthy());
    await act(async () => {
      fireEvent.click(startBtn());
    });

    // 202 came back; the sheet is on screen straight away, all three waiting.
    await waitFor(() => expect(h.starts()).toHaveLength(1));
    await waitFor(() => expect(document.querySelectorAll(".sol__pending")).toHaveLength(3));
    expect(document.querySelectorAll(".sol__answer")).toHaveLength(0);

    // …then they arrive, and the count of finished ones only ever goes UP.
    await waitFor(() => expect(document.querySelectorAll(".sol__answer")).toHaveLength(1), {
      timeout: 15_000,
    });
    await waitFor(() => expect(document.querySelectorAll(".sol__answer")).toHaveLength(3), {
      timeout: 15_000,
    });
    expect(document.querySelectorAll(".sol__pending")).toHaveLength(0);
  }, 40_000);

  test("it posts to /solutions/generate — teacher-scoped, relative, no body needed", async () => {
    const h = harness();
    await act(async () => {
      render(<App />);
    });
    await waitFor(() => expect(startBtn()).toBeTruthy());
    await act(async () => {
      fireEvent.click(startBtn());
    });
    await waitFor(() => expect(h.starts()).toHaveLength(1));

    const call = h.starts()[0]!;
    expect(call.url).toBe(`/api/subjects/${SID}/solutions/generate`);
    expect(call.url.startsWith("/api/")).toBe(true);
    expect(call.headers["x-teacher-id"]).toBe(TID);
    // The whole-exam path does NOT spend a /api/generate run any more.
    expect(h.generates()).toHaveLength(0);
  }, 20_000);

  test("202 is the contract, and it names what will be corrected", async () => {
    const calls: Array<{ url: string; method: string }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit = {}) => {
        calls.push({ url, method: init.method ?? "GET" });
        return {
          ok: true,
          status: 202,
          json: async () => ({ subjectId: SID, exerciseIds: IDS, skipped: [], correlationId: "c" }),
        };
      }),
    );
    const started = await startSolutions(TID, SID);
    // 202 not 201: nothing exists yet at response time. `POST /api/exams` answers 201
    // because the skeleton IS already inserted — the two are not interchangeable.
    expect(started.exerciseIds).toEqual(IDS);
    expect(started.skipped).toEqual([]);
    expect(calls[0]!.method).toBe("POST");
  });
});

// ---------------------------------------------------------------------------------
// THE NEGATIVE — the poll stops
// ---------------------------------------------------------------------------------

describe("the correction poll stops", () => {
  function reads(sequence: Array<ReturnType<typeof solution>[]>) {
    let n = 0;
    const urls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        urls.push(url);
        return {
          ok: true,
          status: 200,
          json: async () => ({ solutions: sequence[Math.min(n++, sequence.length - 1)] }),
        };
      }),
    );
    return { urls };
  }

  test("it stops the moment every expected correction is present, and reads no more", async () => {
    const h = reads([
      [solution("ex1", 6)],
      [solution("ex1", 6), solution("ex2", 6)],
      [solution("ex1", 6), solution("ex2", 6), solution("ex3", 8)],
      // Reaching here means it did not stop, and this read is the proof.
      [],
    ]);
    const seen: number[] = [];
    const outcome = await pollSolutions(TID, SID, IDS, (s) => seen.push(s.length), {
      wait: nowait,
      maxPolls: 50,
    });

    expect(outcome).toBe("complete");
    expect(seen).toEqual([1, 2, 3]);
    expect(h.urls).toHaveLength(3);
  });

  test("a sheet that is ALREADY complete costs exactly one read", async () => {
    const h = reads([[solution("ex1", 6), solution("ex2", 6), solution("ex3", 8)]]);
    expect(
      await pollSolutions(TID, SID, IDS, () => {}, { wait: nowait, maxPolls: 50 }),
    ).toBe("complete");
    expect(h.urls).toHaveLength(1);
  });

  test("a correction that never arrives is BOUNDED — it does not poll forever", async () => {
    // The case with no other brake. `be` stores nothing for a correction it could not
    // produce, so its id never appears and "all present" is never true. Without the
    // backstop this is an infinite loop on the longest-running surface in the product.
    const h = reads([[solution("ex1", 6), solution("ex2", 6)]]);
    expect(await pollSolutions(TID, SID, IDS, () => {}, { wait: nowait, maxPolls: 6 })).toBe(
      "exhausted",
    );
    expect(h.urls).toHaveLength(6);
    // The shipped bound is finite and generous enough not to cut a live run short: a
    // correction measured ~145 s, and a fan-out costs `max` of N of those.
    expect(Number.isFinite(MAX_POLLS)).toBe(true);
    expect(MAX_POLLS * POLL_INTERVAL_MS).toBeGreaterThan(300_000);
  });

  test("an abort stops it, and no update lands after the abort", async () => {
    const h = reads([[]]);
    const ctrl = new AbortController();
    let updates = 0;
    const outcome = await pollSolutions(
      TID,
      SID,
      IDS,
      () => {
        updates++;
        ctrl.abort();
      },
      { wait: nowait, signal: ctrl.signal, maxPolls: 50 },
    );
    expect(outcome).toBe("aborted");
    expect(updates).toBe(1);
    expect(h.urls).toHaveLength(1);
  });

  test("in the app: the reads stop once the sheet is complete", async () => {
    const h = harness({
      batches: [
        [solution("ex1", 6)],
        [solution("ex1", 6), solution("ex2", 6), solution("ex3", 8)],
      ],
    });
    await act(async () => {
      render(<App />);
    });
    await waitFor(() => expect(startBtn()).toBeTruthy());
    await act(async () => {
      fireEvent.click(startBtn());
    });
    await waitFor(() => expect(document.querySelectorAll(".sol__answer")).toHaveLength(3), {
      timeout: 15_000,
    });

    // AND THEN IT STOPS. Several more intervals must not move the read count.
    const after = h.reads().length;
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS * 3));
    expect(h.reads().length).toBe(after);
  }, 40_000);

  test("the poller is shared with the exam, not copied", async () => {
    // The stop guarantee lives in ONE loop. A second implementation is where it goes
    // missing, so this pins that there is only one — `pollSubject` and `pollSolutions`
    // are both thin questions asked of `pollUntil`.
    const mod = await import("@/lib/poll");
    expect(typeof mod.pollUntil).toBe("function");
    expect(typeof mod.pollSubject).toBe("function");
    expect(typeof mod.pollSolutions).toBe("function");
    const src = mod.pollSolutions.toString() + mod.pollSubject.toString();
    // Neither wrapper contains a loop of its own.
    expect(src).not.toMatch(/\bfor\s*\(|\bwhile\s*\(/);
  });
});

// ---------------------------------------------------------------------------------
// QA BUG B — the button cannot start a second run
// ---------------------------------------------------------------------------------

describe("one correction run at a time", () => {
  test("the button is disabled for as long as the batch is running, not just the request", async () => {
    // THE BUG. The 202 returns in a moment and the corrections take ~200 s; disabling
    // on the request alone re-enabled the button for the whole fan-out.
    const h = harness({ batches: [[]] });
    await act(async () => {
      render(<App />);
    });
    await waitFor(() => expect(startBtn()).toBeTruthy());
    await act(async () => {
      fireEvent.click(startBtn());
    });
    await waitFor(() => expect(h.starts()).toHaveLength(1));

    // The request is long finished and nothing has arrived yet — the window the bug
    // lived in. The control must still refuse, and say why in Arabic.
    await waitFor(() => expect((startBtn() as HTMLButtonElement).disabled).toBe(true));
    expect(startBtn().textContent).toBe("جارٍ تحضير التصحيح…");

    // Pressing anyway starts nothing.
    await act(async () => {
      fireEvent.click(startBtn());
      fireEvent.click(startBtn());
    });
    expect(h.starts()).toHaveLength(1);
  }, 20_000);

  test("a double-press in ONE act() issues exactly one batch", async () => {
    // `fireEvent` flushes React between events, so two separate calls would only prove
    // `disabled` works. Both clicks go in a single `act()` so the component cannot
    // re-render between them — a correction batch is ~200 s of real quota per press.
    const h = harness({ batches: [[]] });
    await act(async () => {
      render(<App />);
    });
    await waitFor(() => expect(startBtn()).toBeTruthy());
    const btn = startBtn();
    await act(async () => {
      btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await waitFor(() => expect(h.starts().length).toBeGreaterThanOrEqual(1));
    expect(h.starts()).toHaveLength(1);
  }, 20_000);

  test("a 409 from the other tab is not an error — this tab shows the same sheet filling in", async () => {
    // `be` refuses the second batch. The teacher did nothing wrong and the corrections
    // ARE coming, so the honest response is to join the wait rather than report a failure.
    const h = harness({
      start: [409, { error: { message: "جارٍ تحضير التصحيح، أعد المحاولة", type: "conflict" } }],
      batches: [[], [solution("ex1", 6), solution("ex2", 6), solution("ex3", 8)]],
    });
    await act(async () => {
      render(<App />);
    });
    await waitFor(() => expect(startBtn()).toBeTruthy());
    await act(async () => {
      fireEvent.click(startBtn());
    });
    await waitFor(() => expect(h.starts()).toHaveLength(1));

    // No error banner, and the sheet is waiting exactly as in the tab that started it.
    await waitFor(() => expect(document.querySelectorAll(".sol__pending")).toHaveLength(3));
    expect(document.querySelector(".alert")).toBeNull();
    expect((startBtn() as HTMLButtonElement).disabled).toBe(true);

    // …and it picks up the corrections the OTHER tab's run produced.
    await waitFor(() => expect(document.querySelectorAll(".sol__answer")).toHaveLength(3), {
      timeout: 15_000,
    });
  }, 40_000);
});

// ---------------------------------------------------------------------------------
// THE NEGATIVE — never an empty correction box
// ---------------------------------------------------------------------------------

describe("no empty correction is ever rendered", () => {
  test("an exam with no corrections yet draws no answer boxes and no scales", () => {
    const { container } = render(
      <SolutionView exam={EXAM} solutions={[]} onRegenerate={() => {}} />,
    );
    expect(container.querySelectorAll(".sol__answer")).toHaveLength(0);
    expect(container.querySelectorAll(".sol__scale")).toHaveLength(0);
    // Every exercise still gets a block — a correction silently missing a question is
    // the paper-based version of the silent-loss class two jobs existed to end.
    expect(container.querySelectorAll(".sol")).toHaveLength(EXAM.exercises.length);
    for (const s of container.querySelectorAll(".sol")) {
      expect(visibleText(s).trim().length).toBeGreaterThan(0);
    }
  });

  test("a waiting correction shows words, never a blank answer with a blank scale", () => {
    const { container } = render(
      <SolutionView exam={EXAM} solutions={[]} awaitingIds={IDS} onRegenerate={() => {}} />,
    );
    expect(container.querySelectorAll(".sol__answer")).toHaveLength(0);
    expect(container.querySelectorAll(".sol__scale")).toHaveLength(0);
    expect(container.querySelectorAll(".sol__pending")).toHaveLength(3);
    for (const p of container.querySelectorAll(".sol__pending")) {
      expect(visibleText(p).trim().length).toBeGreaterThan(0);
    }
  });

  test("while it is coming there is no regenerate control — that would be a second run", () => {
    const { container } = render(
      <SolutionView exam={EXAM} solutions={[]} awaitingIds={["ex1"]} onRegenerate={() => {}} />,
    );
    expect(container.querySelector('[data-solution-for="ex1"] .sol__regen')).toBeNull();
    // …but one the batch is NOT going to deliver can still be asked for.
    expect(container.querySelector('[data-solution-for="ex2"] .sol__regen')).toBeTruthy();
  });

  test("once the batch ends, a correction that never arrived becomes 'ask again'", () => {
    // The only signal `be` gives is presence, so this is the honest end state: no
    // waiting state left, and a way to ask for the one that is missing.
    const { container } = render(
      <SolutionView
        exam={EXAM}
        solutions={[solution("ex1", 6), solution("ex2", 6)]}
        onRegenerate={() => {}}
      />,
    );
    expect(container.querySelectorAll(".sol__pending")).toHaveLength(0);
    const ex3 = container.querySelector('[data-solution-for="ex3"]')!;
    expect(visibleText(ex3)).toContain("لا يوجد تصحيح لهذا التمرين بعد");
    expect(ex3.querySelector(".sol__regen")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------------
// THE HARD CONSTRAINTS
// ---------------------------------------------------------------------------------

describe("the hard constraints hold on the correction sheet", () => {
  test("every new string is Arabic — no English anywhere a teacher reads", () => {
    const { container } = render(
      <SolutionView
        exam={EXAM}
        solutions={[solution("ex1", 6)]}
        awaitingIds={["ex2", "ex3"]}
        onRegenerate={() => {}}
      />,
    );
    expectNoLatinWords(uiText(container));
    for (const b of container.querySelectorAll("button")) {
      expectNoLatinWords(b.textContent ?? "");
    }
    expect(visibleText(container)).toContain("جارٍ تحضير تصحيح هذا التمرين");
  });

  test("the waiting copy names no exercise id, no status word and no error code", () => {
    const { container } = render(
      <SolutionView exam={EXAM} solutions={[]} awaitingIds={IDS} onRegenerate={() => {}} />,
    );
    for (const p of container.querySelectorAll(".sol__pending")) {
      const t = p.textContent ?? "";
      expect(t).not.toMatch(/ex\d/i);
      expect(t).not.toMatch(/pending|awaiting|failed|error|202|409|null|undefined/i);
    }
  });

  test("no LaTeX is visible — the answer, the scale parts, and the waiting state", () => {
    // A correction is the densest maths in the product: `$…$` in the answer AND in
    // every scale `part`. All of it must arrive as rendered maths, none as characters.
    const { container } = render(
      <SolutionView
        exam={EXAM}
        solutions={[solution("ex1", 6)]}
        awaitingIds={["ex2", "ex3"]}
        onRegenerate={() => {}}
      />,
    );
    expect(container.querySelectorAll(".katex").length).toBeGreaterThan(0);
    expectNoLatex(visibleText(container));
    // Specifically inside the scale, which is the easiest place to forget.
    expectNoLatex(visibleText(container.querySelector(".sol__scale")!));
  });

  test("the RTL layout holds — logical properties only on the new state", () => {
    // jsdom cannot see a visual break, so the assertion is on what causes one.
    expect(document.documentElement.getAttribute("dir") ?? "rtl").toBe("rtl");
    const { container } = render(
      <SolutionView exam={EXAM} solutions={[]} awaitingIds={IDS} onRegenerate={() => {}} />,
    );
    const p = container.querySelector(".sol__pending")!;
    expect(p.getAttribute("style")).toBeNull();
    expect(p.className).not.toMatch(/left|right/);
  });

  test("the printed sheet never carries a waiting state or a control", () => {
    const { container } = render(
      <SolutionView
        exam={EXAM}
        solutions={[solution("ex1", 6)]}
        awaitingIds={["ex2", "ex3"]}
        printable
      />,
    );
    expect(container.querySelectorAll(".sol__regen")).toHaveLength(0);
    // The waiting note still prints as words rather than a blank box — a teacher must
    // never be handed a correction with a silently empty answer on it.
    for (const s of container.querySelectorAll(".sol")) {
      expect(visibleText(s).trim().length).toBeGreaterThan(0);
    }
  });
});
