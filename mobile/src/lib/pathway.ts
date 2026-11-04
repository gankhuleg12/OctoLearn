import type { Lesson, NodeState, PathNodeRef, Pathway, ProgressSummary, QuizMeta, Unit } from '@/api/types';

export type PathItem =
  | { kind: 'lesson'; unit: Unit; lesson: Lesson; indexInUnit: number }
  | { kind: 'quiz'; unit: Unit; quiz: QuizMeta };

/** Flattens the pathway into the order nodes appear on screen. */
export function pathItems(pathway: Pathway): PathItem[] {
  return pathway.units.flatMap((unit) => [
    ...unit.lessons.map((lesson, indexInUnit): PathItem => ({ kind: 'lesson', unit, lesson, indexInUnit })),
    ...(unit.quiz ? [{ kind: 'quiz', unit, quiz: unit.quiz } as PathItem] : []),
  ]);
}

export function findLesson(pathway: Pathway | null, lessonId: string) {
  if (!pathway) return null;
  for (const unit of pathway.units) {
    const index = unit.lessons.findIndex((l) => l.id === lessonId);
    if (index >= 0) return { unit, lesson: unit.lessons[index]!, index };
  }
  return null;
}

function unitState(unit: Unit): NodeState {
  const states = [...unit.lessons.map((l) => l.state), ...(unit.quiz ? [unit.quiz.state] : [])];
  if (states.length && states.every((s) => s === 'completed')) return 'completed';
  if (states.includes('active')) return 'active';
  return 'locked';
}

/**
 * Applies a lesson/quiz result locally so the pathway updates instantly; the
 * store then refetches to confirm with the server (source of truth).
 */
export function applyProgress(
  pathway: Pathway,
  completedId: string,
  nextNode: PathNodeRef | null,
  summary: ProgressSummary,
): Pathway {
  const stateFor = (id: string, current: NodeState): NodeState => {
    if (id === completedId) return 'completed';
    if (id === nextNode?.id) return 'active';
    return current === 'active' ? 'locked' : current;
  };
  const units = pathway.units.map((u) => {
    const next: Unit = {
      ...u,
      lessons: u.lessons.map((l) => ({ ...l, state: stateFor(l.id, l.state) })),
      quiz: u.quiz ? { ...u.quiz, state: stateFor(u.quiz.id, u.quiz.state) } : null,
    };
    return { ...next, state: unitState(next) };
  });
  return { ...pathway, units, activeNode: nextNode, summary };
}
