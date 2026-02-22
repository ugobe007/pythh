// ─── BOOT SHIM ───────────────────────────────────────────────────────────────
// This file has ZERO React/app imports.
// It runs first, installs error handlers, then dynamically imports main.tsx.
// If main.tsx throws during module evaluation you will see the exact error
// on screen instead of a silent blank page.
// ─────────────────────────────────────────────────────────────────────────────

function set(msg: string) {
  (window as any).__BOOT_STAGE__ = msg;
  const el = document.getElementById('boot-text');
  if (el) el.textContent = msg;
  console.debug('[boot]', msg);
}

function fatal(stage: string, err: any) {
  (window as any).__BOOT_STAGE__ = 'FATAL:' + stage;
  const text: string = (err && (err.stack || err.message)) ? (err.stack || err.message) : String(err);
  console.error('[boot] FATAL at stage:', stage, '\n', text);
  const boot = document.getElementById('boot-indicator');
  if (boot) {
    const style = 'position:fixed;top:0;left:0;right:0;bottom:0;background:#0a0e13;padding:24px;overflow:auto;font-family:ui-monospace,Menlo,Monaco,monospace;font-size:13px;color:#f87171;white-space:pre-wrap;word-break:break-word;z-index:99999;';
    boot.innerHTML = '<div style="' + style + '"><strong style="font-size:15px;color:#ef4444;">FATAL (stage: ' + stage + ')</strong>\n\n' + text + '\n\n<hr style="border-color:#333;margin:16px 0">Hard refresh: Cmd+Shift+R (Mac) / Ctrl+Shift+R (Win/Linux)</div>';
    boot.style.display = 'block';
  }
}

// Install global handlers BEFORE first await — these catch anything that
// bubbles out of lazy-loaded chunks after React mounts too.
window.addEventListener('error', (e) => {
  // Only handle errors from our JS bundles (/assets/). Errors from index.html
  // inline scripts (e.filename = page URL) would otherwise trigger false FATALs.
  if (!e.filename || !e.filename.includes('/assets/')) return;
  const root = document.getElementById('root');
  if (!root || root.children.length === 0) {
    fatal('window.error', (e as any).error || e);
  }
});

window.addEventListener('unhandledrejection', (e) => {
  const root = document.getElementById('root');
  if (!root || root.children.length === 0) {
    fatal('unhandledrejection', (e as any).reason);
  }
});

set('Loading… (boot.ts)');

(async () => {
  try {
    set('Loading… (import main)');
    await import('./main');
    set('Loading… (main imported)');
  } catch (e) {
    fatal('import(main)', e);
  }
})();
