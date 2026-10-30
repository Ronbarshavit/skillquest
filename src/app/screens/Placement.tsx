import { useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Button, Card, ProgressDots, ScreenHeader, type DotState } from '@design/index';
import { PLACEMENT, placementStep, type DrillResponse, type PlacementRecord, type PlacementSession } from '@core/index';
import { actions, useSelectors } from '../hooks/useStore';
import { useSession } from '../hooks/session';
import { useToast } from '../components/Toast';
import { describeError, difficultyName } from '../i18n/he';
import { QuestionView } from './DrillPlayer';

/** Short adaptive placement test for a Math / English category. Awards nothing; sets the drill difficulty. */
export function Placement() {
  const { categoryId = '' } = useParams();
  const { activeChildId } = useSession();
  return <PlacementView key={`${activeChildId}-${categoryId}`} categoryId={categoryId} />;
}

function PlacementView({ categoryId }: { categoryId: string }) {
  const sel = useSelectors();
  const { activeChildId } = useSession();
  const nav = useNavigate();
  const loc = useLocation();
  const toast = useToast();
  const returnTo = (loc.state as { returnTo?: string } | null)?.returnTo;
  const cat = sel.category(categoryId);
  const kind = sel.placementKind(categoryId);
  const child = sel.child(activeChildId);

  const [session, setSession] = useState<PlacementSession | null>(null);
  const [responses, setResponses] = useState<DrillResponse[]>([]);
  const [record, setRecord] = useState<PlacementRecord | null>(null);
  const [idx, setIdx] = useState(0);
  const finishing = useRef(false);

  if (!cat || !cat.enabled || !kind || !child) return <Navigate to="/child" replace />;
  const toList = () => nav(`/child/category/${cat.id}`, { replace: true, state: { placementLater: true } });
  const done = () => nav(returnTo ?? `/child/category/${cat.id}`, { replace: true });
  const subject = kind === 'math' ? 'חשבון' : 'אנגלית';

  const begin = () => {
    try {
      setSession(actions.startPlacement(activeChildId, cat.id));
      setResponses([]);
      setIdx(0);
      finishing.current = false;
    } catch (e) {
      toast(describeError(e), 'danger');
    }
  };

  // ---------------------------------------------------------------- intro
  if (!session)
    return (
      <div className="screen placement" data-phase="intro">
        <ScreenHeader title="בדיקת רמה" subtitle={`${cat.icon} ${cat.name}`} onBack={() => nav('/child')} />
        <main className="screen__body placement__body">
          <div className="placement__emoji" aria-hidden>🧭</div>
          <h2 className="placement__title">בואו נגלה מאיפה מתחילים!</h2>
          <Card padding="lg" className="stack">
            <p className="placement__lead">
              {child.name}, לפני שמתחילים לתרגל {subject}, נענה על {PLACEMENT.minQuestions}–{PLACEMENT.maxQuestions} שאלות קצרות – כדי שהתרגולים יתאימו בדיוק לך.
            </p>
            <ul className="placement__points">
              <li>🎯 עונים נכון? השאלה הבאה קצת יותר מאתגרת.</li>
              <li>🤗 טעית? לגמרי בסדר! השאלה הבאה תהיה קלה יותר.</li>
              <li>🧘 אין ציון ואין לחץ – פשוט עונים הכי טוב שאפשר.</li>
            </ul>
            <p className="small muted">בבדיקה אין פרס כספי – היא רק עוזרת לבחור את הרמה. אחר כך התרגולים משתנים לפי ההצלחה שלך.</p>
          </Card>
          <div className="stack">
            <Button size="lg" block icon="sparkle" onClick={begin}>יוצאים לדרך!</Button>
            <button type="button" className="link-btn" onClick={toList}>אחר כך</button>
          </div>
        </main>
      </div>
    );

  const step = placementStep(session, responses);

  // ---------------------------------------------------------------- result
  if (record)
    return (
      <div className="screen placement" data-phase="result" data-level={record.level}>
        <ScreenHeader title="בדיקת רמה" subtitle={`${cat.icon} ${cat.name}`} onBack={done} />
        <main className="screen__body placement__body" aria-live="polite">
          <div className="placement__emoji" aria-hidden>🎉</div>
          <h2 className="placement__title">סיימת! מצאנו את נקודת הפתיחה</h2>
          <Card padding="lg" className="placement__result">
            <span className="small muted">מתחילים לתרגל {subject} ברמה</span>
            <bdi dir="ltr" className="placement__level">{record.level} / 5</bdi>
            <div className="placement__stars" role="img" aria-label={`רמה ${record.level} מתוך 5`}>
              {[1, 2, 3, 4, 5].map((n) => (
                <span key={n} className={`placement__star ${n <= record.level ? 'placement__star--on' : ''}`} aria-hidden>★</span>
              ))}
            </div>
            <strong className="placement__name">{difficultyName(record.level)}</strong>
            <span className="small muted">ענית נכון על <bdi dir="ltr">{record.correct}/{record.total}</bdi> שאלות</span>
          </Card>
          <p className="placement__lead center">
            מעכשיו התרגולים יתאימו את עצמם אליך: כשהולך מצוין – הם נהיים מאתגרים יותר, וכשקשה – קצת קלים יותר. 💪
          </p>
          <Button size="lg" block icon="sparkle" onClick={done}>{returnTo ? 'לתרגול!' : 'למשימות!'}</Button>
        </main>
      </div>
    );

  // ---------------------------------------------------------------- questions
  // `idx` = question on screen. Answering appends a response; the next question is then rebuilt
  // from the answers (staircase), so feedback stays on screen until "next".
  const q = step.questions[idx];
  const answered = responses[idx];
  const isLast = !!answered && step.done;
  const dots: DotState[] = Array.from({ length: PLACEMENT.maxQuestions }, (_, i) =>
    i < step.results.length ? (step.results[i] ? 'correct' : 'wrong') : i === idx ? 'current' : 'todo',
  );

  const answer = (r: DrillResponse) => {
    if (answered || idx !== responses.length) return;
    setResponses([...responses, r]);
  };
  const goNext = () => {
    if (!answered) return;
    if (!step.done) return setIdx(idx + 1);
    if (finishing.current) return;
    finishing.current = true;
    try {
      setRecord(actions.finishPlacement(session, responses));
    } catch (e) {
      finishing.current = false;
      toast(describeError(e), 'danger');
    }
  };

  return (
    <div className="screen drill placement" data-phase="question" data-kind={session.kind} data-seed={session.seed} data-index={idx} data-level={step.stair.path[idx]}>
      <ScreenHeader title="בדיקת רמה" subtitle={`${cat.icon} ${cat.name}`} onBack={() => nav('/child')} />
      <main className="screen__body drill__body">
        <ProgressDots states={dots} label={`שאלה ${idx + 1}`} />
        <QuestionView
          key={`${session.seed}-${idx}`}
          q={q}
          index={idx}
          total={PLACEMENT.maxQuestions}
          counter={`שאלה ${idx + 1} · עד ${PLACEMENT.maxQuestions} שאלות`}
          response={answered}
          onAnswer={answer}
          onNext={goNext}
          last={isLast}
          lastLabel="לתוצאה 🎉"
        />
      </main>
    </div>
  );
}
