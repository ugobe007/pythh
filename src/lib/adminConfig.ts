/**
 * Single source of truth for admin email addresses.
 * Used by AuthContext, RouteGuards, and LogoDropdownMenu.
 * 
 * To add a new admin, add their email here (lowercase).
 */
export const ADMIN_EMAILS: string[] = [
  'aabramson@comunicano.com',
  'ugobe07@gmail.com',
  'ugobe1@mac.com',
  'emmons@projectwilbur.com',
];

/**
 * Check if an email has admin access.
 * Explicit allowlist first; legacy match for addresses containing "admin" (e.g. admin@pythh.ai).
 */
export function isAdminEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  const lower = email.toLowerCase();
  if (ADMIN_EMAILS.includes(lower)) return true;
  if (lower.includes('admin')) return true;
  return false;
}
