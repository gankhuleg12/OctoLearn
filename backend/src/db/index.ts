import { mkdir } from 'node:fs/promises';
import pg from 'pg';
import type { PGlite } from '@electric-sql/pglite';

/** Minimal query surface shared by the real Postgres pool and embedded PGlite. */
export interface Queryable {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
}

export interface Db extends Queryable {
  /** Runs `fn` inside a transaction; rolls back if it throws. */
  tx<T>(fn: (q: Queryable) => Promise<T>): Promise<T>;
  /** Executes a multi-statement SQL script (migrations). */
  exec(sql: string): Promise<void>;
  close(): Promise<void>;
  readonly driver: 'pg' | 'pglite';
}

function createPgDb(connectionString: string): Db {
  // Return int8 (e.g. count(*)) as JS numbers — our values are far below 2^53.
  pg.types.setTypeParser(pg.types.builtins.INT8, (v) => Number(v));
  const pool = new pg.Pool({ connectionString, max: 10 });

  return {
    driver: 'pg',
    async query(sql, params) {
      const res = await pool.query(sql, params as unknown[]);
      return res.rows;
    },
    async tx(fn) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await fn({
          async query(sql, params) {
            const res = await client.query(sql, params as unknown[]);
            return res.rows;
          },
        });
        await client.query('COMMIT');
        return result;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    },
    async exec(sql) {
      await pool.query(sql);
    },
    async close() {
      await pool.end();
    },
  };
}

async function createPgliteDb(dataDir?: string): Promise<Db> {
  const { PGlite } = await import('@electric-sql/pglite');
  if (dataDir) await mkdir(dataDir, { recursive: true });
  const db: PGlite = dataDir ? await PGlite.create(dataDir) : await PGlite.create();

  return {
    driver: 'pglite',
    async query(sql, params) {
      const res = await db.query(sql, params as unknown[]);
      return res.rows as never[];
    },
    async tx(fn) {
      return db.transaction((t) =>
        fn({
          async query(sql, params) {
            const res = await t.query(sql, params as unknown[]);
            return res.rows as never[];
          },
        }),
      );
    },
    async exec(sql) {
      await db.exec(sql);
    },
    async close() {
      await db.close();
    },
  };
}

export interface CreateDbOptions {
  databaseUrl?: string;
  /** PGlite data directory; omit for an in-memory database (tests). */
  pgliteDir?: string;
}

export async function createDb(opts: CreateDbOptions): Promise<Db> {
  if (opts.databaseUrl) return createPgDb(opts.databaseUrl);
  return createPgliteDb(opts.pgliteDir);
}
