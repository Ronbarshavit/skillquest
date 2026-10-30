import type { Agorot, AppState, Id, WeekId } from '../model/types';
import { assertNonNegativeAmount } from './money';
import { visibleCategories } from './categories';
import { balanceOf } from './wallet';

/**
 * Budget rule (MVP): each quest has a FIXED reward. The weekly budget is the parent's target;
 * "allocated" is what the child could earn this week if every active quest in an enabled
 * category were approved once. Money only moves when a quest is approved, and only from the
 * locked deposit (see quests.approveCompletion).
 */
export interface BudgetAllocation {
  budget: Agorot;
  /** Sum of rewards of all active quests in enabled categories. */
  allocated: Agorot;
  /** budget − allocated (negative = quests promise more than the budget). */
  remaining: Agorot;
  overAllocated: boolean;
  /** Approved (unlocked) this week. */
  earnedThisWeek: Agorot;
  /** Submitted and waiting for a parent. */
  pendingThisWeek: Agorot;
  /** Currently deposited and still locked. */
  locked: Agorot;
  /** Suggested deposit to cover the budget: max(0, budget − locked − earnedThisWeek). */
  suggestedDeposit: Agorot;
}

export function getWeeklyBudget(state: AppState, childId: Id): Agorot {
  return state.budgets.find((b) => b.childId === childId)?.amount ?? 0;
}

export function setWeeklyBudget(state: AppState, childId: Id, amount: Agorot): AppState {
  assertNonNegativeAmount(amount);
  const others = state.budgets.filter((b) => b.childId !== childId);
  return { ...state, budgets: [...others, { childId, amount }] };
}

export function allocationFor(state: AppState, childId: Id, weekId: WeekId = state.currentWeekId): BudgetAllocation {
  const budget = getWeeklyBudget(state, childId);
  const enabled = new Set(visibleCategories(state).map((c) => c.id));
  const allocated = state.quests
    .filter((q) => q.active && enabled.has(q.categoryId))
    .reduce((s, q) => s + q.reward, 0);
  const earnedThisWeek = state.ledger
    .filter((e) => e.childId === childId && e.type === 'unlock' && e.weekId === weekId)
    .reduce((s, e) => s + e.amount, 0);
  const pendingThisWeek = state.completions
    .filter((c) => c.childId === childId && c.status === 'submitted')
    .reduce((s, c) => s + c.reward, 0);
  const { locked } = balanceOf(state.ledger, childId);
  return {
    budget,
    allocated,
    remaining: budget - allocated,
    overAllocated: allocated > budget,
    earnedThisWeek,
    pendingThisWeek,
    locked,
    suggestedDeposit: Math.max(0, budget - locked - earnedThisWeek),
  };
}

/**
 * Alternative rule kept for the open "proportional" question: split a budget across quests
 * by weight, in whole agorot, with the remainder going to the first quests (largest remainder).
 */
export function proportionalRewards(budget: Agorot, weights: readonly number[]): Agorot[] {
  const total = weights.reduce((s, w) => s + Math.max(0, w), 0);
  if (total === 0 || budget <= 0) return weights.map(() => 0);
  const raw = weights.map((w) => (budget * Math.max(0, w)) / total);
  const floors = raw.map(Math.floor);
  let left = budget - floors.reduce((s, x) => s + x, 0);
  const order = raw.map((r, i) => [r - Math.floor(r), i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) {
    if (left <= 0) break;
    floors[i]++;
    left--;
  }
  return floors;
}
