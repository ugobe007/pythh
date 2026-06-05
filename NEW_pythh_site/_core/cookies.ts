import type { Request } from "express";
import { sessionCookieDomain } from "./requestHost";

/** Session cookie options (Express). */
export function getSessionCookieOptions(req: Request) {
  const secure =
    process.env.NODE_ENV === "production" || !!process.env.FLY_APP_NAME;
  const domain = sessionCookieDomain(req);
  return {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
    ...(domain ? { domain } : {}),
  };
}
