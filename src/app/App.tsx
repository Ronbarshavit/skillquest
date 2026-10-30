import type { ReactElement } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { isOnboarded } from '@core/index';
import { useSession } from './hooks/session';
import { useAppState } from './hooks/useStore';
import { ChildHome } from './screens/ChildHome';
import { QuestList } from './screens/QuestList';
import { QuestDetail } from './screens/QuestDetail';
import { Celebration } from './screens/Celebration';
import { DrillPlayer } from './screens/DrillPlayer';
import { GuidedActivity } from './screens/GuidedActivity';
import { ParentDashboard } from './screens/ParentDashboard';
import { InterestAreas } from './screens/InterestAreas';
import { CategoryEditor } from './screens/CategoryEditor';
import { ManageChildren } from './screens/ManageChildren';
import { Unlock } from './screens/Unlock';
import { Onboarding } from './screens/Onboarding';
import { Reset } from './screens/Reset';
import { UpdatePrompt } from './components/UpdatePrompt';

/** Parent screens require parent mode, which is entered only through the PIN screen (a simple lock, not security). */
function ParentOnly({ children }: { children: ReactElement }) {
  const { mode } = useSession();
  const loc = useLocation();
  return mode === 'parent' ? children : <Navigate to="/unlock" replace state={{ from: loc.pathname }} />;
}

export function App() {
  const { mode } = useSession();
  const state = useAppState();
  const loc = useLocation();
  const onboarded = isOnboarded(state);

  // Clean start: everything except the tester reset routes leads into onboarding.
  if (!onboarded && loc.pathname !== '/onboarding' && !loc.pathname.startsWith('/reset'))
    return <Navigate to="/onboarding" replace />;

  return (
    <div className="app-shell">
      <UpdatePrompt />
      <Routes>
        <Route path="/" element={<Navigate to={mode === 'parent' ? '/parent' : '/child'} replace />} />
        <Route path="/onboarding" element={onboarded ? <Navigate to="/" replace /> : <Onboarding />} />
        <Route path="/unlock" element={<Unlock />} />
        <Route path="/child" element={<ChildHome />} />
        <Route path="/child/category/:categoryId" element={<QuestList />} />
        <Route path="/child/quest/:questId" element={<QuestDetail />} />
        <Route path="/child/quest/:questId/play" element={<DrillPlayer />} />
        <Route path="/child/quest/:questId/activity" element={<GuidedActivity />} />
        <Route path="/celebrate/:completionId" element={<Celebration />} />
        <Route path="/parent" element={<ParentOnly><ParentDashboard /></ParentOnly>} />
        <Route path="/parent/children" element={<ParentOnly><ManageChildren /></ParentOnly>} />
        <Route path="/parent/interests" element={<ParentOnly><InterestAreas /></ParentOnly>} />
        <Route path="/parent/interests/:categoryId" element={<ParentOnly><CategoryEditor /></ParentOnly>} />
        <Route path="/reset" element={<Reset />} />
        <Route path="/reset-empty" element={<Reset empty />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
