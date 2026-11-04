import type { Queryable } from '../db/index.js';
import type { Role } from '../http/auth.js';

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  role: Role;
  createdAt: Date;
}

const USER_COLUMNS = `id, email, name, avatar_url AS "avatarUrl", role, created_at AS "createdAt"`;

export async function findUserById(q: Queryable, id: string): Promise<User | null> {
  const [row] = await q.query<User>(`SELECT ${USER_COLUMNS} FROM users WHERE id = $1`, [id]);
  return row ?? null;
}

export async function findUserWithHashByEmail(
  q: Queryable,
  email: string,
): Promise<(User & { passwordHash: string }) | null> {
  const [row] = await q.query<User & { passwordHash: string }>(
    `SELECT ${USER_COLUMNS}, password_hash AS "passwordHash" FROM users WHERE email = $1`,
    [email],
  );
  return row ?? null;
}

/** Returns null when the email is already taken. */
export async function insertUser(
  q: Queryable,
  data: { email: string; name: string; passwordHash: string },
): Promise<User | null> {
  const [row] = await q.query<User>(
    `INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3)
     ON CONFLICT (email) DO NOTHING
     RETURNING ${USER_COLUMNS}`,
    [data.email, data.name, data.passwordHash],
  );
  return row ?? null;
}

export async function updateUser(
  q: Queryable,
  id: string,
  patch: { name?: string; avatarUrl?: string | null },
): Promise<User | null> {
  const [row] = await q.query<User>(
    `UPDATE users SET
       name = COALESCE($2, name),
       avatar_url = CASE WHEN $3::boolean THEN $4 ELSE avatar_url END
     WHERE id = $1
     RETURNING ${USER_COLUMNS}`,
    [id, patch.name ?? null, patch.avatarUrl !== undefined, patch.avatarUrl ?? null],
  );
  return row ?? null;
}

export async function deleteUser(q: Queryable, id: string): Promise<boolean> {
  return (await q.query('DELETE FROM users WHERE id = $1 RETURNING id', [id])).length > 0;
}

export interface UserListRow extends User {
  totalXp: number;
  completedLessons: number;
  passedQuizzes: number;
  lastActivityAt: Date | null;
}

export async function listUsersWithProgress(q: Queryable): Promise<UserListRow[]> {
  return q.query<UserListRow>(
    `SELECT u.id, u.email, u.name, u.avatar_url AS "avatarUrl", u.role, u.created_at AS "createdAt",
            (COALESCE(lc.xp, 0) + COALESCE(qa.xp, 0))::int AS "totalXp",
            COALESCE(lc.cnt, 0)::int AS "completedLessons",
            COALESCE(qa.passed, 0)::int AS "passedQuizzes",
            GREATEST(lc.last_at, qa.last_at) AS "lastActivityAt"
       FROM users u
       LEFT JOIN (SELECT user_id, sum(xp_earned) xp, count(*) cnt, max(completed_at) last_at
                    FROM lesson_completions GROUP BY user_id) lc ON lc.user_id = u.id
       LEFT JOIN (SELECT user_id, sum(xp_earned) xp, count(DISTINCT quiz_id) FILTER (WHERE passed) passed,
                         max(created_at) last_at
                    FROM quiz_attempts GROUP BY user_id) qa ON qa.user_id = u.id
      ORDER BY "totalXp" DESC, u.created_at`,
  );
}
