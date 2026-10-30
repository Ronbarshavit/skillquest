import { DomainError } from '../model/errors';
import type { Agorot, AppState, Id, LedgerEntry, WalletBalance } from '../model/types';
import type { Ctx } from './context';
import { assertPositiveAmount } from './money';
import { weekIdOf } from './week';

export function balanceOf(ledger: readonly LedgerEntry[], childId: Id): WalletBalance {
  let deposited = 0;
  let unlocked = 0;
  let returned = 0;
  for (const e of ledger) {
    if (e.childId !== childId) continue;
    if (e.type === 'deposit') deposited += e.amount;
    else if (e.type === 'unlock') unlocked += e.amount;
    else if (e.type === 'return') returned += e.amount;
  }
  return { locked: deposited - unlocked - returned, available: unlocked, totalDeposited: deposited };
}

export function ledgerFor(state: AppState, childId: Id): LedgerEntry[] {
  return state.ledger.filter((e) => e.childId === childId).sort((a, b) => b.at.localeCompare(a.at));
}

/** Mock deposit: the parent puts allowance money into the child's locked balance. */
export function deposit(state: AppState, ctx: Ctx, childId: Id, amount: Agorot, note?: string): AppState {
  assertPositiveAmount(amount);
  if (!state.family.children.some((c) => c.id === childId)) throw new DomainError('NOT_FOUND');
  const now = ctx.now();
  const entry: LedgerEntry = {
    id: ctx.newId(),
    childId,
    type: 'deposit',
    amount,
    weekId: weekIdOf(now, state.family.settings.weekStartsOn),
    at: now.toISOString(),
    note,
  };
  return { ...state, ledger: [...state.ledger, entry] };
}
