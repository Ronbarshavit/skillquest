import { useState } from 'react';
import { PIN_POLICY } from '@core/index';
import { PinPad } from '@design/index';

/** "Enter twice" PIN creation. Calls onDone(pin, confirm) only when both entries match. */
export function PinCreate({ onDone, title = 'בחרו קוד הורה' }: { onDone: (pin: string, confirm: string) => void; title?: string }) {
  const [first, setFirst] = useState<string | null>(null);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="pin-step">
      <h2 className="pin-step__title">{first === null ? title : 'הקלידו את הקוד שוב לאישור'}</h2>
      <p className="small muted pin-step__sub">
        {first === null ? `${PIN_POLICY.length} ספרות שקל לכם לזכור (ולילדים פחות לנחש).` : 'כדי לוודא שאין טעות הקלדה.'}
      </p>
      <PinPad
        value={value}
        length={PIN_POLICY.length}
        onChange={(v) => {
          setValue(v);
          if (v) setError(null);
        }}
        onComplete={(pin) => {
          if (first === null) {
            setFirst(pin);
            setValue('');
            return;
          }
          if (pin !== first) {
            setError('הקודים לא תואמים. נתחיל מחדש – בחרו קוד.');
            setFirst(null);
            setValue('');
            return;
          }
          onDone(first, pin);
        }}
        label={first === null ? 'קוד חדש' : 'אישור הקוד'}
        deleteLabel="מחיקת ספרה"
        error={!!error}
      />
      {error && <p className="notice notice--danger small" role="alert">{error}</p>}
      {first !== null && (
        <button type="button" className="link-btn small" onClick={() => { setFirst(null); setValue(''); }}>
          התחלה מחדש
        </button>
      )}
    </div>
  );
}

/** The required disclaimer: the PIN is a simple lock, NOT security. */
export function SimpleLockNote() {
  return (
    <p className="notice notice--info small simple-lock-note" data-testid="simple-lock-note">
      🔒 <strong>נעילה פשוטה – לא אמצעי אבטחה.</strong> הקוד רק מונע מילדים להיכנס בטעות למסך ההורים. הנתונים שמורים בדפדפן במכשיר הזה, ללא הצפנה.
    </p>
  );
}
