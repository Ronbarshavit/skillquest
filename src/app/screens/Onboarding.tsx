import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ONBOARDING_LIMITS, shekelsToAgorot, validateOnboarding, type OnboardingChild } from '@core/index';
import { Button, Card, ProgressBar, ScreenHeader, TextField, formatShekels } from '@design/index';
import { actions } from '../hooks/useStore';
import { useSession } from '../hooks/session';
import { useToast } from '../components/Toast';
import { PinCreate, SimpleLockNote } from '../components/PinCreate';
import { PretendMoneyNote } from '../components/PretendMoneyNote';
import { describeError } from '../i18n/he';
import { resetToDemo } from '../adapters/storeInstance';
import { AvatarPicker, CHILD_AVATARS } from '../components/AvatarPicker';

const AVATARS = CHILD_AVATARS;
const STEPS = ['שם המשפחה', 'הילדים', 'דמי כיס שבועיים', 'הפקדה ראשונה', 'קוד הורה'] as const;

interface DraftChild {
  key: number;
  name: string;
  avatar: string;
  budget: string; // ₪ as typed
  deposit: string | null; // null = same as budget
}

const toAgorot = (v: string) => (v.trim() === '' ? NaN : shekelsToAgorot(Number(v)));
const amountOk = (v: string) => {
  const a = toAgorot(v);
  return Number.isFinite(a) && a >= 0 && a <= ONBOARDING_LIMITS.maxAmount;
};

/** Clean-start wizard: family name → children → weekly budget → first deposit → parent PIN. */
export function Onboarding() {
  const nav = useNavigate();
  const toast = useToast();
  const { unlockParent } = useSession();
  const [step, setStep] = useState(0);
  const [familyName, setFamilyName] = useState('');
  const [kids, setKids] = useState<DraftChild[]>([{ key: 1, name: '', avatar: AVATARS[0], budget: '30', deposit: null }]);
  const [error, setError] = useState<string | null>(null);

  const update = (key: number, patch: Partial<DraftChild>) => setKids((ks) => ks.map((k) => (k.key === key ? { ...k, ...patch } : k)));
  const depositOf = (k: DraftChild) => (k.deposit === null ? k.budget : k.deposit);
  const toInput = (): OnboardingChild[] =>
    kids.map((k) => ({ name: k.name, avatar: k.avatar, weeklyBudget: toAgorot(k.budget), firstDeposit: toAgorot(depositOf(k)) }));

  const stepError = (): string | null => {
    if (step === 0) {
      const n = familyName.trim();
      if (!n) return 'נא לכתוב שם למשפחה.';
      if (n.length > ONBOARDING_LIMITS.familyNameMax) return `עד ${ONBOARDING_LIMITS.familyNameMax} תווים.`;
    }
    if (step === 1) {
      if (kids.some((k) => !k.name.trim())) return 'נא לכתוב שם בכל שורה (או להסיר שורה ריקה).';
      if (kids.some((k) => k.name.trim().length > ONBOARDING_LIMITS.childNameMax)) return `שם – עד ${ONBOARDING_LIMITS.childNameMax} תווים.`;
      if (new Set(kids.map((k) => k.name.trim())).size !== kids.length) return 'כל שם צריך להיות שונה.';
    }
    if (step === 2 && kids.some((k) => !amountOk(k.budget))) return 'נא לכתוב סכום בין 0 ל־1,000 ₪.';
    if (step === 3 && kids.some((k) => !amountOk(depositOf(k)))) return 'נא לכתוב סכום בין 0 ל־1,000 ₪.';
    return null;
  };

  const next = () => {
    const e = stepError();
    setError(e);
    if (!e) setStep((s) => s + 1);
  };
  const back = () => {
    setError(null);
    setStep((s) => Math.max(0, s - 1));
  };

  const finish = (pin: string, confirm: string) => {
    const issue = validateOnboarding({ familyName, children: toInput() });
    if (issue) {
      setError('משהו בפרטים לא תקין – חזרו אחורה ובדקו.');
      return;
    }
    try {
      actions.completeOnboarding({ familyName, children: toInput(), pin, pinConfirm: confirm });
      unlockParent();
      toast('הכול מוכן! אפשר לבחור תחומי עניין ומשימות.');
      nav('/parent', { replace: true });
    } catch (e) {
      setError(describeError(e));
    }
  };

  return (
    <div className="screen">
      <ScreenHeader
        title={step === 0 ? 'ברוכים הבאים ל־SkillQuest' : STEPS[step]}
        subtitle={`שלב ${step + 1} מתוך ${STEPS.length}`}
        onBack={step > 0 ? back : undefined}
        backLabel="לשלב הקודם"
      />
      <main className="screen__body onboarding">
        <ProgressBar value={(step + 1) / STEPS.length} label={`שלב ${step + 1} מתוך ${STEPS.length}: ${STEPS[step]}`} size="sm" />

        {step === 0 && (
          <>
            <Card tone="soft" className="stack">
              <p>
                <strong>דמי כיס שנפתחים במשימות.</strong> אתם קובעים סכום שבועי ומפקידים אותו כ"נעול"; הילדים פותחים אותו כשהם משלימים משימות בתחומים שמעניינים אותם.
              </p>
              <p className="small muted">כמה צעדים קצרים: שם המשפחה, הילדים, דמי כיס, הפקדה ראשונה וקוד הורה. אפשר לשנות הכול אחר כך.</p>
            </Card>
            <TextField
              label="שם המשפחה"
              placeholder="למשל: משפחת הכוכבים"
              value={familyName}
              maxLength={ONBOARDING_LIMITS.familyNameMax}
              onChange={(e) => setFamilyName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') next(); }}
              autoFocus
            />
            <button type="button" className="link-btn small" onClick={() => { resetToDemo(); nav('/child', { replace: true }); }}>
              רק רוצים להציץ? טעינת משפחת הדגמה
            </button>
          </>
        )}

        {step === 1 && (
          <>
            <p className="muted">למי האפליקציה? אפשר להוסיף עד {ONBOARDING_LIMITS.maxChildren} ילדים.</p>
            <ul className="stack onboarding__kids">
              {kids.map((k, i) => (
                <Card as="li" key={k.key} className="stack" padding="md">
                  <div className="onboarding__kid-head">
                    <span className="onboarding__avatar" aria-hidden>{k.avatar}</span>
                    <TextField
                      label={kids.length > 1 ? `שם (\u2068${i + 1}\u2069 מתוך \u2068${kids.length}\u2069)` : 'שם'}
                      value={k.name}
                      maxLength={ONBOARDING_LIMITS.childNameMax}
                      onChange={(e) => update(k.key, { name: e.target.value })}
                      autoFocus={i === kids.length - 1}
                    />
                    {kids.length > 1 && (
                      <Button variant="ghost" size="sm" icon="close" aria-label={`הסרת ${k.name || `שורה ${i + 1}`}`} onClick={() => setKids((ks) => ks.filter((x) => x.key !== k.key))} />
                    )}
                  </div>
                  <AvatarPicker value={k.avatar} onChange={(a) => update(k.key, { avatar: a })} />
                </Card>
              ))}
            </ul>
            {kids.length < ONBOARDING_LIMITS.maxChildren && (
              <Button variant="ghost" icon="plus" onClick={() => setKids((ks) => [...ks, { key: Math.max(...ks.map((x) => x.key)) + 1, name: '', avatar: AVATARS[ks.length % AVATARS.length], budget: '30', deposit: null }])}>
                הוספת ילד או ילדה
              </Button>
            )}
          </>
        )}

        {step === 2 && (
          <>
            <p className="muted">כמה כסף אפשר לפתוח בכל שבוע בעזרת משימות? (מומלץ להתחיל בסכום קטן.)</p>
            {kids.map((k) => (
              <TextField
                key={k.key}
                label={`${k.avatar} ${k.name} – ₪ לשבוע`}
                type="number"
                inputMode="decimal"
                min="0"
                step="1"
                value={k.budget}
                onChange={(e) => update(k.key, { budget: e.target.value })}
              />
            ))}
          </>
        )}

        {step === 3 && (
          <>
            <PretendMoneyNote />
            <p className="muted">ההפקדה הראשונה נכנסת לארנק כ"נעולה" ומשתחררת עם כל משימה שתאשרו. אפשר גם 0 ולהפקיד אחר כך.</p>
            {kids.map((k) => (
              <TextField
                key={k.key}
                label={`הפקדה ראשונה ל${k.name} (₪)`}
                hint={`התקציב השבועי: ${amountOk(k.budget) ? formatShekels(toAgorot(k.budget)) : '—'}`}
                type="number"
                inputMode="decimal"
                min="0"
                step="1"
                value={depositOf(k)}
                onChange={(e) => update(k.key, { deposit: e.target.value })}
              />
            ))}
          </>
        )}

        {step === 4 && (
          <>
            <PinCreate onDone={finish} />
            <SimpleLockNote />
          </>
        )}

        {error && <p className="notice notice--danger small" role="alert">{error}</p>}

        {step < 4 && (
          <div className="onboarding__nav">
            <Button size="lg" block onClick={next}>המשך</Button>
          </div>
        )}
      </main>
    </div>
  );
}
