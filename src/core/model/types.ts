/**
 * Domain model. Pure data, serialisable to JSON.
 * Money is always stored as integer agorot (1 ₪ = 100 agorot) to avoid float drift.
 */

export type Id = string;
/** Week id = local date (YYYY-MM-DD) of the first day of the week (Sunday by default, Israeli week). */
export type WeekId = string;
/** Integer agorot. */
export type Agorot = number;

export interface Parent {
  id: Id;
  name: string;
}

export interface Child {
  id: Id;
  name: string;
  /** Emoji avatar. */
  avatar: string;
}

export interface SkillCategory {
  id: Id;
  name: string;
  /** Emoji shown as the category icon. */
  icon: string;
  /** Opaque key into the design layer's category palette (e.g. "coral"). Core never interprets it. */
  colorKey: string;
  enabled: boolean;
  /** True for the 5 default categories; custom ones are false. */
  builtIn: boolean;
  order: number;
}

/** Quiz topics the drill engine can generate (see core/drills). */
export type QuizTopic =
  | 'times-tables'
  | 'mental-math'
  | 'fractions'
  | 'geometry'
  | 'word-problems'
  | 'math-mix'
  | 'en-vocab'
  | 'en-sentences'
  | 'en-fill'
  | 'en-mix';

/** A generated quiz: N questions, pass with at least `passScore` correct. */
export interface QuizDrillSpec {
  kind: 'quiz';
  topic: QuizTopic;
  /** Number of questions (3..20). */
  length: number;
  /** Correct answers needed to pass (1..length). */
  passScore: number;
  /** Passing credits the reward + XP immediately (no parent approval). */
  autoApprove: boolean;
  /** Times-tables only: focus on one table (2..15). */
  table?: number;
}

/** A guided real-world activity (steps checklist, optional timers) that a parent approves. */
export interface GuidedDrillSpec {
  kind: 'guided';
  templateId: string;
}

export type DrillSpec = QuizDrillSpec | GuidedDrillSpec;

export interface Quest {
  id: Id;
  categoryId: Id;
  title: string;
  description: string;
  reward: Agorot;
  xp: number;
  active: boolean;
  /** Absent = legacy "mark as done" quest. */
  drill?: DrillSpec;
}

export type CompletionStatus = 'todo' | 'submitted' | 'approved' | 'rejected';

export interface LevelChange {
  categoryId: Id;
  from: number;
  to: number;
}

export interface QuestCompletion {
  id: Id;
  questId: Id;
  childId: Id;
  weekId: WeekId;
  /** Stored records are never 'todo'; 'todo' is derived when no record exists for the week. */
  status: Exclude<CompletionStatus, 'todo'>;
  submittedAt: string;
  decidedAt?: string;
  /** Snapshot of the reward/xp at submission, so later edits don't change history. */
  reward: Agorot;
  xp: number;
  note?: string;
  levelChange?: LevelChange;
  /** Child has seen the celebration for this approval. */
  celebrated?: boolean;
  /** Quiz result that produced this completion. */
  drill?: { attemptId: Id; correct: number; total: number };
  /** Guided activity: steps the child marked + what they told the parent. */
  guided?: { templateId: string; stepsDone: number; stepsTotal: number; note?: string };
  /** Approved automatically by passing a quiz (no parent step). */
  autoApproved?: boolean;
  /** Set when the credited reward was capped by the locked deposit: the full quest reward. */
  rewardRequested?: Agorot;
}

/** One finished quiz attempt (kept as history; best score is derived). */
export interface DrillAttempt {
  id: Id;
  childId: Id;
  questId: Id;
  weekId: WeekId;
  /** 1-based attempt number within the week (part of the seed). */
  attempt: number;
  seed: string;
  /** Difficulty level (1..5) used to generate the questions. */
  level: number;
  topic: QuizTopic;
  total: number;
  correct: number;
  passScore: number;
  passed: boolean;
  finishedAt: string;
  /** Per-question correctness, in order. */
  results: boolean[];
  /** Completion created by this attempt (pass only). */
  completionId?: Id;
  /** Difficulty change this attempt caused (adaptive difficulty). */
  difficultyChange?: DifficultyChange;
}

export interface WeeklyBudget {
  childId: Id;
  /** Target allowance per week. */
  amount: Agorot;
}

export type LedgerEntryType =
  /** Parent deposits money: +locked. */
  | 'deposit'
  /** Quest approved: locked → available. */
  | 'unlock'
  /** Week reset with "return" policy: locked → back to parent. */
  | 'return';

export interface LedgerEntry {
  id: Id;
  childId: Id;
  type: LedgerEntryType;
  amount: Agorot;
  weekId: WeekId;
  at: string;
  /** Completion id for 'unlock'. */
  ref?: Id;
  note?: string;
}

export interface WalletBalance {
  /** Deposited by a parent but not yet earned. */
  locked: Agorot;
  /** Earned (unlocked) money. */
  available: Agorot;
  totalDeposited: Agorot;
}

export interface SkillProgress {
  childId: Id;
  categoryId: Id;
  /** Parent-set starting level (>= 1). */
  startLevel: number;
  /** XP earned since the starting level. */
  xp: number;
  /**
   * Current drill difficulty (1..5) for quizzes in this category. Absent = derived from the level
   * (data saved before placement tests existed). Set by the placement test, adapted after each quiz,
   * and overridable by the parent.
   */
  difficulty?: number;
  /** Who set `difficulty` last. */
  difficultySource?: DifficultySource;
  /** Consecutive quizzes at the current difficulty scored >= 90% (2 → level up). */
  strongStreak?: number;
  /** Result of the latest placement test in this category. */
  placement?: PlacementRecord;
}

export type DifficultySource = 'placement' | 'adaptive' | 'parent';

export type PlacementKind = 'math' | 'english';

export interface PlacementRecord {
  kind: PlacementKind;
  /** Placed difficulty 1..5. */
  level: number;
  correct: number;
  total: number;
  /** Difficulty of each question asked, in order (the staircase path). */
  path: number[];
  finishedAt: string;
}

/** Drill difficulty moved after a quiz (or by the placement test). */
export interface DifficultyChange {
  categoryId: Id;
  from: number;
  to: number;
  reason: 'strong' | 'struggle';
}

export interface LevelCurve {
  /** XP needed to go from level 1 to 2. */
  baseXp: number;
  /** Multiplier applied per level (1 = linear steps). */
  growth: number;
  maxLevel: number;
}

export type UnspentPolicy = 'rollover' | 'return';

export interface FamilySettings {
  levelCurve: LevelCurve;
  /** What happens to locked money that wasn't earned when a new week starts. */
  unspentPolicy: UnspentPolicy;
  /** 0 = Sunday (Israel), 1 = Monday. */
  weekStartsOn: 0 | 1;
}

/**
 * Parent-mode lock. A SIMPLE LOCK (keeps kids out of parent screens on a shared device),
 * NOT a security boundary: the data lives unencrypted in local storage.
 */
export interface ParentLock {
  /** 'sha256-iter': hash = SHA-256 applied `iterations` times over salt + pin. */
  algo: 'sha256-iter';
  salt: string;
  hash: string;
  iterations: number;
  /** Consecutive wrong attempts since the last success / lockout. */
  failedAttempts: number;
  /** ISO time until which verification is refused (after too many wrong tries). */
  lockedUntil?: string;
}

export interface Family {
  id: Id;
  name: string;
  parents: Parent[];
  children: Child[];
  settings: FamilySettings;
  /** Absent = no PIN set yet (created on first parent entry). */
  parentLock?: ParentLock;
  /** false only for a fresh family that has not finished onboarding (absent = true, e.g. demo data). */
  onboarded?: boolean;
}

/** The whole persisted document. */
export interface AppState {
  schemaVersion: 1;
  family: Family;
  categories: SkillCategory[];
  quests: Quest[];
  completions: QuestCompletion[];
  budgets: WeeklyBudget[];
  ledger: LedgerEntry[];
  progress: SkillProgress[];
  /** Quiz attempt history (absent in data saved before drills existed). */
  drillAttempts?: DrillAttempt[];
  /** Week the state was last reset for. */
  currentWeekId: WeekId;
}
