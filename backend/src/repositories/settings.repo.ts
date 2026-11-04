import type { Queryable } from '../db/index.js';

export async function getSettings(q: Queryable, prefix: string): Promise<Record<string, string>> {
  const rows = await q.query<{ key: string; value: string }>(
    'SELECT key, value FROM app_settings WHERE key LIKE $1',
    [`${prefix}%`],
  );
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

/** Upserts the given keys; a null value deletes the key. */
export async function setSettings(q: Queryable, values: Record<string, string | null>): Promise<void> {
  for (const [key, value] of Object.entries(values)) {
    if (value === null) {
      await q.query('DELETE FROM app_settings WHERE key = $1', [key]);
    } else {
      await q.query(
        `INSERT INTO app_settings (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
        [key, value],
      );
    }
  }
}
