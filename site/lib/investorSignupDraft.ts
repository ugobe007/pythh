const STORAGE_KEY = 'pythh_investor_signup_draft';
const LEGACY_SESSION_KEY = 'pythh_investor_signup_draft';

export type InvestorSignupDraft = {
  investor_id: string;
  email: string;
  name?: string;
};

function readFromStorage(storage: Storage): InvestorSignupDraft | null {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as InvestorSignupDraft;
    if (!parsed?.investor_id || !parsed?.email) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Migrate one-time from sessionStorage (older builds). */
function migrateLegacySessionDraft(): InvestorSignupDraft | null {
  try {
    const legacy = readFromStorage(sessionStorage);
    if (!legacy) return null;
    saveInvestorSignupDraft(legacy);
    sessionStorage.removeItem(LEGACY_SESSION_KEY);
    return legacy;
  } catch {
    return null;
  }
}

export function saveInvestorSignupDraft(draft: InvestorSignupDraft) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch {
    /* ignore quota / private mode */
  }
}

export function readInvestorSignupDraft(): InvestorSignupDraft | null {
  return readFromStorage(localStorage) ?? migrateLegacySessionDraft();
}

export function clearInvestorSignupDraft() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(LEGACY_SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export function isResumeSignupUrl() {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('resume') === '1';
}

/** True when user has an incomplete email-first profile to finish. */
export function hasInvestorProfileDraft(): boolean {
  return Boolean(readInvestorSignupDraft());
}
