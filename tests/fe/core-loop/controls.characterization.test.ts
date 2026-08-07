import { describe, expect, it } from "vitest";
import gen2 from "../../iterations/01-initial/recordings/gen2.request.json";
import {
  DEFAULT_CONTROLS,
  TOPICS,
  buildExamRequest,
  formatFor,
} from "@/lib/taxonomy";

/**
 * fe-2's oracle: the controls must produce the request the backend was actually
 * recorded accepting. Pinned against ../recordings/gen2.request.json rather than
 * against a hand-written expectation — a hand-written one drifts with the code.
 */
describe("controls → exam request", () => {
  it("reproduces the recorded gen2 request byte-for-byte", () => {
    const built = buildExamRequest({
      topic: "الأعداد المركبة",
      difficulty: "متوسط",
      exerciseCount: 3,
      durationMinutes: 90,
      note: "",
    });
    expect(built).toEqual(gen2);
  });

  it("omits an empty note rather than sending an empty string", () => {
    const built = buildExamRequest({ ...DEFAULT_CONTROLS, note: "   " });
    expect("note" in built.input).toBe(false);
  });

  it("sends a note when the teacher wrote one", () => {
    const built = buildExamRequest({ ...DEFAULT_CONTROLS, note: "وازن بين المحاور" });
    expect(built.input.note).toBe("وازن بين المحاور");
  });

  it("derives format from duration — 2h+ is a composition", () => {
    expect(formatFor(90)).toBe("devoir");
    expect(formatFor(120)).toBe("composition");
  });

  it("offers exactly the 8 taxonomy entries the curriculum defines", () => {
    expect(TOPICS).toHaveLength(8);
    expect(TOPICS[0]).toBe("مواضيع مختلطة من البرنامج");
    expect(TOPICS).toContain("الهندسة في الفضاء");
  });
});
