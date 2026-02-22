import './index.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';

// ─── Global error diagnostics ────────────────────────────────────────────────
// Catches any uncaught JS errors or unhandled promise rejections and writes
// them visibly to the page so we can diagnose blank-screen issues in prod.
const DIAG_STYLE = 'position:fixed;top:0;left:0;right:0;bottom:0;background:#0a0a0a;color:#f87171;font-family:monospace;font-size:13px;padding:24px;z-index:99999;overflow:auto;white-space:pre-wrap;word-break:break-word;';

function showFatalError(label: string, msg: string) {
  // Only show if React hasn't already rendered something meaningful
  const root = document.getElementById('root');
  if (root && root.children.length === 0) {
    root.innerHTML = `<div style="${DIAG_STYLE}"><strong style="color:#ef4444">FATAL: ${label}</strong>\n\n${msg}\n\nPlease reload — if this persists, share this message with support.</div>`;
  }
}

window.addEventListener('error', (e) => {
  console.error('[main] window.error:', e.message, e.filename, e.lineno);
  showFatalError('JavaScript Error', `${e.message}\n\nFile: ${e.filename}:${e.lineno}`);
});

window.addEventListener('unhandledrejection', (e) => {
  const reason = e.reason instanceof Error ? e.reason.stack || e.reason.message : String(e.reason);
  console.error('[main] unhandledrejection:', reason);
  showFatalError('Unhandled Promise Rejection', reason);
});
// ─────────────────────────────────────────────────────────────────────────────

try {
  const rootEl = document.getElementById('root');
  if (!rootEl) throw new Error('Missing #root element in HTML');

  ReactDOM.createRoot(rootEl).render(
    <HelmetProvider>
      <ErrorBoundary>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ErrorBoundary>
    </HelmetProvider>
  );
} catch (err: unknown) {
  const msg = err instanceof Error ? (err.stack || err.message) : String(err);
  console.error('[main] ReactDOM.createRoot failed:', msg);
  showFatalError('React Mount Failed', msg);
}
