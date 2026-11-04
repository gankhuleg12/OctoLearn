import { request } from './client';
import type {
  CheckAnswerResult,
  CompleteLessonResult,
  Leaderboard,
  Pathway,
  Profile,
  Quiz,
  QuizAnswer,
  QuizSubmitResult,
  Session,
  User,
} from './types';

export const COURSE_ID = 'eng-a1';

export const api = {
  login: (email: string, password: string) =>
    request<Session>('/auth/login', { method: 'POST', body: { email, password }, auth: false }),

  register: (name: string, email: string, password: string) =>
    request<Session>('/auth/register', { method: 'POST', body: { name, email, password }, auth: false }),

  profile: () => request<Profile>('/me'),

  updateProfile: (patch: { name?: string }) => request<{ user: User }>('/me', { method: 'PATCH', body: patch }),

  resetProgress: () => request<void>('/me/reset-progress', { method: 'POST' }),

  pathway: (courseId = COURSE_ID) => request<Pathway>(`/courses/${encodeURIComponent(courseId)}/pathway`),

  completeLesson: (lessonId: string) =>
    request<CompleteLessonResult>(`/lessons/${encodeURIComponent(lessonId)}/complete`, { method: 'POST' }),

  quiz: (quizId: string) => request<Quiz>(`/quizzes/${encodeURIComponent(quizId)}`),

  checkAnswer: (quizId: string, questionId: string, answerIndex: number) =>
    request<CheckAnswerResult>(`/quizzes/${encodeURIComponent(quizId)}/check`, {
      method: 'POST',
      body: { questionId, answerIndex },
    }),

  submitQuiz: (quizId: string, answers: QuizAnswer[]) =>
    request<QuizSubmitResult>(`/quizzes/${encodeURIComponent(quizId)}/submit`, {
      method: 'POST',
      body: { answers },
    }),

  leaderboard: (limit = 20) => request<Leaderboard>(`/leaderboard?limit=${limit}`),
};
