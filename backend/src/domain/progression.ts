/**
 * Pathway unlocking rules. Pure functions — no I/O — so they are easy to test
 * and could be shared with the mobile app later.
 *
 * The course is a single linear path: u1-l1 … u1-l5, u1-quiz, u2-l1 … .
 * The first unfinished node is `active`, every other unfinished node is
 * `locked`, and finished nodes are always `completed` — so when an admin
 * inserts a new lesson early in the path, the learner must take it next but
 * does not lose the progress already made further along.
 */

export type NodeState = 'completed' | 'active' | 'locked';
export type NodeKind = 'lesson' | 'quiz';

export interface PathNodeRef {
  kind: NodeKind;
  id: string;
  unitId: string;
}

export interface CourseOutline {
  units: { id: string; lessonIds: string[]; quizId: string | null }[];
}

export interface UserProgressSets {
  completedLessonIds: ReadonlySet<string>;
  passedQuizIds: ReadonlySet<string>;
}

export function flattenPath(outline: CourseOutline): PathNodeRef[] {
  return outline.units.flatMap((u) => [
    ...u.lessonIds.map((id): PathNodeRef => ({ kind: 'lesson', id, unitId: u.id })),
    ...(u.quizId ? [{ kind: 'quiz', id: u.quizId, unitId: u.id } as PathNodeRef] : []),
  ]);
}

function isDone(node: PathNodeRef, progress: UserProgressSets): boolean {
  return node.kind === 'lesson'
    ? progress.completedLessonIds.has(node.id)
    : progress.passedQuizIds.has(node.id);
}

/** Returns state for every node id (lesson and quiz ids are globally unique). */
export function computeNodeStates(outline: CourseOutline, progress: UserProgressSets): Map<string, NodeState> {
  const states = new Map<string, NodeState>();
  let activeFound = false;
  for (const node of flattenPath(outline)) {
    if (isDone(node, progress)) {
      states.set(node.id, 'completed');
    } else if (activeFound) {
      states.set(node.id, 'locked');
    } else {
      states.set(node.id, 'active');
      activeFound = true;
    }
  }
  return states;
}

export function computeUnitState(
  unit: CourseOutline['units'][number],
  nodeStates: ReadonlyMap<string, NodeState>,
): NodeState {
  const ids = [...unit.lessonIds, ...(unit.quizId ? [unit.quizId] : [])];
  const states = ids.map((id) => nodeStates.get(id));
  if (states.length === 0) return 'locked';
  if (states.every((s) => s === 'completed')) return 'completed';
  if (states.some((s) => s === 'active')) return 'active';
  return 'locked';
}

/** The node the learner should open next, or null when the course is finished. */
export function findActiveNode(outline: CourseOutline, progress: UserProgressSets): PathNodeRef | null {
  return flattenPath(outline).find((n) => !isDone(n, progress)) ?? null;
}
