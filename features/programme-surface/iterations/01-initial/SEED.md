# SEED — enriched product blueprint (DISCOVERY output)

> **Phase:** DISCOVERY. **Input:** `00-brief.md` (your raw, vague brief). **Output:**
> this file. **Consumed by:** PLANNING (it turns SEED into the specs tree).
>
> DISCOVERY is where I take your raw brief and **enrich it** via EXPLORE —
> reading the codebase and the documentation, and (per *investigate-by-running*)
> exercising the real code headless to record how it actually behaves today. The
> result is the **locked product spec**: what we're building and why, agreed
> before any technical planning starts. Product-level only — no
> sub-issue/implementation detail yet (that's PLANNING). For a bugfix/hotfix,
> DISCOVERY runs in troubleshoot mode and this SEED carries the proven root
> cause — there is no separate RCA.md.
>
> Locked = the problem/solution/scope below are agreed and stop moving. PLANNING
> and everything downstream derive from this; changing it means re-running DISCOVERY.

## Anchor
- **Job kind:** <feature | bugfix | hotfix | exploration | eval>
- **Upstream:** <source_url from 00-brief — the tracker Project/Issue>

## Problem (enriched)
<!-- The real problem, sharpened past the raw brief. Who feels it, when, how
     often, cost of leaving it. Cite what in the codebase/docs confirms it. -->

## Current reality — the planning kit (observed, not assumed)

> PLANNING is pure assembly: it partitions this kit into six-slot sub-issues without
> investigating anything itself. Every artifact below is EXPLORE output — evidence,
> not narrative. A gap here becomes a stop-and-ask downstream: fill it now.

### 1 · Acting-surface map (where we'll act)
<!-- Per stack: exact file:line, its role, and the change type. This is what PLANNING
     partitions into sub-issues; each Delta slot (target files + freeze) is cut from it. -->
| Stack | Path (`repo/path:LINE`) | Role | Change |
|---|---|---|---|
| | | | new / modify / read-only |

### 2 · Baseline recordings (surface → re-run command → recorded shape)
<!-- One row per acting surface. Becomes each sub-issue's Ground-truth slot verbatim;
     the command is what the IMPLEMENT pre-flight re-runs. Record on the runtime that
     matters (WF-44); real production seeds for prompt/LLM surfaces (WF-49).
     LOCK RULE: the seal step re-runs every command once — the SEED locks only when
     every recording reproduces NOW (stale → re-record). -->
| Surface | Re-run command | Recorded shape (or pointer) | Captured (date · env) |
|---|---|---|---|
| | `curl …` / `obs trace <id>` / LangSmith run | | |

### 3 · Perimeter consumers (recorded)
<!-- Every existing consumer of a touched surface + its recorded current shape.
     Feeds the negative oracle ("shapes bit-stable") — the characterization pins. -->
| Consumer | Surface it uses | Recorded shape (or pointer) |
|---|---|---|

### 4 · End-to-end trace (one real action, correlated)
<!-- One action traced FE→BE→AI→data (`tools/obs trace <id>`), saved/pasted. Gives
     PLANNING the boundary crossings (→ contracts + wire shapes), the ordering
     skeleton (→ depends_on), and the sequence for contracts/flows.md. -->

### 5 · Observability baseline
<!-- What's visible TODAY in the acting area (logs/traces/metrics) vs blind spots.
     Every sub-issue's obs assertion must reference something visible; blind spots
     become the FIRST sub-issues (a loop can't verify what it can't see). -->
- Visible today:
- Blind spots:

### 6 · Unknowns ledger (no naked unknowns)
<!-- Every unknown, dispositioned. An undispositioned unknown is a scheduled
     stop-and-ask inside PLANNING/IMPLEMENT — not allowed past the lock.
     Budget rule: an unknown that resists disposition within the phase's budget is
     PARKED explicitly — never ground down. -->
| Unknown | Disposition | Evidence / note |
|---|---|---|
| | resolved / parked (`blocked_on: …`) / accepted-risk | |

### 7 · Sweep statement (the edge of the evidence)
<!-- Which subsystems/planes were investigated, and which deliberately were NOT (and
     why). PLANNING can't distinguish "not relevant" from "not looked at" without this —
     the unswept edge is exactly where freeze boundaries and stop-and-asks must be tight. -->
- Swept:
- Not swept (why):

## Solution direction (locked, product-level)
<!-- The agreed approach in product terms. Alternatives considered, one line each
     on why-not. NO sub-issue/impl detail — that's PLANNING. -->

## User value (company-facing framing)
<!-- One or two sentences in product language — seeds the company Linear
     milestone/issue titles (/linear-sync). -->

## Scope & boundaries
- **In:**
- **Out (non-goals):**
- **Stacks likely touched:** <fe · be · ai · infra>  (firmed up in PLANNING)

## Risks & backward-compat flags
<!-- Anything that could break, and the compat posture (additive/versioned).
     Consumers live in kit §3 (recorded); unknowns live in kit §6 (dispositioned). -->

## Investigation journal (hypotheses, not a reading list)
<!-- The reasoning, auditable — one entry per hypothesis, starting with the BRIEF'S OWN
     FRAMING (tested before anything else; the brief is a claim, not a fact). Carry two
     competing models until evidence kills one; every why-not cites its killing evidence.
     Format:
     - H1 <hypothesis> → test: <the discriminating run/read> → result: <what it showed>
       → belief: <kept / killed / refined> -->

## Ready-for-PLANNING checklist
- [ ] the brief's framing was tested, not assumed (journal H1)
- [ ] problem + solution direction agreed and **locked**; why-nots cite killing evidence
- [ ] acting-surface map present (kit §1); scope in/out stated
- [ ] every acting surface has a baseline recording with its re-run command (kit §2)
- [ ] perimeter consumers recorded (kit §3); backward-compat posture flagged
- [ ] one correlated end-to-end trace saved (kit §4)
- [ ] observability baseline stated — blind spots called out (kit §5)
- [ ] **no undispositioned unknowns** (kit §6)
- [ ] sweep statement present — the unswept edge named (kit §7)
- [ ] **lock re-verification: every §2 recording reproduced at seal time**
