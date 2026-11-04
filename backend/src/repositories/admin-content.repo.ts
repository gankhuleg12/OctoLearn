import { randomUUID } from 'node:crypto';
import type { Queryable } from '../db/index.js';
import type { Lesson } from './content.repo.js';

/** Short random id for admin-created content, e.g. "lesson-3f9a1c2e". */
export function newId(prefix: string): string {
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}

export interface AdminQuestion {
  id: string;
  position: number;
  text: string;
  options: string[];
  answerIndex: number;
}

export interface AdminQuiz {
  id: string;
  title: string;
  passPercent: number;
  questions: AdminQuestion[];
}

export interface AdminUnit {
  id: string;
  position: number;
  title: string;
  description: string;
  published: boolean;
  lessons: AdminLesson[];
  quiz: AdminQuiz | null;
}

export interface AdminCourse {
  id: string;
  title: string;
  description: string;
  units: AdminUnit[];
}

export interface UnitInput {
  title: string;
  description: string;
}

/** Where a lesson's video comes from; always written as a whole. */
export interface LessonVideo {
  videoUrl: string;
  videoFallbackUrl: string | null;
  videoStatus: 'ready' | 'processing' | 'error';
  /** Set when the video is hosted on Bunny Stream. */
  bunnyVideoId: string | null;
}

export interface LessonInput extends LessonVideo {
  title: string;
  description: string;
  durationSec: number;
  xp: number;
}

export type LessonPatch = Partial<Pick<LessonInput, 'title' | 'description' | 'durationSec' | 'xp'>> & {
  video?: LessonVideo;
};

export type AdminLesson = Lesson & { bunnyVideoId: string | null };

export interface QuizInput {
  title: string;
  passPercent: number;
  questions: { id?: string; text: string; options: string[]; answerIndex: number }[];
}

// ---- read ----------------------------------------------------------------

export async function listCoursesWithCounts(q: Queryable) {
  return q.query<{ id: string; title: string; description: string; unitCount: number; lessonCount: number }>(
    `SELECT c.id, c.title, c.description,
            (SELECT count(*)::int FROM units u WHERE u.course_id = c.id) AS "unitCount",
            (SELECT count(*)::int FROM lessons l JOIN units u ON u.id = l.unit_id WHERE u.course_id = c.id) AS "lessonCount"
       FROM courses c ORDER BY c.title`,
  );
}

/** Full course tree including drafts and correct answers. */
export async function getAdminCourse(q: Queryable, courseId: string): Promise<AdminCourse | null> {
  const [course] = await q.query<{ id: string; title: string; description: string }>(
    'SELECT id, title, description FROM courses WHERE id = $1',
    [courseId],
  );
  if (!course) return null;

  const [units, lessons, quizzes, questions] = await Promise.all([
    q.query<Omit<AdminUnit, 'lessons' | 'quiz'>>(
      `SELECT id, position, title, description, published
         FROM units WHERE course_id = $1 ORDER BY position, created_at`,
      [courseId],
    ),
    q.query<AdminLesson>(
      `SELECT l.id, l.unit_id AS "unitId", l.position, l.title, l.description,
              l.video_url AS "videoUrl", l.video_fallback_url AS "videoFallbackUrl",
              l.video_status AS "videoStatus", l.bunny_video_id AS "bunnyVideoId", l.duration_sec AS "durationSec", l.xp
         FROM lessons l JOIN units u ON u.id = l.unit_id
        WHERE u.course_id = $1 ORDER BY l.position, l.created_at`,
      [courseId],
    ),
    q.query<{ id: string; unitId: string; title: string; passPercent: number }>(
      `SELECT z.id, z.unit_id AS "unitId", z.title, z.pass_percent AS "passPercent"
         FROM quizzes z JOIN units u ON u.id = z.unit_id WHERE u.course_id = $1`,
      [courseId],
    ),
    q.query<AdminQuestion & { quizId: string }>(
      `SELECT qq.id, qq.quiz_id AS "quizId", qq.position, qq.text, qq.options, qq.answer_index AS "answerIndex"
         FROM quiz_questions qq JOIN quizzes z ON z.id = qq.quiz_id JOIN units u ON u.id = z.unit_id
        WHERE u.course_id = $1 ORDER BY qq.position`,
      [courseId],
    ),
  ]);

  return {
    ...course,
    units: units.map((u) => {
      const quiz = quizzes.find((z) => z.unitId === u.id);
      return {
        ...u,
        lessons: lessons.filter((l) => l.unitId === u.id),
        quiz: quiz
          ? {
              id: quiz.id,
              title: quiz.title,
              passPercent: quiz.passPercent,
              questions: questions.filter((qq) => qq.quizId === quiz.id).map(({ quizId: _q, ...rest }) => rest),
            }
          : null,
      };
    }),
  };
}

export async function getUnitCourseId(q: Queryable, unitId: string): Promise<string | null> {
  const [row] = await q.query<{ courseId: string }>('SELECT course_id AS "courseId" FROM units WHERE id = $1', [unitId]);
  return row?.courseId ?? null;
}

// ---- course --------------------------------------------------------------

export async function updateCourse(q: Queryable, id: string, patch: Partial<UnitInput>) {
  const [row] = await q.query<{ id: string }>(
    `UPDATE courses SET title = COALESCE($2, title), description = COALESCE($3, description)
      WHERE id = $1 RETURNING id`,
    [id, patch.title ?? null, patch.description ?? null],
  );
  return row ?? null;
}

// ---- units ---------------------------------------------------------------

export async function insertUnit(q: Queryable, courseId: string, input: UnitInput): Promise<string> {
  const id = newId('unit');
  await q.query(
    `INSERT INTO units (id, course_id, position, title, description, published)
     VALUES ($1, $2, (SELECT COALESCE(max(position), 0) + 1 FROM units WHERE course_id = $2), $3, $4, false)`,
    [id, courseId, input.title, input.description],
  );
  return id;
}

export async function updateUnit(
  q: Queryable,
  id: string,
  patch: Partial<UnitInput> & { published?: boolean },
): Promise<boolean> {
  const rows = await q.query(
    `UPDATE units SET title = COALESCE($2, title), description = COALESCE($3, description),
            published = COALESCE($4, published)
      WHERE id = $1 RETURNING id`,
    [id, patch.title ?? null, patch.description ?? null, patch.published ?? null],
  );
  return rows.length > 0;
}

export async function deleteUnit(q: Queryable, id: string): Promise<boolean> {
  return (await q.query('DELETE FROM units WHERE id = $1 RETURNING id', [id])).length > 0;
}

// ---- lessons -------------------------------------------------------------

export async function insertLesson(q: Queryable, unitId: string, input: LessonInput): Promise<string> {
  const id = newId('lesson');
  await q.query(
    `INSERT INTO lessons (id, unit_id, position, title, description, video_url, video_fallback_url,
                          video_status, bunny_video_id, duration_sec, xp)
     VALUES ($1, $2, (SELECT COALESCE(max(position), 0) + 1 FROM lessons WHERE unit_id = $2),
             $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      id,
      unitId,
      input.title,
      input.description,
      input.videoUrl,
      input.videoFallbackUrl,
      input.videoStatus,
      input.bunnyVideoId,
      input.durationSec,
      input.xp,
    ],
  );
  return id;
}

export async function updateLesson(q: Queryable, id: string, patch: LessonPatch): Promise<boolean> {
  const v = patch.video;
  const rows = await q.query(
    `UPDATE lessons SET title = COALESCE($2, title), description = COALESCE($3, description),
            duration_sec = COALESCE($4, duration_sec), xp = COALESCE($5, xp),
            video_url          = CASE WHEN $6::boolean THEN $7 ELSE video_url END,
            video_fallback_url = CASE WHEN $6::boolean THEN $8 ELSE video_fallback_url END,
            video_status       = CASE WHEN $6::boolean THEN $9 ELSE video_status END,
            bunny_video_id     = CASE WHEN $6::boolean THEN $10 ELSE bunny_video_id END
      WHERE id = $1 RETURNING id`,
    [
      id,
      patch.title ?? null,
      patch.description ?? null,
      patch.durationSec ?? null,
      patch.xp ?? null,
      v !== undefined,
      v?.videoUrl ?? null,
      v?.videoFallbackUrl ?? null,
      v?.videoStatus ?? null,
      v?.bunnyVideoId ?? null,
    ],
  );
  return rows.length > 0;
}

export async function deleteLesson(q: Queryable, id: string): Promise<boolean> {
  return (await q.query('DELETE FROM lessons WHERE id = $1 RETURNING id', [id])).length > 0;
}

// ---- ordering ------------------------------------------------------------

/**
 * Rewrites positions so `ids` appear in that order. `ids` must contain exactly
 * the current children of the parent; returns false otherwise.
 */
export async function reorder(
  q: Queryable,
  table: 'units' | 'lessons',
  parentColumn: 'course_id' | 'unit_id',
  parentId: string,
  ids: string[],
): Promise<boolean> {
  const current = await q.query<{ id: string }>(`SELECT id FROM ${table} WHERE ${parentColumn} = $1`, [parentId]);
  const currentIds = new Set(current.map((r) => r.id));
  if (ids.length !== currentIds.size || new Set(ids).size !== ids.length || !ids.every((id) => currentIds.has(id))) {
    return false;
  }
  await q.query(
    `UPDATE ${table} t SET position = o.pos
       FROM unnest($1::text[]) WITH ORDINALITY AS o(id, pos)
      WHERE t.id = o.id`,
    [ids],
  );
  return true;
}

// ---- quiz ----------------------------------------------------------------

/** Creates or fully replaces the unit's quiz and its question list. Returns the quiz id. */
export async function upsertQuiz(q: Queryable, unitId: string, input: QuizInput): Promise<string> {
  const [existing] = await q.query<{ id: string }>('SELECT id FROM quizzes WHERE unit_id = $1', [unitId]);
  const quizId = existing?.id ?? newId('quiz');

  await q.query(
    `INSERT INTO quizzes (id, unit_id, title, pass_percent) VALUES ($1, $2, $3, $4)
     ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, pass_percent = EXCLUDED.pass_percent`,
    [quizId, unitId, input.title, input.passPercent],
  );

  // Keep ids of questions that already belong to this quiz; anything else is new.
  const ownIds = new Set(
    (await q.query<{ id: string }>('SELECT id FROM quiz_questions WHERE quiz_id = $1', [quizId])).map((r) => r.id),
  );
  const questions = input.questions.map((qq) => ({ ...qq, id: qq.id && ownIds.has(qq.id) ? qq.id : newId('q') }));

  await q.query('DELETE FROM quiz_questions WHERE quiz_id = $1 AND NOT (id = ANY($2::text[]))', [
    quizId,
    questions.map((qq) => qq.id),
  ]);
  for (const [i, qq] of questions.entries()) {
    await q.query(
      `INSERT INTO quiz_questions (id, quiz_id, position, text, options, answer_index)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6)
       ON CONFLICT (id) DO UPDATE SET position = EXCLUDED.position, text = EXCLUDED.text,
         options = EXCLUDED.options, answer_index = EXCLUDED.answer_index`,
      [qq.id, quizId, i + 1, qq.text, JSON.stringify(qq.options), qq.answerIndex],
    );
  }
  return quizId;
}

export async function deleteQuizOfUnit(q: Queryable, unitId: string): Promise<boolean> {
  return (await q.query('DELETE FROM quizzes WHERE unit_id = $1 RETURNING id', [unitId])).length > 0;
}
