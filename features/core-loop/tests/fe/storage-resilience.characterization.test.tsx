import { describe, expect, it, vi } from "vitest";

/**
 * Regression pin from REVIEW. App clears the draft from a mount effect whenever
 * there is no exam, so an unguarded localStorage.removeItem threw on FIRST LOAD
 * in any browser where storage is unavailable — the app crashed before
 * rendering. 22 passing tests missed it; a probe caught it.
 */
describe("storage unavailable (private mode / disabled)", () => {
  it("saveDraft(null) must not throw when localStorage rejects", async () => {
    const throwing = {
      getItem: () => { throw new Error("SecurityError"); },
      setItem: () => { throw new Error("SecurityError"); },
      removeItem: () => { throw new Error("SecurityError"); },
    };
    vi.stubGlobal("localStorage", throwing);
    const { saveDraft, loadDraft } = await import("@/lib/persist");
    expect(() => loadDraft()).not.toThrow();
    expect(() => saveDraft(null)).not.toThrow();   // ← the mount path
  });
});
