// Mirrors the backend responses (backend/src/services/*). Keep in sync.

export type NodeState = 'completed' | 'active' | 'locked';
export type NodeKind = 'lesson' | 'quiz';

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  role: 'learner' | 'admin';
  createdAt: string;
}

export interface Session {
  token: string;
  user: User;
}

export interface ProgressSummary {
  completedLessons: number;
  totalLessons: number;
  passedQuizzes: number;
  totalQuizzes: number;
  percent: number;
  totalXp: number;
  level: number;
  streak: number;
}

export interface Lesson {
  id: string;
  unitId: string;
  position: number;
  title: string;
  description: string;
  videoUrl: string;
  /** MP4 rendition for players without HLS (web). Older caches may lack it. */
  videoFallbackUrl?: string | null;
  /** 'processing' while Bunny Stream is still encoding the upload. */
  videoStatus?: 'ready' | 'processing' | 'error';
  durationSec: number;
  xp: number;
  state: NodeState;
}

export interface QuizMeta {
  id: string;
  unitId: string;
  title: string;
  passPercent: number;
  questionCount: number;
  state: NodeState;
  bestScore: number | null;
}

export interface Unit {
  id: string;
  position: number;
  title: string;
  description: string;
  state: NodeState;
  lessons: Lesson[];
  quiz: QuizMeta | null;
}

export interface PathNodeRef {
  kind: NodeKind;
  id: string;
  unitId: string;
}

export interface Pathway {
  course: { id: string; title: string; description: string };
  units: Unit[];
  activeNode: PathNodeRef | null;
  summary: ProgressSummary;
}

export interface CompleteLessonResult {
  lessonId: string;
  alreadyCompleted: boolean;
  xpEarned: number;
  nextNode: PathNodeRef | null;
  summary: ProgressSummary;
}

export interface QuizQuestion {
  id: string;
  position: number;
  text: string;
  options: string[];
}

export interface Quiz {
  id: string;
  title: string;
  unitId: string;
  unitTitle: string;
  passPercent: number;
  state: NodeState;
  questions: QuizQuestion[];
}

export interface CheckAnswerResult {
  questionId: string;
  correct: boolean;
  correctIndex: number;
}

export interface QuizAnswer {
  questionId: string;
  answerIndex: number;
}

export interface QuizSubmitResult {
  attemptId: number;
  quizId: string;
  correctCount: number;
  totalCount: number;
  scorePercent: number;
  passed: boolean;
  passPercent: number;
  xpEarned: number;
  alreadyPassed: boolean;
  nextNode: PathNodeRef | null;
  unlockedUnitId: string | null;
  summary: ProgressSummary;
}

export interface DailyXp {
  date: string;
  xp: number;
}

export interface ProfileStats extends ProgressSummary {
  levelInfo: { level: number; xpIntoLevel: number; xpForNextLevel: number };
  quizzesAttempted: number;
  averageQuizScore: number | null;
  weeklyActivity: DailyXp[];
}

export interface Profile {
  user: User;
  stats: ProfileStats;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  avatarUrl: string | null;
  totalXp: number;
}

export interface Leaderboard {
  entries: LeaderboardEntry[];
  me: LeaderboardEntry | null;
}
