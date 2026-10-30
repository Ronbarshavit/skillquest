import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { Amount, Button, Card, ScreenHeader } from '@design/index';
import { actions, useSelectors } from '../hooks/useStore';
import { useSession } from '../hooks/session';

const CONFETTI = Array.from({ length: 18 }, (_, i) => i);

export function Celebration() {
  const { completionId = '' } = useParams();
  const sel = useSelectors();
  const { mode } = useSession();
  const nav = useNavigate();
  const c = sel.completion(completionId);
  if (!c || c.status !== 'approved') return <Navigate to="/" replace />;
  const quest = sel.quest(c.questId);
  const child = sel.child(c.childId);
  const lvl = c.levelChange;
  const lvlCat = lvl && sel.category(lvl.categoryId);

  const done = () => {
    if (mode === 'child') actions.markCelebrated(c.id);
    nav(mode === 'parent' ? '/parent' : '/child');
  };

  return (
    <div className="screen celebrate">
      <ScreenHeader title="כל הכבוד!" />
      <main className="screen__body celebrate__body">
        <div className="confetti" aria-hidden>
          {CONFETTI.map((i) => <span key={i} className={`confetti__piece confetti__piece--${i % 6}`} style={{ insetInlineStart: `${(i * 37) % 100}%`, animationDelay: `${(i % 6) * 90}ms` }} />)}
        </div>
        <div className="celebrate__trophy" aria-hidden>🏆</div>
        <h2 className="celebrate__title">{child?.name}, המשימה אושרה!</h2>
        <p className="muted">{quest?.title}</p>

        <Card className="celebrate__card" padding="lg">
          <span className="small muted">נפתח לארנק</span>
          <Amount agorot={c.reward} tone="earned" size="xl" withIcon />
          <span className="xp">+{c.xp} XP</span>
        </Card>

        {lvl && lvlCat && (
          <Card accent={lvlCat.colorKey} className="levelup" padding="lg">
            <span className="levelup__icon" aria-hidden>{lvlCat.icon}</span>
            <strong className="levelup__title">עלית שלב ב{lvlCat.name}!</strong>
            <span className="levelup__levels">
              <span className="levelup__from">שלב {lvl.from}</span>
              <span aria-hidden>←</span>
              <span className="levelup__to">שלב {lvl.to}</span>
            </span>
          </Card>
        )}

        <Button size="lg" block onClick={done}>יופי, ממשיכים!</Button>
      </main>
    </div>
  );
}
