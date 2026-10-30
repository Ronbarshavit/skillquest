import { describe, expect, it } from 'vitest';
import { createDemoState, createFreshState } from '../seed';
import { completeOnboarding, isOnboarded, validateOnboarding, type OnboardingInput } from '../services/onboarding';
import { verifyPin } from '../services/pin';
import { balanceOf } from '../services/wallet';
import { allocationFor } from '../services/budget';
import { DomainError } from '../model/errors';
import { testCtx } from './helpers';

const input = (over: Partial<OnboardingInput> = {}): OnboardingInput => ({
  familyName: '  משפחת ניסיון ',
  children: [
    { name: 'ילד א', avatar: '🦊', weeklyBudget: 3000, firstDeposit: 3000 },
    { name: 'ילדה ב', avatar: '🐼', weeklyBudget: 2000, firstDeposit: 0 },
  ],
  pin: '1357',
  pinConfirm: '1357',
  ...over,
});

describe('onboarding', () => {
  it('fresh state needs onboarding; demo state does not', () => {
    const ctx = testCtx();
    const fresh = createFreshState(ctx);
    expect(isOnboarded(fresh)).toBe(false);
    expect(fresh.family.children).toHaveLength(0);
    expect(fresh.categories.length).toBeGreaterThan(0);
    expect(isOnboarded(createDemoState(ctx))).toBe(true);
  });

  it('creates family, children, budgets, first deposits and PIN atomically', () => {
    const ctx = testCtx();
    const s = completeOnboarding(createFreshState(ctx), ctx, input());
    expect(isOnboarded(s)).toBe(true);
    expect(s.family.name).toBe('משפחת ניסיון');
    expect(s.family.children.map((c) => c.name)).toEqual(['ילד א', 'ילדה ב']);
    const [a, b] = s.family.children;
    expect(allocationFor(s, a.id).budget).toBe(3000);
    expect(allocationFor(s, b.id).budget).toBe(2000);
    expect(balanceOf(s.ledger, a.id).locked).toBe(3000);
    expect(balanceOf(s.ledger, b.id).locked).toBe(0);
    expect(s.ledger).toHaveLength(1);
    expect(verifyPin(s, ctx, '1357').result.ok).toBe(true);
  });

  it('rejects invalid input without partial changes', () => {
    const ctx = testCtx();
    const fresh = createFreshState(ctx);
    const err = (i: OnboardingInput) => {
      try {
        completeOnboarding(fresh, ctx, i);
        return 'NO_ERROR';
      } catch (e) {
        return `${(e as DomainError).code}:${(e as DomainError).message}`;
      }
    };
    expect(err(input({ familyName: '  ' }))).toBe('INVALID_INPUT:FAMILY_NAME');
    expect(err(input({ children: [] }))).toBe('INVALID_INPUT:NO_CHILDREN');
    expect(err(input({ children: [{ name: 'א', avatar: '', weeklyBudget: 0, firstDeposit: 0 }, { name: ' א ', avatar: '', weeklyBudget: 0, firstDeposit: 0 }] }))).toBe('INVALID_INPUT:DUPLICATE_CHILD');
    expect(err(input({ children: [{ name: 'א', avatar: '', weeklyBudget: -1, firstDeposit: 0 }] }))).toBe('INVALID_AMOUNT:AMOUNT');
    expect(err(input({ pinConfirm: '1358' }))).toMatch(/^PIN_MISMATCH/);
    expect(err(input({ pin: '12', pinConfirm: '12' }))).toMatch(/^INVALID_PIN/);
    expect(isOnboarded(fresh)).toBe(false);
    expect(validateOnboarding(input())).toBeNull();
  });

  it('cannot run twice', () => {
    const ctx = testCtx();
    const s = completeOnboarding(createFreshState(ctx), ctx, input());
    expect(() => completeOnboarding(s, ctx, input())).toThrow(DomainError);
  });
});
