import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { PIN_POLICY } from '@core/index';
import { Button, Card, PinPad, ScreenHeader, TextField } from '@design/index';
import { actions, useAppState } from '../hooks/useStore';
import { useSession } from '../hooks/session';
import { useToast } from '../components/Toast';
import { PinCreate, SimpleLockNote } from '../components/PinCreate';
import { describeError } from '../i18n/he';

const CONFIRM_WORD = 'איפוס';
type Phase = 'enter' | 'forgot' | 'change-new';

/**
 * Parent gate (/unlock). No PIN yet → create it (enter twice). Otherwise enter the PIN; 5 wrong tries
 * → 30 s lockout. "Forgot PIN" removes only the PIN after a typed confirmation.
 * With state {change: true} (from parent settings) it verifies the current PIN, then sets a new one.
 */
export function Unlock() {
  useAppState(); // re-render on store changes (PIN created/reset, attempt counters)
  const { mode, unlockParent, lastLockReason } = useSession();
  const nav = useNavigate();
  const loc = useLocation();
  const toast = useToast();
  const navState = (loc.state ?? {}) as { from?: string; change?: boolean };
  const changing = !!navState.change;
  const target = navState.from?.startsWith('/parent') ? navState.from : '/parent';

  const [phase, setPhase] = useState<Phase>('enter');
  const [value, setValue] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [, setTick] = useState(0);

  const status = actions.pinStatus();
  useEffect(() => {
    if (!status.lockedOut) return;
    const t = window.setInterval(() => setTick((n) => n + 1), 250);
    return () => window.clearInterval(t);
  }, [status.lockedOut]);

  if (mode === 'parent' && !changing) return <Navigate to={target} replace />;

  const done = () => {
    unlockParent();
    nav(target, { replace: true });
  };

  const onEnter = (pin: string) => {
    try {
      const r = actions.verifyPin(pin);
      setValue('');
      if (r.ok) {
        if (changing) {
          setMessage(null);
          setPhase('change-new');
        } else done();
      } else if (r.reason === 'WRONG') setMessage(`קוד שגוי. נותרו ${r.attemptsLeft} ניסיונות.`);
      else setMessage(null);
    } catch (e) {
      setMessage(describeError(e));
    }
  };

  const seconds = Math.ceil(status.retryInMs / 1000);
  const header = <ScreenHeader title={changing ? 'החלפת קוד הורה' : 'כניסה למצב הורה'} onBack={() => nav(changing ? '/parent' : '/child')} backLabel={changing ? 'חזרה להגדרות' : 'חזרה למצב ילד'} />;

  let body;
  if (!status.hasPin) {
    body = (
      <>
        <p className="center">זו הכניסה הראשונה למצב הורה. בחרו קוד בן {PIN_POLICY.length} ספרות.</p>
        <PinCreate
          onDone={(pin, confirm) => {
            try {
              actions.createPin(pin, confirm);
              toast('קוד ההורה נשמר');
              done();
            } catch (e) {
              toast(describeError(e), 'danger');
            }
          }}
        />
      </>
    );
  } else if (phase === 'change-new') {
    body = (
      <PinCreate
        title="בחרו קוד חדש"
        onDone={(pin, confirm) => {
          try {
            actions.changePin(pin, confirm);
            toast('הקוד הוחלף');
            nav('/parent', { replace: true });
          } catch (e) {
            toast(describeError(e), 'danger');
          }
        }}
      />
    );
  } else if (phase === 'forgot') {
    body = (
      <Card className="stack" data-testid="forgot-confirm">
        <h2>שכחתם את הקוד?</h2>
        <p>
          אפשר לאפס <strong>רק את הקוד</strong>. משימות, תחומי עניין, הארנק וההיסטוריה נשארים בדיוק כמו שהם. אחרי האיפוס תתבקשו לבחור קוד חדש.
        </p>
        <TextField
          label={`לאישור, הקלידו את המילה „${CONFIRM_WORD}”`}
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          autoComplete="off"
        />
        <div className="approval__actions">
          <Button
            variant="danger"
            disabled={confirmText.trim() !== CONFIRM_WORD}
            onClick={() => {
              actions.resetPin(true);
              setConfirmText('');
              setPhase('enter');
              setMessage(null);
              toast('הקוד אופס. בחרו קוד חדש.');
            }}
          >
            איפוס הקוד בלבד
          </Button>
          <Button variant="ghost" onClick={() => { setPhase('enter'); setConfirmText(''); }}>ביטול</Button>
        </div>
      </Card>
    );
  } else {
    body = (
      <div className="pin-step">
        {lastLockReason && !changing && (
          <p className="notice notice--warning small" role="status">
            {lastLockReason === 'idle' ? 'מצב הורה ננעל אוטומטית אחרי 5 דקות ללא פעילות.' : 'מצב הורה ננעל כשהאפליקציה עברה לרקע.'}
          </p>
        )}
        <h2 className="pin-step__title">{changing ? 'הקלידו את הקוד הנוכחי' : 'הקלידו את קוד ההורה'}</h2>
        <PinPad
          value={value}
          length={PIN_POLICY.length}
          onChange={(v) => { setValue(v); if (v) setMessage(null); }}
          onComplete={onEnter}
          label="קוד הורה"
          deleteLabel="מחיקת ספרה"
          disabled={status.lockedOut}
          error={!!message}
        />
        {status.lockedOut ? (
          <p className="notice notice--danger small" role="alert" data-testid="pin-lockout">
            יותר מדי ניסיונות שגויים. אפשר לנסות שוב בעוד {seconds} שניות.
          </p>
        ) : (
          message && <p className="notice notice--danger small" role="alert">{message}</p>
        )}
        {!changing && (
          <button type="button" className="link-btn small" onClick={() => setPhase('forgot')}>שכחתי את הקוד</button>
        )}
      </div>
    );
  }

  return (
    <div className="screen">
      {header}
      <main className="screen__body unlock">
        {body}
        <SimpleLockNote />
      </main>
    </div>
  );
}
