import { describe, expect, it } from 'vitest';
import { createDemoState, createEmptyState, DEMO_QUESTS } from '../seed';
import { deposit, balanceOf } from '../services/wallet';
import { addQuest } from '../services/categories';
import { childLevel, getProgress, setLevelCurve, setStartLevel } from '../services/levels';
import { approveCompletion, pendingApprovals, questStatus, uncelebrated } from '../services/quests';
import { attemptsFor, bestAttempt, drillLevel, finishDrill, startDrill, submitGuided } from '../drills/service';
import { migrateState } from '../drills/migrate';
import { findTemplate } from '../drills/guided';
import { DomainError } from '../model/errors';
import type { AppState, DrillSpec } from '../model/types';
import type { DrillResponse, Question } from '../drills/types';
import { testCtx } from './helpers';
import { SkillQuestStore } from '../store';
import { LocalStorageRepository } from '../repository/LocalStorageRepository';

const CHILD = 'child-1';
const right = (q: Question): DrillResponse => (q.type === 'numeric' ? { value: String(q.answer) } : q.type === 'match' ? { pairs: q.answer } : { choice: q.answerIndex });
const wrong = (q: Question): DrillResponse => (q.type === 'numeric' ? { value: String(q.answer + 1) } : q.type === 'match' ? { pairs: [...q.answer].reverse() } : { choice: (q.answerIndex + 1) % q.choices.length });
/** Answer the first `n` questions correctly, the rest wrong. */
const answers = (qs: Question[], n: number) => qs.map((q, i) => (i < n ? right(q) : wrong(q)));
const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return (e as DomainError).code;
  }
  return 'no error';
};
const setup = (lockedShekels = 50) => {
  const ctx = testCtx();
  let s = setLevelCurve(createEmptyState(ctx), { baseXp: 30, growth: 1, maxLevel: 10 });
  if (lockedShekels) s = deposit(s, ctx, CHILD, lockedShekels * 100);
  return { ctx, s };
};
const withSpec = (s: AppState, questId: string, drill: DrillSpec): AppState => ({ ...s, quests: s.quests.map((q) => (q.id === questId ? { ...q, drill } : q)) });

describe('drill sessions', () => {
  it('seed = child + quest + week + attempt; level follows the child', () => {
    const { ctx, s } = setup();
    const a = startDrill(s, ctx, CHILD, 'q-math-3');
    expect(a.seed).toBe(`${CHILD}|q-math-3|${a.weekId}|1`);
    expect(a.attempt).toBe(1);
    expect(a.level).toBe(1);
    expect(startDrill(s, ctx, CHILD, 'q-math-3').questions).toEqual(a.questions);
    const s3 = setStartLevel(s, CHILD, 'cat-math', 4);
    expect(startDrill(s3, ctx, CHILD, 'q-math-3').level).toBe(4);
    const s9 = setStartLevel(s, CHILD, 'cat-math', 9);
    expect(childLevel(s9, CHILD, 'cat-math').level).toBe(9);
    expect(drillLevel(s9, CHILD, s9.quests.find((q) => q.id === 'q-math-3')!)).toBe(5);
  });
  it('rejects guided / legacy quests and missing answers', () => {
    const { ctx, s } = setup();
    expect(code(() => startDrill(s, ctx, CHILD, 'q-sport-1'))).toBe('NOT_A_DRILL');
    const session = startDrill(s, ctx, CHILD, 'q-math-3');
    expect(code(() => finishDrill(s, ctx, session, []))).toBe('DRILL_INCOMPLETE');
  });
});

describe('finishDrill awarding', () => {
  it('fail: records the attempt, awards nothing; the next attempt has new questions', () => {
    const { ctx, s } = setup();
    const session = startDrill(s, ctx, CHILD, 'q-math-3'); // 10 questions, pass 8
    const r = finishDrill(s, ctx, session, answers(session.questions, 7));
    expect(r.outcome).toBe('failed');
    expect(r.attempt).toMatchObject({ correct: 7, total: 10, passed: false, passScore: 8 });
    expect(r.state.completions).toHaveLength(0);
    expect(balanceOf(r.state.ledger, CHILD)).toMatchObject({ locked: 5000, available: 0 });
    expect(r.state.progress).toEqual(s.progress);
    const next = startDrill(r.state, ctx, CHILD, 'q-math-3');
    expect(next.attempt).toBe(2);
    expect(next.questions).not.toEqual(session.questions);
  });
  it('pass on an auto-approve quiz credits locked → available and XP immediately, ready to celebrate', () => {
    const { ctx, s } = setup();
    const session = startDrill(s, ctx, CHILD, 'q-math-3'); // reward 3 ₪, 10 XP
    const r = finishDrill(s, ctx, session, answers(session.questions, 8));
    expect(r.outcome).toBe('auto-approved');
    expect(r.credited).toBe(300);
    expect(balanceOf(r.state.ledger, CHILD)).toMatchObject({ locked: 4700, available: 300 });
    expect(r.completion).toMatchObject({ status: 'approved', autoApproved: true, reward: 300, celebrated: false, drill: { correct: 8, total: 10 } });
    expect(r.completion!.rewardRequested).toBeUndefined();
    expect(getProgress(r.state, CHILD, 'cat-math').xp).toBe(10);
    expect(r.attempt.completionId).toBe(r.completion!.id);
    expect(uncelebrated(r.state, CHILD).map((c) => c.id)).toEqual([r.completion!.id]);
    expect(questStatus(r.state, CHILD, 'q-math-3')).toBe('approved');
    expect(pendingApprovals(r.state)).toHaveLength(0);
  });
  it('deposit cap: credits only what is locked and remembers the full reward', () => {
    const { ctx, s } = setup(0);
    const s1 = deposit(s, ctx, CHILD, 120);
    const session = startDrill(s1, ctx, CHILD, 'q-math-3');
    const r = finishDrill(s1, ctx, session, answers(session.questions, 10));
    expect(r.outcome).toBe('auto-approved');
    expect(r.credited).toBe(120);
    expect(r.completion).toMatchObject({ reward: 120, rewardRequested: 300 });
    expect(balanceOf(r.state.ledger, CHILD)).toMatchObject({ locked: 0, available: 120 });
    expect(getProgress(r.state, CHILD, 'cat-math').xp).toBe(10);
  });
  it('nothing locked: still passes and earns XP, no ledger entry', () => {
    const { ctx, s } = setup(0);
    const session = startDrill(s, ctx, CHILD, 'q-math-3');
    const r = finishDrill(s, ctx, session, answers(session.questions, 10));
    expect(r.credited).toBe(0);
    expect(r.state.ledger).toHaveLength(0);
    expect(balanceOf(r.state.ledger, CHILD).locked).toBe(0);
    expect(r.completion).toMatchObject({ reward: 0, rewardRequested: 300 });
  });
  it('manual quiz: a pass goes to the parent with the score; approval then releases the money', () => {
    const { ctx, s } = setup();
    const session = startDrill(s, ctx, CHILD, 'q-lang-1'); // en-vocab, autoApprove off
    const r = finishDrill(s, ctx, session, answers(session.questions, 9));
    expect(r.outcome).toBe('submitted');
    expect(r.completion).toMatchObject({ status: 'submitted', drill: { correct: 9, total: 10 } });
    expect(balanceOf(r.state.ledger, CHILD).available).toBe(0);
    const ap = approveCompletion(r.state, ctx, r.completion!.id);
    expect(balanceOf(ap.state.ledger, CHILD)).toMatchObject({ available: 500 });
  });
  it('pass threshold is configurable per quest', () => {
    const { ctx, s } = setup();
    const s1 = withSpec(s, 'q-math-3', { kind: 'quiz', topic: 'mental-math', length: 5, passScore: 5, autoApprove: true });
    const sess = startDrill(s1, ctx, CHILD, 'q-math-3');
    expect(sess.questions).toHaveLength(5);
    expect(finishDrill(s1, ctx, sess, answers(sess.questions, 4)).outcome).toBe('failed');
    expect(finishDrill(s1, ctx, sess, answers(sess.questions, 5)).outcome).toBe('auto-approved');
  });
  it('after the weekly reward, more passes are practice only (no double pay); best score tracked', () => {
    const { ctx, s } = setup();
    const a1 = startDrill(s, ctx, CHILD, 'q-math-3');
    const r1 = finishDrill(s, ctx, a1, answers(a1.questions, 8));
    const a2 = startDrill(r1.state, ctx, CHILD, 'q-math-3');
    const r2 = finishDrill(r1.state, ctx, a2, answers(a2.questions, 10));
    expect(r2.outcome).toBe('practice');
    expect(r2.credited).toBe(0);
    expect(balanceOf(r2.state.ledger, CHILD).available).toBe(300);
    expect(attemptsFor(r2.state, CHILD, 'q-math-3')).toHaveLength(2);
    expect(bestAttempt(r2.state, CHILD, 'q-math-3')).toMatchObject({ correct: 10, attempt: 2 });
    // New week → new reward.
    ctx.advanceDays(7);
    const a3 = startDrill(r2.state, ctx, CHILD, 'q-math-3');
    expect(a3.attempt).toBe(1);
    expect(finishDrill(r2.state, ctx, a3, answers(a3.questions, 9)).outcome).toBe('auto-approved');
  });
  it('scoring never trusts questions sent back from the UI', () => {
    const { ctx, s } = setup();
    const session = startDrill(s, ctx, CHILD, 'q-math-3');
    const forged = { ...session, questions: session.questions.map((q) => ({ ...q, type: 'numeric', answer: 0 }) as Question) };
    const r = finishDrill(s, ctx, forged, session.questions.map(() => ({ value: '0' })));
    expect(r.outcome).toBe('failed');
  });
});

describe('guided activities', () => {
  it('requires every step and the reflection note, then waits for the parent', () => {
    const { ctx, s } = setup();
    const tpl = findTemplate('sport-jump-rope')!;
    const all = tpl.steps.map((x) => x.id);
    expect(code(() => submitGuided(s, ctx, CHILD, 'q-sport-2', { stepsDone: all.slice(1), note: '40' }))).toBe('DRILL_INCOMPLETE');
    expect(code(() => submitGuided(s, ctx, CHILD, 'q-sport-2', { stepsDone: all }))).toBe('DRILL_INCOMPLETE');
    expect(code(() => submitGuided(s, ctx, CHILD, 'q-math-3', { stepsDone: [] }))).toBe('NOT_A_DRILL');
    const r = submitGuided(s, ctx, CHILD, 'q-sport-2', { stepsDone: all, note: ' 42 קפיצות ' });
    expect(r.completion).toMatchObject({ status: 'submitted', guided: { templateId: 'sport-jump-rope', stepsDone: 6, stepsTotal: 6, note: '42 קפיצות' } });
    expect(balanceOf(r.state.ledger, CHILD).available).toBe(0);
    expect(code(() => submitGuided(r.state, ctx, CHILD, 'q-sport-2', { stepsDone: all, note: 'x' }))).toBe('ALREADY_SUBMITTED');
    const ap = approveCompletion(r.state, ctx, r.completion.id);
    expect(balanceOf(ap.state.ledger, CHILD).available).toBe(300);
  });
});

describe('quest editor + migration', () => {
  it('addQuest validates the drill spec', () => {
    const { ctx, s } = setup();
    const base = { categoryId: 'cat-math', title: 'חילוק', description: '', reward: 200, xp: 10 };
    const ok = addQuest(s, ctx, { ...base, drill: { kind: 'quiz', topic: 'mental-math', length: 12, passScore: 9, autoApprove: true } });
    expect(ok.quest.drill).toEqual({ kind: 'quiz', topic: 'mental-math', length: 12, passScore: 9, autoApprove: true });
    expect(addQuest(s, ctx, { ...base, drill: { kind: 'guided', templateId: 'any-puzzles' } }).quest.drill).toEqual({ kind: 'guided', templateId: 'any-puzzles' });
    expect(code(() => addQuest(s, ctx, { ...base, drill: { kind: 'quiz', topic: 'mental-math', length: 10, passScore: 11, autoApprove: true } }))).toBe('INVALID_INPUT');
    expect(code(() => addQuest(s, ctx, { ...base, drill: { kind: 'quiz', topic: 'mental-math', length: 2, passScore: 1, autoApprove: true } }))).toBe('INVALID_INPUT');
    expect(code(() => addQuest(s, ctx, { ...base, drill: { kind: 'quiz', topic: 'nope' as never, length: 10, passScore: 8, autoApprove: true } }))).toBe('INVALID_INPUT');
    expect(code(() => addQuest(s, ctx, { ...base, drill: { kind: 'guided', templateId: 'nope' } }))).toBe('INVALID_INPUT');
    expect(code(() => addQuest(s, ctx, { ...base, drill: { kind: 'quiz', topic: 'mental-math', length: 10, passScore: 8, autoApprove: true, table: 7 } }))).toBe('INVALID_INPUT');
  });
  it('every starter quest has a real drill', () => {
    DEMO_QUESTS.forEach((q) => expect(q.drill).toBeDefined());
    const demo = createDemoState(testCtx());
    demo.quests.forEach((q) => expect(q.drill).toBeDefined());
  });
  it('migrates data saved before drills (idempotent, keeps parent settings)', () => {
    const ctx = testCtx();
    const fresh = createEmptyState(ctx);
    const legacyIds = ['q-math-1', 'q-math-2', 'q-math-3', 'q-lang-1', 'q-lang-2', 'q-soft-1', 'q-soft-2', 'q-sport-1', 'q-sport-2', 'q-music-1', 'q-music-2'];
    const old: AppState = { ...fresh, quests: fresh.quests.filter((q) => legacyIds.includes(q.id)).map(({ drill: _d, ...q }) => ({ ...q, reward: 999, active: q.id !== 'q-math-2' })) };
    delete old.drillAttempts;
    const m = migrateState(old);
    expect(m.drillAttempts).toEqual([]);
    expect(m.quests.length).toBe(DEMO_QUESTS.length);
    const m1 = m.quests.find((q) => q.id === 'q-math-1')!;
    expect(m1).toMatchObject({ reward: 999, drill: { kind: 'quiz', topic: 'times-tables', table: 7 } });
    expect(m.quests.find((q) => q.id === 'q-math-2')!.active).toBe(false);
    expect(migrateState(m)).toBe(m);
  });
  it('store: drills persist through the repository', () => {
    const mem = new Map<string, string>();
    const storage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) };
    const ctx = testCtx();
    const store = new SkillQuestStore(new LocalStorageRepository(storage), ctx, (c) => deposit(createEmptyState(c), c, CHILD, 1000));
    const session = store.startDrill(CHILD, 'q-math-3');
    const r = store.finishDrill(session, answers(session.questions, 10));
    expect(r.outcome).toBe('auto-approved');
    const reloaded = new SkillQuestStore(new LocalStorageRepository(storage), ctx);
    expect(reloaded.getState().drillAttempts).toHaveLength(1);
    expect(balanceOf(reloaded.getState().ledger, CHILD).available).toBe(300);
  });
});
