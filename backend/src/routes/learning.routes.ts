import { Router } from 'express';
import { z } from 'zod';
import { authOf } from '../http/auth.js';
import type { LearningService } from '../services/learning.service.js';

const CheckBody = z.object({
  questionId: z.string().min(1),
  answerIndex: z.number().int().nonnegative(),
});

const SubmitBody = z.object({
  answers: z.array(CheckBody).min(1),
});

export function learningRoutes(learning: LearningService): Router {
  const r = Router();

  /** Top learners by XP plus the caller's own rank. */
  r.get('/leaderboard', async (req, res) => {
    const { limit } = z.object({ limit: z.coerce.number().int().min(1).max(50).default(20) }).parse(req.query);
    res.json(await learning.getLeaderboard(authOf(req).userId, limit));
  });

  r.get('/courses', async (_req, res) => {
    res.json({ courses: await learning.listCourses() });
  });

  r.get('/courses/:courseId/pathway', async (req, res) => {
    res.json(await learning.getPathway(authOf(req).userId, req.params.courseId));
  });

  r.post('/lessons/:lessonId/complete', async (req, res) => {
    res.json(await learning.completeLesson(authOf(req).userId, req.params.lessonId));
  });

  r.get('/quizzes/:quizId', async (req, res) => {
    res.json(await learning.getQuiz(authOf(req).userId, req.params.quizId));
  });

  r.post('/quizzes/:quizId/check', async (req, res) => {
    const { questionId, answerIndex } = CheckBody.parse(req.body);
    res.json(await learning.checkAnswer(authOf(req).userId, req.params.quizId, questionId, answerIndex));
  });

  r.post('/quizzes/:quizId/submit', async (req, res) => {
    const { answers } = SubmitBody.parse(req.body);
    res.json(await learning.submitQuiz(authOf(req).userId, req.params.quizId, answers));
  });

  return r;
}
