import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { ThemeProvider, injectTokens } from '@design/index';
import { App } from '@app/App';
import { SessionProvider } from '@app/hooks/session';
import { ToastProvider } from '@app/components/Toast';
import '@app/app.css';

// Tokens before first paint (no unstyled flash), then the theme attribute from storage.
injectTokens();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <SessionProvider>
        <ToastProvider>
          <HashRouter>
            <App />
          </HashRouter>
        </ToastProvider>
      </SessionProvider>
    </ThemeProvider>
  </StrictMode>,
);
