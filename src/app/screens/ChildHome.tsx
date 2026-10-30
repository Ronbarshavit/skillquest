import { Link, useNavigate } from 'react-router-dom';
import { Amount, Button, Card, ScreenHeader } from '@design/index';
import { useSelectors } from '../hooks/useStore';
import { useSession } from '../hooks/session';
import { ChildPicker } from '../components/ChildPicker';
import { LevelMeter } from '../components/LevelMeter';
import { ModeSwitch } from '../components/ModeSwitch';
import { WalletSummary } from '../components/WalletSummary';
import { EmptyState } from '../components/EmptyState';

export function ChildHome() {
  const sel = useSelectors();
  const { activeChildId, setActiveChildId } = useSession();
  const nav = useNavigate();
  const child = sel.child(activeChildId);
  if (!child)
    return (
      <div className="screen">
        <ScreenHeader title="SkillQuest" actions={<ModeSwitch />} />
        <main className="screen__body">
          <EmptyState emoji="👋" title="עוד אין ילדים במשפחה" testId="empty-children">אפשר להוסיף ילדים במצב הורה ← ניהול ילדים.</EmptyState>
        </main>
      </div>
    );
  const balance = sel.balance(child.id);
  const cats = sel.visibleCategories();
  const toCelebrate = sel.uncelebrated(child.id)[0];

  return (
    <div className="screen">
      <ScreenHeader title={`שלום ${child.name} ${child.avatar}`} subtitle="בוחרים תחום ומתחילים משימה" actions={<ModeSwitch />} />
      <main className="screen__body">
        <ChildPicker kids={sel.children} value={child.id} onChange={setActiveChildId} />

        {toCelebrate && (
          <Card tone="soft" className="banner" padding="md">
            <span className="banner__emoji" aria-hidden>🎁</span>
            <div className="banner__text">
              <strong>יש לך פרס חדש!</strong>
              <span className="small muted">
                <Amount agorot={toCelebrate.reward} size="sm" tone="earned" /> שוחררו לארנק
              </span>
            </div>
            <Button size="sm" onClick={() => nav(`/celebrate/${toCelebrate.id}`)}>לחגוג</Button>
          </Card>
        )}

        <WalletSummary balance={balance} />
        {balance.totalDeposited === 0 && (
          <p className="notice notice--info small" data-testid="empty-wallet">💡 הארנק עוד ריק. כשההורה יפקיד דמי כיס, אפשר יהיה לפתוח אותם בעזרת משימות.</p>
        )}

        <h2 className="section-title">תחומי העניין שלי</h2>
        {cats.length === 0 ? (
          <EmptyState emoji="🧭" title="עדיין אין תחומים פעילים" testId="empty-categories">אפשר לבקש מההורה להפעיל תחום עניין.</EmptyState>
        ) : (
          <ul className="category-grid">
            {cats.map((c) => {
              const quests = sel.questsIn(c.id);
              const done = quests.filter((q) => sel.questStatus(child.id, q.id) === 'approved').length;
              return (
                <Card as="li" key={c.id} accent={c.colorKey} padding="sm" interactive className="category-tile">
                  <Link to={`/child/category/${c.id}`} className="tile-link">
                    <span className="category-tile__icon" aria-hidden>{c.icon}</span>
                    <span className="category-tile__name">{c.name}</span>
                    <span className="small muted">{done}/{quests.length} השבוע</span>
                  </Link>
                  <LevelMeter info={sel.level(child.id, c.id)} compact />
                </Card>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
