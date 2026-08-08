# qa-1 — signing in must not silently orphan a browser's exams

**Closed 2026-08-08.** Filed by QA as BUG-1 against SEED claim #1.

QA reproduced live what review had flagged as debt: signing IN replaces the held id, and
an anonymous id's exams then belong to an id no browser holds — permanently unreachable,
with no warning. That is the failure the whole job exists to end, reintroduced at the seam
between anonymous use and accounts.

`be` adopts only on sign-**up** by design: adopting on sign-in would re-point subject
documents, which the SEED's zero-rewrite property forbids. So the fix is not to merge —
it is to stop the loss being silent and irreversible. The displaced id is kept in
`teacher.previous.v1`, and an Arabic notice tells the teacher those exams were neither
moved nor deleted.

## review
**approve.** Two clauses (displaced id kept + notice shown; no notice when nothing was
displaced). Mutation — remove the keep-and-notify — **caught**.
