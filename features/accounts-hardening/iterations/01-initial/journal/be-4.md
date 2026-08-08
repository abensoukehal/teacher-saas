# be-4 — bound the auth surface

**Status:** done · gate `85/85` green, four consecutive clean runs · freeze audit clean.

## Pre-flight (slot-2 ground truth, re-run)

```
POST /api/auth/signup  (fresh address)      -> 201
POST /api/auth/signup  (same address again) -> 409 {"type":"email_taken"}
40 consecutive wrong-password sign-ins      -> 40 × 401 in 1849 ms (~21 req/s, no throttle)
```

Reproduces. (QA recorded ~28 req/s; this machine measured ~21 under a warm lane. Same
finding: nothing throttles anything.)

## Oracle first, RED before code

`features/accounts-hardening/tests/be/auth-bounds.characterization.test.js` — first run
**10 failed**.

## Delta (exactly the sub-issue's)

- `src/ratelimit.ts` — **new**, in-process fixed window.
- `src/routes/auth.ts` — applies it to all three routes; sign-up made non-confirming.

## Decisions worth a reviewer's eye

### The limiter

- **Reserve synchronously, refund on success.** The obvious design — count on the way
  out, once the status is known — reads the counter, awaits ~100 ms of scrypt, and only
  then writes; fire a burst and every request passes the check before any of them
  records anything, so the limit bounds nothing at exactly the moment it is under
  attack. Reserving up front makes a burst countable; refunding a successful request
  keeps the limiter from punishing the teacher it exists to protect. Net effect: only
  *failed* attempts leave a mark, which is what "bounded guessing" actually means.
- **A rate bound, not a lockout.** On a product whose operator is also one of its two
  teachers, locking an account for a minute after a fat-fingered password is a worse
  failure than the one being prevented. Hence a short window with a small count rather
  than a long one: `WINDOW_MS = 5_000`, `signin 10`, `signup 10`, `recover 5`.
- **`recover` is tightest, deliberately.** 5 per 5 s caps recovery-code guessing at
  ~86k/day against a 2^60 space. That is the sub-issue's stated reason for the whole
  sub-issue, and it is written as a clause so it cannot silently invert.
- **Keyed on `req.ip`, which is the socket** (`trust proxy` is off). Keying on
  `x-forwarded-for` while nothing sets it would make the limiter bypassable with one
  request header — pinned by a clause and confirmed by a mutation.
- **The bucket map is swept.** Without it, one entry per source address accumulates
  forever and an attacker rotating addresses turns the limiter itself into the memory
  leak.
- **In-process is stated as a milestone-only compromise**, in the file's own header:
  it is correct for one instance and wrong for two (N instances = N × the allowance,
  and a restart clears every bucket).
- **The 429 says when.** `Retry-After` header plus `error.retryAfterSeconds`; message
  in Arabic. A bare 429 is indistinguishable from a wall.
- **The warn log carries the route and nothing that identifies a person** — no
  teacherId, no email, no address. A limiter log must not become the record of who was
  trying to sign in.

### Sign-up no longer confirms an address exists

- **201 either way; the duplicate creates no second account** and does not touch the
  real one (same id, same hash, `updatedAt` unmoved — asserted).
- **The id handed back must WORK.** Returning a random 32-hex value would reopen the
  oracle one step further away: `requireTeacher` rejects an id it never recorded, so a
  caller could probe with it and read the answer off a 401. The service therefore mints
  and records a real anonymous row.
- **When the caller offered an id we already know, that id comes back** — a teacher who
  typos into an address that happens to exist keeps the id their exams are stored
  under, instead of being silently moved to an empty workspace.
- **The same scrypt work is burned** on the duplicate path (`burnVerify` twice), so the
  clock does not answer the question the status code no longer does. Same discipline
  the unknown-email sign-in path already uses.
- **The returned `recoveryCode` on a duplicate is a decoy, and it is commented as one.**
  It cannot be otherwise inside this Delta: `consumeRecovery` looks an account up *by
  email*, so a stored code on an email-less row would be equally unusable.

## Clauses written from the start

- **The window EXPIRING**, waiting exactly as long as the service itself said to (read
  from `retryAfterSeconds`, so the test does not hardcode the constant).
- **Concurrent requests AT THE BOUNDARY** — `limit + 6` fired together; exactly `limit`
  may be served. This is the clause that forced the reserve-then-refund design, and the
  one a person describing the feature never writes.
- **A different route is unaffected** while another is throttled.
- **`x-forwarded-for` spoofing buys no fresh bucket.**
- **The subject routes are never touched** (30 rapid reads, and `POST /api/teacher`
  20× — the row-minting surface deliberately left outside this job).
- **Sign-in's indistinguishability survives** — unknown email and wrong password
  byte-identical.
- **The honest cost is pinned too:** a valid sign-in *is* refused while the bucket is
  full. A fixed window per IP is a blunt instrument and a legitimate teacher behind the
  same NAT as an attacker waits it out. Written down so the trade-off is visible here
  rather than discovered in production.

## Two oracle corrections, both declared

1. **The concurrency test assumed a fresh bucket.** The tests before it had already
   spent part of the window, so the burst measured whatever was left (served 5, not
   10). Fixed by *proving* the precondition instead of assuming it: fill the bucket,
   read the service's own retry delay, wait it out, then burst. The clause is unchanged.
2. **Sibling suites now back off on 429.** The limiter is keyed per IP + route and every
   suite in this gate drives one lane from 127.0.0.1 **in parallel**, so be-4 exhausting
   a bucket turned be-2 red for reasons unrelated to roles (reproduced 2 runs in 3).
   `roles-admin` and `admin-surfaces` now retry past a 429 the way a real client would.
   Safe by construction: neither file asserts anything about throttling, so no clause
   can be masked — and the limiter's own behaviour, including that it never touches the
   subject routes, is pinned in `auth-bounds`, where a 429 is the thing under test and
   is never retried. `auth-bounds` also now probes `signup` rather than `signin` for its
   route-independence clause, so that failure cannot be ambiguous between "the limiter
   leaked across routes" and "another suite filled that bucket".

Verified with **four consecutive clean runs** after the change.

## Mutation spot-check (two, both caught)

1. Reserve replaced by count-on-the-way-out (`res.on("finish")` incrementing on
   `status >= 400`) — the exact burst bypass. **Caught by** `concurrent requests AT THE
   BOUNDARY cannot all slip through`: all 16 concurrent requests were served instead of
   10.
2. Key changed to `req.header("x-forwarded-for") ?? req.ip`. **Caught by**
   `spoofing x-forwarded-for does NOT buy a fresh bucket`.

Both reverted; gate green again.

## Reviewer notes

- **Sign-up is now effectively unbounded**, because the limiter only leaves a mark on
  failures and sign-up now always answers 201. That bounds *guessing* — the sub-issue's
  stated intent — but not *row creation*. It is no worse than the existing surface:
  `POST /api/teacher` mints and records a row with no limit at all and is explicitly
  outside this job. Flagged rather than silently accepted.
- **The residual enumeration path**: an attacker can sign up with an address and then
  attempt sign-in with the same password — success means the address was fresh. The
  contract accepts this (it pairs the non-confirming sign-up *with* rate limiting
  rather than claiming to close enumeration outright); the cost is now two rate-limited
  requests and an ambiguous answer instead of one unambiguous 409.
- **No timing assertion** on the duplicate sign-up path. The work is burned in code, but
  timing assertions are flaky under a parallel gate and a flaky clause is worse than a
  documented gap.

## Freeze audit

```
git -C stacks/teacher-be status --short
 M src/routes/auth.ts
?? src/ratelimit.ts
```

## review
**approve.** The limiter survived every attack: `X-Forwarded-For` rotation buys nothing
(socket-keyed, `trust proxy` off), the window genuinely expires, subject routes are never
throttled, and a *successful* login is refunded rather than punished. Both mid-job oracle
corrections were verified by mutation to still bite — they masked nothing.

**Residual enumeration channel, confirmed and accepted:** `signup(E) → recover(E, code)`
distinguishes an existing address, because the decoy code returned on a duplicate does not
verify. That costs two rate-limited requests and an ambiguous answer versus the old
one-request `409`. The contract deliberately *bounds* enumeration rather than claiming to
close it; the deep fix is the fenced bearer→session job.
