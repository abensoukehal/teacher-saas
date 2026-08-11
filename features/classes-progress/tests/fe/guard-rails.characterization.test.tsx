/**
 * fe-5 — the guard rails: legacy invisibility, language, and one live pass.
 *
 * THE SUB-ISSUE, in one sentence: the promises no single sub-issue owns get pinned as
 * one net — a class-less teacher's app is bit-identical to the one they have today,
 * every string this slice can put on a screen obeys the hard constraints, and the two
 * questions fe-1..fe-4 left open are answered here rather than left to taste.
 *
 * The clauses that are here because a plausible implementation gets them wrong:
 *
 *   - **the legacy shell is compared against a RECORDING, not against a description.**
 *     `PRE_SLICE_SHELL` below is the literal `outerHTML` of `.app` rendered from
 *     `main` (`f994678`, the commit this job branched from), captured by rendering the
 *     PRE-SLICE `App` in this same jsdom harness. A clause that says "no class node is
 *     present" passes for an implementation that moved a button; byte equality does
 *     not. All 17,861 stored teachers have zero classes, so this shell is the app for
 *     every single user the product has today.
 *   - **…with EXACTLY ONE declared difference**, and it is the reason this sub-issue
 *     touches product code at all: the recording contains
 *     «يولّد الموضوع بالذكاء الاصطناعي…», which names the mechanism as artificial
 *     intelligence on the busiest screen in the product. The rule is absolute — never
 *     say "AI" in the UI: it names the mechanism and undercuts the one claim the
 *     product makes (docs/product-description.md §11.14, §13.1). The substitution is
 *     spelled out here, so the pin proves both halves: the violation really shipped,
 *     and nothing else about the shell moved with it.
 *   - **the word is banned at SOURCE, not just where this suite happens to render.**
 *     A rendered sweep only covers the surfaces it drives. The source clause covers
 *     every file, including the ones a later slice adds.
 *   - **«المولّد» is NOT the same offence and must survive.** The product calls itself
 *     «مولّد مواضيع البكالوريا» and the mechanism «المولّد» in five places. That names
 *     it neutrally, which is what the rule asks for INSTEAD of "AI" — renaming it would
 *     rename the product. The recording contains it, so the byte pin protects it.
 *   - **pacing is never a grade — and a token whose value is green is still green.**
 *     fe-1's rail fill was `var(--accent)` for the selected tab. `--accent` is
 *     `#1f6b52`, and a proportionally-filled green bar is the visual grammar of a score
 *     however the colour got there. Judged in fe-5's journal and pinned here at BOTH
 *     ends: no grading classname in the DOM, and no accent/danger/warn/literal colour
 *     in the stylesheet blocks that draw a position.
 *   - **the class layer has no error state, ON PURPOSE, and that silence is pinned.**
 *     A `be` that predates this slice answers `404` to every class call. If those
 *     failures spoke, every teacher on an older backend would boot into a banner about
 *     a feature they are not using (contract §10). So a failed read renders the legacy
 *     shell — asserted against the same recording — and a class whose position could
 *     not be read draws by name alone AND gets no setter: a setter primed from a
 *     snapshot that does not exist would ask a teacher to re-answer a question they
 *     already answered, against a `rev` nobody read.
 */
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import App from "@/App";
import type { ClassRef } from "@/lib/classes";

const TID = "0123456789abcdef0123456789abcdef";
const C1 = "6a7a7a365877e8523b8b023c";
const C2 = "6a7a7a575877e8523b8b023d";
const CODE = "7Q4M-K2XR-98DF";

const TWO_CLASSES: ClassRef[] = [
  { id: C1, name: "3ر1", stream: "شعبة الرياضيات", createdAt: "2026-08-11T01:26:14.969Z" },
  { id: C2, name: "3ع2", stream: "علوم تجريبية", createdAt: "2026-08-11T01:26:47.159Z" },
];

// ---------------------------------------------------------------------------------
// THE RECORDING
// ---------------------------------------------------------------------------------

/**
 * `.app` as it renders at `main` (`f994678`) for a teacher with an id, no subjects and
 * — necessarily — no classes.
 *
 * Captured 2026-08-11 by checking out `f994678` into a detached worktree and rendering
 * its `App` through this same runner config, with `GET /api/subjects` answering
 * `{subjects: []}` and everything else `404`. It is a recording, not a target: if a
 * later slice deliberately changes the shell, this constant is re-recorded and the
 * change is declared, exactly as the one below is.
 */
const PRE_SLICE_SHELL = `<div class="app" data-print="exam"><aside class="sidebar"><header class="brand"><div class="brand__mark" aria-hidden="true">ب</div><div><div class="brand__title">مولّد مواضيع البكالوريا</div><div class="brand__sub">شعبة الرياضيات — الثالثة ثانوي</div></div></header><div class="controls"><div class="field"><label class="field__label" for="topic">الموضوع الدراسي</label><select id="topic" class="field__input"><option value="مواضيع مختلطة من البرنامج">مواضيع مختلطة من البرنامج</option><option value="الدوال العددية والنهايات">الدوال العددية والنهايات</option><option value="الاشتقاق ودراسة الدوال">الاشتقاق ودراسة الدوال</option><option value="المتتاليات العددية">المتتاليات العددية</option><option value="الدالة اللوغاريتمية والأسية">الدالة اللوغاريتمية والأسية</option><option value="الأعداد المركبة">الأعداد المركبة</option><option value="الاحتمالات والإحصاء">الاحتمالات والإحصاء</option><option value="الهندسة في الفضاء">الهندسة في الفضاء</option></select></div><div class="field"><span class="field__label">مستوى الصعوبة</span><div class="segmented" role="group" aria-label="مستوى الصعوبة"><button type="button" aria-pressed="false" class="segmented__btn">سهل</button><button type="button" aria-pressed="true" class="segmented__btn is-on">متوسط</button><button type="button" aria-pressed="false" class="segmented__btn">صعب</button></div></div><div class="field-row"><div class="field"><label class="field__label" for="count">عدد التمارين</label><input id="count" class="field__input num" min="1" max="6" type="number" value="3"></div><div class="field"><label class="field__label" for="duration">المدة (بالدقائق)</label><input id="duration" class="field__input num" min="30" max="240" step="15" type="number" value="90"></div></div><div class="field"><label class="field__label" for="note">توضيح إضافي (اختياري)</label><textarea id="note" class="field__input field__textarea" rows="3" placeholder="مثال: وازن بين المحاور، مع تمرين تركيبي في الأخير"></textarea><div class="chips"><button type="button" class="chip">وازن بين المحاور الأساسية</button><button type="button" class="chip">ابدأ بتمرين سهل للتحفيز</button><button type="button" class="chip">أضف تمريناً تركيبياً في الأخير</button><button type="button" class="chip">اعتمد نمط مواضيع البكالوريا</button></div></div><button type="button" class="btn btn--primary">توليد الموضوع</button><p class="disclaimer">يولّد الموضوع بالذكاء الاصطناعي استناداً إلى البرنامج الرسمي. راجع المحتوى دائماً قبل الاستعمال في القسم.</p></div><button type="button" class="btn btn--ghost">الحساب</button><section class="subjects" aria-label="مواضيعي المحفوظة"><h2 class="subjects__title">مواضيعي</h2><p class="subjects__hint">لا توجد مواضيع محفوظة بعد. ولّد موضوعك الأول.</p></section></aside><main class="workspace"><div class="empty"><div class="empty__icon" aria-hidden="true">📝</div><h2 class="empty__title">ابدأ بتوليد موضوعك الأول</h2><p>اختر الموضوع الدراسي والمستوى من القائمة الجانبية، ثم اضغط «توليد الموضوع». يمكنك بعدها تعديل كل تمرين على حدة.</p></div></main></div>`;

/** The pre-slice call list, same capture. One request, no parameters. */
const PRE_SLICE_CALLS = ["GET /api/subjects"];

/**
 * The one declared difference — fe-5's only product-code change to the legacy shell.
 *
 * Old: names the mechanism as artificial intelligence.
 * New: names the SOURCE instead, and keeps the review instruction byte-identical.
 * «راجع المحتوى دائماً قبل الاستعمال في القسم.» is unchanged on purpose: the
 * reassurance is not what was wrong with the sentence.
 */
const AI_DISCLAIMER =
  "يولّد الموضوع بالذكاء الاصطناعي استناداً إلى البرنامج الرسمي. راجع المحتوى دائماً قبل الاستعمال في القسم.";
const PROGRAMME_DISCLAIMER =
  "الموضوع مبنيّ على البرنامج الرسمي. راجع المحتوى دائماً قبل الاستعمال في القسم.";

/** What the legacy shell must be TODAY: the recording, with that one substitution. */
const EXPECTED_SHELL = PRE_SLICE_SHELL.replace(AI_DISCLAIMER, PROGRAMME_DISCLAIMER);

/** The seven keys that predate this slice (`persist.ts`). `teacher.class.v1` is new. */
const PRE_SLICE_KEYS = [
  "teacher.draft.v1",
  "teacher.cache.v1",
  "teacher.controls.v1",
  "teacher.id.v1",
  "teacher.current.v1",
  "teacher.previous.v1",
  "teacher.pending.v1",
];
const KEY_CLASS = "teacher.class.v1";

// ---------------------------------------------------------------------------------
// THE FETCH MOCK
// ---------------------------------------------------------------------------------

interface ApiOptions {
  classes?: ClassRef[];
  /** classId → markedWeek. Absent classes answer the synthesized empty state. */
  weeks?: Record<string, number>;
  totalWeeks?: number;
  /** `GET /api/classes` fails — what a `be` that predates this slice does. */
  classesFail?: number;
  /** Class ids whose `GET /api/progress/:id` fails. */
  progressFail?: string[];
  /** `GET /api/subjects` answers `401 teacher_required` — the rejected-identity path. */
  rejectIdentity?: boolean;
  /** The first `PUT /api/progress/:id` answers `409 conflict` — somebody else moved it. */
  conflictOnce?: boolean;
}

function progressBody(classId: string, markedWeek: number, totalWeeks = 27) {
  const started = markedWeek > 0;
  return {
    progress: {
      classId,
      markedWeek,
      entries: [],
      rev: started ? 1 : 0,
      programmeDocKey: started ? "tadarroj-3as-math" : null,
      programmeEdition: started ? "2022-09" : null,
      programmeTranscriptionRev: started ? 4 : null,
      updatedAt: started ? "2026-08-11T01:26:47.207Z" : null,
    },
    programme: { docKey: "tadarroj-3as-math", edition: "2022-09", totalWeeks },
    correlationId: "cid-progress",
  };
}

function mockApi(opts: ApiOptions = {}) {
  const calls: Array<{ method: string; url: string }> = [];
  let created = 0;
  let conflicted = false;
  const fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? "GET";
    calls.push({ method, url });
    const res = (status: number, payload: unknown) => ({
      ok: status < 300,
      status,
      json: async () => payload,
    });
    const fail = (status: number, type: string, message: string) =>
      res(status, { error: { message, type }, correlationId: `cid-${type}` });

    if (url.startsWith("/api/subjects") && method === "GET") {
      if (opts.rejectIdentity) return fail(401, "teacher_required", "انتهت الجلسة.");
      return res(200, { subjects: [], correlationId: "cid-list" });
    }
    if (url === "/api/classes" && method === "GET") {
      if (opts.classesFail) return fail(opts.classesFail, "not_found", "غير موجود");
      return res(200, { classes: opts.classes ?? [], correlationId: "cid-classes" });
    }
    if (url === "/api/classes" && method === "POST") {
      const body = JSON.parse(String(init.body ?? "{}")) as { name: string; stream: string };
      created += 1;
      return res(201, {
        class: {
          id: `6a7a7a365877e8523b8b02${40 + created}`,
          name: body.name,
          stream: body.stream,
          createdAt: `2026-08-11T01:2${created}:14.969Z`,
        },
        correlationId: "cid-create",
      });
    }
    if (url === "/api/teacher/school" && method === "PUT") return res(200, { ok: true });
    if (url === "/api/auth/signup" && method === "POST")
      return res(201, { teacherId: TID, recoveryCode: CODE, correlationId: "cid-signup" });
    const p = /^\/api\/progress\/([^?]+)$/.exec(url);
    if (p) {
      const id = decodeURIComponent(p[1]!);
      if (method === "GET" && opts.progressFail?.includes(id))
        return fail(503, "store_unavailable", "تعذّر الوصول إلى المخزن.");
      if (method === "GET")
        return res(200, progressBody(id, opts.weeks?.[id] ?? 0, opts.totalWeeks ?? 27));
      if (method === "PUT") {
        const body = JSON.parse(String(init.body ?? "{}")) as { markedWeek: number };
        if (opts.conflictOnce && !conflicted) {
          conflicted = true;
          return fail(409, "conflict", "تغيّر موقع هذا القسم.");
        }
        return res(200, {
          progress: progressBody(id, body.markedWeek, opts.totalWeeks ?? 27).progress,
          correlationId: "cid-put",
        });
      }
    }
    if (url.startsWith("/api/admin/")) {
      if (url.endsWith("/kpis"))
        return res(200, {
          totalExams: 0,
          totalTeachers: 0,
          avgCostUsdPerExam: 0,
          avgDurationMsPerExam: 0,
          avgExamsPerTeacher: 0,
          examsWithKpis: 0,
        });
      if (url.endsWith("/teachers")) return res(200, { teachers: [] });
      if (url.endsWith("/exams")) return res(200, { exams: [] });
    }
    return fail(404, "not_found", "غير موجود");
  });
  vi.stubGlobal("fetch", fetchMock);
  return {
    calls,
    urls: () => calls.map((c) => c.url),
    signature: () => calls.map((c) => `${c.method} ${c.url}`),
  };
}

// ---------------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------------

const shell = () => document.querySelector(".app")!;
const bar = () => document.querySelector(".classbar");
const tabs = () => [...document.querySelectorAll<HTMLElement>("[data-class-id]")];
const pos = () => document.querySelector(".classpos");
const step = () => document.querySelector(".signup");
const myClasses = () => document.querySelector(".myclasses");
const text = (root: Element | null) => (root?.textContent ?? "").replace(/\s+/g, " ").trim();
const allButtons = (root: Element | Document = document) => [
  ...root.querySelectorAll<HTMLButtonElement>("button"),
];
const btn = (label: string, root: Element | Document = document) =>
  allButtons(root).find((b) => (b.textContent ?? "").includes(label))!;
const stepBtn = (label: string) => btn(label, step()!);
const rows = () => [...document.querySelectorAll<HTMLElement>("[data-class-row]")];
const onboardClasses = () => [...document.querySelectorAll<HTMLElement>("[data-onboard-class]")];

/** Every localStorage key actually set, read through the API (the shim's own methods
 *  show up in `Object.keys`, which is why this walks `length`/`key`). */
function storedKeys(): string[] {
  const out: string[] = [];
  for (let i = 0; i < localStorage.length; i += 1) out.push(localStorage.key(i)!);
  return out.sort();
}

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

/**
 * Everything a teacher READS on a surface: its text, plus the strings that live in
 * attributes and never reach `textContent` — placeholders, `aria-label`s, `title`s and
 * the labels of options a `<select>` has not opened.
 */
function readableStrings(root: Element): string[] {
  const out = [text(root)];
  for (const el of root.querySelectorAll<HTMLElement>("*")) {
    for (const attr of ["placeholder", "aria-label", "title", "alt"]) {
      const v = el.getAttribute(attr);
      if (v) out.push(v);
    }
  }
  return out.filter((s) => s.length > 0);
}

// ---------------------------------------------------------------------------------
// THE SOURCE TREE — clauses a rendered sweep cannot reach
// ---------------------------------------------------------------------------------

/**
 * `CHAR_ROOTDIR` is the fe checkout, set by `tools/ci` (WF-53: the suite lives in the
 * project repo, the source it gates lives in the sub-repo). Failing loudly here beats
 * a source sweep that silently walks an empty list and reports green.
 */
const ROOT = process.env.CHAR_ROOTDIR;
if (!ROOT) throw new Error("CHAR_ROOTDIR is unset — run this through `tools/ci fe --slug …`");
const SRC = path.join(ROOT, "src");

function sourceFiles(dir = SRC): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx|css|html)$/.test(e.name) ? [full] : [];
  });
}
const SOURCES = [...sourceFiles(), path.join(ROOT, "index.html")].map((f) => ({
  rel: path.relative(ROOT, f),
  body: fs.readFileSync(f, "utf8"),
}));

/** `file:line — the line` for every line matching, across the whole tree. */
function grepSource(re: RegExp, bodies = SOURCES): string[] {
  const hits: string[] = [];
  for (const { rel, body } of bodies) {
    body.split("\n").forEach((line, i) => {
      if (re.test(line)) hits.push(`${rel}:${i + 1} — ${line.trim()}`);
    });
  }
  return hits;
}

/**
 * The same tree with every comment blanked — spaces, so line numbers still line up.
 *
 * The banned-word clauses run against THIS and not the raw text, and the distinction
 * is the rule itself: "never say AI" is about what a teacher reads, and the only
 * things that can reach a screen are quoted strings and JSX text. A comment that
 * explains WHY the word is banned is the artefact that keeps the ban alive — this
 * suite's own header is one, and so is the note above the disclaimer it protects.
 * Blanket-banning the word would delete its own reasoning, which is how a rule
 * survives as a lint and dies as an idea.
 */
function withoutComments(body: string): string {
  const blank = (m: string) => m.replace(/[^\n]/g, " ");
  return body
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(/(^|[^:])(\/\/[^\n]*)/g, (_m, pre: string, c: string) => pre + blank(c))
    .replace(/<!--[\s\S]*?-->/g, blank);
}
const CODE_ONLY = SOURCES.map(({ rel, body }) => ({ rel, body: withoutComments(body) }));

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

// =================================================================================
// 1 · THE LEGACY SHELL — 17,861 teachers, and none of them asked for this
// =================================================================================

describe("a teacher with zero classes gets the app they had yesterday", () => {
  test("the shell is BYTE-IDENTICAL to the pre-slice recording, save the one declared sentence", async () => {
    localStorage.setItem("teacher.id.v1", JSON.stringify(TID));
    const h = mockApi({ classes: [] });
    await boot();
    await waitFor(() => expect(h.urls()).toContain("/api/classes"));

    // The recording really did ship the violation — otherwise the substitution below
    // is a no-op and this whole clause would pass without proving anything.
    expect(PRE_SLICE_SHELL).toContain(AI_DISCLAIMER);
    expect(EXPECTED_SHELL).not.toBe(PRE_SLICE_SHELL);

    expect(shell().outerHTML).toBe(EXPECTED_SHELL);
  });

  test("no class node, no grid-row modifier, no alert — and the children are the same two", async () => {
    localStorage.setItem("teacher.id.v1", JSON.stringify(TID));
    const h = mockApi({ classes: [] });
    await boot();
    await waitFor(() => expect(h.urls()).toContain("/api/classes"));

    expect(shell().className).toBe("app");
    expect(bar()).toBeNull();
    expect(tabs()).toHaveLength(0);
    expect(pos()).toBeNull();
    expect(step()).toBeNull();
    expect(myClasses()).toBeNull();
    expect([...shell().children].map((c) => c.className.split(" ")[0])).toEqual([
      "sidebar",
      "workspace",
    ]);
    // The class layer never raises one. `report`'s alert belongs to the exam surface.
    expect(document.querySelectorAll('[role="alert"]')).toHaveLength(0);
  });

  test("one added request, and it is the class list — every other call is byte-identical", async () => {
    localStorage.setItem("teacher.id.v1", JSON.stringify(TID));
    const h = mockApi({ classes: [] });
    await boot();
    await waitFor(() => expect(h.urls()).toContain("/api/classes"));

    // Asking is unavoidable: "this teacher has no classes" is an answer, not a
    // default. What it may not do is change anything else.
    expect(h.signature()).toEqual([...PRE_SLICE_CALLS, "GET /api/classes"]);
    // `""` reads as no-filter on the list and writes as a 404 (contract §5), so the
    // only safe serialisation of "no class" is the absent key — on every surface.
    for (const url of h.urls()) expect(url).not.toContain("classId");
  });

  test("storage gains nothing — `teacher.class.v1` is not written by a teacher who has no class", async () => {
    localStorage.setItem("teacher.id.v1", JSON.stringify(TID));
    const h = mockApi({ classes: [] });
    await boot();
    await waitFor(() => expect(h.urls()).toContain("/api/classes"));

    expect(storedKeys()).not.toContain(KEY_CLASS);
    for (const k of storedKeys()) expect(PRE_SLICE_KEYS).toContain(k);
  });

  test("a rejected identity takes `teacher.class.v1` with it", async () => {
    // The key names ANOTHER teacher's class id once `be` stops recognising this
    // browser. Left behind, it is the next teacher's selection.
    localStorage.setItem("teacher.id.v1", JSON.stringify(TID));
    localStorage.setItem(KEY_CLASS, JSON.stringify(C1));
    localStorage.setItem("teacher.current.v1", JSON.stringify("abc"));
    mockApi({ rejectIdentity: true });
    await boot();

    await waitFor(() => expect(storedKeys()).not.toContain("teacher.id.v1"));
    expect(storedKeys()).not.toContain(KEY_CLASS);
  });
});

// =================================================================================
// 2 · THE LANGUAGE SWEEP
// =================================================================================

describe("the product never names the mechanism as artificial intelligence", () => {
  test("«ذكاء» and «اصطناعي» appear in no string and no markup anywhere in the tree", async () => {
    // The rule is absolute (docs/product-description.md §11.14, §13.1). A rendered
    // sweep only covers the surfaces a suite happens to drive; this covers the tree,
    // including the files a later slice adds and the ones no test renders.
    expect(grepSource(/ذكاء|اصطناع/, CODE_ONLY)).toEqual([]);
  });

  test("no Latin-script name for the mechanism reaches a string either", async () => {
    // `claude_auth` & friends live in `api.ts`'s KIND table as wire ERROR TYPES and
    // are never rendered — the message a teacher reads comes from `be`, in Arabic. So
    // this looks for the words in TEXT position: inside a quoted string or between JSX
    // tags, never in an identifier.
    const banned = /(^|[>"'`\s])(A\.?I\.?|LLM|GPT|ChatGPT|Anthropic)([<"'`\s.,!?]|$)/;
    expect(grepSource(banned, CODE_ONLY)).toEqual([]);
  });

  test("the builder's disclaimer names the PROGRAMME, and still tells the teacher to review", async () => {
    localStorage.setItem("teacher.id.v1", JSON.stringify(TID));
    mockApi({ classes: [] });
    await boot();

    const t = text(document.querySelector(".disclaimer"));
    expect(t).toBe(PROGRAMME_DISCLAIMER);
    expect(t).toContain("البرنامج الرسمي");
    expect(t).toContain("راجع المحتوى");
    expect(t).not.toContain("الذكاء الاصطناعي");
  });

  test("«المولّد» survives — naming the mechanism NEUTRALLY is what the rule asks for instead", async () => {
    // Five user-visible places call it that, including the product's own title. The
    // rule bans "AI" because it names a clever machine; «مولّد مواضيع البكالوريا» names
    // a tool. Deleting it would rename the product, which is not what fe-5 is for.
    localStorage.setItem("teacher.id.v1", JSON.stringify(TID));
    mockApi({ classes: [] });
    await boot();
    expect(text(document.querySelector(".brand__title"))).toBe("مولّد مواضيع البكالوريا");
  });
});

describe("every string this slice can put on a screen obeys the hard constraints", () => {
  /**
   * Latin letters, Arabic-Indic digits, and LaTeX — the three that are constraints.
   *
   * The surface name rides in the assertion MESSAGE, never in the matched string: it
   * is itself Latin, and folding it in made this helper fail on its own label. Found
   * on the first red run of this suite.
   */
  function assertClean(label: string, strings: string[]) {
    for (const s of strings) {
      expect(s, `${label}: ${s}`).not.toMatch(/[A-Za-z]/);
      // Western digits only. ٠-٩ and ۰-۹ are both real and both wrong here.
      expect(s, `${label}: ${s}`).not.toMatch(/[٠-٩۰-۹]/);
      // A teacher must never see LaTeX — not a command, not a delimiter.
      expect(s, `${label}: ${s}`).not.toMatch(/\\[a-zA-Z]+|\$[^$]*\$/);
    }
  }

  test("the class bar: names, weeks, the group label", async () => {
    localStorage.setItem("teacher.id.v1", JSON.stringify(TID));
    mockApi({ classes: TWO_CLASSES, weeks: { [C1]: 8, [C2]: 20 } });
    await boot();
    await waitFor(() => expect(bar()).toBeTruthy());
    assertClean("classbar", readableStrings(bar()!));
    expect(text(bar())).toContain("أسبوع 8");
  });

  test("the position surface: the week-0 question, the picker with all its options, the notice", async () => {
    localStorage.setItem("teacher.id.v1", JSON.stringify(TID));
    localStorage.setItem(KEY_CLASS, JSON.stringify(C1));
    mockApi({ classes: TWO_CLASSES });
    await boot();
    await waitFor(() => expect(pos()).toBeTruthy());
    assertClean("classpos/empty", readableStrings(pos()!));

    await click(btn("حدّد أين وصلت", pos()!));
    await waitFor(() => expect(pos()!.querySelector(".classpos__week")).toBeTruthy());
    assertClean("classpos/picker", readableStrings(pos()!));
    // …including all 28 option labels, which `textContent` reaches but a closed
    // native select never shows.
    const opts = [...pos()!.querySelectorAll("option")].map((o) => o.textContent ?? "");
    expect(opts).toHaveLength(28);
    assertClean("classpos/options", opts);
  });

  test("the position surface again, POSITIONED and in conflict — the two states the first pass cannot reach", async () => {
    // «موقعكم المسجَّل: الأسبوع … من …» only exists for a class with a week, and the
    // 409 notice only after a write loses. The first clause renders neither: it opens
    // on a week-0 class, which is the state that has no position line at all. Both
    // were rendering unswept until a `\frac` mutant walked past this suite and was
    // caught by fe-3's instead.
    localStorage.setItem("teacher.id.v1", JSON.stringify(TID));
    localStorage.setItem(KEY_CLASS, JSON.stringify(C1));
    const h = mockApi({ classes: TWO_CLASSES, weeks: { [C1]: 8 }, conflictOnce: true });
    await boot();
    await waitFor(() => expect(pos()).toBeTruthy());
    assertClean("classpos/positioned", readableStrings(pos()!));
    expect(text(pos())).toContain("الأسبوع 8 من 27");

    await click(btn("حدّد أين وصلت", pos()!));
    await fill(pos()!.querySelector<HTMLSelectElement>(".classpos__week")!, "12");
    await click(btn("وصلنا هنا", pos()!));
    await waitFor(() => expect(h.signature()).toContain(`PUT /api/progress/${C1}`));
    await waitFor(() => expect(pos()!.querySelector(".classpos__notice")).toBeTruthy());
    assertClean("classpos/conflict", readableStrings(pos()!));
  });

  test("sign-up steps 3 and 4, and «أقسامي»", async () => {
    mockApi();
    await boot();
    await click(btn("حساب جديد"));
    await fill(document.querySelector<HTMLInputElement>("#auth-email")!, "prof@madrasa.dz");
    await fill(document.querySelector<HTMLInputElement>("#auth-password")!, "kalimat-sir-12");
    await click(btn("إنشاء الحساب"));
    await waitFor(() => expect(document.body.textContent).toContain(CODE));
    await click(btn("متابعة"));
    await waitFor(() => expect(step()).toBeTruthy());

    assertClean("signup/step3", readableStrings(step()!));
    const streams = [...rows()[0]!.querySelectorAll("option")].map((o) => o.textContent ?? "");
    assertClean("signup/streams", streams);

    await fill(rows()[0]!.querySelector<HTMLInputElement>("input")!, "3ر1");
    await fill(rows()[0]!.querySelector<HTMLSelectElement>("select")!, "شعبة الرياضيات");
    await click(stepBtn("التالي"));
    await waitFor(() => expect(onboardClasses()).toHaveLength(1));
    assertClean("signup/step4", readableStrings(step()!));

    await click(stepBtn("ابدأ"));
    await waitFor(() => expect(step()).toBeNull());
    await click(btn("الحساب"));
    await waitFor(() => expect(myClasses()).toBeTruthy());
    assertClean("myclasses", readableStrings(myClasses()!));
  });
});

// =================================================================================
// 3 · NETWORK DISCIPLINE — relative, always
// =================================================================================

describe("every call is relative, so a job lane never talks to the main checkout", () => {
  test("no absolute URL, no host, no port anywhere in the source tree", async () => {
    // `vite.config.ts` proxies `/api` to the lane's backend. An absolute URL compiled
    // into a component is THE bug that makes lane 8's UI answer from :9000.
    expect(grepSource(/https?:\/\/|localhost|127\.0\.0\.1/)).toEqual([]);
  });

  test("across a full drive — list, classes, progress read and write — every fetch is `/api/…`", async () => {
    localStorage.setItem("teacher.id.v1", JSON.stringify(TID));
    localStorage.setItem(KEY_CLASS, JSON.stringify(C1));
    const h = mockApi({ classes: TWO_CLASSES, weeks: { [C1]: 8, [C2]: 20 } });
    await boot();
    await waitFor(() => expect(pos()).toBeTruthy());
    await click(btn("حدّد أين وصلت", pos()!));
    await fill(pos()!.querySelector<HTMLSelectElement>(".classpos__week")!, "12");
    await click(btn("وصلنا هنا", pos()!));
    await waitFor(() => expect(h.signature()).toContain(`PUT /api/progress/${C1}`));

    for (const url of h.urls()) expect(url.startsWith("/api/")).toBe(true);
    // …and switching class scopes the list rather than reaching for a second path.
    await click(tabs()[1]!);
    await waitFor(() => expect(h.urls()).toContain(`/api/subjects?classId=${C2}`));
    for (const url of h.urls()) expect(url.startsWith("/api/")).toBe(true);
  });
});

// =================================================================================
// 4 · PACING IS NEVER A GRADE  (fe-5 judgement call 1)
// =================================================================================

describe("a position is drawn, never scored", () => {
  test("no grading classname and no colour inline — the rail's only inline style is its width", async () => {
    localStorage.setItem("teacher.id.v1", JSON.stringify(TID));
    localStorage.setItem(KEY_CLASS, JSON.stringify(C1));
    mockApi({ classes: TWO_CLASSES, weeks: { [C1]: 8, [C2]: 20 } });
    await boot();
    await waitFor(() => expect(pos()).toBeTruthy());

    const graded = /red|green|success|fail|danger|warn|good|bad|ahead|behind|late|ok\b/i;
    for (const el of [bar()!, pos()!].flatMap((r) => [r, ...r.querySelectorAll("*")]))
      expect(el.className.toString()).not.toMatch(graded);

    for (const fill of document.querySelectorAll<HTMLElement>(".classtab__rail-fill")) {
      // The width IS the datum — markedWeek/totalWeeks. Nothing else may be inline,
      // because an inline colour is a colour no stylesheet review would ever see.
      expect([...fill.style]).toEqual(["width"]);
    }
  });

  test("the stylesheet draws a position with NO accent, no danger, no warn and no literal colour", async () => {
    // fe-1 filled the selected tab's rail with `var(--accent)`, which is `#1f6b52` —
    // green. The fe-1 verifier's defence was that it encodes SELECTION and that both
    // classes draw identically at the same week, which is true. It is still a
    // proportionally-filled green bar, which is the visual grammar of a score, and
    // `.classpos` had already refused the accent for exactly this reason. Judged in
    // fe-5: the rail follows `.classpos`. Selection stays legible through contrast
    // (`--ink-soft` against `--border-strong`), which is hierarchy without hue.
    // Comment-stripped, so a block is judged by what it DECLARES. The rule this pins
    // is written out in prose right above the rule it changed, and a naive scan would
    // read that explanation as the violation it describes.
    const css = withoutComments(fs.readFileSync(path.join(SRC, "App.css"), "utf8"));
    const blocks = [...css.matchAll(/([^{}]*)\{([^{}]*)\}/g)]
      .map((m) => ({ selector: m[1]!.trim(), body: m[2]! }))
      .filter((b) => /classtab__rail|classpos/.test(b.selector));
    expect(blocks.length).toBeGreaterThan(0);

    for (const b of blocks) {
      expect(`${b.selector} { ${b.body} }`).not.toMatch(/var\(--(accent|danger|warn)/);
      // A hex, an rgb() or a named colour would sidestep the token rule entirely.
      expect(`${b.selector} { ${b.body} }`).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/);
    }
  });

  test("selecting a class does not change what its rail says about the class", async () => {
    localStorage.setItem("teacher.id.v1", JSON.stringify(TID));
    localStorage.setItem(KEY_CLASS, JSON.stringify(C1));
    mockApi({ classes: TWO_CLASSES, weeks: { [C1]: 8, [C2]: 20 } });
    await boot();
    await waitFor(() => expect(tabs()).toHaveLength(2));

    const rails = () =>
      tabs().map((t) => {
        const f = t.querySelector<HTMLElement>(".classtab__rail-fill");
        return f ? `${f.className}|${f.style.width}` : null;
      });
    const before = rails();
    await click(tabs()[1]!);
    await waitFor(() => expect(tabs()[1]!.getAttribute("aria-pressed")).toBe("true"));
    // Same two rails, same two widths, same two classnames: the fill is the position
    // and nothing about being selected may make one look better than the other.
    expect(rails()).toEqual(before);
  });
});

// =================================================================================
// 5 · THE CLASS LAYER FAILS SILENT  (fe-5 judgement call 2)
// =================================================================================

describe("a class layer that cannot be read degrades to the app without one", () => {
  test("a `be` that predates this slice (`404` on the class list) renders the LEGACY SHELL, byte for byte", async () => {
    // Contract §10 — deploying one stack alone changes nothing the other's users see.
    // Speaking here would put a banner about classes in front of every teacher on an
    // older backend, none of whom has a class.
    localStorage.setItem("teacher.id.v1", JSON.stringify(TID));
    const h = mockApi({ classesFail: 404 });
    await boot();
    await waitFor(() => expect(h.urls()).toContain("/api/classes"));

    expect(shell().outerHTML).toBe(EXPECTED_SHELL);
    expect(document.querySelectorAll('[role="alert"]')).toHaveLength(0);
    expect(text(document.body)).not.toContain("غير موجود");
  });

  test("a class whose position could not be read draws by NAME ALONE — never an invented rail", async () => {
    localStorage.setItem("teacher.id.v1", JSON.stringify(TID));
    const h = mockApi({
      classes: TWO_CLASSES,
      weeks: { [C1]: 8, [C2]: 20 },
      progressFail: [C2],
    });
    await boot();
    await waitFor(() => expect(tabs()).toHaveLength(2));
    await waitFor(() => expect(h.urls()).toContain(`/api/progress/${C2}`));

    expect(text(tabs()[0]!)).toContain("أسبوع 8");
    expect(tabs()[0]!.querySelector(".classtab__rail")).toBeTruthy();
    // Not a 0% rail and not «أسبوع 0»: both would state a position, and the one thing
    // known about this class is that its position is unknown.
    expect(text(tabs()[1]!)).toBe("3ع2");
    expect(tabs()[1]!.querySelector(".classtab__rail")).toBeNull();
    expect(document.querySelectorAll('[role="alert"]')).toHaveLength(0);
  });

  test("…and it gets NO setter — a picker primed from a snapshot nobody read is worse than silence", async () => {
    localStorage.setItem("teacher.id.v1", JSON.stringify(TID));
    const h = mockApi({ classes: TWO_CLASSES, weeks: { [C1]: 8 }, progressFail: [C2] });
    await boot();
    await waitFor(() => expect(tabs()).toHaveLength(2));
    await click(tabs()[1]!);
    await waitFor(() => expect(tabs()[1]!.getAttribute("aria-pressed")).toBe("true"));

    // A setter here would have to invent `rev` and `totalWeeks`, and would ask a
    // teacher who already positioned this class to answer «أين وصل هذا القسم؟» again.
    expect(pos()).toBeNull();
    expect(h.signature().filter((s) => s.startsWith("PUT /api/progress"))).toEqual([]);
  });

  test("silence is not loss: the class is still selectable and still scopes the list", async () => {
    localStorage.setItem("teacher.id.v1", JSON.stringify(TID));
    const h = mockApi({ classes: TWO_CLASSES, weeks: { [C1]: 8 }, progressFail: [C2] });
    await boot();
    await waitFor(() => expect(tabs()).toHaveLength(2));
    await click(tabs()[1]!);

    await waitFor(() => expect(h.urls()).toContain(`/api/subjects?classId=${C2}`));
    expect(JSON.parse(localStorage.getItem(KEY_CLASS)!)).toBe(C2);
  });
});
