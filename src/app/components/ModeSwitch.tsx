import { useNavigate } from 'react-router-dom';
import { Button } from '@design/index';
import { useSession } from '../hooks/session';

/**
 * Parent/child toggle. Entering parent mode goes through the PIN screen (/unlock) – a simple lock,
 * not security. Leaving parent mode locks immediately.
 */
export function ModeSwitch() {
  const { mode, lock } = useSession();
  const nav = useNavigate();
  if (mode === 'child')
    return (
      <Button variant="ghost" size="sm" icon="parent" onClick={() => nav('/unlock')}>
        מצב הורה
      </Button>
    );
  return (
    <Button
      variant="ghost"
      size="sm"
      icon="lock"
      aria-label="נעילה ומעבר למצב ילד"
      title="נעילה ומעבר למצב ילד"
      onClick={() => {
        lock('manual');
        nav('/child');
      }}
    >
      מצב ילד
    </Button>
  );
}
