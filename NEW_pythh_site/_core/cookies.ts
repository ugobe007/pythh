/** Session cookie options (Express). */

export function getSessionCookieOptions(_req: unknown) {
  const secure = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
  };
}
