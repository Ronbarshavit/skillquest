import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '@design/index';

/** Shows a banner when a new version of the app has been downloaded by the service worker. */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  if (!needRefresh) return null;
  return (
    <div className="update-banner" role="alert">
      <span>גרסה חדשה זמינה</span>
      <Button size="sm" onClick={() => updateServiceWorker(true)}>עדכון</Button>
      <Button size="sm" variant="ghost" onClick={() => setNeedRefresh(false)}>אחר כך</Button>
    </div>
  );
}
