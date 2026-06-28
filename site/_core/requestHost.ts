import type { Request } from "express";

/** Host the browser used (Vercel sets x-forwarded-host to pythh.ai). */
export function requestHost(req: Request): string {
  const forwarded = req.headers["x-forwarded-host"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim().split(":")[0].toLowerCase();
  }
  return (req.headers.host || "").split(":")[0].toLowerCase();
}

export function sessionCookieDomain(req: Request): string | undefined {
  const host = requestHost(req);
  if (host === "pythh.ai" || host.endsWith(".pythh.ai")) return ".pythh.ai";
  const appUrl = String(process.env.APP_URL || process.env.APP_BASE_URL || "");
  if (appUrl.includes("pythh.ai")) return ".pythh.ai";
  return undefined;
}
