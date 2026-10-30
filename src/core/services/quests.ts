import { DomainError } from '../model/errors';
import type { AppState, CompletionStatus, Id, LedgerEntry, LevelChange, QuestCompletion, WeekId } from '../model/types';
import type { Ctx } from './context';
import { findCategory, findQuest } from './categories';
import { addXp } from './levels';
import { balanceOf } from './wallet';
import { weekIdOf } from './week';

/** Latest completion record for the child+quest in the given week. */
export function latestCompletion(state: AppState, childId: Id, questId: Id, weekId: WeekId): QuestCompletion | undefined {
  const list = state.completions.filter((c) => c.childId === childId && c.questId === questId && c.weekId === weekId);
  return list.sort((a, b) => a.submittedAt.localeCompare(b.submittedAt)).at(-1);
}

/** Quests repeat weekly: with no record this week the status is 'todo'. */
export function questStatus(state: AppState, childId: Id, questId: Id, weekId: WeekId = state.currentWeekId): CompletionStatus {
  return latestCompletion(state, childId, questId, weekId)?.status ?? 'todo';
}

export function pendingApprovals(state: AppState, childId?: Id): QuestCompletion[] {
  return state.completions
    .filter((c) => c.status === 'submitted' && (!childId || c.childId === childId))
    .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
}

export function submitQuest(state: AppState, ctx: Ctx, childId: Id, questId: Id): { state: AppState; completion: QuestCompletion } {
  const quest = findQuest(state, questId);
  if (!quest.active) throw new DomainError('QUEST_INACTIVE');
  if (!findCategory(state, quest.categoryId).enabled) throw new DomainError('CATEGORY_DISABLED');
  if (!state.family.children.some((c) => c.id === childId)) throw new DomainError('NOT_FOUND');
  const now = ctx.now();
  const weekId = weekIdOf(now, state.family.settings.weekStartsOn);
  const status = questStatus(state, childId, questId, weekId);
  if (status === 'submitted' || status === 'approved') throw new DomainError('ALREADY_SUBMITTED');
  const completion: QuestCompletion = {
    id: ctx.newId(),
    questId,
    childId,
    weekId,
    status: 'submitted',
    submittedAt: now.toISOString(),
    reward: quest.reward,
    xp: quest.xp,
  };
  return { state: { ...state, completions: [...state.completions, completion] }, completion };
}

export interface ApprovalCheck {
  ok: boolean;
  locked: number;
  reward: number;
  /** How much more the parent must deposit to approve. */
  shortfall: number;
}

/** UI helper: can this completion be approved with the current locked deposit? */
export function canApprove(state: AppState, completionId: Id): ApprovalCheck {
  const c = state.completions.find((x) => x.id === completionId);
  if (!c) throw new DomainError('NOT_FOUND');
  const { locked } = balanceOf(state.ledger, c.childId);
  return { ok: c.status === 'submitted' && locked >= c.reward, locked, reward: c.reward, shortfall: Math.max(0, c.reward - locked) };
}

/**
 * Approve: moves the reward from locked → available (never more than is locked),
 * adds XP to the quest's category and records any level-up on the completion.
 */
export function approveCompletion(
  state: AppState,
  ctx: Ctx,
  completionId: Id,
): { state: AppState; completion: QuestCompletion; levelChange?: LevelChange } {
  const c = state.completions.find((x) => x.id === completionId);
  if (!c) throw new DomainError('NOT_FOUND');
  if (c.status !== 'submitted') throw new DomainError('NOT_SUBMITTED');
  const check = canApprove(state, completionId);
  if (!check.ok) throw new DomainError('INSUFFICIENT_LOCKED_FUNDS');
  const quest = findQuest(state, c.questId);
  const now = ctx.now();

  let next = state;
  if (c.reward > 0) {
    const entry: LedgerEntry = {
      id: ctx.newId(),
      childId: c.childId,
      type: 'unlock',
      amount: c.reward,
      weekId: weekIdOf(now, state.family.settings.weekStartsOn),
      at: now.toISOString(),
      ref: c.id,
    };
    next = { ...next, ledger: [...next.ledger, entry] };
  }
  const xpResult = addXp(next, c.childId, quest.categoryId, c.xp);
  next = xpResult.state;
  const completion: QuestCompletion = {
    ...c,
    status: 'approved',
    decidedAt: now.toISOString(),
    levelChange: xpResult.levelChange,
    celebrated: false,
  };
  next = { ...next, completions: next.completions.map((x) => (x.id === c.id ? completion : x)) };
  return { state: next, completion, levelChange: xpResult.levelChange };
}

export function rejectCompletion(state: AppState, ctx: Ctx, completionId: Id, note?: string): AppState {
  const c = state.completions.find((x) => x.id === completionId);
  if (!c) throw new DomainError('NOT_FOUND');
  if (c.status !== 'submitted') throw new DomainError('NOT_SUBMITTED');
  const updated: QuestCompletion = { ...c, status: 'rejected', decidedAt: ctx.now().toISOString(), note: note?.trim() || undefined };
  return { ...state, completions: state.completions.map((x) => (x.id === c.id ? updated : x)) };
}

/** Approved completions the child hasn't celebrated yet (newest first). */
export function uncelebrated(state: AppState, childId: Id): QuestCompletion[] {
  return state.completions
    .filter((c) => c.childId === childId && c.status === 'approved' && c.celebrated === false)
    .sort((a, b) => (b.decidedAt ?? '').localeCompare(a.decidedAt ?? ''));
}

export function markCelebrated(state: AppState, completionId: Id): AppState {
  return {
    ...state,
    completions: state.completions.map((c) => (c.id === completionId ? { ...c, celebrated: true } : c)),
  };
}
