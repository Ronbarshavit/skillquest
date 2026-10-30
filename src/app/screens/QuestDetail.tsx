import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { Amount, Badge, Button, Card, Icon, ScreenHeader, formatShekels } from '@design/index';
import { actions, useSelectors } from '../hooks/useStore';
import { useSession } from '../hooks/session';
import { useToast } from '../components/Toast';
import { describeError, statusLabel, statusTone } from '../i18n/he';

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

        {status === 'rejected' && last?.note && (
          <Card tone="soft"><strong>הערה מההורה:</strong> {last.note}</Card>
        )}
        {canSubmit && locked < quest.reward && (
          <Card tone="soft" className="notice notice--info">
            <Icon name="lock" size="sm" /> כרגע נעולים {formatShekels(locked)} בארנק. אפשר יהיה לאשר אחרי הפקדה נוספת.
          </Card>
        )}

        <div className="sticky-cta">
          {canSubmit ? (
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
