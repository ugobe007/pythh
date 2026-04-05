import { setBootText, fatalBoot } from './boot-handlers';
import ReactDOM from 'react-dom/client';
import { apiUrl } from './lib/apiConfig';
import './index.css';

setBootText('Loading… (react)');

/**
 * Ensure Supabase URL + anon key exist on `window` before any module imports `supabase.ts`.
 * Order: (1) HTML injection (2) GET /api/public-config — both prefer SUPABASE_* over VITE_* on the server.
 */
async function ensureClientConfig(): Promise<void> {
  const w = window as Window & {
    __PYTHH_RUNTIME__?: { supabaseUrl?: string; supabaseAnonKey?: string };
  };
  const has =
    w.__PYTHH_RUNTIME__?.supabaseUrl?.trim() && w.__PYTHH_RUNTIME__?.supabaseAnonKey?.trim();
  if (has) return;
  try {
    const r = await fetch(apiUrl('/api/public-config'), {
      credentials: 'same-origin',
      cache: 'no-store',
    });
    if (!r.ok) return;
    const j = (await r.json()) as { supabaseUrl?: string; supabaseAnonKey?: string };
    if (j?.supabaseUrl && j?.supabaseAnonKey) {
      w.__PYTHH_RUNTIME__ = { supabaseUrl: j.supabaseUrl, supabaseAnonKey: j.supabaseAnonKey };
    }
  } catch {
    /* build-time import.meta.env may still work */
  }
}

async function boot(): Promise<void> {
  await ensureClientConfig();

  const [{ default: App }, { BrowserRouter }, { HelmetProvider }, { ErrorBoundary }] =
    await Promise.all([
      import('./App'),
      import('react-router-dom'),
      import('react-helmet-async'),
      import('./components/ErrorBoundary'),
    ]);

  const rootEl = document.getElementById('root');
  if (!rootEl) {
    fatalBoot('root-missing', new Error('#root not found'));
    return;
  }

  try {
    ReactDOM.createRoot(rootEl).render(
      <HelmetProvider>
        <ErrorBoundary>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </ErrorBoundary>
      </HelmetProvider>
    );
    setBootText('Running…');
    queueMicrotask(() => {
      document.getElementById('boot-indicator')?.style.setProperty('display', 'none');
    });
  } catch (e) {
    fatalBoot('render', e);
  }
}

boot().catch((e) => fatalBoot('bootstrap', e));
