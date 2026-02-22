// ─── ZERO-DEPENDENCY BOOT SHIM ───────────────────────────────────────────────
// ZERO static imports at the top. This file has NO dependencies.
// If any module fails to load, our error handlers still run because
// they're defined before the first dynamic import().
//
// Static imports run BEFORE any code in this module — so if React or
// react-dom fails to evaluate, our try/catch and addEventListener would
// never run. By using only dynamic imports below we guarantee our shim
// code always executes first, no matter what.
// ─────────────────────────────────────────────────────────────────────────────

const FATAL_STYLE = 'position:fixed;top:0;left:0;right:0;bottom:0;background:#0a0e13;color:#f87171;font-family:ui-monospace,Menlo,Monaco,monospace;font-size:13px;padding:24px;overflow:auto;white-space:pre-wrap;word-break:break-word;z-index:99999;';

function setStage(stage: string) {
  const el = document.getElementById('boot-text');
  if (el) el.textContent = `Loading… (${stage})`;
  (window as any).__BOOT_STAGE__ = stage;
  console.debug('[boot]', stage);
}

function showFatal(err: unknown) {
  const msg = err instanceof Error ? (err.stack || err.message) : String(err);
  const stage = (window as any).__BOOT_STAGE__ ?? 'pre-boot';
  console.error('[boot] FATAL at stage:', stage, '\n', msg);
  const boot = document.getElementById('boot-indicator');
  if (boot) {
    boot.innerHTML = `<div style="${FATAL_STYLE}"><strong style="color:#ef4444;font-size:15px;">FATAL (stage: ${stage})</strong>\n\n${msg}\n\n<hr style="border-color:#333;margin:16px 0">Hard refresh: <kbd>Cmd+Shift+R</kbd> (Mac) / <kbd>Ctrl+Shift+R</kbd> (Win/Linux)\nIf this repeats, copy this message and contact support.</div>`;
    boot.style.cssText = 'display:block;position:fixed;top:0;left:0;right:0;bottom:0;z-index:99999;';
  }
}

// Global fallback — catches module-load errors and unhandled rejections that
// happen outside the boot IIFE (e.g. lazy chunk failures after mount).
window.addEventListener('error', (e) => {
  console.error('[boot] window.error at stage', (window as any).__BOOT_STAGE__, ':', e.message, e.filename, e.lineno);
  const root = document.getElementById('root');
  if (!root || root.children.length === 0) {
    showFatal(e.error || new Error(`${e.message} (${e.filename}:${e.lineno})`));
  }
});

window.addEventListener('unhandledrejection', (e) => {
  console.error('[boot] unhandledrejection at stage', (window as any).__BOOT_STAGE__, ':', e.reason);
  const root = document.getElementById('root');
  if (!root || root.children.length === 0) {
    showFatal(e.reason);
  }
});

// Mark that shim code reached this point — if __BOOT_STAGE__ is 'shim-ready'
// then the module loaded and our zero-dep shim ran, but the IIFE below crashed.
(window as any).__BOOT_STAGE__ = 'shim-ready';

(async function boot() {
  try {
    setStage('css');
    await import('./index.css');

    setStage('react');
    const ReactDOM = (await import('react-dom/client')).default;
    // React is not needed explicitly — new JSX transform injects it automatically.

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

    // JSX here uses the automatic runtime injected by @vitejs/plugin-react —
    // no need for `import React` at the top of this file.
    ReactDOM.createRoot(rootEl).render(
      <HelmetProvider>
        <ErrorBoundary>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </ErrorBoundary>
      </HelmetProvider>
    );

    // Boot indicator hides itself via the polling script in index.html
    // once #root has children.

  } catch (err) {
    showFatal(err);
  }
})();


