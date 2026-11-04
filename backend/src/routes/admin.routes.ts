import { Router } from 'express';
import { z } from 'zod';
import { SeedSchema } from '../db/seed.js';
import { authOf } from '../http/auth.js';
import type { AdminService } from '../services/admin.service.js';
import type { ContentAdminService } from '../services/content-admin.service.js';
import type { BunnyService } from '../services/bunny.service.js';
import type { UserService } from '../services/user.service.js';

const text = (max: number, label: string) => z.string().trim().min(1, `${label} хоосон байж болохгүй.`).max(max);

const CourseBody = z.object({
  title: text(120, 'Гарчиг'),
  description: z.string().trim().max(1000).default(''),
});

const UnitBody = CourseBody;
const UnitPatch = UnitBody.partial().extend({ published: z.boolean().optional() });

// Fields without defaults so a PATCH leaves omitted fields untouched.
const LessonFields = z.object({
  title: text(120, 'Гарчиг').optional(),
  description: z.string().trim().max(1000).optional(),
  videoUrl: z.url('Видеоны URL буруу байна.').optional(),
  bunnyVideoId: z.uuid('Bunny видеоны ID буруу байна.').optional(),
  durationSec: z.number().int().positive().max(4 * 3600).optional(),
  xp: z.number().int().min(0).max(1000).optional(),
});
const oneVideoSource = (b: z.infer<typeof LessonFields>) => !(b.videoUrl && b.bunnyVideoId);

const LessonBody = LessonFields.refine((b) => b.title !== undefined, { message: 'Гарчиг оруулна уу.', path: ['title'] })
  .refine((b) => b.videoUrl || b.bunnyVideoId, { message: 'Видеоны URL эсвэл Bunny видео сонгоно уу.', path: ['videoUrl'] })
  .refine(oneVideoSource, { message: 'URL эсвэл Bunny видеоны аль нэгийг л сонгоно.', path: ['videoUrl'] })
  // A plain URL has no metadata to read the length from; Bunny reports it after encoding.
  .refine((b) => !b.videoUrl || b.durationSec !== undefined, {
    message: 'Үргэлжлэх хугацааг оруулна уу.',
    path: ['durationSec'],
  });
const LessonPatch = LessonFields.refine(oneVideoSource, {
  message: 'URL эсвэл Bunny видеоны аль нэгийг л сонгоно.',
  path: ['videoUrl'],
});

const BunnySettingsBody = z.object({
  libraryId: z.string().trim().regex(/^\d+$/, 'Library ID нь тоо байна.'),
  apiKey: z.string().trim().max(200).optional(),
  cdnHostname: z
    .string()
    .trim()
    .min(3, 'CDN hostname оруулна уу.')
    .regex(/^(https?:\/\/)?[a-z0-9.-]+\.[a-z]{2,}\/?$/i, 'CDN hostname буруу байна (жишээ: vz-abc123.b-cdn.net).'),
  apiBaseUrl: z.url('API хаяг буруу байна.').optional().or(z.literal('')),
});
const UploadBody = z.object({ title: text(200, 'Гарчиг') });

const QuizBody = z.object({
  title: text(120, 'Гарчиг'),
  passPercent: z.number().int().min(1).max(100).default(60),
  questions: z
    .array(
      z
        .object({
          id: z.string().optional(),
          text: text(300, 'Асуулт'),
          options: z.array(text(150, 'Сонголт')).min(2, 'Дор хаяж 2 сонголт.').max(6),
          answerIndex: z.number().int().nonnegative(),
        })
        .refine((q) => q.answerIndex < q.options.length, {
          message: 'Зөв хариулт сонголтуудын дотор байх ёстой.',
          path: ['answerIndex'],
        }),
    )
    .min(1, 'Дор хаяж 1 асуулт нэмнэ үү.')
    .max(20),
});

const OrderBody = z.object({ ids: z.array(z.string()).min(1) });
const LeaderboardQuery = z.object({ limit: z.coerce.number().int().min(1).max(100).default(20) });

export function adminRoutes(
  admin: AdminService,
  content: ContentAdminService,
  users: UserService,
  bunny: BunnyService,
): Router {
  const r = Router();

  // ---- settings: Bunny Stream -------------------------------------------------

  r.get('/settings/bunny', async (_req, res) => {
    res.json(await bunny.getPublicConfig());
  });

  r.put('/settings/bunny', async (req, res) => {
    await bunny.saveConfig(BunnySettingsBody.parse(req.body));
    res.json(await bunny.getPublicConfig());
  });

  r.delete('/settings/bunny', async (_req, res) => {
    await bunny.clearConfig();
    res.status(204).end();
  });

  r.post('/settings/bunny/test', async (_req, res) => {
    res.json(await bunny.testConnection());
  });

  // ---- Bunny uploads ---------------------------------------------------------

  /** Creates the video in the library and returns a signed TUS upload ticket. */
  r.post('/bunny/uploads', async (req, res) => {
    res.status(201).json(await bunny.createUpload(UploadBody.parse(req.body).title));
  });

  r.get('/bunny/videos/:videoId', async (req, res) => {
    res.json(await bunny.getVideo(req.params.videoId));
  });

  /** Re-reads the lesson's Bunny video (status, duration, MP4 fallback). */
  r.post('/lessons/:lessonId/sync-video', async (req, res) => {
    res.json(await bunny.syncLesson(req.params.lessonId));
  });

  // ---- monitoring ----------------------------------------------------------

  r.get('/overview', async (_req, res) => {
    res.json(await admin.overview());
  });

  r.get('/leaderboard', async (req, res) => {
    res.json({ entries: await admin.leaderboard(LeaderboardQuery.parse(req.query).limit) });
  });

  r.get('/users', async (_req, res) => {
    res.json({ users: await users.listUsers() });
  });

  r.get('/users/:userId', async (req, res) => {
    res.json(await admin.getUser(req.params.userId));
  });

  r.post('/users/:userId/reset-progress', async (req, res) => {
    await admin.resetUserProgress(req.params.userId);
    res.status(204).end();
  });

  r.delete('/users/:userId', async (req, res) => {
    await admin.deleteUser(authOf(req).userId, req.params.userId);
    res.status(204).end();
  });

  // ---- courses -------------------------------------------------------------

  r.get('/courses', async (_req, res) => {
    res.json({ courses: await content.listCourses() });
  });

  r.post('/courses/import', async (req, res) => {
    res.json(await content.importCourse(SeedSchema.parse({ ...req.body, users: [] })));
  });

  r.get('/courses/:courseId', async (req, res) => {
    res.json(await content.getCourse(req.params.courseId));
  });

  r.patch('/courses/:courseId', async (req, res) => {
    res.json(await content.updateCourse(req.params.courseId, CourseBody.partial().parse(req.body)));
  });

  r.get('/courses/:courseId/export', async (req, res) => {
    res.attachment(`${req.params.courseId}.json`).json(await content.exportCourse(req.params.courseId));
  });

  // ---- units ---------------------------------------------------------------

  r.post('/courses/:courseId/units', async (req, res) => {
    res.status(201).json(await content.createUnit(req.params.courseId, UnitBody.parse(req.body)));
  });

  r.put('/courses/:courseId/units/order', async (req, res) => {
    await content.reorderUnits(req.params.courseId, OrderBody.parse(req.body).ids);
    res.status(204).end();
  });

  r.patch('/units/:unitId', async (req, res) => {
    await content.updateUnit(req.params.unitId, UnitPatch.parse(req.body));
    res.status(204).end();
  });

  r.delete('/units/:unitId', async (req, res) => {
    await content.deleteUnit(req.params.unitId);
    res.status(204).end();
  });

  // ---- lessons -------------------------------------------------------------

  r.post('/units/:unitId/lessons', async (req, res) => {
    res.status(201).json(await content.createLesson(req.params.unitId, LessonBody.parse(req.body)));
  });

  r.put('/units/:unitId/lessons/order', async (req, res) => {
    await content.reorderLessons(req.params.unitId, OrderBody.parse(req.body).ids);
    res.status(204).end();
  });

  r.patch('/lessons/:lessonId', async (req, res) => {
    await content.updateLesson(req.params.lessonId, LessonPatch.parse(req.body));
    res.status(204).end();
  });

  r.delete('/lessons/:lessonId', async (req, res) => {
    await content.deleteLesson(req.params.lessonId);
    res.status(204).end();
  });

  // ---- quiz (one per unit) -------------------------------------------------

  r.put('/units/:unitId/quiz', async (req, res) => {
    res.json(await content.saveQuiz(req.params.unitId, QuizBody.parse(req.body)));
  });

  r.delete('/units/:unitId/quiz', async (req, res) => {
    await content.deleteQuiz(req.params.unitId);
    res.status(204).end();
  });

  return r;
}
