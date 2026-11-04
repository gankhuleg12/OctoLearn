import { describe, expect, it } from 'vitest';
import { computeNodeStates, computeUnitState, findActiveNode, type CourseOutline } from './progression.js';

const outline: CourseOutline = {
  units: [
    { id: 'u1', lessonIds: ['a', 'b'], quizId: 'q1' },
    { id: 'u2', lessonIds: ['c'], quizId: 'q2' },
  ],
};

const progress = (lessons: string[], quizzes: string[] = []) => ({
  completedLessonIds: new Set(lessons),
  passedQuizIds: new Set(quizzes),
});

describe('computeNodeStates', () => {
  it('makes only the first lesson active for a new user', () => {
    const s = computeNodeStates(outline, progress([]));
    expect(Object.fromEntries(s)).toEqual({ a: 'active', b: 'locked', q1: 'locked', c: 'locked', q2: 'locked' });
  });

  it('unlocks the quiz after all unit lessons are done', () => {
    const s = computeNodeStates(outline, progress(['a', 'b']));
    expect(s.get('q1')).toBe('active');
    expect(s.get('c')).toBe('locked');
  });

  it('keeps the next unit locked until the quiz is passed', () => {
    expect(computeNodeStates(outline, progress(['a', 'b'])).get('c')).toBe('locked');
    expect(computeNodeStates(outline, progress(['a', 'b'], ['q1'])).get('c')).toBe('active');
  });

  it('keeps later completed items when an earlier gap appears (lesson inserted by admin)', () => {
    const s = computeNodeStates(outline, progress(['b', 'c'], ['q1']));
    expect(s.get('a')).toBe('active');
    expect(s.get('b')).toBe('completed');
    expect(s.get('q1')).toBe('completed');
    expect(s.get('c')).toBe('completed');
    expect(s.get('q2')).toBe('locked');
  });

  it('treats an empty unit as locked', () => {
    expect(computeUnitState({ id: 'x', lessonIds: [], quizId: null }, new Map())).toBe('locked');
  });
});

describe('computeUnitState / findActiveNode', () => {
  it('derives unit states', () => {
    const s = computeNodeStates(outline, progress(['a', 'b'], ['q1']));
    expect(computeUnitState(outline.units[0]!, s)).toBe('completed');
    expect(computeUnitState(outline.units[1]!, s)).toBe('active');
  });

  it('returns null when the course is finished', () => {
    expect(findActiveNode(outline, progress(['a', 'b', 'c'], ['q1', 'q2']))).toBeNull();
    expect(findActiveNode(outline, progress(['a']))).toEqual({ kind: 'lesson', id: 'b', unitId: 'u1' });
  });
});
