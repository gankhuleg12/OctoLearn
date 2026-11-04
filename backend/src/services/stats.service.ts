import { config } from '../config.js';
import type { Queryable } from '../db/index.js';
import { computeStreak, dayKey, lastSevenDays, levelFromXp, type DailyXp, type LevelInfo } from '../domain/gamification.js';
import type { UserProgressSets } from '../domain/progression.js';
import { getActivitySince, getBestQuizScores, getTotalXp } from '../repositories/progress.repo.js';

/** Shown in the pathway top bar — refreshed after every lesson / quiz. */
export interface ProgressSummary {
  completedLessons: number;
  totalLessons: number;
  passedQuizzes: number;
  totalQuizzes: number;
  /** (completed lessons + passed quizzes) / (all lessons + quizzes), 0–100. */
  percent: number;
  totalXp: number;
  level: number;
  streak: number;
}

export interface ProfileStats extends ProgressSummary {
  levelInfo: LevelInfo;
  quizzesAttempted: number;
  /** Average of the best score of each attempted quiz, 0–100; null if none attempted. */
  averageQuizScore: number | null;
  weeklyActivity: DailyXp[];
}

const ACTIVITY_LOOKBACK_DAYS = 60;

async function activityStats(q: Queryable, userId: string, now: Date) {
  const since = new Date(now.getTime() - ACTIVITY_LOOKBACK_DAYS * 86_400_000);
  const events = await getActivitySince(q, userId, since);
  const xpByDay = new Map<string, number>();
  for (const e of events) {
    const key = dayKey(new Date(e.at), config.timezone);
    xpByDay.set(key, (xpByDay.get(key) ?? 0) + e.xp);
  }
  const today = dayKey(now, config.timezone);
  return { streak: computeStreak(xpByDay.keys(), today), weeklyActivity: lastSevenDays(xpByDay, today) };
}

function countIn(ids: readonly string[], set: ReadonlySet<string>): number {
  return ids.filter((id) => set.has(id)).length;
}

export interface ContentScope {
  lessonIds: readonly string[];
  quizIds: readonly string[];
}

function summarize(scope: ContentScope, progress: UserProgressSets, totalXp: number, streak: number): ProgressSummary {
  const completedLessons = countIn(scope.lessonIds, progress.completedLessonIds);
  const passedQuizzes = countIn(scope.quizIds, progress.passedQuizIds);
  const totalNodes = scope.lessonIds.length + scope.quizIds.length;
  return {
    completedLessons,
    totalLessons: scope.lessonIds.length,
    passedQuizzes,
    totalQuizzes: scope.quizIds.length,
    percent: totalNodes === 0 ? 0 : Math.round(((completedLessons + passedQuizzes) / totalNodes) * 100),
    totalXp,
    level: levelFromXp(totalXp).level,
    streak,
  };
}

export async function buildSummary(
  q: Queryable,
  userId: string,
  scope: ContentScope,
  progress: UserProgressSets,
  now = new Date(),
): Promise<ProgressSummary> {
  const [totalXp, activity] = await Promise.all([getTotalXp(q, userId), activityStats(q, userId, now)]);
  return summarize(scope, progress, totalXp, activity.streak);
}

export async function buildProfileStats(
  q: Queryable,
  userId: string,
  scope: ContentScope,
  progress: UserProgressSets,
  now = new Date(),
): Promise<ProfileStats> {
  const [totalXp, best, activity] = await Promise.all([
    getTotalXp(q, userId),
    getBestQuizScores(q, userId),
    activityStats(q, userId, now),
  ]);
  const summary = summarize(scope, progress, totalXp, activity.streak);
  return {
    ...summary,
    levelInfo: levelFromXp(summary.totalXp),
    quizzesAttempted: best.length,
    averageQuizScore: best.length ? Math.round(best.reduce((s, r) => s + r.bestScore, 0) / best.length) : null,
    weeklyActivity: activity.weeklyActivity,
  };
}
