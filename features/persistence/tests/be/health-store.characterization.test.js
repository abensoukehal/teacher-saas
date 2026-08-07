/**
 * be-1 — the datastore is connected, visible on /health, and its failure is
 * classified rather than collapsed into a 500.
 *
 * BLACK-BOX by necessity and by preference (stacks/be.md → "Test harness"):
 * be's dist/ is ESM and jest's CJS runner cannot import it without a flag that
 * lives in the shared engine config. So this drives the real lane over HTTP —
 * which is what WF-44 asks for anyway.
 *
 * PRECONDITION: `tools/dev up -d` from the job worktree (be on :9200). If it is
 * not reachable the suite FAILS. A gate that cannot verify is red, not green.
 */
const { spawn } = require("node:child_process");
const path = require("node:path");

const BE = "http://localhost:9200";
const ROOT = process.env.CHAR_ROOTDIR;

async function getJson(url, init) {
  const res = await fetch(url, init);
  return { status: res.status, body: await res.json() };
}

beforeAll(async () => {
  try {
    await fetch(`${BE}/health`);
  } catch (err) {
    throw new Error(
      `be is not reachable at ${BE}. Run 'tools/dev up -d' from the job worktree first. (${err})`,
    );
  }
});

describe("positive — the store is connected and visible", () => {
  test("/health reports the store, ok and named", async () => {
    const { status, body } = await getJson(`${BE}/health`);
    expect(status).toBe(200);
    expect(body.store).toBeDefined();
    expect(body.store.ok).toBe(true);
    expect(body.store.db).toBe("teacher_saas");
    expect(body.status).toBe("ok");
  });

  test("boot logs store.connected with the db name", async () => {
    // The lane log is the observability assertion for this sub-issue.
    const fs = require("node:fs");
    const log = "/tmp/teacher-backend.s2.log";
    expect(fs.existsSync(log)).toBe(true);
    const text = fs.readFileSync(log, "utf8");
    expect(text).toContain("store.connected");
    expect(text).toContain("teacher_saas");
  });
});

describe("positive — a dead store degrades honestly", () => {
  let child;
  const PORT = 9299;

  beforeAll(async () => {
    // A SECOND instance, pointed at a port nothing listens on. The running lane
    // is left alone so sibling suites are unaffected.
    child = spawn(process.execPath, [path.join(ROOT, "dist/index.js")], {
      env: {
        ...process.env,
        PORT: String(PORT),
        MONGO_URL: "mongodb://127.0.0.1:1",
        RUN_LOG: "",
      },
      stdio: "ignore",
    });
    for (let i = 0; i < 60; i++) {
      try {
        await fetch(`http://localhost:${PORT}/health`);
        return;
      } catch {
        await new Promise((r) => setTimeout(r, 250));
      }
    }
    throw new Error("degraded probe instance never came up");
  }, 30000);

  afterAll(() => {
    if (child) child.kill("SIGTERM");
  });

  test("store.ok is false and the service does NOT claim to be ok", async () => {
    const { status, body } = await getJson(`http://localhost:${PORT}/health`);
    // Still 200: /health is a REPORT. tools/dev's svc_wait only requires 2xx, and
    // a health endpoint that 5xx's when a dependency blinks makes the lane
    // unbootable for no gain.
    expect(status).toBe(200);
    expect(body.store.ok).toBe(false);
    expect(body.status).not.toBe("ok");
  }, 20000);
});

describe("negative — the frozen perimeter is untouched", () => {
  test("/health's claude sub-object is bit-stable", async () => {
    const { body } = await getJson(`${BE}/health`);
    expect(Object.keys(body.claude).sort()).toEqual(
      ["active", "detail", "max", "ok", "queued"].sort(),
    );
    expect(typeof body.claude.ok).toBe("boolean");
    expect(typeof body.claude.detail).toBe("string");
    expect(typeof body.claude.active).toBe("number");
    expect(typeof body.claude.queued).toBe("number");
    expect(typeof body.claude.max).toBe("number");
  });

  test("/health keeps its existing top-level fields", async () => {
    const { body } = await getJson(`${BE}/health`);
    expect(body.service).toBe("teacher-be");
    expect(typeof body.env).toBe("string");
  });

  test("/api/skills still lists exactly the two capabilities", async () => {
    const { status, body } = await getJson(`${BE}/api/skills`);
    expect(status).toBe(200);
    expect(body.skills.map((s) => s.name).sort()).toEqual([
      "exam-subject",
      "refine-exercise",
    ]);
  });

  test("/api/generate still rejects an unknown skill with the SAME envelope", async () => {
    // Cheap frozen-perimeter pin: exercises the route's validation without
    // spending 128s and $0.65 on a real agent loop (stacks/be.md warns about this).
    const { status, body } = await getJson(`${BE}/api/generate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ skill: "definitely-not-a-skill", input: "x" }),
    });
    expect(status).toBe(400);
    expect(body.error.type).toBe("invalid_request");
  });
});
