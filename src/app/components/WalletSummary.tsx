import type { WalletBalance } from '@core/index';
import { Amount, Card, ProgressBar } from '@design/index';
import { formatShekels } from '@design/index';

/** Locked vs earned money, shared by the child and parent views. */
export function WalletSummary({ balance, title = 'הארנק שלי' }: { balance: WalletBalance; title?: string }) {
  const total = balance.locked + balance.available;
  const ratio = total ? balance.available / total : 0;
  return (
    <Card className="wallet" padding="md">
      <h2 className="wallet__title">{title}</h2>
      <div className="wallet__grid">
        <div className="wallet__cell wallet__cell--earned">
          <span className="small muted">הרווחתי</span>
          <Amount agorot={balance.available} tone="earned" size="lg" withIcon label="הרווחתי" />
        </div>
        <div className="wallet__cell wallet__cell--locked">
          <span className="small muted">נעול – מחכה לי</span>
          <Amount agorot={balance.locked} tone="locked" size="lg" withIcon label="נעול" />
        </div>
      </div>
      <ProgressBar value={ratio} tone="success" label={`שוחררו ${formatShekels(balance.available)} מתוך ${formatShekels(total)}`} showLabel />
    </Card>
  );
}
