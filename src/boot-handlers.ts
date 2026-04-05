// ─── Boot error handlers (no React). Imported first from main.tsx. ───────────
// Avoids boot.ts → dynamic import(main), which triggers Vite CSS preload that
// can throw "Unable to preload CSS" and block the entire app from loading.

export function setBootText(msg: string) {
  (window as unknown as { __BOOT_STAGE__?: string }).__BOOT_STAGE__ = msg;
  const el = document.getElementById('boot-text');
  if (el) el.textContent = msg;
  console.debug('[boot]', msg);
}

export function fatalBoot(stage: string, err: unknown) {
  (window as unknown as { __BOOT_STAGE__?: string }).__BOOT_STAGE__ = 'FATAL:' + stage;
  const text =
    err && typeof err === 'object' && ('stack' in err || 'message' in err)
      ? String((err as { stack?: string; message?: string }).stack || (err as { message?: string }).message)
      : String(err);
  console.error('[boot] FATAL at stage:', stage, '\n', text);
  const boot = document.getElementById('boot-indicator');
  if (boot) {
    const style =
      'position:fixed;top:0;left:0;right:0;bottom:0;background:#0a0e13;padding:24px;overflow:auto;font-family:ui-monospace,Menlo,Monaco,monospace;font-size:13px;color:#f87171;white-space:pre-wrap;word-break:break-word;z-index:99999;';
    boot.innerHTML =
      '<div style="' +
      style +
      '"><strong style="font-size:15px;color:#ef4444;">FATAL (stage: ' +
      stage +
      ')</strong>\n\n' +
      text +
      '\n\n<hr style="border-color:#333;margin:16px 0">Hard refresh: Cmd+Shift+R (Mac) / Ctrl+Shift+R (Win/Linux)</div>';
    boot.style.display = 'block';
  }
}

window.addEventListener('vite:preloadError', () => {
  const RELOAD_KEY = '__vite_preload_reload__';
  if (sessionStorage.getItem(RELOAD_KEY)) {
    console.warn('[boot] vite:preloadError — already reloaded once, not retrying.');
    return;
  }
  sessionStorage.setItem(RELOAD_KEY, '1');
  console.warn('[boot] vite:preloadError — chunk load failed, reloading for fresh assets…');
  window.location.reload();
});

window.addEventListener('error', (e) => {
  if (!e.filename || !e.filename.includes('/assets/')) return;
  const root = document.getElementById('root');
  if (!root || root.children.length === 0) {
    fatalBoot('window.error', (e as ErrorEvent).error || e);
  }
});

window.addEventListener('unhandledrejection', (e) => {
  const root = document.getElementById('root');
  if (!root || root.children.length === 0) {
    fatalBoot('unhandledrejection', (e as PromiseRejectionEvent).reason);
  }
});

setBootText('Loading… (app)');
