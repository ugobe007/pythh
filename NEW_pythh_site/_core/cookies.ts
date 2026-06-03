import type { Request } from "express";

/** Session cookie options (Express). */
export function getSessionCookieOptions(req: Request) {
  const secure =
    process.env.NODE_ENV === "production" || !!process.env.FLY_APP_NAME;
  const host = (req.headers.host || "").split(":")[0]?.toLowerCase() || "";
  const domain =
    host === "pythh.ai" || host.endsWith(".pythh.ai") ? ".pythh.ai" : undefined;
  return {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
    ...(domain ? { domain } : {}),
  };
}
