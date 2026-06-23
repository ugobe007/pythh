const STORAGE_KEY = 'pythh_investor_signup_draft';

export type InvestorSignupDraft = {
  investor_id: string;
  email: string;
  name?: string;
};

export function saveInvestorSignupDraft(draft: InvestorSignupDraft) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch {
    /* ignore quota / private mode */
  }
}

export function readInvestorSignupDraft(): InvestorSignupDraft | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as InvestorSignupDraft;
    if (!parsed?.investor_id || !parsed?.email) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearInvestorSignupDraft() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function isResumeSignupUrl() {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('resume') === '1';
}
