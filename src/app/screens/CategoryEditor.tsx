import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { shekelsToAgorot } from '@core/index';
import { Amount, Badge, Button, Card, ScreenHeader, Stepper, Switch, TextArea, TextField } from '@design/index';
import { actions, useSelectors } from '../hooks/useStore';
import { useToast } from '../components/Toast';
import { LevelMeter } from '../components/LevelMeter';
import { describeError } from '../i18n/he';

export function CategoryEditor() {
  const { categoryId = '' } = useParams();
  const sel = useSelectors();
  const nav = useNavigate();
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [reward, setReward] = useState('3');
  const [xp, setXp] = useState('10');
  const cat = sel.category(categoryId);
  if (!cat) return <Navigate to="/parent/interests" replace />;
  const quests = sel.questsIn(cat.id, true);
  const maxLevel = sel.state.family.settings.levelCurve.maxLevel;

  const add = (e: FormEvent) => {
    e.preventDefault();
    try {
      actions.addQuest({ categoryId: cat.id, title, description: desc, reward: shekelsToAgorot(Number(reward)), xp: Math.round(Number(xp)) });
      setTitle('');
      setDesc('');
      toast('המשימה נוספה');
    } catch (err) {
      toast(describeError(err), 'danger');
    }
  };

  return (
    <div className="screen">
      <ScreenHeader title={`${cat.icon} ${cat.name}`} subtitle={cat.builtIn ? 'תחום ברירת מחדל' : 'תחום מותאם אישית'} onBack={() => nav('/parent/interests')} />
      <main className="screen__body">
        <Card accent={cat.colorKey} className="field-row">
          <span>{cat.enabled ? 'התחום פעיל ומוצג לילדים' : 'התחום כבוי ומוסתר מהילדים'}</span>
          <Switch checked={cat.enabled} label={`הפעלת ${cat.name}`} onChange={(v) => actions.setCategoryEnabled(cat.id, v)} />
        </Card>

        <Card accent={cat.colorKey} className="stack">
          <h2>שלב פתיחה לכל אחד מהילדים</h2>
          <p className="small muted">למי שכבר מתקדם בתחום אפשר לקבוע שלב פתיחה גבוה יותר.</p>
          {sel.children.map((k) => {
            const p = sel.progress(k.id, cat.id);
            return (
              <div key={k.id} className="start-level">
                <div className="field-row">
                  <span>{k.avatar} {k.name}</span>
                  <Stepper value={p.startLevel} min={1} max={maxLevel} label={`שלב פתיחה ל${k.name}`} onChange={(v) => actions.setStartLevel(k.id, cat.id, v)} />
                </div>
                <LevelMeter info={sel.level(k.id, cat.id)} />
              </div>
            );
          })}
        </Card>

        <Card className="stack">
          <h2>משימות</h2>
          <ul className="stack stack--tight">
            {quests.length === 0 && <li className="muted small">אין משימות עדיין – הוסיפו את הראשונה למטה.</li>}
            {quests.map((q) => (
              <li key={q.id} className={`quest-admin ${q.active ? '' : 'quest-admin--off'}`}>
                <div className="quest-admin__text">
                  <strong>{q.title}</strong>
                  <span className="quest-row__meta">
                    <Amount agorot={q.reward} size="sm" tone="earned" />
                    <Badge tone="accent">+{q.xp} XP</Badge>
                  </span>
                </div>
                <Switch checked={q.active} label={`משימה פעילה: ${q.title}`} onChange={(v) => actions.setQuestActive(q.id, v)} />
              </li>
            ))}
          </ul>
        </Card>

        <Card className="stack">
          <h2>משימה חדשה</h2>
          <form className="stack" onSubmit={add}>
            <TextField label="כותרת" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={80} placeholder="למשל: לפתור 3 חידות" />
            <TextArea label="תיאור (מה בדיוק צריך לעשות?)" value={desc} onChange={(e) => setDesc(e.target.value)} />
            <div className="two-col">
              <TextField label="פרס (₪)" type="number" inputMode="decimal" min="0" step="0.5" value={reward} onChange={(e) => setReward(e.target.value)} />
              <TextField label="ניסיון (XP)" type="number" inputMode="numeric" min="0" step="1" value={xp} onChange={(e) => setXp(e.target.value)} />
            </div>
            <Button type="submit" icon="plus" block>הוספת משימה</Button>
          </form>
        </Card>
      </main>
    </div>
  );
}
