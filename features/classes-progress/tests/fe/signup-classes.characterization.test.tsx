/**
 * fe-4 — sign-up learns steps 3 and 4, and the account gets «أقسامي».
 *
 * THE FEATURE, in one sentence: a teacher who has just been handed their recovery code
 * declares the classes they teach this year and where each one has reached — or skips
 * that class — and can come back to «أقسامي» later to see and extend the list.
 *
 * The clauses that are here because a plausible implementation gets them wrong:
 *
 *   - **SKIP MEANS NO WRITE AT ALL.** The contract's progress document is created lazily
 *     by the first successful PUT (§0), so a class nobody positioned has no document —
 *     and `GET /api/progress/:classId` synthesizes `markedWeek: 0` for it forever after.
 *     Writing week 0 to "record the skip" would create a document whose existence means
 *     nothing, and it is the obvious thing to do. It is pinned negatively: not one
 *     request touches a skipped class's progress.
 *   - **the six streams are all offered.** `taxonomy.ts:10` hardcodes ONE stream
 *     (`STREAM = "شعبة الرياضيات"`) and this slice is exactly where that stops being
 *     true. The six values below were read out of the live corpus
 *     (`project/data/programmes/*.jsonl`, five documents, six streams) and every one of
 *     them was accepted by a live `POST /api/classes` on lane slot 8 — `be` validates
 *     against the corpus and is the authority (contract §2). A UI that offers fewer than
 *     six, or that quietly defaults an unchosen one, fails here.
 *   - **an unchosen stream is never serialised as `""`.** The contract pins that the
 *     empty string resolves OPPOSITE ways on read and write (§5), and `be` refuses an
 *     empty stream with `400`. A row the teacher has not finished is not sent at all.
 *   - **a failed create must not cost the teacher their typing.** Sign-up is the worst
 *     place in the product to drop input, and the row that failed is the one holding the
 *     text. The rows that DID succeed are not re-sent on the next press either — `be`'s
 *     create is insert-only, so a re-send is a duplicate class, not a retry.
 *   - **steps 3 and 4 hang off an account that already exists.** They are reachable only
 *     after a SIGN-UP: never before the recovery code, never for sign-in, never for
 *     recovery. And the screen upstream of them — the code, shown once — is untouched:
 *     same copy, same confirm gate, and «متابعة» still stores the id and lands the
 *     teacher in the builder (the promoted `persistence-gaps` net's clause, restated
 *     here because this sub-issue is the one that could break it).
 *   - **`school` rides its own surface.** `PUT /api/teacher/school`, because step 3 runs
 *     after the account exists and cannot ride the frozen signup body (contract §0). An
 *     empty school field sends NO call — an empty PUT would clear a value nobody set.
 */
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import App from "@/App";
import type { ClassRef } from "@/lib/classes";

const TID = "0123456789abcdef0123456789abcdef";
const CODE = "7Q4M-K2XR-98DF";

/**
 * The corpus's six streams, verbatim.
 *
 * Read out of `project/data/programmes/*.jsonl` (5 documents — the lettres document
 * carries two streams in one record) and re-verified 2026-08-11 against the live lane:
 * every one of the six was accepted by `POST /api/classes`, and a seventh invented value
 * was refused with `400 invalid_request` / «الشعبة غير معروفة». There is no stream-list
 * route on `be`, so this list is `fe`'s mirror of the corpus and `be` remains the
 * authority that validates it.
 */
const STREAMS = [
  "شعبة الرياضيات",
  "تقني رياضي",
  "علوم تجريبية",
  "تسيير واقتصاد",
  "آداب وفلسفة",
  "لغات أجنبية",
];

/** The copy, from the handoff prototype (lines 741-773 for the steps, 687-698 for the
 *  account). Deliberate Arabic — the README forbids machine-rewriting it, so it is
 *  pinned verbatim rather than paraphrased. */
const STEP3_TITLE = "أقسامك هذه السنة";
const ADD_CLASS = "أضف قسمًا — الشعب الست كلها متاحة";
const SCHOOL_HINT = "سيظهر على الموضوع المطبوع";
const STEP4_TITLE = "أين وصل كل قسم؟";
const SKIP = "تخطَّ الآن — يُضبط لاحقًا";
const NEXT = "التالي";
const START = "ابدأ";
const MY_CLASSES = "أقسامي";

/** A stream `be` refuses — used to produce a REAL `400` on one row while its neighbour
 *  succeeds, rather than a canned failure of the whole press. */
const BAD_STREAM = "شعبة لا وجود لها";

interface Call {
  method: string;
  url: string;
  body: Record<string, unknown> | undefined;
  teacher: string | undefined;
}

interface ApiOptions {
  /** Classes that already exist for this teacher — «أقسامي»'s starting list. */
  classes?: ClassRef[];
  /** classId → the week `GET /api/progress/:classId` reports. */
  weeks?: Record<string, number>;
  totalWeeks?: number;
  /** Fail `PUT /api/teacher/school` with this. */
  schoolFails?: { status: number; type: string; message: string };
}

let seq = 0;

function mockApi(opts: ApiOptions = {}) {
  const calls: Call[] = [];
  const classes: ClassRef[] = [...(opts.classes ?? [])];
  const weeks: Record<string, number> = { ...(opts.weeks ?? {}) };
  const revs: Record<string, number> = {};

  const fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? "GET";
    const body = typeof init.body === "string" ? JSON.parse(init.body) : undefined;
    calls.push({
      method,
      url,
      body,
      teacher: (init.headers as Record<string, string> | undefined)?.["x-teacher-id"],
    });
    const res = (status: number, payload: unknown) => ({
      ok: status < 300,
      status,
      json: async () => payload,
    });

    if (url === "/api/auth/signup") {
      return res(201, { teacherId: TID, recoveryCode: CODE, correlationId: "c-signup" });
    }
    if (url === "/api/auth/signin") return res(200, { teacherId: TID, correlationId: "c-in" });
    if (url === "/api/auth/recover") {
      return res(200, { teacherId: TID, recoveryCode: CODE, correlationId: "c-rec" });
    }

    if (url === "/api/teacher/school" && method === "PUT") {
      if (opts.schoolFails) {
        return res(opts.schoolFails.status, {
          error: { message: opts.schoolFails.message, type: opts.schoolFails.type },
          correlationId: "c-school",
        });
      }
      return res(200, { ok: true, correlationId: "c-school" });
    }

    if (url === "/api/classes" && method === "POST") {
      const { name, stream } = body as { name?: unknown; stream?: unknown };
      // The REAL validation, not a scripted failure: `be` refuses a stream that
      // resolves to no current programme, and an empty name (contract §3).
      if (typeof name !== "string" || name.trim() === "") {
        return res(400, {
          error: { message: "اسم القسم مطلوب", type: "invalid_request" },
          correlationId: "c-cls",
        });
      }
      if (typeof stream !== "string" || !STREAMS.includes(stream)) {
        return res(400, {
          error: { message: "الشعبة غير معروفة", type: "invalid_request" },
          correlationId: "c-cls",
        });
      }
      seq += 1;
      const record: ClassRef = {
        id: `6a7a7a365877e8523b8b0${String(100 + seq)}`,
        name: name.trim(),
        stream,
        createdAt: `2026-08-11T01:2${seq}:14.969Z`,
      };
      classes.push(record);
      return res(201, { class: record, correlationId: "c-cls" });
    }
    if (url === "/api/classes" && method === "GET") {
      return res(200, { classes, correlationId: "c-cls" });
    }

    const prog = /^\/api\/progress\/([^?]+)$/.exec(url);
    if (prog) {
      const id = decodeURIComponent(prog[1]!);
      const totalWeeks = opts.totalWeeks ?? 27;
      if (method === "GET") {
        const markedWeek = weeks[id] ?? 0;
        const started = markedWeek > 0;
        return res(200, {
          progress: {
            classId: id,
            markedWeek,
            entries: [],
            rev: revs[id] ?? 0,
            programmeDocKey: started ? "tadarroj-3as-math" : null,
            programmeEdition: started ? "2022-09" : null,
            programmeTranscriptionRev: started ? 4 : null,
            updatedAt: started ? "2026-08-11T01:26:47.207Z" : null,
          },
          programme: { docKey: "tadarroj-3as-math", edition: "2022-09", totalWeeks },
          correlationId: "c-prog",
        });
      }
      if (method === "PUT") {
        const b = body as { rev: number; markedWeek: number };
        if (b.rev !== (revs[id] ?? 0)) {
          return res(409, {
            error: { message: "تغيّر تقدّم القسم أثناء الحفظ", type: "conflict" },
            correlationId: "c-prog",
          });
        }
        weeks[id] = b.markedWeek;
        revs[id] = b.rev + 1;
        return res(200, {
          progress: {
            classId: id,
            markedWeek: b.markedWeek,
            entries: [],
            rev: b.rev + 1,
            programmeDocKey: "tadarroj-3as-math",
            programmeEdition: "2022-09",
            programmeTranscriptionRev: 4,
            updatedAt: "2026-08-11T02:35:01.157Z",
          },
          correlationId: "c-prog",
        });
      }
    }

    if (url.startsWith("/api/subjects") && method === "GET") {
      return res(200, { subjects: [], correlationId: "c-list" });
    }
    return res(404, { error: { message: "غير موجود", type: "not_found" } });
  });
  vi.stubGlobal("fetch", fetchMock);

  return {
    calls,
    urls: () => calls.map((c) => c.url),
    classPosts: () => calls.filter((c) => c.method === "POST" && c.url === "/api/classes"),
    schoolPuts: () => calls.filter((c) => c.url === "/api/teacher/school"),
    progressPuts: () => calls.filter((c) => c.method === "PUT" && /^\/api\/progress\//.test(c.url)),
  };
}

// ---- queries ---------------------------------------------------------------------

const step = () => document.querySelector(".signup");
const text = (root: Element | null) => (root?.textContent ?? "").replace(/\s+/g, " ").trim();
const allButtons = (root: Element | Document = document) => [
  ...root.querySelectorAll<HTMLButtonElement>("button"),
];
const btn = (label: string, root: Element | Document = document) =>
  allButtons(root).find((b) => (b.textContent ?? "").includes(label))!;
/** Scoped to the step pane. The sidebar is on screen throughout — one of its suggestion
 *  chips starts with «ابدأ», which a document-wide substring search would find first. */
const stepBtn = (label: string) => btn(label, step()!);
/** Exact, for a label that is a PREFIX of another button's on the same surface:
 *  «أضف» inside «أضف قسمًا — الشعب الست كلها متاحة». */
const exactBtn = (label: string, root: Element | Document = document) =>
  allButtons(root).find((b) => (b.textContent ?? "").trim() === label)!;
const rows = () => [...document.querySelectorAll<HTMLElement>("[data-class-row]")];
const nameInput = (i: number) => rows()[i]!.querySelector<HTMLInputElement>("input")!;
const streamSelect = (i: number) => rows()[i]!.querySelector<HTMLSelectElement>("select")!;
const schoolInput = () => document.querySelector<HTMLInputElement>("[data-school]")!;
const onboardClasses = () => [...document.querySelectorAll<HTMLElement>("[data-onboard-class]")];
const myClasses = () => document.querySelector(".myclasses");
const tabs = () => [...document.querySelectorAll<HTMLElement>("[data-class-id]")];

async function click(el: HTMLElement) {
  await act(async () => {
    el.click();
  });
}
async function fill(el: HTMLElement, value: string) {
  await act(async () => {
    fireEvent.change(el, { target: { value } });
  });
}
async function boot() {
  await act(async () => {
    render(<App />);
  });
}

/** Steps 1 and 2 — the frozen part of the flow, driven exactly as the promoted
 *  `persistence-gaps` suite drives it. */
async function signUpToCode() {
  await click(btn("حساب جديد"));
  await fill(document.querySelector<HTMLInputElement>("#auth-email")!, "prof@madrasa.dz");
  await fill(document.querySelector<HTMLInputElement>("#auth-password")!, "kalimat-sir-12");
  await click(btn("إنشاء الحساب"));
  await waitFor(() => expect(document.body.textContent).toContain(CODE));
}

/** …and through the code screen into step 3. */
async function signUpToStep3() {
  await signUpToCode();
  await click(btn("متابعة"));
  await waitFor(() => expect(step()).toBeTruthy());
}

beforeEach(() => {
  localStorage.clear();
  window.location.hash = "";
  vi.unstubAllGlobals();
  vi.resetModules();
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  cleanup();
  window.location.hash = "";
});

// ---------------------------------------------------------------------------------
// STEP 3 — «أقسامك هذه السنة»
// ---------------------------------------------------------------------------------

describe("step 3 asks for this year's classes", () => {
  test("it renders after the code is acknowledged — a row, the six streams, and the school field", async () => {
    mockApi();
    await boot();
    await signUpToStep3();

    const t = text(step());
    expect(t).toContain(STEP3_TITLE);

    // One row to start with. A wizard that asks for classes and shows nothing to type
    // in makes the teacher hunt for the affordance first.
    expect(rows()).toHaveLength(1);
    expect(nameInput(0)).toBeTruthy();

    // THE SIX. Not five, not one — and offered in the corpus's own values, so what the
    // teacher picks is what `be` can resolve to a programme.
    const options = [...streamSelect(0).options];
    expect(options.map((o) => o.value).filter((v) => v !== "")).toEqual(STREAMS);
    // …and nothing is chosen for them: a defaulted stream is the product guessing which
    // programme a class follows, which is the one guess this product may not make.
    expect(streamSelect(0).value).toBe("");

    expect(t).toContain(ADD_CLASS);
    // The school, with the reason it is being asked for.
    expect(schoolInput()).toBeTruthy();
    expect(t).toContain("اسم الثانوية");
    expect(t).toContain(SCHOOL_HINT);

    // The step is the third of four, and says so.
    const bars = [...document.querySelectorAll(".signup-steps__bar")];
    expect(bars).toHaveLength(4);
    expect(bars.filter((b) => b.className.includes("--on"))).toHaveLength(3);
  });

  test("«أضف قسمًا» adds a row without ceremony — no dialog, no request", async () => {
    const h = mockApi();
    await boot();
    await signUpToStep3();

    await click(stepBtn(ADD_CLASS));
    expect(rows()).toHaveLength(2);
    await click(stepBtn(ADD_CLASS));
    expect(rows()).toHaveLength(3);
    // Adding a ROW is not creating a CLASS. Nothing is on the wire until «التالي».
    expect(h.classPosts()).toHaveLength(0);
  });

  test("a row typed into keeps its value when another row is added", async () => {
    mockApi();
    await boot();
    await signUpToStep3();

    await fill(nameInput(0), "3ر1");
    await fill(streamSelect(0), STREAMS[0]!);
    await click(stepBtn(ADD_CLASS));

    expect(nameInput(0).value).toBe("3ر1");
    expect(streamSelect(0).value).toBe(STREAMS[0]);
    expect(nameInput(1).value).toBe("");
  });
});

// ---------------------------------------------------------------------------------
// COMPLETING STEP 3 — one POST per row, one school PUT, and none when it is empty
// ---------------------------------------------------------------------------------

describe("completing step 3 writes the classes and the school", () => {
  test("one POST /api/classes per row, in the order they were typed, plus ONE school PUT", async () => {
    const h = mockApi();
    await boot();
    await signUpToStep3();

    await fill(nameInput(0), "3ر1");
    await fill(streamSelect(0), "شعبة الرياضيات");
    await click(stepBtn(ADD_CLASS));
    await fill(nameInput(1), "3تج2");
    await fill(streamSelect(1), "علوم تجريبية");
    await fill(schoolInput(), "ثانوية الأمير عبد القادر — وهران");

    await click(stepBtn(NEXT));
    await waitFor(() => expect(h.classPosts()).toHaveLength(2));

    // Order matters: `be` answers `GET /api/classes` createdAt ASCENDING and that is
    // the switcher's tab order, so the rows must be created in the order they were
    // typed rather than concurrently.
    expect(h.classPosts()[0]!.body).toEqual({ name: "3ر1", stream: "شعبة الرياضيات" });
    expect(h.classPosts()[1]!.body).toEqual({ name: "3تج2", stream: "علوم تجريبية" });
    expect(h.classPosts().every((c) => c.teacher === TID)).toBe(true);

    // The school is its OWN surface — it cannot ride the frozen signup body, because
    // this step runs after the account already exists (contract §0).
    await waitFor(() => expect(h.schoolPuts()).toHaveLength(1));
    expect(h.schoolPuts()[0]!.method).toBe("PUT");
    expect(h.schoolPuts()[0]!.body).toEqual({ school: "ثانوية الأمير عبد القادر — وهران" });
    // …and it never rode the signup body either.
    const signup = h.calls.find((c) => c.url === "/api/auth/signup")!;
    expect(Object.keys(signup.body as object)).toEqual(["email", "password"]);
  });

  test("an EMPTY school sends no school call at all", async () => {
    // An empty PUT is a CLEAR on this route (`be` trims, and blank means null). Sending
    // one for a teacher who simply skipped the field would erase a value they may have
    // set elsewhere, to record that they typed nothing.
    const h = mockApi();
    await boot();
    await signUpToStep3();

    await fill(nameInput(0), "3ر1");
    await fill(streamSelect(0), "شعبة الرياضيات");
    await click(stepBtn(NEXT));

    await waitFor(() => expect(h.classPosts()).toHaveLength(1));
    await waitFor(() => expect(onboardClasses()).toHaveLength(1));
    expect(h.schoolPuts()).toHaveLength(0);
  });

  test("whitespace is not a school name either", async () => {
    const h = mockApi();
    await boot();
    await signUpToStep3();

    await fill(nameInput(0), "3ر1");
    await fill(streamSelect(0), "شعبة الرياضيات");
    await fill(schoolInput(), "    ");
    await click(stepBtn(NEXT));

    await waitFor(() => expect(h.classPosts()).toHaveLength(1));
    expect(h.schoolPuts()).toHaveLength(0);
  });

  test("a row with no stream chosen is never serialised as `\"\"` — it is not sent", async () => {
    // Contract §5: the empty string resolves OPPOSITE ways on read and write, and `be`
    // refuses an empty stream outright. A half-filled row is a question to the teacher,
    // never a request.
    const h = mockApi();
    await boot();
    await signUpToStep3();

    await fill(nameInput(0), "3ر1");
    await click(stepBtn(NEXT));

    // Nothing went out, and the teacher is told what is missing — in Arabic, on the row.
    await waitFor(() => expect(text(step())).toContain("اختر الشعبة"));
    expect(h.classPosts()).toHaveLength(0);
    expect(step()).toBeTruthy();
    expect(nameInput(0).value).toBe("3ر1");
  });

  test("an entirely blank row is ignored, not an error", async () => {
    const h = mockApi();
    await boot();
    await signUpToStep3();

    await fill(nameInput(0), "3ر1");
    await fill(streamSelect(0), "شعبة الرياضيات");
    await click(stepBtn(ADD_CLASS));
    // Row 1 is left completely untouched — the teacher added it and changed their mind.
    await click(stepBtn(NEXT));

    await waitFor(() => expect(h.classPosts()).toHaveLength(1));
    expect(h.classPosts()[0]!.body).toEqual({ name: "3ر1", stream: "شعبة الرياضيات" });
  });

  test("no class at all skips step 4 entirely and lands in the app", async () => {
    // «أين وصل كل قسم؟» with no classes is a screen asking about nothing.
    const h = mockApi();
    await boot();
    await signUpToStep3();

    await click(stepBtn(NEXT));
    await waitFor(() => expect(step()).toBeNull());
    expect(h.classPosts()).toHaveLength(0);
    expect(h.progressPuts()).toHaveLength(0);
    expect(btn("توليد الموضوع")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------------
// A FAILED CREATE — the teacher's typing survives, and nothing is created twice
// ---------------------------------------------------------------------------------

describe("a class create that fails keeps the teacher on step 3", () => {
  test("400 → an Arabic inline error, the row's typing intact, the other row created ONCE", async () => {
    const h = mockApi();
    await boot();
    await signUpToStep3();

    await fill(nameInput(0), "3ر1");
    await fill(streamSelect(0), "شعبة الرياضيات");
    await click(stepBtn(ADD_CLASS));
    await fill(nameInput(1), "3تج2");
    // A stream `be` cannot resolve. It is set directly on the control because the
    // picker only offers the six — this is the wire-level refusal, not a UI one.
    await act(async () => {
      const s = streamSelect(1);
      s.innerHTML += `<option value="${BAD_STREAM}">${BAD_STREAM}</option>`;
      fireEvent.change(s, { target: { value: BAD_STREAM } });
    });

    await click(stepBtn(NEXT));
    await waitFor(() => expect(h.classPosts()).toHaveLength(2));

    // Still on step 3, told why, in Arabic.
    expect(step()).toBeTruthy();
    expect(text(step())).toContain("الشعبة غير معروفة");
    expect(text(step()).match(/[A-Za-z]{2,}/g) ?? []).toEqual([]);

    // THE CLAUSE: the failing row still holds what the teacher typed. Sign-up is the
    // worst place in the product to make somebody type something twice.
    expect(rows()).toHaveLength(1);
    expect(nameInput(0).value).toBe("3تج2");

    // Fix it and press again: ONE further POST. The row that succeeded is not re-sent —
    // `be`'s create is insert-only, so a re-send is a second class, not a retry.
    await fill(streamSelect(0), "علوم تجريبية");
    await click(stepBtn(NEXT));
    await waitFor(() => expect(h.classPosts()).toHaveLength(3));
    expect(h.classPosts().filter((c) => (c.body as { name: string }).name === "3ر1")).toHaveLength(
      1,
    );
    await waitFor(() => expect(onboardClasses()).toHaveLength(2));
  });

  test("a school write that fails keeps step 3 and does not re-create the classes", async () => {
    const h = mockApi({
      schoolFails: {
        status: 503,
        type: "store_unavailable",
        message: "تعذّر الوصول إلى قاعدة البيانات. حاول مرة أخرى.",
      },
    });
    await boot();
    await signUpToStep3();

    await fill(nameInput(0), "3ر1");
    await fill(streamSelect(0), "شعبة الرياضيات");
    await fill(schoolInput(), "ثانوية الأمير عبد القادر");
    await click(stepBtn(NEXT));

    await waitFor(() => expect(text(step())).toContain("تعذّر الوصول إلى قاعدة البيانات"));
    expect(h.classPosts()).toHaveLength(1);
    // The school field still holds it, so the retry is one press.
    expect(schoolInput().value).toBe("ثانوية الأمير عبد القادر");
    await click(stepBtn(NEXT));
    await waitFor(() => expect(h.schoolPuts()).toHaveLength(2));
    // …and the class was NOT created a second time.
    expect(h.classPosts()).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------------
// STEP 4 — «أين وصل كل قسم؟», and SKIP MEANS NO WRITE
// ---------------------------------------------------------------------------------

/** Step 3 with two classes, straight through to step 4. */
async function toStep4(h: ReturnType<typeof mockApi>) {
  await signUpToStep3();
  await fill(nameInput(0), "3ر1");
  await fill(streamSelect(0), "شعبة الرياضيات");
  await click(stepBtn(ADD_CLASS));
  await fill(nameInput(1), "3تج2");
  await fill(streamSelect(1), "علوم تجريبية");
  await click(stepBtn(NEXT));
  await waitFor(() => expect(h.classPosts()).toHaveLength(2));
  await waitFor(() => expect(onboardClasses()).toHaveLength(2));
}

describe("step 4 asks where each class has reached", () => {
  test("it lists every created class, by name and stream, in creation order", async () => {
    const h = mockApi();
    await boot();
    await toStep4(h);

    expect(text(step())).toContain(STEP4_TITLE);
    const listed = onboardClasses().map((el) => text(el));
    expect(listed[0]).toContain("3ر1");
    expect(listed[0]).toContain("شعبة الرياضيات");
    expect(listed[1]).toContain("3تج2");
    expect(listed[1]).toContain("علوم تجريبية");

    const bars = [...document.querySelectorAll(".signup-steps__bar")];
    expect(bars.filter((b) => b.className.includes("--on"))).toHaveLength(4);
  });

  test("setting a position drives the fe-3 setter — `PUT /api/progress/:classId` with the rev it was shown", async () => {
    const h = mockApi();
    await boot();
    await toStep4(h);

    const first = onboardClasses()[0]!;
    const id = first.getAttribute("data-onboard-class")!;
    await click(btn("حدّد أين وصلت", first));
    await fill(first.querySelector<HTMLSelectElement>(".classpos__week")!, "8");
    await click(btn("وصلنا هنا", first));

    await waitFor(() => expect(h.progressPuts()).toHaveLength(1));
    expect(h.progressPuts()[0]!.url).toBe(`/api/progress/${id}`);
    // `rev: 0` is the CAS token for "no document yet" (contract §4).
    expect(h.progressPuts()[0]!.body).toEqual({ rev: 0, markedWeek: 8 });
    await waitFor(() => expect(text(first)).toContain("الأسبوع 8"));
  });

  test("SKIPPING A CLASS SENDS NO PROGRESS CALL FOR IT — not week 0, not anything", async () => {
    // The lazy-document decision (contract §0): a class with no progress document is
    // what "not started" IS, and `GET` synthesizes `markedWeek: 0` for it afterwards.
    // Writing 0 to "record the skip" creates a document whose existence means nothing —
    // and it is the obvious implementation.
    const h = mockApi();
    await boot();
    await toStep4(h);

    const second = onboardClasses()[1]!;
    const skippedId = second.getAttribute("data-onboard-class")!;
    await click(btn(SKIP, second));

    // Position the OTHER one, so the assertion is about the skip and not about an
    // inert screen.
    const first = onboardClasses()[0]!;
    await click(btn("حدّد أين وصلت", first));
    await fill(first.querySelector<HTMLSelectElement>(".classpos__week")!, "5");
    await click(btn("وصلنا هنا", first));
    await waitFor(() => expect(h.progressPuts()).toHaveLength(1));

    // Finish the whole flow — the skip must survive the exit too.
    await click(stepBtn(START));
    await waitFor(() => expect(step()).toBeNull());
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    // NOT ONE WRITE against the skipped class, from anywhere.
    expect(h.progressPuts().filter((c) => c.url.includes(skippedId))).toHaveLength(0);
    expect(h.progressPuts()).toHaveLength(1);
    // …and the skipped class is still offered as unpositioned afterwards.
    await waitFor(() => expect(tabs()).toHaveLength(2));
    expect(text(tabs()[1]!)).not.toContain("أسبوع");
  });

  test("a skipped class says so, and the skip is reversible without a write", async () => {
    const h = mockApi();
    await boot();
    await toStep4(h);

    const second = () => onboardClasses()[1]!;
    await click(btn(SKIP, second()));
    expect(text(second())).toContain(SKIP);
    expect(second().querySelector(".classpos")).toBeNull();

    await click(btn("حدّد أين وصلت", second()));
    expect(second().querySelector(".classpos")).toBeTruthy();
    expect(h.progressPuts()).toHaveLength(0);
  });

  test("finishing lands in the app, with the new classes in the bar", async () => {
    const h = mockApi();
    await boot();
    await toStep4(h);

    await click(stepBtn(START));
    await waitFor(() => expect(step()).toBeNull());
    expect(btn("توليد الموضوع")).toBeTruthy();
    // The bar is the point of having declared them.
    await waitFor(() => expect(tabs()).toHaveLength(2));
    expect(text(tabs()[0]!)).toContain("3ر1");
    expect(h.progressPuts()).toHaveLength(0);
  });

  test("«رجوع» from step 4 returns to step 3 and creates nothing new", async () => {
    const h = mockApi();
    await boot();
    await toStep4(h);

    await click(stepBtn("رجوع"));
    await waitFor(() => expect(text(step())).toContain(STEP3_TITLE));
    expect(h.classPosts()).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------------
// THE PERIMETER — steps 1 and 2 are untouched, and the steps are sign-up only
// ---------------------------------------------------------------------------------

describe("the recovery-code screen upstream is untouched", () => {
  test("same copy, same confirm gate, code still LTR — and no step content on it", async () => {
    mockApi();
    await boot();
    await signUpToCode();

    const code = [...document.querySelectorAll("code")].find((c) => c.textContent === CODE)!;
    expect(code.getAttribute("dir")).toBe("ltr");
    expect(code.className).toBe("num");
    expect(document.body.textContent).toContain("احتفظ برمز الاسترجاع");
    expect(document.body.textContent).toContain(
      "لن يُعرض مرة أخرى، وهو الوسيلة الوحيدة لاسترجاع حسابك إذا نسيت كلمة المرور.",
    );
    // The confirm gate is «متابعة», next to «نسخ الرمز» — and those are the only two
    // buttons on this screen, in that order.
    expect(allButtons().map((b) => b.textContent)).toEqual(["نسخ الرمز", "متابعة"]);
    // Nothing from step 3 has leaked upstream of the code.
    expect(document.body.textContent).not.toContain(STEP3_TITLE);
    expect(document.body.textContent).not.toContain(ADD_CLASS);
    expect(document.querySelector(".signup-steps")).toBeNull();
  });

  test("«متابعة» still stores teacher.id.v1 and the builder is there — the promoted clause", async () => {
    // Restated from the promoted `persistence-gaps` net because THIS sub-issue is the
    // one that could break it: the steps must not come between the confirm and the id.
    mockApi();
    await boot();
    await signUpToCode();
    await click(btn("متابعة"));

    await waitFor(() => expect(localStorage.getItem("teacher.id.v1")).toBe(JSON.stringify(TID)));
    expect(btn("توليد الموضوع")).toBeTruthy();
    // …and the code is gone for good.
    expect(document.body.textContent).not.toContain(CODE);
    expect(JSON.stringify(localStorage)).not.toContain("7Q4M");
  });

  test("steps 3 and 4 never render for sign-IN", async () => {
    const h = mockApi();
    await boot();
    await fill(document.querySelector<HTMLInputElement>("#auth-email")!, "prof@madrasa.dz");
    await fill(document.querySelector<HTMLInputElement>("#auth-password")!, "kalimat-sir-12");
    await click(btn("تسجيل الدخول"));

    await waitFor(() => expect(localStorage.getItem("teacher.id.v1")).toBe(JSON.stringify(TID)));
    expect(step()).toBeNull();
    expect(document.body.textContent).not.toContain(STEP3_TITLE);
    expect(document.body.textContent).not.toContain(STEP4_TITLE);
    expect(h.classPosts()).toHaveLength(0);
  });

  test("nor for RECOVERY — that teacher already has their classes", async () => {
    mockApi();
    await boot();
    await click(btn("نسيت كلمة المرور"));
    await fill(document.querySelector<HTMLInputElement>("#auth-email")!, "prof@madrasa.dz");
    await fill(document.querySelector<HTMLInputElement>("#auth-code")!, "7q4m k2xr 98df");
    await fill(document.querySelector<HTMLInputElement>("#auth-password")!, "kalimat-jadida-12");
    await click(btn("استرجاع الحساب"));
    await waitFor(() => expect(document.body.textContent).toContain(CODE));

    await click(btn("متابعة"));
    await waitFor(() => expect(localStorage.getItem("teacher.id.v1")).toBe(JSON.stringify(TID)));
    expect(step()).toBeNull();
    expect(document.body.textContent).not.toContain(STEP3_TITLE);
  });

  test("a teacher with NO account never sees a step — the gate is still the gate", async () => {
    const h = mockApi();
    await boot();
    expect(step()).toBeNull();
    expect(document.body.textContent).not.toContain(STEP3_TITLE);
    // …and no class call is made from a screen that has no teacher.
    expect(h.calls.filter((c) => c.url === "/api/classes")).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------------
// «أقسامي» — the account area, and the only creation path a returning teacher has
// ---------------------------------------------------------------------------------

const EXISTING: ClassRef[] = [
  { id: "6a7a7a365877e8523b8b023c", name: "3ر1", stream: "شعبة الرياضيات", createdAt: "2026-08-11T01:26:14.969Z" },
  { id: "6a7a7a575877e8523b8b023d", name: "3ع2", stream: "علوم تجريبية", createdAt: "2026-08-11T01:26:47.159Z" },
];

async function openAccount() {
  await waitFor(() => expect(btn("الحساب")).toBeTruthy());
  await click(btn("الحساب"));
  await waitFor(() => expect(myClasses()).toBeTruthy());
}

describe("«أقسامي» in the account area", () => {
  test("each class with its stream and its position — the week from its OWN programme", async () => {
    mockApi({ classes: EXISTING, weeks: { [EXISTING[0]!.id]: 8 }, totalWeeks: 30 });
    localStorage.setItem("teacher.id.v1", JSON.stringify(TID));
    await boot();
    await openAccount();

    const t = text(myClasses());
    expect(t).toContain(MY_CLASSES);
    expect(t).toContain("3ر1");
    expect(t).toContain("شعبة الرياضيات");
    // 30, not 27: the ceiling is the class's own programme, as the response reported it.
    expect(t).toContain("الأسبوع 8 من 30");
    // A class nobody has positioned is stated as such — never as «الأسبوع 0».
    expect(t).toContain("3ع2");
    expect(t).toContain("لم يبدأ بعد");
    expect(t).not.toContain("الأسبوع 0");
  });

  test("adding a class works signed-in — the only creation path a returning teacher has", async () => {
    const h = mockApi({ classes: EXISTING });
    localStorage.setItem("teacher.id.v1", JSON.stringify(TID));
    await boot();
    await openAccount();

    await click(btn(ADD_CLASS, myClasses()!));
    await fill(nameInput(0), "3ر2");
    await fill(streamSelect(0), "تقني رياضي");
    await click(exactBtn("أضف", myClasses()!));

    await waitFor(() => expect(h.classPosts()).toHaveLength(1));
    expect(h.classPosts()[0]!.body).toEqual({ name: "3ر2", stream: "تقني رياضي" });
    expect(h.classPosts()[0]!.teacher).toBe(TID);
    // The new class reaches the bar — a class the teacher cannot select is not created.
    await waitFor(() => expect(tabs()).toHaveLength(3));
    expect(text(tabs()[2]!)).toContain("3ر2");
  });

  test("it offers the same six streams, and no position setter — «أقسامي» reads, it does not write progress", async () => {
    const h = mockApi({ classes: EXISTING, weeks: { [EXISTING[0]!.id]: 8 } });
    localStorage.setItem("teacher.id.v1", JSON.stringify(TID));
    await boot();
    await openAccount();

    expect(myClasses()!.querySelector(".classpos")).toBeNull();
    await click(btn(ADD_CLASS, myClasses()!));
    expect([...streamSelect(0).options].map((o) => o.value).filter((v) => v !== "")).toEqual(
      STREAMS,
    );
    expect(h.progressPuts()).toHaveLength(0);
  });

  test("a teacher with no classes still gets the affordance, and nothing else", async () => {
    mockApi({ classes: [] });
    localStorage.setItem("teacher.id.v1", JSON.stringify(TID));
    await boot();
    await openAccount();

    expect(text(myClasses())).toContain(ADD_CLASS);
    expect(document.querySelector(".classbar")).toBeNull();
  });

  test("«أقسامي» does not exist on the signed-OUT gate", async () => {
    mockApi({ classes: EXISTING });
    await boot();
    await waitFor(() => expect(btn("تسجيل الدخول")).toBeTruthy());
    expect(myClasses()).toBeNull();
  });
});

// ---------------------------------------------------------------------------------
// THE HARD CONSTRAINTS
// ---------------------------------------------------------------------------------

describe("the hard constraints hold on every new surface", () => {
  test("Arabic only, Western digits, no LaTeX, no «AI» — step 3, step 4 and «أقسامي»", async () => {
    const h = mockApi();
    await boot();
    await signUpToStep3();

    const sweep = (root: Element | null) => {
      const t = text(root);
      // Latin runs are the test rather than a word list: a list only catches the
      // English somebody thought of. «AI» is two letters, so the threshold is 2.
      expect(t.match(/[A-Za-z]{2,}/g) ?? []).toEqual([]);
      expect(t).not.toMatch(/[٠-٩۰-۹]/);
      for (const needle of ["$", "\\frac", "\\text", "\\begin{"]) expect(t).not.toContain(needle);
      expect(t).not.toMatch(/الذكاء الاصطناعي/);
    };

    sweep(step()); // step 3, empty
    await fill(nameInput(0), "3ر1");
    await fill(streamSelect(0), "شعبة الرياضيات");
    await click(stepBtn(NEXT));
    await waitFor(() => expect(onboardClasses()).toHaveLength(1));
    sweep(step()); // step 4

    await click(btn(SKIP, onboardClasses()[0]!));
    sweep(step()); // step 4, skipped

    await click(stepBtn(START));
    await waitFor(() => expect(step()).toBeNull());
    await openAccount();
    sweep(myClasses()); // the account
    expect(h.progressPuts()).toHaveLength(0);
  });

  test("nothing on these surfaces is red or green — the product never grades the teacher", async () => {
    mockApi();
    await boot();
    await signUpToStep3();

    for (const el of [step()!, ...step()!.querySelectorAll("*")]) {
      expect(el.className.toString()).not.toMatch(/danger|warn|success|error|red|green|late/i);
    }
  });

  test("every new call is a relative /api/… path", async () => {
    const h = mockApi();
    await boot();
    await toStep4(h);
    await click(stepBtn(START));

    for (const url of h.urls()) {
      expect(url.startsWith("/api/")).toBe(true);
      expect(url).not.toMatch(/^https?:/);
    }
  });

  test("the steps live in the app shell, not in a second one — the sidebar is still there", async () => {
    // The app has three top-level branches and this adds no fourth: the onboarding pane
    // is the workspace's content while it lasts, so the teacher is already standing
    // inside the product they just signed up for.
    mockApi();
    await boot();
    await signUpToStep3();

    expect(document.querySelector(".app")).toBeTruthy();
    expect(document.querySelector(".sidebar")).toBeTruthy();
    expect(btn("توليد الموضوع")).toBeTruthy();
  });
});
