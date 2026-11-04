import { createHash } from 'node:crypto';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Express } from 'express';
import { createApp } from '../src/app.js';
import { createDb, type Db } from '../src/db/index.js';
import { runMigrations } from '../src/db/migrate.js';
import { seed } from '../src/db/seed.js';
import { pickFallbackResolution, toVideoStatus } from '../src/services/bunny.service.js';

const LIB = '12345';
const KEY = 'bunny-secret-key-abcd';
const CDN = 'vz-test123.b-cdn.net';
const VIDEO = '0b6f7c5e-1d2a-4c3b-9e8f-112233445566';

let db: Db;
let app: Express;
let adminToken: string;
let learnerToken: string;

/** Fake Bunny Stream API. `videoState` controls what GET video returns. */
let videoState = { status: 3, encodeProgress: 40, length: 0, availableResolutions: '240p', hasMP4Fallback: true };
let rejectKey = false;

function bunnyFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const url = String(input instanceof Request ? input.url : input);
  const headers = new Headers(init?.headers);
  const json = (status: number, body: unknown) =>
    Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));
  if (!url.startsWith('https://video.bunnycdn.com')) return Promise.reject(new Error(`unexpected fetch ${url}`));
  if (rejectKey || headers.get('AccessKey') !== KEY) return json(401, { success: false, message: 'Unauthorized' });
  if (url.includes(`/library/${LIB}/videos?page=1`)) return json(200, { totalItems: 7, items: [] });
  if (url.endsWith(`/library/${LIB}/videos`) && init?.method === 'POST') {
    return json(200, { guid: VIDEO, title: JSON.parse(String(init.body)).title, status: 0, encodeProgress: 0, length: 0 });
  }
  if (url.endsWith(`/library/${LIB}/videos/${VIDEO}`)) return json(200, { guid: VIDEO, title: 'v', ...videoState });
  return json(404, { success: false });
}

beforeAll(async () => {
  db = await createDb({});
  await runMigrations(db);
  await seed(db);
  app = createApp(db);
  adminToken = (await request(app).post('/api/auth/login').send({ email: 'admin@octolearn.mn', password: 'admin1234' })).body.token;
  learnerToken = (await request(app).post('/api/auth/login').send({ email: 'demo@octolearn.mn', password: 'demo1234' })).body.token;
  vi.spyOn(globalThis, 'fetch').mockImplementation(bunnyFetch as typeof fetch);
}, 60_000);

afterEach(() => {
  rejectKey = false;
});

afterAll(async () => {
  vi.restoreAllMocks();
  await db.close();
});

const admin = {
  get: (u: string) => request(app).get(u).set('Authorization', `Bearer ${adminToken}`),
  post: (u: string, b?: object) => request(app).post(u).set('Authorization', `Bearer ${adminToken}`).send(b),
  put: (u: string, b: object) => request(app).put(u).set('Authorization', `Bearer ${adminToken}`).send(b),
  patch: (u: string, b: object) => request(app).patch(u).set('Authorization', `Bearer ${adminToken}`).send(b),
};

describe('helpers', () => {
  it('prefers a 720p MP4 fallback', () => {
    expect(pickFallbackResolution('240p,360p,720p,1080p')).toBe(720);
    expect(pickFallbackResolution('240p,480p,1080p')).toBe(480);
    expect(pickFallbackResolution('1080p')).toBe(1080);
    expect(pickFallbackResolution(null)).toBeNull();
  });

  it('maps Bunny status codes', () => {
    expect(toVideoStatus(4)).toBe('ready');
    expect(toVideoStatus(5)).toBe('error');
    expect(toVideoStatus(6)).toBe('error');
    expect(toVideoStatus(3)).toBe('processing');
  });
});

describe('settings', () => {
  it('requires Bunny to be configured before uploading', async () => {
    const res = await admin.post('/api/admin/bunny/uploads', { title: 'x' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('BUNNY_NOT_CONFIGURED');
  });

  it('is admin only', async () => {
    const res = await request(app).get('/api/admin/settings/bunny').set('Authorization', `Bearer ${learnerToken}`);
    expect(res.status).toBe(403);
  });

  it('saves credentials, never returns the key and stores it encrypted', async () => {
    expect((await admin.put('/api/admin/settings/bunny', { libraryId: LIB, cdnHostname: CDN })).status).toBe(400);

    const saved = await admin.put('/api/admin/settings/bunny', {
      libraryId: LIB,
      apiKey: KEY,
      cdnHostname: `https://${CDN}/`,
    });
    expect(saved.status).toBe(200);
    expect(saved.body).toEqual({
      configured: true,
      libraryId: LIB,
      cdnHostname: CDN,
      apiBaseUrl: 'https://video.bunnycdn.com',
      apiKeySet: true,
      apiKeyHint: '••••abcd',
    });
    expect(JSON.stringify(saved.body)).not.toContain(KEY);

    const [row] = await db.query<{ value: string }>("SELECT value FROM app_settings WHERE key = 'bunny.apiKey'");
    expect(row!.value.startsWith('enc:v1:')).toBe(true);
    expect(row!.value).not.toContain(KEY);

    // Saving without a key keeps the stored one.
    const again = await admin.put('/api/admin/settings/bunny', { libraryId: LIB, cdnHostname: CDN, apiKey: '' });
    expect(again.body.apiKeySet).toBe(true);
  });

  it('validates input', async () => {
    const res = await admin.put('/api/admin/settings/bunny', { libraryId: 'abc', cdnHostname: 'nope', apiKey: 'k' });
    expect(res.status).toBe(400);
  });

  it('tests the connection', async () => {
    const ok = await admin.post('/api/admin/settings/bunny/test');
    expect(ok.body).toEqual({ ok: true, totalVideos: 7 });

    rejectKey = true;
    const bad = await admin.post('/api/admin/settings/bunny/test');
    expect(bad.status).toBe(502);
    expect(bad.body.error.code).toBe('BUNNY_AUTH');
  });
});

describe('upload → lesson → encode', () => {
  let lessonId: string;

  it('issues a signed TUS ticket without exposing the key', async () => {
    const res = await admin.post('/api/admin/bunny/uploads', { title: 'Мэндчилгээ' });
    expect(res.status).toBe(201);
    const { videoId, libraryId, endpoint, signature, expire } = res.body;
    expect(videoId).toBe(VIDEO);
    expect(libraryId).toBe(LIB);
    expect(endpoint).toBe('https://video.bunnycdn.com/tusupload');
    expect(signature).toBe(createHash('sha256').update(`${LIB}${KEY}${expire}${VIDEO}`).digest('hex'));
    expect(expire).toBeGreaterThan(Date.now() / 1000);
    expect(JSON.stringify(res.body)).not.toContain(KEY);
  });

  it('creates a lesson from a Bunny video while it is still encoding', async () => {
    const bad = await admin.post('/api/admin/units/u1/lessons', { title: 'x', videoUrl: 'https://a.b/c.mp4', bunnyVideoId: VIDEO });
    expect(bad.status).toBe(400);

    const res = await admin.post('/api/admin/units/u1/lessons', { title: 'Bunny хичээл', bunnyVideoId: VIDEO });
    expect(res.status).toBe(201);
    lessonId = res.body.id;

    const course = (await admin.get('/api/admin/courses/eng-a1')).body;
    const lesson = course.units[0].lessons.find((l: { id: string }) => l.id === lessonId);
    expect(lesson).toMatchObject({
      bunnyVideoId: VIDEO,
      videoStatus: 'processing',
      videoUrl: `https://${CDN}/${VIDEO}/playlist.m3u8`,
    });
  });

  it('syncs status, duration and MP4 fallback once encoding finishes', async () => {
    videoState = { status: 4, encodeProgress: 100, length: 95.4, availableResolutions: '240p,360p,720p,1080p', hasMP4Fallback: true };
    const res = await admin.post(`/api/admin/lessons/${lessonId}/sync-video`);
    expect(res.body).toMatchObject({ status: 'ready', lengthSec: 95 });

    const path = await request(app).get('/api/courses/eng-a1/pathway').set('Authorization', `Bearer ${learnerToken}`);
    const lesson = path.body.units[0].lessons.find((l: { id: string }) => l.id === lessonId);
    expect(lesson).toMatchObject({
      videoStatus: 'ready',
      durationSec: 95,
      videoUrl: `https://${CDN}/${VIDEO}/playlist.m3u8`,
      videoFallbackUrl: `https://${CDN}/${VIDEO}/play_720p.mp4`,
    });
  });

  it('handles the Bunny webhook only for our library', async () => {
    videoState = { status: 5, encodeProgress: 0, length: 0, availableResolutions: '', hasMP4Fallback: false };
    const other = await request(app).post('/api/webhooks/bunny').send({ VideoLibraryId: 999, VideoGuid: VIDEO, Status: 5 });
    expect(other.body).toEqual({ handled: false });

    const ours = await request(app).post('/api/webhooks/bunny').send({ VideoLibraryId: Number(LIB), VideoGuid: VIDEO, Status: 5 });
    expect(ours.body).toEqual({ handled: true, status: 'error' });
  });

  it('switching back to a plain URL clears the Bunny link', async () => {
    await admin.patch(`/api/admin/lessons/${lessonId}`, { videoUrl: 'https://example.com/v.mp4' }).expect(204);
    const course = (await admin.get('/api/admin/courses/eng-a1')).body;
    const lesson = course.units[0].lessons.find((l: { id: string }) => l.id === lessonId);
    expect(lesson).toMatchObject({ bunnyVideoId: null, videoStatus: 'ready', videoFallbackUrl: null, videoUrl: 'https://example.com/v.mp4' });
  });
});
