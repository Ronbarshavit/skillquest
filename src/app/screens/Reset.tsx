import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../hooks/session';
import { resetToDemo, resetToEmpty } from '../adapters/storeInstance';

/** Tester helpers: #/reset reloads the demo family, #/reset-empty starts clean (→ onboarding wizard). */
export function Reset({ empty }: { empty?: boolean }) {
  const nav = useNavigate();
  const { lock } = useSession();
  useEffect(() => {
    if (empty) resetToEmpty();
    else resetToDemo();
    localStorage.removeItem('skillquest.session');
    lock('manual');
    nav('/', { replace: true });
  }, [empty, nav, lock]);
  return null;
}
