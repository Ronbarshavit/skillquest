import { describe, expect, it } from 'vitest';
import { createDemoState, createEmptyState } from '../seed';
import { allocationFor, proportionalRewards, setWeeklyBudget } from '../services/budget';
import { addCategory, addQuest, questsIn, setCategoryEnabled, setQuestActive, visibleCategories } from '../services/categories';
import { deposit, balanceOf } from '../services/wallet';
import { startNewWeekIfNeeded, setUnspentPolicy } from '../services/weekReset';
import { testCtx } from './helpers';

describe('interest areas', () => {
  it('has the 5 default categories enabled', () => {
    const s = createEmptyState(testCtx());
    expect(visibleCategories(s).map((c) => c.id)).toEqual(['cat-math', 'cat-lang', 'cat-soft', 'cat-sport', 'cat-music']);
  });
  it('child sees only enabled categories', () => {
    const s = setCategoryEnabled(createEmptyState(testCtx()), 'cat-music', false);
    expect(visibleCategories(s).map((c) => c.id)).not.toContain('cat-music');
  });
  it('parent adds a custom category and quests to it', () => {
    const ctx = testCtx();
    const { state, category } = addCategory(createEmptyState(ctx), ctx, { name: ' שחמט ', icon: '♟️', colorKey: 'slate' });
    expect(category).toMatchObject({ name: 'שחמט', builtIn: false, enabled: true, order: 5 });
    const r = addQuest(state, ctx, { categoryId: category.id, title: 'חידה', description: '', reward: 300, xp: 10 });
    expect(questsIn(r.state, category.id)).toHaveLength(1);
    const off = setQuestActive(r.state, r.quest.id, false);
    expect(questsIn(off, category.id)).toHaveLength(0);
    expect(questsIn(off, category.id, { includeInactive: true })).toHaveLength(1);
  });
  it('validates input', () => {
    const ctx = testCtx();
    const s = createEmptyState(ctx);
    expect(() => addCategory(s, ctx, { name: '  ', icon: 'x', colorKey: 'sky' })).toThrow();
    expect(() => addQuest(s, ctx, { categoryId: 'nope', title: 'x', description: '', reward: 1, xp: 1 })).toThrow();
    expect(() => addQuest(s, ctx, { categoryId: 'cat-math', title: 'x', description: '', reward: -1, xp: 1 })).toThrow();
  });
});

describe('budget allocation', () => {
  it('sums active quest rewards in enabled categories vs the weekly budget', () => {
    const ctx = testCtx();
    let s = setWeeklyBudget(createEmptyState(ctx), 'child-1', 8000);
    const a = allocationFor(s, 'child-1');
    expect(a.allocated).toBe(7600); // all 19 default quests
    expect(a.remaining).toBe(400);
    expect(a.overAllocated).toBe(false);
    s = setCategoryEnabled(s, 'cat-music', false);
    expect(allocationFor(s, 'child-1').allocated).toBe(6100);
    s = setWeeklyBudget(s, 'child-1', 2000);
    expect(allocationFor(s, 'child-1').overAllocated).toBe(true);
  });
  it('suggests a deposit that tops up to the budget', () => {
    const ctx = testCtx();
    let s = setWeeklyBudget(createEmptyState(ctx), 'child-1', 3000);
    s = deposit(s, ctx, 'child-1', 1000);
    expect(allocationFor(s, 'child-1').suggestedDeposit).toBe(2000);
  });
  it('proportional split sums exactly to the budget', () => {
    const r = proportionalRewards(1000, [1, 1, 1]);
    expect(r.reduce((a, b) => a + b, 0)).toBe(1000);
    expect(r).toEqual([334, 333, 333]);
    expect(proportionalRewards(0, [1, 2])).toEqual([0, 0]);
  });
  it('demo seed is consistent', () => {
    const s = createDemoState(testCtx());
    expect(balanceOf(s.ledger, 'child-star')).toMatchObject({ locked: 4500, available: 500 });
    expect(balanceOf(s.ledger, 'child-bear').locked).toBe(200);
  });
});

describe('weekly reset', () => {
  it('rollover keeps locked money', () => {
    const ctx = testCtx();
    let s = deposit(createEmptyState(ctx), ctx, 'child-1', 1000);
    ctx.advanceDays(7);
    const r = startNewWeekIfNeeded(s, ctx);
    expect(r.changed).toBe(true);
    expect(balanceOf(r.state.ledger, 'child-1').locked).toBe(1000);
    s = r.state;
    expect(startNewWeekIfNeeded(s, ctx).changed).toBe(false);
  });
  it('return policy returns unearned locked money to the parent', () => {
    const ctx = testCtx();
    let s = setUnspentPolicy(createEmptyState(ctx), 'return');
    s = deposit(s, ctx, 'child-1', 1000);
    ctx.advanceDays(7);
    const r = startNewWeekIfNeeded(s, ctx);
    expect(balanceOf(r.state.ledger, 'child-1')).toMatchObject({ locked: 0, available: 0 });
    expect(r.state.ledger.at(-1)).toMatchObject({ type: 'return', amount: 1000 });
  });
});
