import type { Queryable } from '../db/index.js';

export interface Overview {
  learners: number;
  newLearners7d: number;
  activeLearners7d: number;
  lessonCompletions: number;
  quizAttempts: number;
  /** % of quiz attempts that passed; null when there are none. */
  quizPassRate: number | null;
  units: number;
  publishedUnits: number;
  lessons: number;
  quizzes: number;
}

export async function getOverview(q: Queryable): Promise<Overview> {
  const [row] = await q.query<Overview>(
    `SELECT
       (SELECT count(*) FROM users WHERE role = 'learner')::int AS "learners",
       (SELECT count(*) FROM users WHERE role = 'learner' AND created_at >= now() - interval '7 days')::int
         AS "newLearners7d",
       (SELECT count(DISTINCT user_id) FROM (
          SELECT user_id, completed_at AS at FROM lesson_completions
          UNION ALL SELECT user_id, created_at FROM quiz_attempts
        ) a WHERE at >= now() - interval '7 days')::int AS "activeLearners7d",
       (SELECT count(*) FROM lesson_completions)::int AS "lessonCompletions",
       (SELECT count(*) FROM quiz_attempts)::int AS "quizAttempts",
       (SELECT round(100.0 * avg(passed::int))::int FROM quiz_attempts) AS "quizPassRate",
       (SELECT count(*) FROM units)::int AS "units",
       (SELECT count(*) FROM units WHERE published)::int AS "publishedUnits",
       (SELECT count(*) FROM lessons)::int AS "lessons",
       (SELECT count(*) FROM quizzes)::int AS "quizzes"`,
  );
  return row!;
}

export async function getRecentQuizAttempts(q: Queryable, userId: string, limit = 20) {
  return q.query<{
    id: number;
    quizId: string;
    quizTitle: string;
    unitTitle: string;
    correctCount: number;
    totalCount: number;
    scorePercent: number;
    passed: boolean;
    xpEarned: number;
    createdAt: Date;
  }>(
    `SELECT a.id, a.quiz_id AS "quizId", z.title AS "quizTitle", u.title AS "unitTitle",
            a.correct_count AS "correctCount", a.total_count AS "totalCount", a.score_percent AS "scorePercent",
            a.passed, a.xp_earned AS "xpEarned", a.created_at AS "createdAt"
       FROM quiz_attempts a JOIN quizzes z ON z.id = a.quiz_id JOIN units u ON u.id = z.unit_id
      WHERE a.user_id = $1 ORDER BY a.created_at DESC LIMIT $2`,
    [userId, limit],
  );
}

export async function getRecentLessonCompletions(q: Queryable, userId: string, limit = 20) {
  return q.query<{ lessonId: string; lessonTitle: string; unitTitle: string; xpEarned: number; completedAt: Date }>(
    `SELECT c.lesson_id AS "lessonId", l.title AS "lessonTitle", u.title AS "unitTitle",
            c.xp_earned AS "xpEarned", c.completed_at AS "completedAt"
       FROM lesson_completions c JOIN lessons l ON l.id = c.lesson_id JOIN units u ON u.id = l.unit_id
      WHERE c.user_id = $1 ORDER BY c.completed_at DESC LIMIT $2`,
    [userId, limit],
  );
}
