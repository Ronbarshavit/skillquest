import { describe, expect, it } from 'vitest';
import { createEmptyState } from '../seed';
import { addXp, cumulativeXp, detectLevelChange, levelInfo, setLevelCurve, setStartLevel, validateCurve, xpToNext, childLevel } from '../services/levels';
import type { LevelCurve } from '../model/types';
import { testCtx } from './helpers';

const curve: LevelCurve = { baseXp: 100, growth: 1.5, maxLevel: 5 };

describe('level curve', () => {
  it('computes thresholds from base and growth', () => {
    expect(xpToNext(1, curve)).toBe(100);
    expect(xpToNext(2, curve)).toBe(150);
    expect(xpToNext(3, curve)).toBe(225);
    expect(cumulativeXp(4, curve)).toBe(475);
  });
  it('levelInfo walks the curve from the starting level', () => {
    expect(levelInfo(1, 0, curve)).toMatchObject({ level: 1, xpIntoLevel: 0, xpForNext: 100, progress: 0 });
    expect(levelInfo(1, 120, curve)).toMatchObject({ level: 2, xpIntoLevel: 20, xpForNext: 150 });
    expect(levelInfo(3, 0, curve)).toMatchObject({ level: 3, xpForNext: 225 });
    expect(levelInfo(3, 225, curve).level).toBe(4);
  });
  it('caps at maxLevel', () => {
    const info = levelInfo(1, 1_000_000, curve);
    expect(info).toMatchObject({ level: 5, isMax: true, progress: 1, xpForNext: 0 });
  });
  it('detects level-ups (including multi-level jumps)', () => {
    expect(detectLevelChange('c', 1, 90, 99, curve)).toBeUndefined();
    expect(detectLevelChange('c', 1, 90, 110, curve)).toEqual({ categoryId: 'c', from: 1, to: 2 });
    expect(detectLevelChange('c', 1, 0, 300, curve)).toEqual({ categoryId: 'c', from: 1, to: 3 });
  });
  it('rejects invalid curves', () => {
    expect(() => validateCurve({ baseXp: 0, growth: 1.2, maxLevel: 10 })).toThrow();
    expect(() => validateCurve({ baseXp: 10, growth: 0.9, maxLevel: 10 })).toThrow();
    expect(() => validateCurve({ baseXp: 10, growth: 1, maxLevel: 1 })).toThrow();
  });
});

describe('per-child progress', () => {
  it('parent-set start level and XP accumulate per child per category', () => {
    const ctx = testCtx();
    let s = setLevelCurve(createEmptyState(ctx), curve);
    s = setStartLevel(s, 'child-1', 'cat-math', 3);
    expect(childLevel(s, 'child-1', 'cat-math').level).toBe(3);
    expect(childLevel(s, 'child-1', 'cat-lang').level).toBe(1);
    const r = addXp(s, 'child-1', 'cat-math', 230);
    expect(r.levelChange).toEqual({ categoryId: 'cat-math', from: 3, to: 4 });
    expect(childLevel(r.state, 'child-1', 'cat-math')).toMatchObject({ level: 4, xpIntoLevel: 5 });
  });
  it('validates start level', () => {
    const s = createEmptyState(testCtx());
    expect(() => setStartLevel(s, 'child-1', 'cat-math', 0)).toThrow();
    expect(() => setStartLevel(s, 'nope', 'cat-math', 2)).toThrow();
  });
});
