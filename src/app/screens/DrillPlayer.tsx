import { useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { Button, Card, Icon, NumPad, ProgressDots, ScreenHeader, type DotState } from '@design/index';
import { checkAnswer, type DrillResponse, type DrillSession, type Question, type DrillResult } from '@core/index';
import { actions, useSelectors } from '../hooks/useStore';
import { useSession } from '../hooks/session';
import { useToast } from '../components/Toast';
import { describeError } from '../i18n/he';
import { Figure } from '../components/drill/Figure';
import { ListenButton, Segs, speakable } from '../components/drill/Segs';

type Finished = Omit<DrillResult, 'state'>;
const PRAISE = ['נכון! 🎉', 'מעולה! ⭐', 'יפה מאוד! 👏', 'בדיוק! 💪', 'אלופים! 🏅'];
const MATCH_COLORS = 4;

/** Keyed by quest so moving between quests starts a fresh session. */
export function DrillPlayer() {
  const { questId = '' } = useParams();
  return <DrillPlayerView key={questId} questId={questId} />;
}

function DrillPlayerView({ questId }: { questId: string }) {
  const sel = useSelectors();
  const { activeChildId } = useSession();
  const nav = useNavigate();
  const toast = useToast();
  const quest = sel.quest(questId);
  const cat = quest && sel.category(quest.categoryId);

  const start = (notify: boolean): DrillSession | null => {
    try {
      return actions.startDrill(activeChildId, questId);
    } catch (e) {
      if (notify) toast(describeError(e), 'danger');
      return null;
    }
  };
  const [session, setSession] = useState<DrillSession | null>(() => start(false));
  const [idx, setIdx] = useState(0);
  const [responses, setResponses] = useState<(DrillResponse | undefined)[]>([]);
  const [result, setResult] = useState<Finished | null>(null);
  const finishing = useRef(false);

  if (!quest || !cat || !session) return <Navigate to={quest ? `/child/quest/${quest.id}` : '/child'} replace />;
  const back = () => nav(`/child/quest/${quest.id}`);
  const questions = session.questions;
  const q = questions[idx];
  const answered = responses[idx];

  const dots: DotState[] = questions.map((qq, i) =>
    responses[i] ? (checkAnswer(qq, responses[i]) ? 'correct' : 'wrong') : i === idx && !result ? 'current' : 'todo',
  );

  const answer = (r: DrillResponse) => {
    if (answered) return;
    const next = [...responses];
    next[idx] = r;
    setResponses(next);
  };

  const goNext = () => {
    if (idx < questions.length - 1) return setIdx(idx + 1);
    if (finishing.current) return;
    finishing.current = true;
    try {
      setResult(actions.finishDrill(session, responses));
    } catch (e) {
      finishing.current = false;
      toast(describeError(e), 'danger');
    }
  };

  const retry = () => {
    const s = start(true);
    if (!s) return;
    finishing.current = false;
    setSession(s);
    setIdx(0);
    setResponses([]);
    setResult(null);
  };

  return (
    <div className="screen drill" data-quest={quest.id} data-seed={session.seed} data-level={session.level} data-index={result ? 'summary' : idx}>
      <ScreenHeader title={quest.title} subtitle={`${cat.icon} ${cat.name} · שלב ${session.level}`} onBack={back} />
      <main className="screen__body drill__body">
        <ProgressDots states={dots} label={`שאלה ${Math.min(idx + 1, questions.length)} מתוך ${questions.length}`} />
        {result ? (
          <Summary result={result} questions={questions} responses={responses} onRetry={retry} onBack={back} onCelebrate={(id) => nav(`/celebrate/${id}`)} />
        ) : (
          <QuestionView key={`${session.seed}-${idx}`} q={q} index={idx} total={questions.length} response={answered} onAnswer={answer} onNext={goNext} last={idx === questions.length - 1} />
        )}
      </main>
    </div>
  );
}

interface QuestionViewProps {
  q: Question;
  index: number;
  total: number;
  response?: DrillResponse;
  onAnswer: (r: DrillResponse) => void;
  onNext: () => void;
  last: boolean;
}

function QuestionView({ q, index, total, response, onAnswer, onNext, last }: QuestionViewProps) {
  const correct = response ? checkAnswer(q, response) : undefined;
  const say = speakable(q.prompt);
  const praise = useMemo(() => PRAISE[(index * 7 + total) % PRAISE.length], [index, total]);
  return (
    <section className={`drill__q ${response ? 'drill__q--answered' : ''}`} aria-labelledby={`q-${q.id}`}>
      <p className="small muted center">שאלה {index + 1} מתוך {total}</p>
      <Card padding="lg" className="drill__prompt">
        <h2 id={`q-${q.id}`} className="drill__prompt-text">
          <Segs segs={q.prompt} blank={q.type === 'blank' && response && 'choice' in response ? q.choices[response.choice] : null} />
        </h2>
        {say && <ListenButton text={say} />}
        {q.figure && <Figure figure={q.figure} />}
      </Card>

      {q.type === 'numeric' && <NumericAnswer q={q} response={response} onAnswer={onAnswer} />}
      {(q.type === 'choice' || q.type === 'blank') && <ChoiceAnswer q={q} response={response} onAnswer={onAnswer} />}
      {q.type === 'match' && <MatchAnswer q={q} response={response} onAnswer={onAnswer} />}

      {response && (
        <div className={`feedback feedback--${correct ? 'ok' : 'no'}`} role="status" aria-live="assertive">
          <strong className="feedback__title">{correct ? praise : 'כמעט! התשובה הנכונה:'}</strong>
          <p className="feedback__solution"><Segs segs={q.solution} /></p>
          {!correct && speakable(q.solution) && <ListenButton text={speakable(q.solution)} />}
          <Button size="lg" block onClick={onNext} autoFocus icon={last ? 'trophy' : undefined}>{last ? 'לסיכום' : 'הבא'}</Button>
        </div>
      )}
    </section>
  );
}

function NumericAnswer({ q, response, onAnswer }: { q: Extract<Question, { type: 'numeric' }>; response?: DrillResponse; onAnswer: (r: DrillResponse) => void }) {
  const [value, setValue] = useState(response && 'value' in response ? response.value : '');
  const status = response ? (checkAnswer(q, response) ? 'correct' : 'wrong') : 'idle';
  return (
    <NumPad
      value={value}
      onChange={setValue}
      onSubmit={response ? undefined : () => onAnswer({ value })}
      label="התשובה שלך"
      deleteLabel="מחיקה"
      submitLabel="בדיקה"
      allowDecimal={!Number.isInteger(q.answer)}
      allowNegative={q.answer < 0}
      unit={q.unit}
      disabled={!!response}
      status={status}
    />
  );
}

function ChoiceAnswer({ q, response, onAnswer }: { q: Extract<Question, { type: 'choice' | 'blank' }>; response?: DrillResponse; onAnswer: (r: DrillResponse) => void }) {
  const picked = response && 'choice' in response ? response.choice : -1;
  const long = q.choices.some((c) => c.reduce((n, s) => n + ('v' in s ? s.v.length : 3), 0) > 14);
  return (
    <div className={`choices ${long ? 'choices--list' : ''}`} role="group" aria-label="תשובות">
      {q.choices.map((c, i) => {
        const state = !response ? '' : i === q.answerIndex ? 'choice--right' : i === picked ? 'choice--wrong' : 'choice--dim';
        return (
          <button key={i} type="button" className={`choice ${state}`} onClick={() => onAnswer({ choice: i })} disabled={!!response} aria-pressed={i === picked}>
            <Segs segs={c} />
            {response && i === q.answerIndex && <Icon name="check" size="sm" />}
          </button>
        );
      })}
    </div>
  );
}

function MatchAnswer({ q, response, onAnswer }: { q: Extract<Question, { type: 'match' }>; response?: DrillResponse; onAnswer: (r: DrillResponse) => void }) {
  const [pairs, setPairs] = useState<number[]>(() => (response && 'pairs' in response ? response.pairs : q.left.map(() => -1)));
  const [active, setActive] = useState<number | null>(null);
  const done = !!response;
  const pickLeft = (i: number) => {
    if (done) return;
    if (pairs[i] >= 0) setPairs(pairs.map((p, j) => (j === i ? -1 : p)));
    setActive(i);
  };
  const pickRight = (r: number) => {
    if (done || active === null) return;
    setPairs(pairs.map((p, j) => (j === active ? r : p === r ? -1 : p)));
    setActive(null);
  };
  const leftOf = (r: number) => pairs.indexOf(r);
  const pairClass = (i: number) => (i >= 0 ? `match__item--c${i % MATCH_COLORS}` : '');
  const okClass = (i: number) => (done ? (pairs[i] === q.answer[i] ? 'match__item--ok' : 'match__item--no') : '');
  return (
    <div className="match">
      <p className="small muted center">בוחרים מילה באנגלית ואז את הפירוש שלה</p>
      <div className="match__cols">
        <div className="match__col" role="group" aria-label="אנגלית">
          {q.left.map((l, i) => (
            <button key={i} type="button" className={`match__item ${pairs[i] >= 0 ? pairClass(i) : ''} ${active === i ? 'match__item--active' : ''} ${okClass(i)}`} onClick={() => pickLeft(i)} disabled={done} aria-pressed={active === i}>
              <Segs segs={l} />
            </button>
          ))}
        </div>
        <div className="match__col" role="group" aria-label="עברית">
          {q.right.map((r, i) => (
            <button key={i} type="button" className={`match__item ${pairClass(leftOf(i))} ${leftOf(i) >= 0 ? okClass(leftOf(i)) : ''}`} onClick={() => pickRight(i)} disabled={done || active === null}>
              <Segs segs={r} />
            </button>
          ))}
        </div>
      </div>
      {!done && (
        <Button size="lg" block icon="check" disabled={pairs.some((p) => p < 0)} onClick={() => onAnswer({ pairs })}>בדיקה</Button>
      )}
    </div>
  );
}

interface SummaryProps {
  result: Finished;
  questions: Question[];
  responses: (DrillResponse | undefined)[];
  onRetry: () => void;
  onBack: () => void;
  onCelebrate: (completionId: string) => void;
}

function Summary({ result, questions, responses, onRetry, onBack, onCelebrate }: SummaryProps) {
  const { attempt, outcome, completion } = result;
  const passed = attempt.passed;
  const mistakes = questions.filter((q, i) => !checkAnswer(q, responses[i]));
  const message = {
    'auto-approved': 'עברת! הפרס נפתח לארנק 🎉',
    submitted: 'עברת! התוצאה נשלחה להורה לאישור 🚀',
    practice: 'עברת! הפרס של השבוע כבר אצלך – זה היה תרגול מצוין 💪',
    failed: `עוד קצת! צריך ${attempt.passScore} תשובות נכונות כדי לעבור. כל ניסיון מחזק 💪`,
  }[outcome];
  return (
    <section className={`summary summary--${passed ? 'pass' : 'fail'}`} aria-live="polite">
      <div className="summary__emoji" aria-hidden>{passed ? '🏆' : '🌱'}</div>
      <h2 className="summary__title">{passed ? 'כל הכבוד!' : 'כמעט שם!'}</h2>
      <Card padding="lg" className="summary__score">
        <span className="small muted">התוצאה שלך</span>
        <bdi dir="ltr" className="summary__num">{attempt.correct} / {attempt.total}</bdi>
        <span className="small muted">כדי לעבור: {attempt.passScore} נכונות · ניסיון {attempt.attempt}</span>
      </Card>
      <p className="summary__msg">{message}</p>
      {completion?.rewardRequested !== undefined && outcome === 'auto-approved' && (
        <Card tone="soft" className="notice notice--info"><Icon name="lock" size="sm" /> בארנק היה נעול פחות מהפרס, אז נפתח מה שהיה. אפשר לבקש מההורה להשלים.</Card>
      )}
      {mistakes.length > 0 && (
        <details className="summary__mistakes">
          <summary>מה כדאי לחזור עליו ({mistakes.length})</summary>
          <ul className="stack stack--tight">
            {mistakes.map((q) => (
              <li key={q.id} className="small"><Segs segs={q.solution} /></li>
            ))}
          </ul>
        </details>
      )}
      <div className="stack">
        {outcome === 'auto-approved' && completion && <Button size="lg" block icon="sparkle" onClick={() => onCelebrate(completion.id)}>לחגיגה!</Button>}
        {!passed && <Button size="lg" block icon="sparkle" onClick={onRetry}>לנסות שוב</Button>}
        {passed && outcome !== 'auto-approved' && <Button size="lg" block variant="secondary" onClick={onRetry}>עוד תרגול</Button>}
        <Button block variant="ghost" onClick={onBack}>חזרה למשימה</Button>
      </div>
    </section>
  );
}
