# qa-2 — a reload must reconcile with the server, not trust the paint cache

**Closed 2026-08-08.** Filed by QA as BUG-2 against SEED claim #1 (multi-device).

Boot painted the open exam from `teacher.cache.v1` and never reconciled it, so a subject
refined on another device rendered as current indefinitely — and refining from that stale
pane would have pushed an old body through the compare-and-set. The list path refetched
correctly; only the reload path lied.

This defect exists *because* multi-device became a real claim in this job: the same code
was harmless when a teacher's exams only ever lived in one browser.

Boot now refetches the open subject with `GET /api/subjects/:id` and prefers the server's
version, leaving the cached paint alone if the subject is gone or no longer ours.

## review
**approve.** One clause: boot issues the refetch and the server's title wins over the
cached one. Mutation — skip the refetch — **caught**.
