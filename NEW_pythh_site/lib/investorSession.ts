const STORAGE_KEY = 'pythh_investor_session_token';

export function saveInvestorSessionToken(token: string) {
  try {
    localStorage.setItem(STORAGE_KEY, token);
  } catch {
    /* ignore */
  }
}

export function readInvestorSessionToken(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function clearInvestorSessionToken() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function investorAuthHeaders(): HeadersInit {
  const token = readInvestorSessionToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
