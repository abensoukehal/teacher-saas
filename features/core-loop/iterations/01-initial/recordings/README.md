# recordings — DISCOVERY baselines for `core-loop`

Captured 2026-08-07 against the real `claude` CLI, lane slot 1 (`be :9100`).
Referenced by `SEED.md` kit §2; the **lock rule** re-runs each command once at
seal time, and the SEED locks only if every recording still reproduces.

| pair | what it proves |
|---|---|
| `gen1.request.json` → `gen1.json` | 4-exercise composition, علوم تجريبية |
| `gen2.request.json` → `gen2.json` | 3-exercise devoir, شعبة الرياضيات |
| `gen3.request.json` → `gen3-curriculum-gap.json` | **the discriminating test** — a topic `curriculum/` forbids is refused and explained, not generated |
| `refine1.request.json` → `refine1.json` | a refine preserves `id`/`points`/`label` and changes difficulty |

Re-run any of them (stack up on this job's lane first, `tools/dev up -d`):

```bash
curl -s -X POST localhost:9100/api/generate \
  -H 'content-type: application/json' \
  -d @gen1.request.json
```

⚠ Each generation is a real agent run: ~2 minutes and ~$0.44–0.52. A full §2
re-verification is ~7 minutes and ~$1.76.
