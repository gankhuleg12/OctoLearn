/**
 * XP / level / streak rules. Pure functions so they are unit-testable.
 */

/** XP for each correct quiz answer — awarded only on the first passing attempt. */
export const QUIZ_XP_PER_CORRECT = 5;
/** Bonus XP for passing a quiz the first time. */
export const QUIZ_PASS_BONUS_XP = 20;
/** XP needed per level (flat curve keeps the prototype predictable). */
export const XP_PER_LEVEL = 100;

export interface QuizGrade {
  correctCount: number;
  totalCount: number;
  scorePercent: number;
  passed: boolean;
}

export function gradeQuiz(correctCount: number, totalCount: number, passPercent: number): QuizGrade {
  const scorePercent = totalCount === 0 ? 0 : Math.round((correctCount / totalCount) * 100);
  return { correctCount, totalCount, scorePercent, passed: scorePercent >= passPercent };
}

/**
 * Quiz XP is granted once: on the first passing attempt. Failed attempts and
 * retakes of an already-passed quiz give 0 XP, so XP cannot be farmed.
 */
export function quizXp(grade: QuizGrade, alreadyPassed: boolean): number {
  if (!grade.passed || alreadyPassed) return 0;
  return grade.correctCount * QUIZ_XP_PER_CORRECT + QUIZ_PASS_BONUS_XP;
}

export interface LevelInfo {
  level: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
}

export function levelFromXp(totalXp: number): LevelInfo {
  const xp = Math.max(0, totalXp);
  return {
    level: Math.floor(xp / XP_PER_LEVEL) + 1,
    xpIntoLevel: xp % XP_PER_LEVEL,
    xpForNextLevel: XP_PER_LEVEL,
  };
}

/** "YYYY-MM-DD" for the given instant in the given IANA timezone. */
export function dayKey(date: Date, timeZone: string): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

function shiftDayKey(key: string, days: number): string {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Consecutive days with activity, counting back from today. If there is no
 * activity today yet, the streak is still alive when yesterday was active.
 */
export function computeStreak(activeDays: Iterable<string>, today: string): number {
  const days = new Set(activeDays);
  let cursor = days.has(today) ? today : shiftDayKey(today, -1);
  let streak = 0;
  while (days.has(cursor)) {
    streak++;
    cursor = shiftDayKey(cursor, -1);
  }
  return streak;
}

export interface DailyXp {
  date: string;
  xp: number;
}

/** XP per day for the 7 days ending today (oldest first), zero-filled. */
export function lastSevenDays(xpByDay: ReadonlyMap<string, number>, today: string): DailyXp[] {
  return Array.from({ length: 7 }, (_, i) => {
    const date = shiftDayKey(today, i - 6);
    return { date, xp: xpByDay.get(date) ?? 0 };
  });
}
