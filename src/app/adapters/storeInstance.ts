import { LocalStorageRepository, SkillQuestStore, createDemoState, createFreshState, type Ctx } from '@core/index';

/** Browser adapter: wires the core store to window.localStorage and the Web Crypto id generator. */
const ctx: Ctx = {
  now: () => new Date(),
  newId: () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`),
};

export const store = new SkillQuestStore(new LocalStorageRepository(window.localStorage), ctx, createDemoState);

export const resetToDemo = () => store.reset(createDemoState);
export const resetToEmpty = () => store.reset(createFreshState);

// Apply the weekly reset when the app comes back to the foreground.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') store.tick();
});
