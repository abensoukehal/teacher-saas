# be-5 — purge the orphaned test subjects  (hardening)

**Closed 2026-08-08.** Oracle 62/62 across four consecutive runs, purge applied behind a
verified dump.

## The definition had to change

The spec originally said an orphan is "a subject whose `teacherId` has no `teachers` row".
`be-2`'s backfill gave every existing teacherId a row, so that definition matches **nothing**.
Running the original definition would have been a no-op at best; writing code to it would
have been building against a fact that stopped being true two sub-issues earlier.

An orphan is now: **owned by an anonymous, never-claimed row (`email: null`) AND created
before an explicit `--before <ISO>` cutoff.** A signed-up teacher's subjects are never in
scope, at any age.

## Guards, each with a reason

- **`--before` is required, no default.** A purge with an unstated boundary is how live
  data dies.
- **Dry run is the default**; `--yes` must be typed.
- **`mongodump` first, verified non-empty.** No dump, no delete.
- **The count is re-measured immediately before deleting.** Matched documents are all older
  than the cutoff, so no concurrent insert can join the set — a moved count means something
  is wrong, and it aborts.

## One real bug in my own guard

The first version asserted `after === total - matched` as a post-condition. That assumes
the script is the only writer. It is not — the gate runs suites in parallel workers against
one database, and the check failed on a purge that was entirely correct, printing *"restore
from the dump"*. **A false alarm on an irreversible operation is its own kind of damage**:
it invites someone to restore over good data. Now the post-condition is `deletedCount ===
matched`, which is the honest claim.

Same lesson landed twice more in this sub-issue's tests: an assertion on a **global count**
in a shared database is a race. Both were rewritten to assert on **identity** — these
specific documents still exist — which is stable under concurrent inserts.

## Applied

```
cutoff            : 2026-08-08T00:00:00.000Z
matched (orphans) : 91          ← all createdAt 2026-08-07, the pre-job test data
protected         : 1808
dump verified     : 3 collection(s), 8923042 bytes
deleted           : 91
account-owned kept: 386
```

The dump is at `stacks/teacher-be/.purge-dumps/` and is **gitignored** — it contains
teacher content and must never be committed.

## Done-protocol

| check | result |
|---|---|
| oracle ×4 | 62/62 every run (flakes were mine, found and fixed) |
| refuses without `--before` | exit 2, nothing deleted |
| refuses on a failed dump | non-zero, nothing deleted |
| dry run is the default | reports, deletes nothing |
| account-owned subjects | asserted by identity across 200 watched documents — all survived |
| idempotent | second `--yes` finds 0 |
