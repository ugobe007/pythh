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
];

/**
 * Check if an email has admin access.
 * ONLY checks the explicit allowlist — no pattern matching.
 */
export function isAdminEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}
