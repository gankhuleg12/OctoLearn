import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Express } from 'express';
import { createApp } from '../src/app.js';
import { createDb, type Db } from '../src/db/index.js';
import { runMigrations } from '../src/db/migrate.js';
import { seed } from '../src/db/seed.js';

let db: Db;
let app: Express;
let adminToken: string;

beforeAll(async () => {
  db = await createDb({});
  await runMigrations(db);
  await seed(db);
  app = createApp(db);
  const res = await request(app).post('/api/auth/login').send({ email: 'admin@octolearn.mn', password: 'admin1234' });
  adminToken = res.body.token;
}, 60_000);

afterAll(async () => {
  await db.close();
});

const as = (token: string) => ({
  get: (url: string) => request(app).get(url).set('Authorization', `Bearer ${token}`),
  post: (url: string, body?: object) => request(app).post(url).set('Authorization', `Bearer ${token}`).send(body),
  put: (url: string, body: object) => request(app).put(url).set('Authorization', `Bearer ${token}`).send(body),
  patch: (url: string, body: object) => request(app).patch(url).set('Authorization', `Bearer ${token}`).send(body),
  delete: (url: string) => request(app).delete(url).set('Authorization', `Bearer ${token}`),
});
const admin = () => as(adminToken);

let n = 0;
async function newLearner() {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name: `Learner ${++n}`, email: `l${n}@test.mn`, password: 'secret12' });
  return { id: res.body.user.id as string, ...as(res.body.token) };
}

const lesson = { title: 'Шинэ хичээл', videoUrl: 'https://example.com/v.mp4', durationSec: 30 };
const quiz = {
  title: 'Шалгалт',
  passPercent: 60,
  questions: [
    { text: 'A?', options: ['1', '2', '3'], answerIndex: 0 },
    { text: 'B?', options: ['1', '2', '3'], answerIndex: 2 },
  ],
};

describe('admin access', () => {
  it('rejects learners', async () => {
    const l = await newLearner();
    expect((await l.get('/api/admin/courses')).status).toBe(403);
    expect((await l.post('/api/admin/courses/eng-a1/units', { title: 'x' })).status).toBe(403);
  });
});

describe('content management', () => {
  it('creates a draft unit that the app does not see until published', async () => {
    const created = await admin().post('/api/admin/courses/eng-a1/units', { title: 'Бүлэг 4: Ажил' });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ title: 'Бүлэг 4: Ажил', published: false, position: 4 });
    const unitId = created.body.id;

    await admin().post(`/api/admin/units/${unitId}/lessons`, lesson).expect(201);

    const l = await newLearner();
    const before = await l.get('/api/courses/eng-a1/pathway');
    expect(before.body.units.map((u: { id: string }) => u.id)).not.toContain(unitId);

    await admin().patch(`/api/admin/units/${unitId}`, { published: true }).expect(204);
    const after = await l.get('/api/courses/eng-a1/pathway');
    expect(after.body.units.at(-1)).toMatchObject({ id: unitId, state: 'locked' });
    expect(after.body.summary.totalLessons).toBe(16);
  });

  it('edits, reorders and deletes lessons', async () => {
    const unitId = (await admin().post('/api/admin/courses/eng-a1/units', { title: 'Temp' })).body.id;
    const a = (await admin().post(`/api/admin/units/${unitId}/lessons`, { ...lesson, title: 'A' })).body.id;
    const b = (await admin().post(`/api/admin/units/${unitId}/lessons`, { ...lesson, title: 'B' })).body.id;

    await admin().patch(`/api/admin/lessons/${a}`, { title: 'A2', durationSec: 45 }).expect(204);
    await admin().put(`/api/admin/units/${unitId}/lessons/order`, { ids: [b, a] }).expect(204);

    let course = (await admin().get('/api/admin/courses/eng-a1')).body;
    let unit = course.units.find((u: { id: string }) => u.id === unitId);
    expect(unit.lessons.map((x: { title: string }) => x.title)).toEqual(['B', 'A2']);
    expect(unit.lessons[1]).toMatchObject({ durationSec: 45, videoUrl: lesson.videoUrl });

    // Wrong id set is rejected.
    expect((await admin().put(`/api/admin/units/${unitId}/lessons/order`, { ids: [a] })).status).toBe(400);

    await admin().delete(`/api/admin/lessons/${b}`).expect(204);
    course = (await admin().get('/api/admin/courses/eng-a1')).body;
    unit = course.units.find((u: { id: string }) => u.id === unitId);
    expect(unit.lessons).toHaveLength(1);

    await admin().delete(`/api/admin/units/${unitId}`).expect(204);
    expect((await admin().delete(`/api/admin/units/${unitId}`)).status).toBe(404);
  });

  it('validates lesson input', async () => {
    const res = await admin().post('/api/admin/units/u1/lessons', { title: '', videoUrl: 'nope', durationSec: -1 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('creates and replaces a quiz, keeping existing question ids', async () => {
    const unitId = (await admin().post('/api/admin/courses/eng-a1/units', { title: 'Quiz unit' })).body.id;
    const saved = await admin().put(`/api/admin/units/${unitId}/quiz`, quiz);
    expect(saved.status).toBe(200);

    let unit = (await admin().get('/api/admin/courses/eng-a1')).body.units.find((u: { id: string }) => u.id === unitId);
    expect(unit.quiz).toMatchObject({ id: saved.body.id, title: 'Шалгалт', passPercent: 60 });
    const [q1] = unit.quiz.questions;

    // Edit: keep q1 (by id), drop q2, add a new one.
    await admin()
      .put(`/api/admin/units/${unitId}/quiz`, {
        ...quiz,
        passPercent: 80,
        questions: [
          { id: q1.id, text: 'A edited', options: ['x', 'y'], answerIndex: 1 },
          { text: 'C?', options: ['1', '2', '3'], answerIndex: 1 },
        ],
      })
      .expect(200);
    unit = (await admin().get('/api/admin/courses/eng-a1')).body.units.find((u: { id: string }) => u.id === unitId);
    expect(unit.quiz.passPercent).toBe(80);
    expect(unit.quiz.questions.map((q: { text: string }) => q.text)).toEqual(['A edited', 'C?']);
    expect(unit.quiz.questions[0].id).toBe(q1.id);

    const bad = await admin().put(`/api/admin/units/${unitId}/quiz`, {
      ...quiz,
      questions: [{ text: 'x', options: ['a', 'b'], answerIndex: 5 }],
    });
    expect(bad.status).toBe(400);

    await admin().delete(`/api/admin/units/${unitId}/quiz`).expect(204);
    await admin().delete(`/api/admin/units/${unitId}`).expect(204);
  });

  it('exports and re-imports a course', async () => {
    const exported = await admin().get('/api/admin/courses/eng-a1/export');
    expect(exported.status).toBe(200);
    expect(exported.body.units[0].quiz.questions[0]).toHaveProperty('answerIndex');

    const copy = { ...exported.body, course: { ...exported.body.course, title: 'Renamed' } };
    const imported = await admin().post('/api/admin/courses/import', copy);
    expect(imported.status).toBe(200);
    expect(imported.body.title).toBe('Renamed');
  });
});

describe('progress after content edits', () => {
  it('a lesson inserted before finished work becomes active without re-locking completed items', async () => {
    const l = await newLearner();
    for (const id of ['u1-l1', 'u1-l2']) await l.post(`/api/lessons/${id}/complete`).expect(200);

    const newLesson = (await admin().post('/api/admin/units/u1/lessons', lesson)).body.id;
    const ids = ['u1-l1', newLesson, 'u1-l2', 'u1-l3', 'u1-l4', 'u1-l5'];
    await admin().put('/api/admin/units/u1/lessons/order', { ids }).expect(204);

    const path = await l.get('/api/courses/eng-a1/pathway');
    const states = path.body.units[0].lessons.map((x: { id: string; state: string }) => [x.id, x.state]);
    expect(states.slice(0, 4)).toEqual([
      ['u1-l1', 'completed'],
      [newLesson, 'active'],
      ['u1-l2', 'completed'],
      ['u1-l3', 'locked'],
    ]);

    await admin().delete(`/api/admin/lessons/${newLesson}`).expect(204);
  });
});

describe('learner monitoring', () => {
  it('lists users, shows details, leaderboard, resets and deletes', async () => {
    const top = await newLearner();
    for (const id of ['u1-l1', 'u1-l2', 'u1-l3']) await top.post(`/api/lessons/${id}/complete`);
    const low = await newLearner();
    await low.post('/api/lessons/u1-l1/complete');

    const overview = await admin().get('/api/admin/overview');
    expect(overview.body.learners).toBeGreaterThanOrEqual(2);
    expect(overview.body.lessonCompletions).toBeGreaterThanOrEqual(4);

    const board = await admin().get('/api/admin/leaderboard?limit=100');
    const ids = board.body.entries.map((e: { userId: string }) => e.userId);
    expect(ids.indexOf(top.id)).toBeLessThan(ids.indexOf(low.id));
    expect(board.body.entries.every((e: { name: string }) => e.name !== 'Админ')).toBe(true);

    const appBoard = await low.get('/api/leaderboard');
    expect(appBoard.status).toBe(200);
    expect(appBoard.body.me).toMatchObject({ userId: low.id, totalXp: 10 });

    const detail = await admin().get(`/api/admin/users/${top.id}`);
    expect(detail.body.stats).toMatchObject({ totalXp: 30, completedLessons: 3 });
    expect(detail.body.recentLessons).toHaveLength(3);
    expect(detail.body.pathways[0].units[0].lessons[3].state).toBe('active');

    await admin().post(`/api/admin/users/${top.id}/reset-progress`).expect(204);
    expect((await admin().get(`/api/admin/users/${top.id}`)).body.stats.totalXp).toBe(0);

    await admin().delete(`/api/admin/users/${low.id}`).expect(204);
    expect((await admin().get(`/api/admin/users/${low.id}`)).status).toBe(404);
  });

  it('refuses to delete the acting admin', async () => {
    const me = await admin().get('/api/me');
    const res = await admin().delete(`/api/admin/users/${me.body.user.id}`);
    expect(res.status).toBe(409);
  });
});
