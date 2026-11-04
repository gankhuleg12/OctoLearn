import type { Queryable } from '../db/index.js';
import type { UserProgressSets } from '../domain/progression.js';

export async function getProgressSets(q: Queryable, userId: string): Promise<UserProgressSets> {
  const [lessons, quizzes] = await Promise.all([
    q.query<{ lessonId: string }>('SELECT lesson_id AS "lessonId" FROM lesson_completions WHERE user_id = $1', [
      userId,
    ]),
    q.query<{ quizId: string }>(
      'SELECT DISTINCT quiz_id AS "quizId" FROM quiz_attempts WHERE user_id = $1 AND passed',
      [userId],
    ),
  ]);
  return {
    completedLessonIds: new Set(lessons.map((r) => r.lessonId)),
    passedQuizIds: new Set(quizzes.map((r) => r.quizId)),
  };
}

/** Serializes progress writes for one user (prevents double XP on concurrent requests). */
export async function lockUser(q: Queryable, userId: string): Promise<void> {
  await q.query('SELECT 1 FROM users WHERE id = $1 FOR UPDATE', [userId]);
}

/** Returns the XP actually awarded, or null when the lesson was already completed. */
export async function insertLessonCompletion(
  q: Queryable,
  userId: string,
  lessonId: string,
  xp: number,
): Promise<number | null> {
  const rows = await q.query<{ xp: number }>(
    `INSERT INTO lesson_completions (user_id, lesson_id, xp_earned) VALUES ($1, $2, $3)
     ON CONFLICT (user_id, lesson_id) DO NOTHING
     RETURNING xp_earned AS xp`,
    [userId, lessonId, xp],
  );
  return rows[0]?.xp ?? null;
}

export interface NewQuizAttempt {
  userId: string;
  quizId: string;
  correctCount: number;
  totalCount: number;
  scorePercent: number;
  passed: boolean;
  xpEarned: number;
  answers: unknown;
}

export async function insertQuizAttempt(q: Queryable, a: NewQuizAttempt): Promise<number> {
  const [row] = await q.query<{ id: number }>(
    `INSERT INTO quiz_attempts
       (user_id, quiz_id, correct_count, total_count, score_percent, passed, xp_earned, answers)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
     RETURNING id`,
    [a.userId, a.quizId, a.correctCount, a.totalCount, a.scorePercent, a.passed, a.xpEarned, JSON.stringify(a.answers)],
  );
  return Number(row!.id);
}

export async function getBestQuizScores(q: Queryable, userId: string) {
  return q.query<{ quizId: string; bestScore: number; attempts: number }>(
    `SELECT quiz_id AS "quizId", max(score_percent)::int AS "bestScore", count(*)::int AS attempts
       FROM quiz_attempts WHERE user_id = $1 GROUP BY quiz_id`,
    [userId],
  );
}

export async function getTotalXp(q: Queryable, userId: string): Promise<number> {
  const [row] = await q.query<{ xp: number }>(
    `SELECT (COALESCE((SELECT sum(xp_earned) FROM lesson_completions WHERE user_id = $1), 0)
           + COALESCE((SELECT sum(xp_earned) FROM quiz_attempts WHERE user_id = $1), 0))::int AS xp`,
    [userId],
  );
  return row?.xp ?? 0;
}

/** Activity events (lesson completions + quiz attempts) since `since`. */
export async function getActivitySince(q: Queryable, userId: string, since: Date) {
  return q.query<{ at: Date; xp: number }>(
    `SELECT completed_at AS at, xp_earned AS xp FROM lesson_completions
      WHERE user_id = $1 AND completed_at >= $2
     UNION ALL
     SELECT created_at, xp_earned FROM quiz_attempts
      WHERE user_id = $1 AND created_at >= $2`,
    [userId, since],
  );
}

export async function deleteProgress(q: Queryable, userId: string): Promise<void> {
  await q.query('DELETE FROM lesson_completions WHERE user_id = $1', [userId]);
  await q.query('DELETE FROM quiz_attempts WHERE user_id = $1', [userId]);
}
