import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { CHILD_LIMITS, ONBOARDING_LIMITS, childRemovalSummary, shekelsToAgorot, type Child } from '@core/index';
import { Button, Card, Icon, ScreenHeader, TextField, formatShekels } from '@design/index';
import { actions, useAppState } from '../hooks/useStore';
import { useToast } from '../components/Toast';
import { AvatarPicker, CHILD_AVATARS } from '../components/AvatarPicker';
import { EmptyState } from '../components/EmptyState';
import { describeError } from '../i18n/he';

/** Parent screen: add, rename, change avatar, remove (with confirmation – deletes all of the child's data). */
export function ManageChildren() {
  const state = useAppState();
  const nav = useNavigate();
  const toast = useToast();
  const kids = state.family.children;
  const [editing, setEditing] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState(CHILD_AVATARS[6]);
  const [budget, setBudget] = useState('30');
  const [addError, setAddError] = useState<string | null>(null);

  const add = (e: FormEvent) => {
    e.preventDefault();
    const amount = budget.trim() === '' ? 0 : shekelsToAgorot(Number(budget));
    if (!Number.isFinite(amount) || amount < 0 || amount > ONBOARDING_LIMITS.maxAmount) {
      setAddError('נא לכתוב סכום בין 0 ל־1,000 ₪.');
      return;
    }
    try {
      const c = actions.addChild({ name, avatar, weeklyBudget: amount });
      setName('');
      setAddError(null);
      toast(`${c.avatar} ${c.name} נוספו למשפחה`);
    } catch (err) {
      setAddError(describeError(err));
    }
  };

  return (
    <div className="screen">
      <ScreenHeader title="ניהול ילדים" subtitle="הוספה, שינוי שם ודמות, הסרה" onBack={() => nav('/parent')} />
      <main className="screen__body">
        {kids.length === 0 && (
          <EmptyState emoji="👋" title="עוד אין ילדים במשפחה" testId="empty-children-manage">אפשר להוסיף כאן למטה.</EmptyState>
        )}
        <ul className="stack" data-testid="children-list">
          {kids.map((k) => (
            <Card as="li" key={k.id} className="stack" padding="md" data-testid={`child-row-${k.name}`}>
              <div className="kid-row">
                <span className="kid-row__avatar" aria-hidden>{k.avatar}</span>
                <div className="kid-row__text">
                  <strong>{k.name}</strong>
                  <KidSummaryLine childId={k.id} />
                </div>
                {editing !== k.id && removing !== k.id && (
                  <div className="kid-row__actions">
                    <Button variant="ghost" size="sm" aria-label={`עריכת ${k.name}`} onClick={() => { setEditing(k.id); setRemoving(null); }}>עריכה</Button>
                    <Button variant="ghost" size="sm" icon="close" aria-label={`הסרת ${k.name}`} onClick={() => { setRemoving(k.id); setEditing(null); }}>הסרה</Button>
                  </div>
                )}
              </div>
              {editing === k.id && (
                <EditChild
                  child={k}
                  onDone={(msg) => { setEditing(null); if (msg) toast(msg); }}
                />
              )}
              {removing === k.id && (
                <ConfirmRemove
                  childId={k.id}
                  onCancel={() => setRemoving(null)}
                  onRemoved={(n) => { setRemoving(null); toast(`${n} הוסרו, וכל הנתונים שלהם נמחקו`); }}
                />
              )}
            </Card>
          ))}
        </ul>

        {kids.length < CHILD_LIMITS.maxChildren ? (
          <Card className="stack" padding="md">
            <h2><Icon name="plus" size="sm" /> הוספת ילד או ילדה</h2>
            <form className="stack" onSubmit={add}>
              <TextField label="שם" value={name} maxLength={CHILD_LIMITS.nameMax} onChange={(e) => setName(e.target.value)} required />
              <AvatarPicker value={avatar} onChange={setAvatar} />
              <TextField label="דמי כיס שבועיים (₪)" type="number" inputMode="decimal" min="0" step="1" value={budget} onChange={(e) => setBudget(e.target.value)} hint="אפשר להפקיד בלוח ההורים אחרי ההוספה." />
              {addError && <p className="notice notice--danger small" role="alert">{addError}</p>}
              <Button type="submit" icon="plus" block>הוספה</Button>
            </form>
          </Card>
        ) : (
          <p className="notice notice--info small">אפשר עד {CHILD_LIMITS.maxChildren} ילדים במשפחה.</p>
        )}
      </main>
    </div>
  );
}

function KidSummaryLine({ childId }: { childId: string }) {
  const state = useAppState();
  const s = childRemovalSummary(state, childId);
  return (
    <span className="small muted">
      נעול {formatShekels(s.locked)} · הורווח {formatShekels(s.available)}
    </span>
  );
}

function EditChild({ child, onDone }: { child: Child; onDone: (msg?: string) => void }) {
  const [name, setName] = useState(child.name);
  const [avatar, setAvatar] = useState(child.avatar);
  const [error, setError] = useState<string | null>(null);
  const save = (e: FormEvent) => {
    e.preventDefault();
    try {
      actions.updateChild(child.id, { name, avatar });
      onDone('השינויים נשמרו');
    } catch (err) {
      setError(describeError(err));
    }
  };
  return (
    <form className="stack" onSubmit={save} data-testid="edit-child">
      <TextField label="שם" value={name} maxLength={CHILD_LIMITS.nameMax} onChange={(e) => setName(e.target.value)} required autoFocus />
      <AvatarPicker value={avatar} onChange={setAvatar} />
      <TextField label="או אימוג׳י אחר" value={avatar} maxLength={CHILD_LIMITS.avatarMax} onChange={(e) => setAvatar(e.target.value)} />
      {error && <p className="notice notice--danger small" role="alert">{error}</p>}
      <div className="approval__actions">
        <Button type="submit" size="sm" icon="check">שמירה</Button>
        <Button variant="ghost" size="sm" onClick={() => onDone()}>ביטול</Button>
      </div>
    </form>
  );
}

const count = (n: number, one: string, many: string) => (n === 1 ? one : `${n} ${many}`);

function ConfirmRemove({ childId, onCancel, onRemoved }: { childId: string; onCancel: () => void; onRemoved: (name: string) => void }) {
  const state = useAppState();
  const s = childRemovalSummary(state, childId);
  const remove = () => {
    const n = s.child.name;
    actions.removeChild(childId, true);
    onRemoved(n);
  };
  return (
    <div className="stack confirm-remove" role="alertdialog" aria-labelledby={`rm-${childId}`} data-testid="confirm-remove">
      <h3 id={`rm-${childId}`} className="small-title">להסיר את {s.child.name}?</h3>
      <p className="small">הפעולה תמחק את כל הנתונים של {s.child.name} במכשיר הזה:</p>
      <ul className="small confirm-remove__list">
        <li>הארנק: {formatShekels(s.locked)} נעולים ו־{formatShekels(s.available)} שהורווחו (כסף דמיוני){s.ledgerEntries > 0 ? ` · ${count(s.ledgerEntries, 'תנועה אחת', 'תנועות')}` : ''}</li>
        {s.completions > 0 && <li>{count(s.completions, 'משימה אחת', 'משימות')} בהיסטוריה{s.pendingApprovals > 0 ? (s.pendingApprovals === 1 ? ', מתוכן אחת ממתינה לאישור' : `, מתוכן ${s.pendingApprovals} ממתינות לאישור`) : ''}</li>}
        {s.progressAreas > 0 && <li>ההתקדמות והשלבים {s.progressAreas === 1 ? 'בתחום עניין אחד' : `ב־${s.progressAreas} תחומי עניין`}</li>}
      </ul>
      {s.isLastChild && <p className="small">זה הילד או הילדה האחרונים ברשימה – אחרי ההסרה לא יהיו ילדים במשפחה.</p>}
      <p className="small"><strong>אי אפשר לבטל את זה.</strong></p>
      <div className="approval__actions">
        <Button variant="danger" size="sm" icon="close" onClick={remove}>כן, להסיר ולמחוק</Button>
        <Button variant="ghost" size="sm" onClick={onCancel}>ביטול</Button>
      </div>
    </div>
  );
}
