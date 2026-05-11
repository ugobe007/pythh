import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { AuthedUser, TrpcContext } from "./_core/trpc";
import { COOKIE_NAME } from "./shared/const";
import { getUserByOpenId } from "./db";

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    let val = part.slice(idx + 1).trim();
    try {
      val = decodeURIComponent(val);
    } catch {
      /* keep raw */
    }
    out[key] = val;
  }
  return out;
}

function mapRowToAuthedUser(row: {
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  role: "user" | "admin";
}): AuthedUser {
  return {
    id: row.id,
    openId: row.openId,
    name: row.name,
    email: row.email,
    role: row.role,
  };
}

async function userFromSessionRaw(raw: string): Promise<AuthedUser | null> {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("s:")) {
    // Express-style signed cookie — needs shared secret + parser; treat as anonymous until wired.
    return null;
  }

  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as { openId?: string };
      if (parsed?.openId && typeof parsed.openId === "string") {
        const row = await getUserByOpenId(parsed.openId);
        return row ? mapRowToAuthedUser(row) : null;
      }
    } catch {
      return null;
    }
  }

  const row = await getUserByOpenId(trimmed);
  return row ? mapRowToAuthedUser(row) : null;
}

export async function createContext({ req, res }: CreateExpressContextOptions): Promise<TrpcContext> {
  const cookies = parseCookies(req.headers.cookie);
  const raw = cookies[COOKIE_NAME];
  const user = raw ? await userFromSessionRaw(raw) : null;
  return { user, req, res };
}
