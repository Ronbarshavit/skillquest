import type { ReactNode } from 'react';
import { Card } from '@design/index';

/** Friendly empty state: emoji + title + optional explanation/action. */
export function EmptyState({ emoji, title, children, testId }: { emoji: string; title: string; children?: ReactNode; testId?: string }) {
  return (
    <Card tone="soft" className="empty-state" data-testid={testId}>
      <span className="empty-state__emoji" aria-hidden>{emoji}</span>
      <strong>{title}</strong>
      {children && <div className="small muted">{children}</div>}
    </Card>
  );
}
