import { DomainError } from '../model/errors';
import type { Agorot } from '../model/types';

export const shekelsToAgorot = (shekels: number): Agorot => Math.round(shekels * 100);
export const agorotToShekels = (a: Agorot): number => a / 100;

export function assertPositiveAmount(a: Agorot): void {
  if (!Number.isInteger(a) || a <= 0) throw new DomainError('INVALID_AMOUNT');
}
export function assertNonNegativeAmount(a: Agorot): void {
  if (!Number.isInteger(a) || a < 0) throw new DomainError('INVALID_AMOUNT');
}
