/** Keeps a Scout code across signup, OAuth, and the account page. */

const KEY = "pythh_scout_coupon";

export function normalizeScoutCoupon(raw: string | null | undefined): string {
  const code = String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (code.length < 4 || code.length > 32 || !/[A-Z0-9]/.test(code)) return "";
  return code;
}

export function rememberScoutCoupon(raw: string | null | undefined): string {
  const code = normalizeScoutCoupon(raw);
  if (typeof sessionStorage === "undefined") return code;
  if (code) sessionStorage.setItem(KEY, code);
  else sessionStorage.removeItem(KEY);
  return code;
}

export function readScoutCoupon(): string {
  if (typeof sessionStorage === "undefined") return "";
  return normalizeScoutCoupon(sessionStorage.getItem(KEY));
}

export function clearScoutCoupon(): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(KEY);
}

/** URL wins, then whatever signup already stored. */
export function captureScoutCouponFromSearch(search?: string): string {
  const params = new URLSearchParams(
    search ?? (typeof window !== "undefined" ? window.location.search : ""),
  );
  const fromUrl = params.get("coupon");
  if (fromUrl) return rememberScoutCoupon(fromUrl);
  return readScoutCoupon();
}

export function founderSignupWithCoupon(code: string): string {
  const normalized = normalizeScoutCoupon(code);
  if (!normalized) return "/signup/founder";
  return `/signup/founder?coupon=${encodeURIComponent(normalized)}`;
}

export function withScoutCoupon(path: string, code: string): string {
  const normalized = normalizeScoutCoupon(code);
  if (!normalized) return path;
  const [pathname, search = ""] = path.split("?");
  const params = new URLSearchParams(search);
  params.set("coupon", normalized);
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}
