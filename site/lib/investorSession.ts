/**
 * Investor session — auth token (magic link) + anonymous portfolio owner id.
 */

const AUTH_TOKEN_KEY = 'pythh_investor_session_token';
const PORTFOLIO_OWNER_KEY = 'pythh_investor_session';

export function saveInvestorSessionToken(token: string) {
  try {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
  } catch {
    /* ignore */
  }
}

export function readInvestorSessionToken(): string | null {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function clearInvestorSessionToken() {
  try {
    localStorage.removeItem(AUTH_TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

export function investorAuthHeaders(): HeadersInit {
  const token = readInvestorSessionToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Stable anonymous id for virtual portfolio (X-Investor-Session). */
export function getInvestorSessionId(): string {
  const bound = localStorage.getItem('pythh_investor_portfolio_owner');
  if (bound) return bound;

  let id = localStorage.getItem(PORTFOLIO_OWNER_KEY);
  if (!id) {
    id = `inv_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    localStorage.setItem(PORTFOLIO_OWNER_KEY, id);
  }
  return id;
}

/** After investor signup, bind portfolio picks to a stable owner id keyed by investor_id. */
export function bindInvestorPortfolioOwner(investorId: string) {
  if (!investorId) return;
  const ownerId = `inv_${investorId}`;
  try {
    localStorage.setItem('pythh_investor_portfolio_owner', ownerId);
    localStorage.setItem(PORTFOLIO_OWNER_KEY, ownerId);
  } catch {
    /* ignore */
  }
}

export function investorSessionHeaders(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'X-Investor-Session': getInvestorSessionId(),
  };
}
