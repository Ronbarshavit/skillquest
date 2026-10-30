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

export interface Quest {
  id: Id;
  categoryId: Id;
  title: string;
  description: string;
  reward: Agorot;
  xp: number;
  active: boolean;
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
  /** Week the state was last reset for. */
  currentWeekId: WeekId;
}
