/**
 * fe-3 — a teacher can see and reopen earlier subjects.
 *
 * Storing many subjects is worthless if none can be reached again, so this is
 * where the fix becomes visible to a teacher. Hard constraints under test:
 * Arabic only, RTL-safe styling, and NO LaTeX can reach this surface (summaries
 * carry no statements, by contract).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import SubjectList from "@/components/SubjectList";
import type { SubjectSummary } from "@/lib/api";

const SUMMARIES: SubjectSummary[] = [
  {
    id: "s2",
    title: "الموضوع الثاني",
    topic: "النهايات",
    exerciseCount: 4,
    totalPoints: 20,
    createdAt: "2026-08-06T10:00:00.000Z",
    updatedAt: "2026-08-07T10:00:00.000Z",
  },
  {
    id: "s1",
    title: "الموضوع الأول",
    topic: "الدوال العددية",
    exerciseCount: 3,
    totalPoints: 20,
    createdAt: "2026-08-01T10:00:00.000Z",
    updatedAt: "2026-08-02T10:00:00.000Z",
  },
];

const noop = () => {};

function renderList(props: Partial<React.ComponentProps<typeof SubjectList>> = {}) {
  return render(
    <SubjectList
      subjects={SUMMARIES}
      currentId={null}
      loading={false}
      error={null}
      onOpen={noop}
      onRetry={noop}
      {...props}
    />,
  );
}

afterEach(() => cleanup());

describe("positive — rows", () => {
  test("renders one row per subject, in the order given (newest first)", () => {
    renderList();
    const items = screen.getAllByRole("button");
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toContain("الموضوع الثاني");
    expect(items[1].textContent).toContain("الموضوع الأول");
  });

  test("each row shows title, topic, exercise count and total points", () => {
    renderList();
    const first = screen.getAllByRole("button")[0];
    expect(within(first).getByText("الموضوع الثاني")).toBeTruthy();
    expect(within(first).getByText("النهايات")).toBeTruthy();
    expect(first.textContent).toContain("4");
    expect(first.textContent).toContain("20");
  });

  test("the open subject is marked with aria-current", () => {
    renderList({ currentId: "s1" });
    const current = screen.getAllByRole("button").find((b) => b.getAttribute("aria-current"));
    expect(current?.textContent).toContain("الموضوع الأول");
  });

  test("clicking a row opens it by id", () => {
    const onOpen = vi.fn();
    renderList({ onOpen });
    fireEvent.click(screen.getAllByRole("button")[1]);
    expect(onOpen).toHaveBeenCalledWith("s1");
  });
});

describe("positive — states", () => {
  test("empty is an Arabic message, never a blank panel", () => {
    renderList({ subjects: [] });
    const hint = screen.getByText(/لا توجد مواضيع محفوظة بعد/);
    expect(hint).toBeTruthy();
  });

  test("loading shows a pending hint", () => {
    renderList({ subjects: [], loading: true });
    expect(screen.getByText("جارٍ التحميل…")).toBeTruthy();
  });

  test("a store error shows an Arabic alert WITH retry, and retry fires", () => {
    const onRetry = vi.fn();
    renderList({ subjects: [], error: "لم نتمكّن من تحميل المواضيع.", onRetry });

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toMatch(/[؀-ۿ]/);
    fireEvent.click(screen.getByRole("button", { name: "إعادة المحاولة" }));
    expect(onRetry).toHaveBeenCalled();
  });
});

describe("negative — hard constraints", () => {
  test("no Latin-script UI copy in the rendered list", () => {
    const { container } = renderList();
    // Numerals and separators are fine; Latin WORDS are not — the locale is Arabic.
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/[A-Za-z]{3,}/);
  });

  test("no LaTeX can surface here — summaries carry no statements", () => {
    const { container } = renderList();
    const text = container.textContent ?? "";
    expect(text).not.toContain("$");
    expect(text).not.toContain("\\");
    // And the component is never handed a statement in the first place.
    expect(JSON.stringify(SUMMARIES)).not.toContain("statement");
  });

  test("the new styles use logical properties, not physical left/right", () => {
    // RTL is a hard constraint, and a physical margin mirrors wrong silently.
    const css = readFileSync(
      join(process.env.CHAR_ROOTDIR ?? "", "src/App.css"),
      "utf8",
    );
    const block = css.slice(css.indexOf("/* ---- saved subjects"));
    expect(block.length).toBeGreaterThan(0);
    expect(block).not.toMatch(/margin-(left|right)\s*:/);
    expect(block).not.toMatch(/padding-(left|right)\s*:/);
    expect(block).not.toMatch(/text-align:\s*(left|right)/);
  });

  test("the list is labelled for assistive tech", () => {
    renderList();
    expect(screen.getByRole("region", { name: "مواضيعي المحفوظة" })).toBeTruthy();
  });
});
