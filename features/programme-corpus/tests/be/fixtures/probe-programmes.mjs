#!/usr/bin/env node
/**
 * ESM probe for `dist/store/programmes.js`.
 *
 * Why this exists: the characterization suites are CommonJS under jest, and the be repo is
 * `"type": "module"` — jest's CJS runtime cannot `require()` an ESM build (verified: it
 * reports "Cannot use import statement outside a module"). So the suite reaches the store
 * module the same way the real callers do — as a child process — and asserts on what comes
 * back. Mongo itself is driven from the suite with the driver directly; only the module's
 * own functions come through here.
 *
 *   echo '<payload json>' | PROBE_MODULE=<abs path to dist/store/programmes.js> \
 *     node probe-programmes.mjs <op>
 *
 * stdout is exactly one JSON line: {"ok":true,"value":…} or {"ok":false,"error":{…}}.
 * A missing build is a HARD failure with that message — never a skip (a gate that
 * verified nothing is not a pass).
 */
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const op = process.argv[2];
const modulePath = process.env.PROBE_MODULE;

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

if (!op) fail("probe-programmes.mjs: an op is required");
if (!modulePath) fail("probe-programmes.mjs: PROBE_MODULE must point at dist/store/programmes.js");
if (!existsSync(modulePath)) {
  fail(
    `probe-programmes.mjs: ${modulePath} does not exist — run \`npm run build\` in the be ` +
      `repo before gating (the scripts and this probe both import the BUILT module).`,
  );
}

const payload = JSON.parse(readFileSync(0, "utf8") || "{}");
const M = await import(modulePath);

function emit(value) {
  process.stdout.write(JSON.stringify({ ok: true, value }) + "\n");
}

function emitError(err) {
  process.stdout.write(
    JSON.stringify({
      ok: false,
      error: {
        name: err?.name ?? "Error",
        message: String(err?.message ?? err),
        problems: err?.problems ?? null,
        storedHash: err?.storedHash ?? null,
        recomputedHash: err?.recomputedHash ?? null,
      },
    }) + "\n",
  );
}

/**
 * `mongodb` is resolved from the BE checkout, not from here: this probe lives in the
 * project repo's test tree, which has no node_modules of its own (WF-53 — suites are
 * versioned beside the job, never inside the repo).
 */
function repoRequire() {
  // dist/store/programmes.js → the repo root two levels up from dist/.
  const repoRoot = path.resolve(path.dirname(modulePath), "..", "..");
  return createRequire(path.join(repoRoot, "package.json"));
}

async function withDb(fn) {
  const { MongoClient } = repoRequire()("mongodb");
  const client = new MongoClient(payload.mongoUrl ?? "mongodb://127.0.0.1:27017");
  await client.connect();
  try {
    return await fn(client.db(payload.dbName));
  } finally {
    await client.close();
  }
}

try {
  switch (op) {
    case "validateProgrammeLine":
      emit(M.validateProgrammeLine(payload.line, payload.lineNo ?? 1));
      break;

    case "validateWeekLine":
      emit(M.validateWeekLine(payload.line, payload.lineNo, payload.ctx));
      break;

    case "assemble":
      emit(M.assembleDoc(payload.lines));
      break;

    case "hash":
      emit(M.canonicalContentHash(payload.doc));
      break;

    case "differences":
      emit(M.fieldDifferences(payload.prev, payload.next));
      break;

    case "ensureIndexes":
      emit(await withDb(async (db) => {
        await M.ensureProgrammeIndexes(db);
        return true;
      }));
      break;

    case "upsert":
      emit(
        await withDb((db) => M.upsertProgramme(db, M.assembleDoc(payload.lines), payload.opts ?? {})),
      );
      break;

    case "get":
      emit(
        await withDb(async (db) => {
          const doc = await M.getProgramme(db, payload.docKey, payload.opts ?? {});
          return doc === null ? null : JSON.parse(JSON.stringify(doc));
        }),
      );
      break;

    case "constants":
      emit({
        EMPHASIS_VALUES: M.EMPHASIS_VALUES,
        CONTENT_HASH_EXCLUDES: M.CONTENT_HASH_EXCLUDES,
        WEEKS_PER_YEAR: M.WEEKS_PER_YEAR,
        PROGRAMMES: M.PROGRAMMES,
        PROGRAMME_REVISIONS: M.PROGRAMME_REVISIONS,
      });
      break;

    default:
      fail(`probe-programmes.mjs: unknown op ${op}`);
  }
} catch (err) {
  emitError(err);
}
