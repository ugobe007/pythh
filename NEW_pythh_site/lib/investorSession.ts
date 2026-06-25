/**
 * Anonymous investor session for virtual portfolio (localStorage).
 */

const SESSION_KEY = 'pythh_investor_session';

export function getInvestorSessionId(): string {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = `inv_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export function investorSessionHeaders(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'X-Investor-Session': getInvestorSessionId(),
  };
}
