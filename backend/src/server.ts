import { createApp } from './app.js';
import { config } from './config.js';
import { createDb } from './db/index.js';
import { runMigrations } from './db/migrate.js';
import { seedIfEmpty } from './db/seed.js';

const db = await createDb({ databaseUrl: config.databaseUrl, pgliteDir: config.pgliteDir });

// Migrate + seed on boot so a fresh clone works with a single command.
// Content is seeded only into an empty DB, so admin edits survive restarts.
const applied = await runMigrations(db);
if (applied.length) console.log(`[db] applied migrations: ${applied.join(', ')}`);
if (await seedIfEmpty(db)) console.log('[db] seeded demo content');

const server = createApp(db).listen(config.port, () => {
  console.log(`[api] OctoLearn listening on http://localhost:${config.port} (db: ${db.driver})`);
});

async function shutdown() {
  server.close();
  await db.close();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
