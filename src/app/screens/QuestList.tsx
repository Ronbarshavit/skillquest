import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { Amount, Badge, Card, Icon, ScreenHeader } from '@design/index';
import { useSelectors } from '../hooks/useStore';
import { useSession } from '../hooks/session';
import { LevelMeter } from '../components/LevelMeter';
import { statusLabel, statusTone } from '../i18n/he';
import { EmptyState } from '../components/EmptyState';

export function QuestList() {
  const { categoryId = '' } = useParams();
  const sel = useSelectors();
  const { activeChildId } = useSession();
  const nav = useNavigate();
  const cat = sel.category(categoryId);
  if (!cat || !cat.enabled) return <Navigate to="/child" replace />;
  const quests = sel.questsIn(cat.id);

  return (
    <div className="screen">
      <ScreenHeader title={`${cat.icon} ${cat.name}`} subtitle={`${quests.length} משימות השבוע`} onBack={() => nav('/child')} />
      <main className="screen__body">
        <Card accent={cat.colorKey}>
          <LevelMeter info={sel.level(activeChildId, cat.id)} />
        </Card>
        <ul className="stack">
          {quests.map((q) => {
            const st = sel.questStatus(activeChildId, q.id);
            return (
              <Card as="li" key={q.id} accent={cat.colorKey} interactive padding="md">
                <Link to={`/child/quest/${q.id}`} className="quest-row">
                  <div className="quest-row__main">
                    <h3>{q.title}</h3>
                    <div className="quest-row__meta">
                      <Badge tone={statusTone[st]}>{statusLabel[st]}</Badge>
                      <Badge tone="accent" icon="star">+{q.xp} XP</Badge>
                      {q.drill?.kind === 'quiz' && <Badge tone="info">🧠 תרגול</Badge>}
                      {q.drill?.kind === 'guided' && <Badge tone="info">✅ שלבים</Badge>}
                    </div>
                  </div>
                  <Amount agorot={q.reward} tone="earned" size="md" withIcon />
                  <Icon name="back" size="sm" className="quest-row__chev" />
                </Link>
              </Card>
            );
          })}
        </ul>
        {quests.length === 0 && <EmptyState emoji="🌱" title="אין עדיין משימות בתחום הזה" testId="empty-quests">אפשר לבקש מההורה להוסיף משימה.</EmptyState>}
      </main>
    </div>
  );
}
