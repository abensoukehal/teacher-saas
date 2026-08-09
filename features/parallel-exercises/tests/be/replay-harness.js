/**
 * Boots a REAL teacher-be process wired to the replay binary.
 *
 * These suites are black-box like every other characterization suite here, but they may
 * not use the lane: `POST /api/exams` runs a plan plus N exercise generations, and on the
 * lane that is ~4 real agent loops, minutes of wall clock and real subscription quota per
 * gate run. So the suite starts its own instance with `CLAUDE_BIN` pointed at
 * `fake-claude.mjs` (see that file for why the binary, and not a module stub, is the seam).
 *
 * Everything else is real: the real Express app, the real routes, the real runner, the
 * real Mongo (`teacher_saas`, the same store the lane uses — planted documents are cleaned
 * up by the suite that planted them).
 *
 * The port is ephemeral, so this never collides with a lane and never needs one.
 */
const { spawn } = require("node:child_process");
const { createServer } = require("node:net");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const REPO = process.env.CHAR_ROOTDIR;

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

async function waitForHealth(url, deadlineMs) {
  const until = Date.now() + deadlineMs;
  for (;;) {
    try {
      const res = await fetch(`${url}/health`);
      if (res.ok) return await res.json();
    } catch {
      /* not listening yet */
    }
    if (Date.now() > until) throw new Error(`teacher-be did not come up at ${url}`);
    await new Promise((r) => setTimeout(r, 150));
  }
}

/**
 * @param {{mode?: string, delayMs?: number, maxConcurrent?: number}} opts
 * @returns {Promise<{url: string, stop: () => Promise<void>, logs: () => string}>}
 */
async function startReplayServer(opts = {}) {
  if (!REPO) throw new Error("CHAR_ROOTDIR is not set — run this via tools/ci, not jest directly");
  const port = await freePort();
  const url = `http://127.0.0.1:${port}`;
  const state = fs.mkdtempSync(path.join(os.tmpdir(), "fake-claude-"));
  let buffer = "";

  const child = spawn("npx", ["tsx", "src/index.ts"], {
    cwd: REPO,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      PORT: String(port),
      HOST: "127.0.0.1",
      NODE_ENV: "test",
      // THE POINT OF THE HARNESS: no real generation can happen from here.
      CLAUDE_BIN: path.join(__dirname, "fake-claude.mjs"),
      CLAUDE_MAX_CONCURRENT: String(opts.maxConcurrent ?? 3),
      ...(opts.fanoutBudget === undefined
        ? {}
        : { CLAUDE_FANOUT_BUDGET: String(opts.fanoutBudget) }),
      CLAUDE_TIMEOUT_MS: "30000",
      FAKE_CLAUDE_FIXTURES: path.join(__dirname, "fixtures"),
      FAKE_CLAUDE_MODE: opts.mode ?? "valid",
      FAKE_CLAUDE_DELAY_MS: String(opts.delayMs ?? 250),
      FAKE_CLAUDE_STATE: state,
      // Telemetry off: this instance must not append to the lane's run log.
      RUN_LOG: "",
    },
  });

  child.stdout.on("data", (c) => (buffer += c.toString()));
  child.stderr.on("data", (c) => (buffer += c.toString()));

  try {
    await waitForHealth(url, 40_000);
  } catch (err) {
    child.kill("SIGKILL");
    throw new Error(`${err.message}\n--- server output ---\n${buffer}`);
  }

  return {
    url,
    logs: () => buffer,
    /** How many times the CLI was spawned for one exercise — i.e. attempts, not outcomes. */
    attempts: (exerciseId) => {
      try {
        return fs
          .readFileSync(path.join(state, `exercise-one-${exerciseId}.log`), "utf8")
          .split("\n")
          .filter(Boolean).length;
      } catch {
        return 0;
      }
    },
    stop: () =>
      new Promise((resolve) => {
        if (child.exitCode !== null) return resolve();
        child.once("exit", () => resolve());
        child.kill("SIGTERM");
        setTimeout(() => child.kill("SIGKILL"), 3000).unref?.();
      }),
  };
}

/** Small JSON client, same shape the other suites use. */
function client(base) {
  return async function call(method, p, { body, teacher, headers } = {}) {
    const res = await fetch(`${base}${p}`, {
      method,
      headers: {
        "content-type": "application/json",
        ...(teacher ? { "x-teacher-id": teacher } : {}),
        ...headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await res.text();
    let parsed = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = { raw: text };
    }
    return { status: res.status, body: parsed };
  };
}

module.exports = { startReplayServer, client, freePort };
