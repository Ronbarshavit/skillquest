import { DomainError } from '../model/errors';
import type { AppState, DifficultyChange, Id, PlacementKind, PlacementRecord, SkillProgress } from '../model/types';
import type { Ctx } from '../services/context';
import { findCategory } from '../services/categories';
import { childLevel, getProgress } from '../services/levels';
import { DRILL_LIMITS, ENGLISH_TOPICS, MATH_TOPICS, checkAnswer, clampLevel } from './engine';
import { ENGLISH_GENERATORS } from './english';
import { MATH_GENERATORS } from './math';
import { createRng } from './rng';
import type { DrillResponse, Question } from './types';

/**
 * Placement test + adaptive difficulty (pure).
 *
 * Placement is a short staircase: start in the middle (level 3), one level up after a right answer,
 * one down after a wrong one, stop when the level settles. Nothing is awarded for it (no money, no XP):
 * it only sets the drill difficulty for the category.
 *
 * After that every quiz nudges the difficulty: two strong quizzes in a row (>= 90%) → one level up;
 * a hard one (< 50%) → one level down; anything else → stay.
 */
export const PLACEMENT = {
  startLevel: 3,
  minQuestions: 6,
  maxQuestions: 8,
  /** Stop after this many direction changes (once minQuestions were asked). */
  reversalsToStop: 3,
} as const;

export const ADAPT = {
  /** Score ratio that counts as a strong quiz. */
  strongRatio: 0.9,
  /** Strong quizzes in a row needed to level up. */
  strongToLevelUp: 2,
  /** Below this ratio the next quizzes get one level easier. */
  struggleRatio: 0.5,
} as const;

// ------------------------------------------------------------------ which categories

/** Placement applies to categories with Math or English quizzes (Math wins if both). */
export function placementKind(state: AppState, categoryId: Id): PlacementKind | undefined {
  const topics = state.quests.filter((q) => q.categoryId === categoryId && q.active && q.drill?.kind === 'quiz').map((q) => (q.drill as { topic: string }).topic);
  if (topics.some((t) => (MATH_TOPICS as readonly string[]).includes(t))) return 'math';
  if (topics.some((t) => (ENGLISH_TOPICS as readonly string[]).includes(t))) return 'english';
  return undefined;
}

/** The child should take the placement test before quizzes in this category. */
export function needsPlacement(state: AppState, childId: Id, categoryId: Id): boolean {
  if (!placementKind(state, categoryId)) return false;
  const p = getProgress(state, childId, categoryId);
  return !p.placement && p.difficultySource !== 'parent';
}

/** Current quiz difficulty (1..5): the stored difficulty, or (older data) the category level. */
export function currentDifficulty(state: AppState, childId: Id, categoryId: Id): number {
  const p = getProgress(state, childId, categoryId);
  return p.difficulty !== undefined ? clampLevel(p.difficulty) : clampLevel(childLevel(state, childId, categoryId).level);
}

// ------------------------------------------------------------------ staircase

export interface Staircase {
  /** Difficulty of each question asked so far, plus (when not done) the next one. */
  path: number[];
  /** Level for the next question (or the last asked when done). */
  next: number;
  reversals: number;
  done: boolean;
}

/** Replays the staircase from right/wrong results. */
export function staircase(results: readonly boolean[]): Staircase {
  const { startLevel, minQuestions, maxQuestions, reversalsToStop } = PLACEMENT;
  const path: number[] = [];
  let level: number = startLevel;
  let reversals = 0;
  let lastDir = 0;
  for (const ok of results.slice(0, maxQuestions)) {
    path.push(level);
    const dir = ok ? 1 : -1;
    if (lastDir && dir !== lastDir) reversals++;
    lastDir = dir;
    level = Math.min(DRILL_LIMITS.maxLevel, Math.max(DRILL_LIMITS.minLevel, level + dir));
  }
  const n = path.length;
  const tail = results.slice(Math.max(0, n - 3), n);
  const pinned =
    n >= minQuestions &&
    tail.length === 3 &&
    ((tail.every(Boolean) && path.slice(-2).every((l) => l === DRILL_LIMITS.maxLevel)) ||
      (!tail.some(Boolean) && path.slice(-2).every((l) => l === DRILL_LIMITS.minLevel)));
  const done = n >= maxQuestions || (n >= minQuestions && reversals >= reversalsToStop) || pinned;
  return { path: done ? path : [...path, level], next: done ? path[n - 1] : level, reversals, done };
}

/** Highest level answered right at least once and at least as often right as wrong (else 1). */
export function placedLevel(path: readonly number[], results: readonly boolean[]): number {
  let best = DRILL_LIMITS.minLevel;
  for (let l = DRILL_LIMITS.minLevel; l <= DRILL_LIMITS.maxLevel; l++) {
    let right = 0,
      wrong = 0;
    path.forEach((p, i) => {
      if (p !== l || i >= results.length) return;
      if (results[i]) right++;
      else wrong++;
    });
    if (right >= 1 && right >= wrong) best = l;
  }
  return best;
}

// ------------------------------------------------------------------ questions

const MATH_ROTATION = ['mental-math', 'times-tables', 'word-problems', 'fractions', 'mental-math', 'geometry', 'times-tables', 'word-problems'] as const;
const ENGLISH_ROTATION = ['en-vocab', 'en-fill', 'en-sentences', 'en-vocab', 'en-fill', 'en-sentences', 'en-vocab', 'en-fill'] as const;

/** Question `index` of a placement test at `level` (deterministic from the seed). */
export function placementQuestion(kind: PlacementKind, seed: string, index: number, level: number): Question {
  const rng = createRng(`${seed}|${index}`);
  const id = `p${index + 1}`;
  if (kind === 'math') return MATH_GENERATORS[MATH_ROTATION[index % MATH_ROTATION.length]](rng, clampLevel(level), id);
  return ENGLISH_GENERATORS[ENGLISH_ROTATION[index % ENGLISH_ROTATION.length]](rng, clampLevel(level), id);
}

/** A placement test in progress. Not persisted: questions are rebuilt from the seed and the answers. */
export interface PlacementSession {
  childId: Id;
  categoryId: Id;
  kind: PlacementKind;
  seed: string;
}

export interface PlacementStep {
  /** Questions asked so far (one per response) plus the next one when not done. */
  questions: Question[];
  results: boolean[];
  stair: Staircase;
  done: boolean;
  /** Placed level so far (final when done). */
  level: number;
}

/** Rebuilds the test from the answers given so far. */
export function placementStep(session: PlacementSession, responses: readonly (DrillResponse | undefined)[]): PlacementStep {
  const questions: Question[] = [];
  const results: boolean[] = [];
  let stair = staircase([]);
  for (let i = 0; i < PLACEMENT.maxQuestions && !stair.done; i++) {
    const q = placementQuestion(session.kind, session.seed, i, stair.next);
    questions.push(q);
    if (i >= responses.length) break;
    results.push(checkAnswer(q, responses[i]));
    stair = staircase(results);
  }
  return { questions, results, stair, done: stair.done, level: placedLevel(stair.path, results) };
}

export function startPlacement(state: AppState, ctx: Ctx, childId: Id, categoryId: Id): PlacementSession {
  if (!state.family.children.some((c) => c.id === childId)) throw new DomainError('NOT_FOUND');
  if (!findCategory(state, categoryId).enabled) throw new DomainError('CATEGORY_DISABLED');
  const kind = placementKind(state, categoryId);
  if (!kind) throw new DomainError('NO_PLACEMENT');
  return { childId, categoryId, kind, seed: `placement|${childId}|${categoryId}|${ctx.now().toISOString()}` };
}

function upsert(state: AppState, next: SkillProgress): AppState {
  const others = state.progress.filter((p) => !(p.childId === next.childId && p.categoryId === next.categoryId));
  return { ...state, progress: [...others, next] };
}

export interface PlacementResult {
  state: AppState;
  record: PlacementRecord;
}

/**
 * Scores a finished placement test (rebuilt from the seed, never from UI questions) and sets the
 * category's drill difficulty. The starting level is raised to the placed level (never lowered,
 * so a level the parent set stays). Awards nothing.
 */
export function finishPlacement(state: AppState, ctx: Ctx, session: PlacementSession, responses: readonly (DrillResponse | undefined)[]): PlacementResult {
  if (placementKind(state, session.categoryId) !== session.kind) throw new DomainError('NO_PLACEMENT');
  if (!state.family.children.some((c) => c.id === session.childId)) throw new DomainError('NOT_FOUND');
  const step = placementStep(session, responses);
  if (!step.done || responses.length !== step.results.length) throw new DomainError('DRILL_INCOMPLETE');
  const record: PlacementRecord = {
    kind: session.kind,
    level: step.level,
    correct: step.results.filter(Boolean).length,
    total: step.results.length,
    path: step.stair.path,
    finishedAt: ctx.now().toISOString(),
  };
  const p = getProgress(state, session.childId, session.categoryId);
  const maxLevel = state.family.settings.levelCurve.maxLevel;
  const next: SkillProgress = {
    ...p,
    startLevel: Math.min(maxLevel, Math.max(p.startLevel, record.level)),
    difficulty: record.level,
    difficultySource: 'placement',
    strongStreak: 0,
    placement: record,
  };
  return { state: upsert(state, next), record };
}

// ------------------------------------------------------------------ parent controls

/** Parent override of the drill difficulty (1..5). Skips the placement test if it was not taken. */
export function setDifficulty(state: AppState, childId: Id, categoryId: Id, level: number): AppState {
  if (!Number.isInteger(level) || level < DRILL_LIMITS.minLevel || level > DRILL_LIMITS.maxLevel) throw new DomainError('INVALID_INPUT');
  if (!state.family.children.some((c) => c.id === childId)) throw new DomainError('NOT_FOUND');
  findCategory(state, categoryId);
  return upsert(state, { ...getProgress(state, childId, categoryId), difficulty: level, difficultySource: 'parent', strongStreak: 0 });
}

/** Parent asks for a new placement test: the next visit to the category starts with it. */
export function resetPlacement(state: AppState, childId: Id, categoryId: Id): AppState {
  if (!state.family.children.some((c) => c.id === childId)) throw new DomainError('NOT_FOUND');
  findCategory(state, categoryId);
  const p = getProgress(state, childId, categoryId);
  const { placement: _drop, ...rest } = p;
  return upsert(state, { ...rest, difficultySource: p.difficultySource === 'parent' ? 'adaptive' : p.difficultySource });
}

// ------------------------------------------------------------------ adapting after quizzes

export interface Adaptation {
  difficulty: number;
  strongStreak: number;
  change?: DifficultyChange;
}

/** Next difficulty after a quiz played at `level` with `correct`/`total`. */
export function adapt(categoryId: Id, level: number, streak: number, correct: number, total: number): Adaptation {
  const from = clampLevel(level);
  const ratio = total > 0 ? correct / total : 0;
  if (ratio >= ADAPT.strongRatio) {
    const s = streak + 1;
    if (s >= ADAPT.strongToLevelUp && from < DRILL_LIMITS.maxLevel) return { difficulty: from + 1, strongStreak: 0, change: { categoryId, from, to: from + 1, reason: 'strong' } };
    return { difficulty: from, strongStreak: from >= DRILL_LIMITS.maxLevel ? Math.min(s, ADAPT.strongToLevelUp) : s };
  }
  if (ratio < ADAPT.struggleRatio && from > DRILL_LIMITS.minLevel) return { difficulty: from - 1, strongStreak: 0, change: { categoryId, from, to: from - 1, reason: 'struggle' } };
  return { difficulty: from, strongStreak: 0 };
}

/**
 * Applies a finished quiz to the category difficulty. Ignored when the quiz was played at another
 * level than the current one (e.g. an old session after a parent change). Unchanged state → same object.
 */
export function applyQuizToDifficulty(state: AppState, childId: Id, categoryId: Id, playedLevel: number, correct: number, total: number): { state: AppState; change?: DifficultyChange } {
  const p = getProgress(state, childId, categoryId);
  const current = currentDifficulty(state, childId, categoryId);
  if (clampLevel(playedLevel) !== current) return { state };
  const streak = p.strongStreak ?? 0;
  const a = adapt(categoryId, current, streak, correct, total);
  if (a.difficulty === current && a.strongStreak === streak) return { state };
  const next: SkillProgress = {
    ...p,
    difficulty: a.difficulty,
    strongStreak: a.strongStreak,
    difficultySource: a.change ? 'adaptive' : (p.difficultySource ?? 'adaptive'),
  };
  return { state: upsert(state, next), change: a.change };
}

/** Normalises stored adaptive fields (older or hand-edited data). Pure; returns the same array when nothing changed. */
export function migrateProgress(progress: SkillProgress[]): SkillProgress[] {
  let changed = false;
  const out = progress.map((p) => {
    const bad =
      (p.difficulty !== undefined && (!Number.isInteger(p.difficulty) || p.difficulty < DRILL_LIMITS.minLevel || p.difficulty > DRILL_LIMITS.maxLevel)) ||
      (p.strongStreak !== undefined && (!Number.isInteger(p.strongStreak) || p.strongStreak < 0)) ||
      (p.placement !== undefined && (typeof p.placement !== 'object' || !Number.isInteger(p.placement.level) || p.placement.level < 1 || p.placement.level > DRILL_LIMITS.maxLevel));
    if (!bad) return p;
    changed = true;
    const { difficulty, strongStreak, placement, difficultySource, ...rest } = p;
    const okDiff = difficulty !== undefined && Number.isFinite(difficulty) ? clampLevel(difficulty) : undefined;
    const okPlacement = placement && typeof placement === 'object' && Number.isInteger(placement.level) && placement.level >= 1 && placement.level <= DRILL_LIMITS.maxLevel ? placement : undefined;
    return {
      ...rest,
      ...(okDiff !== undefined ? { difficulty: okDiff, difficultySource: difficultySource ?? 'adaptive' } : {}),
      ...(strongStreak !== undefined && Number.isInteger(strongStreak) && strongStreak >= 0 ? { strongStreak } : {}),
      ...(okPlacement ? { placement: okPlacement } : {}),
    } as SkillProgress;
  });
  return changed ? out : progress;
}
