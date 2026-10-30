import { DomainError } from '../model/errors';
import type { Agorot, AppState, Id, Quest, SkillCategory } from '../model/types';
import type { Ctx } from './context';
import { assertNonNegativeAmount } from './money';

/** Categories the child sees: enabled only, in parent-defined order. */
export function visibleCategories(state: AppState): SkillCategory[] {
  return state.categories.filter((c) => c.enabled).sort((a, b) => a.order - b.order);
}

export function allCategories(state: AppState): SkillCategory[] {
  return [...state.categories].sort((a, b) => a.order - b.order);
}

export function questsIn(state: AppState, categoryId: Id, opts: { includeInactive?: boolean } = {}): Quest[] {
  return state.quests.filter((q) => q.categoryId === categoryId && (opts.includeInactive || q.active));
}

export function findCategory(state: AppState, id: Id): SkillCategory {
  const c = state.categories.find((x) => x.id === id);
  if (!c) throw new DomainError('NOT_FOUND');
  return c;
}

export function findQuest(state: AppState, id: Id): Quest {
  const q = state.quests.find((x) => x.id === id);
  if (!q) throw new DomainError('NOT_FOUND');
  return q;
}

export function setCategoryEnabled(state: AppState, categoryId: Id, enabled: boolean): AppState {
  findCategory(state, categoryId);
  return { ...state, categories: state.categories.map((c) => (c.id === categoryId ? { ...c, enabled } : c)) };
}

export interface NewCategory {
  name: string;
  icon: string;
  colorKey: string;
}

export function addCategory(state: AppState, ctx: Ctx, input: NewCategory): { state: AppState; category: SkillCategory } {
  const name = input.name.trim();
  const icon = input.icon.trim();
  if (!name || name.length > 40 || !icon || !input.colorKey) throw new DomainError('INVALID_INPUT');
  const category: SkillCategory = {
    id: ctx.newId(),
    name,
    icon,
    colorKey: input.colorKey,
    enabled: true,
    builtIn: false,
    order: Math.max(0, ...state.categories.map((c) => c.order)) + 1,
  };
  return { state: { ...state, categories: [...state.categories, category] }, category };
}

export function updateCategory(state: AppState, categoryId: Id, patch: Partial<NewCategory>): AppState {
  findCategory(state, categoryId);
  if (patch.name !== undefined && !patch.name.trim()) throw new DomainError('INVALID_INPUT');
  return {
    ...state,
    categories: state.categories.map((c) =>
      c.id === categoryId
        ? { ...c, ...patch, name: patch.name?.trim() ?? c.name, icon: patch.icon?.trim() || c.icon }
        : c,
    ),
  };
}

export interface NewQuest {
  categoryId: Id;
  title: string;
  description: string;
  reward: Agorot;
  xp: number;
}

export function addQuest(state: AppState, ctx: Ctx, input: NewQuest): { state: AppState; quest: Quest } {
  findCategory(state, input.categoryId);
  const title = input.title.trim();
  if (!title || title.length > 80) throw new DomainError('INVALID_INPUT');
  assertNonNegativeAmount(input.reward);
  if (!Number.isInteger(input.xp) || input.xp < 0) throw new DomainError('INVALID_INPUT');
  const quest: Quest = {
    id: ctx.newId(),
    categoryId: input.categoryId,
    title,
    description: input.description.trim(),
    reward: input.reward,
    xp: input.xp,
    active: true,
  };
  return { state: { ...state, quests: [...state.quests, quest] }, quest };
}

export function setQuestActive(state: AppState, questId: Id, active: boolean): AppState {
  findQuest(state, questId);
  return { ...state, quests: state.quests.map((q) => (q.id === questId ? { ...q, active } : q)) };
}
