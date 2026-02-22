// ─── STAGED BOOT ─────────────────────────────────────────────────────────────
// Dynamic imports catch module-evaluation crashes that static imports hide.
// If any import throws, showFatal() surfaces the error visibly in the boot
// indicator instead of producing a silent blank screen.
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import ReactDOM from 'react-dom/client';

const FATAL_STYLE = 'position:fixed;top:0;left:0;right:0;bottom:0;background:#0a0e13;color:#f87171;font-family:monospace;font-size:13px;padding:24px;overflow:auto;white-space:pre-wrap;word-break:break-word;';

function setStage(stage: string) {
  const el = document.getElementById('boot-text');
  if (el) el.textContent = `Loading… (${stage})`;
  (window as any).__BOOT_STAGE__ = stage;
  console.debug('[boot]', stage);
}

function showFatal(err: unknown) {
  const msg = err instanceof Error ? (err.stack || err.message) : String(err);
  console.error('[boot] FATAL at stage:', (window as any).__BOOT_STAGE__, '\n', msg);
  const boot = document.getElementById('boot-indicator');
  if (boot) {
    boot.innerHTML = `<div style="${FATAL_STYLE}">
<strong style="color:#ef4444">FATAL (stage: ${(window as any).__BOOT_STAGE__ ?? '?'})</strong>

${msg}

<br><br>Try a hard refresh: <kbd>Cmd+Shift+R</kbd> (Mac) / <kbd>Ctrl+Shift+R</kbd> (Windows/Linux)
<br>If this persists, copy this message and contact support.
</div>`;
    boot.style.display = 'block';
  }
}

// Global fallback — catches errors that happen outside the async boot (e.g.
// lazy chunks loading after mount, unhandled rejections in event handlers).
window.addEventListener('error', (e) => {
  console.error('[boot] window.error:', e.message, e.filename, e.lineno);
  const root = document.getElementById('root');
  if (!root || root.children.length === 0) {
    showFatal(new Error(`${e.message}\n\nFile: ${e.filename}:${e.lineno}`));
  }
});

window.addEventListener('unhandledrejection', (e) => {
  const reason = e.reason instanceof Error ? (e.reason.stack || e.reason.message) : String(e.reason);
  console.error('[boot] unhandledrejection at stage', (window as any).__BOOT_STAGE__, ':', reason);
  // Don't hijack the UI once React has mounted
  const root = document.getElementById('root');
  if (!root || root.children.length === 0) {
    showFatal(e.reason);
  }
});

(async function boot() {
  try {
    setStage('css');
    await import('./index.css');

    setStage('ErrorBoundary');
    const { ErrorBoundary } = await import('./components/ErrorBoundary');

    setStage('HelmetProvider');
    const { HelmetProvider } = await import('react-helmet-async');

    setStage('BrowserRouter');
    const { BrowserRouter } = await import('react-router-dom');

    setStage('App');
    const { default: App } = await import('./App');

    setStage('mount');
    const rootEl = document.getElementById('root');
    if (!rootEl) throw new Error('#root element missing from HTML');

    ReactDOM.createRoot(rootEl).render(
      <HelmetProvider>
        <ErrorBoundary>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </ErrorBoundary>
      </HelmetProvider>
    );

    // Boot indicator is removed by the polling script in index.html once
    // #root has children — no explicit hide needed here.

  } catch (err) {
    showFatal(err);
  }
})();
