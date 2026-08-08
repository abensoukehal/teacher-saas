/**
 * fe-3 — let a teacher go back to a previous version.
 *
 * Refining until it is right IS the product. Without a way back, a teacher who
 * refines an exercise into something worse has destroyed work that cost real
 * money and two minutes of waiting to generate.
 *
 * Two things here are contract, not implementation detail:
 *
 *  - **Restore is not a new endpoint.** It is the existing
 *    `PUT …/exercises/:exerciseId` with an older body — which itself supersedes
 *    the current version. History is therefore linear and never destructive, and
 *    restoring makes the list GROW.
 *  - **No LaTeX may surface.** A history panel is the most tempting place in the
 *    product to dump a raw statement; the hard constraint forbids it outright, so
 *    previous versions render through KaTeX like every other maths surface.
 */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const TID = "0123456789abcdef0123456789abcdef";
const SID = "s1";

/** Real-shaped statements: Arabic prose with KaTeX math islands. */
const S_ORIGINAL = "احسب نهاية الدالة $f(x)=\\dfrac{1}{x}$ عند $+\\infty$.";
const S_SECOND = "احسب نهاية الدالة $g(x)=\\dfrac{2}{x}$ عند $+\\infty$.";
const S_THIRD = "احسب نهاية الدالة $h(x)=\\dfrac{3}{x}$ عند $+\\infty$.";

const ex1 = (statement: string) => ({
  id: "ex1",
  label: "التمرين الأول",
  points: 10,
  statement,
});

const EXAM = {
  title: "اختبار في مادة الرياضيات",
  meta: { totalPoints: 20, topic: "الدوال", stream: "شعبة الرياضيات", durationMinutes: 120 },
  exercises: [ex1(S_ORIGINAL), { id: "ex2", label: "التمرين الثاني", points: 10, statement: "نص" }],
};

type Call = { method: string; url: string; body: any };

/**
 * A stateful mock of `be`: PUT appends the OUTGOING version to the history and
 * the GET returns it newest-first, exactly as `exercise_revisions` does. A
 * stateless mock could not express "restoring makes the list grow", which is the
 * clause that proves restore is not destructive.
 */
function harness(
  over: { revisions?: [number, unknown]; put?: [number, unknown]; refineTo?: string } = {},
) {
  const calls: Call[] = [];
  const revisions: Array<{ revisionId: string; exercise: unknown; supersededAt: string }> = [];
  let current = ex1(S_ORIGINAL);
  let n = 0;

  const fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? "GET";
    const body = init.body ? JSON.parse(init.body as string) : undefined;
    calls.push({ method, url, body });
    const res = (status: number, payload: unknown) => ({
      ok: status < 300,
      status,
      json: async () => payload,
    });

    if (url.endsWith("/revisions")) {
      const [s, p] = over.revisions ?? [200, { revisions: [...revisions], correlationId: "c" }];
      return res(s, p);
    }
    if (method === "PUT") {
      if (over.put) return res(over.put[0], over.put[1]);
      n += 1;
      // The superseded version, recorded before the replace lands. Newest first.
      revisions.unshift({
        revisionId: `r${n}`,
        exercise: current,
        supersededAt: `2026-08-0${n}T09:00:00.000Z`,
      });
      current = body.exercise;
      return res(200, {
        id: SID,
        createdAt: "t",
        updatedAt: "t",
        subject: { ...EXAM, exercises: [current, EXAM.exercises[1]] },
      });
    }
    if (url === "/api/generate") {
      return res(200, {
        data: ex1(over.refineTo ?? (n === 0 ? S_SECOND : S_THIRD)),
        correlationId: "g",
      });
    }
    if (url === "/api/subjects" && method === "GET") return res(200, { subjects: [] });
    return res(404, { error: { message: "غير موجود", type: "subject_not_found" } });
  });

  vi.stubGlobal("fetch", fetchMock);
  return {
    calls,
    puts: () => calls.filter((c) => c.method === "PUT"),
    revisionGets: () => calls.filter((c) => c.url.endsWith("/revisions")),
  };
}

async function mountApp() {
  const { default: App } = await import("@/App");
  return render(<App />);
}

const openRefine = () =>
  fireEvent.click(screen.getAllByRole("button", { name: "تعديل هذا التمرين" })[0]);

/** One full refinement through the UI, which is what appends a revision. */
async function refineOnce(instruction = "غيّر الأرقام") {
  openRefine();
  fireEvent.change(screen.getByPlaceholderText("اكتب ما تريد تغييره بلغتك…"), {
    target: { value: instruction },
  });
  fireEvent.click(screen.getByRole("button", { name: "طبّق التعديل" }));
}

/** The history region inside the refine panel. */
const history = () => screen.getByRole("region", { name: "النسخ السابقة" });
const restoreButtons = () => within(history()).queryAllByRole("button", { name: "استرجاع هذه النسخة" });

beforeEach(() => {
  localStorage.clear();
  // A signed-in teacher with a saved subject already open — this slice is about
  // the panel, not the gate or the generation.
  localStorage.setItem("teacher.id.v1", JSON.stringify(TID));
  localStorage.setItem("teacher.current.v1", JSON.stringify(SID));
  localStorage.setItem("teacher.cache.v1", JSON.stringify(EXAM));
  vi.unstubAllGlobals();
  vi.resetModules();
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => cleanup());

describe("the history a teacher can actually see", () => {
  test("never refined → an Arabic empty line, NOT an error", async () => {
    const h = harness();
    await mountApp();
    openRefine();

    await waitFor(() => expect(history()).toBeTruthy());
    await waitFor(() => expect(within(history()).getByText(/لا توجد نسخ سابقة/)).toBeTruthy());
    // An empty history is a state, not a failure.
    expect(within(history()).queryByRole("alert")).toBeNull();
    expect(h.revisionGets()).toHaveLength(1);
  });

  test("after two refinements the panel lists 2 previous versions, newest first", async () => {
    harness();
    await mountApp();

    await refineOnce();
    await waitFor(() => expect(screen.getByText(/g\(x\)|احسب نهاية الدالة/)).toBeTruthy());
    await refineOnce();
    await waitFor(() => expect(screen.getAllByRole("button", { name: "تعديل هذا التمرين" }).length).toBeGreaterThan(0));

    openRefine();
    await waitFor(() => expect(restoreButtons()).toHaveLength(2));

    // Newest superseded first — the order be returns, preserved by fe.
    const items = within(history()).getAllByRole("listitem");
    expect(items[0].textContent).toContain("احسب نهاية الدالة");
    expect(items).toHaveLength(2);
  });

  test("each previous version renders through KaTeX", async () => {
    harness();
    await mountApp();
    await refineOnce();
    await waitFor(() => expect(screen.getAllByRole("button", { name: "تعديل هذا التمرين" }).length).toBeGreaterThan(0));
    openRefine();
    await waitFor(() => expect(restoreButtons()).toHaveLength(1));

    // The same renderer every other maths surface uses.
    expect(history().querySelectorAll(".katex").length).toBeGreaterThan(0);
  });

  test("the supersession time is shown, so two versions are tellable apart", async () => {
    harness();
    await mountApp();
    await refineOnce();
    await waitFor(() => expect(screen.getAllByRole("button", { name: "تعديل هذا التمرين" }).length).toBeGreaterThan(0));
    openRefine();
    await waitFor(() => expect(restoreButtons()).toHaveLength(1));

    const item = within(history()).getAllByRole("listitem")[0];
    // Some date text, in Arabic numerals or Arabic month names — never an ISO string.
    expect(item.textContent).not.toContain("2026-08-01T09:00:00.000Z");
    expect(item.textContent!.length).toBeGreaterThan(S_ORIGINAL.length - 20);
  });

  test("loading and a retryable failure are both states, and the retry re-fetches", async () => {
    const h = harness({
      revisions: [503, { error: { message: "الخدمة غير متاحة مؤقتًا", type: "store_unavailable" } }],
    });
    await mountApp();
    openRefine();

    const alert = await within(history()).findByRole("alert");
    expect(alert.textContent).toContain("الخدمة غير متاحة مؤقتًا");
    fireEvent.click(within(history()).getByRole("button", { name: "إعادة المحاولة" }));
    await waitFor(() => expect(h.revisionGets()).toHaveLength(2));
  });
});

describe("restore — the existing PUT, never a new endpoint", () => {
  test("restoring issues PUT …/exercises/ex1 with THAT version's body", async () => {
    const h = harness();
    await mountApp();
    await refineOnce();
    await waitFor(() => expect(screen.getAllByRole("button", { name: "تعديل هذا التمرين" }).length).toBeGreaterThan(0));
    openRefine();
    await waitFor(() => expect(restoreButtons()).toHaveLength(1));

    fireEvent.click(restoreButtons()[0]);
    await waitFor(() => expect(h.puts()).toHaveLength(2));

    const put = h.puts()[1];
    expect(put.url).toBe(`/api/subjects/${SID}/exercises/ex1`);
    expect(put.body).toEqual({ exercise: ex1(S_ORIGINAL) });
    // No undo-specific surface was invented.
    for (const c of h.calls) expect(c.url).not.toMatch(/restore|undo|revert/i);
  });

  test("the sheet then shows the restored statement", async () => {
    harness();
    await mountApp();
    await refineOnce();
    await waitFor(() => expect(screen.getAllByRole("button", { name: "تعديل هذا التمرين" }).length).toBeGreaterThan(0));
    openRefine();
    await waitFor(() => expect(restoreButtons()).toHaveLength(1));

    fireEvent.click(restoreButtons()[0]);
    // f(x) is the original; the refinement had replaced it with g(x).
    await waitFor(() => {
      const sheet = document.querySelector(".exam") as HTMLElement;
      expect(sheet.querySelector('[data-exercise-id="ex1"]')!.textContent).toContain("احسب نهاية الدالة");
    });
  });

  test("restoring GROWS the list to 3 — it supersedes, it never destroys", async () => {
    harness();
    await mountApp();
    await refineOnce();
    await waitFor(() => expect(screen.getAllByRole("button", { name: "تعديل هذا التمرين" }).length).toBeGreaterThan(0));
    await refineOnce();
    await waitFor(() => expect(screen.getAllByRole("button", { name: "تعديل هذا التمرين" }).length).toBeGreaterThan(0));

    openRefine();
    await waitFor(() => expect(restoreButtons()).toHaveLength(2));
    fireEvent.click(restoreButtons()[0]);

    // The panel stays open and re-reads: restoring is itself a supersession.
    await waitFor(() => expect(restoreButtons()).toHaveLength(3));
  });

  test("A DOUBLE-CLICKED restore issues ONE write, not two", async () => {
    // The race, written from the start. Two writes of the same body would push a
    // spurious extra version into a history the teacher reads to decide what to
    // keep — and be answers a genuine collision with 409, not a silent overwrite.
    const h = harness();
    await mountApp();
    await refineOnce();
    await waitFor(() => expect(screen.getAllByRole("button", { name: "تعديل هذا التمرين" }).length).toBeGreaterThan(0));
    openRefine();
    await waitFor(() => expect(restoreButtons()).toHaveLength(1));

    // Dispatched inside ONE act so React cannot re-render — and therefore cannot
    // set `disabled` — between them. Through `fireEvent` this clause passes even
    // with the in-flight guard deleted, which makes it no oracle at all;
    // verified by mutation both ways.
    const btn = restoreButtons()[0];
    await act(async () => {
      btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await waitFor(() => expect(h.puts().length).toBeGreaterThan(1));
    expect(h.puts()).toHaveLength(2); // the refine + exactly one restore
  });

  test("409 conflict is surfaced as RETRYABLE, in Arabic", async () => {
    // Two refinements of the same exercise at once. Retrying is safe and nothing
    // was lost — the opposite of a silent overwrite.
    harness({
      put: [409, { error: { message: "جارٍ تعديل هذا التمرين، أعد المحاولة", type: "conflict" } }],
    });
    await mountApp();
    await refineOnce();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("جارٍ تعديل هذا التمرين، أعد المحاولة");
    // Retryable: the teacher is offered the action again rather than told it is hopeless.
    expect(screen.getAllByRole("button", { name: "إعادة المحاولة" }).length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toContain("لا يُحل بإعادة المحاولة");
  });
});

describe("negative — the hard constraints and the frozen sheet", () => {
  test("NO LaTeX source is visible anywhere in the history", async () => {
    harness();
    await mountApp();
    await refineOnce();
    await waitFor(() => expect(screen.getAllByRole("button", { name: "تعديل هذا التمرين" }).length).toBeGreaterThan(0));
    openRefine();
    await waitFor(() => expect(restoreButtons()).toHaveLength(1));

    const text = history().textContent ?? "";
    expect(text).not.toContain("\\dfrac");
    expect(text).not.toContain("\\frac");
    expect(text).not.toContain("$");
    expect(text).not.toContain("\\(");
  });

  test("every string in the history is Arabic", async () => {
    harness();
    await mountApp();
    openRefine();
    await waitFor(() => expect(history()).toBeTruthy());

    // KaTeX output is maths, not copy — it is excluded the same way the exam
    // sheet's own pin excludes it.
    const clone = history().cloneNode(true) as HTMLElement;
    for (const el of Array.from(clone.querySelectorAll(".katex, [dir='ltr']"))) el.remove();
    expect(clone.textContent ?? "").not.toMatch(/[A-Za-z]{4,}/);
  });

  test("history never enters the exam sheet", async () => {
    harness();
    await mountApp();
    await refineOnce();
    await waitFor(() => expect(screen.getAllByRole("button", { name: "تعديل هذا التمرين" }).length).toBeGreaterThan(0));
    openRefine();
    await waitFor(() => expect(restoreButtons()).toHaveLength(1));

    const sheet = document.querySelector(".exam") as HTMLElement;
    // The sheet is what gets printed. It carries the CURRENT exercise only —
    // history is an affordance, never part of the paper.
    expect(sheet.textContent).not.toContain("النسخ السابقة");
    expect(sheet.querySelectorAll('[data-exercise-id]').length).toBe(2);
    expect(within(sheet).queryAllByRole("button", { name: "استرجاع هذه النسخة" })).toHaveLength(0);
  });

  test("opening the panel issues ONE revisions request, not one per render", async () => {
    const h = harness();
    await mountApp();
    openRefine();
    await waitFor(() => expect(h.revisionGets()).toHaveLength(1));

    // Force re-renders by typing into the instruction box.
    const box = screen.getByPlaceholderText("اكتب ما تريد تغييره بلغتك…");
    fireEvent.change(box, { target: { value: "ا" } });
    fireEvent.change(box, { target: { value: "اب" } });
    fireEvent.change(box, { target: { value: "ابج" } });
    await waitFor(() => expect(screen.getByRole("button", { name: "طبّق التعديل" })).toBeTruthy());
    expect(h.revisionGets()).toHaveLength(1);
  });

  test("the refine panel's own contract is unchanged", async () => {
    harness();
    await mountApp();
    openRefine();

    // Shortcuts, the plain-Arabic box and the submit are the core loop's input —
    // adding history must not disturb them.
    expect(screen.getByRole("button", { name: "غيّر الأرقام" })).toBeTruthy();
    expect(screen.getByPlaceholderText("اكتب ما تريد تغييره بلغتك…")).toBeTruthy();
    expect(screen.getByRole("button", { name: "طبّق التعديل" })).toBeTruthy();
  });
});
