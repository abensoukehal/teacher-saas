#!/usr/bin/env python3
"""Baseline recordings for the persistence-gaps SEED (kit §2 / §4).

Proves gaps 1-3 against a RUNNING lane, without spending a generation: the exam
payload is replayed from the `persistence` job's recording (~128 s / ~$0.65 saved
per run — see that job's retro).

    cd project-worktrees/persistence-gaps && ../../tools/dev up -d
    python3 features/persistence-gaps/iterations/01-initial/journal/probe-gaps.py

Re-run at SEED seal time: the SEED locks only if every recording reproduces.
Writes 2 documents to the local `teacher_saas.subjects` — dev only, never a shared store.
"""

import json
import secrets
import sys
import urllib.error
import urllib.request

BASE = "http://localhost:9300"
REC = (
    "../../project/features/persistence/iterations/01-initial/"
    "contracts/rec-exam-subject.2026-08-07.json"
)


def call(method, path, body=None, teacher=None):
    req = urllib.request.Request(BASE + path, method=method)
    req.add_header("content-type", "application/json")
    if teacher:
        req.add_header("x-teacher-id", teacher)
    payload = json.dumps(body).encode() if body is not None else None
    try:
        with urllib.request.urlopen(req, payload) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())


def main(rec_path):
    exam = json.load(open(rec_path))["data"]

    print("### P1  POST /api/teacher — is the id written down anywhere?")
    _, t = call("POST", "/api/teacher")
    tid = t["teacherId"]
    print(f"  201  teacherId={tid}")
    print("  EXPECT: no `teachers` collection exists — the id is minted and forgotten.")

    print("\n### P2  create a subject from the RECORDING (no generation spend)")
    s, sub = call("POST", "/api/subjects", {"subject": exam, "controls": None}, tid)
    sid = sub["id"]
    print(f"  {s}  subjectId={sid}  exercises={[e['id'] for e in sub['subject']['exercises']]}")
    cost = [k for k in sub if "cost" in k.lower()]
    print(f"  EXPECT: no cost field on the stored subject → {cost or 'NONE'}")

    print("\n### P3  GAP 2 — replace ex1, then look for the previous version")
    _, before = call("GET", f"/api/subjects/{sid}", None, tid)
    old = next(e for e in before["subject"]["exercises"] if e["id"] == "ex1")
    print(f"  before: ex1 = {json.dumps(old.get('statement', ''), ensure_ascii=False)[:50]}")
    nxt = dict(old)
    nxt["statement"] = "REPLACED — probe v2"
    s, _ = call("PUT", f"/api/subjects/{sid}/exercises/ex1", {"exercise": nxt}, tid)
    _, after = call("GET", f"/api/subjects/{sid}", None, tid)
    cur = next(e for e in after["subject"]["exercises"] if e["id"] == "ex1")
    print(f"  PUT {s}  after: ex1 = {json.dumps(cur.get('statement',''), ensure_ascii=False)[:50]}")
    print(f"  EXPECT: prior version unrecoverable; no history key → {sorted(after.keys())}")

    print("\n### P4  GAP 1 — a well-formed id the server never issued is ACCEPTED")
    ghost = secrets.token_hex(16)
    s, lst = call("GET", "/api/subjects", None, ghost)
    print(f"  GET /api/subjects as unknown {ghost[:12]}… → {s}, subjects={len(lst['subjects'])}")
    _, mine = call("GET", "/api/subjects", None, tid)
    print(f"  EXPECT: 200 + empty. Real teacher still sees {len(mine['subjects'])} —")
    print("          the document is alive, just unreachable without the id.")

    print("\n### P5  GAP 3 — correlationId is PER-REQUEST, so no cost join exists")
    print("  inspect: cat stacks/teacher-be/run-log.jsonl")
    print("  EXPECT: the create and replaceExercise link lines carry DIFFERENT")
    print("          correlationIds, and the generation's is a third id entirely.")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else REC)
