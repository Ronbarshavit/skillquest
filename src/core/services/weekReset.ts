import type { AppState, LedgerEntry, UnspentPolicy } from '../model/types';
import type { Ctx } from './context';
import { balanceOf } from './wallet';
import { weekIdOf } from './week';

/**
 * Weekly reset. Quest statuses are per week, so they reset automatically.
 * Locked (unearned) money follows the family policy:
 *  - 'rollover': stays locked for next week (parent can deposit less)
 *  - 'return':   goes back to the parent ('return' ledger entry)
 * Pending submissions from last week stay approvable.
 */
export function startNewWeekIfNeeded(state: AppState, ctx: Ctx): { state: AppState; changed: boolean } {
  const now = ctx.now();
  const weekId = weekIdOf(now, state.family.settings.weekStartsOn);
  if (weekId === state.currentWeekId) return { state, changed: false };
  const entries: LedgerEntry[] = [];
  if (state.family.settings.unspentPolicy === 'return') {
    for (const child of state.family.children) {
      const { locked } = balanceOf(state.ledger, child.id);
      if (locked > 0) {
        entries.push({
          id: ctx.newId(),
          childId: child.id,
          type: 'return',
          amount: locked,
          weekId: state.currentWeekId,
          at: now.toISOString(),
          note: 'week-reset',
        });
      }
    }
  }
  return { state: { ...state, currentWeekId: weekId, ledger: [...state.ledger, ...entries] }, changed: true };
}

export function setUnspentPolicy(state: AppState, policy: UnspentPolicy): AppState {
  return { ...state, family: { ...state.family, settings: { ...state.family.settings, unspentPolicy: policy } } };
}
