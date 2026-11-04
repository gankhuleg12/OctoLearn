import { config } from '../config.js';
import { createDb } from './index.js';
import { runMigrations } from './migrate.js';
import { seed } from './seed.js';

const command = process.argv[2];

const db = await createDb({ databaseUrl: config.databaseUrl, pgliteDir: config.pgliteDir });
console.log(`[db] driver: ${db.driver}`);

try {
  switch (command) {
    case 'migrate': {
      const applied = await runMigrations(db);
      console.log(applied.length ? `[db] applied: ${applied.join(', ')}` : '[db] up to date');
      break;
    }
    case 'seed':
      await runMigrations(db);
      await seed(db);
      console.log('[db] seeded');
      break;
    case 'reset':
      await db.exec('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
      await runMigrations(db);
      await seed(db);
      console.log('[db] reset + seeded');
      break;
    default:
      console.error('Usage: tsx src/db/cli.ts <migrate|seed|reset>');
      process.exitCode = 1;
  }
} finally {
  await db.close();
}
