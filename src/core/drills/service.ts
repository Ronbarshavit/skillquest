import { DomainError } from '../model/errors';
import type { AppState, DifficultyChange, DrillAttempt, GuidedDrillSpec, Id, LedgerEntry, LevelChange, Quest, QuestCompletion, QuizDrillSpec, WeekId } from '../model/types';
import type { Ctx } from '../services/context';
import { findCategory, findQuest } from '../services/categories';
import { addXp } from '../services/levels';
import { questStatus, submitQuest } from '../services/quests';
import { balanceOf } from '../services/wallet';
import { weekIdOf } from '../services/week';
import { drillSeed, generateDrill, isPass, scoreDrill } from './engine';
import { findTemplate, type GuidedTemplate } from './guided';
import type { Question, DrillResponse } from './types';
import { applyQuizToDifficulty, currentDifficulty } from './adaptive';

/** A drill in progress. Not persisted: it is fully reproducible from the seed and level. */
export interface DrillSession {
  childId: Id;
  questId: Id;
  weekId: WeekId;
  attempt: number;
  seed: string;
  level: number;
  spec: QuizDrillSpec;
  questions: Question[];
}

export type DrillOutcome =
  /** Below the pass score: nothing awarded, retry any time. */
  | 'failed'
  /** Passed an auto-approve quiz: money and XP credited now. */
  | 'auto-approved'
  /** Passed, waiting for the parent to approve. */
  | 'submitted'
  /** Passed, but the quest was already done/sent this week: practice only. */
  | 'practice';

export interface DrillResult {
  state: AppState;
  attempt: DrillAttempt;
  outcome: DrillOutcome;
  completion?: QuestCompletion;
  /** Agorot actually moved to available (may be less than the reward when the deposit is short). */
  credited: number;
  levelChange?: LevelChange;
  /** The quiz moved the category difficulty (adaptive). */
  difficultyChange?: DifficultyChange;
}

export const quizSpec = (q: Quest): QuizDrillSpec | undefined => (q.drill?.kind === 'quiz' ? q.drill : undefined);
export const guidedSpec = (q: Quest): GuidedDrillSpec | undefined => (q.drill?.kind === 'guided' ? q.drill : undefined);
export const guidedTemplateFor = (q: Quest): GuidedTemplate | undefined => {
  const g = guidedSpec(q);
  return g ? findTemplate(g.templateId) : undefined;
};

/** Difficulty for this child in the quest's category: placement/adaptive difficulty, else their level clamped to 1..5. */
export function drillLevel(state: AppState, childId: Id, quest: Quest): number {
  return currentDifficulty(state, childId, quest.categoryId);
}

export function attemptsFor(state: AppState, childId: Id, questId: Id, weekId?: WeekId): DrillAttempt[] {
  return (state.drillAttempts ?? []).filter((a) => a.childId === childId && a.questId === questId && (!weekId || a.weekId === weekId));
}

/** Best attempt ever (highest score ratio, then most recent). */
export function bestAttempt(state: AppState, childId: Id, questId: Id): DrillAttempt | undefined {
  return attemptsFor(state, childId, questId).reduce<DrillAttempt | undefined>((best, a) => {
    if (!best) return a;
    const r = a.correct / a.total, br = best.correct / best.total;
    return r > br || (r === br && a.finishedAt > best.finishedAt) ? a : best;
  }, undefined);
}

function assertPlayable(state: AppState, childId: Id, quest: Quest) {
  if (!quest.active) throw new DomainError('QUEST_INACTIVE');
  if (!findCategory(state, quest.categoryId).enabled) throw new DomainError('CATEGORY_DISABLED');
  if (!state.family.children.some((c) => c.id === childId)) throw new DomainError('NOT_FOUND');
}

/** Starts a new attempt: same child + quest + week + attempt number → same questions. */
export function startDrill(state: AppState, ctx: Ctx, childId: Id, questId: Id): DrillSession {
  const quest = findQuest(state, questId);
  const spec = quizSpec(quest);
  if (!spec) throw new DomainError('NOT_A_DRILL');
  assertPlayable(state, childId, quest);
  const weekId = weekIdOf(ctx.now(), state.family.settings.weekStartsOn);
  const attempt = attemptsFor(state, childId, questId, weekId).length + 1;
  const seed = drillSeed(childId, questId, weekId, attempt);
  const level = drillLevel(state, childId, quest);
  return { childId, questId, weekId, attempt, seed, level, spec, questions: generateDrill(spec, level, seed) };
}

/**
 * Credits a completion: moves min(reward, locked) from locked → available and adds XP.
 * Used for auto-approved quizzes, where the child should never be blocked by a short deposit.
 */
function creditNow(state: AppState, ctx: Ctx, c: QuestCompletion, categoryId: Id) {
  const now = ctx.now();
  const { locked } = balanceOf(state.ledger, c.childId);
  const credited = Math.max(0, Math.min(c.reward, locked));
  let next = state;
  if (credited > 0) {
    const entry: LedgerEntry = {
      id: ctx.newId(),
      childId: c.childId,
      type: 'unlock',
      amount: credited,
      weekId: weekIdOf(now, state.family.settings.weekStartsOn),
      at: now.toISOString(),
      ref: c.id,
    };
    next = { ...next, ledger: [...next.ledger, entry] };
  }
  const xp = addXp(next, c.childId, categoryId, c.xp);
  const completion: QuestCompletion = {
    ...c,
    status: 'approved',
    decidedAt: now.toISOString(),
    autoApproved: true,
    celebrated: false,
    levelChange: xp.levelChange,
    reward: credited,
    ...(credited < c.reward ? { rewardRequested: c.reward } : {}),
  };
  return { state: xp.state, completion, credited, levelChange: xp.levelChange };
}

/**
 * Scores an attempt, records it, awards the quest only on a pass, and adapts the category
 * difficulty for the next quizzes (two strong quizzes → harder, a hard one → easier).
 */
export function finishDrill(state: AppState, ctx: Ctx, session: DrillSession, responses: readonly (DrillResponse | undefined)[]): DrillResult {
  const r = scoreAndAward(state, ctx, session, responses);
  const quest = findQuest(state, session.questId);
  const ad = applyQuizToDifficulty(r.state, session.childId, quest.categoryId, session.level, r.attempt.correct, r.attempt.total);
  if (ad.state === r.state) return r;
  if (!ad.change) return { ...r, state: ad.state };
  const attempt: DrillAttempt = { ...r.attempt, difficultyChange: ad.change };
  const next = { ...ad.state, drillAttempts: (ad.state.drillAttempts ?? []).map((a) => (a.id === attempt.id ? attempt : a)) };
  return { ...r, state: next, attempt, difficultyChange: ad.change };
}

function scoreAndAward(state: AppState, ctx: Ctx, session: DrillSession, responses: readonly (DrillResponse | undefined)[]): DrillResult {
  const quest = findQuest(state, session.questId);
  const spec = quizSpec(quest);
  if (!spec) throw new DomainError('NOT_A_DRILL');
  // Regenerate from the seed, so scoring never trusts questions passed in from the UI.
  const questions = generateDrill(session.spec, session.level, session.seed);
  if (responses.length !== questions.length) throw new DomainError('DRILL_INCOMPLETE');
  const score = scoreDrill(questions, responses);
  const passScore = Math.min(session.spec.passScore, questions.length);
  const passed = isPass(score, passScore);
  const now = ctx.now();
  const attempt: DrillAttempt = {
    id: ctx.newId(),
    childId: session.childId,
    questId: session.questId,
    weekId: session.weekId,
    attempt: session.attempt,
    seed: session.seed,
    level: session.level,
    topic: session.spec.topic,
    total: score.total,
    correct: score.correct,
    passScore,
    passed,
    finishedAt: now.toISOString(),
    results: score.results,
  };
  const withAttempt = (s: AppState, a: DrillAttempt): AppState => ({ ...s, drillAttempts: [...(s.drillAttempts ?? []), a] });

  if (!passed) return { state: withAttempt(state, attempt), attempt, outcome: 'failed', credited: 0 };

  const weekId = weekIdOf(now, state.family.settings.weekStartsOn);
  const status = questStatus(state, session.childId, session.questId, weekId);
  if (status === 'submitted' || status === 'approved' || !quest.active || !findCategory(state, quest.categoryId).enabled)
    return { state: withAttempt(state, attempt), attempt, outcome: 'practice', credited: 0 };

  const sub = submitQuest(state, ctx, session.childId, session.questId);
  const submitted: QuestCompletion = { ...sub.completion, drill: { attemptId: attempt.id, correct: score.correct, total: score.total } };
  const linked: DrillAttempt = { ...attempt, completionId: submitted.id };

  if (spec.autoApprove) {
    const r = creditNow(state, ctx, submitted, quest.categoryId);
    const next = withAttempt({ ...r.state, completions: [...r.state.completions, r.completion] }, linked);
    return { state: next, attempt: linked, outcome: 'auto-approved', completion: r.completion, credited: r.credited, levelChange: r.levelChange };
  }
  const next = withAttempt({ ...state, completions: [...state.completions, submitted] }, linked);
  return { state: next, attempt: linked, outcome: 'submitted', completion: submitted, credited: 0 };
}

export interface GuidedSubmission {
  /** Ids of the steps the child ticked. */
  stepsDone: string[];
  note?: string;
}

/** Sends a guided activity to the parent: every step ticked, and a note when the template asks for one. */
export function submitGuided(state: AppState, ctx: Ctx, childId: Id, questId: Id, input: GuidedSubmission): { state: AppState; completion: QuestCompletion } {
  const quest = findQuest(state, questId);
  const tpl = guidedTemplateFor(quest);
  if (!tpl) throw new DomainError('NOT_A_DRILL');
  const done = new Set(input.stepsDone);
  const note = input.note?.trim() || undefined;
  if (!tpl.steps.every((s) => done.has(s.id))) throw new DomainError('DRILL_INCOMPLETE');
  if (tpl.reflect && !note) throw new DomainError('DRILL_INCOMPLETE');
  if (note && note.length > 300) throw new DomainError('INVALID_INPUT');
  const r = submitQuest(state, ctx, childId, questId);
  const completion: QuestCompletion = { ...r.completion, guided: { templateId: tpl.id, stepsDone: tpl.steps.length, stepsTotal: tpl.steps.length, ...(note ? { note } : {}) } };
  return { state: { ...r.state, completions: r.state.completions.map((c) => (c.id === completion.id ? completion : c)) }, completion };
}
