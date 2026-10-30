import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { Amount, Badge, Button, Card, Icon, ScreenHeader, formatShekels } from '@design/index';
import { actions, useSelectors } from '../hooks/useStore';
import { useSession } from '../hooks/session';
import { useToast } from '../components/Toast';
import { guidedTemplateFor, quizSpec } from '@core/index';
import { describeError, statusLabel, statusTone, topicLabel } from '../i18n/he';

export function QuestDetail() {
  const { questId = '' } = useParams();
  const sel = useSelectors();
  const { activeChildId } = useSession();
  const nav = useNavigate();
  const toast = useToast();
  const quest = sel.quest(questId);
  const cat = quest && sel.category(quest.categoryId);
  if (!quest || !cat || !cat.enabled) return <Navigate to="/child" replace />;

  const status = sel.questStatus(activeChildId, quest.id);
  const last = sel.latestCompletion(activeChildId, quest.id);
  const { locked } = sel.balance(activeChildId);
  const canSubmit = status === 'todo' || status === 'rejected';
  const quiz = quizSpec(quest);
  const tpl = guidedTemplateFor(quest);
  const attempts = quiz ? sel.attempts(activeChildId, quest.id) : [];
  const best = quiz ? sel.bestAttempt(activeChildId, quest.id) : undefined;
  const level = sel.drillLevel(activeChildId, quest.id);

  const submit = () => {
    try {
      actions.submitQuest(activeChildId, quest.id);
      toast('נשלח להורה לאישור! 🚀');
    } catch (e) {
      toast(describeError(e), 'danger');
    }
  };

  return (
    <div className="screen">
      <ScreenHeader title={quest.title} subtitle={`${cat.icon} ${cat.name}`} onBack={() => nav(`/child/category/${cat.id}`)} />
      <main className="screen__body">
        <Card accent={cat.colorKey} padding="lg" className="quest-hero">
          <span className="quest-hero__icon" aria-hidden>{cat.icon}</span>
          <Badge tone={statusTone[status]}>{statusLabel[status]}</Badge>
          <p className="quest-hero__desc">{quest.description || 'אין תיאור למשימה.'}</p>
        </Card>

        <Card className="reward-row">
          <div className="reward-row__item">
            <span className="small muted">פרס</span>
            <Amount agorot={quest.reward} tone="earned" size="lg" withIcon />
          </div>
          <div className="reward-row__item">
            <span className="small muted">ניסיון</span>
            <span className="xp"><Icon name="star" size="sm" /> +{quest.xp} XP</span>
          </div>
        </Card>

        {quiz && (
          <Card className="drill-info">
            <div className="drill-info__head">
              <span className="drill-info__icon" aria-hidden>🧠</span>
              <div className="drill-info__text">
                <strong>{topicLabel[quiz.topic]}{quiz.table ? ` – לוח ${quiz.table}` : ''}</strong>
                <span className="small muted">{quiz.length} שאלות · צריך {quiz.passScore} נכונות כדי לעבור · רמה {level} מתוך 5</span>
              </div>
            </div>
            <div className="drill-info__badges">
              {quiz.autoApprove ? <Badge tone="success">הפרס נפתח מיד כשעוברים</Badge> : <Badge tone="info">ההורה מאשר אחרי שעוברים</Badge>}
              {best && <Badge tone="primary">שיא: {best.correct}/{best.total}</Badge>}
              {attempts.length > 0 && <Badge>{attempts.length === 1 ? 'ניסיון אחד השבוע' : `${attempts.length} ניסיונות השבוע`}</Badge>}
            </div>
          </Card>
        )}
        {tpl && (
          <Card className="drill-info">
            <div className="drill-info__head">
              <span className="drill-info__icon" aria-hidden>{tpl.emoji}</span>
              <div className="drill-info__text">
                <strong>{tpl.title}</strong>
                <span className="small muted">{tpl.steps.length} שלבים{tpl.steps.some((x) => x.timerSec) ? ' · עם טיימר' : ''} · ההורה מאשר</span>
              </div>
            </div>
            <p className="small">{tpl.criteria}</p>
          </Card>
        )}

        {status === 'rejected' && last?.note && (
          <Card tone="soft"><strong>הערה מההורה:</strong> {last.note}</Card>
        )}
        {canSubmit && !quiz && locked < quest.reward && (
          <Card tone="soft" className="notice notice--info">
            <Icon name="lock" size="sm" /> כרגע נעולים {formatShekels(locked)} בארנק. אפשר יהיה לאשר אחרי הפקדה נוספת.
          </Card>
        )}

        <div className="sticky-cta">
          {quiz ? (
            <Button size="lg" block icon="sparkle" onClick={() => (sel.needsPlacement(activeChildId, cat.id) ? nav(`/child/category/${cat.id}/placement`, { state: { returnTo: `/child/quest/${quest.id}` } }) : nav(`/child/quest/${quest.id}/play`))}>
              {status === 'approved' || status === 'submitted' ? 'עוד תרגול 💪' : attempts.length ? 'לנסות שוב' : 'מתחילים לתרגל!'}
            </Button>
          ) : tpl && canSubmit ? (
            <Button size="lg" block icon="sparkle" onClick={() => nav(`/child/quest/${quest.id}/activity`)}>
              {status === 'rejected' ? 'לנסות שוב' : 'מתחילים!'}
            </Button>
          ) : canSubmit ? (
            <Button size="lg" block icon="check" onClick={submit}>
              {status === 'rejected' ? 'ניסיתי שוב – שליחה לאישור' : 'סיימתי! שליחה לאישור'}
            </Button>
          ) : (
            <Button size="lg" block variant="secondary" disabled>
              {status === 'submitted' ? 'מחכה לאישור ההורה ⏳' : 'הושלם השבוע ✔'}
            </Button>
          )}
        </div>
      </main>
    </div>
  );
}
