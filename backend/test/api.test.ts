import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Express } from 'express';
import { createApp } from '../src/app.js';
import { createDb, type Db } from '../src/db/index.js';
import { runMigrations } from '../src/db/migrate.js';
import { loadSeedData, seed, type SeedData } from '../src/db/seed.js';

let db: Db;
let app: Express;
let data: SeedData;

beforeAll(async () => {
  db = await createDb({}); // in-memory PGlite
  await runMigrations(db);
  data = await loadSeedData();
  await seed(db, data);
  app = createApp(db);
}, 60_000);

afterAll(async () => {
  await db.close();
});

let emailCounter = 0;
async function newUser() {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Тест', email: `t${++emailCounter}@test.mn`, password: 'secret12' });
  expect(res.status).toBe(201);
  const token: string = res.body.token;
  return {
    get: (url: string) => request(app).get(url).set('Authorization', `Bearer ${token}`),
    post: (url: string, body?: object) => request(app).post(url).set('Authorization', `Bearer ${token}`).send(body),
    patch: (url: string, body: object) => request(app).patch(url).set('Authorization', `Bearer ${token}`).send(body),
  };
}

const unit = (i: number) => data.units[i]!;
const correctAnswers = (i: number) =>
  unit(i).quiz!.questions.map((q) => ({ questionId: q.id, answerIndex: q.answerIndex }));
const wrongAnswers = (i: number) =>
  unit(i).quiz!.questions.map((q) => ({ questionId: q.id, answerIndex: (q.answerIndex + 1) % q.options.length }));

describe('auth', () => {
  it('logs in the seeded demo user', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'DEMO@octolearn.mn', password: 'demo1234' });
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ name: 'Болд', role: 'learner' });
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('rejects a wrong password and duplicate emails', async () => {
    const bad = await request(app).post('/api/auth/login').send({ email: 'demo@octolearn.mn', password: 'nope' });
    expect(bad.status).toBe(401);
    const dup = await request(app)
      .post('/api/auth/register')
      .send({ name: 'X', email: 'demo@octolearn.mn', password: 'secret12' });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('requires a token for API routes', async () => {
    expect((await request(app).get('/api/me')).status).toBe(401);
    expect((await request(app).get('/api/courses')).status).toBe(401);
  });

  it('restricts admin routes', async () => {
    const learner = await newUser();
    expect((await learner.get('/api/admin/users')).status).toBe(403);
    const login = await request(app).post('/api/auth/login').send({ email: 'admin@octolearn.mn', password: 'admin1234' });
    const res = await request(app).get('/api/admin/users').set('Authorization', `Bearer ${login.body.token}`);
    expect(res.status).toBe(200);
    expect(res.body.users.length).toBeGreaterThanOrEqual(2);
  });
});

describe('pathway', () => {
  it('starts with only the first lesson active', async () => {
    const u = await newUser();
    const res = await u.get('/api/courses/eng-a1/pathway');
    expect(res.status).toBe(200);
    const [u1, u2, u3] = res.body.units;
    expect(u1.state).toBe('active');
    expect(u1.lessons.map((l: { state: string }) => l.state)).toEqual(['active', 'locked', 'locked', 'locked', 'locked']);
    expect(u1.quiz.state).toBe('locked');
    expect(u2.state).toBe('locked');
    expect(u3.state).toBe('locked');
    expect(res.body.activeNode).toEqual({ kind: 'lesson', id: 'u1-l1', unitId: 'u1' });
    expect(res.body.summary).toMatchObject({ completedLessons: 0, totalLessons: 15, percent: 0, totalXp: 0 });
  });

  it('returns 404 for an unknown course', async () => {
    const u = await newUser();
    expect((await u.get('/api/courses/nope/pathway')).status).toBe(404);
  });
});

describe('lessons', () => {
  it('completes the active lesson, awards XP once and unlocks the next', async () => {
    const u = await newUser();
    const first = await u.post('/api/lessons/u1-l1/complete');
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ xpEarned: 10, alreadyCompleted: false, nextNode: { id: 'u1-l2' } });
    expect(first.body.summary).toMatchObject({ completedLessons: 1, totalXp: 10, streak: 1 });

    const again = await u.post('/api/lessons/u1-l1/complete');
    expect(again.body).toMatchObject({ xpEarned: 0, alreadyCompleted: true });
    expect(again.body.summary.totalXp).toBe(10);
  });

  it('refuses locked lessons with 423', async () => {
    const u = await newUser();
    const res = await u.post('/api/lessons/u1-l3/complete');
    expect(res.status).toBe(423);
    expect(res.body.error.code).toBe('LOCKED');
    expect((await u.post('/api/lessons/missing/complete')).status).toBe(404);
  });
});

describe('quizzes', () => {
  async function finishUnitLessons(u: Awaited<ReturnType<typeof newUser>>, i: number) {
    for (const l of unit(i).lessons) {
      expect((await u.post(`/api/lessons/${l.id}/complete`)).status).toBe(200);
    }
  }

  it('is locked until all unit lessons are done', async () => {
    const u = await newUser();
    expect((await u.get('/api/quizzes/u1-quiz')).status).toBe(423);
    await finishUnitLessons(u, 0);
    const quiz = await u.get('/api/quizzes/u1-quiz');
    expect(quiz.status).toBe(200);
    expect(quiz.body.questions).toHaveLength(5);
    expect(quiz.body.questions[0].answerIndex).toBeUndefined();
  });

  it('checks a single answer', async () => {
    const u = await newUser();
    await finishUnitLessons(u, 0);
    const q = unit(0).quiz!.questions[0]!;
    const res = await u.post('/api/quizzes/u1-quiz/check', { questionId: q.id, answerIndex: q.answerIndex });
    expect(res.body).toEqual({ questionId: q.id, correct: true, correctIndex: q.answerIndex });
  });

  it('fails below 60%, passes after retry, unlocks next unit, and awards XP only once', async () => {
    const u = await newUser();
    await finishUnitLessons(u, 0);

    const fail = await u.post('/api/quizzes/u1-quiz/submit', { answers: wrongAnswers(0) });
    expect(fail.status).toBe(200);
    expect(fail.body).toMatchObject({ passed: false, scorePercent: 0, xpEarned: 0, unlockedUnitId: null });
    expect(fail.body.nextNode.id).toBe('u1-quiz');

    const pass = await u.post('/api/quizzes/u1-quiz/submit', { answers: correctAnswers(0) });
    expect(pass.body).toMatchObject({
      passed: true,
      correctCount: 5,
      totalCount: 5,
      xpEarned: 45,
      unlockedUnitId: 'u2',
      nextNode: { id: 'u2-l1' },
    });
    expect(pass.body.summary).toMatchObject({ totalXp: 95, passedQuizzes: 1, percent: Math.round((6 / 18) * 100) });

    const retake = await u.post('/api/quizzes/u1-quiz/submit', { answers: correctAnswers(0) });
    expect(retake.body).toMatchObject({ passed: true, xpEarned: 0, alreadyPassed: true, unlockedUnitId: null });

    const path = await u.get('/api/courses/eng-a1/pathway');
    expect(path.body.units[0]).toMatchObject({ state: 'completed', quiz: { state: 'completed', bestScore: 100 } });
    expect(path.body.units[1].state).toBe('active');
  });

  it('rejects incomplete answer sets', async () => {
    const u = await newUser();
    await finishUnitLessons(u, 0);
    const res = await u.post('/api/quizzes/u1-quiz/submit', { answers: correctAnswers(0).slice(0, 2) });
    expect(res.status).toBe(400);
    expect(res.body.error.details.missing).toHaveLength(3);
  });
});

describe('profile & reset', () => {
  it('reports stats and resets progress', async () => {
    const u = await newUser();
    for (const l of unit(0).lessons) await u.post(`/api/lessons/${l.id}/complete`);
    await u.post('/api/quizzes/u1-quiz/submit', { answers: wrongAnswers(0) });
    await u.post('/api/quizzes/u1-quiz/submit', { answers: correctAnswers(0) });

    const me = await u.get('/api/me');
    expect(me.status).toBe(200);
    expect(me.body.stats).toMatchObject({
      totalXp: 95,
      completedLessons: 5,
      passedQuizzes: 1,
      quizzesAttempted: 1,
      averageQuizScore: 100,
      level: 1,
      streak: 1,
      levelInfo: { level: 1, xpIntoLevel: 95 },
    });
    expect(me.body.stats.weeklyActivity).toHaveLength(7);
    expect(me.body.stats.weeklyActivity[6].xp).toBe(95);

    expect((await u.post('/api/me/reset-progress')).status).toBe(204);
    const after = await u.get('/api/me');
    expect(after.body.stats).toMatchObject({ totalXp: 0, completedLessons: 0, passedQuizzes: 0, averageQuizScore: null });
  });

  it('updates the profile name', async () => {
    const u = await newUser();
    const res = await u.patch('/api/me', { name: 'Сараа' });
    expect(res.status).toBe(200);
    expect(res.body.user.name).toBe('Сараа');
  });
});
