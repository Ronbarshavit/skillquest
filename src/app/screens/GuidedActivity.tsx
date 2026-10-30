import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { Button, Card, Icon, ProgressBar, ScreenHeader, TextArea } from '@design/index';
import { guidedTemplateFor, type GuidedStep } from '@core/index';
import { actions, useSelectors } from '../hooks/useStore';
import { useSession } from '../hooks/session';
import { useToast } from '../components/Toast';
import { describeError } from '../i18n/he';

const fmt = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

/** Count-down timer for one step. Ticking is driven by timestamps so it stays right when the tab sleeps. */
function StepTimer({ seconds, onDone }: { seconds: number; onDone: () => void }) {
  const [left, setLeft] = useState(seconds);
  const [running, setRunning] = useState(false);
  const endAt = useRef(0);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      const l = Math.max(0, Math.ceil((endAt.current - Date.now()) / 1000));
      setLeft(l);
      if (l === 0) {
        setRunning(false);
        if ('vibrate' in navigator) navigator.vibrate?.(200);
        doneRef.current();
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [running]);

  const toggle = () => {
    if (running) return setRunning(false);
    const from = left === 0 ? seconds : left;
    setLeft(from);
    endAt.current = Date.now() + from * 1000;
    setRunning(true);
  };
  return (
    <div className={`timer ${running ? 'timer--running' : ''} ${left === 0 ? 'timer--done' : ''}`}>
      <bdi dir="ltr" className="timer__time" role="timer" aria-live="off">{fmt(left)}</bdi>
      <Button size="sm" variant={running ? 'secondary' : 'primary'} onClick={toggle}>
        {running ? 'השהיה' : left === 0 ? 'שוב' : left < seconds ? 'המשך' : 'התחלה'}
      </Button>
      {!running && left !== seconds && left !== 0 && (
        <button type="button" className="link-btn" onClick={() => setLeft(seconds)}>איפוס</button>
      )}
    </div>
  );
}

function StepRow({ step, index, done, onToggle, disabled }: { step: GuidedStep; index: number; done: boolean; onToggle: () => void; disabled: boolean }) {
  return (
    <li className={`step ${done ? 'step--done' : ''}`}>
      <button type="button" className="step__check" role="checkbox" aria-checked={done} onClick={onToggle} disabled={disabled} aria-label={`שלב ${index + 1}: ${step.text}`}>
        {done ? <Icon name="check" size="md" /> : <span aria-hidden>{index + 1}</span>}
      </button>
      <div className="step__main">
        <span className="step__text">{step.text}</span>
        {step.timerSec && !disabled && <StepTimer seconds={step.timerSec} onDone={() => !done && onToggle()} />}
      </div>
    </li>
  );
}

/** Keyed by quest so moving between quests starts a fresh session. */
export function GuidedActivity() {
  const { questId = '' } = useParams();
  return <GuidedActivityView key={questId} questId={questId} />;
}

function GuidedActivityView({ questId }: { questId: string }) {
  const sel = useSelectors();
  const { activeChildId } = useSession();
  const nav = useNavigate();
  const toast = useToast();
  const quest = sel.quest(questId);
  const cat = quest && sel.category(quest.categoryId);
  const tpl = quest && guidedTemplateFor(quest);
  const [done, setDone] = useState<string[]>([]);
  const [note, setNote] = useState('');
  if (!quest || !cat || !tpl) return <Navigate to={quest ? `/child/quest/${quest.id}` : '/child'} replace />;

  const status = sel.questStatus(activeChildId, quest.id);
  const locked = status === 'submitted' || status === 'approved';
  const toggle = (id: string) => setDone((d) => (d.includes(id) ? d.filter((x) => x !== id) : [...d, id]));
  const allDone = tpl.steps.every((s) => done.includes(s.id));
  const needNote = !!tpl.reflect && !note.trim();

  const submit = () => {
    try {
      actions.submitGuided(activeChildId, quest.id, { stepsDone: done, note: note.trim() || undefined });
      toast('נשלח להורה לאישור! 🚀');
      nav(`/child/quest/${quest.id}`);
    } catch (e) {
      toast(describeError(e), 'danger');
    }
  };

  return (
    <div className="screen guided" data-quest={quest.id} data-template={tpl.id}>
      <ScreenHeader title={quest.title} subtitle={`${cat.icon} ${cat.name}`} onBack={() => nav(`/child/quest/${quest.id}`)} />
      <main className="screen__body">
        <Card accent={cat.colorKey} padding="lg" className="guided__intro">
          <span className="guided__emoji" aria-hidden>{tpl.emoji}</span>
          <strong className="guided__title">{tpl.title}</strong>
          <p>{tpl.intro}</p>
          <p className="small"><strong>מה נחשב סיום:</strong> {tpl.criteria}</p>
        </Card>

        <ProgressBar value={done.length / tpl.steps.length} label={`${done.length} מתוך ${tpl.steps.length} שלבים`} showLabel tone="success" />

        <ol className="steps">
          {tpl.steps.map((s, i) => (
            <StepRow key={s.id} step={s} index={i} done={locked || done.includes(s.id)} onToggle={() => toggle(s.id)} disabled={locked} />
          ))}
        </ol>

        {tpl.reflect && !locked && (
          <TextArea label={tpl.reflect} value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} hint="כמה מילים להורה" />
        )}

        <Card tone="soft" className="small"><Icon name="parent" size="sm" /> ההורה יבדוק: {tpl.parentCheck}</Card>

        <div className="sticky-cta">
          {locked ? (
            <Button size="lg" block variant="secondary" disabled>{status === 'submitted' ? 'מחכה לאישור ההורה ⏳' : 'הושלם השבוע ✔'}</Button>
          ) : (
            <Button size="lg" block icon="check" disabled={!allDone || needNote} onClick={submit}>
              {!allDone ? (tpl.steps.length - done.length === 1 ? 'עוד שלב אחד' : `עוד ${tpl.steps.length - done.length} שלבים`) : needNote ? 'כתבו כמה מילים כדי לשלוח' : 'סיימתי! שליחה לאישור'}
            </Button>
          )}
        </div>
      </main>
    </div>
  );
}
