import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { shekelsToAgorot } from '@core/index';
import { Amount, Badge, Button, Card, Icon, ProgressBar, ScreenHeader, TextField, formatShekels, themeLabels, themeNames, useTheme } from '@design/index';
import { actions, useSelectors } from '../hooks/useStore';
import { useSession } from '../hooks/session';
import { ChildPicker } from '../components/ChildPicker';
import { ModeSwitch } from '../components/ModeSwitch';
import { useToast } from '../components/Toast';
import { WalletSummary } from '../components/WalletSummary';
import { PretendMoneyNote } from '../components/PretendMoneyNote';
import { EmptyState } from '../components/EmptyState';
import { describeError, formatDateTime, ledgerLabel, levelLabel } from '../i18n/he';
import { resetToDemo, resetToEmpty } from '../adapters/storeInstance';

const toShekelsInput = (agorot: number) => String(agorot / 100);

export function ParentDashboard() {
  const sel = useSelectors();
  const { activeChildId, setActiveChildId, lock } = useSession();
  const toast = useToast();
  const nav = useNavigate();
  const { theme, setTheme } = useTheme();
  const child = sel.child(activeChildId);
  const alloc = child ? sel.allocation(child.id) : null;

  const [budgetInput, setBudgetInput] = useState('');
  const [depositInput, setDepositInput] = useState('');
  useEffect(() => {
    if (!alloc) return;
    setBudgetInput(toShekelsInput(alloc.budget));
    setDepositInput(toShekelsInput(alloc.suggestedDeposit || alloc.budget));
    // Re-seed inputs only when switching child.
  }, [activeChildId]);

  if (!child || !alloc)
    return (
      <div className="screen">
        <ScreenHeader title="לוח הורים" subtitle={sel.state.family.name} actions={<ModeSwitch />} />
        <main className="screen__body">
          <EmptyState emoji="👋" title="עוד אין ילדים במשפחה" testId="empty-children">
            <Button icon="plus" onClick={() => nav('/parent/children')}>הוספת ילדים</Button>
          </EmptyState>
        </main>
      </div>
    );
  const pending = sel.pending();
  const ledger = sel.ledger(child.id).slice(0, 6);
  const curve = sel.state.family.settings.levelCurve;
  const policy = sel.state.family.settings.unspentPolicy;

  const run = (fn: () => void, ok: string) => {
    try {
      fn();
      toast(ok);
    } catch (e) {
      toast(describeError(e), 'danger');
    }
  };

  const approve = (id: string) => {
    try {
      const r = actions.approve(id);
      const kid = sel.child(r.completion.childId);
      const lvl = r.levelChange ? ` · ${kid?.name} הגיע/ה ל${levelLabel(r.levelChange.to)}!` : '';
      toast(`אושר! ${formatShekels(r.completion.reward)} שוחררו${lvl}`);
    } catch (e) {
      toast(describeError(e), 'danger');
    }
  };

  const allocRatio = alloc.budget ? Math.min(1, alloc.allocated / alloc.budget) : alloc.allocated ? 1 : 0;

  return (
    <div className="screen">
      <ScreenHeader title="לוח הורים" subtitle={sel.state.family.name} actions={<ModeSwitch />} />
      <main className="screen__body">
        <section className="stack" aria-labelledby="pending-h">
          <h2 id="pending-h" className="section-title">
            ממתין לאישור {pending.length > 0 && <Badge tone="warning">{pending.length}</Badge>}
          </h2>
          {pending.length === 0 && <EmptyState emoji="🎉" title="אין משימות שמחכות לאישור" testId="empty-pending">משימות שהילדים מסיימים יופיעו כאן לאישור.</EmptyState>}
          <ul className="stack">
            {pending.map((c) => {
              const q = sel.quest(c.questId);
              const cat = q && sel.category(q.categoryId);
              const kid = sel.child(c.childId);
              const check = sel.canApprove(c.id);
              return (
                <Card as="li" key={c.id} accent={cat?.colorKey} className="approval">
                  <div className="approval__head">
                    <span className="approval__icon" aria-hidden>{cat?.icon}</span>
                    <div className="approval__text">
                      <h3>{q?.title}</h3>
                      <span className="small muted">{kid?.avatar} {kid?.name} · {formatDateTime(c.submittedAt)}</span>
                    </div>
                    <Amount agorot={c.reward} tone="earned" withIcon />
                  </div>
                  {c.drill && (
                    <p className="approval__detail small">
                      🧠 תוצאת התרגול: <bdi dir="ltr"><strong>{c.drill.correct}/{c.drill.total}</strong></bdi> נכונות
                    </p>
                  )}
                  {c.guided && (
                    <div className="approval__detail small">
                      <span>✅ סומנו {c.guided.stepsDone} מתוך {c.guided.stepsTotal} שלבים</span>
                      {c.guided.note && <blockquote className="approval__note">״{c.guided.note}״</blockquote>}
                    </div>
                  )}
                  {!check.ok && (
                    <p className="notice notice--warning small">
                      <Icon name="lock" size="sm" /> נעולים רק {formatShekels(check.locked)} – חסרים {formatShekels(check.shortfall)}. יש להפקיד קודם.
                    </p>
                  )}
                  <div className="approval__actions">
                    <Button variant="success" icon="check" disabled={!check.ok} onClick={() => approve(c.id)}>אישור ושחרור</Button>
                    <Button variant="danger" icon="close" onClick={() => run(() => actions.reject(c.id, 'אפשר לנסות שוב 🙂'), 'המשימה הוחזרה לניסיון נוסף')}>לא עכשיו</Button>
                  </div>
                </Card>
              );
            })}
          </ul>
        </section>

        <ChildPicker kids={sel.children} value={child.id} onChange={setActiveChildId} />

        <PretendMoneyNote />
        <WalletSummary balance={sel.balance(child.id)} title={`הארנק של ${child.name}`} />

        <Card className="stack">
          <h2>הפקדת דמי כיס</h2>
          <p className="small muted">הכסף נכנס לארנק כ"נעול" ומשתחרר רק כשמשימה מאושרת.</p>
          <Badge tone="warning">כסף דמיוני – ללא תשלומים אמיתיים</Badge>
          <form
            className="inline-form"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => actions.deposit(child.id, shekelsToAgorot(Number(depositInput)), 'דמי כיס שבועיים'), `הופקדו ${depositInput} ₪ ל${child.name}`);
            }}
          >
            <TextField label="סכום (₪)" type="number" inputMode="decimal" min="1" step="1" value={depositInput} onChange={(e) => setDepositInput(e.target.value)} hint={alloc.suggestedDeposit > 0 ? `מומלץ: ${formatShekels(alloc.suggestedDeposit)} להשלמת התקציב` : 'התקציב השבועי מכוסה'} />
            <Button type="submit" icon="wallet">הפקדה</Button>
          </form>
          <h3>היסטוריה</h3>
          <ul className="ledger">
            {ledger.length === 0 && <li className="muted small" data-testid="empty-ledger">עדיין אין תנועות. הפקדה ראשונה תופיע כאן.</li>}
            {ledger.map((e) => (
              <li key={e.id} className="ledger__row">
                <span className="ledger__label">
                  <Badge tone={e.type === 'deposit' ? 'locked' : e.type === 'unlock' ? 'success' : 'neutral'}>{ledgerLabel[e.type]}</Badge>
                  <span className="small muted">{formatDateTime(e.at)}</span>
                </span>
                <Amount agorot={e.amount} size="sm" tone={e.type === 'unlock' ? 'earned' : e.type === 'deposit' ? 'locked' : 'muted'} />
              </li>
            ))}
          </ul>
        </Card>

        <Card className="stack">
          <h2>תקציב שבועי</h2>
          <form
            className="inline-form"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => actions.setWeeklyBudget(child.id, shekelsToAgorot(Number(budgetInput))), 'התקציב עודכן');
            }}
          >
            <TextField label={`תקציב ל${child.name} (₪ לשבוע)`} type="number" inputMode="decimal" min="0" step="1" value={budgetInput} onChange={(e) => setBudgetInput(e.target.value)} />
            <Button type="submit" variant="secondary">שמירה</Button>
          </form>
          <ProgressBar value={allocRatio} tone={alloc.overAllocated ? 'locked' : 'primary'} label={`הוקצו למשימות ${formatShekels(alloc.allocated)} מתוך ${formatShekels(alloc.budget)}`} showLabel />
          <dl className="kv">
            <div><dt>הוקצה למשימות</dt><dd><Amount agorot={alloc.allocated} size="sm" /></dd></div>
            <div><dt>{alloc.overAllocated ? 'חריגה מהתקציב' : 'נותר לא מוקצה'}</dt><dd><Amount agorot={Math.abs(alloc.remaining)} size="sm" tone={alloc.overAllocated ? 'danger' : 'default'} /></dd></div>
            <div><dt>שוחרר השבוע</dt><dd><Amount agorot={alloc.earnedThisWeek} size="sm" tone="earned" /></dd></div>
            <div><dt>ממתין לאישור</dt><dd><Amount agorot={alloc.pendingThisWeek} size="sm" tone="muted" /></dd></div>
          </dl>
          {alloc.overAllocated && <p className="notice notice--warning small">סך הפרסים במשימות גבוה מהתקציב. אפשר לכבות משימות או תחומים, או להגדיל תקציב.</p>}
        </Card>

        <Link to="/parent/children" className="nav-card" data-testid="nav-manage-children">
          <Card interactive className="nav-card__inner">
            <span aria-hidden className="nav-card__emoji">👨‍👩‍👧</span>
            <div className="nav-card__text">
              <strong>ניהול ילדים</strong>
              <span className="small muted">הוספה, שינוי שם ודמות, הסרה</span>
            </div>
            <Icon name="back" />
          </Card>
        </Link>

        <Link to="/parent/interests" className="nav-card">
          <Card interactive className="nav-card__inner">
            <span aria-hidden className="nav-card__emoji">🧭</span>
            <div className="nav-card__text">
              <strong>תחומי עניין ומשימות</strong>
              <span className="small muted">הפעלה/כיבוי, תחומים חדשים, משימות ושלבי פתיחה</span>
            </div>
            <Icon name="back" />
          </Card>
        </Link>

        <Card className="stack">
          <h2>הגדרות</h2>
          <div className="field-row">
            <span>ערכת עיצוב</span>
            <div className="chip-row" role="radiogroup" aria-label="ערכת עיצוב">
              {themeNames.map((t) => (
                <button key={t} type="button" role="radio" aria-checked={theme === t} className="chip" onClick={() => setTheme(t)}>{themeLabels[t]}</button>
              ))}
            </div>
          </div>
          <div className="field-row">
            <span>כסף נעול בסוף שבוע</span>
            <div className="chip-row" role="radiogroup" aria-label="מדיניות כסף שלא נוצל">
              <button type="button" role="radio" aria-checked={policy === 'rollover'} className="chip" onClick={() => actions.setUnspentPolicy('rollover')}>עובר לשבוע הבא</button>
              <button type="button" role="radio" aria-checked={policy === 'return'} className="chip" onClick={() => actions.setUnspentPolicy('return')}>חוזר להורה</button>
            </div>
          </div>
          <p className="small muted">קצב שלבים: {curve.baseXp} XP לשלב הראשון, ×{curve.growth} לכל שלב, עד {levelLabel(curve.maxLevel)}.</p>
          <div className="stack" data-testid="pin-settings">
            <h3 className="small-title">קוד הורה</h3>
            <p className="small muted">
              נעילה פשוטה – לא אמצעי אבטחה. מצב הורה ננעל אוטומטית אחרי 5 דקות ללא פעילות או כשהאפליקציה עוברת לרקע.
            </p>
            <div className="approval__actions">
              <Button variant="ghost" size="sm" icon="lock" onClick={() => nav('/unlock', { state: { change: true } })}>החלפת קוד</Button>
              <Button variant="ghost" size="sm" onClick={() => { lock('manual'); nav('/child'); }}>נעילה עכשיו</Button>
            </div>
          </div>
          <div className="stack">
            <h3 className="small-title">נתונים</h3>
            <div className="approval__actions">
              <Button variant="ghost" size="sm" onClick={() => { if (confirm('לאפס את כל הנתונים ולטעון את משפחת ההדגמה?')) { resetToDemo(); lock('manual'); toast('נתוני ההדגמה נטענו מחדש'); nav('/child'); } }}>איפוס לנתוני הדגמה</Button>
              <Button variant="ghost" size="sm" onClick={() => { if (confirm('להתחיל מחדש? כל הנתונים במכשיר הזה יימחקו ותעברו להגדרה ראשונית.')) { resetToEmpty(); lock('manual'); nav('/onboarding'); } }}>התחלה נקייה</Button>
            </div>
          </div>
        </Card>
      </main>
    </div>
  );
}
