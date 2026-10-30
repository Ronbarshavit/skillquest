import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { PIN_POLICY } from '@core/index';
import { useAppState } from './useStore';

export type Mode = 'child' | 'parent';
export type LockReason = 'manual' | 'idle' | 'background';
interface Session {
  mode: Mode;
  /** Enter parent mode. Only the PIN screen / onboarding call this, after the PIN check. */
  unlockParent: () => void;
  /** Back to child mode. */
  lock: (reason?: LockReason) => void;
  /** Why the last automatic lock happened (shown once on the PIN screen), cleared on unlock. */
  lastLockReason: LockReason | null;
  activeChildId: string;
  setActiveChildId: (id: string) => void;
}

const KEY = 'skillquest.session';
const Ctx = createContext<Session | null>(null);

function readChild(): string | undefined {
  try {
    return (JSON.parse(localStorage.getItem(KEY) ?? '{}') as { activeChildId?: string }).activeChildId;
  } catch {
    return undefined;
  }
}

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'touchstart', 'wheel', 'scroll'] as const;

/**
 * Device-local session: which mode (parent/child) and which child is active.
 *
 * Parent mode is behind the parent PIN – a SIMPLE LOCK (a "child gate" on a shared device),
 * NOT security. Data lives unencrypted in this browser's localStorage. Policy:
 *  - the app always starts in child mode (parent mode is never restored after a reload);
 *  - auto-lock back to child mode after PIN_POLICY.autoLockIdleMs without activity;
 *  - auto-lock when the app goes to the background (visibilitychange → hidden / pagehide).
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const state = useAppState();
  const [mode, setMode] = useState<Mode>('child');
  const [lastLockReason, setLastLockReason] = useState<LockReason | null>(null);
  const [childId, setChildId] = useState<string | undefined>(readChild);

  const kids = state.family.children;
  const activeChildId = kids.some((k) => k.id === childId) ? (childId as string) : kids[0]?.id ?? '';

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify({ activeChildId }));
  }, [activeChildId]);

  const lock = useCallback((reason: LockReason = 'manual') => {
    setMode((m) => {
      if (m === 'parent' && reason !== 'manual') setLastLockReason(reason);
      return 'child';
    });
  }, []);
  const unlockParent = useCallback(() => {
    setLastLockReason(null);
    setMode('parent');
  }, []);

  // Auto-lock while in parent mode.
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (mode !== 'parent') return;
    const arm = () => {
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => lock('idle'), PIN_POLICY.autoLockIdleMs);
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') lock('background');
    };
    const onHide = () => lock('background');
    arm();
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, arm, { passive: true, capture: true }));
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onHide);
    return () => {
      window.clearTimeout(timer.current);
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, arm, { capture: true }));
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onHide);
    };
  }, [mode, lock]);

  const setActiveChildId = useCallback((id: string) => setChildId(id), []);
  const value = useMemo(
    () => ({ mode, unlockParent, lock, lastLockReason, activeChildId, setActiveChildId }),
    [mode, unlockParent, lock, lastLockReason, activeChildId, setActiveChildId],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): Session {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSession outside SessionProvider');
  return v;
}
