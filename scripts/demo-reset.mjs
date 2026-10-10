// npm run demo:reset: removes every agent proposal and published rule version from the database
// (data/kaagaz.db, or KAAGAZ_DB_PATH from .env.local), so only the 3 built-in rule packs remain.
// Writes go through src/server/store.ts (the only database writer), in one transaction.
// A running server picks up the reset on its next request (syncRegistry rebuilds the registry).
// Node 22.18+/24 runs the TypeScript store module directly (type stripping). Prints no secrets.
import { existsSync } from "node:fs";
import { RuleStore, defaultDbPath } from "../src/server/store.ts";

const path = defaultDbPath();
if (path !== ":memory:" && !existsSync(path)) {
  console.log(`demo:reset: no database at ${path}; nothing to reset (built-in rule packs only).`);
  process.exit(0);
}

const store = new RuleStore(path);
try {
  const removed = store.resetAll();
  console.log(`demo:reset: removed ${removed} rule version(s) from ${path}.`);
  console.log("Only the built-in schemes remain: pm-kisan, orunodoi-3, nsap-widow.");
} finally {
  store.close();
}
