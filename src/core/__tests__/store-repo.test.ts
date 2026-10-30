import { describe, expect, it } from 'vitest';
import { SkillQuestStore } from '../store';
import { LocalStorageRepository, MemoryStorage } from '../repository/LocalStorageRepository';
import { balanceOf } from '../services/wallet';
import { testCtx } from './helpers';

describe('SkillQuestStore + LocalStorageRepository', () => {
  it('seeds demo data, persists changes and reloads them', () => {
    const storage = new MemoryStorage();
    const ctx = testCtx();
    const store = new SkillQuestStore(new LocalStorageRepository(storage), ctx);
    let calls = 0;
    store.subscribe(() => calls++);
    store.deposit('child-bear', 300);
    const r = store.approve('cmp-4'); // 400 reward, 500 locked now
    expect(r.completion.status).toBe('approved');
    expect(calls).toBe(2);

    const reloaded = new SkillQuestStore(new LocalStorageRepository(storage), ctx);
    expect(balanceOf(reloaded.getState().ledger, 'child-bear')).toMatchObject({ locked: 100, available: 400 });
  });
  it('reset restores the seed', () => {
    const storage = new MemoryStorage();
    const store = new SkillQuestStore(new LocalStorageRepository(storage), testCtx());
    store.setCategoryEnabled('cat-math', false);
    store.reset();
    expect(store.getState().categories.find((c) => c.id === 'cat-math')?.enabled).toBe(true);
  });
  it('ignores corrupt storage', () => {
    const storage = new MemoryStorage();
    storage.setItem('skillquest.state.v1', '{not json');
    const store = new SkillQuestStore(new LocalStorageRepository(storage), testCtx());
    expect(store.getState().family.children.length).toBeGreaterThan(0);
  });
});
