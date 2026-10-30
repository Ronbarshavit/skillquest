/**
 * Parent PIN – a SIMPLE LOCK, not security.
 * It keeps children out of the parent screens on a shared device. Data is stored unencrypted in
 * local storage, so anyone with the device can bypass it; never present it as protecting money/data.
 *
 * Design: 4-digit PIN, random salt (from ctx.newId), iterated SHA-256, constant-time compare.
 * Wrong tries are counted in state (so a reload doesn't reset them); after `maxAttempts` wrong
 * tries verification is refused for `lockoutMs`.
 */
import type { AppState, ParentLock } from '../model/types';
import { DomainError } from '../model/errors';
import type { Ctx } from './context';
import { sha256Bytes, toHex, utf8 } from './sha256';

export const PIN_POLICY = {
  length: 4,
  maxAttempts: 5,
  lockoutMs: 30_000,
  iterations: 1000,
  /** App-layer policy: return to child mode after this much inactivity in parent mode. */
  autoLockIdleMs: 5 * 60_000,
} as const;

export const isValidPinFormat = (pin: string) => new RegExp(`^\\d{${PIN_POLICY.length}}$`).test(pin);

export function hashPin(pin: string, salt: string, iterations: number = PIN_POLICY.iterations): string {
  const saltBytes = utf8(salt);
  let h = sha256Bytes(utf8(`${salt}:${pin}`));
  const buf = new Uint8Array(h.length + saltBytes.length);
  buf.set(saltBytes, h.length);
  for (let i = 1; i < iterations; i++) {
    buf.set(h);
    h = sha256Bytes(buf);
  }
  return toHex(h);
}

/** Compares equal-length hex strings without early exit. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const hasPin = (s: AppState) => !!s.family.parentLock;

function withLock(s: AppState, parentLock: ParentLock | undefined): AppState {
  const family = { ...s.family };
  if (parentLock) family.parentLock = parentLock;
  else delete family.parentLock;
  return { ...s, family };
}

function buildLock(ctx: Ctx, pin: string, confirm: string): ParentLock {
  if (!isValidPinFormat(pin)) throw new DomainError('INVALID_PIN');
  if (pin !== confirm) throw new DomainError('PIN_MISMATCH');
  const salt = `${ctx.newId()}${ctx.newId()}`.replace(/-/g, '');
  return { algo: 'sha256-iter', salt, hash: hashPin(pin, salt), iterations: PIN_POLICY.iterations, failedAttempts: 0 };
}

/** First-time PIN creation (the "enter twice" flow passes both values). */
export function createPin(s: AppState, ctx: Ctx, pin: string, confirm: string): AppState {
  if (hasPin(s)) throw new DomainError('PIN_ALREADY_SET');
  return withLock(s, buildLock(ctx, pin, confirm));
}

export interface PinLockStatus {
  hasPin: boolean;
  lockedOut: boolean;
  /** ms until the lockout ends (0 when not locked out). */
  retryInMs: number;
  attemptsLeft: number;
}

export function pinLockStatus(s: AppState, now: Date): PinLockStatus {
  const lock = s.family.parentLock;
  if (!lock) return { hasPin: false, lockedOut: false, retryInMs: 0, attemptsLeft: PIN_POLICY.maxAttempts };
  const until = lock.lockedUntil ? Date.parse(lock.lockedUntil) - now.getTime() : 0;
  const lockedOut = until > 0;
  return {
    hasPin: true,
    lockedOut,
    retryInMs: lockedOut ? until : 0,
    attemptsLeft: lockedOut ? 0 : PIN_POLICY.maxAttempts - lock.failedAttempts,
  };
}

export type PinCheck =
  | { ok: true }
  | { ok: false; reason: 'WRONG'; attemptsLeft: number }
  | { ok: false; reason: 'LOCKED_OUT'; retryInMs: number };

/** Verifies a PIN and returns the new state (attempt counters are persisted). */
export function verifyPin(s: AppState, ctx: Ctx, pin: string): { state: AppState; result: PinCheck } {
  const lock = s.family.parentLock;
  if (!lock) throw new DomainError('PIN_NOT_SET');
  const now = ctx.now();
  const status = pinLockStatus(s, now);
  if (status.lockedOut) return { state: s, result: { ok: false, reason: 'LOCKED_OUT', retryInMs: status.retryInMs } };

  // An expired lockout is cleared before counting this attempt.
  const base: ParentLock = { ...lock, lockedUntil: undefined };
  delete base.lockedUntil;

  if (isValidPinFormat(pin) && safeEqual(hashPin(pin, lock.salt, lock.iterations), lock.hash)) {
    return { state: withLock(s, { ...base, failedAttempts: 0 }), result: { ok: true } };
  }
  const failed = base.failedAttempts + 1;
  if (failed >= PIN_POLICY.maxAttempts) {
    const lockedUntil = new Date(now.getTime() + PIN_POLICY.lockoutMs).toISOString();
    return {
      state: withLock(s, { ...base, failedAttempts: 0, lockedUntil }),
      result: { ok: false, reason: 'LOCKED_OUT', retryInMs: PIN_POLICY.lockoutMs },
    };
  }
  return {
    state: withLock(s, { ...base, failedAttempts: failed }),
    result: { ok: false, reason: 'WRONG', attemptsLeft: PIN_POLICY.maxAttempts - failed },
  };
}

/**
 * "Forgot PIN": removes ONLY the PIN (family data, wallet, quests are untouched). The next parent
 * entry asks for a new PIN. Requires an explicit confirmation from the UI.
 */
export function resetPin(s: AppState, confirmed: boolean): AppState {
  if (!confirmed) throw new DomainError('CONFIRMATION_REQUIRED');
  return withLock(s, undefined);
}

/** Replace an existing PIN atomically (the UI verifies the current PIN first). */
export function changePin(s: AppState, ctx: Ctx, pin: string, confirm: string): AppState {
  if (!hasPin(s)) throw new DomainError('PIN_NOT_SET');
  return withLock(s, buildLock(ctx, pin, confirm));
}
