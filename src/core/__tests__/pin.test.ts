import { describe, expect, it } from 'vitest';
import { createDemoState } from '../seed';
import { sha256Hex } from '../services/sha256';
import { changePin, createPin, hashPin, hasPin, PIN_POLICY, pinLockStatus, resetPin, verifyPin } from '../services/pin';
import { DomainError } from '../model/errors';
import { testCtx } from './helpers';

const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return (e as DomainError).code;
  }
  return 'NO_ERROR';
};

describe('sha256', () => {
  it('matches known vectors', () => {
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(sha256Hex('a'.repeat(1000))).toBe('41edece42d63e8d9bf515a9ba6932e1c20cbc9f5a5d134645adb5db1b9737ea3');
    expect(sha256Hex('שלום')).toHaveLength(64);
  });
});

describe('parent PIN (simple lock)', () => {
  it('creates a salted hash – never stores the PIN itself', () => {
    const ctx = testCtx();
    const s = createPin(createDemoState(ctx), ctx, '2468', '2468');
    const lock = s.family.parentLock!;
    expect(hasPin(s)).toBe(true);
    expect(JSON.stringify(lock)).not.toContain('2468');
    expect(lock.salt.length).toBeGreaterThan(4);
    expect(lock.hash).toBe(hashPin('2468', lock.salt, lock.iterations));
    expect(hashPin('2468', 'other-salt')).not.toBe(lock.hash);
  });

  it('requires 4 digits entered twice identically', () => {
    const ctx = testCtx();
    const s = createDemoState(ctx);
    expect(code(() => createPin(s, ctx, '12a4', '12a4'))).toBe('INVALID_PIN');
    expect(code(() => createPin(s, ctx, '123', '123'))).toBe('INVALID_PIN');
    expect(code(() => createPin(s, ctx, '1234', '1243'))).toBe('PIN_MISMATCH');
    const withPin = createPin(s, ctx, '1234', '1234');
    expect(code(() => createPin(withPin, ctx, '1111', '1111'))).toBe('PIN_ALREADY_SET');
    expect(code(() => verifyPin(s, ctx, '1234'))).toBe('PIN_NOT_SET');
  });

  it('verifies correct and wrong PINs, counting attempts', () => {
    const ctx = testCtx();
    let s = createPin(createDemoState(ctx), ctx, '1234', '1234');
    let r = verifyPin(s, ctx, '0000');
    expect(r.result).toEqual({ ok: false, reason: 'WRONG', attemptsLeft: 4 });
    s = r.state;
    r = verifyPin(s, ctx, '1234');
    expect(r.result).toEqual({ ok: true });
    expect(r.state.family.parentLock!.failedAttempts).toBe(0);
  });

  it('locks out for 30s after 5 wrong tries, then allows again', () => {
    const ctx = testCtx();
    let s = createPin(createDemoState(ctx), ctx, '1234', '1234');
    for (let i = 1; i <= 4; i++) {
      const r = verifyPin(s, ctx, '9999');
      expect(r.result).toMatchObject({ reason: 'WRONG', attemptsLeft: 5 - i });
      s = r.state;
    }
    const fifth = verifyPin(s, ctx, '9999');
    expect(fifth.result).toEqual({ ok: false, reason: 'LOCKED_OUT', retryInMs: PIN_POLICY.lockoutMs });
    s = fifth.state;
    // Even the correct PIN is refused during the lockout.
    ctx.set(new Date(ctx.now().getTime() + 29_000));
    const during = verifyPin(s, ctx, '1234');
    expect(during.result).toMatchObject({ ok: false, reason: 'LOCKED_OUT', retryInMs: 1_000 });
    expect(pinLockStatus(s, ctx.now())).toMatchObject({ lockedOut: true, attemptsLeft: 0 });
    // After 30s the lockout expires with a fresh set of attempts.
    ctx.set(new Date(ctx.now().getTime() + 1_000));
    expect(pinLockStatus(s, ctx.now())).toMatchObject({ lockedOut: false, attemptsLeft: 5 });
    const after = verifyPin(s, ctx, '1234');
    expect(after.result).toEqual({ ok: true });
    expect(after.state.family.parentLock!.lockedUntil).toBeUndefined();
  });

  it('forgot-PIN resets only the PIN, and only when confirmed', () => {
    const ctx = testCtx();
    const s = createPin(createDemoState(ctx), ctx, '1234', '1234');
    expect(code(() => resetPin(s, false))).toBe('CONFIRMATION_REQUIRED');
    const r = resetPin(s, true);
    expect(hasPin(r)).toBe(false);
    const { parentLock: _a, ...famBefore } = s.family;
    const { parentLock: _b, ...famAfter } = r.family;
    expect(famAfter).toEqual(famBefore);
    expect(r.ledger).toBe(s.ledger);
    expect(r.quests).toBe(s.quests);
    expect(r.completions).toBe(s.completions);
    // A new PIN can be created afterwards.
    expect(hasPin(createPin(r, ctx, '5678', '5678'))).toBe(true);
  });

  it('changes an existing PIN atomically', () => {
    const ctx = testCtx();
    const s = createPin(createDemoState(ctx), ctx, '1234', '1234');
    expect(code(() => changePin(createDemoState(ctx), ctx, '1111', '1111'))).toBe('PIN_NOT_SET');
    expect(code(() => changePin(s, ctx, '1111', '2222'))).toBe('PIN_MISMATCH');
    const c = changePin(s, ctx, '1111', '1111');
    expect(verifyPin(c, ctx, '1234').result.ok).toBe(false);
    expect(verifyPin(c, ctx, '1111').result.ok).toBe(true);
  });
});
