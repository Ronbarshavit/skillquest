import type { AppState, Quest } from '../model/types';
import { DEMO_CUSTOM_QUESTS, DEMO_QUESTS } from '../seed';

const STARTER = new Map<string, Quest>([...DEMO_QUESTS, ...DEMO_CUSTOM_QUESTS].map((q) => [q.id, q]));

/**
 * Upgrades data saved before drills existed (pure + idempotent):
 * - starter quests (stable seed ids) without a drill get the drill and the updated copy;
 * - new starter quests are added to built-in categories that exist;
 * - `drillAttempts` is initialised.
 * Reward, XP and active flags the parent set are kept.
 */
export function migrateState(state: AppState): AppState {
  let changed = false;
  const quests = state.quests.map((q) => {
    const starter = STARTER.get(q.id);
    if (!starter || q.drill || !starter.drill) return q;
    changed = true;
    return { ...q, title: starter.title, description: starter.description, drill: starter.drill };
  });
  const have = new Set(quests.map((q) => q.id));
  const builtInCats = new Set(state.categories.filter((c) => c.builtIn).map((c) => c.id));
  const added = DEMO_QUESTS.filter((q) => !have.has(q.id) && builtInCats.has(q.categoryId));
  if (added.length) changed = true;
  if (!state.drillAttempts) changed = true;
  if (!changed) return state;
  return { ...state, quests: [...quests, ...added], drillAttempts: state.drillAttempts ?? [] };
}
