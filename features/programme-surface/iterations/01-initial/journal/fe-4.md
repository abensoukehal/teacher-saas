# fe-4 — the tracker: nine screens made usable, and the writes where the eyes are

> Implementer journal. Lane slot 9 (fe :10900 → be :9900), both up. `fe-1`, `fe-2` and
> `fe-3` done and verified before this started. The lane was used: the sub-issue's write
> facts are measured claims about `PUT /api/progress/:classId`, and a tracker that makes
> many small writes is the first surface where getting them wrong is expensive.

## Pre-flight — the ground truth reproduces

| probe | expected (sub-issue) | got |
|---|---|---|
| lane s9 up | be + fe answering | `GET :9900/health` → `200`, `GET :10900/` → `200` |
| fe worktree clean | nothing dirty | `git status --short` empty, on `feature/programme-surface` |
| fe-1 + fe-2 + fe-3 suites | green | **105 passed (105)**, `gate PASS`, 1.31 s |
| `markedWeek` required on every PUT | entry-only → 400 | `PUT {rev:0, entry:{week:1,status:"done"}}` → **`400 invalid_request`** «الأسبوع غير صالح» |
| the full write lands | 200, entry stored, rev advances | `PUT {rev:0, markedWeek:6, entry:{week:5,status:"done"}}` → `200`, `rev 0→1`, `completedAt` **server-stamped**, identity fields stamped (`transcriptionRev 5`) |
| a lost CAS | 409, no retry | replaying `rev:0` → **`409 conflict`** «تغيّر تقدّم القسم أثناء الحفظ» |
| lazy week 0 | same key set as a stored doc | `{markedWeek:0, entries:[], rev:0}` + `programme{docKey,edition,totalWeeks:27}` |
| the frozen fixture still IS the live route | byte-identical | `JSON.stringify(fixture) === JSON.stringify(live)` → **true** at `transcriptionRev 5` |
| the corpus after the correction | zero placeholders | **0** `\square`, **26** `\mathbb{…}` — no clause here may expect a box |
| the maths shape | 27 weeks · 103 rows · 189 h | confirmed; rows-per-week `{1:4, 2:1, 3:6, 4:8, 5:3, 6:3, 7:2}` — **two seven-row weeks (20, 23)**, four one-row weeks (1, 11, 21, 27) |
| week 20 | 7 rows, competencies 7, contents 3 | `rows=7 comp=7 cont=3 guid=3`, `unitId=u12`, `hours=7`, `pdfPages=[16]`, **per-row hours `[1×7]` summing exactly to the week's 7** |
| `added-2022` rows | 21 corpus-wide, some in maths | **week 24, four of five rows** — the emphasis tag is pinned against real data |
| runs | 15 from 14 units | 15, with `u12` at week 20, `u11` at 21, `u12` again at 22–23 |
| prototype tracker `Prototype v2.dc.html:214-266` | pinned bar · ministry columns · current-row actions · `showSetHere` · note chip · two footer rules | re-read. `:220` provenance **hardcoded** («وزارة التربية الوطنية · المفتشية العامة · التدرجات السنوية الرسمية · 27 أسبوعًا») · `:226` the accent marker at `expectedPct` · `:231` `paceLine` · `:234` `grid-template-columns: 64px 210px 1fr 80px 170px` — **five columns, one row per week** · `:238` `{{w.content}}` + `{{w.guidance}}` singular, **no competencies column** · `:246` «سلسلة الأسبوع» · `:249` «تمارين دعم على هذا المحور» · `:262-263` the two footer rules |
| the contract clauses that moved | §4 `markedWeek: 0`, §0 hash | re-read as amended: no pacing ≠ no bar and **the hosts decide** — the tracker shows the bar; the view follows `hashchange` (fe-5's, not mine) |

**The measurement that decides the whole screen.** The prototype's five columns are three
week-scoped (week number, unit, status/actions) and two row-scoped (content, hours). The
corpus gives maths **103 rows over 27 weeks, up to seven in one week** — so the row-scoped
pair has to repeat inside a band while the week-scoped three do not. `grid-row: span N` was
ruled out at PLANNING and the reason survives contact: it forces all 27 weeks into one grid,
and the per-week band — which is what carries the current-week highlight and the collapse —
stops existing.

**One SEED detail did not reproduce, and it changes nothing.** SEED §6 records «week 6
(1 row) is 99 px». Week 6 of the maths corpus has **four** rows; the one-row weeks are 1, 11,
21 and 27. The measurement was of a live page, so the label is stale, not the number: a
one-row band is still the floor, week 20 is still the ceiling, and 505 / 99 = 5.1× stands.
Recorded rather than acted on — fe-6 re-measures the real page.

## What was built

| path | what |
|---|---|
| `src/components/Tracker.tsx` (new) | the whole deliverable — a pure `{programme, progress, totalWeeks, onWrite}` component |

`src/lib/*`, `App.tsx`, `App.css`, `WeekCard.tsx` and `ProgrammeBar.tsx` were not touched.
It consumes `deriveRuns`/`trackTotal`/`advanceWrite` (fe-1, via `ProgrammeBar` and directly),
`Statement` (frozen, quirks and all) and `GenerateError`/`teacherMessage` (slice 1's seam).

Decisions worth naming:

1. **A nested sub-grid, and the band is what it protects.** The band is a five-column
   grid; `.tracker__rows` spans the content and hours tracks and re-declares them, so a
   week's per-row hours stack in one column with the week's own total at the foot of it.
   Real week 20 is seven rows of one hour under a seven-hour total — **the arithmetic is
   on the screen instead of in a comment**. `grid-row: span N` would have dissolved the
   per-week band, and the band is what carries the current week, the collapse and the
   row-local 409.
2. **Collapsed means ABSENT, not hidden.** A folded band's `rows[]` are not in the DOM at
   all — `display: none` still costs the layout of 103 rows of KaTeX, which is the whole
   ~8,060 px the collapse exists to avoid. The oracle asserts the ministry's words are
   *nowhere*, not merely invisible.
3. **Disclosure state stores what the teacher SAID, not which weeks are open.** `opened`
   is a per-week override over the derived default «the current week is open». A plain
   set of open weeks has to be rewritten every time the position moves, and whoever
   forgot would leave the new current week folded shut behind the teacher's own «تمّ ✓».
   This way fresh props move the open band on their own, and a teacher can still fold the
   current week away or keep week 3 open.
4. **Scroll is a MOUNT effect, deliberately.** Re-running it on `markedWeek` would mean
   that pressing «تمّ ✓» halfway down the year scrolls the page under the finger that
   pressed it — and that a 409, which moves nothing, would still move the screen. It is
   optional-called (`?.()`) because jsdom has no layout and a component that throws on
   mount there would be broken by its own convenience; one clause mounts it with
   `scrollIntoView` deleted to prove that.
5. **The 409 notice is keyed by week.** Row-local by construction rather than by
   discipline: there is one notice and it renders inside the band whose write lost. It
   **survives the fresh props it asked for** — contract §7 says the losing surface shows
   the fresh state *and* re-asks, so a re-ask cleared by the re-read would clear itself
   every time. Only a new tap clears it.
6. **The header's week count is `totals.weeks`; the write clamps against `totalWeeks`.**
   Contract §3, and this is the first surface where both numbers are on screen at once.
   One clause renders the real maths document (27) at a 30-week bound and asserts the
   header says «27 أسبوعًا» *while the same render's «تمّ ✓» sends 28* — a component that
   collapsed the two cannot pass it. Note this is the mirror of fe-3's reading, and the
   two are consistent: the week card states a *mark against its bound*, the tracker
   states the *document's summary*.
7. **Three registers, and the footer says all three.** The handoff's two rules are
   verbatim; a third was added because two rules can only say «theirs» and «ours», and the
   teacher's «تمّ ✓», their status and their note are neither. Pinned executably: exactly
   one ✎ in the header (hours-to-date), none on any tag, action or note, and none on the
   ministry's rows.
8. **Zero inline style, zero colour.** `ProgrammeBar` needs inline widths because a width
   IS its datum; nothing on this screen is geometry, so every appearance rule is fe-5's
   `App.css` append. That makes «no inline colour» a one-line clause instead of a property
   allow-list.

## Loop

### Iteration 1 — the component and the oracle, together

**72 of 72 clauses green on the first run**, and that is a warning rather than a result:
an oracle written beside the code it grades agrees with it by default. The gate was worth
nothing until the mutation pass, below, and two of its findings were real holes.

### Iteration 2 — the mutation pass (the actual verification)

Thirty-five mutants applied to the shipped component, the whole job gate re-run on each,
the source restored between, and **the driver aborts if a substitution does not apply** —
fe-3 recorded a mutant that edited a doc comment and "survived", which is how a mutation
pass talks itself into a green.

**All 35 died.** Two of them only because a clause was added first (see below).

| # | mutant | clauses killed |
|---|---|---|
| M1 | nothing collapses — the 8,060 px page ships | **6** |
| M35 | folded rows hidden by CSS instead of being absent | **6** |
| M5 | one row per week — the handoff's flat shape | **7** |
| M17 | the mark actions appear on every band | **5** |
| M6 | competencies dropped — the densest ministry field | 3 |
| M2 | the current week mounts folded shut | 3 |
| M8 | the week total dropped — nothing to sum TO | 3 |
| M11 | the note is dropped | 3 |
| M19 | the re-ask becomes a banner over the whole screen | 3 |
| M26 | the provenance line becomes the prototype's literal | 3 |
| M10 | the note goes through KaTeX — the channel crossing | 2 |
| M13 | a passed week with no entry reads «قادم» | 2 |
| M16 | «وصلنا هنا» annotates the week it lands on | 2 |
| M25 | the legend is paraphrased instead of quoted | 2 |
| M34 | a content item becomes a course link | 2 |
| M3 | scroll follows every position change | 1 |
| M4 | no scroll at all | 1 |
| M7 | per-row hours dropped | 1 |
| M9 | guidance joined with «·» | 1 |
| M12 † | an entry outranks the current week | 1 |
| M14 | «تخطٍّ ↷» writes `done` | 1 |
| M15 | the write body rebuilt inline, bypassing the shared builder | 1 |
| M18 | a 409 resubmits by itself | 1 |
| M20 | one write in flight silences the whole year | 1 |
| M21 | the header reports the WRITE BOUND as the summary (§3) | 1 |
| M22 | a hardcoded twenty-seven in the header | 1 |
| M23 † | hours-to-date measured against `totals.hours` | 1 |
| M24 | the emphasis allow-list becomes a deny-list | 1 |
| M27 | the printed pages are dropped | 1 |
| M28 | the ✎ migrates onto the teacher's own «تمّ ✓» | 1 |
| M29 | a pacing sentence returns | 1 |
| M30 | «سلسلة الأسبوع» returns on the current band | 1 |
| M31 | the unit name skips KaTeX | 1 |
| M32 | the skipped tag goes red | 1 |
| M33 | week 1 is current for an unpositioned class | 1 |

† **The two holes the pass found, both plugged before it ran:**

- **M23 would have survived every real programme.** Hours-to-date over `totals.hours`
  instead of Σ `weeks[].hours` is invisible on all five corpus documents, because the two
  agree in every one of them (189/189 on maths). fe-1's `DIVERGENT_TOTALS` fixture exists
  for exactly this and I had not imported it. One clause at 150 weeks-hours against a
  `totals.hours` of 999, and the mutant dies.
- **M12 was a decision nothing asserted.** A current week that also carries an entry is
  real — at the last week the position stays put while the entry records — and the
  component chooses «الأسبوع الحالي» over «منجز» because the actions live on the current
  band. Nothing tested it, so a mutant could reverse a documented decision silently.

**M1/M35/M5/M17 kill the most, and that is the shape of this sub-issue.** M35 is the
interesting one: it fails identically to M1 because «collapsed» here means the rows do not
exist, and the clause that separates them is «none of the ministry's words for this week
appear anywhere», not «the container is hidden».

### Iteration 3 — done-protocol

## Done-protocol

| rung | outcome |
|---|---|
| oracle green ×2 | **PASS** — `179 passed (179)` twice (fe-1's 20 + fe-2's 29 + fe-3's 56 + fe-4's **74**) |
| fe-1 / fe-2 / fe-3 suites still green | **PASS** — they run inside the same gate, untouched; none of their files was opened for writing |
| freeze audit (fe-4 scope) | **clean** — `git status --short -- src/lib src/App.tsx src/App.css src/components/WeekCard.tsx src/components/ProgrammeBar.tsx` empty; the only fe diff in the worktree is `?? src/components/Tracker.tsx` |
| `tools/ci fe --slug programme-surface` from the fe worktree | **gate PASS** |
| promoted fe net `project/tests/fe` | **313 passed (313)**, 21 files, on a quiet host — no vitest/jest/ci process running, load 4.0 and all of it the desktop |
| `tsc -b` / oxlint over `src/` | clean, exit 0 |

## What this sub-issue did not settle

- **The tracker has no class name, so its title is «التدرج السنوي» alone.** The prototype
  writes «التدرج السنوي — {{className}}». The frozen props carry no class, and inventing
  one would be a props-contract change. fe-5 has the name if the header should carry it.
- **The current week outranks its own entry in the status tag.** Documented, and now
  pinned (M12) — but it means that at `W === totalWeeks`, pressing «تمّ ✓» leaves the band
  reading «الأسبوع الحالي» with the entry recorded and invisible. The alternative reads
  «منجز» beside a live «تمّ ✓», which is worse. If the last week needs to say both, that
  is a copy decision with fe-5 in the room, not a component tweak.
- **A note renders on a FOLDED band.** The sub-issue did not say. The disclosure exists to
  compress the ministry's hundred rows; hiding the one line the teacher wrote behind it
  compresses the wrong thing, and a note is bounded at one short line per week. Pinned
  either way, so reversing it is one clause.
- **The third footer rule is invented copy.** The handoff carries two; the brief asked for
  three registers and two rules cannot state three. «ما سجّلتموه أنتم — الموقع
  والملاحظات — بلا علامة: هو قراركم، لا قولنا ولا قول الوزارة». Flagged because it is the
  only string on this screen that is neither the handoff's nor the ministry's.
- **`completedAt` is never rendered.** Contract §0 says the server stamp exists and is not
  shown. It rides in `entries` and nothing reads it.
- **`progress.rev` is declared and never read** — fe-3's ruling, unchanged: the
  compare-and-set token belongs to the write, and the write is fe-1's builder in fe-5's
  hands. A second spelling here is the drift the shared builder exists to prevent.
- **The 409 RE-READ is fe-5's; only the re-ask is mine.** This component shows the fresh
  state it is given. If fe-5's `conflict` branch does not call `getProgress`, the band
  re-asks against a position that never moved — which is a wiring bug this oracle cannot
  see. fe-5's own clause covers it; naming it here so the seam is not assumed.
- **Expansion state is keyed by week number and survives a class switch.** Contract §0
  keeps the view across a switch, so a teacher who opened weeks 3 and 20 on one class sees
  them open on the next. Harmless (the bands exist in every programme) but arguably wrong.
  fe-5 can key the component or reset it on switch; it is a host decision.
- **The sub-grid is unverifiable in jsdom, and that is the point of fe-6.** The structure
  is pinned — per-row hours and the week total in the same container, in the same track —
  but `grid-template-columns: subgrid`, `grid-column: 3 / 5` and `display: contents` on
  `.tracker__row`/`.tracker__sum` are fe-5's rules, and whether the columns actually line
  up in RTL is a measurement only the live page can make.
- **The band head is not clickable — only the week-number button is.** `Statement` returns
  a block element and a block element inside a `<button>` is not phrasing content, so the
  unit name cannot live inside the toggle. Clicking the unit name does nothing today.
  Making the whole head a hit target is a wrapper fe-5 can add; doing it here would have
  meant either invalid markup or a `div` with an `onClick`.
- **The colour scanner is now aimed at this screen too.** `.tracker__band`,
  `.tracker__tag`, `.tracker__flag`, `.tracker__legend`, `.tracker__notice`,
  `.tracker__note`, `.tracker__todate`, `.tracker__provenance` — the moment any of them
  gets a hue in `App.css`, in either theme, this suite fails. The one most likely to
  attract red is `.tracker__tag` on «مُتخطّى»; it must not have it.
- **One SEED figure is stale and was not corrected** — «week 6 (1 row)» (see pre-flight).
  The measurement it supports is unaffected; correcting a locked SEED is not this Delta.

## review

**Verdict: approve.**

Attack log (cross-model, prosecution):
- The 409 drill re-run independently at review time: a curl PUT moved the class behind the tab, «تمّ ✓» on the stale band → **one** notice, inside the losing band only, fresh position re-rendered across bands/bar/rail/hours, band count of PUTs on the wire: exactly one per tap, one GET per conflict (network log verified). My composed mutant removing the notice's row-lock (`notice={notice}` unfiltered) died.
- The last-week edge probed live: «أنهيت» at W=T=27 → 200, position stays, entry records, tag reads «الأسبوع الحالي» — the documented M12 decision behaves as pinned.
- One composed observation, contract-conformant but worth knowing: after a re-position BACKWARDS, entries ahead of the new position keep their «منجز»/«مُتخطّى» tags (probed: marked 5, weeks 7 and 27 read «منجز»). Contract §0's vocabulary conditions entry-status on nothing, and nothing is deleted — truthful, but the first teacher to re-position back will see "done" weeks in their future. A copy question for a later slice, not a defect.
- Duplication debt (with WeekCard): `Field`, `pageLabel`, `isFlagged`, `hoursTo` and the conflict sentence exist twice, near-verbatim. A /distill candidate — extraction is mechanical and the oracles pin behavior, not file layout.
