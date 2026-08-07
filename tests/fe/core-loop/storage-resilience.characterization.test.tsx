import { describe, expect, it, vi } from "vitest";

/**
 * Regression pin from REVIEW. App clears the draft from a mount effect whenever
 * there is no exam, so an unguarded localStorage.removeItem threw on FIRST LOAD
 * in any browser where storage is unavailable — the app crashed before
 * rendering. 22 passing tests missed it; a probe caught it.
 *
 * AMENDED 2026-08-08 (persistence): the exam is stored server-side now, so these
 * two functions were renamed loadDraft/saveDraft -> loadCachedExam/saveCachedExam
 * and the key they use is a cache rather than the source of truth. The INVARIANT
 * this pin exists for is unchanged and still enforced: every localStorage access,
 * including the remove path, is guarded, so a browser with storage disabled must
 * not crash the app on first load.
 */
describe("storage unavailable (private mode / disabled)", () => {
  it("clearing the cached exam must not throw when localStorage rejects", async () => {
    const throwing = {
      getItem: () => { throw new Error("SecurityError"); },
      setItem: () => { throw new Error("SecurityError"); },
      removeItem: () => { throw new Error("SecurityError"); },
    };
    vi.stubGlobal("localStorage", throwing);
    const persist = await import("@/lib/persist");
    expect(() => persist.loadCachedExam()).not.toThrow();
    expect(() => persist.saveCachedExam(null)).not.toThrow();   // ← the mount path
    // The identity and open-subject accessors added by `persistence` share the
    // same guarded helpers and must hold the same invariant.
    expect(() => persist.loadTeacherId()).not.toThrow();
    expect(() => persist.saveCurrentSubjectId(null)).not.toThrow();
    expect(() => persist.clearLegacyDraft()).not.toThrow();
  });
});
