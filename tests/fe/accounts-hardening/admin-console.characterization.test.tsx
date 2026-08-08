/**
 * fe-2 — the admin console.
 *
 * An operator who cannot see their own system cannot run it. This is the second UI
 * surface the product has ever had, and it is the first one with a privilege boundary
 * in front of it — so most of this suite is about what must NOT happen.
 *
 * THE FOUR THINGS THIS SUITE EXISTS TO CATCH:
 *
 *  1. **A hash reaching the DOM.** `be`'s projections are allow-lists and no hash
 *     should ever arrive — but every leak of one is permanent and cannot be rotated,
 *     so `fe` is tested against a payload that HAS them anyway. A console that renders
 *     whatever it is handed would publish a credential the day `be` regressed.
 *  2. **A teacher touching the admin surface.** Not just "does not see the console" —
 *     issues no admin call at all on the normal path, and exactly one (refused) if
 *     they go looking. 403 and 401 mean different things and must render differently;
 *     branching on the status code instead of `error.type` is what conflates them.
 *  3. **`costUsd` rendered as money.** It is a usage signal under a subscription
 *     (contract §1). A KPI labelled in currency would be the product lying to its own
 *     operator about its own economics.
 *  4. **An average with no denominator.** `examsWithKpis` is what the averages were
 *     computed over; everything created before this job carries null. Showing the
 *     average alone is how a dashboard misleads its owner.
 *
 * Shapes are the LIVE ones, recorded from :9500 on 2026-08-08 (7385 teachers, 3761
 * exams, examsWithKpis 330). `/api/generate` is never called.
 */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const TID = "0123456789abcdef0123456789abcdef";

/** Recorded from the live lane. Note `examsWithKpis` (330) ≪ `totalExams` (3761). */
const KPIS = {
  totalExams: 3761,
  totalTeachers: 7385,
  avgCostUsdPerExam: 0.5571174303030303,
  avgDurationMsPerExam: 85918.81212121212,
  avgExamsPerTeacher: 0.5092755585646581,
  examsWithKpis: 330,
  correlationId: "ae502ada-daf5-48f1-9403-58deda08daee",
};

const TEACHERS = [
  {
    teacherId: "a45e660a35245e4ddc3bfc35e5dbc1bf",
    email: "bounds.21@example.dz",
    role: "teacher",
    examCount: 0,
    createdAt: "2026-08-08T19:27:41.200Z",
  },
  {
    teacherId: "02684f4022967d5069ecfb4f1787e1d9",
    email: "admin@app.com",
    role: "admin",
    examCount: 4,
    createdAt: "2026-08-08T10:00:00.000Z",
  },
  {
    teacherId: "76d40e04d567ae5c30bd7eb148fbe6c5",
    email: null, // an anonymous row — a fact about the account, not a gap
    role: "teacher",
    examCount: 12,
    createdAt: "2026-08-07T19:27:35.061Z",
  },
];

const EXAMS = [
  {
    id: "6a778326c4af9504408709cb",
    teacherId: "30717e9d34b43440026a4c5ce0fa14a2",
    title: "اختبار في مادة الرياضيات",
    exerciseCount: 3,
    costUsd: 0.645421,
    durationMs: 127676,
    createdAt: "2026-08-08T19:27:34.196Z",
  },
  {
    id: "6a778321c4af9504408709c3",
    teacherId: "f9755062bd21aff6a904233010f09702",
    title: "اختبار الفصل الأول",
    exerciseCount: 1,
    // The pre-fe-1 majority: created before the numbers were stored.
    costUsd: null,
    durationMs: null,
    createdAt: "2026-08-07T19:27:29.340Z",
  },
];

type Call = { method: string; url: string; headers: Record<string, string> };

type Over = {
  kpis?: [number, unknown];
  teachers?: [number, unknown];
  exams?: [number, unknown];
  /** Hold the KPI response open, so the loading state can be observed. */
  hang?: boolean;
};

function harness(over: Over = {}) {
  const calls: Call[] = [];
  const fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? "GET";
    calls.push({ method, url, headers: (init.headers ?? {}) as Record<string, string> });
    const res = (status: number, payload: unknown) => ({
      ok: status < 300,
      status,
      json: async () => payload,
    });

    if (url === "/api/admin/kpis") {
      if (over.hang) await new Promise(() => {});
      const [s, p] = over.kpis ?? [200, KPIS];
      return res(s, p);
    }
    if (url === "/api/admin/teachers") {
      const [s, p] = over.teachers ?? [200, { teachers: TEACHERS, correlationId: "c" }];
      return res(s, p);
    }
    if (url === "/api/admin/exams") {
      const [s, p] = over.exams ?? [200, { exams: EXAMS, correlationId: "c" }];
      return res(s, p);
    }
    // The teacher surfaces, so the builder can render when it is supposed to.
    if (url === "/api/subjects" && method === "GET") return res(200, { subjects: [] });
    return res(404, { error: { message: "غير موجود", type: "subject_not_found" } });
  });

  vi.stubGlobal("fetch", fetchMock);
  const admin = () => calls.filter((c) => c.url.startsWith("/api/admin"));
  return { calls, admin, of: (u: string) => calls.filter((c) => c.url === u) };
}

async function mountApp() {
  const { default: App } = await import("@/App");
  return render(<App />);
}

/** The operator's route. A teacher never arrives here by using the product. */
const goAdmin = () => {
  window.location.hash = "#/admin";
};

const console_ = () => screen.getByTestId("admin-console");

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("teacher.id.v1", JSON.stringify(TID));
  window.location.hash = "";
  vi.unstubAllGlobals();
  vi.resetModules();
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  window.location.hash = "";
});

describe("the boundary — who reaches the admin surface at all", () => {
  test("a teacher's normal session renders the builder and issues NO admin call", async () => {
    const h = harness();
    await mountApp();

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "توليد الموضوع" })).toBeTruthy(),
    );
    expect(screen.queryByTestId("admin-console")).toBeNull();
    // Both halves, not just the first: an invisible console that still fetches would
    // put an operator's whole-system view one devtools tab away.
    expect(h.admin()).toHaveLength(0);
  });

  test("a teacher who goes looking is REFUSED, and the lists are never requested", async () => {
    const h = harness({
      kpis: [403, { error: { message: "هذه الصفحة مخصَّصة للمشرف", type: "forbidden" } }],
    });
    goAdmin();
    await mountApp();

    expect(await screen.findByText("هذه الصفحة مخصَّصة للمشرف")).toBeTruthy();
    expect(screen.queryByTestId("admin-kpis")).toBeNull();
    // Exactly one admin call, ever. The guard is asked once and believed.
    expect(h.admin()).toHaveLength(1);
    expect(h.of("/api/admin/teachers")).toHaveLength(0);
    expect(h.of("/api/admin/exams")).toHaveLength(0);
  });

  test("403 and 401 render DIFFERENTLY — branch on type, never on the status code", async () => {
    // Same family of failure to a careless reader, opposite meanings to an operator:
    // "you are not the admin" versus "I do not know who you are".
    const forbidden = harness({
      kpis: [403, { error: { message: "هذه الصفحة مخصَّصة للمشرف", type: "forbidden" } }],
    });
    goAdmin();
    await mountApp();
    expect(await screen.findByText("هذه الصفحة مخصَّصة للمشرف")).toBeTruthy();
    // A refusal is not retryable. Offering "try again" for it just loops the teacher.
    expect(screen.queryByRole("button", { name: "إعادة المحاولة" })).toBeNull();
    expect(forbidden.admin()).toHaveLength(1);

    cleanup();
    vi.resetModules();
    harness({
      kpis: [401, { error: { message: "مطلوب تسجيل الدخول", type: "teacher_required" } }],
    });
    localStorage.setItem("teacher.id.v1", JSON.stringify(TID));
    window.location.hash = "#/admin";
    await mountApp();
    // An unknown id is an identity problem: the app drops it and the sign-in gate takes
    // over. It must NOT look like a privilege refusal.
    expect(await screen.findByText("هذه الصفحة مخصَّصة للمشرف").catch(() => null)).toBeNull();
  });

  test("no admin id is ever put in the URL — the credential travels as a header", async () => {
    const h = harness();
    goAdmin();
    await mountApp();
    await waitFor(() => expect(h.admin().length).toBeGreaterThan(0));

    for (const c of h.admin()) {
      expect(c.url).not.toContain(TID);
      expect(c.url).not.toContain("?");
      expect(c.headers["x-teacher-id"]).toBe(TID);
    }
  });
});

describe("the console an admin sees", () => {
  test("the four global KPIs render, each with a label", async () => {
    harness();
    goAdmin();
    await mountApp();

    const kpis = await screen.findByTestId("admin-kpis");
    const text = kpis.textContent ?? "";
    expect(text).toContain("3761"); // إجمالي المواضيع
    expect(text).toContain("7385"); // إجمالي الأساتذة
    expect(text).toContain("0.5571"); // متوسط الاستهلاك — a usage figure
    expect(text).toContain("85.9"); // متوسط زمن التوليد, in seconds
    expect(text).toContain("0.51"); // متوسط المواضيع لكل أستاذ
  });

  test("THE DENOMINATOR — the averages state what they were computed over", async () => {
    // 330 of 3761. An average shown without this is a misleading number, not a
    // slightly incomplete one: 91% of the exams are not in it.
    harness();
    goAdmin();
    await mountApp();

    const kpis = await screen.findByTestId("admin-kpis");
    expect(kpis.textContent).toContain("330");
    expect(kpis.textContent).toContain("3761");
    // And it sits WITH the averages, not somewhere else on the page where it can be
    // read away from them.
    const denom = within(kpis).getByTestId("kpis-denominator");
    expect(denom.textContent).toContain("330");
    expect(denom.textContent).toContain("3761");
  });

  test("COST IS NOT MONEY — no currency symbol anywhere in the console", async () => {
    harness();
    goAdmin();
    await mountApp();
    await screen.findByTestId("admin-kpis");

    const html = console_().innerHTML;
    for (const token of ["$", "USD", "usd", "دج", "دينار", "€", "£", "﷼"]) {
      expect(html).not.toContain(token);
    }
    // The word "cost" must not leak either — not as a label, not as a class name.
    expect(html).not.toContain("costUsd");
  });

  test("the teacher list renders — role, exam count, and no email is invented", async () => {
    harness();
    goAdmin();
    await mountApp();

    const list = await screen.findByTestId("admin-teachers");
    expect(list.textContent).toContain("admin@app.com");
    expect(list.textContent).toContain("bounds.21@example.dz");
    // A null email is an anonymous row. It is stated in Arabic, never left blank and
    // never filled in with the id to look tidy.
    expect(list.textContent).toContain("بدون بريد");
    expect(list.textContent).toContain("12"); // examCount
  });

  test("the exam list renders newest-first with per-exam cost and duration", async () => {
    harness();
    goAdmin();
    await mountApp();

    const list = await screen.findByTestId("admin-exams");
    const rows = within(list).getAllByRole("row").slice(1); // drop the header row
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain("اختبار في مادة الرياضيات");
    expect(rows[0].textContent).toContain("0.6454");
    expect(rows[0].textContent).toContain("127.7"); // seconds
    // The pre-fe-1 majority: absent is stated, never shown as a free instant run.
    expect(rows[1].textContent).toContain("—");
    expect(rows[1].textContent).not.toContain("0.0000");
  });

  test("a teacherId is never rendered in full — it is still a bearer credential", async () => {
    // Accounts made the id recoverable, not secret: whoever holds one reads that
    // teacher's exams. A prefix is enough to correlate a teacher with their exams at
    // this scale, and putting 7385 live credentials on a screen is not.
    harness();
    goAdmin();
    await mountApp();
    await screen.findByTestId("admin-teachers");

    const html = console_().innerHTML;
    for (const t of TEACHERS) expect(html).not.toContain(t.teacherId);
    for (const e of EXAMS) expect(html).not.toContain(e.teacherId);
    expect(html).toContain(TEACHERS[0].teacherId.slice(0, 8));

    // The truncated id must be bidi-ISOLATED. Found in Chrome, not here: `…` is a
    // neutral, so inside this RTL page it paints to the LEFT of the Latin run and
    // `a45e660a…` renders as `…a45e660a` — the wrong end of the id. `textContent` is
    // byte-identical either way, so this attribute is the only thing jsdom can see.
    const cell = within(console_()).getAllByText(/a45e660a/)[0];
    expect(cell.closest("[dir='ltr']")).not.toBeNull();
  });

  test("an uncapped teacher list is rendered defensively, and says so", async () => {
    // The live store already holds 7385 rows and `GET /api/admin/teachers` has no cap.
    // Rendering all of them is a page that fights the operator; rendering some of them
    // without saying so is a lie about how many teachers exist.
    const many = Array.from({ length: 7385 }, (_, i) => ({
      teacherId: `${i}`.padStart(32, "0"),
      email: `t${i}@example.dz`,
      role: "teacher",
      examCount: 0,
      createdAt: "2026-08-08T00:00:00.000Z",
    }));
    harness({ teachers: [200, { teachers: many }] });
    goAdmin();
    await mountApp();

    const list = await screen.findByTestId("admin-teachers");
    const rows = within(list).getAllByRole("row").slice(1);
    expect(rows.length).toBeLessThan(7385);
    expect(list.textContent).toContain("7385"); // the true total, stated
  });
});

describe("every state, including the ones nobody demos", () => {
  test("loading — the console says so and shows no half-built numbers", async () => {
    harness({ hang: true });
    goAdmin();
    await mountApp();

    expect(await screen.findByTestId("admin-loading")).toBeTruthy();
    expect(screen.queryByTestId("admin-kpis")).toBeNull();
  });

  test("an EMPTY system shows zeroes and empty lists — never an error, never NaN", async () => {
    harness({
      kpis: [
        200,
        {
          totalExams: 0,
          totalTeachers: 0,
          avgCostUsdPerExam: 0,
          avgDurationMsPerExam: 0,
          avgExamsPerTeacher: 0,
          examsWithKpis: 0,
        },
      ],
      teachers: [200, { teachers: [] }],
      exams: [200, { exams: [] }],
    });
    goAdmin();
    await mountApp();

    const kpis = await screen.findByTestId("admin-kpis");
    expect(kpis.textContent).toContain("0");
    const html = console_().innerHTML;
    // A divide-by-zero that reached the screen would read as a number to an operator.
    expect(html).not.toContain("NaN");
    expect(html).not.toContain("Infinity");
    expect(html).not.toContain("undefined");
    expect(screen.queryByRole("alert")).toBeNull();
    // Emptiness is a state the console renders, not a failure.
    expect(screen.getByTestId("admin-teachers").textContent).toContain("لا يوجد");
    expect(screen.getByTestId("admin-exams").textContent).toContain("لا يوجد");
  });

  test("store_unavailable is RETRYABLE — and retrying actually refetches", async () => {
    const h = harness({
      kpis: [503, { error: { message: "الخدمة غير متاحة مؤقتًا", type: "store_unavailable" } }],
    });
    goAdmin();
    await mountApp();

    const retry = await screen.findByRole("button", { name: "إعادة المحاولة" });
    expect(h.of("/api/admin/kpis")).toHaveLength(1);
    fireEvent.click(retry);
    await waitFor(() => expect(h.of("/api/admin/kpis")).toHaveLength(2));
  });

  test("RACE — two retry presses in ONE act() refetch once, not twice", async () => {
    // `fireEvent` flushes React between events, so two separate clicks would only
    // prove that `disabled` re-rendered. Dispatched inside a single `act()`, the
    // component cannot re-render between them — which is the only version that
    // exercises the in-flight guard rather than the button's disabled attribute.
    const h = harness({
      kpis: [503, { error: { message: "الخدمة غير متاحة مؤقتًا", type: "store_unavailable" } }],
    });
    goAdmin();
    await mountApp();

    const retry = await screen.findByRole("button", { name: "إعادة المحاولة" });
    await act(async () => {
      retry.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      retry.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() => expect(h.of("/api/admin/kpis").length).toBeGreaterThanOrEqual(2));
    expect(h.of("/api/admin/kpis")).toHaveLength(2); // the first load + ONE retry
  });

  test("the three surfaces are each requested exactly once per load", async () => {
    const h = harness();
    goAdmin();
    await mountApp();
    await screen.findByTestId("admin-exams");

    expect(h.of("/api/admin/kpis")).toHaveLength(1);
    expect(h.of("/api/admin/teachers")).toHaveLength(1);
    expect(h.of("/api/admin/exams")).toHaveLength(1);
  });
});

describe("negative — what must never appear", () => {
  test("NO HASH EVER REACHES THE DOM, even when the API hands one over", async () => {
    // `be`'s projections are allow-lists and this payload should be impossible. It is
    // tested anyway because the cost is asymmetric: a leaked hash cannot be rotated
    // out of a screenshot, a browser cache or an operator's shoulder-surfer.
    harness({
      teachers: [
        200,
        {
          teachers: [
            {
              ...TEACHERS[0],
              passwordHash: "scrypt$16384$8$1$c2FsdA$a2V5",
              recoveryHash: "scrypt$16384$8$1$c2FsdA$b3RoZXI",
            },
          ],
        },
      ],
    });
    goAdmin();
    await mountApp();
    await screen.findByTestId("admin-teachers");

    // innerHTML, not textContent: an attribute, a title or a data-* would be just as
    // leaked and invisible to a text-only assertion.
    const html = console_().innerHTML;
    expect(html).not.toContain("scrypt$");
    expect(html).not.toContain("passwordHash");
    expect(html).not.toContain("recoveryHash");
    expect(html).not.toContain("c2FsdA");
    // And nothing dumps the raw row somewhere convenient.
    expect(document.body.innerHTML).not.toContain("scrypt$");
  });

  test("every string is Arabic, RTL is intact, and no LaTeX is visible", async () => {
    harness();
    goAdmin();
    await mountApp();
    await screen.findByTestId("admin-kpis");

    const root = console_();
    expect(root.closest("[dir]")?.getAttribute("dir") ?? document.documentElement.dir).not.toBe(
      "ltr",
    );

    // Strip the data the API supplied (emails, ids, ISO dates, numbers) and assert what
    // the COMPONENT contributes is Arabic.
    const chrome = Array.from(root.querySelectorAll("h1,h2,th,label,button,.admin__label"))
      .map((e) => e.textContent ?? "")
      .join(" ");
    expect(chrome.trim().length).toBeGreaterThan(0);
    expect(/[A-Za-z]/.test(chrome)).toBe(false);
    expect(/[؀-ۿ]/.test(chrome)).toBe(true);
    // LaTeX is fully hidden from every surface of this product, admin included.
    expect(root.innerHTML).not.toContain("\\frac");
    expect(root.textContent).not.toContain("\\");
  });

  test("the builder is untouched — the teacher surface renders exactly as before", async () => {
    harness();
    await mountApp();

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "توليد الموضوع" })).toBeTruthy(),
    );
    expect(screen.getByRole("button", { name: "الحساب" })).toBeTruthy();
    expect(screen.getByText("مولّد مواضيع البكالوريا")).toBeTruthy();
    // No admin affordance is offered to a teacher — not a link, not a hint.
    expect(screen.queryByText(/مشرف/)).toBeNull();
  });

  test("the admin console offers no write — it can only look", async () => {
    const h = harness();
    goAdmin();
    await mountApp();
    await screen.findByTestId("admin-exams");

    expect(h.calls.filter((c) => c.method !== "GET")).toHaveLength(0);
    // A console that can only read cannot break a teacher's exam.
    for (const b of within(console_()).queryAllByRole("button")) {
      expect(["إعادة المحاولة", "العودة إلى المولّد"]).toContain(b.textContent?.trim());
    }
  });
});
