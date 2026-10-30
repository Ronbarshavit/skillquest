import { describe, expect, it } from 'vitest';
import { createEmptyState } from '../seed';
import { balanceOf, deposit } from '../services/wallet';
import { getProgress, setStartLevel } from '../services/levels';
import { setCategoryEnabled } from '../services/categories';
import {
  ADAPT,
  PLACEMENT,
  adapt,
  applyQuizToDifficulty,
  currentDifficulty,
  finishPlacement,
  migrateProgress,
  needsPlacement,
  placedLevel,
  placementKind,
  placementQuestion,
  placementStep,
  resetPlacement,
  setDifficulty,
  staircase,
  startPlacement,
  type PlacementSession,
} from '../drills/adaptive';
import { drillLevel, finishDrill, startDrill } from '../drills/service';
import { migrateState } from '../drills/migrate';
import { checkAnswer } from '../drills/engine';
import { DomainError } from '../model/errors';
import type { AppState, SkillProgress } from '../model/types';
import type { DrillResponse, Question } from '../drills/types';
import { testCtx } from './helpers';

const CHILD = 'child-1';
const right = (q: Question): DrillResponse => (q.type === 'numeric' ? { value: String(q.answer) } : q.type === 'match' ? { pairs: q.answer } : { choice: q.answerIndex });
const wrong = (q: Question): DrillResponse => (q.type === 'numeric' ? { value: String(q.answer + 1) } : q.type === 'match' ? { pairs: [...q.answer].reverse() } : { choice: (q.answerIndex + 1) % q.choices.length });
const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return (e as DomainError).code;
  }
  return 'no error';
};

/** Plays a placement test answering with `policy(level, index)` → right/wrong. */
function play(session: PlacementSession, policy: (level: number, i: number) => boolean) {
  const responses: DrillResponse[] = [];
  for (let guard = 0; guard < 20; guard++) {
    const step = placementStep(session, responses);
    if (step.done) return { step, responses };
    const i = responses.length;
    const q = step.questions[i];
    const level = step.stair.path[i];
    responses.push(policy(level, i) ? right(q) : wrong(q));
  }
  throw new Error('placement did not finish');
}

const setup = () => {
  const ctx = testCtx();
  const s = deposit(createEmptyState(ctx), ctx, CHILD, 5000);
  return { ctx, s };
};

describe('staircase', () => {
  it('starts in the middle, moves one level per answer and stays within 1..5', () => {
    expect(staircase([]).next).toBe(PLACEMENT.startLevel);
    expect(staircase([true]).next).toBe(4);
    expect(staircase([true, true, true, true]).path).toEqual([3, 4, 5, 5, 5]);
    expect(staircase([false, false, false]).path).toEqual([3, 2, 1, 1]);
  });
  it('stops after 6–8 questions: when the level settles or at the cap', () => {
    // up, down, up, down … → 3 reversals by question 6
    const zig = [true, false, true, false, true, false];
    expect(staircase(zig.slice(0, 5)).done).toBe(false);
    expect(staircase(zig).done).toBe(true);
    // pinned at the top / bottom
    expect(staircase([true, true, true, true, true, true]).done).toBe(true);
    expect(staircase([false, false, false, false, false, false]).done).toBe(true);
    // never more than 8
    const mixed = [true, true, false, false, false, true, true, true];
    expect(staircase(mixed.slice(0, 7)).done).toBe(false);
    expect(staircase(mixed).done).toBe(true);
    expect(staircase([...mixed, true, true]).path).toHaveLength(PLACEMENT.maxQuestions);
  });
  it('placed level = highest level answered right at least as often as wrong', () => {
    expect(placedLevel([3, 4, 5, 4, 5, 4], [true, true, false, true, false, true])).toBe(4);
    expect(placedLevel([3, 4, 5, 5, 5, 5], [true, true, true, true, true, true])).toBe(5);
    expect(placedLevel([3, 2, 1, 1, 1, 1], [false, false, false, false, false, false])).toBe(1);
    expect(placedLevel([3, 2, 3, 2, 3, 4], [false, true, false, true, true, false])).toBe(2);
    expect(placedLevel([3, 4, 3, 4, 3, 4], [true, false, true, false, true, false])).toBe(3);
    expect(placedLevel([3, 2, 3, 2, 3, 2], [false, true, false, true, false, true])).toBe(2);
  });
});

describe('placement test', () => {
  it('applies to Math and English categories only, and only until taken', () => {
    const { s } = setup();
    expect(placementKind(s, 'cat-math')).toBe('math');
    expect(placementKind(s, 'cat-lang')).toBe('english');
    expect(placementKind(s, 'cat-sport')).toBeUndefined();
    expect(needsPlacement(s, CHILD, 'cat-math')).toBe(true);
    expect(needsPlacement(s, CHILD, 'cat-sport')).toBe(false);
    expect(code(() => startPlacement(s, testCtx(), CHILD, 'cat-sport'))).toBe('NO_PLACEMENT');
    expect(code(() => startPlacement(setCategoryEnabled(s, 'cat-math', false), testCtx(), CHILD, 'cat-math'))).toBe('CATEGORY_DISABLED');
  });
  it('questions are deterministic per seed/index/level and match the level asked', () => {
    const a = placementQuestion('math', 'seed', 0, 3);
    expect(placementQuestion('math', 'seed', 0, 3)).toEqual(a);
    expect(placementQuestion('math', 'seed', 0, 4)).not.toEqual(a);
    const e = placementQuestion('english', 'seed', 2, 2);
    expect(['choice', 'blank']).toContain(e.type);
  });
  for (const [kind, cat] of [['math', 'cat-math'], ['english', 'cat-lang']] as const) {
    it(`${kind}: a strong child places high, a beginner places low, a level-3 child lands near 3`, () => {
      const { ctx, s } = setup();
      const session = startPlacement(s, ctx, CHILD, cat);
      expect(session.kind).toBe(kind);
      const strong = play(session, () => true);
      expect(strong.step.level).toBe(5);
      expect(strong.responses.length).toBeGreaterThanOrEqual(PLACEMENT.minQuestions);
      expect(strong.responses.length).toBeLessThanOrEqual(PLACEMENT.maxQuestions);
      expect(play(session, () => false).step.level).toBe(1);
      const mid = play(session, (level) => level <= 3);
      expect(mid.step.level).toBe(3);
      const r = finishPlacement(s, ctx, session, mid.responses);
      expect(r.record).toMatchObject({ kind, level: 3, total: mid.responses.length });
      expect(getProgress(r.state, CHILD, cat)).toMatchObject({ difficulty: 3, difficultySource: 'placement', startLevel: 3, xp: 0 });
      expect(needsPlacement(r.state, CHILD, cat)).toBe(false);
      expect(currentDifficulty(r.state, CHILD, cat)).toBe(3);
    });
  }
  it('awards nothing: no money, no XP, no completions or attempts', () => {
    const { ctx, s } = setup();
    const session = startPlacement(s, ctx, CHILD, 'cat-math');
    const r = finishPlacement(s, ctx, session, play(session, () => true).responses);
    expect(r.state.ledger).toEqual(s.ledger);
    expect(balanceOf(r.state.ledger, CHILD)).toEqual(balanceOf(s.ledger, CHILD));
    expect(r.state.completions).toEqual(s.completions);
    expect(r.state.drillAttempts).toEqual(s.drillAttempts);
    expect(getProgress(r.state, CHILD, 'cat-math').xp).toBe(0);
  });
  it('scores from the seed (not the UI) and refuses unfinished tests', () => {
    const { ctx, s } = setup();
    const session = startPlacement(s, ctx, CHILD, 'cat-math');
    const { responses } = play(session, () => true);
    expect(code(() => finishPlacement(s, ctx, session, responses.slice(0, 3)))).toBe('DRILL_INCOMPLETE');
    expect(code(() => finishPlacement(s, ctx, session, [...responses, responses[0]]))).toBe('DRILL_INCOMPLETE');
    const step = placementStep(session, responses);
    step.questions.forEach((q, i) => expect(checkAnswer(q, responses[i])).toBe(true));
  });
  it('never lowers a starting level the parent set', () => {
    const { ctx, s } = setup();
    const s7 = setStartLevel(s, CHILD, 'cat-math', 7);
    const session = startPlacement(s7, ctx, CHILD, 'cat-math');
    const r = finishPlacement(s7, ctx, session, play(session, () => false).responses);
    expect(getProgress(r.state, CHILD, 'cat-math')).toMatchObject({ startLevel: 7, difficulty: 1 });
  });
  it('quizzes use the placed difficulty', () => {
    const { ctx, s } = setup();
    const session = startPlacement(s, ctx, CHILD, 'cat-math');
    const r = finishPlacement(s, ctx, session, play(session, (l) => l <= 4).responses);
    const quest = r.state.quests.find((q) => q.id === 'q-math-3')!;
    expect(drillLevel(r.state, CHILD, quest)).toBe(4);
    expect(startDrill(r.state, ctx, CHILD, 'q-math-3').level).toBe(4);
  });
});

describe('parent controls', () => {
  it('override sets the difficulty and skips the test; reset asks for it again', () => {
    const { s } = setup();
    const o = setDifficulty(s, CHILD, 'cat-math', 2);
    expect(getProgress(o, CHILD, 'cat-math')).toMatchObject({ difficulty: 2, difficultySource: 'parent' });
    expect(needsPlacement(o, CHILD, 'cat-math')).toBe(false);
    expect(code(() => setDifficulty(s, CHILD, 'cat-math', 6))).toBe('INVALID_INPUT');
    expect(code(() => setDifficulty(s, 'nobody', 'cat-math', 2))).toBe('NOT_FOUND');
    const again = resetPlacement(o, CHILD, 'cat-math');
    expect(needsPlacement(again, CHILD, 'cat-math')).toBe(true);
    expect(currentDifficulty(again, CHILD, 'cat-math')).toBe(2);
  });
});

describe('adaptive difficulty', () => {
  it('two strong quizzes in a row → up; a hard one → down; otherwise stay', () => {
    expect(adapt('c', 3, 0, 9, 10)).toEqual({ difficulty: 3, strongStreak: 1 });
    expect(adapt('c', 3, 1, 10, 10)).toEqual({ difficulty: 4, strongStreak: 0, change: { categoryId: 'c', from: 3, to: 4, reason: 'strong' } });
    expect(adapt('c', 3, 1, 7, 10)).toEqual({ difficulty: 3, strongStreak: 0 });
    expect(adapt('c', 3, 1, 4, 10)).toEqual({ difficulty: 2, strongStreak: 0, change: { categoryId: 'c', from: 3, to: 2, reason: 'struggle' } });
    expect(adapt('c', 1, 0, 0, 10)).toEqual({ difficulty: 1, strongStreak: 0 });
    expect(adapt('c', 5, 1, 10, 10).difficulty).toBe(5);
    expect(ADAPT.strongRatio).toBe(0.9);
  });
  it('finishDrill adapts the category difficulty and records it on the attempt', () => {
    const { ctx, s } = setup();
    let st: AppState = setDifficulty(s, CHILD, 'cat-math', 2);
    const all = (qs: Question[]) => qs.map(right);
    let sess = startDrill(st, ctx, CHILD, 'q-math-3');
    let r = finishDrill(st, ctx, sess, all(sess.questions));
    expect(r.difficultyChange).toBeUndefined();
    expect(getProgress(r.state, CHILD, 'cat-math').strongStreak).toBe(1);
    st = r.state;
    sess = startDrill(st, ctx, CHILD, 'q-math-3');
    expect(sess.level).toBe(2);
    r = finishDrill(st, ctx, sess, all(sess.questions));
    expect(r.difficultyChange).toEqual({ categoryId: 'cat-math', from: 2, to: 3, reason: 'strong' });
    expect(r.attempt.difficultyChange).toEqual(r.difficultyChange);
    expect(r.state.drillAttempts!.at(-1)!.difficultyChange).toEqual(r.difficultyChange);
    st = r.state;
    sess = startDrill(st, ctx, CHILD, 'q-math-3');
    expect(sess.level).toBe(3);
    r = finishDrill(st, ctx, sess, sess.questions.map(wrong));
    expect(r.outcome).toBe('failed');
    expect(r.difficultyChange).toMatchObject({ from: 3, to: 2, reason: 'struggle' });
    expect(balanceOf(r.state.ledger, CHILD)).toEqual(balanceOf(st.ledger, CHILD));
  });
  it('a stale session (played at another level) does not move the difficulty', () => {
    const { s } = setup();
    const st = setDifficulty(s, CHILD, 'cat-math', 3);
    expect(applyQuizToDifficulty(st, CHILD, 'cat-math', 5, 10, 10).state).toBe(st);
  });
  it('older data without a difficulty adapts from the level-based value', () => {
    const { s } = setup();
    const st = setStartLevel(s, CHILD, 'cat-math', 2);
    const a = applyQuizToDifficulty(st, CHILD, 'cat-math', 2, 10, 10);
    expect(getProgress(a.state, CHILD, 'cat-math')).toMatchObject({ difficulty: 2, strongStreak: 1 });
  });
});

describe('migration', () => {
  it('keeps valid progress untouched and repairs invalid adaptive fields', () => {
    const ok: SkillProgress[] = [{ childId: 'a', categoryId: 'c', startLevel: 1, xp: 0 }, { childId: 'a', categoryId: 'd', startLevel: 2, xp: 5, difficulty: 3, difficultySource: 'placement', strongStreak: 1 }];
    expect(migrateProgress(ok)).toBe(ok);
    const bad = [{ childId: 'a', categoryId: 'c', startLevel: 1, xp: 0, difficulty: 9, strongStreak: -1, placement: { level: 0 } }] as unknown as SkillProgress[];
    expect(migrateProgress(bad)).toEqual([{ childId: 'a', categoryId: 'c', startLevel: 1, xp: 0, difficulty: 5, difficultySource: 'adaptive' }]);
  });
  it('old saved data loads, keeps its level, and offers the placement test', () => {
    const { s } = setup();
    const old = setStartLevel(s, CHILD, 'cat-math', 4);
    const m = migrateState(old);
    expect(needsPlacement(m, CHILD, 'cat-math')).toBe(true);
    expect(currentDifficulty(m, CHILD, 'cat-math')).toBe(4);
    expect(migrateState(m)).toBe(m);
  });
});
