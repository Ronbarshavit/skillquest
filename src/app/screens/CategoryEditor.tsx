import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { ENGLISH_TOPICS, MATH_TOPICS, QUIZ_TOPICS, DRILL_LIMITS, defaultPassScore, findTemplate, templatesForGroup, shekelsToAgorot, type DrillSpec, type GuidedGroup, type QuizTopic } from '@core/index';
import { Amount, Badge, Button, Card, ScreenHeader, Stepper, Switch, TextArea, TextField } from '@design/index';
import { actions, useSelectors } from '../hooks/useStore';
import { useToast } from '../components/Toast';
import { LevelMeter } from '../components/LevelMeter';
import { describeError, topicLabel } from '../i18n/he';

type DrillKind = 'quiz' | 'guided' | 'free';
const GROUP_BY_CATEGORY: Record<string, GuidedGroup> = { 'cat-sport': 'sport', 'cat-music': 'music', 'cat-soft': 'soft', 'cat-lang': 'lang' };
const KIND_LABEL: Record<DrillKind, string> = { quiz: '🧠 תרגול שאלות', guided: '✅ פעילות עם שלבים', free: '✋ רגילה' };

export function CategoryEditor() {
  const { categoryId = '' } = useParams();
  const sel = useSelectors();
  const nav = useNavigate();
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [reward, setReward] = useState('3');
  const [xp, setXp] = useState('10');
  const quizCategory = categoryId === 'cat-math' || categoryId === 'cat-lang';
  const topics: readonly QuizTopic[] = categoryId === 'cat-math' ? MATH_TOPICS : categoryId === 'cat-lang' ? ENGLISH_TOPICS : QUIZ_TOPICS;
  const templates = templatesForGroup(GROUP_BY_CATEGORY[categoryId] ?? 'any');
  const [kind, setKind] = useState<DrillKind>(quizCategory ? 'quiz' : 'guided');
  const [topic, setTopic] = useState<QuizTopic>(topics[0]);
  const [length, setLength] = useState(10);
  const [passScore, setPassScore] = useState(defaultPassScore(10));
  const [autoApprove, setAutoApprove] = useState(true);
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? '');
  const cat = sel.category(categoryId);
  if (!cat) return <Navigate to="/parent/interests" replace />;
  const changeLength = (n: number) => {
    setLength(n);
    setPassScore((p) => (p > n || p === defaultPassScore(length) ? defaultPassScore(n) : p));
  };
  const drill: DrillSpec | undefined =
    kind === 'quiz' ? { kind: 'quiz', topic, length, passScore, autoApprove } : kind === 'guided' && templateId ? { kind: 'guided', templateId } : undefined;
  const drillBadge = (d?: DrillSpec) =>
    d?.kind === 'quiz' ? `🧠 ${topicLabel[d.topic]} · ${d.passScore}/${d.length}${d.autoApprove ? ' · אישור אוטומטי' : ''}` : d?.kind === 'guided' ? `✅ ${findTemplate(d.templateId)?.title ?? ''}` : '✋ ההורה מאשר';
  const quests = sel.questsIn(cat.id, true);
  const maxLevel = sel.state.family.settings.levelCurve.maxLevel;

  const add = (e: FormEvent) => {
    e.preventDefault();
    try {
      actions.addQuest({ categoryId: cat.id, title, description: desc, reward: shekelsToAgorot(Number(reward)), xp: Math.round(Number(xp)), drill });
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
                  <span className="small muted">{drillBadge(q.drill)}</span>
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
            <fieldset className="drill-editor">
              <legend className="sq-field__label">איך הילד מסיים את המשימה?</legend>
              <div className="chip-row" role="radiogroup" aria-label="סוג המשימה">
                {(['quiz', 'guided', 'free'] as DrillKind[]).map((k) => (
                  <button key={k} type="button" role="radio" className="chip" aria-checked={kind === k} onClick={() => setKind(k)}>{KIND_LABEL[k]}</button>
                ))}
              </div>
              {kind === 'quiz' && (
                <>
                  <span className="sq-field__label">נושא</span>
                  <div className="chip-row" role="radiogroup" aria-label="נושא התרגול">
                    {topics.map((t) => (
                      <button key={t} type="button" role="radio" className="chip" aria-checked={topic === t} onClick={() => setTopic(t)}>{topicLabel[t]}</button>
                    ))}
                  </div>
                  <div className="field-row">
                    <span>מספר שאלות</span>
                    <Stepper value={length} min={DRILL_LIMITS.minLength} max={DRILL_LIMITS.maxLength} label="מספר שאלות" onChange={changeLength} />
                  </div>
                  <div className="field-row">
                    <span>כמה נכונות כדי לעבור</span>
                    <Stepper value={passScore} min={1} max={length} label="ציון מעבר" onChange={setPassScore} />
                  </div>
                  <div className="field-row">
                    <span className="stack stack--tight">
                      <span>אישור אוטומטי כשעוברים</span>
                      <span className="small muted">הפרס נפתח מיד מהכסף הנעול, בלי לחכות להורה</span>
                    </span>
                    <Switch checked={autoApprove} label="אישור אוטומטי" onChange={setAutoApprove} />
                  </div>
                  <p className="small muted">הקושי מותאם לשלב של כל ילד בתחום.</p>
                </>
              )}
              {kind === 'guided' && (
                <>
                  <span className="sq-field__label">פעילות</span>
                  <div className="chip-row" role="radiogroup" aria-label="פעילות מודרכת">
                    {templates.map((t) => (
                      <button key={t.id} type="button" role="radio" className="chip" aria-checked={templateId === t.id} onClick={() => { setTemplateId(t.id); if (!title) setTitle(t.title); }}>{t.emoji} {t.title}</button>
                    ))}
                  </div>
                  {findTemplate(templateId) && <p className="small muted">{findTemplate(templateId)!.steps.length} שלבים · {findTemplate(templateId)!.criteria}</p>}
                </>
              )}
              {kind === 'free' && <p className="small muted">הילד לוחץ "סיימתי" וההורה מאשר.</p>}
            </fieldset>
            <Button type="submit" icon="plus" block>הוספת משימה</Button>
          </form>
        </Card>
      </main>
    </div>
  );
}
