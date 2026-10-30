import type { Agorot, AppState, Id, LevelCurve, QuestCompletion, UnspentPolicy } from './model/types';
import type { StateRepository } from './repository/StateRepository';
import { defaultCtx, type Ctx } from './services/context';
import * as cat from './services/categories';
import * as budget from './services/budget';
import * as levels from './services/levels';
import * as quests from './services/quests';
import * as wallet from './services/wallet';
import { startNewWeekIfNeeded, setUnspentPolicy } from './services/weekReset';
import { createDemoState } from './seed';
import * as pin from './services/pin';
import * as onboarding from './services/onboarding';
import * as children from './services/children';
import * as drills from './drills/service';
import { migrateState } from './drills/migrate';
import * as adaptive from './drills/adaptive';
import type { DrillResponse } from './drills/types';

type Listener = () => void;

/**
 * Application service / facade. Holds the current state, persists every change through the
 * repository and notifies subscribers. UI frameworks subscribe via `subscribe`/`getState`
 * (compatible with React's useSyncExternalStore).
 */
export class SkillQuestStore {
  private state: AppState;
  private listeners = new Set<Listener>();

  constructor(
    private readonly repo: StateRepository,
    private readonly ctx: Ctx = defaultCtx,
    private readonly seed: (ctx: Ctx) => AppState = createDemoState,
  ) {
    const stored = repo.load();
    const loaded = stored ? migrateState(stored) : seed(ctx);
    this.state = startNewWeekIfNeeded(loaded, ctx).state;
    repo.save(this.state);
  }

  getState = (): AppState => this.state;

  subscribe = (l: Listener): (() => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };

  private commit(next: AppState) {
    this.state = next;
    this.repo.save(next);
    this.listeners.forEach((l) => l());
  }

  /** Call on app focus / periodically to apply the weekly reset. */
  tick() {
    const r = startNewWeekIfNeeded(this.state, this.ctx);
    if (r.changed) this.commit(r.state);
  }

  /** Wipe storage and reload the demo (or empty) seed. */
  reset(seed: (ctx: Ctx) => AppState = this.seed) {
    this.repo.clear();
    this.commit(seed(this.ctx));
  }

  // Quests
  submitQuest(childId: Id, questId: Id): QuestCompletion {
    const r = quests.submitQuest(this.state, this.ctx, childId, questId);
    this.commit(r.state);
    return r.completion;
  }
  approve(completionId: Id) {
    const r = quests.approveCompletion(this.state, this.ctx, completionId);
    this.commit(r.state);
    return r;
  }
  reject(completionId: Id, note?: string) {
    this.commit(quests.rejectCompletion(this.state, this.ctx, completionId, note));
  }
  // Drills
  /** New attempt for a quiz quest (not persisted until finished). */
  startDrill(childId: Id, questId: Id): drills.DrillSession {
    return drills.startDrill(this.state, this.ctx, childId, questId);
  }
  finishDrill(session: drills.DrillSession, responses: readonly (DrillResponse | undefined)[]): Omit<drills.DrillResult, 'state'> {
    const { state, ...rest } = drills.finishDrill(this.state, this.ctx, session, responses);
    this.commit(state);
    return rest;
  }
  // Placement test + adaptive difficulty
  startPlacement(childId: Id, categoryId: Id): adaptive.PlacementSession {
    return adaptive.startPlacement(this.state, this.ctx, childId, categoryId);
  }
  finishPlacement(session: adaptive.PlacementSession, responses: readonly (DrillResponse | undefined)[]) {
    const r = adaptive.finishPlacement(this.state, this.ctx, session, responses);
    this.commit(r.state);
    return r.record;
  }
  setDifficulty(childId: Id, categoryId: Id, level: number) {
    this.commit(adaptive.setDifficulty(this.state, childId, categoryId, level));
  }
  resetPlacement(childId: Id, categoryId: Id) {
    this.commit(adaptive.resetPlacement(this.state, childId, categoryId));
  }
  submitGuided(childId: Id, questId: Id, input: drills.GuidedSubmission): QuestCompletion {
    const r = drills.submitGuided(this.state, this.ctx, childId, questId, input);
    this.commit(r.state);
    return r.completion;
  }
  markCelebrated(completionId: Id) {
    this.commit(quests.markCelebrated(this.state, completionId));
  }

  // Money
  deposit(childId: Id, amount: Agorot, note?: string) {
    this.commit(wallet.deposit(this.state, this.ctx, childId, amount, note));
  }
  setWeeklyBudget(childId: Id, amount: Agorot) {
    this.commit(budget.setWeeklyBudget(this.state, childId, amount));
  }
  setUnspentPolicy(policy: UnspentPolicy) {
    this.commit(setUnspentPolicy(this.state, policy));
  }

  // Interest areas
  setCategoryEnabled(categoryId: Id, enabled: boolean) {
    this.commit(cat.setCategoryEnabled(this.state, categoryId, enabled));
  }
  addCategory(input: cat.NewCategory) {
    const r = cat.addCategory(this.state, this.ctx, input);
    this.commit(r.state);
    return r.category;
  }
  updateCategory(categoryId: Id, patch: Partial<cat.NewCategory>) {
    this.commit(cat.updateCategory(this.state, categoryId, patch));
  }
  addQuest(input: cat.NewQuest) {
    const r = cat.addQuest(this.state, this.ctx, input);
    this.commit(r.state);
    return r.quest;
  }
  setQuestActive(questId: Id, active: boolean) {
    this.commit(cat.setQuestActive(this.state, questId, active));
  }

  // Parent lock (simple lock, not security)
  createPin(p: string, confirm: string) {
    this.commit(pin.createPin(this.state, this.ctx, p, confirm));
  }
  /** Persists attempt counters, returns the check result. */
  verifyPin(p: string): pin.PinCheck {
    const r = pin.verifyPin(this.state, this.ctx, p);
    if (r.state !== this.state) this.commit(r.state);
    return r.result;
  }
  pinStatus(): pin.PinLockStatus {
    return pin.pinLockStatus(this.state, this.ctx.now());
  }
  changePin(p: string, confirm: string) {
    this.commit(pin.changePin(this.state, this.ctx, p, confirm));
  }
  resetPin(confirmed: boolean) {
    this.commit(pin.resetPin(this.state, confirmed));
  }

  // Onboarding
  completeOnboarding(input: onboarding.OnboardingInput) {
    this.commit(onboarding.completeOnboarding(this.state, this.ctx, input));
  }

  // Children
  addChild(input: children.NewChild) {
    const r = children.addChild(this.state, this.ctx, input);
    this.commit(r.state);
    return r.child;
  }
  updateChild(childId: Id, patch: { name?: string; avatar?: string }) {
    this.commit(children.updateChild(this.state, childId, patch));
  }
  removeChild(childId: Id, confirmed: boolean) {
    this.commit(children.removeChild(this.state, childId, confirmed));
  }

  // Levels
  setStartLevel(childId: Id, categoryId: Id, level: number) {
    this.commit(levels.setStartLevel(this.state, childId, categoryId, level));
  }
  setLevelCurve(curve: LevelCurve) {
    this.commit(levels.setLevelCurve(this.state, curve));
  }
}
