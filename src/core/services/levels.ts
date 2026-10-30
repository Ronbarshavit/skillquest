import { DomainError } from '../model/errors';
import type { AppState, Id, LevelChange, LevelCurve, SkillProgress } from '../model/types';

export const DEFAULT_LEVEL_CURVE: LevelCurve = { baseXp: 50, growth: 1.3, maxLevel: 20 };

export interface LevelInfo {
  level: number;
  /** XP accumulated inside the current level. */
  xpIntoLevel: number;
  /** XP needed to reach the next level (0 at max level). */
  xpForNext: number;
  /** 0..1 progress to the next level (1 at max). */
  progress: number;
  isMax: boolean;
}

export function validateCurve(c: LevelCurve): void {
  if (!(c.baseXp > 0) || !(c.growth >= 1) || !Number.isInteger(c.maxLevel) || c.maxLevel < 2) {
    throw new DomainError('INVALID_INPUT', 'invalid level curve');
  }
}

/** XP needed to go from `level` to `level + 1`. */
export function xpToNext(level: number, curve: LevelCurve): number {
  return Math.round(curve.baseXp * Math.pow(curve.growth, level - 1));
}

/** Total XP from level 1 to reach `level` (useful for tables/tooltips). */
export function cumulativeXp(level: number, curve: LevelCurve): number {
  let sum = 0;
  for (let l = 1; l < level; l++) sum += xpToNext(l, curve);
  return sum;
}

export function levelInfo(startLevel: number, xp: number, curve: LevelCurve): LevelInfo {
  let level = Math.min(Math.max(1, Math.floor(startLevel)), curve.maxLevel);
  let rem = Math.max(0, xp);
  while (level < curve.maxLevel && rem >= xpToNext(level, curve)) {
    rem -= xpToNext(level, curve);
    level++;
  }
  const isMax = level >= curve.maxLevel;
  const xpForNext = isMax ? 0 : xpToNext(level, curve);
  return { level, xpIntoLevel: isMax ? 0 : rem, xpForNext, progress: isMax ? 1 : rem / xpForNext, isMax };
}

export function detectLevelChange(
  categoryId: Id,
  startLevel: number,
  xpBefore: number,
  xpAfter: number,
  curve: LevelCurve,
): LevelChange | undefined {
  const from = levelInfo(startLevel, xpBefore, curve).level;
  const to = levelInfo(startLevel, xpAfter, curve).level;
  return to > from ? { categoryId, from, to } : undefined;
}

export function getProgress(state: AppState, childId: Id, categoryId: Id): SkillProgress {
  return (
    state.progress.find((p) => p.childId === childId && p.categoryId === categoryId) ?? {
      childId,
      categoryId,
      startLevel: 1,
      xp: 0,
    }
  );
}

export function childLevel(state: AppState, childId: Id, categoryId: Id): LevelInfo {
  const p = getProgress(state, childId, categoryId);
  return levelInfo(p.startLevel, p.xp, state.family.settings.levelCurve);
}

function upsertProgress(state: AppState, next: SkillProgress): AppState {
  const others = state.progress.filter((p) => !(p.childId === next.childId && p.categoryId === next.categoryId));
  return { ...state, progress: [...others, next] };
}

/** Parent sets where a child starts in a category. XP earned so far is kept on top of the new start. */
export function setStartLevel(state: AppState, childId: Id, categoryId: Id, startLevel: number): AppState {
  const max = state.family.settings.levelCurve.maxLevel;
  if (!Number.isInteger(startLevel) || startLevel < 1 || startLevel > max) throw new DomainError('INVALID_INPUT');
  if (!state.family.children.some((c) => c.id === childId)) throw new DomainError('NOT_FOUND');
  if (!state.categories.some((c) => c.id === categoryId)) throw new DomainError('NOT_FOUND');
  return upsertProgress(state, { ...getProgress(state, childId, categoryId), startLevel });
}

/** Adds XP and reports a level-up if one happened. */
export function addXp(
  state: AppState,
  childId: Id,
  categoryId: Id,
  xp: number,
): { state: AppState; levelChange?: LevelChange } {
  const p = getProgress(state, childId, categoryId);
  const after = p.xp + Math.max(0, xp);
  const levelChange = detectLevelChange(categoryId, p.startLevel, p.xp, after, state.family.settings.levelCurve);
  return { state: upsertProgress(state, { ...p, xp: after }), levelChange };
}

export function setLevelCurve(state: AppState, curve: LevelCurve): AppState {
  validateCurve(curve);
  return { ...state, family: { ...state.family, settings: { ...state.family.settings, levelCurve: curve } } };
}
