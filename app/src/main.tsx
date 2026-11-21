import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Safari ignores user-scalable=no in the browser tab; block pinch-zoom gestures there too.
document.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });

if (import.meta.env.PROD) {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
  }

  // A lazily-loaded file from an older deploy no longer exists: reload onto the new version.
  window.addEventListener('vite:preloadError', (e) => {
    e.preventDefault();
    if (!sessionStorage.getItem('unbroke:reloaded')) {
      sessionStorage.setItem('unbroke:reloaded', '1');
      location.reload();
    }
  });
  setTimeout(() => sessionStorage.removeItem('unbroke:reloaded'), 10_000);

  // Installed apps on phones stay in memory for days. When the app comes back to the foreground,
  // check whether a newer build is live and switch to it, unless a sheet/dialog is open.
  const current = (document.querySelector('script[type="module"][src*="assets/index-"]') as HTMLScriptElement | null)?.src || '';
  let checking = false;
  const checkForUpdate = async () => {
    if (checking || document.visibilityState !== 'visible' || !navigator.onLine) return;
    checking = true;
    try {
      const html = await fetch(`./?v=${Date.now()}`, { cache: 'no-store' }).then((r) => r.text());
      const m = html.match(/assets\/index-[\w-]+\.js/);
      if (m && current && !current.endsWith(m[0]) && !document.querySelector('.sheet')) location.reload();
    } catch {
      /* offline: try again next time */
    } finally {
      checking = false;
    }
  };
  document.addEventListener('visibilitychange', checkForUpdate);
  setInterval(checkForUpdate, 30 * 60 * 1000);
}
