export { COOKIE_NAME, ONE_YEAR_MS } from "./shared/const";

/** Login page URL; optional return path after sign-in (e.g. /account). */
export const getLoginUrl = (returnPath?: string) => {
  const base = `${window.location.origin}/login`;
  if (returnPath && returnPath.startsWith("/")) {
    return `${base}?redirect=${encodeURIComponent(returnPath)}`;
  }
  return base;
};
