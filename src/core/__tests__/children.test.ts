import { describe, expect, it } from 'vitest';
import { createDemoState } from '../seed';
import { addChild, childRemovalSummary, removeChild, renameChild, setChildAvatar, CHILD_LIMITS } from '../services/children';
import { balanceOf } from '../services/wallet';
import { getWeeklyBudget } from '../services/budget';
import { DomainError } from '../model/errors';
import { testCtx } from './helpers';

const code = (fn: () => unknown) => {
  try {
    fn();
    return 'NO_ERROR';
  } catch (e) {
    return (e as DomainError).code;
  }
};

describe('manage children', () => {
  it('adds a child with avatar and weekly budget, trimmed name', () => {
    const ctx = testCtx();
    const s0 = createDemoState(ctx);
    const { state, child } = addChild(s0, ctx, { name: '  ינשופי ', avatar: '🦉', weeklyBudget: 2500 });
    expect(child).toMatchObject({ name: 'ינשופי', avatar: '🦉' });
    expect(state.family.children).toHaveLength(3);
    expect(getWeeklyBudget(state, child.id)).toBe(2500);
    expect(balanceOf(state.ledger, child.id).locked).toBe(0);
    expect(s0.family.children).toHaveLength(2); // pure
    expect(addChild(s0, ctx, { name: 'בלי דמות' }).child.avatar).toBe('🧒');
  });

  it('validates name, duplicates, budget and the max number of children', () => {
    const ctx = testCtx();
    let s = createDemoState(ctx);
    expect(code(() => addChild(s, ctx, { name: '   ' }))).toBe('INVALID_INPUT');
    expect(code(() => addChild(s, ctx, { name: 'א'.repeat(CHILD_LIMITS.nameMax + 1) }))).toBe('INVALID_INPUT');
    expect(code(() => addChild(s, ctx, { name: ' כוכבית ' }))).toBe('DUPLICATE_CHILD');
    expect(code(() => addChild(s, ctx, { name: 'חדש', weeklyBudget: -1 }))).toBe('INVALID_AMOUNT');
    for (let i = s.family.children.length; i < CHILD_LIMITS.maxChildren; i++) s = addChild(s, ctx, { name: `ילד ${i}` }).state;
    expect(code(() => addChild(s, ctx, { name: 'אחד יותר מדי' }))).toBe('TOO_MANY_CHILDREN');
  });

  it('renames and changes avatar without touching other data', () => {
    const ctx = testCtx();
    const s0 = createDemoState(ctx);
    const s1 = setChildAvatar(renameChild(s0, 'child-star', ' כוכבונת '), 'child-star', '🦄');
    expect(s1.family.children.find((k) => k.id === 'child-star')).toMatchObject({ name: 'כוכבונת', avatar: '🦄' });
    expect(s1.ledger).toBe(s0.ledger);
    expect(s1.completions).toBe(s0.completions);
    expect(renameChild(s0, 'child-star', 'כוכבית').family.children[0].name).toBe('כוכבית'); // same name is fine
    expect(code(() => renameChild(s0, 'child-star', 'דובון'))).toBe('DUPLICATE_CHILD');
    expect(code(() => renameChild(s0, 'nope', 'x'))).toBe('NOT_FOUND');
    expect(code(() => setChildAvatar(s0, 'child-star', '🦄'.repeat(20)))).toBe('INVALID_INPUT');
  });

  it('summarises what removal deletes', () => {
    const s = createDemoState(testCtx());
    const sum = childRemovalSummary(s, 'child-star');
    expect(sum).toMatchObject({ locked: 4500, available: 500, ledgerEntries: 2, completions: 3, pendingApprovals: 2, progressAreas: 3, isLastChild: false });
  });

  it('removes a child and all their wallet, levels and completions – only with confirmation', () => {
    const s0 = createDemoState(testCtx());
    expect(code(() => removeChild(s0, 'child-star', false))).toBe('CONFIRMATION_REQUIRED');
    expect(code(() => removeChild(s0, 'nope', true))).toBe('NOT_FOUND');
    const s = removeChild(s0, 'child-star', true);
    const gone = (xs: { childId: string }[]) => xs.filter((x) => x.childId === 'child-star').length;
    expect(s.family.children.map((k) => k.id)).toEqual(['child-bear']);
    expect(gone(s.ledger) + gone(s.completions) + gone(s.progress) + gone(s.budgets)).toBe(0);
    // The other child is untouched.
    const keep = (xs: { childId: string }[]) => xs.filter((x) => x.childId === 'child-bear');
    expect(keep(s.ledger)).toEqual(keep(s0.ledger));
    expect(keep(s.completions)).toEqual(keep(s0.completions));
    expect(keep(s.progress)).toEqual(keep(s0.progress));
    expect(s.categories).toBe(s0.categories);
    expect(s.quests).toBe(s0.quests);
    expect(s.family.parentLock).toEqual(s0.family.parentLock);
    expect(childRemovalSummary(s, 'child-bear').isLastChild).toBe(true);
    expect(removeChild(s, 'child-bear', true).family.children).toHaveLength(0);
  });
});
