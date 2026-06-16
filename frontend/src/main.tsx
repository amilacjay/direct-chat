import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { ToastProvider } from './components/Toast';
import { startUpdateChecks } from './lib/updateChecker';
import './index.css';
import 'leaflet/dist/leaflet.css';

// Keep every client on the latest build. sw.js is served with no-cache so the
// browser revalidates it on load; we additionally poll for a freshly deployed
// build and reload onto it, so users never need a manual hard-refresh.
const updateSW = registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return;
    const check = () => registration.update().catch(() => {});
    setInterval(check, 60_000); // poll once a minute
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') check(); // and when refocused
    });
  },
  onNeedRefresh() {
    // A new build is waiting — activate it and reload to pick it up.
    updateSW(true);
  },
});

// CDN/service-worker-proof safety net: detect a new deployed build and reload
// onto it even if a stale sw.js is being served from cache.
startUpdateChecks();

console.info(`Direct ${__APP_VERSION__} · built ${__BUILD_TIME__}`);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <App />
        </ToastProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </React.StrictMode>
);
