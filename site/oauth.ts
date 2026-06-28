import type { Express, Request, Response } from "express";
import { getSessionCookieOptions } from "./_core/cookies";
import { upsertUser } from "./db";
import { ENV } from "./env";
import { COOKIE_NAME, ONE_YEAR_MS } from "./shared/const";

/**
 * OAuth code exchange URL. Defaults to `{OAUTH_SERVER_URL}/api/oauth/exchange`.
 * Override if your IdP uses a different path.
 */
function codeExchangeUrl(): string {
  const override = process.env.OAUTH_CODE_EXCHANGE_URL?.trim();
  if (override) return override;
  const base = ENV.oAuthServerUrl.replace(/\/$/, "");
  return `${base}/api/oauth/exchange`;
}

/**
 * Registers the browser redirect callback used by `getLoginUrl()` (`/api/oauth/callback`).
 * Exchanges `code` for a session at `OAUTH_SERVER_URL`, upserts the user, sets `pythh_session`.
 */
export function registerOAuthRoutes(app: Express): void {
  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = typeof req.query.code === "string" ? req.query.code : undefined;
    const oauthError = typeof req.query.error === "string" ? req.query.error : undefined;
    if (oauthError) {
      res.redirect(`/?auth_error=${encodeURIComponent(oauthError)}`);
      return;
    }
    if (!code) {
      res.redirect("/?auth_error=missing_code");
      return;
    }
    if (!ENV.oAuthServerUrl) {
      res.status(503).send("OAuth is not configured (OAUTH_SERVER_URL).");
      return;
    }

    try {
      const tokenRes = await fetch(codeExchangeUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          code,
          appId: process.env.VITE_APP_ID ?? "",
        }),
      });

      if (!tokenRes.ok) {
        const text = await tokenRes.text().catch(() => "");
        console.error("[oauth] code exchange failed", tokenRes.status, text);
        res.redirect("/?auth_error=exchange_failed");
        return;
      }

      const data = (await tokenRes.json()) as {
        openId?: string;
        name?: string | null;
        email?: string | null;
      };

      if (!data.openId) {
        res.redirect("/?auth_error=no_open_id");
        return;
      }

      await upsertUser({
        openId: data.openId,
        name: data.name ?? null,
        email: data.email ?? null,
      });

      res.cookie(COOKIE_NAME, JSON.stringify({ openId: data.openId }), {
        ...getSessionCookieOptions(req),
        maxAge: ONE_YEAR_MS,
      });
      res.redirect("/");
    } catch (err) {
      console.error("[oauth] callback error", err);
      res.redirect("/?auth_error=server");
    }
  });
}
