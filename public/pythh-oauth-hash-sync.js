/**
 * Runs before the React bundle. Captures Supabase implicit OAuth hash and POSTs
 * access_token to /api/auth/sync-supabase so pythh_session exists on first paint.
 */
(function pythhOAuthHashSync() {
  var CAPTURE_KEY = "pythh_oauth_hash_capture";
  var HANDOFF_KEY = "pythh_oauth_handoff";
  var SYNC_PREFIX = "pythh_oauth_hash_sync:";

  function readCapture() {
    try {
      var raw = sessionStorage.getItem(CAPTURE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (parsed && parsed.access_token) return parsed;
    } catch (e) {
      /* ignore */
    }
    return null;
  }

  function parseHashTokens() {
    var raw = (location.hash || "").replace(/^#/, "").trim();
    if (raw && raw.indexOf("access_token=") !== -1) {
      var params = new URLSearchParams(raw);
      var access = params.get("access_token");
      if (!access) {
        var match = raw.match(/(?:^|&)access_token=([^&]*)/);
        access = match && match[1] ? decodeURIComponent(match[1].replace(/\+/g, " ")) : null;
      }
      if (access) {
        var captured = {
          access_token: access,
          refresh_token: params.get("refresh_token"),
        };
        try {
          sessionStorage.setItem(CAPTURE_KEY, JSON.stringify(captured));
        } catch (e) {
          /* ignore */
        }
        return captured;
      }
    }
    return readCapture();
  }

  function cleanUrlAfterOAuth() {
    var params = new URLSearchParams(location.search);
    var next = params.get("next") || params.get("redirect");
    var path = location.pathname;
    var clean = next && next.charAt(0) === "/" ? next : path;
    history.replaceState({}, "", clean);
  }

  var tokens = parseHashTokens();
  if (!tokens || !tokens.access_token) {
    window.__PYTHH_OAUTH_HASH_SYNC__ = Promise.resolve({ ok: false });
    return;
  }

  try {
    sessionStorage.setItem(HANDOFF_KEY, String(Date.now()));
  } catch (e) {
    /* ignore */
  }

  var dedupe = SYNC_PREFIX + tokens.access_token.slice(0, 24);
  if (sessionStorage.getItem(dedupe) === "ok") {
    cleanUrlAfterOAuth();
    window.__PYTHH_OAUTH_HASH_SYNC__ = Promise.resolve({ ok: true });
    return;
  }
  if (sessionStorage.getItem(dedupe) === "pending") {
    window.__PYTHH_OAUTH_HASH_SYNC__ = new Promise(function (resolve) {
      var n = 0;
      var iv = setInterval(function () {
        n += 1;
        if (sessionStorage.getItem(dedupe) === "ok") {
          clearInterval(iv);
          cleanUrlAfterOAuth();
          resolve({ ok: true });
        } else if (sessionStorage.getItem(dedupe) !== "pending" || n > 40) {
          clearInterval(iv);
          resolve({ ok: false, error: "OAuth sync still in progress" });
        }
      }, 250);
    });
    return;
  }

  try {
    sessionStorage.setItem(dedupe, "pending");
  } catch (e) {
    /* ignore */
  }

  window.__PYTHH_OAUTH_HASH_SYNC__ = fetch("/api/auth/sync-supabase", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ access_token: tokens.access_token }),
  })
    .then(function (res) {
      return res.text().then(function (text) {
        var body = {};
        try {
          body = JSON.parse(text);
        } catch (e) {
          body = { error: text || "Invalid response" };
        }
        if (res.ok) {
          try {
            sessionStorage.setItem(dedupe, "ok");
            sessionStorage.removeItem(CAPTURE_KEY);
          } catch (e) {
            /* ignore */
          }
          cleanUrlAfterOAuth();
          return { ok: true, body: body };
        }
        try {
          sessionStorage.removeItem(dedupe);
          sessionStorage.setItem("pythh_oauth_error", body.error || "Sign-in failed (" + res.status + ")");
        } catch (e) {
          /* ignore */
        }
        return { ok: false, error: body.error || "Sign-in failed (" + res.status + ")" };
      });
    })
    .catch(function (err) {
      try {
        sessionStorage.removeItem(dedupe);
        sessionStorage.setItem(
          "pythh_oauth_error",
          (err && err.message) || "Network error during sign-in",
        );
      } catch (e) {
        /* ignore */
      }
      return { ok: false, error: (err && err.message) || "Network error" };
    });
})();
