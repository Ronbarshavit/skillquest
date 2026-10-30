import type { CompletionStatus, DomainErrorCode, LedgerEntryType } from '@core/index';
import type { BadgeTone } from '@design/index';

export const statusLabel: Record<CompletionStatus, string> = {
  todo: 'לביצוע',
  submitted: 'מחכה לאישור',
  approved: 'אושר',
  rejected: 'לא אושר',
};

export const statusTone: Record<CompletionStatus, BadgeTone> = {
  todo: 'neutral',
  submitted: 'warning',
  approved: 'success',
  rejected: 'danger',
};

export const ledgerLabel: Record<LedgerEntryType, string> = {
  deposit: 'הפקדה',
  unlock: 'שוחרר על משימה',
  return: 'הוחזר להורה (סוף שבוע)',
};

export const errorMessage: Record<DomainErrorCode, string> = {
  NOT_FOUND: 'לא נמצא',
  INVALID_AMOUNT: 'סכום לא תקין',
  INVALID_INPUT: 'יש למלא את כל השדות כראוי',
  ALREADY_SUBMITTED: 'המשימה כבר נשלחה השבוע',
  NOT_SUBMITTED: 'המשימה לא ממתינה לאישור',
  CATEGORY_DISABLED: 'תחום העניין הזה כבוי',
  QUEST_INACTIVE: 'המשימה לא פעילה',
  INSUFFICIENT_LOCKED_FUNDS: 'אין מספיק כסף נעול בארנק כדי לשחרר את הפרס. אפשר להפקיד עוד.',
  INVALID_PIN: 'הקוד צריך להיות 4 ספרות',
  PIN_MISMATCH: 'הקודים לא תואמים',
  PIN_NOT_SET: 'עדיין לא נבחר קוד הורה',
  PIN_ALREADY_SET: 'כבר יש קוד הורה',
  CONFIRMATION_REQUIRED: 'צריך לאשר את הפעולה',
  ALREADY_ONBOARDED: 'ההגדרה הראשונית כבר הושלמה',
  DUPLICATE_CHILD: 'כבר יש במשפחה מישהו בשם הזה',
  TOO_MANY_CHILDREN: 'אפשר עד 6 ילדים במשפחה',
};

export function describeError(e: unknown): string {
  const code = (e as { code?: DomainErrorCode })?.code;
  return (code && errorMessage[code]) || 'משהו השתבש, נסו שוב';
}

export const levelLabel = (n: number) => `שלב ${n}`;

export const formatDateTime = (iso: string) =>
  new Intl.DateTimeFormat('he-IL', { weekday: 'short', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
