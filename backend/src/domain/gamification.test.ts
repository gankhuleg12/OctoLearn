import { describe, expect, it } from 'vitest';
import { computeStreak, dayKey, gradeQuiz, lastSevenDays, levelFromXp, quizXp } from './gamification.js';

describe('gradeQuiz / quizXp', () => {
  it('passes at exactly the pass percent', () => {
    expect(gradeQuiz(3, 5, 60)).toEqual({ correctCount: 3, totalCount: 5, scorePercent: 60, passed: true });
    expect(gradeQuiz(2, 5, 60).passed).toBe(false);
  });

  it('awards XP only on the first pass', () => {
    const pass = gradeQuiz(4, 5, 60);
    expect(quizXp(pass, false)).toBe(4 * 5 + 20);
    expect(quizXp(pass, true)).toBe(0);
    expect(quizXp(gradeQuiz(1, 5, 60), false)).toBe(0);
  });
});

describe('levelFromXp', () => {
  it('starts at level 1 and rises every 100 XP', () => {
    expect(levelFromXp(0)).toEqual({ level: 1, xpIntoLevel: 0, xpForNextLevel: 100 });
    expect(levelFromXp(250)).toEqual({ level: 3, xpIntoLevel: 50, xpForNextLevel: 100 });
  });
});

describe('streak', () => {
  it('counts consecutive days ending today', () => {
    expect(computeStreak(['2026-11-01', '2026-11-02', '2026-10-31'], '2026-11-02')).toBe(3);
  });

  it('stays alive if yesterday was active but today not yet', () => {
    expect(computeStreak(['2026-11-01', '2026-10-31'], '2026-11-02')).toBe(2);
  });

  it('breaks on a gap', () => {
    expect(computeStreak(['2026-11-02', '2026-10-31'], '2026-11-02')).toBe(1);
    expect(computeStreak(['2026-10-30'], '2026-11-02')).toBe(0);
  });

  it('handles month boundaries', () => {
    expect(computeStreak(['2026-12-01', '2026-11-30'], '2026-12-01')).toBe(2);
  });
});

describe('dayKey', () => {
  it('buckets by the given timezone', () => {
    // 2026-11-01 20:00 UTC is already 2026-11-02 04:00 in Ulaanbaatar (UTC+8).
    const d = new Date('2026-11-01T20:00:00Z');
    expect(dayKey(d, 'UTC')).toBe('2026-11-01');
    expect(dayKey(d, 'Asia/Ulaanbaatar')).toBe('2026-11-02');
  });
});

describe('lastSevenDays', () => {
  it('returns 7 zero-filled days, oldest first', () => {
    const days = lastSevenDays(new Map([['2026-11-02', 30], ['2026-10-28', 10]]), '2026-11-02');
    expect(days).toHaveLength(7);
    expect(days[0]).toEqual({ date: '2026-10-27', xp: 0 });
    expect(days[1]).toEqual({ date: '2026-10-28', xp: 10 });
    expect(days[6]).toEqual({ date: '2026-11-02', xp: 30 });
  });
});
