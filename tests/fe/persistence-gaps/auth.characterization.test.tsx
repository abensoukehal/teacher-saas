/**
 * fe-1 — sign up, sign in, recover.
 *
 * The load-bearing clauses, in order of how much they cost when wrong:
 *
 *  1. SIGN-UP ADOPTS THE HELD ID. A browser that already holds `teacher.id.v1`
 *     must send it as `x-teacher-id` on sign-up, because `be` then attaches the
 *     account to THAT row and the teacher's existing exams follow them in.
 *     Without the header a new id is minted and every exam they made is orphaned
 *     — gap #1 reintroduced by its own fix.
 *  2. SIGN-IN RE-POPULATES. Clear storage, sign in, the subjects come back. That
 *     is gap #1 closed, asserted end to end.
 *  3. THE RECOVERY CODE IS SHOWN ONCE, LTR. A teacher writes it on paper; an
 *     RTL-flipped code is one they transcribe wrong. It is the single deliberate
 *     LTR exception in an Arabic-only, RTL-throughout product.
 *
 * Errors branch on `error.type`, never on the status code: `claude_auth` and
 * `store_unavailable` are both 503 and mean opposite things.
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const TID = "0123456789abcdef0123456789abcdef";
const HELD = "aaaabbbbccccddddeeeeffff00001111";
const CODE = "K7M2-P9QR-4XTA";
const FRESH = "B3ND-8HJK-2WQZ";

const EXAM = {
  title: "الموضوع الأول",
  meta: { totalPoints: 20, topic: "الدوال", stream: "شعبة الرياضيات", level: "3AS" },
  exercises: [
    { id: "ex1", label: "التمرين الأول", points: 10, statement: "أ" },
    { id: "ex2", label: "التمرين الثاني", points: 10, statement: "ب" },
  ],
};

const SUMMARIES = [
  {
    id: "s1",
    title: "اختبار الفصل الأول",
    topic: "الدوال",
    exerciseCount: 2,
    totalPoints: 20,
    createdAt: "2026-08-01T10:00:00.000Z",
    updatedAt: "2026-08-01T10:00:00.000Z",
  },
  {
    id: "s2",
    title: "اختبار الفصل الثاني",
    topic: "المتتاليات",
    exerciseCount: 3,
    totalPoints: 20,
    createdAt: "2026-08-02T10:00:00.000Z",
    updatedAt: "2026-08-02T10:00:00.000Z",
  },
];

type Call = { method: string; url: string; body: any; teacher?: string };

/** Records every request so the assertions talk about the wire, not the UI. */
function harness(
  over: Partial<{
    signup: [number, unknown];
    signin: [number, unknown];
    recover: [number, unknown];
    subjects: [number, unknown];
  }> = {},
) {
  const calls: Call[] = [];
  const fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? "GET";
    const body = init.body ? JSON.parse(init.body as string) : undefined;
    const teacher = (init.headers as Record<string, string> | undefined)?.["x-teacher-id"];
    calls.push({ method, url, body, teacher });

    const res = (status: number, payload: unknown) => ({
      ok: status < 300,
      status,
      json: async () => payload,
    });

    if (url === "/api/auth/signup") {
      const [s, p] = over.signup ?? [
        201,
        { teacherId: TID, recoveryCode: CODE, correlationId: "c1" },
      ];
      return res(s, p);
    }
    if (url === "/api/auth/signin") {
      const [s, p] = over.signin ?? [200, { teacherId: TID, correlationId: "c2" }];
      return res(s, p);
    }
    if (url === "/api/auth/recover") {
      const [s, p] = over.recover ?? [
        200,
        { teacherId: TID, recoveryCode: FRESH, correlationId: "c3" },
      ];
      return res(s, p);
    }
    if (url === "/api/subjects" && method === "GET") {
      const [s, p] = over.subjects ?? [200, { subjects: SUMMARIES }];
      return res(s, p);
    }
    if (url === "/api/subjects" && method === "POST") {
      return res(201, { id: "s9", createdAt: "t", updatedAt: "t", subject: body.subject });
    }
    if (url === "/api/generate") return res(200, { data: EXAM, correlationId: "g1" });
    // parallel-exercises fe-2: exam creation moved to POST /api/exams. `be` inserts the
    // skeleton and answers with its id, so there is no create from `fe` on this path.
    if (url === "/api/exams" && method === "POST") {
      return res(201, { subjectId: "s9", subject: EXAM, correlationId: "g1" });
    }
    if (url === "/api/subjects/s9" && method === "GET") {
      return res(200, { id: "s9", createdAt: "t", updatedAt: "t", subject: EXAM });
    }
    if (url === "/api/teacher") return res(201, { teacherId: TID });
    return res(404, { error: { message: "غير موجود", type: "subject_not_found" } });
  });

  vi.stubGlobal("fetch", fetchMock);
  const of = (u: string) => calls.filter((c) => c.url === u);
  return { calls, of, signups: () => of("/api/auth/signup") };
}

const err = (type: string, message = "رسالة بالعربية") => ({
  error: { message, type },
  correlationId: "cid",
});

async function mountApp() {
  const { default: App } = await import("@/App");
  return render(<App />);
}

/** The panel exposes its fields by aria-label; queries stay stable under restyling. */
const emailBox = () => screen.getByLabelText("البريد الإلكتروني");
const passwordBox = () => screen.getByLabelText("كلمة المرور");
const codeBox = () => screen.getByLabelText("رمز الاسترجاع");

function fill(el: HTMLElement, value: string) {
  fireEvent.change(el, { target: { value } });
}

const click = (name: string) => fireEvent.click(screen.getByRole("button", { name }));

/** Open the sign-up tab, fill it, submit. */
async function signUp(email = "prof@madrasa.dz", password = "kalimat-sir-12") {
  click("حساب جديد");
  fill(emailBox(), email);
  fill(passwordBox(), password);
  click("إنشاء الحساب");
}

async function signIn(email = "prof@madrasa.dz", password = "kalimat-sir-12") {
  fill(emailBox(), email);
  fill(passwordBox(), password);
  click("تسجيل الدخول");
}

beforeEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.resetModules();
  // jsdom gap, not a product bug (RefinePanel scrolls itself into view on mount).
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => cleanup());

describe("the gate — no identity, no builder", () => {
  test("an empty browser renders the auth panel, not the exam builder", async () => {
    const h = harness();
    await mountApp();

    expect(screen.queryByRole("button", { name: "توليد الموضوع" })).toBeNull();
    expect(screen.getByRole("button", { name: "تسجيل الدخول" })).toBeTruthy();
    // The anonymous mint is gone: identity now comes from an account.
    expect(h.of("/api/teacher")).toHaveLength(0);
  });

  test("a held id renders the builder directly — no gate for a returning teacher", async () => {
    localStorage.setItem("teacher.id.v1", JSON.stringify(HELD));
    harness();
    await mountApp();

    await waitFor(() => expect(screen.getByRole("button", { name: "توليد الموضوع" })).toBeTruthy());
  });
});

describe("sign-up", () => {
  test("issues POST /api/auth/signup with the credentials, relative", async () => {
    const h = harness();
    await mountApp();
    await signUp();

    await waitFor(() => expect(h.signups()).toHaveLength(1));
    const c = h.signups()[0];
    expect(c.method).toBe("POST");
    expect(c.url).toBe("/api/auth/signup");
    expect(c.body).toEqual({ email: "prof@madrasa.dz", password: "kalimat-sir-12" });
  });

  test("THE ADOPTION CLAUSE — a held teacher id is sent as x-teacher-id", async () => {
    // A teacher who used the app before accounts existed already owns subjects
    // under this id. Signing up without offering it mints a new one and orphans
    // every exam they have.
    localStorage.setItem("teacher.id.v1", JSON.stringify(HELD));
    const h = harness();
    await mountApp();

    await waitFor(() => expect(screen.getByRole("button", { name: "الحساب" })).toBeTruthy());
    click("الحساب");
    await signUp();

    await waitFor(() => expect(h.signups()).toHaveLength(1));
    expect(h.signups()[0].teacher).toBe(HELD);
  });

  test("with no held id, sign-up sends no x-teacher-id header", async () => {
    const h = harness();
    await mountApp();
    await signUp();

    await waitFor(() => expect(h.signups()).toHaveLength(1));
    expect(h.signups()[0].teacher).toBeUndefined();
  });

  test("the recovery code is displayed ONCE, LTR, with a copy affordance", async () => {
    harness();
    await mountApp();
    await signUp();

    const el = await screen.findByText(CODE);
    // The single deliberate LTR exception. RTL would flip the groups and the
    // teacher would write the code down wrong.
    expect(el.getAttribute("dir")).toBe("ltr");
    expect(screen.getByRole("button", { name: "نسخ الرمز" })).toBeTruthy();
  });

  test("continuing stores teacher.id.v1 = the returned id and renders the builder", async () => {
    harness();
    await mountApp();
    await signUp();
    await screen.findByText(CODE);
    click("متابعة");

    await waitFor(() => expect(localStorage.getItem("teacher.id.v1")).toBe(JSON.stringify(TID)));
    await waitFor(() => expect(screen.getByRole("button", { name: "توليد الموضوع" })).toBeTruthy());
  });

  test("the recovery code is NEVER shown again — and never stored", async () => {
    harness();
    await mountApp();
    await signUp();
    await screen.findByText(CODE);
    click("متابعة");
    await waitFor(() => expect(localStorage.getItem("teacher.id.v1")).toBeTruthy());

    // It exists in exactly one response body, once. Nothing may keep it.
    expect(JSON.stringify(localStorage)).not.toContain("K7M2");
    expect(document.body.textContent).not.toContain(CODE);

    cleanup();
    await mountApp();
    await waitFor(() => expect(screen.getByRole("button", { name: "توليد الموضوع" })).toBeTruthy());
    expect(screen.queryByText(CODE)).toBeNull();
  });

  test("a double submit issues ONE request, not two accounts", async () => {
    // Written for the race from the start: both submits land inside the same
    // in-flight request, at ordinary human double-click timing.
    //
    // Fired at the FORM, not the button, on purpose. A disabled button is the
    // visible half of the guard and Enter-in-a-field walks straight past it, so
    // asserting through the button would prove only that React honours
    // `disabled`. Two accounts here means the teacher's exams end up under
    // whichever id lost.
    const h = harness();
    await mountApp();
    click("حساب جديد");
    fill(emailBox(), "prof@madrasa.dz");
    fill(passwordBox(), "kalimat-sir-12");

    const form = document.querySelector("form") as HTMLFormElement;
    const btn = screen.getByRole("button", { name: "إنشاء الحساب" });
    fireEvent.submit(form);
    fireEvent.submit(form);
    fireEvent.click(btn); // now disabled — must not add a third

    await waitFor(() => expect(h.signups().length).toBeGreaterThan(0));
    expect(h.signups()).toHaveLength(1);
    await screen.findByText(CODE);
  });

  test("409 email_taken → an Arabic message, and NO retry affordance", async () => {
    harness({ signup: [409, err("email_taken", "هذا البريد الإلكتروني مسجَّل بالفعل")] });
    await mountApp();
    await signUp();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("هذا البريد الإلكتروني مسجَّل بالفعل");
    expect(screen.queryByRole("button", { name: "إعادة المحاولة" })).toBeNull();
  });

  test("503 store_unavailable → RETRYABLE, and the retry re-issues the request", async () => {
    const h = harness({ signup: [503, err("store_unavailable", "الخدمة غير متاحة مؤقتًا")] });
    await mountApp();
    await signUp();

    await screen.findByRole("alert");
    const retry = screen.getByRole("button", { name: "إعادة المحاولة" });
    fireEvent.click(retry);
    await waitFor(() => expect(h.signups()).toHaveLength(2));
  });

  test("503 claude_auth is NOT a store failure — no retry affordance", async () => {
    // Same status code, opposite meaning. Branch on error.type or a teacher is
    // told to try again for a thing no retry can fix.
    harness({ signup: [503, err("claude_auth", "الخدمة تحتاج إعادة تسجيل دخول")] });
    await mountApp();
    await signUp();

    await screen.findByRole("alert");
    expect(screen.queryByRole("button", { name: "إعادة المحاولة" })).toBeNull();
  });

  test("submitting disables the control, then releases it", async () => {
    harness();
    await mountApp();
    click("حساب جديد");
    fill(emailBox(), "prof@madrasa.dz");
    fill(passwordBox(), "kalimat-sir-12");

    const btn = screen.getByRole("button", { name: "إنشاء الحساب" });
    expect((btn as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(btn);
    expect((btn as HTMLButtonElement).disabled).toBe(true);
    await screen.findByText(CODE);
  });
});

describe("sign-in — gap #1, closed end to end", () => {
  test("cleared storage → sign in → the subject list re-populates", async () => {
    const h = harness();
    await mountApp();
    // Nothing is reachable before signing in.
    expect(screen.queryByText("اختبار الفصل الأول")).toBeNull();

    await signIn();

    await waitFor(() => expect(localStorage.getItem("teacher.id.v1")).toBe(JSON.stringify(TID)));
    await waitFor(() => expect(screen.getByText("اختبار الفصل الأول")).toBeTruthy());
    expect(screen.getByText("اختبار الفصل الثاني")).toBeTruthy();
    // The list was fetched with the id sign-in returned.
    expect(h.of("/api/subjects").some((c) => c.teacher === TID)).toBe(true);
  });

  test("sign-in sends only the credentials — it never offers a held id", async () => {
    // Sign-IN must not adopt: re-pointing an anonymous id at an account would
    // rewrite subject documents, which the zero-rewrite property forbids.
    localStorage.setItem("teacher.id.v1", JSON.stringify(HELD));
    const h = harness();
    await mountApp();
    await waitFor(() => expect(screen.getByRole("button", { name: "الحساب" })).toBeTruthy());
    click("الحساب");
    await signIn();

    await waitFor(() => expect(h.of("/api/auth/signin")).toHaveLength(1));
    expect(h.of("/api/auth/signin")[0].teacher).toBeUndefined();
  });

  test("401 invalid_credentials → Arabic message, no retry, form still usable", async () => {
    const h = harness({
      signin: [401, err("invalid_credentials", "البريد الإلكتروني أو كلمة المرور غير صحيحة")],
    });
    await mountApp();
    await signIn();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("البريد الإلكتروني أو كلمة المرور غير صحيحة");
    expect(screen.queryByRole("button", { name: "إعادة المحاولة" })).toBeNull();

    // Still usable: a corrected password submits again.
    fill(passwordBox(), "kalimat-sir-99");
    click("تسجيل الدخول");
    await waitFor(() => expect(h.of("/api/auth/signin")).toHaveLength(2));
  });

  test("the id is not stored when sign-in fails", async () => {
    harness({ signin: [401, err("invalid_credentials")] });
    await mountApp();
    await signIn();
    await screen.findByRole("alert");
    expect(localStorage.getItem("teacher.id.v1")).toBeNull();
  });
});

describe("recover", () => {
  test("a lowercase, space-separated code is normalised before sending", async () => {
    const h = harness();
    await mountApp();
    click("نسيت كلمة المرور");
    fill(emailBox(), "prof@madrasa.dz");
    fill(codeBox(), "k7m2 p9qr 4xta");
    fill(passwordBox(), "kalimat-jadida-12");
    click("استرجاع الحساب");

    await waitFor(() => expect(h.of("/api/auth/recover")).toHaveLength(1));
    expect(h.of("/api/auth/recover")[0].body).toEqual({
      email: "prof@madrasa.dz",
      recoveryCode: "K7M2P9QR4XTA",
      password: "kalimat-jadida-12",
    });
  });

  test("the FRESH code is displayed LTR, then the teacher continues into the app", async () => {
    harness();
    await mountApp();
    click("نسيت كلمة المرور");
    fill(emailBox(), "prof@madrasa.dz");
    fill(codeBox(), CODE);
    fill(passwordBox(), "kalimat-jadida-12");
    click("استرجاع الحساب");

    const el = await screen.findByText(FRESH);
    expect(el.getAttribute("dir")).toBe("ltr");
    click("متابعة");
    await waitFor(() => expect(localStorage.getItem("teacher.id.v1")).toBe(JSON.stringify(TID)));
  });

  test("401 invalid_recovery → Arabic message, not retryable", async () => {
    harness({ recover: [401, err("invalid_recovery", "رمز الاسترجاع غير صحيح أو مستعمَل")] });
    await mountApp();
    click("نسيت كلمة المرور");
    fill(emailBox(), "prof@madrasa.dz");
    fill(codeBox(), CODE);
    fill(passwordBox(), "kalimat-jadida-12");
    click("استرجاع الحساب");

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("رمز الاسترجاع غير صحيح أو مستعمَل");
    expect(screen.queryByRole("button", { name: "إعادة المحاولة" })).toBeNull();
  });
});

describe("teacher_required — an id the server no longer knows", () => {
  test("a rejected id is dropped and the teacher is shown the gate", async () => {
    // be can now reject an id it never recorded. Without this the teacher is
    // stuck on an error with no way to reach a sign-in form.
    localStorage.setItem("teacher.id.v1", JSON.stringify(HELD));
    harness({ subjects: [401, err("teacher_required", "الرجاء تسجيل الدخول")] });
    await mountApp();

    await waitFor(() => expect(localStorage.getItem("teacher.id.v1")).toBeNull());
    await waitFor(() => expect(screen.getByRole("button", { name: "تسجيل الدخول" })).toBeTruthy());
  });
});

describe("negative — the hard product constraints", () => {
  /** Rendered copy, minus the one element the contract renders LTR on purpose. */
  function arabicOnlyText(): string {
    const clone = document.body.cloneNode(true) as HTMLElement;
    for (const el of Array.from(clone.querySelectorAll('[dir="ltr"]'))) el.remove();
    return clone.textContent ?? "";
  }

  test("every string on the auth surface is Arabic — idle, error and code states", async () => {
    harness();
    await mountApp();
    expect(arabicOnlyText()).not.toMatch(/[A-Za-z]{4,}/);

    click("حساب جديد");
    expect(arabicOnlyText()).not.toMatch(/[A-Za-z]{4,}/);

    click("نسيت كلمة المرور");
    expect(arabicOnlyText()).not.toMatch(/[A-Za-z]{4,}/);

    cleanup();
    harness({ signup: [503, err("store_unavailable", "الخدمة غير متاحة مؤقتًا")] });
    await mountApp();
    await signUp();
    await screen.findByRole("alert");
    expect(arabicOnlyText()).not.toMatch(/[A-Za-z]{4,}/);

    cleanup();
    harness();
    await mountApp();
    await signUp();
    await screen.findByText(CODE);
    expect(arabicOnlyText()).not.toMatch(/[A-Za-z]{4,}/);
  });

  test("no LaTeX surfaces anywhere on the auth surface", async () => {
    harness();
    await mountApp();
    click("حساب جديد");
    const text = document.body.textContent ?? "";
    expect(text).not.toContain("\\frac");
    expect(text).not.toContain("$");
    expect(text).not.toContain("\\(");
    // Nor in any input's placeholder or value — a teacher must never meet markup.
    for (const input of Array.from(document.querySelectorAll("input, textarea"))) {
      const p = input.getAttribute("placeholder") ?? "";
      expect(p).not.toMatch(/\\|\$/);
    }
  });

  test("every auth call is a relative /api/ URL", async () => {
    const h = harness();
    await mountApp();
    await signUp();
    await waitFor(() => expect(h.signups()).toHaveLength(1));

    for (const c of h.calls) {
      expect(c.url.startsWith("/api/")).toBe(true);
      expect(c.url).not.toMatch(/^https?:\/\//);
    }
  });
});

describe("negative — the core loop is untouched for a signed-in teacher", () => {
  /**
   * SUPERSEDED by parallel-exercises fe-2, 2026-08-09 — the flow moved, and what this
   * clause is FOR did not.
   *
   * It lives in an auth suite to prove the gate did not break the core loop for a
   * signed-in teacher: press generate, get an exam, still be able to print it. That is
   * unchanged. Only the call it rides on moved — to POST /api/exams, teacher-scoped
   * exactly as before, which is the property this suite actually cares about.
   */
  test("generate still works for a signed-in teacher, now via /api/exams", async () => {
    localStorage.setItem("teacher.id.v1", JSON.stringify(HELD));
    const h = harness();
    await mountApp();
    await waitFor(() => expect(screen.getByRole("button", { name: "توليد الموضوع" })).toBeTruthy());

    click("توليد الموضوع");
    await waitFor(() => expect(h.of("/api/exams")).toHaveLength(1));
    // The controls, unwrapped — and still carrying the signed-in teacher's id.
    expect(Object.keys(h.of("/api/exams")[0].body as object).sort()).toEqual(
      ["difficulty", "durationMinutes", "exerciseCount", "format", "level", "stream", "topic"].sort(),
    );
    expect(h.of("/api/exams")[0].teacher).toBe(HELD);

    await waitFor(() => expect(screen.getByText("الموضوع الأول")).toBeTruthy());
    // The print path is still offered once an exam is on screen.
    expect(screen.getByRole("button", { name: "طباعة الموضوع" })).toBeTruthy();
  });

  test("storage failures are still swallowed — the app renders anyway", async () => {
    harness();
    const boom = () => {
      throw new Error("storage disabled");
    };
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(boom);
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(boom);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(boom);

    const { default: App } = await import("@/App");
    expect(() => render(<App />)).not.toThrow();
    vi.restoreAllMocks();
  });
});

describe("negative — every word the teacher reads is ours (review F1)", () => {
  /**
   * Added after review. The form used native constraint validation, so a malformed
   * email was blocked by the BROWSER and the only feedback was its own bubble —
   * "Please include an '@' in the email address." — in the browser's locale, on the
   * auth mainline of an Arabic-only product. jsdom renders no bubble, which is exactly
   * why no oracle saw it; this pins the mechanism instead of the message.
   */
  test("the auth form is noValidate, so be's Arabic error is what speaks", async () => {
    harness();
    await mountApp();
    click("حساب جديد");
    const form = emailBox().closest("form");
    expect(form).toBeTruthy();
    expect(form?.hasAttribute("novalidate")).toBe(true);
  });

  test("a malformed email REACHES the backend rather than being blocked locally", async () => {
    const h = harness();
    await mountApp();
    await signUp("not-an-email", "a-good-password");
    // be owns email validation and answers in Arabic; the browser must not pre-empt it.
    await waitFor(() =>
      expect(h.calls.filter((c) => c.url === "/api/auth/signup").length).toBeGreaterThan(0),
    );
  });
});

describe("QA BUG-1 — signing in must not silently orphan this browser's exams", () => {
  test("the displaced anonymous id is KEPT, and the teacher is told in Arabic", async () => {
    harness();
    localStorage.setItem("teacher.id.v1", JSON.stringify(HELD));
    await mountApp();

    click("الحساب");
    await signIn();

    // the account's id is now in force …
    await waitFor(() => expect(localStorage.getItem("teacher.id.v1")).toBe(JSON.stringify(TID)));
    // … the displaced one is not thrown away …
    expect(localStorage.getItem("teacher.previous.v1")).toBe(JSON.stringify(HELD));
    // … and the loss is not silent.
    expect(await screen.findByText(/لم تُنقَل إلى هذا الحساب/)).toBeTruthy();
  });

  test("no notice when there was nothing to displace", async () => {
    harness();
    await mountApp();
    await signIn();
    await waitFor(() => expect(localStorage.getItem("teacher.id.v1")).toBe(JSON.stringify(TID)));
    expect(screen.queryByText(/لم تُنقَل إلى هذا الحساب/)).toBeNull();
    expect(localStorage.getItem("teacher.previous.v1")).toBeNull();
  });
});

describe("QA BUG-2 — a reload must reconcile with the server, not trust the paint cache", () => {
  test("boot refetches the open subject and prefers the server's version", async () => {
    const STALE = { ...EXAM, title: "نسخة قديمة من الذاكرة المؤقتة" };
    const FRESH_EXAM = { ...EXAM, title: "النسخة الحقيقية من الخادم" };
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit = {}) => {
        calls.push(`${init.method ?? "GET"} ${url}`);
        const res = (status: number, payload: unknown) => ({
          ok: status < 300,
          status,
          json: async () => payload,
        });
        if (url === "/api/subjects/s1") {
          return res(200, {
            id: "s1",
            createdAt: "t",
            updatedAt: "t",
            subject: FRESH_EXAM,
            genCorrelationId: null,
          });
        }
        if (url === "/api/subjects") return res(200, { subjects: SUMMARIES });
        return res(404, { error: { message: "غير موجود", type: "subject_not_found" } });
      }),
    );

    // a browser that was mid-exam when it was closed
    localStorage.setItem("teacher.id.v1", JSON.stringify(TID));
    localStorage.setItem("teacher.current.v1", JSON.stringify("s1"));
    localStorage.setItem("teacher.cache.v1", JSON.stringify(STALE));

    await mountApp();

    // it must ASK the server, not just paint the cache …
    await waitFor(() => expect(calls).toContain("GET /api/subjects/s1"));
    // … and the server wins. A version refined on another device must not render as
    // current forever — refining from a stale pane would push an old body through the CAS.
    expect(await screen.findByText(FRESH_EXAM.title)).toBeTruthy();
  });
});
