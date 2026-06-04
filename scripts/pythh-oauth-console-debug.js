/**
 * PYTHH Google OAuth — paste into DevTools Console on pythh.ai
 *
 * When to run:
 *   1. /login — before clicking Google → pythhOAuthDebug.snapshot()
 *   2. /account?code=… — right after Google returns → pythhOAuthDebug.runAll()
 *   3. Stuck spinner — pythhOAuthDebug.watch(60)
 *
 * Load without paste (if this file is hosted):
 *   fetch('/scripts/pythh-oauth-console-debug.js').then(r=>r.text()).then(eval);
 */
(function pythhOAuthDebugModule() {
  const NS = "pythhOAuthDebug";
  if (window[NS]?.version) {
    console.warn(`[${NS}] already loaded — call ${NS}.runAll() or ${NS}.snapshot()`);
    return;
  }

  const VERSION = "2026-06-04";
  const logs = [];

  function ts() {
    return new Date().toISOString().slice(11, 23);
  }

  function log(step, status, message, detail) {
    const row = { t: ts(), step, status, message, detail: detail ?? null };
    logs.push(row);
    const icon =
      status === "ok" ? "✅" : status === "fail" ? "❌" : status === "warn" ? "⚠️" : "ℹ️";
    console.log(`[${NS}] ${icon} ${step} — ${message}`, detail ?? "");
    return row;
  }

  function parseCookies() {
    const out = {};
    for (const part of document.cookie.split(";")) {
      const i = part.indexOf("=");
      if (i === -1) continue;
      out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
    }
    return out;
  }

  function supabaseProjectRef() {
    const url =
      window.__PYTHH_RUNTIME__?.supabaseUrl ||
      [...document.querySelectorAll("script")].map((s) => s.textContent).join("").match(
        /https:\/\/([^.]+)\.supabase\.co/,
      )?.[0] ||
      "";
    const m = String(url).match(/https?:\/\/([^.]+)\.supabase\.co/);
    return m?.[1] ?? null;
  }

  function supabaseAnonKey() {
    return window.__PYTHH_RUNTIME__?.supabaseAnonKey || null;
  }

  function findPkceVerifier() {
    const ref = supabaseProjectRef();
    if (ref) {
      const k = `sb-${ref}-auth-token-code-verifier`;
      const v = localStorage.getItem(k);
      if (v) return { source: k, value: v };
    }
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.includes("code-verifier")) {
        const v = localStorage.getItem(key);
        if (v) return { source: key, value: v };
      }
    }
    const backup = sessionStorage.getItem("pythh_pkce_verifier");
    if (backup) return { source: "pythh_pkce_verifier (session)", value: backup };
    return null;
  }

  function findSupabaseSession() {
    const ref = supabaseProjectRef();
    if (!ref) return null;
    const raw = localStorage.getItem(`sb-${ref}-auth-token`);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      return {
        hasAccessToken: !!parsed?.access_token,
        expiresAt: parsed?.expires_at,
        userId: parsed?.user?.id,
        email: parsed?.user?.email,
        accessTokenPrefix: parsed?.access_token?.slice(0, 12) + "…",
      };
    } catch (e) {
      return { parseError: String(e) };
    }
  }

  function handoffAgeMs() {
    const raw = sessionStorage.getItem("pythh_oauth_handoff");
    if (!raw) return null;
    const n = Number(raw);
    if (!Number.isFinite(n)) return { invalid: raw };
    return { startedAgoMs: Date.now() - n, active: Date.now() - n < 120_000 };
  }

  function parseHashTokens() {
    const raw = location.hash?.replace(/^#/, "").trim();
    if (!raw) return null;
    const h = new URLSearchParams(raw);
    const access_token = h.get("access_token");
    if (!access_token) return null;
    return {
      access_token: `${access_token.slice(0, 12)}…`,
      refresh_token: h.get("refresh_token") ? "present" : null,
      token_type: h.get("token_type"),
    };
  }

  function urlState() {
    const p = new URLSearchParams(location.search);
    const hash = parseHashTokens();
    return {
      path: location.pathname,
      href: location.href,
      code: p.get("code") ? `${p.get("code").slice(0, 8)}…` : null,
      codeLen: p.get("code")?.length ?? 0,
      hashTokens: hash,
      error: p.get("error"),
      error_description: p.get("error_description"),
      oauth_handoff: p.get("oauth_handoff"),
      next: p.get("next") || p.get("redirect"),
      oauth_error: p.get("oauth_error"),
    };
  }

  async function fetchAuthMe() {
    const input = encodeURIComponent(JSON.stringify({}));
    const res = await fetch(`/api/trpc/auth.me?input=${input}`, { credentials: "include" });
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* keep raw */
    }
    const user = json?.result?.data?.json ?? null;
    return { httpStatus: res.status, user, raw: json ?? text };
  }

  async function fetchSync(accessToken) {
    const res = await fetch("/api/trpc/auth.syncSupabaseSession", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ json: { access_token: accessToken } }),
    });
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* keep raw */
    }
    const err = json?.error?.json?.message;
    const user = json?.result?.data?.json?.user ?? null;
    return { httpStatus: res.status, ok: res.ok, user, error: err, raw: json ?? text };
  }

  async function tryPkceExchange(code, verifier) {
    const ref = supabaseProjectRef();
    const anon = supabaseAnonKey();
    if (!ref || !anon) {
      return { skipped: true, reason: "missing project ref or anon key (__PYTHH_RUNTIME__)" };
    }
    const url = `https://${ref}.supabase.co/auth/v1/token?grant_type=pkce`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anon,
        Authorization: `Bearer ${anon}`,
      },
      body: JSON.stringify({
        auth_code: code,
        code: code,
        code_verifier: verifier,
      }),
    });
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* raw */
    }
    return {
      httpStatus: res.status,
      ok: res.ok,
      error: json?.error_description || json?.msg || json?.error,
      hasAccessToken: !!json?.access_token,
      raw: json ?? text,
    };
  }

  function snapshot() {
    console.group(`[${NS}] snapshot v${VERSION}`);
    log("0.context", "info", `page ${location.pathname}`, urlState());

    const ref = supabaseProjectRef();
    log("1.supabase", ref ? "ok" : "fail", ref ? `project ${ref}` : "cannot detect supabase project ref", {
      runtime: window.__PYTHH_RUNTIME__ ?? null,
      anonKeyPresent: !!supabaseAnonKey(),
    });

    const pkce = findPkceVerifier();
    log(
      "2.pkce",
      pkce ? "ok" : "fail",
      pkce ? `verifier in ${pkce.source}` : "NO PKCE verifier (Google exchange will fail)",
      pkce ? { len: pkce.value.length } : null,
    );

    const sbSession = findSupabaseSession();
    log(
      "3.supabase_session",
      sbSession?.hasAccessToken ? "ok" : "warn",
      sbSession?.hasAccessToken ? "Supabase session in localStorage" : "no Supabase session yet",
      sbSession,
    );

    const cookies = parseCookies();
    log("4.cookies", cookies.pythh_session ? "ok" : "warn", "document.cookie", {
      pythh_session: cookies.pythh_session ? "present" : "missing",
      sb_pkce: cookies.sb_pkce ? `present (${cookies.sb_pkce.length} chars)` : "missing",
      pythh_oauth_next: cookies.pythh_oauth_next || null,
      allKeys: Object.keys(cookies),
    });

    log("5.session_storage", "info", "handoff + errors", {
      handoff: handoffAgeMs(),
      pythh_oauth_error: sessionStorage.getItem("pythh_oauth_error"),
      pythh_post_login: sessionStorage.getItem("pythh_post_login"),
    });

    const lsAuth = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith("sb-")) lsAuth.push(k);
    }
    log("6.localStorage", "info", "sb-* keys", lsAuth);

    console.groupEnd();
    return { url: urlState(), pkce: !!pkce, cookies, sbSession };
  }

  async function runAll() {
    console.group(`[${NS}] runAll v${VERSION}`);
    snapshot();

    const params = new URLSearchParams(location.search);
    const code = params.get("code");
    const hashTokens = parseHashTokens();
    if (hashTokens) {
      log(
        "7.hash",
        "ok",
        "BREAKPOINT FOUND: tokens in URL #hash (implicit flow) — app must sync access_token from hash",
        hashTokens,
      );
      const full = new URLSearchParams(location.hash.replace(/^#/, ""));
      const access = full.get("access_token");
      if (access) {
        log("9.sync", "info", "attempting auth.syncSupabaseSession from hash token…");
        const sync = await fetchSync(access);
        if (sync.ok && sync.user) log("9.sync", "ok", "pythh_session sync OK", sync.user);
        else log("9.sync", "fail", "BREAKPOINT: sync failed", sync);
      }
    } else if (!code) {
      log("7.code", "warn", "no ?code= or #access_token= — complete Google sign-in first");
    } else {
      log("7.code", "ok", `code present (${code.length} chars)`);
    }

    const pkce = findPkceVerifier();
    if (code && !pkce) {
      log(
        "8.exchange",
        "fail",
        "BREAKPOINT: code in URL but PKCE verifier missing — re-start from /login, do not refresh",
      );
    } else if (code && pkce) {
      log("8.exchange", "info", "attempting Supabase PKCE token exchange…");
      const ex = await tryPkceExchange(code, pkce.value);
      if (ex.ok && ex.hasAccessToken) {
        log("8.exchange", "ok", "Supabase exchange succeeded", { httpStatus: ex.httpStatus });
        log("9.sync", "info", "attempting auth.syncSupabaseSession…");
        const token =
          JSON.parse(localStorage.getItem(`sb-${supabaseProjectRef()}-auth-token`) || "{}")
            ?.access_token || ex.raw?.access_token;
        if (token) {
          const sync = await fetchSync(token);
          if (sync.ok && sync.user) {
            log("9.sync", "ok", "pythh_session sync OK", sync.user);
          } else {
            log("9.sync", "fail", "BREAKPOINT: sync failed", sync);
          }
        } else {
          log("9.sync", "warn", "no access_token to sync", ex);
        }
      } else {
        log("8.exchange", "fail", "BREAKPOINT: Supabase PKCE exchange failed", ex);
      }
    }

    log("10.auth_me", "info", "fetching auth.me…");
    const me = await fetchAuthMe();
    if (me.user) {
      log("10.auth_me", "ok", "logged in to PYTHH", me.user);
    } else {
      log("10.auth_me", "fail", "BREAKPOINT: not logged in (no pythh_session user)", me);
    }

    console.groupEnd();
    console.table(logs);
    return logs;
  }

  let watchTimer = null;
  function watch(seconds = 45) {
    if (watchTimer) clearInterval(watchTimer);
    let n = 0;
    console.log(`[${NS}] watching every 2s for ${seconds}s — go through Google login now`);
    watchTimer = setInterval(async () => {
      n += 1;
      console.log(`[${NS}] —— tick ${n} ——`);
      snapshot();
      if (new URLSearchParams(location.search).get("code")) {
        await runAll();
      } else {
        const me = await fetchAuthMe();
        log("10.auth_me", me.user ? "ok" : "warn", me.user ? "session OK" : "still anonymous", me.user);
      }
      if (n * 2 >= seconds) {
        clearInterval(watchTimer);
        watchTimer = null;
        console.log(`[${NS}] watch ended`);
      }
    }, 2000);
    return () => clearInterval(watchTimer);
  }

  function clearOAuthState() {
    sessionStorage.removeItem("pythh_oauth_handoff");
    sessionStorage.removeItem("pythh_oauth_error");
    sessionStorage.removeItem("pythh_post_login");
    document.cookie = "sb_pkce=; Path=/; Max-Age=0";
    document.cookie = "pythh_oauth_next=; Path=/; Max-Age=0";
    log("clear", "ok", "cleared handoff/error cookies (not pythh_session)");
  }

  window[NS] = {
    version: VERSION,
    snapshot,
    runAll,
    watch,
    clearOAuthState,
    logs: () => logs,
    export: () => JSON.stringify({ version: VERSION, logs, url: urlState() }, null, 2),
  };

  console.log(
    `%c[${NS}] loaded v${VERSION}`,
    "color:#22d3ee;font-weight:bold",
    `\n  snapshot()  — current state\n  runAll()      — run checks + pinpoint BREAKPOINT\n  watch(60)     — poll during login\n  clearOAuthState() — reset stuck handoff\n  export()      — JSON for support`,
  );
})();
