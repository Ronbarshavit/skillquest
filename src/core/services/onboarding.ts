/**
 * Clean-start onboarding: family name → children → weekly budget → first (pretend) deposit → PIN.
 * Applied atomically by `completeOnboarding` so a half-finished wizard never leaves partial data.
 */
import type { Agorot, AppState, Child, LedgerEntry, WeeklyBudget } from '../model/types';
import { DomainError } from '../model/errors';
import type { Ctx } from './context';
import { createPin } from './pin';
import { weekIdOf } from './week';

export const ONBOARDING_LIMITS = {
  familyNameMax: 40,
  childNameMax: 20,
  maxChildren: 6,
  /** 1000 ₪ */
  maxAmount: 100_000,
} as const;

export interface OnboardingChild {
  name: string;
  avatar: string;
  weeklyBudget: Agorot;
  firstDeposit: Agorot;
}

export interface OnboardingInput {
  familyName: string;
  children: OnboardingChild[];
  pin: string;
  pinConfirm: string;
}

export const isOnboarded = (s: AppState) => s.family.onboarded !== false;

export type OnboardingIssue = 'FAMILY_NAME' | 'NO_CHILDREN' | 'TOO_MANY_CHILDREN' | 'CHILD_NAME' | 'DUPLICATE_CHILD' | 'AMOUNT';

/** Validation shared by the wizard (per step) and `completeOnboarding`. Returns the first issue or null. */
export function validateOnboarding(input: Omit<OnboardingInput, 'pin' | 'pinConfirm'>): OnboardingIssue | null {
  const fam = input.familyName.trim();
  if (!fam || fam.length > ONBOARDING_LIMITS.familyNameMax) return 'FAMILY_NAME';
  if (input.children.length === 0) return 'NO_CHILDREN';
  if (input.children.length > ONBOARDING_LIMITS.maxChildren) return 'TOO_MANY_CHILDREN';
  const names = new Set<string>();
  for (const c of input.children) {
    const n = c.name.trim();
    if (!n || n.length > ONBOARDING_LIMITS.childNameMax) return 'CHILD_NAME';
    if (names.has(n)) return 'DUPLICATE_CHILD';
    names.add(n);
    for (const a of [c.weeklyBudget, c.firstDeposit])
      if (!Number.isInteger(a) || a < 0 || a > ONBOARDING_LIMITS.maxAmount) return 'AMOUNT';
  }
  return null;
}

export function completeOnboarding(s: AppState, ctx: Ctx, input: OnboardingInput): AppState {
  if (isOnboarded(s)) throw new DomainError('ALREADY_ONBOARDED');
  const issue = validateOnboarding(input);
  if (issue) throw new DomainError(issue === 'AMOUNT' ? 'INVALID_AMOUNT' : 'INVALID_INPUT', issue);

  const now = ctx.now();
  const weekId = weekIdOf(now, s.family.settings.weekStartsOn);
  const children: Child[] = [];
  const budgets: WeeklyBudget[] = [];
  const ledger: LedgerEntry[] = [];
  for (const c of input.children) {
    const id = ctx.newId();
    children.push({ id, name: c.name.trim(), avatar: c.avatar || '🧒' });
    budgets.push({ childId: id, amount: c.weeklyBudget });
    if (c.firstDeposit > 0)
      ledger.push({ id: ctx.newId(), childId: id, type: 'deposit', amount: c.firstDeposit, weekId, at: now.toISOString(), note: 'הפקדה ראשונה' });
  }
  const next: AppState = {
    ...s,
    family: { ...s.family, name: input.familyName.trim(), children, onboarded: true },
    budgets,
    ledger,
    completions: [],
    progress: [],
    currentWeekId: weekId,
  };
  // PIN last: throws INVALID_PIN / PIN_MISMATCH before anything is committed.
  return createPin(next, ctx, input.pin, input.pinConfirm);
}
