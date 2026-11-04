import type { Queryable } from '../db/index.js';

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  avatarUrl: string | null;
  totalXp: number;
}

// Learners only; ties share a rank (1, 2, 2, 4 …), earlier sign-ups listed first.
const RANKED = `
  WITH xp AS (
    SELECT u.id, u.name, u.avatar_url, u.created_at,
           (COALESCE((SELECT sum(xp_earned) FROM lesson_completions lc WHERE lc.user_id = u.id), 0)
          + COALESCE((SELECT sum(xp_earned) FROM quiz_attempts qa WHERE qa.user_id = u.id), 0))::int AS total_xp
      FROM users u WHERE u.role = 'learner'
  ), ranked AS (
    SELECT *, rank() OVER (ORDER BY total_xp DESC)::int AS rank FROM xp
  )
  SELECT rank, id AS "userId", name, avatar_url AS "avatarUrl", total_xp AS "totalXp" FROM ranked`;

export async function getLeaderboard(q: Queryable, limit: number): Promise<LeaderboardEntry[]> {
  return q.query<LeaderboardEntry>(`${RANKED} ORDER BY rank, created_at LIMIT $1`, [limit]);
}

export async function getLeaderboardEntry(q: Queryable, userId: string): Promise<LeaderboardEntry | null> {
  const [row] = await q.query<LeaderboardEntry>(`${RANKED} WHERE id = $1`, [userId]);
  return row ?? null;
}
