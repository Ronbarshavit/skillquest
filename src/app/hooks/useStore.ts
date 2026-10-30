import { useSyncExternalStore } from 'react';
import {
  allocationFor,
  balanceOf,
  canApprove,
  childLevel,
  getProgress,
  ledgerFor,
  pendingApprovals,
  questStatus,
  questsIn,
  uncelebrated,
  visibleCategories,
  allCategories,
  latestCompletion,
  attemptsFor,
  bestAttempt,
  drillLevel,
  type AppState,
  type Id,
} from '@core/index';
import { store } from '../adapters/storeInstance';

/** React binding for the core store. Screens read state through these hooks only. */
export function useAppState(): AppState {
  return useSyncExternalStore(store.subscribe, store.getState);
}

export const actions = store;

/** Read-model selectors bound to the current state. */
export function useSelectors() {
  const s = useAppState();
  return {
    state: s,
    children: s.family.children,
    child: (id: Id) => s.family.children.find((c) => c.id === id),
    visibleCategories: () => visibleCategories(s),
    allCategories: () => allCategories(s),
    category: (id: Id) => s.categories.find((c) => c.id === id),
    quest: (id: Id) => s.quests.find((q) => q.id === id),
    questsIn: (categoryId: Id, includeInactive = false) => questsIn(s, categoryId, { includeInactive }),
    questStatus: (childId: Id, questId: Id) => questStatus(s, childId, questId),
    latestCompletion: (childId: Id, questId: Id) => latestCompletion(s, childId, questId, s.currentWeekId),
    level: (childId: Id, categoryId: Id) => childLevel(s, childId, categoryId),
    progress: (childId: Id, categoryId: Id) => getProgress(s, childId, categoryId),
    balance: (childId: Id) => balanceOf(s.ledger, childId),
    ledger: (childId: Id) => ledgerFor(s, childId),
    allocation: (childId: Id) => allocationFor(s, childId),
    pending: (childId?: Id) => pendingApprovals(s, childId),
    canApprove: (completionId: Id) => canApprove(s, completionId),
    uncelebrated: (childId: Id) => uncelebrated(s, childId),
    completion: (id: Id) => s.completions.find((c) => c.id === id),
    attempts: (childId: Id, questId: Id) => attemptsFor(s, childId, questId, s.currentWeekId),
    bestAttempt: (childId: Id, questId: Id) => bestAttempt(s, childId, questId),
    drillLevel: (childId: Id, questId: Id) => {
      const q = s.quests.find((x) => x.id === questId);
      return q ? drillLevel(s, childId, q) : 1;
    },
  };
}
