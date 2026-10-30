/** Machine-readable error codes. The app layer maps them to Hebrew copy. */
export type DomainErrorCode =
  | 'NOT_FOUND'
  | 'INVALID_AMOUNT'
  | 'INVALID_INPUT'
  | 'ALREADY_SUBMITTED'
  | 'NOT_SUBMITTED'
  | 'CATEGORY_DISABLED'
  | 'QUEST_INACTIVE'
  | 'INSUFFICIENT_LOCKED_FUNDS'
  | 'INVALID_PIN'
  | 'PIN_MISMATCH'
  | 'PIN_NOT_SET'
  | 'PIN_ALREADY_SET'
  | 'CONFIRMATION_REQUIRED'
  | 'ALREADY_ONBOARDED'
  | 'DUPLICATE_CHILD'
  | 'TOO_MANY_CHILDREN'
  | 'NOT_A_DRILL'
  | 'DRILL_INCOMPLETE';

export class DomainError extends Error {
  constructor(
    public readonly code: DomainErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'DomainError';
  }
}
