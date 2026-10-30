/**
 * Manage the family's children after onboarding: add, rename, change avatar, remove.
 * Removing a child also deletes everything that belongs to them (wallet ledger, weekly budget,
 * levels/progress and quest completions) – it requires an explicit confirmation flag.
 */
import type { Agorot, AppState, Child, Id } from '../model/types';
import { DomainError } from '../model/errors';
import type { Ctx } from './context';
import { ONBOARDING_LIMITS } from './onboarding';
import { balanceOf } from './wallet';

export const CHILD_LIMITS = {
  nameMax: ONBOARDING_LIMITS.childNameMax,
  maxChildren: ONBOARDING_LIMITS.maxChildren,
  /** Max length (UTF-16 units) of the avatar string – one emoji, possibly with modifiers. */
  avatarMax: 16,
} as const;

export const DEFAULT_CHILD_AVATAR = '🧒';

export interface NewChild {
  name: string;
  avatar?: string;
  weeklyBudget?: Agorot;
}

function findChild(s: AppState, childId: Id): Child {
  const c = s.family.children.find((k) => k.id === childId);
  if (!c) throw new DomainError('NOT_FOUND', 'CHILD');
  return c;
}

/** Trimmed, length-checked, unique (ignoring the child being renamed). */
function cleanName(s: AppState, name: string, exceptId?: Id): string {
  const n = name.trim();
  if (!n || n.length > CHILD_LIMITS.nameMax) throw new DomainError('INVALID_INPUT', 'CHILD_NAME');
  if (s.family.children.some((k) => k.id !== exceptId && k.name.trim() === n)) throw new DomainError('DUPLICATE_CHILD');
  return n;
}

function cleanAvatar(avatar: string | undefined): string {
  const a = (avatar ?? '').trim();
  if (!a) return DEFAULT_CHILD_AVATAR;
  if (a.length > CHILD_LIMITS.avatarMax) throw new DomainError('INVALID_INPUT', 'AVATAR');
  return a;
}

export function addChild(s: AppState, ctx: Ctx, input: NewChild): { state: AppState; child: Child } {
  if (s.family.children.length >= CHILD_LIMITS.maxChildren) throw new DomainError('TOO_MANY_CHILDREN');
  const name = cleanName(s, input.name);
  const avatar = cleanAvatar(input.avatar);
  const budget = input.weeklyBudget ?? 0;
  if (!Number.isInteger(budget) || budget < 0 || budget > ONBOARDING_LIMITS.maxAmount) throw new DomainError('INVALID_AMOUNT');
  const child: Child = { id: ctx.newId(), name, avatar };
  return {
    child,
    state: {
      ...s,
      family: { ...s.family, children: [...s.family.children, child] },
      budgets: [...s.budgets.filter((b) => b.childId !== child.id), { childId: child.id, amount: budget }],
    },
  };
}

export function updateChild(s: AppState, childId: Id, patch: { name?: string; avatar?: string }): AppState {
  const cur = findChild(s, childId);
  const next: Child = {
    ...cur,
    name: patch.name !== undefined ? cleanName(s, patch.name, childId) : cur.name,
    avatar: patch.avatar !== undefined ? cleanAvatar(patch.avatar) : cur.avatar,
  };
  return { ...s, family: { ...s.family, children: s.family.children.map((k) => (k.id === childId ? next : k)) } };
}

export const renameChild = (s: AppState, childId: Id, name: string) => updateChild(s, childId, { name });
export const setChildAvatar = (s: AppState, childId: Id, avatar: string) => updateChild(s, childId, { avatar });

/** What `removeChild` would delete – shown in the confirmation. */
export interface ChildRemovalSummary {
  child: Child;
  /** Pretend money currently in the wallet. */
  locked: Agorot;
  available: Agorot;
  ledgerEntries: number;
  completions: number;
  pendingApprovals: number;
  /** Interest areas with progress/levels for this child. */
  progressAreas: number;
  isLastChild: boolean;
}

export function childRemovalSummary(s: AppState, childId: Id): ChildRemovalSummary {
  const child = findChild(s, childId);
  const bal = balanceOf(s.ledger, childId);
  const comps = s.completions.filter((c) => c.childId === childId);
  return {
    child,
    locked: bal.locked,
    available: bal.available,
    ledgerEntries: s.ledger.filter((e) => e.childId === childId).length,
    completions: comps.length,
    pendingApprovals: comps.filter((c) => c.status === 'submitted').length,
    progressAreas: s.progress.filter((p) => p.childId === childId).length,
    isLastChild: s.family.children.length === 1,
  };
}

/** Deletes the child and ALL their data. `confirmed` must be true (the UI asks first). */
export function removeChild(s: AppState, childId: Id, confirmed: boolean): AppState {
  if (!confirmed) throw new DomainError('CONFIRMATION_REQUIRED');
  findChild(s, childId);
  const keep = <T extends { childId: Id }>(xs: T[]) => xs.filter((x) => x.childId !== childId);
  return {
    ...s,
    family: { ...s.family, children: s.family.children.filter((k) => k.id !== childId) },
    budgets: keep(s.budgets),
    ledger: keep(s.ledger),
    completions: keep(s.completions),
    progress: keep(s.progress),
  };
}
