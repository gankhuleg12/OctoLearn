import type { Db } from '../db/index.js';
import { seed, type SeedData } from '../db/seed.js';
import { HttpError, badRequest, notFound } from '../http/errors.js';
import {
  deleteLesson,
  deleteQuizOfUnit,
  deleteUnit,
  getAdminCourse,
  getUnitCourseId,
  insertLesson,
  insertUnit,
  listCoursesWithCounts,
  reorder,
  updateCourse,
  updateLesson,
  updateUnit,
  upsertQuiz,
  type LessonVideo,
  type QuizInput,
  type UnitInput,
} from '../repositories/admin-content.repo.js';
import { playbackUrls, type BunnyService } from './bunny.service.js';

const unitNotFound = () => notFound('Бүлэг олдсонгүй.');
const lessonNotFound = () => notFound('Хичээл олдсонгүй.');

/** Lesson fields from the admin form; the video is either a URL or a Bunny Stream video. */
export interface LessonFormInput {
  title?: string;
  description?: string;
  durationSec?: number;
  xp?: number;
  videoUrl?: string;
  bunnyVideoId?: string;
}

/** Course / unit / lesson / quiz editing for the admin panel. */
export function createContentAdminService(db: Db, bunny: BunnyService) {
  /** Turns the form's video choice into stored columns; undefined = leave video unchanged. */
  async function resolveVideo(input: LessonFormInput): Promise<LessonVideo | undefined> {
    if (input.videoUrl) {
      return { videoUrl: input.videoUrl, videoFallbackUrl: null, videoStatus: 'ready', bunnyVideoId: null };
    }
    if (input.bunnyVideoId) {
      const cfg = await bunny.readConfig();
      if (!cfg) throw new HttpError(409, 'BUNNY_NOT_CONFIGURED', 'Bunny Stream тохируулаагүй байна.');
      return {
        videoUrl: playbackUrls(cfg.cdnHostname, input.bunnyVideoId).playlist,
        videoFallbackUrl: null,
        videoStatus: 'processing',
        bunnyVideoId: input.bunnyVideoId,
      };
    }
    return undefined;
  }

  /** Best effort: pick up status/duration right away if Bunny already finished. */
  async function refreshBunny(video: LessonVideo | undefined) {
    if (!video?.bunnyVideoId) return;
    await bunny.syncVideo(video.bunnyVideoId).catch(() => {});
  }

  async function requireCourse(courseId: string) {
    const course = await getAdminCourse(db, courseId);
    if (!course) throw notFound('Курс олдсонгүй.');
    return course;
  }

  async function requireUnit(unitId: string) {
    if (!(await getUnitCourseId(db, unitId))) throw unitNotFound();
  }

  return {
    listCourses: () => listCoursesWithCounts(db),

    getCourse: requireCourse,

    async updateCourse(courseId: string, patch: Partial<UnitInput>) {
      if (!(await updateCourse(db, courseId, patch))) throw notFound('Курс олдсонгүй.');
      return requireCourse(courseId);
    },

    /** Same shape as `seed-data/course.json`, so it can be re-imported. */
    async exportCourse(courseId: string) {
      const c = await requireCourse(courseId);
      return {
        course: { id: c.id, title: c.title, description: c.description },
        units: c.units.map((u) => ({
          id: u.id,
          title: u.title,
          description: u.description,
          published: u.published,
          lessons: u.lessons.map(({ id, title, description, videoUrl, durationSec, xp }) => ({
            id,
            title,
            description,
            videoUrl,
            durationSec,
            xp,
          })),
          quiz: u.quiz && {
            id: u.quiz.id,
            title: u.quiz.title,
            passPercent: u.quiz.passPercent,
            questions: u.quiz.questions.map(({ id, text, options, answerIndex }) => ({ id, text, options, answerIndex })),
          },
        })),
      };
    },

    /** Upserts a whole course from the export / seed JSON format. */
    async importCourse(data: SeedData) {
      await seed(db, data);
      return requireCourse(data.course.id);
    },

    async createUnit(courseId: string, input: UnitInput) {
      await requireCourse(courseId);
      const id = await insertUnit(db, courseId, input);
      return (await requireCourse(courseId)).units.find((u) => u.id === id)!;
    },

    async updateUnit(unitId: string, patch: Partial<UnitInput> & { published?: boolean }) {
      if (!(await updateUnit(db, unitId, patch))) throw unitNotFound();
    },

    async deleteUnit(unitId: string) {
      if (!(await deleteUnit(db, unitId))) throw unitNotFound();
    },

    async reorderUnits(courseId: string, ids: string[]) {
      await requireCourse(courseId);
      const ok = await db.tx((q) => reorder(q, 'units', 'course_id', courseId, ids));
      if (!ok) throw badRequest('Бүлгийн жагсаалт таарахгүй байна. Хуудсаа шинэчилнэ үү.');
    },

    async createLesson(unitId: string, input: LessonFormInput) {
      await requireUnit(unitId);
      const video = await resolveVideo(input);
      if (!video) throw badRequest('Видеоны URL эсвэл Bunny видео сонгоно уу.');
      const id = await insertLesson(db, unitId, {
        title: input.title!,
        description: input.description ?? '',
        xp: input.xp ?? 10,
        // Bunny reports the real length after encoding; sync fills it in.
        durationSec: input.durationSec ?? 1,
        ...video,
      });
      await refreshBunny(video);
      return { id };
    },

    async updateLesson(lessonId: string, input: LessonFormInput) {
      const video = await resolveVideo(input);
      const ok = await updateLesson(db, lessonId, {
        title: input.title,
        description: input.description,
        durationSec: input.durationSec,
        xp: input.xp,
        video,
      });
      if (!ok) throw lessonNotFound();
      await refreshBunny(video);
    },

    async deleteLesson(lessonId: string) {
      if (!(await deleteLesson(db, lessonId))) throw lessonNotFound();
    },

    async reorderLessons(unitId: string, ids: string[]) {
      await requireUnit(unitId);
      const ok = await db.tx((q) => reorder(q, 'lessons', 'unit_id', unitId, ids));
      if (!ok) throw badRequest('Хичээлийн жагсаалт таарахгүй байна. Хуудсаа шинэчилнэ үү.');
    },

    async saveQuiz(unitId: string, input: QuizInput) {
      await requireUnit(unitId);
      return { id: await db.tx((q) => upsertQuiz(q, unitId, input)) };
    },

    async deleteQuiz(unitId: string) {
      if (!(await deleteQuizOfUnit(db, unitId))) throw notFound('Шалгалт олдсонгүй.');
    },
  };
}

export type ContentAdminService = ReturnType<typeof createContentAdminService>;
