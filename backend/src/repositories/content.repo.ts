import type { Queryable } from '../db/index.js';
import type { CourseOutline } from '../domain/progression.js';

export interface Lesson {
  id: string;
  unitId: string;
  position: number;
  title: string;
  description: string;
  videoUrl: string;
  /** MP4 rendition for players without HLS support (web); null for plain URLs. */
  videoFallbackUrl: string | null;
  /** 'processing' while Bunny is still encoding the upload. */
  videoStatus: 'ready' | 'processing' | 'error';
  durationSec: number;
  xp: number;
}

export interface QuizMeta {
  id: string;
  unitId: string;
  title: string;
  passPercent: number;
  questionCount: number;
}

export interface Unit {
  id: string;
  position: number;
  title: string;
  description: string;
  lessons: Lesson[];
  quiz: QuizMeta | null;
}

export interface CourseContent {
  id: string;
  title: string;
  description: string;
  units: Unit[];
}

export interface QuizQuestion {
  id: string;
  position: number;
  text: string;
  options: string[];
  answerIndex: number;
}

export async function listCourses(q: Queryable) {
  return q.query<{ id: string; title: string; description: string }>(
    'SELECT id, title, description FROM courses ORDER BY title',
  );
}

export async function getCourseContent(q: Queryable, courseId: string): Promise<CourseContent | null> {
  const [course] = await q.query<{ id: string; title: string; description: string }>(
    'SELECT id, title, description FROM courses WHERE id = $1',
    [courseId],
  );
  if (!course) return null;

  const [units, lessons, quizzes] = await Promise.all([
    q.query<{ id: string; position: number; title: string; description: string }>(
      'SELECT id, position, title, description FROM units WHERE course_id = $1 AND published ORDER BY position, created_at',
      [courseId],
    ),
    q.query<Lesson>(
      `SELECT l.id, l.unit_id AS "unitId", l.position, l.title, l.description,
              l.video_url AS "videoUrl", l.video_fallback_url AS "videoFallbackUrl",
              l.video_status AS "videoStatus", l.duration_sec AS "durationSec", l.xp
         FROM lessons l JOIN units u ON u.id = l.unit_id
        WHERE u.course_id = $1 AND u.published
        ORDER BY l.position, l.created_at`,
      [courseId],
    ),
    // A quiz without questions could never be passed, so it is left out of the path.
    q.query<QuizMeta>(
      `SELECT * FROM (
         SELECT z.id, z.unit_id AS "unitId", z.title, z.pass_percent AS "passPercent",
                (SELECT count(*)::int FROM quiz_questions qq WHERE qq.quiz_id = z.id) AS "questionCount"
           FROM quizzes z JOIN units u ON u.id = z.unit_id
          WHERE u.course_id = $1 AND u.published
       ) t WHERE "questionCount" > 0`,
      [courseId],
    ),
  ]);

  return {
    ...course,
    units: units
      .map((u) => ({
        ...u,
        lessons: lessons.filter((l) => l.unitId === u.id),
        quiz: quizzes.find((z) => z.unitId === u.id) ?? null,
      }))
      .filter((u) => u.lessons.length > 0 || u.quiz),
  };
}

export function toOutline(course: CourseContent): CourseOutline {
  return {
    units: course.units.map((u) => ({
      id: u.id,
      lessonIds: u.lessons.map((l) => l.id),
      quizId: u.quiz?.id ?? null,
    })),
  };
}

/** Finds which course a lesson or quiz belongs to (published units only). */
export async function findCourseIdForNode(
  q: Queryable,
  kind: 'lesson' | 'quiz',
  nodeId: string,
): Promise<string | null> {
  const table = kind === 'lesson' ? 'lessons' : 'quizzes';
  const [row] = await q.query<{ courseId: string }>(
    `SELECT u.course_id AS "courseId" FROM ${table} n JOIN units u ON u.id = n.unit_id
      WHERE n.id = $1 AND u.published`,
    [nodeId],
  );
  return row?.courseId ?? null;
}

/** Ids of all published lessons and quizzes across every course (profile-wide totals). */
export async function getAllContentIds(q: Queryable): Promise<{ lessonIds: string[]; quizIds: string[] }> {
  const [lessons, quizzes] = await Promise.all([
    q.query<{ id: string }>('SELECT l.id FROM lessons l JOIN units u ON u.id = l.unit_id WHERE u.published'),
    q.query<{ id: string }>(
      `SELECT z.id FROM quizzes z JOIN units u ON u.id = z.unit_id
        WHERE u.published AND EXISTS (SELECT 1 FROM quiz_questions qq WHERE qq.quiz_id = z.id)`,
    ),
  ]);
  return { lessonIds: lessons.map((r) => r.id), quizIds: quizzes.map((r) => r.id) };
}

export async function getQuizQuestions(q: Queryable, quizId: string): Promise<QuizQuestion[]> {
  return q.query<QuizQuestion>(
    `SELECT id, position, text, options, answer_index AS "answerIndex"
       FROM quiz_questions WHERE quiz_id = $1 ORDER BY position`,
    [quizId],
  );
}
