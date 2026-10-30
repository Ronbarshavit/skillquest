import { describe, expect, it } from 'vitest';
import { createEmptyState } from '../seed';
import { balanceOf, deposit, ledgerFor } from '../services/wallet';
import { approveCompletion, canApprove, markCelebrated, pendingApprovals, questStatus, rejectCompletion, submitQuest, uncelebrated } from '../services/quests';
import { setCategoryEnabled } from '../services/categories';
import { setLevelCurve } from '../services/levels';
import { DomainError } from '../model/errors';
import { testCtx } from './helpers';

const CHILD = 'child-1';
const setup = () => {
  const ctx = testCtx();
  const s = setLevelCurve(createEmptyState(ctx), { baseXp: 30, growth: 1, maxLevel: 10 });
  return { ctx, s };
};
const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return (e as DomainError).code;
  }
  return 'NO_ERROR';
};

describe('wallet', () => {
  it('deposit increases locked only', () => {
    const { ctx, s } = setup();
    const s2 = deposit(s, ctx, CHILD, 3000, 'דמי כיס');
    expect(balanceOf(s2.ledger, CHILD)).toEqual({ locked: 3000, available: 0, totalDeposited: 3000 });
    expect(ledgerFor(s2, CHILD)).toHaveLength(1);
  });
  it('rejects non-positive / fractional amounts and unknown child', () => {
    const { ctx, s } = setup();
    expect(code(() => deposit(s, ctx, CHILD, 0))).toBe('INVALID_AMOUNT');
    expect(code(() => deposit(s, ctx, CHILD, 10.5))).toBe('INVALID_AMOUNT');
    expect(code(() => deposit(s, ctx, 'x', 100))).toBe('NOT_FOUND');
  });
});

describe('quest workflow', () => {
  it('submit → approve moves reward locked → available and adds XP', () => {
    const { ctx, s } = setup();
    let st = deposit(s, ctx, CHILD, 1000);
    expect(questStatus(st, CHILD, 'q-math-1')).toBe('todo');
    const sub = submitQuest(st, ctx, CHILD, 'q-math-1'); // reward 500, xp 20
    st = sub.state;
    expect(questStatus(st, CHILD, 'q-math-1')).toBe('submitted');
    expect(pendingApprovals(st)).toHaveLength(1);
    const ap = approveCompletion(st, ctx, sub.completion.id);
    st = ap.state;
    expect(questStatus(st, CHILD, 'q-math-1')).toBe('approved');
    expect(balanceOf(st.ledger, CHILD)).toEqual({ locked: 500, available: 500, totalDeposited: 1000 });
    expect(ap.levelChange).toBeUndefined();
    expect(uncelebrated(st, CHILD).map((c) => c.id)).toEqual([sub.completion.id]);
    st = markCelebrated(st, sub.completion.id);
    expect(uncelebrated(st, CHILD)).toHaveLength(0);
  });

  it('records a level-up on the approved completion', () => {
    const { ctx, s } = setup(); // 30 xp per level
    let st = deposit(s, ctx, CHILD, 5000);
    let r = submitQuest(st, ctx, CHILD, 'q-math-1'); // 20xp
    st = approveCompletion(r.state, ctx, r.completion.id).state;
    r = submitQuest(st, ctx, CHILD, 'q-math-2'); // 15xp → 35 ≥ 30
    const ap = approveCompletion(r.state, ctx, r.completion.id);
    expect(ap.levelChange).toEqual({ categoryId: 'cat-math', from: 1, to: 2 });
    expect(ap.completion.levelChange).toEqual(ap.levelChange);
  });

  it('cannot approve more than the locked deposit', () => {
    const { ctx, s } = setup();
    let st = deposit(s, ctx, CHILD, 300);
    const r = submitQuest(st, ctx, CHILD, 'q-math-1'); // 500
    st = r.state;
    expect(canApprove(st, r.completion.id)).toEqual({ ok: false, locked: 300, reward: 500, shortfall: 200 });
    expect(code(() => approveCompletion(st, ctx, r.completion.id))).toBe('INSUFFICIENT_LOCKED_FUNDS');
    st = deposit(st, ctx, CHILD, 200);
    expect(canApprove(st, r.completion.id).ok).toBe(true);
    st = approveCompletion(st, ctx, r.completion.id).state;
    expect(balanceOf(st.ledger, CHILD)).toMatchObject({ locked: 0, available: 500 });
  });

  it('locked never goes negative across many approvals', () => {
    const { ctx, s } = setup();
    let st = deposit(s, ctx, CHILD, 800);
    const ids: string[] = [];
    for (const q of ['q-math-1', 'q-lang-1', 'q-sport-1']) {
      const r = submitQuest(st, ctx, CHILD, q);
      st = r.state;
      ids.push(r.completion.id);
    }
    let approved = 0;
    for (const id of ids) {
      try {
        st = approveCompletion(st, ctx, id).state;
        approved++;
      } catch (e) {
        expect((e as DomainError).code).toBe('INSUFFICIENT_LOCKED_FUNDS');
      }
    }
    expect(approved).toBe(1);
    expect(balanceOf(st.ledger, CHILD).locked).toBeGreaterThanOrEqual(0);
  });

  it('prevents double submission; allows resubmission after rejection', () => {
    const { ctx, s } = setup();
    const r = submitQuest(s, ctx, CHILD, 'q-math-1');
    expect(code(() => submitQuest(r.state, ctx, CHILD, 'q-math-1'))).toBe('ALREADY_SUBMITTED');
    const rej = rejectCompletion(r.state, ctx, r.completion.id, 'עוד ניסיון');
    expect(questStatus(rej, CHILD, 'q-math-1')).toBe('rejected');
    const again = submitQuest(rej, ctx, CHILD, 'q-math-1');
    expect(questStatus(again.state, CHILD, 'q-math-1')).toBe('submitted');
    expect(code(() => approveCompletion(rej, ctx, r.completion.id))).toBe('NOT_SUBMITTED');
  });

  it('cannot submit quests in disabled categories', () => {
    const { ctx, s } = setup();
    const st = setCategoryEnabled(s, 'cat-math', false);
    expect(code(() => submitQuest(st, ctx, CHILD, 'q-math-1'))).toBe('CATEGORY_DISABLED');
  });

  it('quests repeat weekly (status resets in a new week)', () => {
    const { ctx, s } = setup();
    let st = deposit(s, ctx, CHILD, 1000);
    const r = submitQuest(st, ctx, CHILD, 'q-math-1');
    st = approveCompletion(r.state, ctx, r.completion.id).state;
    ctx.advanceDays(7);
    const sub2 = submitQuest(st, ctx, CHILD, 'q-math-1');
    expect(sub2.completion.weekId).not.toBe(r.completion.weekId);
  });
});
