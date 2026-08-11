/**
 * fe-3 — week 0 is an invitation, and setting a position is a compare-and-set.
 *
 * THE FEATURE, in one sentence: a class nobody has positioned asks «أين وصل هذا القسم؟»
 * and offers one action — and choosing a week writes it with the `rev` the teacher was
 * looking at, so a `409` sends them back to a fresh reading instead of overwriting
 * someone else's.
 *
 * The clauses that are here because a plausible implementation gets them wrong:
 *
 *   - **a week-0 class shows NO pacing — not zero pacing, none.** An empty rail, a `0%`,
 *     a "0 من 27" or a comparison against a calendar are all the same defect: the
 *     product asserting a position nobody set (contract §7.2). The empty state is the
 *     whole of what that class says about itself.
 *   - **the picker's ceiling comes from `programme.totalWeeks` IN THE RESPONSE.** Every
 *     document in the corpus says 27 today, which is exactly what lets a hardcoded 27
 *     pass every test written against today's data (SEED risk flag). The fixture says
 *     30 on purpose.
 *   - **a `409` is re-read and re-asked, NEVER auto-resubmitted.** The contract removed
 *     the server-side retry on this surface deliberately (§0): a progress PUT is
 *     whole-state intent over what the teacher was LOOKING AT, so if `rev` moved their
 *     view is stale and only they can re-decide. A client that retries "helpfully"
 *     restores exactly the silent overwrite the CAS exists to prevent — and it would
 *     look like success.
 *   - **the PUT's `200` carries no `programme`.** Recorded live: the write answers
 *     `{progress, correlationId}` only. An implementation that rebuilds the snapshot
 *     from the write alone loses the picker's ceiling and reaches for 27.
 *   - **never grade the teacher.** Nothing on this surface is red or green — not a class
 *     name, not an inline colour, not a token that happens to be green. Behind is not a
 *     failure and ahead is not a reward.
 *   - **a failure notice is the PRODUCT's Arabic, never the server's message.** `be`
 *     passes an upstream failure's own text through verbatim, and for the datastore that
 *     text is English (`"datastore unavailable"`). Every fixture in this file that stands
 *     in for `be` therefore sends exactly what `be` sends — a fixture translated for
 *     convenience makes the Arabic clause certify itself. See the supersession note on
 *     the 503 clause.
 */
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import App from "@/App";
import { railPercent, type ClassRef } from "@/lib/classes";

const TID = "0123456789abcdef0123456789abcdef";
/** Positioned — week 8. */
const C1 = "6a7a7a365877e8523b8b023c";
/** Week 0 — the class this file is about. */
const C2 = "6a7a7a575877e8523b8b023d";

/** Recorded 2026-08-11 against lane slot 8 — createdAt ASCENDING, `be` owns the order. */
const TWO_CLASSES: ClassRef[] = [
  { id: C1, name: "3ر1", stream: "شعبة الرياضيات", createdAt: "2026-08-11T01:26:14.969Z" },
  { id: C2, name: "3ع2", stream: "علوم تجريبية", createdAt: "2026-08-11T01:26:47.159Z" },
];

/** The copy, from the handoff prototype (lines 150-160, 253-255). Deliberate Arabic —
 *  the README says it must not be machine-rewritten, so it is pinned verbatim here. */
const ASK = "أين وصل هذا القسم؟";
const LEDE = "أثمن دقيقة في إعدادك";
const SET = "حدّد أين وصلت";
const FROM_ONE = "نبدأ من الأسبوع 1";
const HERE = "وصلنا هنا";

/**
 * `GET /api/progress/:classId`, recorded verbatim 2026-08-11 against :9800.
 *
 * ONE key set whether the document exists or not — `programmeTranscriptionRev` included,
 * `null` until the first write stamps it (contract §4). A shape that gained a key after
 * the first write would let `fe` branch on which of two it got, and the branch it forgot
 * would be the empty one.
 */
function progressBody(classId: string, markedWeek: number, rev: number, totalWeeks = 27) {
  const started = markedWeek > 0;
  return {
    progress: {
      classId,
      markedWeek,
      entries: [],
      rev,
      programmeDocKey: started ? "tadarroj-3as-math" : null,
      programmeEdition: started ? "2022-09" : null,
      programmeTranscriptionRev: started ? 4 : null,
      updatedAt: started ? "2026-08-11T01:26:47.207Z" : null,
    },
    programme: { docKey: "tadarroj-3as-math", edition: "2022-09", totalWeeks },
    correlationId: "cid-progress",
  };
}

interface Call {
  method: string;
  url: string;
  body: Record<string, unknown> | undefined;
}

interface ApiOptions {
  classes?: ClassRef[];
  totalWeeks?: number;
  /** classId → the week the GET reports. Re-read on every GET, so a 409's refetch can
   *  answer with what somebody else wrote. */
  weeks?: Record<string, number>;
  /** classId → the `rev` the GET reports. */
  revs?: Record<string, number>;
  /**
   * Fail the FIRST `PUT` with this error type; later writes succeed.
   *
   * ⚠ `message` must be **what `be` actually sends**, not what would be convenient.
   * The 503 below is the case that matters: `be` maps `StoreError` by passing its
   * message through verbatim (`app.ts`), and that message is the English literal
   * `"datastore unavailable"` (`store/client.ts`). See the supersession note at the
   * clause itself.
   */
  putFails?: { status: number; type: string; message: string };
  /** Make `GET /api/classes` fail — a `be` that predates this slice answers 404. */
  classesFail?: number;
}

function mockApi(opts: ApiOptions = {}) {
  const calls: Call[] = [];
  const weeks: Record<string, number> = { ...(opts.weeks ?? {}) };
  const revs: Record<string, number> = { ...(opts.revs ?? {}) };
  let putsSeen = 0;

  const fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? "GET";
    calls.push({
      method,
      url,
      body: typeof init.body === "string" ? JSON.parse(init.body) : undefined,
    });
    const res = (status: number, payload: unknown) => ({
      ok: status < 300,
      status,
      json: async () => payload,
    });

    if (url === "/api/classes" && method === "GET") {
      if (opts.classesFail) {
        return res(opts.classesFail, {
          error: { message: "غير موجود", type: "not_found" },
          correlationId: "cid-classes",
        });
      }
      return res(200, { classes: opts.classes ?? [], correlationId: "cid-classes" });
    }

    const prog = /^\/api\/progress\/([^?]+)$/.exec(url);
    if (prog) {
      const id = decodeURIComponent(prog[1]!);
      if (method === "GET") {
        return res(200, progressBody(id, weeks[id] ?? 0, revs[id] ?? 0, opts.totalWeeks ?? 27));
      }
      if (method === "PUT") {
        putsSeen += 1;
        if (opts.putFails && putsSeen === 1) {
          return res(opts.putFails.status, {
            error: { message: opts.putFails.message, type: opts.putFails.type },
            correlationId: "cid-put",
          });
        }
        const body = JSON.parse(init.body as string) as { rev: number; markedWeek: number };
        /**
         * A REAL compare-and-set, not a scripted failure. The 409 in this file is
         * produced the way `be` produces it — by another writer having moved `rev`
         * first — so the clause cannot pass against a client that only recognises a
         * canned error.
         */
        const cur = revs[id] ?? 0;
        if (body.rev !== cur) {
          return res(409, {
            error: { message: "تغيّر تقدّم القسم أثناء الحفظ", type: "conflict" },
            correlationId: "cid-put-409",
          });
        }
        weeks[id] = body.markedWeek;
        revs[id] = body.rev + 1;
        /**
         * The write answers with `progress` and NOTHING ELSE — no `programme`.
         * Recorded live; it is why the picker's ceiling has to be carried over from
         * the GET rather than re-derived from the write.
         */
        return res(200, {
          progress: {
            classId: id,
            markedWeek: body.markedWeek,
            entries: [],
            rev: body.rev + 1,
            programmeDocKey: "tadarroj-3as-math",
            programmeEdition: "2022-09",
            programmeTranscriptionRev: 4,
            updatedAt: "2026-08-11T02:35:01.157Z",
          },
          correlationId: "cid-put-ok",
        });
      }
    }

    if (url.startsWith("/api/subjects") && method === "GET") {
      return res(200, { subjects: [], correlationId: "cid-list" });
    }
    return res(404, { error: { message: "غير موجود", type: "not_found" } });
  });
  vi.stubGlobal("fetch", fetchMock);

  return {
    calls,
    urls: () => calls.map((c) => c.url),
    puts: () => calls.filter((c) => c.method === "PUT"),
    /** Another tab, another device, or the teacher's phone — a write this browser did
     *  not make. It moves `rev`, which is exactly what makes the next CAS lose. */
    otherWriter: (id: string, week: number) => {
      weeks[id] = week;
      revs[id] = (revs[id] ?? 0) + 1;
    },
    progressGets: (id: string) =>
      calls.filter((c) => c.method === "GET" && c.url === `/api/progress/${id}`),
    lists: () => calls.filter((c) => c.method === "GET" && /^\/api\/subjects(\?|$)/.test(c.url)),
  };
}

async function boot() {
  await act(async () => {
    render(<App />);
  });
}

function seed({ cls }: { cls?: string | null } = {}) {
  localStorage.setItem("teacher.id.v1", JSON.stringify(TID));
  if (cls) localStorage.setItem("teacher.class.v1", JSON.stringify(cls));
}

const panel = () => document.querySelector(".classpos");
const tabs = () => [...document.querySelectorAll<HTMLElement>("[data-class-id]")];
const railOf = (id: string) =>
  tabs()
    .find((t) => t.getAttribute("data-class-id") === id)!
    .querySelector<HTMLElement>(".classtab__rail-fill");
const text = (root: Element | null) => (root?.textContent ?? "").replace(/\s+/g, " ").trim();
const buttons = () => [...document.querySelectorAll<HTMLElement>(".classpos button")];
const btn = (label: string) => buttons().find((b) => (b.textContent ?? "").includes(label))!;
const weekSelect = () => document.querySelector<HTMLSelectElement>(".classpos select")!;

async function click(el: HTMLElement) {
  await act(async () => {
    el.click();
  });
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
// THE EMPTY STATE — a question and an action, and no pacing at all
// ---------------------------------------------------------------------------------

describe("a week-0 class asks «أين وصل هذا القسم؟»", () => {
  test("the three copy strings, verbatim — and NOT one pixel of invented pacing", async () => {
    seed({ cls: C2 });
    mockApi({ classes: TWO_CLASSES, weeks: { [C1]: 8 }, revs: { [C1]: 1 } });
    await boot();

    await waitFor(() => expect(panel()).toBeTruthy());
    const t = text(panel());
    expect(t).toContain(ASK);
    expect(t).toContain(LEDE);
    expect(btn(SET)).toBeTruthy();
    expect(btn(FROM_ONE)).toBeTruthy();
    // It names its class, so «which class am I looking at» is answered by the surface
    // that is about to change that class's position.
    expect(t).toContain("3ع2");

    // NO pacing. Not a rail, not a percentage, not a "0 من 27", not a comparison — a
    // week-0 class shows *no* pacing, not zero pacing (contract §7.2).
    expect(panel()!.querySelector(".classtab__rail, .classpos__rail, progress")).toBeNull();
    expect([...panel()!.querySelectorAll("[style]")]).toHaveLength(0);
    expect(t).not.toContain("%");
    expect(t).not.toContain("من 27");
    expect(t).not.toContain("أسبوع 0");
    expect(t).not.toContain("متوقَّع");
    // …and the tab keeps saying nothing about it either (fe-1's clause, still true).
    expect(railOf(C2)).toBeNull();
  });

  test("it is an invitation, never an error — no alert role, no error styling", async () => {
    // `markedWeek: 0` is a STATE (contract §7.2). A `be` that answers `200` with the
    // synthesized empty shape must not reach the teacher as something that went wrong.
    seed({ cls: C2 });
    mockApi({ classes: TWO_CLASSES });
    await boot();

    await waitFor(() => expect(panel()).toBeTruthy());
    expect(panel()!.querySelector("[role='alert']")).toBeNull();
    expect(document.querySelector(".alert")).toBeNull();
    expect(panel()!.className).not.toMatch(/error|alert|danger/);
  });

  test("nothing on this surface is red or green — behind is not a failure", async () => {
    // The one rule the whole slice turns on: never grade the teacher. Colour would be
    // the fastest way to do it, so no element here carries a colour class or an inline
    // one — including the accent, which happens to be green in this theme.
    seed({ cls: C2 });
    mockApi({ classes: TWO_CLASSES });
    await boot();
    await waitFor(() => expect(panel()).toBeTruthy());

    for (const el of [panel()!, ...panel()!.querySelectorAll("*")]) {
      expect(el.className.toString()).not.toMatch(
        /accent|primary|danger|warn|success|error|red|green|behind|ahead|late/i,
      );
      expect(el.getAttribute("style")).toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------------
// THE PICKER — bounded by the RESPONSE, never by 27
// ---------------------------------------------------------------------------------

describe("the week picker", () => {
  test("offers 0..totalWeeks FROM THE RESPONSE — 30 here, and 27 is nowhere in it", async () => {
    seed({ cls: C2 });
    mockApi({ classes: TWO_CLASSES, totalWeeks: 30 });
    await boot();
    await waitFor(() => expect(panel()).toBeTruthy());

    await click(btn(SET));
    const options = [...weekSelect().options];
    // 0..30 inclusive — 0 is «not started», which is a real value the contract allows
    // a teacher to write back.
    expect(options).toHaveLength(31);
    expect(options[0]!.value).toBe("0");
    expect(options[30]!.value).toBe("30");
    expect(options.map((o) => o.textContent)).toContain("الأسبوع 30");
    // The trap: every document in the corpus says 27, so a hardcoded 27 passes every
    // test written against today's data.
    expect(options.map((o) => o.value)).not.toEqual(
      Array.from({ length: 28 }, (_, i) => String(i)),
    );
  });

  test("choosing week 8 writes `{rev: 0, markedWeek: 8}` — and the rail follows", async () => {
    seed({ cls: C2 });
    const h = mockApi({ classes: TWO_CLASSES });
    await boot();
    await waitFor(() => expect(panel()).toBeTruthy());

    await click(btn(SET));
    await act(async () => {
      fireEvent.change(weekSelect(), { target: { value: "8" } });
    });
    await click(btn(HERE));

    await waitFor(() => expect(h.puts()).toHaveLength(1));
    const put = h.puts()[0]!;
    expect(put.url).toBe(`/api/progress/${C2}`);
    // `rev: 0` is the CAS token for "no document yet" (contract §4). Sending anything
    // else — or omitting it — is a write that cannot lose.
    expect(put.body).toEqual({ rev: 0, markedWeek: 8 });

    // The position is on screen, and the tab's rail is now the drawn version of it.
    await waitFor(() => expect(text(panel())).toContain("الأسبوع 8"));
    expect(text(panel())).not.toContain(ASK);
    await waitFor(() => expect(railOf(C2)).toBeTruthy());
    expect(railOf(C2)!.style.width).toBe(railPercent(8, 27));
  });

  test("«نبدأ من الأسبوع 1» is the same write, spelled as one tap", async () => {
    seed({ cls: C2 });
    const h = mockApi({ classes: TWO_CLASSES });
    await boot();
    await waitFor(() => expect(panel()).toBeTruthy());

    await click(btn(FROM_ONE));
    await waitFor(() => expect(h.puts()).toHaveLength(1));
    expect(h.puts()[0]!.body).toEqual({ rev: 0, markedWeek: 1 });
    await waitFor(() => expect(text(panel())).toContain("الأسبوع 1"));
  });

  test("a positioned class writes the rev IT was shown, not 0", async () => {
    // The CAS token is whatever the teacher was looking at. A second write that reused
    // 0 would 409 forever; one that guessed `rev + 1` would clobber.
    seed({ cls: C1 });
    const h = mockApi({ classes: TWO_CLASSES, weeks: { [C1]: 8 }, revs: { [C1]: 3 } });
    await boot();
    await waitFor(() => expect(panel()).toBeTruthy());

    await click(btn(SET));
    await act(async () => {
      fireEvent.change(weekSelect(), { target: { value: "12" } });
    });
    await click(btn(HERE));
    await waitFor(() => expect(h.puts()).toHaveLength(1));
    expect(h.puts()[0]!.body).toEqual({ rev: 3, markedWeek: 12 });
  });
});

// ---------------------------------------------------------------------------------
// THE 409 — re-read and re-ask. Never auto-resubmit.
// ---------------------------------------------------------------------------------

describe("a `409 conflict` sends the teacher back to a fresh reading", () => {
  test("it REFETCHES, shows the fresh position in Arabic, and does not re-send the write", async () => {
    // Contract §0: no server-side retry, on purpose — a progress PUT is whole-state
    // intent over what the teacher was LOOKING AT. A client that resubmits restores
    // exactly the silent overwrite the CAS exists to prevent, and it looks like success.
    seed({ cls: C2 });
    const h = mockApi({ classes: TWO_CLASSES });
    await boot();
    await waitFor(() => expect(panel()).toBeTruthy());

    const getsBefore = h.progressGets(C2).length;
    await click(btn(SET));
    await act(async () => {
      fireEvent.change(weekSelect(), { target: { value: "8" } });
    });
    // Somebody else positions this class between the read and the write.
    h.otherWriter(C2, 12);
    await click(btn(HERE));
    await waitFor(() => expect(h.puts()).toHaveLength(1));

    // The re-read really happened…
    await waitFor(() => expect(h.progressGets(C2).length).toBeGreaterThan(getsBefore));
    // …and NOT a second write. Not now, and not after everything has settled.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(h.puts()).toHaveLength(1);

    // The teacher is told, in Arabic, and asked again.
    const t = text(panel());
    expect(t).toMatch(/تغيّر|تغيَّر/);
    expect(t).toContain("أعد الاختيار");
    expect(weekSelect()).toBeTruthy();
    expect(t.match(/[A-Za-z]{2,}/g) ?? []).toEqual([]);
  });

  test("the fresh position it re-reads is the one another writer left", async () => {
    seed({ cls: C2 });
    const h = mockApi({ classes: TWO_CLASSES });
    await boot();
    await waitFor(() => expect(panel()).toBeTruthy());

    await click(btn(SET));
    await act(async () => {
      fireEvent.change(weekSelect(), { target: { value: "8" } });
    });
    // Somebody else's write lands between the read and ours: week 12, rev 0 → 1.
    h.otherWriter(C2, 12);
    await click(btn(HERE));
    await waitFor(() => expect(text(panel())).toContain("أعد الاختيار"));

    // 12 is on screen; the teacher's own 8 was NOT written on top of it.
    expect(text(panel())).toContain("الأسبوع 12");
    const ours = h.puts().filter((p) => (p.body as { markedWeek: number }).markedWeek === 8);
    expect(ours).toHaveLength(1);
    // And the next attempt carries the rev the re-read brought back — the teacher
    // re-decides from what is actually stored, which is the whole point of the 409.
    await click(btn(HERE));
    await waitFor(() => expect(h.puts()).toHaveLength(2));
    expect((h.puts()[1]!.body as { rev: number }).rev).toBe(1);
  });
});

// ---------------------------------------------------------------------------------
// THE 503 — retryable, and the week stays chosen
// ---------------------------------------------------------------------------------

describe("`503 store_unavailable` is one tap from done", () => {
  /**
   * ⚠ SUPERSESSION (WF-65), declared — the mock, never the assertion.
   *
   * This clause first shipped with the 503 mocked as
   * `message: "تعذّر الوصول إلى قاعدة البيانات. حاول مرة أخرى."`, and asserted that
   * sentence on screen. `be` never sends it. It maps `StoreError` by passing the
   * message through verbatim (`app.ts`), and that message is the ENGLISH literal
   * `"datastore unavailable"` (`store/client.ts`) — confirmed on the wire against
   * lane 8 with the store pointed at a dead host:
   *
   *   PUT /api/progress/… → 503
   *   {"error":{"message":"datastore unavailable","type":"store_unavailable", …}}
   *
   * So the clause was true only of a fixture. `ClassPosition` rendered
   * `err.message` raw, and the surface really did put «datastore unavailable» in
   * front of a teacher — the hard constraint broken on the exact path a passing
   * test claimed was Arabic. The pin was wrong about reality, which is what a
   * declared supersession is for.
   *
   * WHAT CHANGED: the mock now sends what `be` sends.
   * WHAT DID NOT: every assertion. Arabic on screen, retryable, the chosen week
   * still selected, and the retry re-sending the same body — all four still hold,
   * and two assertions were ADDED (no Latin run anywhere on the surface, and the
   * server's own word never reaches it) so the clause can now fail the defect it
   * used to certify.
   */
  test("Arabic, retryable, the chosen week still selected — and the retry re-sends it", async () => {
    seed({ cls: C2 });
    const h = mockApi({
      classes: TWO_CLASSES,
      putFails: {
        status: 503,
        type: "store_unavailable",
        // VERBATIM from `be`. Do not translate this fixture — translating it is the
        // bug, and the whole point of the clause is that `fe` never shows it.
        message: "datastore unavailable",
      },
    });
    await boot();
    await waitFor(() => expect(panel()).toBeTruthy());

    await click(btn(SET));
    await act(async () => {
      fireEvent.change(weekSelect(), { target: { value: "8" } });
    });
    await click(btn(HERE));
    await waitFor(() => expect(h.puts()).toHaveLength(1));

    // The teacher is told, in the product's own Arabic — `fe` says the datastore
    // blinked; it does not repeat what `be` said about it.
    await waitFor(() => expect(text(panel())).toContain("تعذّر الوصول إلى قاعدة البيانات"));
    expect(text(panel())).not.toContain("datastore");
    expect(text(panel()).match(/[A-Za-z]{2,}/g) ?? []).toEqual([]);
    // The teacher's choice is not thrown away by the failure — retry is one tap, not a
    // re-decision.
    expect(weekSelect().value).toBe("8");
    // …and unlike the 409, a retry here is legitimate: nothing moved underneath them.
    await click(btn("إعادة المحاولة"));
    await waitFor(() => expect(h.puts()).toHaveLength(2));
    expect(h.puts()[1]!.body).toEqual({ rev: 0, markedWeek: 8 });
    await waitFor(() => expect(text(panel())).toContain("الأسبوع 8"));
  });
});

// ---------------------------------------------------------------------------------
// THE TWO-SIDED PAIR — and the states this surface must NOT appear in
// ---------------------------------------------------------------------------------

describe("the empty state and the position are exclusive", () => {
  test("a positioned class (8/27) never renders the empty state", async () => {
    seed({ cls: C1 });
    mockApi({ classes: TWO_CLASSES, weeks: { [C1]: 8 }, revs: { [C1]: 1 } });
    await boot();
    await waitFor(() => expect(panel()).toBeTruthy());

    const t = text(panel());
    expect(t).not.toContain(ASK);
    expect(t).not.toContain(LEDE);
    expect(t).not.toContain(FROM_ONE);
    expect(t).toContain("الأسبوع 8");
    // The denominator is the class's own programme, and it is stated as a fact, not as
    // a score: no percentage, no comparison, no colour.
    expect(t).toContain("من 27");
    expect(t).not.toContain("%");
    expect(t).not.toContain("متأخر");
    expect(t).not.toContain("متقدّم");
  });

  test("with classes but NO class selected there is no position surface at all", async () => {
    // fe-1 and fe-2 both left «nothing is selected on first load» to this sub-issue.
    // It stays: fe-2's oracle pins that a teacher with classes who has selected none
    // issues the param-less list request of every teacher today (contract §0), so
    // auto-selecting would silently scope a returning teacher's whole screen to a
    // classroom they never walked into. The position surface therefore belongs to a
    // SELECTED class, and it names that class.
    seed({ cls: null });
    const h = mockApi({ classes: TWO_CLASSES });
    await boot();
    await waitFor(() => expect(tabs()).toHaveLength(2));

    expect(panel()).toBeNull();
    expect(h.puts()).toHaveLength(0);
    expect(h.lists()).toHaveLength(1);
    expect(h.lists()[0]!.url).toBe("/api/subjects");
  });

  test("a class read that fails leaves NO invisible scope behind", async () => {
    // fe-1's open note, pinned. `teacher.class.v1` outlives a failed class read — and
    // with no bar there is nothing on screen that could show it or change it, while
    // `boot` has already read the subject list scoped to it. An unknown `classId`
    // answers with the legacy-only list and no error (contract §5), so the teacher
    // would silently lose every class-tagged exam to a selection they cannot see.
    seed({ cls: C1 });
    const h = mockApi({ classes: TWO_CLASSES, classesFail: 404 });
    await boot();
    await waitFor(() => expect(h.lists().length).toBeGreaterThan(0));

    expect(document.querySelector(".classbar")).toBeNull();
    expect(panel()).toBeNull();
    expect(document.querySelector("[role='alert']")).toBeNull();
    // The last word on the list is unscoped.
    await waitFor(() => {
      const l = h.lists();
      expect(l[l.length - 1]!.url).toBe("/api/subjects");
    });
    // The teacher's own choice is not destroyed by a transient failure — it is simply
    // not obeyed while it cannot be seen.
    expect(localStorage.getItem("teacher.class.v1")).toBe(JSON.stringify(C1));
  });

  test("the signed-out gate and `#/admin` have no position surface", async () => {
    mockApi({ classes: TWO_CLASSES });
    await boot();
    await waitFor(() => expect(document.querySelector("form, .auth")).toBeTruthy());
    expect(panel()).toBeNull();

    cleanup();
    seed({ cls: C2 });
    window.location.hash = "#/admin";
    mockApi({ classes: TWO_CLASSES });
    await boot();
    await waitFor(() =>
      expect(document.querySelector("[data-testid='admin-console']")).toBeTruthy(),
    );
    expect(panel()).toBeNull();
  });
});

// ---------------------------------------------------------------------------------
// THE HARD CONSTRAINTS
// ---------------------------------------------------------------------------------

describe("the hard constraints hold on the position surface", () => {
  test("Arabic only, Western digits, no LaTeX, no «AI» — in every one of its states", async () => {
    seed({ cls: C2 });
    mockApi({ classes: TWO_CLASSES });
    await boot();
    await waitFor(() => expect(panel()).toBeTruthy());

    const sweep = () => {
      const t = text(panel());
      // Latin runs are the test rather than a word list: a list only catches the
      // English somebody thought of. There is no maths on this surface, so any Latin
      // run at all is a defect — and «AI» is two letters, so the threshold is 2.
      expect(t.match(/[A-Za-z]{2,}/g) ?? []).toEqual([]);
      expect(t).not.toMatch(/[٠-٩۰-۹]/);
      for (const needle of ["$", "\\frac", "\\text", "\\begin{"]) expect(t).not.toContain(needle);
      expect(t).not.toMatch(/الذكاء الاصطناعي/);
    };

    sweep(); // the empty state
    await click(btn(SET));
    sweep(); // the picker
    await act(async () => {
      fireEvent.change(weekSelect(), { target: { value: "8" } });
    });
    await click(btn(HERE));
    await waitFor(() => expect(text(panel())).toContain("الأسبوع 8"));
    sweep(); // the position
  });

  test("every progress call is relative and addressed by class id", async () => {
    seed({ cls: C2 });
    const h = mockApi({ classes: TWO_CLASSES });
    await boot();
    await waitFor(() => expect(panel()).toBeTruthy());
    await click(btn(FROM_ONE));
    await waitFor(() => expect(h.puts()).toHaveLength(1));

    for (const url of h.urls()) {
      expect(url.startsWith("/api/")).toBe(true);
      expect(url).not.toMatch(/^https?:/);
    }
    expect(h.puts()[0]!.url).toBe(`/api/progress/${C2}`);
  });

  test("the write disables its own controls for the beat it is in flight", async () => {
    // Not decoration: `create` is insert-only elsewhere in this app for exactly this
    // reason. Here a double-tap would be two CAS writes, the second of which 409s and
    // sends the teacher into a conflict they caused themselves.
    seed({ cls: C2 });
    let release!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const h = mockApi({ classes: TWO_CLASSES });
    const inner = globalThis.fetch as unknown as (u: string, i?: RequestInit) => Promise<unknown>;
    vi.stubGlobal("fetch", async (u: string, i: RequestInit = {}) => {
      if ((i.method ?? "GET") === "PUT") await gate;
      return inner(u, i);
    });
    await boot();
    await waitFor(() => expect(panel()).toBeTruthy());

    await click(btn(SET));
    await act(async () => {
      fireEvent.change(weekSelect(), { target: { value: "8" } });
    });
    await act(async () => {
      btn(HERE).click();
    });
    expect(buttons().every((b) => (b as HTMLButtonElement).disabled)).toBe(true);
    await act(async () => {
      release();
      await Promise.resolve();
    });
    await waitFor(() => expect(h.puts()).toHaveLength(1));
  });
});
