import type { Db } from '../db/index.js';
import { conflict, notFound } from '../http/errors.js';
import { getOverview, getRecentLessonCompletions, getRecentQuizAttempts } from '../repositories/admin-stats.repo.js';
import { getAllContentIds, listCourses } from '../repositories/content.repo.js';
import { getLeaderboard } from '../repositories/leaderboard.repo.js';
import { getProgressSets } from '../repositories/progress.repo.js';
import { deleteUser, findUserById, listUsersWithProgress } from '../repositories/user.repo.js';
import type { LearningService } from './learning.service.js';
import { buildProfileStats } from './stats.service.js';

/** Learner monitoring for the admin panel. */
export function createAdminService(db: Db, learning: LearningService) {
  async function requireUser(id: string) {
    const user = await findUserById(db, id);
    if (!user) throw notFound('Хэрэглэгч олдсонгүй.');
    return user;
  }

  return {
    overview: () => getOverview(db),

    leaderboard: (limit: number) => getLeaderboard(db, limit),

    listUsers: () => listUsersWithProgress(db),

    async getUser(id: string) {
      const user = await requireUser(id);
      const [scope, progress, courses] = await Promise.all([
        getAllContentIds(db),
        getProgressSets(db, id),
        listCourses(db),
      ]);
      const [stats, pathways, recentLessons, recentQuizAttempts] = await Promise.all([
        buildProfileStats(db, id, scope, progress),
        Promise.all(courses.map((c) => learning.getPathway(id, c.id))),
        getRecentLessonCompletions(db, id),
        getRecentQuizAttempts(db, id),
      ]);
      return { user, stats, pathways, recentLessons, recentQuizAttempts };
    },

    async resetUserProgress(id: string) {
      await requireUser(id);
      await learning.resetProgress(id);
    },

    async deleteUser(actingAdminId: string, id: string) {
      if (actingAdminId === id) throw conflict('CANNOT_DELETE_SELF', 'Өөрийн бүртгэлийг устгах боломжгүй.');
      if (!(await deleteUser(db, id))) throw notFound('Хэрэглэгч олдсонгүй.');
    },
  };
}

export type AdminService = ReturnType<typeof createAdminService>;
