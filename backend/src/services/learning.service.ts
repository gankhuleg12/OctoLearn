import type { Db, Queryable } from '../db/index.js';
import { gradeQuiz, quizXp } from '../domain/gamification.js';
import {
  computeNodeStates,
  computeUnitState,
  findActiveNode,
  type NodeState,
  type PathNodeRef,
  type UserProgressSets,
} from '../domain/progression.js';
import { badRequest, locked, notFound } from '../http/errors.js';
import {
  findCourseIdForNode,
  getCourseContent,
  getQuizQuestions,
  listCourses,
  toOutline,
  type CourseContent,
} from '../repositories/content.repo.js';
import { getLeaderboard, getLeaderboardEntry } from '../repositories/leaderboard.repo.js';
import {
  deleteProgress,
  getBestQuizScores,
  getProgressSets,
  insertLessonCompletion,
  insertQuizAttempt,
  lockUser,
} from '../repositories/progress.repo.js';
import { buildSummary, type ContentScope } from './stats.service.js';

export interface QuizAnswer {
  questionId: string;
  answerIndex: number;
}

function scopeOf(course: CourseContent): ContentScope {
  return {
    lessonIds: course.units.flatMap((u) => u.lessons.map((l) => l.id)),
    quizIds: course.units.flatMap((u) => (u.quiz ? [u.quiz.id] : [])),
  };
}

function withAdded(progress: UserProgressSets, kind: 'lesson' | 'quiz', id: string): UserProgressSets {
  return kind === 'lesson'
    ? { ...progress, completedLessonIds: new Set([...progress.completedLessonIds, id]) }
    : { ...progress, passedQuizIds: new Set([...progress.passedQuizIds, id]) };
}

/** Loads the course that owns a lesson/quiz plus the user's state on it. */
async function loadNodeContext(q: Queryable, userId: string, kind: 'lesson' | 'quiz', nodeId: string) {
  const missing = () => notFound(kind === 'lesson' ? 'Хичээл олдсонгүй.' : 'Шалгалт олдсонгүй.');
  const courseId = await findCourseIdForNode(q, kind, nodeId);
  if (!courseId) throw missing();
  const course = (await getCourseContent(q, courseId))!;
  const outline = toOutline(course);
  const progress = await getProgressSets(q, userId);
  // Undefined when the node is hidden from the path (e.g. a quiz with no questions yet).
  const state: NodeState | undefined = computeNodeStates(outline, progress).get(nodeId);
  if (!state) throw missing();
  return { course, outline, progress, state };
}

export function createLearningService(db: Db) {
  return {
    listCourses: () => listCourses(db),

    async getLeaderboard(userId: string, limit: number) {
      const [entries, me] = await Promise.all([getLeaderboard(db, limit), getLeaderboardEntry(db, userId)]);
      return { entries, me };
    },

    /** Everything the pathway screen needs in one request. */
    async getPathway(userId: string, courseId: string) {
      const course = await getCourseContent(db, courseId);
      if (!course) throw notFound('Курс олдсонгүй.');
      const outline = toOutline(course);
      const [progress, best] = await Promise.all([getProgressSets(db, userId), getBestQuizScores(db, userId)]);
      const states = computeNodeStates(outline, progress);
      const bestByQuiz = new Map(best.map((b) => [b.quizId, b.bestScore]));

      return {
        course: { id: course.id, title: course.title, description: course.description },
        units: course.units.map((u, i) => ({
          id: u.id,
          position: u.position,
          title: u.title,
          description: u.description,
          state: computeUnitState(outline.units[i]!, states),
          lessons: u.lessons.map((l) => ({ ...l, state: states.get(l.id)! })),
          quiz: u.quiz
            ? { ...u.quiz, state: states.get(u.quiz.id)!, bestScore: bestByQuiz.get(u.quiz.id) ?? null }
            : null,
        })),
        activeNode: findActiveNode(outline, progress),
        summary: await buildSummary(db, userId, scopeOf(course), progress),
      };
    },

    async completeLesson(userId: string, lessonId: string) {
      return db.tx(async (q) => {
        await lockUser(q, userId);
        const { course, outline, progress, state } = await loadNodeContext(q, userId, 'lesson', lessonId);
        if (state === 'locked') throw locked();

        const lesson = course.units.flatMap((u) => u.lessons).find((l) => l.id === lessonId)!;
        const awarded = await insertLessonCompletion(q, userId, lessonId, lesson.xp);
        const after = withAdded(progress, 'lesson', lessonId);

        return {
          lessonId,
          alreadyCompleted: awarded === null,
          xpEarned: awarded ?? 0,
          nextNode: findActiveNode(outline, after),
          summary: await buildSummary(q, userId, scopeOf(course), after),
        };
      });
    },

    /** Questions without the correct answers. Passed quizzes may be retaken. */
    async getQuiz(userId: string, quizId: string) {
      const { course, state } = await loadNodeContext(db, userId, 'quiz', quizId);
      if (state === 'locked') throw locked('Бүлгийн бүх хичээлээ дуусгасны дараа шалгалт нээгдэнэ.');
      const unit = course.units.find((u) => u.quiz?.id === quizId)!;
      const questions = await getQuizQuestions(db, quizId);
      return {
        id: quizId,
        title: unit.quiz!.title,
        unitId: unit.id,
        unitTitle: unit.title,
        passPercent: unit.quiz!.passPercent,
        state,
        questions: questions.map(({ answerIndex: _hidden, ...rest }) => rest),
      };
    },

    /** Per-question feedback for the "Шалгах" button. Does not record anything. */
    async checkAnswer(userId: string, quizId: string, questionId: string, answerIndex: number) {
      const { state } = await loadNodeContext(db, userId, 'quiz', quizId);
      if (state === 'locked') throw locked('Бүлгийн бүх хичээлээ дуусгасны дараа шалгалт нээгдэнэ.');
      const question = (await getQuizQuestions(db, quizId)).find((qq) => qq.id === questionId);
      if (!question) throw notFound('Асуулт олдсонгүй.');
      if (answerIndex >= question.options.length) throw badRequest('Сонголт буруу байна.');
      return { questionId, correct: answerIndex === question.answerIndex, correctIndex: question.answerIndex };
    },

    async submitQuiz(userId: string, quizId: string, answers: QuizAnswer[]) {
      return db.tx(async (q) => {
        await lockUser(q, userId);
        const { course, outline, progress, state } = await loadNodeContext(q, userId, 'quiz', quizId);
        if (state === 'locked') throw locked('Бүлгийн бүх хичээлээ дуусгасны дараа шалгалт нээгдэнэ.');

        const questions = await getQuizQuestions(q, quizId);
        const byQuestion = new Map(answers.map((a) => [a.questionId, a.answerIndex]));
        if (byQuestion.size !== answers.length) throw badRequest('Нэг асуултад нэг л хариулт өгнө.');
        const missing = questions.filter((qq) => !byQuestion.has(qq.id)).map((qq) => qq.id);
        const unknown = answers.filter((a) => !questions.some((qq) => qq.id === a.questionId)).map((a) => a.questionId);
        if (missing.length || unknown.length) {
          throw badRequest('Бүх асуултад хариулна уу.', { missing, unknown });
        }

        const results = questions.map((qq) => {
          const selectedIndex = byQuestion.get(qq.id)!;
          return { questionId: qq.id, selectedIndex, correctIndex: qq.answerIndex, correct: selectedIndex === qq.answerIndex };
        });
        const unit = course.units.find((u) => u.quiz?.id === quizId)!;
        const grade = gradeQuiz(results.filter((r) => r.correct).length, questions.length, unit.quiz!.passPercent);
        const alreadyPassed = progress.passedQuizIds.has(quizId);
        const xpEarned = quizXp(grade, alreadyPassed);

        const attemptId = await insertQuizAttempt(q, {
          userId,
          quizId,
          ...grade,
          xpEarned,
          answers: results,
        });

        const after = grade.passed ? withAdded(progress, 'quiz', quizId) : progress;
        const nextNode: PathNodeRef | null = findActiveNode(outline, after);
        const unlockedUnitId =
          grade.passed && !alreadyPassed && nextNode && nextNode.unitId !== unit.id ? nextNode.unitId : null;

        return {
          attemptId,
          quizId,
          ...grade,
          passPercent: unit.quiz!.passPercent,
          xpEarned,
          alreadyPassed,
          results,
          nextNode,
          unlockedUnitId,
          summary: await buildSummary(q, userId, scopeOf(course), after),
        };
      });
    },

    async resetProgress(userId: string) {
      await db.tx((q) => deleteProgress(q, userId));
    },
  };
}

export type LearningService = ReturnType<typeof createLearningService>;
